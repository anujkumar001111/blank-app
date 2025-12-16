/**
 * @fileoverview Eko Node.js Package - Server-side Agent Capabilities
 *
 * Provides Node.js specific implementations for file system operations,
 * shell command execution, system monitoring, and browser automation.
 * Enables agents to interact with the local operating system and external services.
 *
 * ## Key Features
 *
 * - **File System Operations**: Read, write, delete, and search files
 * - **Shell Command Execution**: Run system commands with safety controls
 * - **Browser Automation**: Control headless browsers via Chrome DevTools Protocol
 * - **System Monitoring**: Access to system information and resources
 * - **MCP Integration**: Standard I/O based MCP client for external tools
 * - **Persistent Memory**: File-based storage for episodic memory
 *
 * ## Security Considerations
 *
 * - File operations include permission checks and path validation
 * - Shell commands run in restricted environments by default
 * - Browser automation respects same-origin policies
 * - Memory storage encrypts sensitive data when configured
 *
 * @example
 * ```typescript
 * import {
 *   BrowserAgent,
 *   SystemAgent,
 *   FileReadTool,
 *   ShellExecTool,
 *   FileStorageProvider
 * } from '@eko-ai/eko-nodejs';
 *
 * // Create agents with Node.js capabilities
 * const agents = [
 *   new BrowserAgent(),
 *   new SystemAgent({ allowShellCommands: true })
 * ];
 *
 * // Use file-based memory for persistence
 * const memory = new EpisodicMemory({
 *   storage: new FileStorageProvider('./agent-memory')
 * });
 * ```
 */

import { getCdpWsEndpoint } from "./utils";

// Re-export core framework capabilities
export * from "@eko-ai/eko";

export { getCdpWsEndpoint };
// Browser Automation
export { BrowserAgent } from "./browser"; // Headless browser control via CDP

// MCP Integration
export { SimpleStdioMcpClient } from "./mcp/stdio"; // Standard I/O MCP client

// System Interaction
export { SystemAgent, type SystemAgentOptions } from "./system"; // OS-level operations

// File System Tools
export {
  FileReadTool, // Read file contents with encoding support
  FileWriteTool, // Write/create files with safety checks
  FileDeleteTool, // Delete files with confirmation
  FileListTool, // Directory listing and navigation
  FileFindTool, // File search with pattern matching
  resolvePath, // Path resolution utilities
  formatFileSize, // Human-readable file size formatting
} from "./tools";

// Shell Execution
export { ShellExecTool } from "./tools/shell-exec"; // Safe shell command execution

// Type Definitions
export type { ShellResult, ShellExecOptions } from "./types/shell.types"; // Shell operation types
export type { FileInfo, FileSecurityOptions } from "./types/file.types"; // File operation types

// Persistent Storage
export { FileStorageProvider } from "./memory"; // File-based episodic memory storage
