import * as fs from "fs/promises";
import { Tool, ToolResult } from "@eko-ai/eko/types";
import { FileSecurityOptions } from "../types/file.types";
import { resolvePath } from "./security";

/**
 * File delete tool for removing files and directories.
 *
 * NEW: Does not exist in eko-electron (will be added there too)
 * Security: Uses resolvePath to prevent path traversal
 *
 * @example
 * ```ts
 * const tool = new FileDeleteTool('/workspace', { restrictToWorkPath: true });
 * const result = await tool.execute({ filePath: 'temp.txt' });
 * ```
 */
export class FileDeleteTool implements Tool {
  name = "file_delete";
  description =
    "Delete a file or directory. For directories, removes recursively.";
  parameters = {
    type: "object" as const,
    properties: {
      filePath: {
        type: "string" as const,
        description: "The absolute or relative path to the file or directory",
      },
    },
    required: ["filePath"],
  };

  /**
   * Create a new FileDeleteTool.
   *
   * @param workPath - Base directory for file operations
   * @param securityOptions - Security configuration for path resolution
   */
  constructor(
    private workPath: string,
    private securityOptions: FileSecurityOptions = { restrictToWorkPath: true }
  ) {}

  /**
   * Execute the file delete operation.
   * Automatically detects whether the path is a file or directory.
   * Directories are removed recursively.
   *
   * @param args - Tool arguments containing filePath
   * @returns Tool result with success message or error
   */
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const filePath = args.filePath as string;
      const resolvedPath = resolvePath(
        filePath,
        this.workPath,
        this.securityOptions
      );

      // Check if path exists and whether it's a directory
      const stats = await fs.stat(resolvedPath);
      const isDirectory = stats.isDirectory();

      if (isDirectory) {
        await fs.rm(resolvedPath, { recursive: true, force: true });
      } else {
        await fs.unlink(resolvedPath);
      }

      return {
        content: [
          {
            type: "text",
            text: `Successfully deleted ${isDirectory ? "directory" : "file"}: ${filePath}`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error deleting file: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
}
