import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";
import { Agent, AgentContext } from "@eko-ai/eko";
import { Tool, ToolResult, IMcpClient } from "@eko-ai/eko/types";
import type { WebContentsView, App } from "electron";

/**
 * File information returned by file operations.
 */
export interface FileInfo {
  path: string;
  name?: string;
  isDirectory?: boolean;
  size?: string;
  modified?: string;
}

/**
 * File write result with preview information.
 */
export interface FileWriteResult {
  filePath: string;
  fileName: string;
  previewUrl?: string;
  size: number;
}

/**
 * Function type for generating preview URLs from file paths.
 * Return undefined to disable preview URL generation.
 */
export type PreviewUrlGenerator = (
  filePath: string,
  fileName: string,
  isPackaged: boolean
) => string | undefined;

/**
 * Security options for FileAgent file operations.
 */
export interface FileSecurityOptions {
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
}

/**
 * FileAgent for Electron environments.
 * Provides file system operations for desktop applications.
 *
 * Security note: This agent operates with the permissions of the Electron main process.
 * Ensure proper input validation and path sanitization in production use.
 *
 * @example
 * ```ts
 * import { FileAgent } from '@eko-ai/eko-electron';
 *
 * const agent = new FileAgent(detailView, app, '/path/to/workdir');
 *
 * // Optional: Configure preview URL generation
 * agent.setPreviewUrlGenerator((filePath, fileName, isPackaged) =>
 *   isPackaged ? `app://${fileName}` : `http://localhost:3000/${fileName}`
 * );
 * ```
 */
export default class FileAgent extends Agent {
  private detailView: WebContentsView;
  private workPath: string;
  private electronApp: App;
  private customPrompt?: string;
  private previewUrlGenerator?: PreviewUrlGenerator;
  private ipcChannel: string = "file-updated";
  private securityOptions: FileSecurityOptions = { restrictToWorkPath: true };

  /**
   * Create a new FileAgent for Electron.
   *
   * @param detailView - The Electron WebContentsView to send file events to
   * @param electronApp - The Electron app instance for environment detection
   * @param workPath - Base working directory for file operations (defaults to process.cwd())
   * @param mcpClient - Optional MCP client for external tool integration
   * @param customPrompt - Optional custom system prompt extension
   */
  constructor(
    detailView: WebContentsView,
    electronApp: App,
    workPath?: string,
    mcpClient?: IMcpClient,
    customPrompt?: string
  ) {
    // Pass empty tools initially, we'll set them after super()
    super({
      name: "File",
      description: `A file operation agent for managing files and directories.
* Can list, read, write, delete, and search files
* Supports glob patterns for file discovery
* Can perform string replacements in files
* Creates directories as needed when writing files`,
      tools: [],
      llms: ["default"],
      mcpClient,
      planDescription:
        "File operation agent for reading, writing, and managing files.",
    });
    this.detailView = detailView;
    this.electronApp = electronApp;
    this.workPath = workPath || process.cwd();
    this.customPrompt = customPrompt;

    // Build and add tools after instance is created
    const tools = this.buildTools();
    tools.forEach((tool) => this.addTool(tool));
  }

  /**
   * Configure preview URL generation for file write operations.
   * Call this to enable file preview notifications via IPC.
   *
   * @param generator - Function that generates preview URLs
   *
   * @example
   * ```ts
   * agent.setPreviewUrlGenerator((filePath, fileName, isPackaged) =>
   *   isPackaged ? `app://${fileName}` : `http://localhost:3000/${fileName}`
   * );
   * ```
   */
  public setPreviewUrlGenerator(generator: PreviewUrlGenerator): void {
    this.previewUrlGenerator = generator;
  }

  /**
   * Set the IPC channel name for file update notifications.
   * Default is 'file-updated'.
   *
   * @param channel - IPC channel name
   */
  public setIpcChannel(channel: string): void {
    this.ipcChannel = channel;
  }

  /**
   * Configure security options for file operations.
   * By default, restrictToWorkPath is true for security.
   *
   * @param options - Security configuration
   *
   * @example
   * ```ts
   * // Allow unrestricted file access (use with caution)
   * agent.setSecurityOptions({ restrictToWorkPath: false });
   *
   * // Restrict to workPath but allow additional directories
   * agent.setSecurityOptions({
   *   restrictToWorkPath: true,
   *   allowedPaths: ['/tmp', app.getPath('downloads')]
   * });
   * ```
   */
  public setSecurityOptions(options: FileSecurityOptions): void {
    this.securityOptions = { ...this.securityOptions, ...options };
  }

