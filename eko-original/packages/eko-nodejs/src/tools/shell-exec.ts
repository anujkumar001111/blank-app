/**
 * ShellExecTool - Execute shell commands with security controls and background job support
 * Implements Tool interface with flexible execution modes
 *
 * @example
 * ```ts
 * // Run normally
 * const result = await tool.execute({ command: 'ls -la' });
 *
 * // Run in background
 * const bgResult = await tool.execute({ command: 'npm run dev', background: true });
 * // returns { jobId: "job-123", status: "started" }
 *
 * // Check background job
 * const viewResult = await tool.execute({ action: 'view', jobId: "job-123" });
 * ```
 */

import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { Tool, ToolResult } from '@eko-ai/eko/types';
import { ShellResult, ShellExecOptions } from '../types/shell.types';

const execAsync = promisify(exec);

/**
 * Dangerous command patterns that should be blocked when safety is enabled
 * Based on ADR-0001 security requirements
 */
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\/(?!\w)/,  // rm -rf / (but allow rm -rf /path)
  />\s*\/dev\/sd/,         // write to block devices
  /mkfs/,                  // format filesystems
  /:\(\)\{.*\};:/,         // fork bombs - escaped braces
];

/**
 * Detailed state of a background shell job
 */
interface ShellJob {
  id: string;
  command: string;
  process: ChildProcess;
  startTime: number;
  stdout: string[];
  stderr: string[];
  exitCode: number | null;
  killed: boolean;
}

/**
 * Arguments for shell command execution
 */
interface ShellExecArgs {
  /** Action to perform: 'run' (default), 'view', 'kill', 'list' */
  action?: 'run' | 'view' | 'kill' | 'list';
  /** The shell command to execute (required for action='run') */
  command?: string;
  /** Working directory for command execution */
  cwd?: string;
  /** Timeout in milliseconds (default: 30000 for blocking calls) */
  timeout?: number;
  /** Environment variables to inject */
  env?: Record<string, string>;
  /** Shell to use for execution */
  shell?: string;
  /** Maximum buffer size for stdout/stderr (default: 10MB) */
  maxBuffer?: number;
  /** Run in background (non-blocking) */
  background?: boolean;
  /** Job ID for view/kill actions */
  jobId?: string;
}

/**
 * Configuration options for ShellExecTool
 */
interface ShellExecToolOptions {
  /** Enable security checks for dangerous commands (default: true) */
  enableShellSafety?: boolean;
}

/**
 * Tool for executing shell commands with security controls, output capture, and background job management.
 * Supports timeout handling, environment injection, and dangerous pattern detection.
 */
