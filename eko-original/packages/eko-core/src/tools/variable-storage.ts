import { JSONSchema7 } from "json-schema";
import { AgentContext } from "../agent/agent-context";
import { Tool, ToolResult } from "../types/tools.types";

/**
 * Tool for managing task-scoped variables during workflow execution
 *
 * Provides persistent storage and retrieval of data between agent executions
 * within the same task context. Essential for maintaining state across complex
 * multi-step workflows and enabling data flow between agents.
 *
 * ## Use Cases
 *
 * - **Data persistence**: Store results from one agent for use by another
 * - **State management**: Track workflow progress and intermediate values
 * - **Configuration**: Store task-specific settings and parameters
 * - **Caching**: Avoid redundant computations by storing expensive results
 *
 * ## Variable Lifecycle
 *
 * Variables are scoped to individual tasks and automatically cleaned up when
 * tasks complete or are aborted. They persist across agent boundaries within
 * the same workflow execution.
 *
 * @example
 * ```typescript
 * // Agent 1: Collect data
 * // Tool call: {"operation": "write_variable", "name": "user_data", "value": "{...}"}
 *
 * // Agent 2: Process data
 * // Tool call: {"operation": "read_variable", "name": "user_data"}
 * // Returns: {"user_data": "{...}"}
 *
 * // Agent 3: List all variables
 * // Tool call: {"operation": "list_all_variable"}
 * // Returns: ["user_data", "processed_results", "config"]
 * ```
 */

export const TOOL_NAME = "variable_storage";

export default class VariableStorageTool implements Tool {
  readonly name: string = TOOL_NAME;
  readonly description: string;
  readonly parameters: JSONSchema7;

  constructor() {
    this.description = `Used for storing, reading, and retrieving variable data, and maintaining input/output variables in task nodes. When the same variable is stored repeatedly, it will overwrite the previous value.`;
    this.parameters = {
      type: "object",
      properties: {
        operation: {
          type: "string",
          description: "The type of variable storage operation to perform",
          enum: ["read_variable", "write_variable", "list_all_variable"],
        },
        name: {
          type: "string",
          description: "Variable name(s) to operate on. For reading, supports comma-separated list of multiple variables.",
        },
        value: {
          type: "string",
          description: "The value to store when writing variables. Can be any JSON-serializable data.",
        },
      },
      required: ["operation"],
    };
  }

  /**
   * Executes variable storage operations
   *
   * Handles reading, writing, and listing variables within the task context.
   * All operations are synchronous and operate on the shared task variable store.
   *
   * @param args - Operation parameters specifying the action and data
   * @param agentContext - Execution context providing access to task variables
   * @returns Tool result containing operation outcome or data
   *
   * @throws Never - All errors are handled gracefully and returned as result strings
   */
  async execute(
    args: Record<string, unknown>,
    agentContext: AgentContext
  ): Promise<ToolResult> {
    let operation = args.operation as string;
    let resultText = "";

    switch (operation) {
      case "read_variable": {
        // Validate required parameter
        if (!args.name) {
          resultText = "Error: name is required";
        } else {
          // Support reading multiple variables separated by commas
          let result = {} as any;
          let name = args.name as string;
          let keys = name.split(",");

          // Collect values for each requested variable
          for (let i = 0; i < keys.length; i++) {
            let key = keys[i].trim();
            let value = agentContext.context.variables.get(key);
            result[key] = value; // Will be undefined if key doesn't exist
          }

          resultText = JSON.stringify(result);
        }
        break;
      }
      case "write_variable": {
        // Validate required parameters
        if (!args.name) {
          resultText = "Error: name is required";
          break;
        }
        if (args.value == undefined) {
          resultText = "Error: value is required";
          break;
        }

        // Store the variable (overwrites existing values)
        let key = args.name as string;
        agentContext.context.variables.set(key.trim(), args.value);
        resultText = "success";
        break;
      }
      case "list_all_variable": {
        // Return all variable names currently in scope
        resultText = JSON.stringify([...agentContext.context.variables.keys()]);
        break;
      }
    }
    return {
      content: [
        {
          type: "text",
          text: resultText || "",
        },
      ],
    };
  }
}

export { VariableStorageTool };
