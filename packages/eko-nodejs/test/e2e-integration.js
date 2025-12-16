/**
 * Simplified E2E Test for Eko System Tools
 * Tests core functionality without full Eko orchestration
 */

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs/promises');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const TEST_DIR = path.join(process.cwd(), 'e2e-test-results');
const RESULTS = [];

function log(test, status, details, duration) {
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${test}: ${status} (${duration}ms)`);
  if (details) console.log(`   ${details}`);
  RESULTS.push({ test, status, details, duration });
}

async function runTest(name, testFn) {
  const start = Date.now();
  try {
    await testFn();
    log(name, 'PASS', 'Completed successfully', Date.now() - start);
  } catch (error) {
    log(name, 'FAIL', error.message, Date.now() - start);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  EKO SYSTEM TOOLS - DIRECT INTEGRATION TEST                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();

  await fs.mkdir(TEST_DIR, { recursive: true });

  console.log('Environment:');
  console.log(`  LLM: ${process.env.OPENAI_COMPATIBLE_MODEL}`);
  console.log(`  Base URL: ${process.env.OPENAI_COMPATIBLE_BASE_URL}`);
  console.log(`  Test Dir: ${TEST_DIR}`);
  console.log();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PART 1: SYSTEM AGENT TOOLS (Direct API)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  // Import tools
  const { ShellExecTool } = require('../src/tools/shell-exec');
  const { FileWriteTool } = require('../src/tools/file-write');
  const { FileReadTool } = require('../src/tools/file-read');
  const { FileListTool } = require('../src/tools/file-list');
  const { FileDeleteTool } = require('../src/tools/file-delete');
  const SystemAgent = require('../src/system').default;

  // Test 1: ShellExecTool - Echo
  await runTest('Shell Tool: Execute echo', async () => {
    const tool = new ShellExecTool({ enableShellSafety: true });
    const result = await tool.execute({ command: 'echo "E2E Test Running"' });

    if (result.isError) {
      throw new Error('Shell execution failed');
    }
    if (!result.content[0].text.includes('E2E Test Running')) {
      throw new Error('Echo output not found');
    }
  });

  // Test 2: ShellExecTool - Get directory
  await runTest('Shell Tool: Get pwd', async () => {
    const tool = new ShellExecTool({ enableShellSafety: true });
    const result = await tool.execute({ command: 'pwd' });

    if (result.isError) {
      throw new Error('pwd command failed');
    }
    if (!result.content[0].text.includes('exitCode: 0')) {
      throw new Error('Wrong exit code');
    }
  });

  // Test 3: ShellExecTool - Security block
  await runTest('Shell Tool: Block dangerous command', async () => {
    const tool = new ShellExecTool({ enableShellSafety: true });
    const result = await tool.execute({ command: 'rm -rf /' });

    if (!result.isError) {
      throw new Error('Dangerous command was not blocked!');
    }
    if (!result.content[0].text.includes('dangerous')) {
      throw new Error('Security message not found');
    }
  });

  // Test 4: FileWriteTool
  await runTest('File Tool: Write file', async () => {
    const securityOptions = { restrictToWorkPath: true };
    const tool = new FileWriteTool(TEST_DIR, securityOptions);
    const result = await tool.execute({
      filePath: 'e2e-test.txt',
      content: 'E2E Test File Content\nLine 2'
    });

    if (result.isError) {
      throw new Error('File write failed: ' + JSON.stringify(result.content));
    }

    // Verify file exists
    const filePath = path.join(TEST_DIR, 'e2e-test.txt');
    const content = await fs.readFile(filePath, 'utf-8');
    if (!content.includes('E2E Test File Content')) {
      throw new Error('File content mismatch');
    }
  });

  // Test 5: FileReadTool
  await runTest('File Tool: Read file', async () => {
    const securityOptions = { restrictToWorkPath: true };
    const tool = new FileReadTool(TEST_DIR, securityOptions);
    const result = await tool.execute({ filePath: 'e2e-test.txt' });

    if (result.isError) {
      throw new Error('File read failed');
    }
    if (!result.content[0].text.includes('E2E Test File Content')) {
      throw new Error('File content not found');
    }
  });

  // Test 6: FileListTool
  await runTest('File Tool: List directory', async () => {
    const securityOptions = { restrictToWorkPath: true };
    const tool = new FileListTool(TEST_DIR, securityOptions);
    const result = await tool.execute({ directoryPath: '.' });

    if (result.isError) {
      throw new Error('Directory list failed');
    }
    const files = JSON.parse(result.content[0].text);
    const hasTestFile = files.some(f => f.name === 'e2e-test.txt');
    if (!hasTestFile) {
      throw new Error('Test file not found in directory listing');
    }
  });

  // Test 7: FileDeleteTool
  await runTest('File Tool: Delete file', async () => {
    const securityOptions = { restrictToWorkPath: true };
    const tool = new FileDeleteTool(TEST_DIR, securityOptions);
    const result = await tool.execute({ filePath: 'e2e-test.txt' });

    if (result.isError) {
      throw new Error('File delete failed');
    }

    // Verify file is gone
    const filePath = path.join(TEST_DIR, 'e2e-test.txt');
    try {
      await fs.access(filePath);
      throw new Error('File still exists after deletion!');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  });

  // Test 8: Security - Path traversal
  await runTest('Security: Block path traversal', async () => {
    const securityOptions = { restrictToWorkPath: true };
    const tool = new FileReadTool(TEST_DIR, securityOptions);
    const result = await tool.execute({ filePath: '../../../etc/passwd' });

    if (!result.isError) {
      throw new Error('Path traversal was not blocked!');
    }
    if (!JSON.stringify(result.content).includes('Access denied')) {
      throw new Error('Security error message not found');
    }
  });

  // Test 9: SystemAgent Integration
  await runTest('SystemAgent: All tools available', async () => {
    const agent = new SystemAgent({
      workPath: TEST_DIR,
      enableShellSafety: true,
      restrictToWorkPath: true,
    });

    const tools = agent.tools;
    const toolNames = tools.map(t => t.name);

    const expectedTools = ['shell_exec', 'file_read', 'file_write', 'file_delete', 'file_list', 'file_find'];
    for (const expected of expectedTools) {
      if (!toolNames.includes(expected)) {
        throw new Error(`Missing tool: ${expected}`);
      }
    }
  });

  console.log();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PART 2: BROWSER AGENT TESTS (Playwright)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  const BrowserAgent = require('../src/browser').default;
  const playwright = require('playwright');

  let browser;
  let browserAgent;

  try {
    // Test 10: Browser Launch
    await runTest('Browser: Launch Chromium', async () => {
      browser = await playwright.chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto('https://example.com');
      const title = await page.title();
      if (!title) throw new Error('Failed to load page');
    });

    // Test 11: Keyboard - Type text
    await runTest('Keyboard: Type text', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setContent(`
        <input type="text" id="test-input" />
        <script>document.getElementById('test-input').focus();</script>
      `);
      await page.waitForTimeout(100);
      await page.keyboard.type('E2E Keyboard Test');
      const value = await page.inputValue('#test-input');
      if (value !== 'E2E Keyboard Test') {
        throw new Error(`Typed text mismatch: ${value}`);
      }
    });

    // Test 12: Keyboard - Press Enter
    await runTest('Keyboard: Press Enter key', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setContent(`
        <div id="result">Not pressed</div>
        <script>
          document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              document.getElementById('result').textContent = 'Enter pressed';
            }
          });
        </script>
      `);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
      const text = await page.textContent('#result');
      if (text !== 'Enter pressed') {
        throw new Error('Enter key not detected');
      }
    });

    // Test 13: Keyboard - Arrow keys
    await runTest('Keyboard: Press arrow keys', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setContent(`
        <div id="result">None</div>
        <script>
          document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
              document.getElementById('result').textContent = 'ArrowDown';
            }
          });
        </script>
      `);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(100);
      const text = await page.textContent('#result');
      if (text !== 'ArrowDown') {
        throw new Error('Arrow key not detected');
      }
    });

    // Test 14: Keyboard - Escape key
    await runTest('Keyboard: Press Escape key', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setContent(`
        <div id="result">None</div>
        <script>
          document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
              document.getElementById('result').textContent = 'Escape pressed';
            }
          });
        </script>
      `);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      const text = await page.textContent('#result');
      if (text !== 'Escape pressed') {
        throw new Error('Escape key not detected');
      }
    });

    // Test 15: Keyboard - Function keys
    await runTest('Keyboard: Press F5 key', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setContent(`
        <div id="result">None</div>
        <script>
          document.addEventListener('keydown', (e) => {
            if (e.key === 'F5') {
              e.preventDefault();
              document.getElementById('result').textContent = 'F5 pressed';
            }
          });
        </script>
      `);
      await page.keyboard.press('F5');
      await page.waitForTimeout(100);
      const text = await page.textContent('#result');
      if (text !== 'F5 pressed') {
        throw new Error('F5 key not detected');
      }
    });

    // Test 16: Keyboard - Hotkey combination
    await runTest('Keyboard: Hotkey Ctrl+A', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setContent(`
        <textarea id="test-area">Select this text</textarea>
        <script>document.getElementById('test-area').focus();</script>
      `);
      await page.waitForTimeout(100);

      // Simulate Ctrl+A
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');

      const selection = await page.evaluate(() => {
        const textarea = document.getElementById('test-area');
        return textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
      });

      if (selection !== 'Select this text') {
        throw new Error('Ctrl+A did not select all text');
      }
    });

  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Cleanup
  await fs.rm(TEST_DIR, { recursive: true, force: true });

  console.log();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST RESULTS SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  const passed = RESULTS.filter(r => r.status === 'PASS').length;
  const failed = RESULTS.filter(r => r.status === 'FAIL').length;
  const total = RESULTS.length;
  const totalDuration = RESULTS.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log();

  if (failed > 0) {
    console.log('Failed Tests:');
    RESULTS.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ ${r.test}`);
      console.log(`     ${r.details}`);
    });
    console.log();
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  INTEGRATION TESTING COMPLETE                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
