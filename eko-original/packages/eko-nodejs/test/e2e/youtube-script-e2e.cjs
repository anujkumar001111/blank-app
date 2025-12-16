/**
 * Real-World E2E Test: YouTube Channel Script Writer
 *
 * This test:
 * 1. Launches a VISIBLE Chromium browser FIRST
 * 2. Navigates to a free online text editor (no signup required)
 * 3. Uses LLM to generate a comprehensive YouTube channel growth script
 * 4. Types the entire script into the editor
 * 5. Takes screenshots throughout the process
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

// LLM helper with larger token limit for script generation
async function askLLM(prompt, systemPrompt = "", maxTokens = 4000) {
  const url = new URL(`${BASE_URL}/v1/chat/completions`);
  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const postData = JSON.stringify({
    model: MODEL,
    messages,
    max_tokens: maxTokens,
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
  console.log("🎬 YOUTUBE CHANNEL SCRIPT WRITER - REAL-WORLD E2E TEST");
  console.log("═".repeat(70));
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`🤖 LLM: ${MODEL} @ ${BASE_URL}`);
  console.log("═".repeat(70) + "\n");

  await fs.mkdir(TEST_DIR, { recursive: true });

  let browser;
  try {
    // ========================================================================
    // PHASE 1: Launch Visible Browser FIRST
    // ========================================================================
    console.log("═".repeat(60));
    console.log("PHASE 1: Launch Visible Browser");
    console.log("═".repeat(60));

    console.log("🌐 Launching Chromium (VISIBLE mode)...");
    browser = await chromium.launch({
      headless: false,
      slowMo: 50,
      args: ["--no-sandbox", "--window-size=1400,900"],
    });

    const context = await browser.newContext({
      viewport: { width: 1400, height: 850 },
    });
    const page = await context.newPage();
    console.log("✅ Browser launched successfully!\n");

    // ========================================================================
    // PHASE 2: Navigate to Free Online Text Editor
    // ========================================================================
    console.log("═".repeat(60));
    console.log("PHASE 2: Navigate to Free Online Text Editor");
    console.log("═".repeat(60));

    // Using textpad.org - a simple, free, no-signup text editor
    const editorUrl = "https://textpad.surge.sh/";
    console.log(`🌐 Navigating to ${editorUrl}...`);

    try {
      await page.goto(editorUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    } catch (e) {
      console.log("⚠️  First editor failed, trying alternative...");
      // Fallback to another simple editor
      await page.goto("https://www.rapidtables.com/tools/notepad.html", {
        waitUntil: "domcontentloaded",
        timeout: 15000
      });
    }

    await page.waitForTimeout(2000);

    // Take initial screenshot
    const initialScreenshot = path.join(TEST_DIR, "editor-initial.png");
    await page.screenshot({ path: initialScreenshot });
    console.log(`📸 Initial screenshot: ${initialScreenshot}`);

    // ========================================================================
    // PHASE 3: Find and Focus the Text Editor
    // ========================================================================
    console.log("\n" + "═".repeat(60));
    console.log("PHASE 3: Locate and Focus Text Editor");
    console.log("═".repeat(60));

    // Try multiple selectors for the text area
    let editor = null;
    const editorSelectors = [
      'textarea',
      '#editor',
      '.editor',
      '[contenteditable="true"]',
      'div[role="textbox"]',
      '.CodeMirror textarea',
      '#text-input',
    ];

    for (const selector of editorSelectors) {
      try {
        editor = await page.$(selector);
        if (editor) {
          console.log(`✅ Found editor with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!editor) {
      console.log("⚠️  Trying to find any textarea...");
      await page.waitForSelector('textarea', { timeout: 5000 });
      editor = await page.$('textarea');
    }

    if (!editor) {
      throw new Error("Could not find a text editor");
    }

    // Click to focus
    await editor.click();
    await page.waitForTimeout(500);

    // Clear any existing content
    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.down(modifier);
    await page.keyboard.press("a");
    await page.keyboard.up(modifier);
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(300);

    console.log("✅ Editor focused and cleared!\n");

    // ========================================================================
    // PHASE 4: Generate the YouTube Script via LLM (while browser is open)
    // ========================================================================
    console.log("═".repeat(60));
    console.log("PHASE 4: Generating YouTube Channel Script via LLM");
    console.log("═".repeat(60));

    console.log("🤖 Asking LLM to write a comprehensive YouTube growth script...");
    console.log("   (Watch the browser - we'll type it in once generated)\n");

    const scriptPrompt = `Write a comprehensive guide titled "HOW TO BUILD A SUCCESSFUL YOUTUBE CHANNEL: ZERO TO MILLION JOURNEY"

Include these sections with practical tips:

1. INTRODUCTION - The Dream & Reality
2. PHASE 1: THE FOUNDATION (0-1,000 Subscribers)
   - Niche Selection
   - Channel Setup & Branding
   - Equipment Basics
   - Content Strategy
3. PHASE 2: BUILDING MOMENTUM (1,000-10,000 Subscribers)
   - Consistency & Scheduling
   - SEO & Discoverability
   - Thumbnail & Title Psychology
4. PHASE 3: SCALING UP (10,000-100,000 Subscribers)
   - Analytics Deep Dive
   - Collaboration Strategies
   - Monetization
5. PHASE 4: THE MILLION MILESTONE
   - Brand Deals
   - Diversification
   - Community Building
6. KEY LESSONS & MISTAKES TO AVOID
7. CONCLUSION

Make it practical and actionable for 2024-2025. Use bullet points.`;

    const systemPrompt = `You are an expert YouTube consultant. Write in an engaging, practical tone with bullet points and clear formatting.`;

    const youtubeScript = await askLLM(scriptPrompt, systemPrompt, 3000);

    console.log("✅ Script generated successfully!");
    console.log(`📝 Script length: ${youtubeScript.length} characters\n`);

    // Save script to file for reference
    const scriptFile = path.join(TEST_DIR, "youtube-script.txt");
    await fs.writeFile(scriptFile, youtubeScript);
    console.log(`💾 Script saved to: ${scriptFile}\n`);

    // ========================================================================
    // PHASE 5: Type the YouTube Script
    // ========================================================================
    console.log("═".repeat(60));
    console.log("PHASE 5: Typing YouTube Channel Script into Editor");
    console.log("═".repeat(60));

    // Add a title header
    const fullContent = `════════════════════════════════════════════════════
HOW TO BUILD A SUCCESSFUL YOUTUBE CHANNEL
ZERO TO MILLION JOURNEY
Generated by Eko AI - ${new Date().toLocaleDateString()}
════════════════════════════════════════════════════

${youtubeScript}

════════════════════════════════════════════════════
END OF SCRIPT - Generated using ${MODEL}
════════════════════════════════════════════════════`;

    console.log(`⌨️  Typing script (${fullContent.length} characters)...`);
    console.log("   Watch the browser - you'll see the text appearing!\n");

    // Type in chunks for visibility
    const chunkSize = 100;
    let typedChars = 0;

    for (let i = 0; i < fullContent.length; i += chunkSize) {
      const chunk = fullContent.slice(i, Math.min(i + chunkSize, fullContent.length));
      await page.keyboard.type(chunk, { delay: 3 });
      typedChars += chunk.length;

      // Progress update
      if (typedChars % 500 < chunkSize) {
        const progress = Math.round((typedChars / fullContent.length) * 100);
        console.log(`   Progress: ${progress}% (${typedChars}/${fullContent.length} chars)`);
      }
    }

    console.log("\n✅ Script typed successfully!\n");

    // ========================================================================
    // PHASE 6: Final Screenshots
    // ========================================================================
    console.log("═".repeat(60));
    console.log("PHASE 6: Final Screenshots");
    console.log("═".repeat(60));

    // Scroll to top
    await page.keyboard.down(modifier);
    await page.keyboard.press("Home");
    await page.keyboard.up(modifier);
    await page.waitForTimeout(500);

    const topScreenshot = path.join(TEST_DIR, "script-top.png");
    await page.screenshot({ path: topScreenshot });
    console.log(`📸 Top of script: ${topScreenshot}`);

    // Scroll down a bit
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("PageDown");
      await page.waitForTimeout(100);
    }

    const middleScreenshot = path.join(TEST_DIR, "script-middle.png");
    await page.screenshot({ path: middleScreenshot });
    console.log(`📸 Middle of script: ${middleScreenshot}`);

    // Scroll to end
    await page.keyboard.down(modifier);
    await page.keyboard.press("End");
    await page.keyboard.up(modifier);
    await page.waitForTimeout(500);

    const endScreenshot = path.join(TEST_DIR, "script-end.png");
    await page.screenshot({ path: endScreenshot });
    console.log(`📸 End of script: ${endScreenshot}`);

    // ========================================================================
    // Done - Keep browser open
    // ========================================================================
    console.log("\n" + "═".repeat(60));
    console.log("✅ ALL PHASES COMPLETED SUCCESSFULLY!");
    console.log("═".repeat(60));
    console.log("\n🎉 Browser will stay open for 15 seconds for you to review...\n");

    await page.waitForTimeout(15000);

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
  console.log("🎬 YOUTUBE SCRIPT E2E TEST COMPLETED!");
  console.log("═".repeat(70));
  console.log(`\n📁 Test artifacts saved to: ${TEST_DIR}\n`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
