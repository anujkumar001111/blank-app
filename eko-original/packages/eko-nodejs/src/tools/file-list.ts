import * as fs from "fs/promises";
import * as path from "path";
import { Tool, ToolResult } from "@eko-ai/eko/types";
import { FileInfo, FileSecurityOptions } from "../types/file.types";
import { resolvePath, formatFileSize } from "./security";

/**
 * File list tool for listing directory contents.
 *
 * Ported from eko-electron/file.ts:181-202, 373-390
 * Includes formatFileSize helper (500-508)
 *
 * @example
 * ```ts
 * const tool = new FileListTool('/workspace', { restrictToWorkPath: true });
 * const result = await tool.execute({ directoryPath: 'src' });
 * // Returns array of FileInfo with name, path, isDirectory, size, modified
 * ```
 */
export class FileListTool implements Tool {
  name = "file_list";
  description =
    "List all files and directories in the specified directory path.";
  parameters = {
    type: "object" as const,
    properties: {
      directoryPath: {
        type: "string" as const,
        description: "The absolute or relative path to the directory",
      },
    },
    required: ["directoryPath"],
  };

  /**
   * Create a new FileListTool.
   *
   * @param workPath - Base directory for file operations
   * @param securityOptions - Security configuration for path resolution
   */
  constructor(
    private workPath: string,
    private securityOptions: FileSecurityOptions = { restrictToWorkPath: true }
  ) { }

  /**
   * Execute the directory listing operation.
   * Returns detailed file information for all items in the directory.
   *
   * @param args - Tool arguments containing directoryPath
   * @returns Tool result with array of FileInfo objects or error
   */
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const directoryPath = args.directoryPath as string;
      const resolvedPath = resolvePath(
        directoryPath,
        this.workPath,
        this.securityOptions
      );

      const files = await fs.readdir(resolvedPath);

      // Process in batches to avoid EMFILE (too many open files)
      const BATCH_SIZE = 50;
      const fileDetails: FileInfo[] = [];

      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (file) => {
            const filePath = path.join(resolvedPath, file);
            const stats = await fs.stat(filePath);
            return {
              name: file,
              path: filePath,
              isDirectory: stats.isDirectory(),
              size: formatFileSize(stats.size),
              modified: stats.mtime.toISOString(), // Faster than toLocaleString()
            };
          })
        );
        fileDetails.push(...batchResults);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(fileDetails, null, 2),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error listing directory: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
}