export class ShellExecTool implements Tool {
  readonly name = 'shell_exec';
  readonly description = 'Execute shell commands with options for background execution, job monitoring, and termination.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string' as const,
        enum: ['run', 'view', 'kill', 'list'],
        description: "Action to perform. Default is 'run'. Use 'view'/'kill'/'list' to manage background jobs.",
      },
      command: {
        type: 'string' as const,
        description: "The shell command to execute (required for 'run')",
      },
      background: {
        type: 'boolean' as const,
        description: "If true, runs command in background and returns jobId immediately. Default false.",
      },
      jobId: {
        type: 'string' as const,
        description: "ID of the background job (required for 'view' or 'kill')",
      },
      cwd: {
        type: 'string' as const,
        description: 'Working directory for command execution',
      },
      timeout: {
        type: 'number' as const,
        description: 'Timeout in milliseconds (default: 30000). Ignored for background jobs.',
      },
      env: {
        type: 'object' as const,
        description: 'Environment variables to inject',
        additionalProperties: { type: 'string' as const },
      },
    },
    // We can't strictly enforce 'command' required if action is 'view', but 'command' is most common usage.
    // We'll validate manually in execute.
  };

  private enableShellSafety: boolean;
  // Static to persist across tool instances within the same process
  private static jobs: Map<string, ShellJob> = new Map();
  private static jobCounter = 0;
  private static readonly MAX_JOBS = 100;
  private static cleanupRegistered = false;

  /**
   * Create a new ShellExecTool.
   *
   * @param options - Configuration options for the tool
   */
  constructor(options: ShellExecToolOptions = {}) {
    this.enableShellSafety = options.enableShellSafety ?? true;
    this.registerCleanup();
  }

  /**
   * Register cleanup handlers to prevent orphaned processes
   */
  private registerCleanup(): void {
    if (ShellExecTool.cleanupRegistered) return;
    ShellExecTool.cleanupRegistered = true;

    const cleanup = () => {
      for (const [jobId, job] of ShellExecTool.jobs.entries()) {
        if (job.exitCode === null) {
          try {
            if (job.process.pid) {
              process.kill(-job.process.pid, 'SIGTERM');
            } else {
              job.process.kill('SIGTERM');
            }
          } catch (e) {
            // Process may already be terminated
          }
        }
      }
    };

    process.on('exit', cleanup);
    process.on('SIGINT', () => {
      cleanup();
      process.exit(130);
    });
    process.on('SIGTERM', () => {
      cleanup();
      process.exit(143);
    });
  }

  /**
   * Execute shell command with security checks and timeout handling.
   * Automatically captures stdout, stderr, exit code, and execution duration.
   *
   * @param args - Command execution arguments
   * @returns Tool result with command output or error
   */
  async execute(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const {
      action = 'run',
      command,
      cwd,
      timeout = 30000,
      env,
      shell,
      maxBuffer = 10 * 1024 * 1024, // 10MB
      background = false,
      jobId,
    } = args as unknown as ShellExecArgs;

    try {
      if (action === 'list') {
        return this.listJobs();
      }
      if (action === 'view') {
        return this.viewJob(jobId);
      }
      if (action === 'kill') {
        return this.killJob(jobId);
      }

      // Default 'run' logic
      if (!command) {
        throw new Error("Parameter 'command' is required for action 'run'");
      }

      // Security: Check for dangerous patterns if safety is enabled
      if (this.enableShellSafety && this.isDangerous(command)) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: dangerous command blocked by security policy\n\nCommand: ${command}\n\nThis command matches a known dangerous pattern. Disable safety mode if this is intentional.`,
            },
          ],
          isError: true,
        };
      }

      if (background) {
        return this.runInBackground(command, args as ShellExecArgs);
      } else {
        return this.runBlocking(command, args as ShellExecArgs);
      }

    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }

  private runInBackground(command: string, args: ShellExecArgs): ToolResult {
    // Check job limit
    if (ShellExecTool.jobs.size >= ShellExecTool.MAX_JOBS) {
      return {
        content: [{
          type: 'text',
          text: `Error: Maximum background job limit reached (${ShellExecTool.MAX_JOBS}). Kill or wait for existing jobs to complete.`
        }],
        isError: true,
      };
    }

    const jobId = `job-${++ShellExecTool.jobCounter}`;
    const startTime = Date.now();
    const env = { ...process.env, ...args.env } as Record<string, string>;

    // Spawn detached process with safer shell default
    const child = spawn(command, {
      cwd: args.cwd || process.cwd(),
      env,
      shell: args.shell ?? false, // Default to false for security
      detached: true, // Allow process to run independently
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const job: ShellJob = {
      id: jobId,
      command,
      process: child,
      startTime,
      stdout: [],
      stderr: [],
      exitCode: null,
      killed: false,
    };

    child.stdout?.on('data', (data) => {
      this.appendLog(job.stdout, data.toString());
    });

    child.stderr?.on('data', (data) => {
      this.appendLog(job.stderr, data.toString());
    });

    child.on('close', (code) => {
      job.exitCode = code;
    });

    child.on('error', (err) => {
      this.appendLog(job.stderr, `Failed to start process: ${err.message}`);
      job.exitCode = -1;
    });

    child.unref(); // Don't hold parent process open
    ShellExecTool.jobs.set(jobId, job);

    return {
      content: [{
        type: 'text',
        text: `Background job started successfully.\nJob ID: ${jobId}\nCommand: ${command}\n\nUse { action: 'view', jobId: '${jobId}' } to check logs.`
      }],
      isError: false,
      extInfo: { jobId, status: 'started' }
    };
  }

  private async runBlocking(command: string, args: ShellExecArgs): Promise<ToolResult> {
    const startTime = Date.now();
    try {
      const execOptions: ShellExecOptions & { encoding: 'utf8' } = {
        cwd: args.cwd || process.cwd(),
        timeout: args.timeout || 30000,
        maxBuffer: args.maxBuffer || 10 * 1024 * 1024,
        encoding: 'utf8',
      };

      if (args.shell) execOptions.shell = args.shell;
      if (args.env) execOptions.env = { ...process.env, ...args.env } as Record<string, string>;

      const { stdout, stderr } = await execAsync(command, execOptions);
      const duration = Date.now() - startTime;

      const result: ShellResult = {
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: 0,
        duration,
        killed: false,
      };

      return this.formatResult(result, command);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const result: ShellResult = {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || '',
        exitCode: error.code ?? -1,
        duration,
        killed: error.killed || error.signal === 'SIGTERM',
      };
      return this.formatResult(result, command);
    }
  }

  private viewJob(jobId?: string): ToolResult {
    if (!jobId || !ShellExecTool.jobs.has(jobId)) {
      return { content: [{ type: 'text', text: `Error: Job ID '${jobId}' not found.` }], isError: true };
    }
    const job = ShellExecTool.jobs.get(jobId)!;
    const isRunning = job.exitCode === null;
    const duration = Date.now() - job.startTime;

    let output = `Job ID: ${jobId}\nCommand: ${job.command}\nStatus: ${isRunning ? 'RUNNING' : 'FINISHED'}\nDuration: ${duration}ms\n`;
    if (job.exitCode !== null) output += `Exit Code: ${job.exitCode}\n`;

    output += `\n--- STDOUT (${job.stdout.length} lines) ---\n`;
    output += job.stdout.slice(-50).join(''); // Last 50 lines

    output += `\n--- STDERR (${job.stderr.length} lines) ---\n`;
    output += job.stderr.slice(-50).join('');

    return {
      content: [{ type: 'text', text: output }],
      isError: false
    };
  }

  private killJob(jobId?: string): ToolResult {
    if (!jobId || !ShellExecTool.jobs.has(jobId)) {
      return { content: [{ type: 'text', text: `Error: Job ID '${jobId}' not found.` }], isError: true };
    }
    const job = ShellExecTool.jobs.get(jobId)!;

    if (job.exitCode !== null) {
      return { content: [{ type: 'text', text: `Job '${jobId}' is already finished.` }], isError: false };
    }

    // Try multiple kill signals
    try {
      if (job.process.pid) {
        process.kill(-job.process.pid); // Kill process group
      } else {
        job.process.kill();
      }
    } catch (e) {
      job.process.kill(); // Fallback
    }

    job.killed = true;

    return {
      content: [{ type: 'text', text: `Signal sent to terminate Job '${jobId}'.` }],
      isError: false
    };
  }

  private listJobs(): ToolResult {
    const jobs = ShellExecTool.jobs;
    if (jobs.size === 0) {
      return { content: [{ type: 'text', text: 'No background jobs.' }], isError: false };
    }

    let output = `Active Jobs (${jobs.size}):\n\n`;
    for (const [id, job] of jobs.entries()) {
      const isRunning = job.exitCode === null;
      const duration = Date.now() - job.startTime;
      output += `- ${id}: ${isRunning ? 'RUNNING' : 'FINISHED'} (${duration}ms) - ${job.command.slice(0, 50)}${job.command.length > 50 ? '...' : ''}\n`;
    }

    return { content: [{ type: 'text', text: output }], isError: false };
  }

  private appendLog(buffer: string[], text: string) {
    const MAX_LINES = 1000;
    // Simple line buffering handling could be more robust, but sufficient for now
    buffer.push(text);
    if (buffer.length > MAX_LINES) {
      buffer.shift();
    }
  }

  /**
   * Check if command contains dangerous patterns
   */
  private isDangerous(command: string): boolean {
    return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
  }

  /**
   * Format shell result into ToolResult
   */
  private formatResult(result: ShellResult, command: string): ToolResult {
    const { stdout, stderr, exitCode, duration, killed } = result;

    const MAX_OUTPUT_LENGTH = 100000; // 100KB
    let output = '';

    if (stdout) {
      const truncated = stdout.length > MAX_OUTPUT_LENGTH;
      output += `stdout: ${stdout.slice(0, MAX_OUTPUT_LENGTH)}${truncated ? '\n... (output truncated)' : ''
        }\n`;
    }

    if (stderr) {
      const truncated = stderr.length > MAX_OUTPUT_LENGTH;
      output += `stderr: ${stderr.slice(0, MAX_OUTPUT_LENGTH)}${truncated ? '\n... (output truncated)' : ''
        }\n`;
    }

    output += `exitCode: ${exitCode}\n`;
    output += `duration: ${duration}ms\n`;

    if (killed) {
      output += `killed: true\n`;
    }

    const isError = exitCode !== 0 || killed;

    return {
      content: [
        {
          type: 'text',
          text: output.trim(),
        },
      ],
      isError,
      extInfo: {
        command,
        result,
      },
    };
  }
}
