/**
 * Tool Wrapper for MCP Integration
 *
 * Adapts external MCP tools to the Eko agent framework by wrapping tool schemas
 * and execution logic. Provides a standardized interface for tool discovery and
 * execution across different MCP servers and protocols.
 *
 * ## Architecture
 *
 * ```
 * MCP Server → Tool Schema → ToolWrapper → Agent Framework
 *                    ↓
 *              ToolExecuter → Actual Execution
 * ```
 *
 * ## Responsibilities
 *
 * - **Schema Conversion**: Transform MCP tool schemas to AI SDK format
 * - **Execution Delegation**: Route tool calls to appropriate MCP executors
 * - **Context Provision**: Supply execution context and metadata
 * - **Result Handling**: Process and return standardized tool results
 *
 * @example
 * ```typescript
 * // Create wrapper for an MCP-discovered tool
 * const toolWrapper = new ToolWrapper(toolSchema, {
 *   execute: async (args, context) => {
 *     // Execute via MCP server
 *     return await mcpClient.callTool({
 *       name: toolSchema.name,
 *       arguments: args
 *     });
 *   }
 * });
 *
 * // Use in agent framework
 * const result = await toolWrapper.callTool(args, agentContext, toolCall);
 * ```
 */

import { convertToolSchema } from "../common/utils";
import { AgentContext } from "../agent/agent-context";
import { ToolResult, ToolExecuter, ToolSchema } from "../types/tools.types";
import { LanguageModelV2FunctionTool, LanguageModelV2ToolCallPart } from "@ai-sdk/provider";

export class ToolWrapper {
  private tool: LanguageModelV2FunctionTool;
  private execute: ToolExecuter;

  /**
   * Creates a new tool wrapper with schema and executor
   *
   * @param toolSchema - Tool definition including name, description, and parameters
   * @param execute - Execution delegate for handling tool calls
   */
  constructor(toolSchema: ToolSchema, execute: ToolExecuter) {
    this.tool = convertToolSchema(toolSchema);
    this.execute = execute;
  }

  /** Tool name for identification and LLM tool calling */
  get name(): string {
    return this.tool.name;
  }

  /**
   * Gets the AI SDK-compatible tool definition
   *
   * @returns Tool schema in format expected by language model providers
   */
  getTool(): LanguageModelV2FunctionTool {
    return this.tool;
  }

  /**
   * Executes the wrapped tool with provided arguments
   *
   * Routes the tool call through the configured executor, providing full
   * execution context including agent state and call metadata.
   *
   * @param args - Tool arguments validated against schema
   * @param agentContext - Execution context with task state and variables
   * @param toolCall - Original LLM tool call request for tracing
   * @returns Tool execution result with content and status
   */
  async callTool(
    args: Record<string, unknown>,
    agentContext: AgentContext,
    toolCall: LanguageModelV2ToolCallPart
  ): Promise<ToolResult> {
    return await this.execute.execute(args, agentContext, toolCall);
  }
}
