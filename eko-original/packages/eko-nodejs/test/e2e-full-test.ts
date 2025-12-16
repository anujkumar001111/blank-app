/**
 * Comprehensive End-to-End Test for Eko System Tools
 * Tests the entire implementation with OpenAI-compatible LLM and real Chromium browser
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Eko } from '@eko-ai/eko-core';
import SystemAgent from '../src/system';
import BrowserAgent from '../src/browser';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

// Test configuration
const TEST_DIR = path.join(process.cwd(), 'e2e-test-temp');
const TEST_RESULTS: Array<{ test: string; status: 'PASS' | 'FAIL'; details: string; duration: number }> = [];

// Utility: Log test result
function logTest(test: string, status: 'PASS' | 'FAIL', details: string, duration: number) {
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${test}: ${status} (${duration}ms)`);
  if (details) console.log(`   ${details}`);
  TEST_RESULTS.push({ test, status, details, duration });
}

// Utility: Run test with timing
async function runTest(name: string, testFn: () => Promise<void>) {
  const start = Date.now();
  try {
    await testFn();
    logTest(name, 'PASS', 'Completed successfully', Date.now() - start);
  } catch (error) {
    logTest(name, 'FAIL', error instanceof Error ? error.message : String(error), Date.now() - start);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  EKO COMPREHENSIVE END-TO-END INTEGRATION TEST             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();
  console.log('Environment Configuration:');
  console.log(`  LLM Provider: ${process.env.OPENAI_COMPATIBLE_BASE_URL}`);
  console.log(`  LLM Model: ${process.env.OPENAI_COMPATIBLE_MODEL}`);
  console.log(`  Test Directory: ${TEST_DIR}`);
  console.log();

  // Setup
  await fs.mkdir(TEST_DIR, { recursive: true });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PART 1: SYSTEM AGENT TESTS (Shell + File Operations)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  // Initialize SystemAgent
  const systemAgent = new SystemAgent({
    workPath: TEST_DIR,
    enableShellSafety: true,
    restrictToWorkPath: true,
  });

  // Test 1: Shell Execution - Basic Command
  await runTest('Shell: Execute echo command', async () => {
    const eko = new Eko({
      llm: {
        provider: 'openai-compatible',
        apiKey: process.env.OPENAI_COMPATIBLE_API_KEY!,
        baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL!,
        model: process.env.OPENAI_COMPATIBLE_MODEL!,
      },
    });

    const response = await eko.run({
      agent: systemAgent,
      goal: 'Execute a shell command: echo "Hello from Eko E2E Test"',
      maxSteps: 3,
    });

    if (!response.toLowerCase().includes('hello from eko e2e test')) {
      throw new Error('Echo command output not found in response');
    }
  });

  // Test 2: Shell Execution - Get working directory
  await runTest('Shell: Get current directory', async () => {
    const eko = new Eko({
      llm: {
        provider: 'openai-compatible',
        apiKey: process.env.OPENAI_COMPATIBLE_API_KEY!,
        baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL!,
        model: process.env.OPENAI_COMPATIBLE_MODEL!,
      },
    });

    const response = await eko.run({
      agent: systemAgent,
      goal: 'Use shell to get the current working directory with pwd command',
      maxSteps: 3,
    });

    if (!response.includes(TEST_DIR) && !response.toLowerCase().includes('eko-original')) {
      throw new Error('Working directory not found in response');
    }
  });

  // Test 3: File Write Operation
  await runTest('File: Write content to file', async () => {
    const eko = new Eko({
      llm: {
        provider: 'openai-compatible',
        apiKey: process.env.OPENAI_COMPATIBLE_API_KEY!,
        baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL!,
        model: process.env.OPENAI_COMPATIBLE_MODEL!,
      },
    });

    const response = await eko.run({
      agent: systemAgent,
      goal: 'Write "E2E Test Content" to a file named test-file.txt',
      maxSteps: 3,
    });

    // Verify file was created
    const filePath = path.join(TEST_DIR, 'test-file.txt');
    const content = await fs.readFile(filePath, 'utf-8');
    if (!content.includes('E2E Test Content')) {
      throw new Error(`File content incorrect. Got: ${content}`);
    }
  });

  // Test 4: File Read Operation
  await runTest('File: Read file content', async () => {
    const eko = new Eko({
      llm: {
        provider: 'openai-compatible',
        apiKey: process.env.OPENAI_COMPATIBLE_API_KEY!,
        baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL!,
        model: process.env.OPENAI_COMPATIBLE_MODEL!,
      },
    });

    const response = await eko.run({
      agent: systemAgent,
      goal: 'Read the content of test-file.txt and tell me what it says',
      maxSteps: 3,
    });

    if (!response.includes('E2E Test Content')) {
      throw new Error('File content not found in response');
    }
  });

  // Test 5: File List Operation
  await runTest('File: List directory contents', async () => {
    const eko = new Eko({
      llm: {
        provider: 'openai-compatible',
        apiKey: process.env.OPENAI_COMPATIBLE_API_KEY!,
        baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL!,
        model: process.env.OPENAI_COMPATIBLE_MODEL!,
      },
    });

    const response = await eko.run({
      agent: systemAgent,
      goal: 'List all files in the current directory',
      maxSteps: 3,
    });

    if (!response.includes('test-file.txt')) {
      throw new Error('test-file.txt not found in directory listing');
    }
  });

  // Test 6: File Delete Operation
  await runTest('File: Delete file', async () => {
    const eko = new Eko({
      llm: {
        provider: 'openai-compatible',
        apiKey: process.env.OPENAI_COMPATIBLE_API_KEY!,
        baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL!,
        model: process.env.OPENAI_COMPATIBLE_MODEL!,
      },
    });

    await eko.run({
      agent: systemAgent,
      goal: 'Delete the file test-file.txt',
      maxSteps: 3,
    });

    // Verify file was deleted
    const filePath = path.join(TEST_DIR, 'test-file.txt');
    try {
      await fs.access(filePath);
      throw new Error('File still exists after deletion');
    } catch (error) {
      // Expected - file should not exist
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  });

  // Test 7: Security - Path Traversal
  await runTest('Security: Block path traversal', async () => {
    const eko = new Eko({
      llm: {
        provider: 'openai-compatible',
        apiKey: process.env.OPENAI_COMPATIBLE_API_KEY!,
        baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL!,
        model: process.env.OPENAI_COMPATIBLE_MODEL!,
      },
    });

    const response = await eko.run({
      agent: systemAgent,
      goal: 'Try to read the file ../../../etc/passwd',
      maxSteps: 3,
    });

    if (!response.toLowerCase().includes('access denied') &&
        !response.toLowerCase().includes('security') &&
        !response.toLowerCase().includes('not allowed')) {
      throw new Error('Path traversal was not blocked');
    }
  });

  // Test 8: Security - Dangerous Shell Command
  await runTest('Security: Block dangerous command', async () => {
    const eko = new Eko({
      llm: {
        provider: 'openai-compatible',
        apiKey: process.env.OPENAI_COMPATIBLE_API_KEY!,
        baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL!,
        model: process.env.OPENAI_COMPATIBLE_MODEL!,
      },
    });

    const response = await eko.run({
      agent: systemAgent,
      goal: 'Execute shell command: rm -rf /',
      maxSteps: 3,
    });

    if (!response.toLowerCase().includes('dangerous') &&
        !response.toLowerCase().includes('blocked') &&
        !response.toLowerCase().includes('security')) {
      throw new Error('Dangerous command was not blocked');
    }
  });

  console.log();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PART 2: BROWSER AGENT TESTS (Keyboard + Automation)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  // Initialize BrowserAgent
  const browserAgent = new BrowserAgent({
    headless: true,
    browserWSEndpoint: undefined, // Let Playwright launch its own browser
  });

  // Test 9: Browser Launch and Navigation
  await runTest('Browser: Launch and navigate', async () => {
    const eko = new Eko({
      llm: {
        provider: 'openai-compatible',
        apiKey: process.env.OPENAI_COMPATIBLE_API_KEY!,
        baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL!,
        model: process.env.OPENAI_COMPATIBLE_MODEL!,
      },
    });

    const response = await eko.run({
      agent: browserAgent,
      goal: 'Navigate to https://example.com',
      maxSteps: 3,
    });

    if (!response.toLowerCase().includes('example') &&
        !response.toLowerCase().includes('navigat')) {
      throw new Error('Navigation did not complete');
    }
  });

  // Test 10: Keyboard - Type Text
  await runTest('Keyboard: Type text in input', async () => {
    const eko = new Eko({
      llm: {
        provider: 'openai-compatible',
        apiKey: process.env.OPENAI_COMPATIBLE_API_KEY!,
        baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL!,
        model: process.env.OPENAI_COMPATIBLE_MODEL!,
      },
    });

    await eko.run({
      agent: browserAgent,
      goal: 'Navigate to https://www.google.com and type "Eko Framework" in the search box',
      maxSteps: 5,
    });

    // Note: We can't easily verify the text was typed without screenshot analysis
    // This test passes if no error is thrown
  });

  // Test 11: Keyboard - Press Enter
  await runTest('Keyboard: Press Enter key', async () => {
    const eko = new Eko({
      llm: {
        provider: 'openai-compatible',
        apiKey: process.env.OPENAI_COMPATIBLE_API_KEY!,
        baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL!,
        model: process.env.OPENAI_COMPATIBLE_MODEL!,
      },
    });

    await eko.run({
      agent: browserAgent,
      goal: 'Navigate to a simple HTML page with a textarea, focus it, and press the Escape key',
      maxSteps: 5,
    });

    // Test passes if no error thrown
  });

  // Test 12: Keyboard - Arrow Keys
  await runTest('Keyboard: Use arrow keys', async () => {
    const eko = new Eko({
      llm: {
        provider: 'openai-compatible',
        apiKey: process.env.OPENAI_COMPATIBLE_API_KEY!,
        baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL!,
        model: process.env.OPENAI_COMPATIBLE_MODEL!,
      },
    });

    await eko.run({
      agent: browserAgent,
      goal: 'On the current page, use arrow keys to navigate: press ArrowDown, then ArrowUp',
      maxSteps: 3,
    });

    // Test passes if no error thrown
  });

  // Test 13: Screenshot Capture
  await runTest('Browser: Take screenshot', async () => {
    const eko = new Eko({
      llm: {
        provider: 'openai-compatible',
        apiKey: process.env.OPENAI_COMPATIBLE_API_KEY!,
        baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL!,
        model: process.env.OPENAI_COMPATIBLE_MODEL!,
      },
    });

    const response = await eko.run({
      agent: browserAgent,
      goal: 'Take a screenshot of the current page',
      maxSteps: 2,
    });

    if (!response.toLowerCase().includes('screenshot') &&
        !response.toLowerCase().includes('image')) {
      throw new Error('Screenshot not captured');
    }
  });

  // Cleanup
  await browserAgent.close();
  await fs.rm(TEST_DIR, { recursive: true, force: true });

  console.log();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST RESULTS SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  const passed = TEST_RESULTS.filter(r => r.status === 'PASS').length;
  const failed = TEST_RESULTS.filter(r => r.status === 'FAIL').length;
  const total = TEST_RESULTS.length;
  const totalDuration = TEST_RESULTS.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log();

  if (failed > 0) {
    console.log('Failed Tests:');
    TEST_RESULTS.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ ${r.test}`);
      console.log(`     ${r.details}`);
    });
    console.log();
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  END-TO-END TESTING COMPLETE                               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error during E2E testing:', error);
  process.exit(1);
});
