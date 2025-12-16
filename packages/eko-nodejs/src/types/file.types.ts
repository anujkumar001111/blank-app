/**
 * Types for file operation tools
 *
 * NOTE: These types are duplicated from eko-electron (per ADR-0002).
 * eko-nodejs MUST NOT depend on eko-electron to avoid Electron types contamination.
 */

export interface FileInfo {
  /**
   * Absolute file path
   */
  path: string;

  /**
   * File or directory name
   */
  name?: string;

  /**
   * Whether this is a directory
   */
  isDirectory?: boolean;

  /**
   * Human-readable file size (e.g., "1.2 MB")
   */
  size?: string;

  /**
   * Last modified timestamp (ISO 8601)
   */
  modified?: string;
}

export interface FileSecurityOptions {
  /**
   * Restrict operations to workPath only
   * @default true
   */
  restrictToWorkPath?: boolean;

  /**
   * Additional allowed paths outside workPath
   */
  allowedPaths?: string[];
}
