import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";
import { Tool, ToolResult } from "@eko-ai/eko/types";
import { FileInfo, FileSecurityOptions } from "../types/file.types";
import { resolvePath, formatFileSize } from "./security";

/**
 * File find tool for searching files by glob pattern.
 *
 * Ported from eko-electron/file.ts:294-323, 473-495
 * Renamed from file_find_by_name to file_find for consistency
 *
 * @example
 * ```ts
 * const tool = new FileFindTool('/workspace', { restrictToWorkPath: true });
 * // Find all TypeScript files
 * const result = await tool.execute({
 *   directoryPath: 'src',
 *   globPattern: '**\/*.ts'
 * });
 * ```
 */
export class FileFindTool implements Tool {
  name = "file_find";
  description =
    "Find files matching a glob pattern within a directory. Returns file information for all matches.";
  parameters = {
    type: "object" as const,
    properties: {
      directoryPath: {
        type: "string" as const,
        description: "The directory to search in",
      },
      globPattern: {
        type: "string" as const,
        description: "The glob pattern to match (e.g., '**/*.ts', '*.json')",
      },
    },
    required: ["directoryPath", "globPattern"],
  };

  /**
   * Create a new FileFindTool.
   *
   * @param workPath - Base directory for file operations
   * @param securityOptions - Security configuration for path resolution
   */
  constructor(
    private workPath: string,
    private securityOptions: FileSecurityOptions = { restrictToWorkPath: true }
  ) { }

  /**
   * Execute the file search operation using glob patterns.
   * Supports standard glob syntax: *, **, ?, [abc], {a,b,c}
   *
   * @param args - Tool arguments containing directoryPath and globPattern
   * @returns Tool result with array of matching FileInfo objects or error
   */
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const directoryPath = args.directoryPath as string;
      const globPattern = args.globPattern as string;

      const resolvedPath = resolvePath(
        directoryPath,
        this.workPath,
        this.securityOptions
      );
      const pattern = path.join(resolvedPath, globPattern);
      const files = await glob(pattern);

      // Process in batches to avoid EMFILE (too many open files)
      const BATCH_SIZE = 50;
      const fileDetails: FileInfo[] = [];

      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (file) => {
            const stats = await fs.stat(file);
            return {
              name: path.basename(file),
              path: file,
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
            text: `Error finding files: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
}
