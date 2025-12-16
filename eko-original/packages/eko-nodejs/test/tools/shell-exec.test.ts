/**
 * Tests for ShellExecTool
 * Testing shell command execution with security controls and timeout handling
 */

import { ShellExecTool } from '../../src/tools/shell-exec';
import { AgentContext } from '@eko-ai/eko-core/agent/agent-context';
import { Agent } from '@eko-ai/eko-core';

describe('ShellExecTool', () => {
  let tool: ShellExecTool;
  let mockAgentContext: AgentContext;

  beforeEach(() => {
    // Create minimal mock AgentContext for testing
    mockAgentContext = {
      agent: {} as Agent,
      context: {} as any,
      agentChain: {} as any,
      variables: new Map(),
      consecutiveErrorNum: 0,
    } as AgentContext;
  });

  describe('Basic Command Execution', () => {
    test('should execute basic command and return stdout', async () => {
      tool = new ShellExecTool({ enableShellSafety: true });

      const result = await tool.execute(
        { command: 'echo "hello world"' },
        mockAgentContext,
        {} as any
      );

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('hello world');
      expect(result.content[0].text).toContain('exitCode: 0');
    });

    test('should return stderr and exit code for failing command', async () => {
      tool = new ShellExecTool({ enableShellSafety: true });

      const result = await tool.execute(
        { command: 'ls /nonexistent-directory-xyz' },
        mockAgentContext,
        {} as any
      );

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('stderr:');
      expect(result.content[0].text).not.toContain('exitCode: 0');
    });
  });

  describe('Timeout Handling', () => {
    test('should kill process on timeout', async () => {
      tool = new ShellExecTool({ enableShellSafety: true });

      const startTime = Date.now();
      const result = await tool.execute(
        {
          command: 'sleep 5',
          timeout: 1000, // 1 second timeout
        },
        mockAgentContext,
        {} as any
      );
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // Should not take 5 seconds
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('killed: true');
    });
  });

  describe('Security - Dangerous Patterns', () => {
    test('should block rm -rf / when safety enabled', async () => {
      tool = new ShellExecTool({ enableShellSafety: true });

      const result = await tool.execute(
        { command: 'rm -rf /' },
        mockAgentContext,
        {} as any
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('dangerous command blocked');
    });

    test('should allow rm -rf /valid/path when safety enabled', async () => {
      tool = new ShellExecTool({ enableShellSafety: true });

      const result = await tool.execute(
        { command: 'rm -rf /tmp/test-path' },
        mockAgentContext,
        {} as any
      );

      // Should not be blocked (though it may fail if path doesn't exist)
      expect(result.content[0].text).not.toContain('dangerous command blocked');
    });

    test('should block mkfs when safety enabled', async () => {
      tool = new ShellExecTool({ enableShellSafety: true });

      const result = await tool.execute(
        { command: 'mkfs.ext4 /dev/sda1' },
        mockAgentContext,
        {} as any
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('dangerous command blocked');
    });

    test('should block fork bomb when safety enabled', async () => {
      tool = new ShellExecTool({ enableShellSafety: true });

      const result = await tool.execute(
        { command: ':(){:|:&};:' },
        mockAgentContext,
        {} as any
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('dangerous command blocked');
    });

    test('should block write to block device when safety enabled', async () => {
      tool = new ShellExecTool({ enableShellSafety: true });

      const result = await tool.execute(
        { command: 'echo "data" > /dev/sda' },
        mockAgentContext,
        {} as any
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('dangerous command blocked');
    });

    test('should allow dangerous commands when safety disabled', async () => {
      tool = new ShellExecTool({ enableShellSafety: false });

      const result = await tool.execute(
        { command: 'echo "rm -rf /"' }, // Echo is safe but contains pattern
        mockAgentContext,
        {} as any
      );

      // Should not be blocked when safety is disabled
      expect(result.content[0].text).not.toContain('dangerous command blocked');
    });
  });

  describe('Working Directory', () => {
    test('should respect cwd option', async () => {
      tool = new ShellExecTool({ enableShellSafety: true });

      const result = await tool.execute(
        {
          command: 'pwd',
          cwd: '/tmp',
        },
        mockAgentContext,
        {} as any
      );

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('/tmp');
    });
  });

  describe('Environment Variables', () => {
    test('should inject environment variables', async () => {
      tool = new ShellExecTool({ enableShellSafety: true });

      const result = await tool.execute(
        {
          command: 'echo $TEST_VAR',
          env: { TEST_VAR: 'test-value-123' },
        },
        mockAgentContext,
        {} as any
      );

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('test-value-123');
    });
  });

  describe('Binary Output Handling', () => {
    test('should handle and truncate large output', async () => {
      tool = new ShellExecTool({ enableShellSafety: true });

      // Generate large output
      const result = await tool.execute(
        {
          command: 'yes | head -n 10000',
          timeout: 2000,
        },
        mockAgentContext,
        {} as any
      );

      expect(result.isError).toBe(false);
      expect(result.content[0].text.length).toBeLessThan(50000); // Should be truncated if too large
    });
  });

  describe('Background Execution', () => {
    test('should start background job and return jobId', async () => {
      tool = new ShellExecTool({ enableShellSafety: true });

      const result = await tool.execute(
        { command: 'sleep 1 && echo "done"', background: true },
        mockAgentContext,
        {} as any
      );

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Background job started');
      expect(result.extInfo?.jobId).toMatch(/^job-\d+$/);
      expect(result.extInfo?.status).toBe('started');
    });

    test('should list active jobs', async () => {
      tool = new ShellExecTool({ enableShellSafety: true });

      // Start a job first
      await tool.execute(
        { command: 'sleep 2', background: true },
        mockAgentContext,
        {} as any
      );

      // List jobs
      const listResult = await tool.execute(
        { action: 'list' },
        mockAgentContext,
        {} as any
      );

      expect(listResult.isError).toBe(false);
      expect(listResult.content[0].text).toContain('Active Jobs');
    });

    test('should view job status', async () => {
      tool = new ShellExecTool({ enableShellSafety: true });

      // Start a job
      const startResult = await tool.execute(
        { command: 'echo "test output"', background: true },
        mockAgentContext,
        {} as any
      );
      const jobId = startResult.extInfo?.jobId;

      // Wait a bit for the job to run
      await new Promise(r => setTimeout(r, 500));

      // View job
      const viewResult = await tool.execute(
        { action: 'view', jobId },
        mockAgentContext,
        {} as any
      );

      expect(viewResult.isError).toBe(false);
      expect(viewResult.content[0].text).toContain('Job ID:');
      expect(viewResult.content[0].text).toContain(jobId);
    });

    test('should return error for non-existent job', async () => {
      tool = new ShellExecTool({ enableShellSafety: true });

      const result = await tool.execute(
        { action: 'view', jobId: 'job-99999' },
        mockAgentContext,
        {} as any
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });

    test('should kill running job', async () => {
      tool = new ShellExecTool({ enableShellSafety: true });

      // Start a long-running job
      const startResult = await tool.execute(
        { command: 'sleep 30', background: true },
        mockAgentContext,
        {} as any
      );
      const jobId = startResult.extInfo?.jobId;

      // Kill the job
      const killResult = await tool.execute(
        { action: 'kill', jobId },
        mockAgentContext,
        {} as any
      );

      expect(killResult.isError).toBe(false);
      expect(killResult.content[0].text).toContain('terminate');
    });

    test('jobs should persist across ShellExecTool instances (static map)', async () => {
      const tool1 = new ShellExecTool({ enableShellSafety: true });

      // Start a job with instance 1
      const startResult = await tool1.execute(
        { command: 'sleep 5', background: true },
        mockAgentContext,
        {} as any
      );
      const jobId = startResult.extInfo?.jobId;

      // Create new instance
      const tool2 = new ShellExecTool({ enableShellSafety: true });

      // View job with instance 2
      const viewResult = await tool2.execute(
        { action: 'view', jobId },
        mockAgentContext,
        {} as any
      );

      expect(viewResult.isError).toBe(false);
      expect(viewResult.content[0].text).toContain(jobId);

      // Cleanup: kill the job
      await tool2.execute({ action: 'kill', jobId }, mockAgentContext, {} as any);
    });
  });
});
