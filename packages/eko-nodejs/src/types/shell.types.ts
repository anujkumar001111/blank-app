/**
 * Types for shell execution tools
 */

export interface ShellResult {
  /**
   * Standard output from the command
   */
  stdout: string;

  /**
   * Standard error from the command
   */
  stderr: string;

  /**
   * Exit code (0 = success, non-zero = error, -1 = killed)
   */
  exitCode: number;

  /**
   * Execution duration in milliseconds
   */
  duration: number;

  /**
   * Whether the process was killed due to timeout
   */
  killed?: boolean;
}

export interface ShellExecOptions {
  /**
   * Working directory for command execution
   * @default process.cwd()
   */
  cwd?: string;

  /**
   * Timeout in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Environment variables to inject
   */
  env?: Record<string, string>;

  /**
   * Shell to use for execution
   * @default platform default shell
   */
  shell?: string;

  /**
   * Maximum buffer size for stdout/stderr
   * @default 10485760 (10MB)
   */
  maxBuffer?: number;
}
