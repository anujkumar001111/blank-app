import * as path from "path";
import { FileSecurityOptions } from "../types/file.types";

/**
 * Resolve and validate a path, applying security restrictions.
 *
 * This function prevents path traversal attacks and restricts access
 * to allowed directories when security is enabled.
 *
 * @param inputPath - The path to resolve (relative or absolute)
 * @param workPath - The base working directory
 * @param securityOptions - Security configuration
 * @returns Resolved absolute path
 * @throws Error if path violates security restrictions
 */
export function resolvePath(
  inputPath: string,
  workPath: string,
  securityOptions: FileSecurityOptions = { restrictToWorkPath: true }
): string {
  let resolvedPath: string;

  if (path.isAbsolute(inputPath)) {
    resolvedPath = path.normalize(inputPath);
  } else {
    // Normalize to prevent ../ traversal
    resolvedPath = path.normalize(path.join(workPath, inputPath));
  }

  // Apply security restrictions if enabled
  if (securityOptions.restrictToWorkPath !== false) {
    const normalizedWorkPath = path.normalize(workPath);

    // Check if resolved path is within workPath
    const isWithinWorkPath =
      resolvedPath.startsWith(normalizedWorkPath + path.sep) ||
      resolvedPath === normalizedWorkPath;

    // Check if resolved path is within any allowed paths
    const allowedPaths = securityOptions.allowedPaths || [];
    const isWithinAllowedPath = allowedPaths.some((allowedPath) => {
      const normalizedAllowed = path.normalize(allowedPath);
      return (
        resolvedPath.startsWith(normalizedAllowed + path.sep) ||
        resolvedPath === normalizedAllowed
      );
    });

    if (!isWithinWorkPath && !isWithinAllowedPath) {
      throw new Error(
        `Access denied: Path "${inputPath}" resolves outside allowed directories. ` +
          `Resolved to "${resolvedPath}" but must be within workPath "${normalizedWorkPath}"` +
          (allowedPaths.length > 0
            ? ` or allowed paths: ${allowedPaths.join(", ")}`
            : "") +
          `. Set restrictToWorkPath to false to disable this protection.`
      );
    }
  }

  return resolvedPath;
}

/**
 * Format file size for human readability.
 *
 * @param size - Size in bytes
 * @returns Human-readable size string (e.g., "1.2 MB")
 */
export function formatFileSize(size: number): string {
  if (size < 1024) {
    return size + " B";
  }
  if (size < 1024 * 1024) {
    return (size / 1024).toFixed(1) + " KB";
  }
  return (size / 1024 / 1024).toFixed(1) + " MB";
}
