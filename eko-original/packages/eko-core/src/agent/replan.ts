/**
 * Workflow Replanning System
 *
 * Adaptive workflow modification when execution reveals plan inadequacy.
 * Key strategy: LLM evaluates partial execution results and decides if
 * remaining tasks need revision (dynamic planning vs static execution).
 *
 * Architecture:
 * - checkTaskReplan: Decision gate using LLM as judge
 * - replanWorkflow: Incremental plan generation (only unexecuted tasks)
 * - mergeWorkflow: Surgical replacement preserving executed history
 *
 * WHY replanning?
 * 1. Web pages may differ from expectations (dynamic content, errors)
 * 2. Partial results reveal better optimization paths
 * 3. Dependency chains break when intermediate tasks fail
 * 4. User goals may require context-aware strategy shifts
 *
 * Design tradeoff: Replanning costs extra LLM call but prevents brittle
 * execution (continuing with obsolete plan wastes more tokens/time).
 */

import { Planner } from "./plan";
import { AgentChain } from "./chain";
import { sub } from "../common/utils";
import { RetryLanguageModel } from "../llm";
import { AgentContext } from "./agent-context";
import {
  Workflow,
  LLMRequest,
  WorkflowAgent,
  LanguageModelV2Prompt,
} from "../types";
import Log from "../common/log";

/**
 * Evaluates if unexecuted tasks need replanning based on partial results
 *
 * Strategy: Uses LLM as judge with tool call forcing binary decision.
 * Provides execution status summary (completed + in-progress) as context.
 *
 * Returns: true if existing plan inadequate, false if can proceed as-is
 */
export async function checkTaskReplan(
  agentContext: AgentContext
): Promise<boolean> {
  try {
    const context = agentContext.context;
    const chain = agentContext.context.chain;
    if (!chain.planRequest || !chain.planResult) {
      return false;
    }
    const rlm = new RetryLanguageModel(
      context.config.llms,
      context.config.planLlms
    );
    rlm.setContext(agentContext);
    const agentExecution = getAgentExecutionPrompt(agentContext);
    const prompt = `# Task Execution Status
${agentExecution}

# Task Replan Check
Please review the plan for unexecuted tasks based on the results of partially executed tasks, and check whether it still meets the requirements of the current user task.
If after executing some subtasks it is found that the previous plan has issues or is no longer the optimal solution, then the unexecuted task nodes need to be replanned; otherwise, replanning is not necessary.`;
    const messages: LanguageModelV2Prompt = [
      ...chain.planRequest.messages,
      {
        role: "assistant",
        content: [{ type: "text", text: chain.planResult as string }],
      },
      {
        role: "user",
        content: [{ type: "text", text: prompt }],
      },
    ];
    const functionName = "check_task_status";
    const request: LLMRequest = {
      maxOutputTokens: 512,
      temperature: 0.7,
      messages: messages,
      abortSignal: context.controller.signal,
      tools: [
        {
          type: "function",
          name: functionName,
          description:
            "Check the task status, and based on the results of partially executed tasks, examine whether the unexecuted task nodes need to be replanned.",
          inputSchema: {
            type: "object",
            properties: {
              thinking: {
                type: "string",
                description:
                  "Output the thinking process, analyzing whether the unexecuted task nodes need to be replanned.(100 words or less)",
              },
              replan: {
                type: "boolean",
                description:
                  "Determine whether replanning of unexecuted task nodes is needed. If the existing unexecuted task nodes can meet the task requirements, then replanning is not necessary; if they cannot meet the requirements, then replanning is needed.",
              },
            },
            required: ["thinking", "replan"],
          },
        },
      ],
      toolChoice: {
        type: "tool",
        toolName: functionName,
      },
    };
    const result = await rlm.call(request);
    let input = result.content.find((c) => c.type === "tool-call")?.input;
    if (input && typeof input === "string") {
      input = JSON.parse(input);
    }
    return (input as any).replan;
  } catch (e) {
    Log.error("checkTaskReplan error: ", e);
    return false;
  }
}

/**
 * Regenerates workflow for unexecuted tasks based on partial results
 *
 * Incremental planning: Only creates new agents from current position onward
 * (preserves executed history to maintain result continuity). Uses original
 * plan conversation context to maintain coherence.
 *
 * Side effect: Sets workflow.modified = true to signal downstream systems
 */
export async function replanWorkflow(agentContext: AgentContext) {
  let currentIndex = 0;
  const currentAgentId = agentContext.agentChain.agent.id;
  const agents = agentContext.context.workflow?.agents as WorkflowAgent[];
  for (let i = 0; i < agents.length; i++) {
    currentIndex = i;
    if (agents[i].id === currentAgentId) {
      break;
    }
  }
  const planner = new Planner(agentContext.context, {
    onMessage: async (message, _agentContext) => {
      if (message.type === "workflow") {
        mergeWorkflow(
          agentContext.context.workflow as Workflow,
          JSON.parse(JSON.stringify(message.workflow)),
          currentIndex
        );
        agentContext.context.config.callback?.onMessage({
          ...message,
          workflow: agentContext.context.workflow as Workflow,
        });
      }
    },
  });
  const agentExecution = getAgentExecutionPrompt(agentContext);
  const prompt = `# Task Execution Status
${agentExecution}

# Replan
The previous plan is no longer suitable for the current task.
Please reformulate the plan for unexecuted tasks based on the results of partially executed tasks to meet the requirements of the current task.
Please do not output nodes that have already been executed. The new plan is an incremental update to the unexecuted plan nodes, and can use the results and variables from previously executed tasks.`;
  let newWorkflow: Workflow;
  const chain = agentContext.context.chain;
  if (chain.planRequest && chain.planResult) {
    const messages: LanguageModelV2Prompt = [
      ...chain.planRequest.messages,
      {
        role: "assistant",
        content: [{ type: "text", text: chain.planResult }],
      },
      {
        role: "user",
        content: [{ type: "text", text: prompt }],
      },
    ];
    newWorkflow = await planner.doPlan("", messages, true);
  } else {
    newWorkflow = await planner.plan({ type: "text", text: prompt }, true);
  }
  const workflow = agentContext.context.workflow as Workflow;
  mergeWorkflow(workflow, newWorkflow, currentIndex);
  workflow.modified = true;
}

