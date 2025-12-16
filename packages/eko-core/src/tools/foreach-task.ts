/**
 * @fileoverview ForEach loop iteration tracking tool.
 * 
 * Enables sequential execution of repetitive workflow tasks by tracking loop
 * progress and providing variable context. Critical for processing lists or
 * performing batch operations without losing state between iterations.
 * 
 * @module tools/foreach-task
 */

import { JSONSchema7 } from "json-schema";
import { extractAgentXmlNode } from "../common/xml";
import { AgentContext } from "../agent/agent-context";
import { Tool, ToolResult } from "../types/tools.types";

export const TOOL_NAME = "foreach_task";

/**
 * Tracks and manages forEach loop iteration state.
 * 
 * WHY: Workflow XML supports forEach nodes for repeated tasks (e.g., "process
 * each item in cart"). This tool ensures sequential execution by:
 * 1. Recording each iteration's progress explicitly
 * 2. Periodically surfacing variable values to prevent context drift
 * 3. Enabling the agent to track position within large loops
 * 
 * USAGE: Called once per loop iteration with progress description. Every 5th
 * iteration returns the current variable value to refresh agent memory.
 * 
 * @example
 * // Workflow XML: <forEach items="userList">...</forEach>
 * // Agent calls: foreach_task(nodeId: 42, progress: "3/10 complete")
 */
export default class ForeachTaskTool implements Tool {
  readonly name: string = TOOL_NAME;
  readonly description: string;
  readonly parameters: JSONSchema7;

  constructor() {
    this.description = `When executing the \`forEach\` node, please use the current tool for counting to ensure tasks are executed sequentially, the tool needs to be called with each loop iteration.`;
    this.parameters = {
      type: "object",
      properties: {
        nodeId: {
          type: "number",
          description: "forEach node ID.",
        },
        progress: {
          type: "string",
          description: "Current execution progress.",
        },
        next_step: {
          type: "string",
          description: "Next task description.",
        },
      },
      required: ["nodeId", "progress", "next_step"],
    };
  }

  /**
   * Records loop iteration progress and refreshes variable context.
   * 
   * @param args.nodeId - The XML forEach node ID being executed
   * @param args.progress - Human-readable progress (e.g., "Processing item 3")
   * @param args.next_step - Description of next iteration's action
   * 
   * @returns Every 5th iteration: variable name/value for context refresh.
   *          Other iterations: Simple "Recorded" acknowledgement.
   * 
   * @throws If nodeId doesn't exist or isn't a forEach node.
   */
  async execute(
    args: Record<string, unknown>,
    agentContext: AgentContext
  ): Promise<ToolResult> {
    let nodeId = args.nodeId as number;
    let agentXml = agentContext.agentChain.agent.xml;
    let node = extractAgentXmlNode(agentXml, nodeId);
    if (node == null) {
      throw new Error("Node ID does not exist: " + nodeId);
    }
    if (node.tagName !== "forEach") {
      throw new Error("Node ID is not a forEach node: " + nodeId);
    }
    let items = node.getAttribute("items");
    let varValue = null;
    let resultText = "Recorded";
    // Refresh variable context every 5 iterations to combat LLM context drift
    if (items && items != "list") {
      varValue = agentContext.context.variables.get(items.trim());
      if (varValue) {
        let key = "foreach_" + nodeId;
        let loop_count = agentContext.variables.get(key) || 0;
        if (loop_count % 5 == 0) {
          resultText = `Variable information associated with the current loop task.\nvariable_name: ${items.trim()}\nvariable_value: ${varValue}`;
        }
        agentContext.variables.set(key, ++loop_count);
      }
    }
    return {
      content: [
        {
          type: "text",
          text: resultText,
        },
      ],
    };
  }
}

export { ForeachTaskTool };
