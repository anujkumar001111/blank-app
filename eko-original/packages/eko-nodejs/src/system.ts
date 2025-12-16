/**
 * SystemAgent - Agent for shell and file system operations
 *
 * Bundles shell_exec and file operation tools for system automation.
 * Provides secure, configurable access to command execution and file operations.
 */

import { Agent, AgentContext } from "@eko-ai/eko";
import { Tool, IMcpClient } from "@eko-ai/eko/types";
import { FileSecurityOptions } from "./types/file.types";
import {
  FileReadTool,
  FileWriteTool,
  FileDeleteTool,
  FileListTool,
  FileFindTool,
} from "./tools";
import { ShellExecTool } from "./tools/shell-exec";

/**
 * Options for configuring SystemAgent behavior and security.
 */
export interface SystemAgentOptions {
  /**
   * Base working directory for file operations.
   * Defaults to process.cwd() if not specified.
   */
  workPath?: string;

  /**
   * Enable shell command safety checks.
   * When true, dangerous command patterns are blocked.
   * Default: true
   */
  enableShellSafety?: boolean;

  /**
   * If true, restricts all file operations to within workPath.
   * Prevents path traversal attacks (../) and absolute paths outside workPath.
   * Default: true (secure by default)
   */
  restrictToWorkPath?: boolean;

  /**
   * Additional allowed directories for file operations.
   * Only effective when restrictToWorkPath is true.
   * Paths should be absolute.
   */
  allowedPaths?: string[];

  /**
   * Optional MCP client for external tool integration.
   */
  mcpClient?: IMcpClient;

  /**
   * Optional custom system prompt extension.
   */
  customPrompt?: string;
}

/**
 * SystemAgent for Node.js environments.
 * Provides shell execution and file system operations.
 *
 * @example
 * ```ts
 * import { SystemAgent } from '@eko-ai/eko-nodejs';
 *
 * const agent = new SystemAgent({
 *   workPath: '/path/to/workdir',
 *   enableShellSafety: true,
 *   restrictToWorkPath: true,
 * });
 *
 * // Agent now has 6 tools:
 * // - shell_exec: Execute shell commands
 * // - file_read: Read file contents
 * // - file_write: Write content to files
 * // - file_delete: Delete files or directories
 * // - file_list: List directory contents
 * // - file_find: Find files by glob pattern
 * ```
 */
export default class SystemAgent extends Agent {
  private workPath: string;
  private customPrompt?: string;
  private securityOptions: FileSecurityOptions;

  /**
   * Create a new SystemAgent for Node.js.
   *
   * @param options - Configuration options for the agent
   */
  constructor(options: SystemAgentOptions = {}) {
    const workPath = options.workPath || process.cwd();
    const enableShellSafety = options.enableShellSafety ?? true;
    const restrictToWorkPath = options.restrictToWorkPath ?? true;
    const allowedPaths = options.allowedPaths || [];

    const securityOptions: FileSecurityOptions = {
      restrictToWorkPath,
      allowedPaths,
    };

    // Build tools with configured options
    const tools = SystemAgent.buildTools(
      workPath,
      securityOptions,
      enableShellSafety
    );

    super({
      name: "System",
      description: `A system operation agent for executing shell commands and managing files.
* Can execute shell commands with output capture
* Can list, read, write, and delete files
* Supports glob patterns for file discovery
* Creates directories as needed when writing files
* Security controls for both shell and file operations`,
      tools,
      llms: ["default"],
      mcpClient: options.mcpClient,
      planDescription:
        "System operation agent for shell execution and file management.",
    });

    this.workPath = workPath;
    this.customPrompt = options.customPrompt;
    this.securityOptions = securityOptions;
  }

  /**
   * Build the system operation tools.
   *
   * @param workPath - Base working directory
   * @param securityOptions - File security options
   * @param enableShellSafety - Enable shell safety checks
   * @returns Array of configured tools
   */
  private static buildTools(
    workPath: string,
    securityOptions: FileSecurityOptions,
    enableShellSafety: boolean
  ): Tool[] {
    return [
      // Shell execution tool
      new ShellExecTool({ enableShellSafety }),

      // File operation tools
      new FileReadTool(workPath, securityOptions),
      new FileWriteTool(workPath, securityOptions),
      new FileDeleteTool(workPath, securityOptions),
      new FileListTool(workPath, securityOptions),
      new FileFindTool(workPath, securityOptions),
    ];
  }

  /**
   * Override extSysPrompt to support custom prompt injection.
   */
  protected async extSysPrompt(
    agentContext: AgentContext,
    tools: Tool[]
  ): Promise<string> {
    return this.customPrompt || "";
  }

  /**
   * Get the current working path.
   */
  get WorkPath(): string {
    return this.workPath;
  }

  /**
   * Set the working path.
   * Note: This does not update existing tool instances.
   * Create a new SystemAgent for a different workPath.
   */
  setWorkPath(workPath: string): void {
    this.workPath = workPath;
  }

  /**
   * Get current security options.
   */
  get SecurityOptions(): FileSecurityOptions {
    return { ...this.securityOptions };
  }
}

export { SystemAgent };
