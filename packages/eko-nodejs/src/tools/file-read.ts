import * as fs from "fs/promises";
import { Tool, ToolResult } from "@eko-ai/eko/types";
import { FileSecurityOptions } from "../types/file.types";
import { resolvePath } from "./security";

/**
 * File read tool for reading file contents.
 *
 * Ported from eko-electron/file.ts:203-222, 394-398
 * Security: Uses resolvePath to prevent path traversal
 *
 * @example
 * ```ts
 * const tool = new FileReadTool('/workspace', { restrictToWorkPath: true });
 * const result = await tool.execute({ filePath: 'config.json' });
 * ```
 */
export class FileReadTool implements Tool {
  name = "file_read";
  description = "Read the contents of a file and return as a string.";
  parameters = {
    type: "object" as const,
    properties: {
      filePath: {
        type: "string" as const,
        description: "The absolute or relative path to the file",
      },
    },
    required: ["filePath"],
  };

  /**
   * Create a new FileReadTool.
   *
   * @param workPath - Base directory for file operations
   * @param securityOptions - Security configuration for path resolution
   */
  constructor(
    private workPath: string,
    private securityOptions: FileSecurityOptions = { restrictToWorkPath: true }
  ) {}

  /**
   * Execute the file read operation.
   *
   * @param args - Tool arguments containing filePath
   * @returns Tool result with file contents or error message
   */
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const filePath = args.filePath as string;
      const resolvedPath = resolvePath(
        filePath,
        this.workPath,
        this.securityOptions
      );

      const content = await fs.readFile(resolvedPath, "utf-8");

      return {
        content: [{ type: "text", text: content }],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
}
