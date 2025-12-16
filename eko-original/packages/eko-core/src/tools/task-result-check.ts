/**
 * TaskResultCheck Tool - Task Completion Validation
 *
 * Final checkpoint before agent marks task complete. Forces agent to
 * review entire execution history and justify completion status with
 * chain-of-thought reasoning.
 *
 * Architecture:
 * - Agent finishes perceived work → calls task_result_check
 * - Tool schema forces: thought + completionStatus + remaining todoList
 * - LLM reviews conversation history to justify completion
 * - Returns completed/incomplete signal to workflow orchestrator
 *
 * WHY explicit completion check?
 * 1. **Prevents premature termination**: Agent must justify why done
 * 2. **User transparency**: Shows reasoning for completion decision
 * 3. **Partial completion detection**: Identifies when task 80% done
 * 4. **Missed requirement detection**: LLM catches forgotten sub-tasks
 *
 * Completion criteria (enforced via schema description):
 * - "completed": **Entire** task finished (not partial success)
 * - "incomplete": Any sub-task remains OR task failed
 *
 * Design pattern: Exit gate (task can't complete without passing check).
 * Similar to test-driven development's "all tests must pass" gate.
 *
 * Example flow:
 * Agent: Scraped 100 products, extracted prices, generated CSV
 * Agent calls: task_result_check({
 *   thought: "Successfully scraped all products and created report. 
 *            All requirements met.",
 *   completionStatus: "completed"
 * })
 * System: Marks workflow complete, returns result to user
 *
 * Failure example:
 * Agent: Scraped 100 products but CSV export failed
 * Agent calls: task_result_check({
 *   thought: "Data scraped but export failed with permission error",
 *   completionStatus: "incomplete",
 *   todoList: "Fix file permissions and retry CSV export"
 * })
 * System: Triggers retry or reports partial failure to user
 */

import { JSONSchema7 } from "json-schema";
import { RetryLanguageModel } from "../llm";
import { extractUsedTool } from "../memory";
import { mergeTools } from "../common/utils";
import { callAgentLLM } from "../agent/agent-llm";
import { AgentContext } from "../agent/agent-context";
import { Tool, ToolResult } from "../types/tools.types";
import {
  LanguageModelV2Prompt,
  LanguageModelV2FunctionTool,
} from "@ai-sdk/provider";
import Log from "../common/log";

export const TOOL_NAME = "task_result_check";

export default class TaskResultCheckTool implements Tool {
  readonly name: string = TOOL_NAME;
  readonly description: string;
  readonly parameters: JSONSchema7;

  constructor() {
    this.description = `Check the current task execution process and results, evaluate the overall completion status of the current task, and whether the output variables in the nodes are stored.`;
    this.parameters = {
      type: "object",
      properties: {
        thought: {
          type: "string",
          description:
            "Please conduct thoughtful analysis of the overall execution process and results of the current task, analyzing whether the task has been completed.",
        },
        completionStatus: {
          type: "string",
          description:
            "The completion status of the current task is only considered complete when the entire current task is finished; partial completion or task failure is considered incomplete",
          enum: ["completed", "incomplete"],
        },
        todoList: {
          type: "string",
          description:
            "Pending task list for incomplete tasks, when tasks are not fully completed, please describe which tasks remain to be completed",
        },
      },
      required: ["thought", "completionStatus"],
    };
  }

  /**
   * Execute always returns success (validation happens in doTaskResultCheck)
   *
   * Tool call params (thought, completionStatus) stored in agent history
   * for observability. Actual completion logic uses returned status.
   */
  async execute(
    args: Record<string, unknown>,
    agentContext: AgentContext
  ): Promise<ToolResult> {
    return {
      content: [
        {
          type: "text",
          text: "success",
        },
      ],
    };
  }
}

/**
 * Validates task completion via meta-LLM call
 *
 * Strategy:
 * 1. Extract tools used in current execution (provides context)
 * 2. Add task_result_check as available tool
 * 3. Inject task XML + full execution context
 * 4. Ask LLM: "Is this task truly complete?"
 * 5. LLM reviews conversation, calls task_result_check with verdict
 * 6. Parse completionStatus from tool call
 *
 * WHY meta-call? Offloads completion logic to LLM's holistic reasoning
 * (can detect subtle failures like "task succeeded but wrong output").
 *
 * Returns: { completionStatus: "completed" | "incomplete" }
 * Used by workflow orchestrator to decide next action.
 */
async function doTaskResultCheck(
  agentContext: AgentContext,
  rlm: RetryLanguageModel,
  messages: LanguageModelV2Prompt,
  tools: LanguageModelV2FunctionTool[]
): Promise<{ completionStatus: "completed" | "incomplete" }> {
  try {
    // extract used tool
    const usedTools = extractUsedTool(messages, tools);
    const taskResultCheck = new TaskResultCheckTool();
    const newTools = mergeTools(usedTools, [
      {
        type: "function",
        name: taskResultCheck.name,
        description: taskResultCheck.description,
        inputSchema: taskResultCheck.parameters,
      },
    ]);
    // handle messages
    const newMessages: LanguageModelV2Prompt = [...messages];
    newMessages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: `Task:\n${agentContext.agentChain.agent.xml}\n\nPlease check the completion status of the current task.`,
        },
      ],
    });
    const result = await callAgentLLM(
      agentContext,
      rlm,
      newMessages,
      newTools,
      true,
      {
        type: "tool",
        toolName: taskResultCheck.name,
      }
    );
    const toolCall = result.filter((s) => s.type == "tool-call")[0];
    const args =
      typeof toolCall.input == "string"
        ? JSON.parse(toolCall.input || "{}")
        : toolCall.input || {};
    const toolResult = await taskResultCheck.execute(args, agentContext);
    const callback = agentContext.context.config.callback;
    if (callback) {
      await callback.onMessage(
        {
          streamType: "agent",
          chatId: agentContext.context.chatId,
          taskId: agentContext.context.taskId,
          agentName: agentContext.agent.Name,
          nodeId: agentContext.agentChain.agent.id,
          type: "tool_result",
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          params: args,
          toolResult: toolResult,
        },
        agentContext
      );
    }
    if (args.completionStatus == "incomplete") {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: `It seems that your task has not been fully completed. Please continue with the remaining steps:\n${
              args.todoList || ""
            }`,
          },
        ],
      });
    }
    return {
      completionStatus: args.completionStatus,
    };
  } catch (e) {
    Log.error("TaskResultCheckTool error", e);
    return {
      completionStatus: "completed",
    };
  }
}

export { TaskResultCheckTool, doTaskResultCheck };
