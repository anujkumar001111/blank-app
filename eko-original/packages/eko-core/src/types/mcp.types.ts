/**
 * @fileoverview Model Context Protocol (MCP) Integration Types
 *
 * Defines interfaces and types for integrating with MCP servers, enabling
 * dynamic tool discovery and execution. MCP allows agents to access external
 * tool ecosystems through standardized protocols.
 *
 * ## MCP Architecture
 *
 * ```
 * Agent → MCP Client → MCP Server → External Tools/APIs
 * ```
 *
 * ## Transport Protocols
 *
 * - **SSE (Server-Sent Events)**: Real-time streaming for tool discovery
 * - **HTTP**: RESTful communication for tool execution
 * - **WebSocket**: Bidirectional communication (future support)
 *
 * ## Use Cases
 *
 * - **Dynamic Tool Loading**: Discover tools at runtime based on context
 * - **External Integrations**: Access third-party APIs and services
 * - **Platform Extensions**: Browser extensions, desktop applications
 * - **Service Orchestration**: Coordinate multiple specialized services
 */

import { JSONSchema7 } from "json-schema";
import { ToolResult } from "../types/tools.types";

/**
 * Parameters for MCP tool discovery requests
 *
 * Provides context information to MCP servers for intelligent tool selection
 * and filtering based on the current execution environment and task requirements.
 */
export type McpListToolParam = {
  /** Target platform/environment for tool compatibility */
  environment: "browser" | "windows" | "mac" | "linux";
  /** Name of the requesting agent for personalization */
  agent_name: string;
  /** Current task description for context-aware tool selection */
  prompt: string;
  /** Unique task identifier for session tracking */
  taskId?: string;
  /** Specific workflow node identifier */
  nodeId?: string;
  /** Current browser URL for web-specific tools */
  browser_url?: string | null;
  /** Additional context parameters for advanced filtering */
  params?: Record<string, unknown> | undefined;
};

/**
 * Parameters for MCP tool execution requests
 *
 * Specifies which tool to execute with what arguments, including execution
 * context for monitoring and debugging purposes.
 */
export type McpCallToolParam = {
  /** Name of the tool to execute */
  name: string;
  /** Arguments to pass to the tool (must match tool's input schema) */
  arguments?: Record<string, unknown> | undefined;
  /** Extended context information for execution tracking */
  extInfo?: {
    /** Task identifier for grouping related executions */
    taskId: string;
    /** Workflow node identifier for execution tracing */
    nodeId: string;
    /** Execution environment for compatibility checks */
    environment: "browser" | "windows" | "mac" | "linux";
    /** Agent name for execution attribution */
    agent_name: string;
    /** Current browser URL for web context */
    browser_url?: string | null;
  };
};

/**
 * Result format for MCP tool discovery responses
 *
 * Contains metadata about available tools including their schemas for
 * validation and execution planning.
 */
export type McpListToolResult = Array<{
  /** Unique tool identifier */
  name: string;
  /** Human-readable description of tool capabilities */
  description?: string;
  /** JSON Schema defining tool input parameters */
  inputSchema: JSONSchema7;
}>;

/**
 * MCP Client Interface for Tool Discovery and Execution
 *
 * Defines the contract for MCP protocol implementations, enabling agents to
 * dynamically discover and execute external tools through standardized interfaces.
 *
 * ## Connection Lifecycle
 *
 * 1. **Connect**: Establish connection to MCP server
 * 2. **List Tools**: Discover available tools with schemas
 * 3. **Call Tools**: Execute tools with validated parameters
 * 4. **Close**: Clean up connection resources
 *
 * ## Error Handling
 *
 * - Connection failures should throw descriptive errors
 * - Tool execution errors are returned in ToolResult format
 * - Network timeouts and cancellations supported via AbortSignal
 */
export interface IMcpClient {
  /**
   * Establish connection to MCP server
   *
   * @param signal - Optional abort signal for connection timeout
   * @throws Error if connection fails or is rejected by server
   */
  connect(signal?: AbortSignal): Promise<void>;

  /**
   * Discover available tools from MCP server
   *
   * @param param - Context parameters for tool discovery and filtering
   * @param signal - Optional abort signal for request cancellation
   * @returns Array of available tools with metadata and schemas
   */
  listTools(param: McpListToolParam, signal?: AbortSignal): Promise<McpListToolResult>;

  /**
   * Execute a tool through the MCP server
   *
   * @param param - Tool execution parameters and arguments
   * @param signal - Optional abort signal for execution cancellation
   * @returns Tool execution result with content and status
   */
  callTool(param: McpCallToolParam, signal?: AbortSignal): Promise<ToolResult>;

  /**
   * Check if client is currently connected to MCP server
   *
   * @returns True if connection is active and ready for requests
   */
  isConnected(): boolean;

  /**
   * Close connection and clean up resources
   *
   * Should gracefully terminate the connection and free any allocated resources.
   * Safe to call multiple times or on already-closed connections.
   */
  close(): Promise<void>;
}
