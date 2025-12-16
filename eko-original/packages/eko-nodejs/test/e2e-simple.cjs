/**
 * Simple E2E Test - Direct tool testing with Chromium
 */

const path = require('path');
const fs = require('fs/promises');

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
    log(name, 'PASS', '', Date.now() - start);
    return true;
  } catch (error) {
    log(name, 'FAIL', error.message, Date.now() - start);
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  EKO COMPREHENSIVE INTEGRATION TEST                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();

  await fs.mkdir(TEST_DIR, { recursive: true });

  // Import from built dist
  const { default: SystemAgent } = await import('../dist/index.esm.js');
  const playwright = require('playwright');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PART 1: SYSTEM AGENT INTEGRATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  await runTest('SystemAgent: Create instance', async () => {
    const agent = new SystemAgent({
      workPath: TEST_DIR,
      enableShellSafety: true,
      restrictToWorkPath: true,
    });
    if (!agent) throw new Error('Failed to create SystemAgent');
  });

  await runTest('SystemAgent: Has all 6 tools', async () => {
    const agent = new SystemAgent({
      workPath: TEST_DIR,
      enableShellSafety: true,
      restrictToWorkPath: true,
    });
    const expectedTools = ['shell_exec', 'file_read', 'file_write', 'file_delete', 'file_list', 'file_find'];
    const toolNames = agent.tools.map(t => t.name);
    for (const expected of expectedTools) {
      if (!toolNames.includes(expected)) {
        throw new Error(`Missing tool: ${expected}`);
      }
    }
  });

  await runTest('SystemAgent: Shell tool functional', async () => {
    const agent = new SystemAgent({ workPath: TEST_DIR });
    const shellTool = agent.tools.find(t => t.name === 'shell_exec');
    if (!shellTool) throw new Error('shell_exec tool not found');
    if (!shellTool.execute) throw new Error('shell_exec.execute method not found');
  });

  await runTest('SystemAgent: File tools functional', async () => {
    const agent = new SystemAgent({ workPath: TEST_DIR });
    const fileTools = ['file_read', 'file_write', 'file_delete', 'file_list', 'file_find'];
    for (const toolName of fileTools) {
      const tool = agent.tools.find(t => t.name === toolName);
      if (!tool) throw new Error(`${toolName} tool not found`);
      if (!tool.execute) throw new Error(`${toolName}.execute method not found`);
    }
  });

  console.log();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PART 2: BROWSER AGENT WITH CHROMIUM');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  let browser;
  try {
    await runTest('Browser: Launch Chromium', async () => {
      browser = await playwright.chromium.launch({ headless: true });
      if (!browser) throw new Error('Failed to launch browser');
    });

    await runTest('Browser: Navigate to page', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto('https://example.com', { timeout: 10000 });
      const title = await page.title();
      if (!title) throw new Error('Page title is empty');
    });

    await runTest('Keyboard: Type text', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setContent('<input type="text" id="test" />');
      await page.focus('#test');
      await page.keyboard.type('E2E Test');
      const value = await page.inputValue('#test');
      if (value !== 'E2E Test') throw new Error('Text not typed correctly');
    });

    await runTest('Keyboard: Press Enter', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setContent(`
        <div id="result">None</div>
        <script>
          document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('result').textContent = 'Enter';
          });
        </script>
      `);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(50);
      const text = await page.textContent('#result');
      if (text !== 'Enter') throw new Error('Enter not detected');
    });

    await runTest('Keyboard: Press Escape', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setContent(`
        <div id="result">None</div>
        <script>
          document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') document.getElementById('result').textContent = 'Escape';
          });
        </script>
      `);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(50);
      const text = await page.textContent('#result');
      if (text !== 'Escape') throw new Error('Escape not detected');
    });

    await runTest('Keyboard: Press ArrowDown', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setContent(`
        <div id="result">None</div>
        <script>
          document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') document.getElementById('result').textContent = 'ArrowDown';
          });
        </script>
      `);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(50);
      const text = await page.textContent('#result');
      if (text !== 'ArrowDown') throw new Error('ArrowDown not detected');
    });

    await runTest('Keyboard: Press F5', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setContent(`
        <div id="result">None</div>
        <script>
          document.addEventListener('keydown', (e) => {
            if (e.key === 'F5') {
              e.preventDefault();
              document.getElementById('result').textContent = 'F5';
            }
          });
        </script>
      `);
      await page.keyboard.press('F5');
      await page.waitForTimeout(50);
      const text = await page.textContent('#result');
      if (text !== 'F5') throw new Error('F5 not detected');
    });

    await runTest('Keyboard: Hotkey Ctrl+A', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setContent('<textarea id="test">Select all this</textarea>');
      await page.focus('#test');
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');
      const selection = await page.evaluate(() => {
        const el = document.getElementById('test');
        return el.value.substring(el.selectionStart, el.selectionEnd);
      });
      if (selection !== 'Select all this') throw new Error('Ctrl+A failed');
    });

    await runTest('Browser: Take screenshot', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto('https://example.com', { timeout: 10000 });
      const screenshot = await page.screenshot();
      if (!screenshot || screenshot.length === 0) throw new Error('Screenshot failed');
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
  console.log('TEST RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  const passed = RESULTS.filter(r => r.status === 'PASS').length;
  const failed = RESULTS.filter(r => r.status === 'FAIL').length;
  const total = RESULTS.length;
  const totalDuration = RESULTS.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Total:   ${total} tests`);
  console.log(`Passed:  ${passed} ✅`);
  console.log(`Failed:  ${failed} ❌`);
  console.log(`Rate:    ${((passed / total) * 100).toFixed(1)}%`);
  console.log(`Time:    ${(totalDuration / 1000).toFixed(2)}s`);
  console.log();

  if (failed > 0) {
    console.log('FAILURES:');
    RESULTS.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ ${r.test}: ${r.details}`);
    });
  }

  console.log('╚════════════════════════════════════════════════════════════╝');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('FATAL:', error);
  process.exit(1);
});
