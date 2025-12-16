/**
 * Real-World E2E Test
 * Launches visible browser, uses LLM to perform actual tasks
 */

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs/promises");
const http = require("http");

// Load env
require("dotenv").config({ path: path.join(__dirname, "../../../../.env") });

const BASE_URL = process.env.OPENAI_COMPATIBLE_BASE_URL || "http://143.198.174.251:8317";
const API_KEY = process.env.OPENAI_COMPATIBLE_API_KEY || "sk-anything";
const MODEL = process.env.OPENAI_COMPATIBLE_MODEL || "gemini-claude-sonnet-4-5";

const TEST_DIR = path.join(process.cwd(), "real-e2e-test");

// LLM helper
async function askLLM(prompt, systemPrompt = "") {
  const url = new URL(`${BASE_URL}/v1/chat/completions`);
  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const postData = JSON.stringify({
    model: MODEL,
    messages,
    max_tokens: 500,
  });

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
          "Content-Length": Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            resolve(json.choices?.[0]?.message?.content || "");
          } catch (e) {
            reject(new Error(`LLM parse error: ${data}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log("\n" + "═".repeat(70));
  console.log("🚀 EKO REAL-WORLD E2E TEST");
  console.log("═".repeat(70));
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`🤖 LLM: ${MODEL} @ ${BASE_URL}`);
  console.log("═".repeat(70) + "\n");

  await fs.mkdir(TEST_DIR, { recursive: true });

  let browser;
  try {
    // ========================================================================
    // PHASE 1: LLM Connection Test
    // ========================================================================
    console.log("═".repeat(60));
    console.log("PHASE 1: LLM Connection");
    console.log("═".repeat(60));

    console.log("🤖 Asking LLM a simple question...");
    const llmResponse = await askLLM("What is 2+2? Answer with just the number.");
    console.log(`✅ LLM Response: "${llmResponse.trim()}"`);

    // ========================================================================
    // PHASE 2: Browser Launch (VISIBLE)
    // ========================================================================
    console.log("\n" + "═".repeat(60));
    console.log("PHASE 2: Launch Visible Browser");
    console.log("═".repeat(60));

    console.log("🌐 Launching Chromium (VISIBLE mode)...");
    browser = await chromium.launch({
      headless: false, // VISIBLE browser
      slowMo: 100, // Slow down for visibility
      args: ["--no-sandbox", "--window-size=1280,800"],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    console.log("✅ Browser launched successfully");

    // ========================================================================
    // PHASE 3: Navigate to Real Website
    // ========================================================================
    console.log("\n" + "═".repeat(60));
    console.log("PHASE 3: Navigate to Real Website");
    console.log("═".repeat(60));

    console.log("🌐 Navigating to https://example.com...");
    await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    const title = await page.title();
    console.log(`✅ Page loaded: "${title}"`);

    // Take screenshot
    const screenshotPath = path.join(TEST_DIR, "screenshot-example.png");
    await page.screenshot({ path: screenshotPath });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);

    // ========================================================================
    // PHASE 4: Google Search with Keyboard
    // ========================================================================
    console.log("\n" + "═".repeat(60));
    console.log("PHASE 4: Google Search with Keyboard Input");
    console.log("═".repeat(60));

    console.log("🌐 Navigating to Google...");
    await page.goto("https://www.google.com", { waitUntil: "domcontentloaded" });

    // Handle cookie consent if present
    try {
      const acceptButton = await page.$('button:has-text("Accept all")');
      if (acceptButton) {
        await acceptButton.click();
        console.log("   Accepted cookie consent");
        await page.waitForTimeout(500);
      }
    } catch (e) {
      // No consent dialog
    }

    // Find search input
    const searchInput = await page.$('input[name="q"], textarea[name="q"]');
    if (searchInput) {
      console.log("⌨️  Typing search query: 'Eko AI Framework'");
      await searchInput.click();
      await page.keyboard.type("Eko AI Framework", { delay: 50 });
      await page.waitForTimeout(500);

      // Take screenshot of typed text
      const searchScreenshot = path.join(TEST_DIR, "screenshot-google-search.png");
      await page.screenshot({ path: searchScreenshot });
      console.log(`📸 Screenshot saved: ${searchScreenshot}`);

      // Press Enter to search
      console.log("⌨️  Pressing Enter to search...");
      await page.keyboard.press("Enter");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1000);

      const resultsScreenshot = path.join(TEST_DIR, "screenshot-search-results.png");
      await page.screenshot({ path: resultsScreenshot });
      console.log(`📸 Search results screenshot: ${resultsScreenshot}`);
      console.log("✅ Google search completed successfully");
    } else {
      console.log("⚠️  Could not find Google search input");
    }

    // ========================================================================
    // PHASE 5: Keyboard Hotkeys Demo
    // ========================================================================
    console.log("\n" + "═".repeat(60));
    console.log("PHASE 5: Keyboard Hotkeys Demo");
    console.log("═".repeat(60));

    // Create a demo page
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Eko Keyboard Test</title>
        <style>
          body { font-family: Arial; padding: 20px; background: #1a1a2e; color: #fff; }
          h1 { color: #00d9ff; }
          #demo { padding: 20px; background: #16213e; border-radius: 8px; margin: 20px 0; }
          textarea { width: 100%; height: 100px; font-size: 16px; padding: 10px; }
          #keylog { background: #0f3460; padding: 15px; border-radius: 8px; font-family: monospace; min-height: 100px; }
          .key { display: inline-block; background: #e94560; padding: 5px 10px; margin: 2px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>🎹 Eko Keyboard Test</h1>
        <div id="demo">
          <h3>Type in this box:</h3>
          <textarea id="input" placeholder="Start typing..."></textarea>
        </div>
        <div>
          <h3>Key Events:</h3>
          <div id="keylog"></div>
        </div>
        <script>
          const log = document.getElementById('keylog');
          const input = document.getElementById('input');
          input.focus();

          document.addEventListener('keydown', (e) => {
            const keyInfo = e.key + (e.ctrlKey ? ' [Ctrl]' : '') + (e.metaKey ? ' [Meta]' : '') + (e.shiftKey ? ' [Shift]' : '');
            const span = document.createElement('span');
            span.className = 'key';
            span.textContent = keyInfo;
            log.appendChild(span);
            log.appendChild(document.createTextNode(' '));
          });
        </script>
      </body>
      </html>
    `);

    console.log("⌨️  Testing keyboard operations...");
    await page.waitForTimeout(500);

    // Type text
    console.log("   Typing: 'Hello from Eko!'");
    await page.keyboard.type("Hello from Eko!", { delay: 30 });
    await page.waitForTimeout(300);

    // Test hotkey - Select All
    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    console.log(`   Pressing ${modifier}+A (Select All)...`);
    await page.keyboard.down(modifier);
    await page.keyboard.press("a");
    await page.keyboard.up(modifier);
    await page.waitForTimeout(300);

    // Test special keys
    const specialKeys = ["Escape", "ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "F5", "Home", "End"];
    console.log(`   Testing special keys: ${specialKeys.join(", ")}`);
    for (const key of specialKeys) {
      await page.keyboard.press(key);
      await page.waitForTimeout(100);
    }

    const keyboardScreenshot = path.join(TEST_DIR, "screenshot-keyboard-demo.png");
    await page.screenshot({ path: keyboardScreenshot });
    console.log(`📸 Keyboard demo screenshot: ${keyboardScreenshot}`);
    console.log("✅ Keyboard operations completed");

    // ========================================================================
    // PHASE 6: File Operations
    // ========================================================================
    console.log("\n" + "═".repeat(60));
    console.log("PHASE 6: File Operations");
    console.log("═".repeat(60));

    // Create a file
    const testFile = path.join(TEST_DIR, "eko-test-file.txt");
    const content = `Eko E2E Test File
Created: ${new Date().toISOString()}
Browser: Chromium
LLM: ${MODEL}

This file was created during the real-world E2E test.
`;
    await fs.writeFile(testFile, content);
    console.log(`✅ File created: ${testFile}`);

    // Read it back
    const readContent = await fs.readFile(testFile, "utf-8");
    console.log(`✅ File read: ${readContent.split("\n")[0]}...`);

    // List directory
    const files = await fs.readdir(TEST_DIR);
    console.log(`✅ Directory listing: ${files.join(", ")}`);

    // ========================================================================
    // PHASE 7: Shell Execution
    // ========================================================================
    console.log("\n" + "═".repeat(60));
    console.log("PHASE 7: Shell Execution");
    console.log("═".repeat(60));

    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);

    console.log("🐚 Running: echo 'E2E Test Complete!'");
    const { stdout: echoOut } = await execAsync("echo 'E2E Test Complete!'");
    console.log(`   Output: ${echoOut.trim()}`);

    console.log("🐚 Running: date");
    const { stdout: dateOut } = await execAsync("date");
    console.log(`   Output: ${dateOut.trim()}`);

    console.log("🐚 Running: whoami");
    const { stdout: whoamiOut } = await execAsync("whoami");
    console.log(`   Output: ${whoamiOut.trim()}`);

    // ========================================================================
    // PHASE 8: LLM-Driven Task
    // ========================================================================
    console.log("\n" + "═".repeat(60));
    console.log("PHASE 8: LLM-Driven Task");
    console.log("═".repeat(60));

    console.log("🤖 Asking LLM to describe what we did...");
    const summary = await askLLM(
      `We just completed an E2E test of the Eko framework. We:
1. Launched a Chromium browser
2. Navigated to example.com and Google
3. Typed 'Eko AI Framework' in Google search
4. Pressed Enter to search
5. Tested keyboard hotkeys (Ctrl+A, Escape, Arrow keys, F5, Home, End)
6. Created and read files
7. Executed shell commands

Please provide a brief 2-sentence summary of this test.`,
      "You are a helpful assistant that provides concise summaries."
    );
    console.log(`✅ LLM Summary: "${summary.trim()}"`);

    // ========================================================================
    // FINAL: Keep browser open for viewing
    // ========================================================================
    console.log("\n" + "═".repeat(60));
    console.log("✅ ALL PHASES COMPLETED SUCCESSFULLY");
    console.log("═".repeat(60));
    console.log("\n🎉 The browser will stay open for 5 seconds for you to see...\n");

    // Show final page
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Eko E2E Test Complete!</title>
        <style>
          body {
            font-family: Arial;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #fff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
          }
          .container { text-align: center; padding: 40px; }
          h1 { font-size: 48px; color: #00d9ff; margin-bottom: 20px; }
          .checkmark { font-size: 100px; margin-bottom: 20px; }
          .stats {
            background: rgba(255,255,255,0.1);
            padding: 20px 40px;
            border-radius: 12px;
            margin-top: 20px;
          }
          .stat { margin: 10px 0; font-size: 18px; }
          .highlight { color: #00d9ff; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="checkmark">✅</div>
          <h1>Eko E2E Test Complete!</h1>
          <div class="stats">
            <div class="stat">🌐 Browser: <span class="highlight">Chromium</span></div>
            <div class="stat">🤖 LLM: <span class="highlight">${MODEL}</span></div>
            <div class="stat">⌨️ Keyboard Tests: <span class="highlight">8 keys tested</span></div>
            <div class="stat">📁 Files Created: <span class="highlight">${files.length}</span></div>
            <div class="stat">🐚 Shell Commands: <span class="highlight">3 executed</span></div>
          </div>
        </div>
      </body>
      </html>
    `);

    const finalScreenshot = path.join(TEST_DIR, "screenshot-final.png");
    await page.screenshot({ path: finalScreenshot });
    console.log(`📸 Final screenshot: ${finalScreenshot}`);

    await page.waitForTimeout(5000);

  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    throw error;
  } finally {
    if (browser) {
      console.log("\n🔒 Closing browser...");
      await browser.close();
    }
  }

  console.log("\n" + "═".repeat(70));
  console.log("🎉 REAL-WORLD E2E TEST COMPLETED SUCCESSFULLY!");
  console.log("═".repeat(70));
  console.log(`\n📁 Test artifacts saved to: ${TEST_DIR}\n`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
