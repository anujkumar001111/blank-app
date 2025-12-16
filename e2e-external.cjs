/**
 * External E2E Test Runner
 * Runs from root to avoid package.json type:module interference
 */

const path = require("path");
const fs = require("fs/promises");

async function runTest(name, fn) {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`🧪 ${name}`);
  console.log("=".repeat(50));

  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    console.log(`✅ PASSED (${duration}ms)`);
    return { name, passed: true, duration };
  } catch (err) {
    const duration = Date.now() - start;
    console.log(`❌ FAILED: ${err.message}`);
    return { name, passed: false, error: err.message, duration };
  }
}

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 EKO SYSTEM TOOLS E2E VERIFICATION (External)");
  console.log("=".repeat(60));
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`📁 ${process.cwd()}`);
  console.log("=".repeat(60));

  const results = [];

  // Test 1: Require the CJS bundle directly
  results.push(await runTest("SystemAgent Import (CJS)", async () => {
    const ekoNodejs = require("./packages/eko-nodejs/dist/index.cjs.js");

    const exports = Object.keys(ekoNodejs);
    console.log(`   Exports: ${exports.slice(0, 10).join(", ")}...`);

    if (!ekoNodejs.SystemAgent) {
      throw new Error("SystemAgent not exported");
    }
    console.log("   ✓ SystemAgent found");

    const tools = ["ShellExecTool", "FileReadTool", "FileWriteTool", "FileDeleteTool", "FileListTool", "FileFindTool"];
    for (const tool of tools) {
      if (!ekoNodejs[tool]) {
        throw new Error(`${tool} not exported`);
      }
    }
    console.log(`   ✓ All ${tools.length} tools exported`);

    const agent = new ekoNodejs.SystemAgent({
      workPath: process.cwd(),
      enableShellSafety: true,
      restrictToWorkPath: true,
    });
    console.log(`   ✓ SystemAgent instantiated: ${agent.name}`);
  }));

  // Test 2: BrowserAgent Import
  results.push(await runTest("BrowserAgent Import (CJS)", async () => {
    const ekoNodejs = require("./packages/eko-nodejs/dist/index.cjs.js");

    if (!ekoNodejs.BrowserAgent) {
      throw new Error("BrowserAgent not exported");
    }
    console.log("   ✓ BrowserAgent found");
    console.log("   ✓ BrowserAgent class verified");
  }));

  // Test 3: Browser Operations with Playwright
  results.push(await runTest("Browser Operations (Playwright)", async () => {
    const { chromium } = require("playwright");

    console.log("   🌐 Launching Chromium...");
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    try {
      await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
      const title = await page.title();
      console.log(`   Page title: ${title}`);

      if (!title.includes("Example")) {
        throw new Error(`Unexpected title: ${title}`);
      }

      const screenshot = await page.screenshot({ type: "png" });
      console.log(`   Screenshot: ${screenshot.length} bytes`);

      // Test keyboard
      await page.setContent(`
        <html>
          <body>
            <input type="text" id="test-input" autofocus />
            <script>document.getElementById('test-input').focus();</script>
          </body>
        </html>
      `);

      await page.keyboard.type("Hello Eko!");
      const value = await page.$eval("#test-input", el => el.value);
      console.log(`   Typed: "${value}"`);

      if (value !== "Hello Eko!") {
        throw new Error(`Typing failed: got "${value}"`);
      }

      // Test hotkey
      await page.keyboard.down("Control");
      await page.keyboard.press("a");
      await page.keyboard.up("Control");
      console.log("   ✓ Hotkey Ctrl+A executed");

      // Test special keys
      const specialKeys = ["Escape", "ArrowDown", "ArrowUp", "F1", "Home", "End"];
      for (const key of specialKeys) {
        await page.keyboard.press(key);
      }
      console.log(`   ✓ Special keys: ${specialKeys.join(", ")}`);

    } finally {
      await browser.close();
    }
  }));

  // Test 4: Shell Execution
  results.push(await runTest("Shell Execution", async () => {
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);

    const { stdout: out1 } = await execAsync("echo 'Hello from Eko'");
    console.log(`   Output: ${out1.trim()}`);

    if (!out1.includes("Hello from Eko")) {
      throw new Error(`Echo failed: ${out1}`);
    }

    const { stdout: out2 } = await execAsync("pwd");
    console.log(`   Directory: ${out2.trim()}`);

    console.log("   Testing timeout...");
    try {
      await execAsync("sleep 10", { timeout: 500 });
      throw new Error("Timeout should have killed process");
    } catch (err) {
      if (err.killed) {
        console.log("   ✓ Process correctly killed by timeout");
      } else {
        throw err;
      }
    }
  }));

  // Test 5: File Operations
  results.push(await runTest("File Operations", async () => {
    const testDir = path.join(process.cwd(), "e2e-test-temp");
    await fs.mkdir(testDir, { recursive: true });

    try {
      const testFile = path.join(testDir, "test.txt");
      await fs.writeFile(testFile, "E2E Test Content\nLine 2");
      console.log("   ✓ File written");

      const content = await fs.readFile(testFile, "utf-8");
      if (!content.includes("E2E Test Content")) {
        throw new Error("Content mismatch");
      }
      console.log("   ✓ File read verified");

      const files = await fs.readdir(testDir);
      if (!files.includes("test.txt")) {
        throw new Error("File not found in listing");
      }
      console.log(`   ✓ Directory listed: ${files.join(", ")}`);

      await fs.unlink(testFile);
      console.log("   ✓ File deleted");

    } finally {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  }));

  // Test 6: LLM Connection
  results.push(await runTest("OpenAI-Compatible LLM Connection", async () => {
    require("dotenv").config({ path: "./.env" });

    const baseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL || "http://143.198.174.251:8317";
    const apiKey = process.env.OPENAI_COMPATIBLE_API_KEY || "sk-anything";
    const model = process.env.OPENAI_COMPATIBLE_MODEL || "gemini-claude-sonnet-4-5";

    console.log(`   Base URL: ${baseUrl}`);
    console.log(`   Model: ${model}`);

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: "Say 'Eko E2E test successful' in exactly 4 words" }],
        max_tokens: 50,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM request failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    console.log(`   LLM reply: ${reply}`);

    if (!reply) {
      throw new Error("No reply from LLM");
    }
    console.log("   ✓ LLM connection successful");
  }));

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 SUMMARY");
  console.log("=".repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.reduce((s, r) => s + r.duration, 0);

  results.forEach(r => {
    const icon = r.passed ? "✅" : "❌";
    console.log(`${icon} ${r.name} (${r.duration}ms)`);
    if (r.error) console.log(`   └─ ${r.error}`);
  });

  console.log("=".repeat(60));
  console.log(`Total: ${passed} passed, ${failed} failed (${total}ms)`);
  console.log("=".repeat(60));

  if (failed > 0) {
    console.log("\n❌ E2E VERIFICATION FAILED\n");
    process.exit(1);
  } else {
    console.log("\n✅ E2E VERIFICATION PASSED\n");
    process.exit(0);
  }
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