  /**
   * Build the file operation tools.
   */
  private buildTools(): Tool[] {
    const self = this;
    return [
      {
        name: "file_list",
        description:
          "List all files and directories in the specified directory path.",
        parameters: {
          type: "object",
          properties: {
            directoryPath: {
              type: "string",
              description: "The absolute or relative path to the directory",
            },
          },
          required: ["directoryPath"],
        },
        execute: async (
          args: Record<string, unknown>
        ): Promise<ToolResult> => {
          return await self.callInnerTool(() =>
            self.fileList(args.directoryPath as string)
          );
        },
      },
      {
        name: "file_read",
        description: "Read the contents of a file and return as a string.",
        parameters: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "The absolute or relative path to the file",
            },
          },
          required: ["filePath"],
        },
        execute: async (
          args: Record<string, unknown>
        ): Promise<ToolResult> => {
          return await self.callInnerTool(() =>
            self.fileRead(args.filePath as string)
          );
        },
      },
      {
        name: "file_write",
        description:
          "Write content to a file. Creates parent directories if they don't exist.",
        parameters: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "The absolute or relative path to the file",
            },
            content: {
              type: "string",
              description: "The content to write to the file",
            },
            append: {
              type: "boolean",
              description:
                "If true, append to the file instead of overwriting",
              default: false,
            },
          },
          required: ["filePath", "content"],
        },
        execute: async (
          args: Record<string, unknown>
        ): Promise<ToolResult> => {
          return await self.callInnerTool(() =>
            self.fileWrite(
              args.filePath as string,
              args.content as string,
              (args.append as boolean) || false
            )
          );
        },
      },
      {
        name: "file_delete",
        description:
          "Delete a file or directory. For directories, removes recursively.",
        parameters: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description:
                "The absolute or relative path to the file or directory",
            },
          },
          required: ["filePath"],
        },
        execute: async (
          args: Record<string, unknown>
        ): Promise<ToolResult> => {
          return await self.callInnerTool(() =>
            self.fileDelete(args.filePath as string)
          );
        },
      },
      {
        name: "file_str_replace",
        description:
          "Replace all occurrences of a string in a file with a new string.",
        parameters: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "The path to the file",
            },
            oldStr: {
              type: "string",
              description: "The string to search for (treated as regex)",
            },
            newStr: {
              type: "string",
              description: "The replacement string",
            },
          },
          required: ["filePath", "oldStr", "newStr"],
        },
        execute: async (
          args: Record<string, unknown>
        ): Promise<ToolResult> => {
          return await self.callInnerTool(() =>
            self.fileStrReplace(
              args.filePath as string,
              args.oldStr as string,
              args.newStr as string
            )
          );
        },
      },
      {
        name: "file_find_by_name",
        description:
          "Find files matching a glob pattern within a directory. Returns file information for all matches.",
        parameters: {
          type: "object",
          properties: {
            directoryPath: {
              type: "string",
              description: "The directory to search in",
            },
            globPattern: {
              type: "string",
              description:
                "The glob pattern to match (e.g., '**/*.ts', '*.json')",
            },
          },
          required: ["directoryPath", "globPattern"],
        },
        execute: async (
          args: Record<string, unknown>
        ): Promise<ToolResult> => {
          return await self.callInnerTool(() =>
            self.fileFindByName(
              args.directoryPath as string,
              args.globPattern as string
            )
          );
        },
      },
    ];
  }

  /**
   * Resolve and validate a path, applying security restrictions.
   * @throws Error if path violates security restrictions
   */
  private resolvePath(inputPath: string): string {
    let resolvedPath: string;

    if (path.isAbsolute(inputPath)) {
      resolvedPath = path.normalize(inputPath);
    } else {
      // Normalize to prevent ../ traversal
      resolvedPath = path.normalize(path.join(this.workPath, inputPath));
    }

    // Apply security restrictions if enabled
    if (this.securityOptions.restrictToWorkPath !== false) {
      const normalizedWorkPath = path.normalize(this.workPath);

      // Check if resolved path is within workPath
      const isWithinWorkPath = resolvedPath.startsWith(normalizedWorkPath + path.sep) ||
        resolvedPath === normalizedWorkPath;

      // Check if resolved path is within any allowed paths
      const allowedPaths = this.securityOptions.allowedPaths || [];
      const isWithinAllowedPath = allowedPaths.some((allowedPath) => {
        const normalizedAllowed = path.normalize(allowedPath);
        return resolvedPath.startsWith(normalizedAllowed + path.sep) ||
          resolvedPath === normalizedAllowed;
      });

      if (!isWithinWorkPath && !isWithinAllowedPath) {
        throw new Error(
          `Access denied: Path "${inputPath}" resolves outside allowed directories. ` +
          `Resolved to "${resolvedPath}" but must be within workPath "${normalizedWorkPath}"` +
          (allowedPaths.length > 0 ? ` or allowed paths: ${allowedPaths.join(", ")}` : "") +
          `. Use setSecurityOptions({ restrictToWorkPath: false }) to disable this protection.`
        );
      }
    }

    return resolvedPath;
  }

  /**
   * List files in a directory.
   */
  private async fileList(directoryPath: string): Promise<FileInfo[]> {
    const resolvedPath = this.resolvePath(directoryPath);
    const files = await fs.readdir(resolvedPath);
    const fileDetails = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(resolvedPath, file);
        const stats = await fs.stat(filePath);
        return {
          name: file,
          path: filePath,
          isDirectory: stats.isDirectory(),
          size: this.formatFileSize(stats.size),
          modified: stats.mtime.toLocaleString(),
        };
      })
    );
    return fileDetails;
  }

  /**
   * Read a file's contents.
   */
  private async fileRead(filePath: string): Promise<string> {
    const resolvedPath = this.resolvePath(filePath);
    return await fs.readFile(resolvedPath, "utf-8");
  }

  /**
   * Write content to a file.
   */
  private async fileWrite(
    filePath: string,
    content: string,
    append: boolean
  ): Promise<FileWriteResult> {
    const resolvedPath = this.resolvePath(filePath);
    const directory = path.dirname(resolvedPath);
    const fileName = path.basename(resolvedPath);

    // Create directory if it doesn't exist
    await fs.mkdir(directory, { recursive: true });

    if (append) {
      await fs.appendFile(resolvedPath, content, "utf-8");
    } else {
      await fs.writeFile(resolvedPath, content, "utf-8");
    }

    const result: FileWriteResult = {
      filePath: resolvedPath,
      fileName,
      size: content.length,
    };

    // Generate preview URL if generator is configured
    if (this.previewUrlGenerator) {
      const previewUrl = this.previewUrlGenerator(
        resolvedPath,
        fileName,
        this.electronApp.isPackaged
      );
      if (previewUrl) {
        result.previewUrl = previewUrl;
        // Notify renderer of file update
        this.detailView.webContents.send(this.ipcChannel, "preview", previewUrl);
      }
    }

    return result;
  }

  /**
   * Delete a file or directory.
   */
  private async fileDelete(
    filePath: string
  ): Promise<{ deleted: boolean; path: string; type: string }> {
    const resolvedPath = this.resolvePath(filePath);

    // Check if path exists and whether it's a directory
    const stats = await fs.stat(resolvedPath);
    const isDirectory = stats.isDirectory();

    if (isDirectory) {
      await fs.rm(resolvedPath, { recursive: true, force: true });
    } else {
      await fs.unlink(resolvedPath);
    }

    return {
      deleted: true,
      path: resolvedPath,
      type: isDirectory ? "directory" : "file",
    };
  }

  /**
   * Replace strings in a file.
   */
  private async fileStrReplace(
    filePath: string,
    oldStr: string,
    newStr: string
  ): Promise<{ modified: boolean; replacements: number }> {
    const resolvedPath = this.resolvePath(filePath);
    let content = await fs.readFile(resolvedPath, "utf-8");
    const originalContent = content;

    const regex = new RegExp(oldStr, "g");
    const matches = content.match(regex);
    const replacements = matches ? matches.length : 0;

    content = content.replace(regex, newStr);

    if (content === originalContent) {
      return { modified: false, replacements: 0 };
    }

    await fs.writeFile(resolvedPath, content, "utf-8");
    return { modified: true, replacements };
  }

  /**
   * Find files by glob pattern.
   */
  private async fileFindByName(
    directoryPath: string,
    globPattern: string
  ): Promise<FileInfo[]> {
    const resolvedPath = this.resolvePath(directoryPath);
    const pattern = path.join(resolvedPath, globPattern);
    const files = await glob(pattern);

    const fileDetails = await Promise.all(
      files.map(async (file) => {
        const stats = await fs.stat(file);
        return {
          name: path.basename(file),
          path: file,
          isDirectory: stats.isDirectory(),
          size: this.formatFileSize(stats.size),
          modified: stats.mtime.toLocaleString(),
        };
      })
    );

    return fileDetails;
  }

  /**
   * Format file size for human readability.
   */
  private formatFileSize(size: number): string {
    if (size < 1024) {
      return size + " B";
    }
    if (size < 1024 * 1024) {
      return (size / 1024).toFixed(1) + " KB";
    }
    return (size / 1024 / 1024).toFixed(1) + " MB";
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
   */
  setWorkPath(workPath: string): void {
    this.workPath = workPath;
  }
}

export { FileAgent };
