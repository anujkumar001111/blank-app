/**
 * @fileoverview Workflow planning system that converts natural language to agent XML.
 * 
 * The Planner uses LLMs to decompose natural language tasks into structured workflows
 * with agents, dependencies, and execution steps. Critical to Eko's natural language
 * interface - transforms "book a flight to Paris" into actionable agent tree.
 * 
 * @module agent/plan
 */

import Log from "../common/log";
import { sleep } from "../common/utils";
import TaskContext from "./agent-context";
import { RetryLanguageModel } from "../llm";
import { parseWorkflow } from "../common/xml";
import { LLMRequest } from "../types/llm.types";
import { AgentStreamCallback, Workflow } from "../types/agent.types";
import { getPlanSystemPrompt, getPlanUserPrompt } from "../prompt/plan";
import {
  LanguageModelV2Prompt,
  LanguageModelV2StreamPart,
  LanguageModelV2TextPart,
} from "@ai-sdk/provider";

/**
 * Converts natural language task descriptions into executable agent workflows.
 * 
 * WHY: Agents need structured instructions (which agent, what task, dependencies).
 * Planner bridges the gap between human intent and machine execution by:
 * 1. Analyzing task requirements and available agent capabilities
 * 2. Decomposing complex tasks into subtasks
 * 3. Determining optimal agent assignment and execution order
 * 4. Generating XML workflow that Eko can execute
 * 
 * WORKFLOW XML FORMAT:
 * ```xml
 * <root>
 *   <thought>Task analysis and strategy</thought>
 *   <agents>
 *     <agent name="Browser" id="0">
 *       <task>Search for flights</task>
 *       <nodes>...</nodes>
 *     </agent>
 *     <agent name="File" id="1" dependsOn="0">
 *       <task>Save results</task>
 *     </agent>
 *   </agents>
 * </root>
 * ```
 * 
 * @example
 * ```typescript
 * const planner = new Planner(taskContext);
 * const workflow = await planner.plan('Book flight to Paris and save confirmation');
 * // workflow.agents[0]: Browser agent searches flights
 * // workflow.agents[1]: File agent saves confirmation (depends on agent 0)
 * ```
 */
export class Planner {
  private taskId: string;
  private context: TaskContext;
  private callback?: AgentStreamCallback;

  constructor(context: TaskContext, callback?: AgentStreamCallback) {
    this.context = context;
    this.taskId = context.taskId;
    this.callback = callback || context.config.callback;
  }

  /**
   * Generates initial workflow plan from task description.
   * 
   * @param taskPrompt - Natural language task or structured prompt with multimodal content
   * @param saveHistory - Whether to save request/response for replanning
   * @param datetime - Optional timestamp for time-aware planning
   * @returns Structured workflow with agents and dependencies
   * 
   * @remarks
   * System prompt includes agent capabilities, available tools, and example workflows.
   * LLM temperature is set to 0.7 to balance creativity (task decomposition) with
   * consistency (valid XML structure).
   */
  async plan(
    taskPrompt: string | LanguageModelV2TextPart,
    saveHistory?: boolean,
    datetime?: string
  ): Promise<Workflow> {
    let taskPromptStr;
    let userPrompt: LanguageModelV2TextPart;
    if (typeof taskPrompt === "string") {
      taskPromptStr = taskPrompt;
      userPrompt = {
        type: "text",
        text: getPlanUserPrompt(this.context, taskPrompt),
      };
    } else {
      userPrompt = taskPrompt;
      taskPromptStr = taskPrompt.text || "";
    }
    const messages: LanguageModelV2Prompt = [
      {
        role: "system",
        content: await getPlanSystemPrompt(this.context),
      },
      {
        role: "user",
        content: [userPrompt],
      },
    ];
    return await this.doPlan(taskPromptStr, messages, saveHistory ?? true);
  }