/**
 * Surgically replaces unexecuted tasks while preserving history
 *
 * Operations:
 * 1. Keeps agents[0..currentIndex] intact (executed tasks)
 * 2. Removes old unexecuted agents[currentIndex+1..]
 * 3. Appends new agents with renumbered IDs and dependency chains
 * 4. Stitches first new agent to depend on last executed agent
 *
 * WHY ID renumbering? Maintains sequential task-01, task-02 convention
 * for debuggability (IDs encode execution order).
 */
function mergeWorkflow(
  workflow: Workflow,
  newWorkflow: Workflow,
  currentIndex: number
) {
  workflow.name = newWorkflow.name;
  workflow.thought = newWorkflow.thought;
  const old_number = currentIndex + 1;
  workflow.agents.splice(old_number, workflow.agents.length - old_number);
  for (let i = 0; i < newWorkflow.agents.length; i++) {
    const agent = newWorkflow.agents[i];
    const idx = i + currentIndex + 1;
    agent.id = workflow.taskId + "-" + (idx < 10 ? "0" + idx : idx);
    const dependsOn = agent.dependsOn || [];
    if (i == 0) {
      agent.dependsOn = [workflow.agents[workflow.agents.length - 1].id];
    } else {
      for (let j = 0; j < dependsOn.length; j++) {
        const dependId = dependsOn[j];
        const arr = dependId.split("-");
        const dependIndex = parseInt(arr[arr.length - 1]) + currentIndex + 1;
        arr[arr.length - 1] =
          dependIndex < 10 ? "0" + dependIndex : dependIndex + "";
        dependsOn[j] = arr.join("-");
      }
    }
    workflow.agents.push(agent);
  }
  workflow.xml = newWorkflow.xml;
}

/**
 * Builds execution status summary for replanning context
 *
 * Format per agent:
 * - Completed: Shows final result
 * - In-progress: Shows message history (user/assistant/tool sequence)
 * - Not started: Indicates pending state
 *
 * WHY message history? LLM needs to see partial execution flow to
 * understand why plan became inadequate (e.g., error occurred, data missing).
 */
function getAgentExecutionPrompt(currentAgentContext: AgentContext) {
  let prompt = "";
  const agentMap: Record<string, AgentChain> = {};
  const chain = currentAgentContext.context.chain;
  for (let i = 0; i < chain.agents.length; i++) {
    const agentChain = chain.agents[i];
    agentMap[agentChain.agent.id] = agentChain;
  }
  let before = true;
  const workflow = currentAgentContext.context.workflow as Workflow;
  const currentAgentId = currentAgentContext.agentChain.agent.id;
  for (let i = 0; i < workflow.agents.length; i++) {
    const agent = workflow.agents[i];
    const agentChain = agentMap[agent.id];
    if (agent.id === currentAgentId) {
      before = false;
    }
    if (agentChain && agentChain.agentResult && before) {
      prompt += `## ${agent.name} Agent: ${agent.task}\nExecuted, execution result:\n${agentChain.agentResult}\n\n`;
    } else if (agentChain && agentChain.agentRequest) {
      const messages = getExecutionMessages(
        agentChain.agentRequest.messages as LanguageModelV2Prompt
      );
      prompt += `## ${agent.name} Agent: ${
        agent.task
      }\nCurrently executing, execution progress:\n${messages.join(
        "\n\n"
      )}\n\n`;
    } else {
      prompt += `## ${agent.name} Agent: ${agent.task}\nNot started execution.\n\n`;
    }
  }
  return prompt.trim();
}

/**
 * Formats message history into human-readable execution log
 *
 * Truncation strategy: Early messages (first 3) get 2000 chars, later ones
 * get 500 chars (recent context more relevant for replanning decisions).
 * Tool calls show params/results for transparency.
 */
function getExecutionMessages(messages: LanguageModelV2Prompt): string[] {
  const messagesContents: string[] = [];
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (message.role === "user") {
      const contents = message.content
        .filter((s) => s.type === "text" && s.text)
        .map((s) => (s as any).text as string);
      for (let j = 0; j < contents.length; j++) {
        messagesContents.push(
          "User: " + sub(contents[j], i < 3 ? 2000 : 500, true)
        );
      }
    } else if (message.role === "assistant") {
      for (let j = 0; j < message.content.length; j++) {
        const content = message.content[j];
        if (content.type === "text" && content.text) {
          messagesContents.push("Assistant: " + sub(content.text, 500, true));
        } else if (content.type === "tool-call") {
          messagesContents.push(
            `Call \`${content.toolName}\` Tool Params: ` +
              JSON.stringify(content.input || {})
          );
        }
      }
    } else if (message.role === "tool") {
      for (let j = 0; j < message.content.length; j++) {
        const content = message.content[j];
        const output = content.output;
        const result = JSON.stringify(output.value);
        messagesContents.push(
          `Call \`${content.toolName}\` Tool Result: ${sub(result, 500, true)}`
        );
      }
    }
  }
  return messagesContents;
}
