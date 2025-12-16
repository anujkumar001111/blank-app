/**
 * @fileoverview Workflow task node status tracking tool.
 * 
 * Enables agents to update workflow XML with task completion progress and
 * reflective thinking. Core to the ReAct pattern: agent thinks about what it
 * just did, marks completed steps, and plans next actions.
 * 
 * @module tools/task-node-status
 */

import { JSONSchema7 } from "json-schema";
import { buildAgentRootXml } from "../common/xml";
import { AgentContext } from "../agent/agent-context";
import { Tool, ToolResult } from "../types/tools.types";

export const TOOL_NAME = "task_node_status";

/**
 * Updates workflow node statuses and captures agent reasoning.
 * 
 * WHY: Workflow XML serves as both plan and progress tracker. After each
 * action, agent must:
 * 1. Reflect on what was accomplished (thought parameter)
 * 2. Mark completed nodes (doneIds)
 * 3. Identify remaining work (todoIds)
 * 4. Return updated XML to guide next iteration
 * 
 * This prevents agents from repeating completed tasks or losing track of
 * multi-step workflows. The "thought" parameter is critical for debugging
 * and understanding agent decision-making.
 * 
 * @example
 * // Agent completes login step, updates XML:
 * task_node_status({
 *   thought: "Login successful, now need to navigate to settings",
 *   doneIds: [1, 2],  // login nodes
 *   todoIds: [3, 4]   // settings nodes
 * })
 */
export default class TaskNodeStatusTool implements Tool {
  readonly name: string = TOOL_NAME;
  readonly description: string;
  readonly parameters: JSONSchema7;

  constructor() {
    this.description = `After completing each step of the task, you need to call this tool to update the status of the task node, and think about the tasks to be processed and the next action plan.`;
    this.parameters = {
      type: "object",
      properties: {
        thought: {
          type: "string",
          description: "Current thinking content, which can be analysis of the problem, assumptions, insights, reflections, or a summary of the previous, suggest the next action step to be taken, which should be specific, executable, and verifiable."
        },
        doneIds: {
          type: "array",
          description: "List of completed node IDs.",
          items: {
            type: "number",
          },
        },
        todoIds: {
          type: "array",
          description: "List of pending node IDs.",
          items: {
            type: "number",
          },
        },
      },
      required: ["thought", "doneIds", "todoIds"],
    };
  }

  /**
   * Updates workflow XML with task completion status.
   * 
   * CRITICAL: Prevents agents from endlessly repeating tasks by maintaining
   * explicit done/todo state. The updated XML is fed back into agent's next
   * prompt, so incomplete tasks remain visible while completed ones are marked.
   * 
   * @param args.thought - Agent's reasoning about progress and next steps
   * @param args.doneIds - XML node IDs that have been completed
   * @param args.todoIds - XML node IDs still pending execution
   * 
   * @returns Updated workflow XML with status attributes on each node.
   * @throws If same ID appears in both doneIds and todoIds (invalid state).
   */
  async execute(
    args: Record<string, unknown>,
    agentContext: AgentContext
  ): Promise<ToolResult> {
    let doneIds = args.doneIds as number[];
    let todoIds = args.todoIds as number[];
    let agentNode = agentContext.agentChain.agent;
    let taskPrompt = agentContext.context.chain.taskPrompt;
    // Rebuild XML tree with updated status attributes
    let agentXml = buildAgentRootXml(agentNode.xml, taskPrompt, (nodeId, node) => {
      let done = doneIds.indexOf(nodeId) > -1;
      let todo = todoIds.indexOf(nodeId) > -1;
      if (done && todo) {
        throw new Error(
          "The ID cannot appear in both doneIds and todoIds simultaneously, nodeId: " +
            nodeId
        );
      } else if (!done && !todo) {
        // Node not mentioned - leave status unchanged
      }
      node.setAttribute("status", done ? "done" : "todo");
    });
    return {
      content: [
        {
          type: "text",
          text: agentXml,
        },
      ],
    };
  }
}

export { TaskNodeStatusTool };