import * as fs from "fs/promises";
import * as path from "path";
import { Tool, ToolResult } from "@eko-ai/eko/types";
import { FileSecurityOptions } from "../types/file.types";
import { resolvePath } from "./security";

/**
 * File write tool for writing content to files.
 *
 * Ported from eko-electron/file.ts:224-258, 403-442
 * Changes:
 * - Removed preview URL generation (Electron-specific)
 * - Removed IPC notification (Electron-specific)
 * - Kept mkdir recursive behavior
 *
 * @example
 * ```ts
 * const tool = new FileWriteTool('/workspace', { restrictToWorkPath: true });
 * const result = await tool.execute({
 *   filePath: 'output.txt',
 *   content: 'Hello, World!',
 *   append: false
 * });
 * ```
 */
export class FileWriteTool implements Tool {
  name = "file_write";
  description =
    "Write content to a file. Creates parent directories if they don't exist.";
  parameters = {
    type: "object" as const,
    properties: {
      filePath: {
        type: "string" as const,
        description: "The absolute or relative path to the file",
      },
      content: {
        type: "string" as const,
        description: "The content to write to the file",
      },
      append: {
        type: "boolean" as const,
        description: "If true, append to the file instead of overwriting",
        default: false,
      },
    },
    required: ["filePath", "content"],
  };

  /**
   * Create a new FileWriteTool.
   *
   * @param workPath - Base directory for file operations
   * @param securityOptions - Security configuration for path resolution
   */
  constructor(
    private workPath: string,
    private securityOptions: FileSecurityOptions = { restrictToWorkPath: true }
  ) {}

  /**
   * Execute the file write operation.
   * Creates parent directories if they don't exist.
   *
   * @param args - Tool arguments containing filePath, content, and optional append flag
   * @returns Tool result with success message or error
   */
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const filePath = args.filePath as string;
      const content = args.content as string;
      const append = (args.append as boolean) || false;

      const resolvedPath = resolvePath(
        filePath,
        this.workPath,
        this.securityOptions
      );
      const directory = path.dirname(resolvedPath);
      const fileName = path.basename(resolvedPath);

      // Create directory if it doesn't exist
      await fs.mkdir(directory, { recursive: true });

      if (append) {
        await fs.appendFile(resolvedPath, content, "utf-8");
      } else {
        await fs.writeFile(resolvedPath, content, "utf-8");
      }

      const result = {
        filePath: resolvedPath,
        fileName,
        size: content.length,
      };

      return {
        content: [
          {
            type: "text",
            text: `File written successfully: ${fileName} (${result.size} bytes)`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error writing file: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
}