  /**
   * Modifies existing workflow plan based on new requirements.
   * 
   * WHY: Users may refine tasks mid-execution ("wait, search only tech news").
   * Replanning preserves context by including original plan in conversation,
   * allowing LLM to understand what changed vs. starting from scratch.
   * 
   * @param taskPrompt - Modification request or new requirements
   * @param saveHistory - Whether to update saved conversation for future replans
   * @returns Updated workflow incorporating changes
   * 
   * @remarks
   * If no previous plan exists, falls back to regular planning. Otherwise,
   * appends modification request to planning conversation history.
   */
  async replan(
    taskPrompt: string,
    saveHistory: boolean = true,
    datetime?: string
  ): Promise<Workflow> {
    const chain = this.context.chain;
    if (chain.planRequest && chain.planResult) {
      // Include previous plan in conversation for context-aware replanning
      const messages: LanguageModelV2Prompt = [
        ...chain.planRequest.messages,
        {
          role: "assistant",
          content: [{ type: "text", text: chain.planResult }],
        },
        {
          role: "user",
          content: [{ type: "text", text: taskPrompt }],
        },
      ];
      return await this.doPlan(taskPrompt, messages, saveHistory);
    } else {
      return this.plan(taskPrompt, saveHistory, datetime);
    }
  }

  /**
   * Core planning loop with streaming and retry logic.
   * 
   * FLOW:
   * 1. Call planner LLM with agent capabilities in system prompt
   * 2. Stream XML workflow as it's generated
   * 3. Parse streaming XML incrementally for progress updates
   * 4. On completion, parse final XML into Workflow object
   * 5. Retry up to 3 times on transient failures
   * 
   * @param retryNum - Current retry attempt (internal use)
   * @returns Final parsed workflow structure
   * 
   * @remarks
   * Streams partial XML to callback for responsive UI. Uses fixXmlTag() to handle
   * incomplete XML during streaming. Max output tokens: 8192 to accommodate
   * complex workflows with many agents.
   */
  async doPlan(
    taskPrompt: string,
    messages: LanguageModelV2Prompt,
    saveHistory: boolean,
    retryNum: number = 0
  ): Promise<Workflow> {
    const config = this.context.config;
    const rlm = new RetryLanguageModel(config.llms, config.planLlms);
    rlm.setContext(this.context);
    const request: LLMRequest = {
      maxOutputTokens: 8192,
      temperature: 0.7,
      messages: messages,
      abortSignal: this.context.controller.signal,
    };
    const result = await rlm.callStream(request);
    const reader = result.stream.getReader();
    let streamText = "";
    let thinkingText = "";
    try {
      while (true) {
        await this.context.checkAborted(true);
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        let chunk = value as LanguageModelV2StreamPart;
        if (chunk.type == "error") {
          Log.error("Plan, LLM Error: ", chunk);
          throw new Error("LLM Error: " + chunk.error);
        }
        if (chunk.type == "reasoning-delta") {
          thinkingText += chunk.delta || "";
        }
        if (chunk.type == "text-delta") {
          streamText += chunk.delta || "";
        }
        if (chunk.type == "finish") {
          if (chunk.finishReason == "content-filter") {
            throw new Error("LLM error: trigger content filtering violation");
          }
          if (chunk.finishReason == "other") {
            throw new Error("LLM error: terminated due to other reasons");
          }
        }
        if (this.callback) {
          const workflow = parseWorkflow(
            this.taskId,
            streamText,
            false,
            thinkingText
          );
          if (workflow) {
            await this.callback.onMessage({
              streamType: "agent",
              chatId: this.context.chatId,
              taskId: this.taskId,
              agentName: "Planer",
              type: "workflow",
              streamDone: false,
              workflow: workflow as Workflow,
            });
          }
        }
      }
    } catch (e: any) {
      if (retryNum < 3) {
        await sleep(1000);
        return await this.doPlan(taskPrompt, messages, saveHistory, ++retryNum);
      }
      throw e;
    } finally {
      reader.releaseLock();
      if (Log.isEnableInfo()) {
        Log.info("Planner result: \n" + streamText);
      }
    }
    if (saveHistory) {
      const chain = this.context.chain;
      chain.planRequest = request;
      chain.planResult = streamText;
    }
    const workflow = parseWorkflow(
      this.taskId,
      streamText,
      true,
      thinkingText
    ) as Workflow;
    if (workflow.taskPrompt) {
      workflow.taskPrompt += "\n" + taskPrompt;
    } else {
      workflow.taskPrompt = taskPrompt;
    }
    workflow.taskPrompt = workflow.taskPrompt.trim();
    if (this.callback) {
      await this.callback.onMessage({
        streamType: "agent",
        chatId: this.context.chatId,
        taskId: this.taskId,
        agentName: "Planer",
        type: "workflow",
        streamDone: true,
        workflow: workflow,
      });
    }
    return workflow;
  }
}
