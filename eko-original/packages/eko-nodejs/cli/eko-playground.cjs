#!/usr/bin/env node
/**
 * Eko Playground CLI - CommonJS Entry Point
 *
 * This file provides a standalone CLI that works immediately without needing
 * to build the TypeScript source. It uses native Node.js capabilities.
 *
 * Usage:
 *   node cli/eko-playground.cjs [options] [task]
 *   node cli/eko-playground.cjs -f <prompt-file>
 *   node cli/eko-playground.cjs --interactive
 */

const path = require("path");
const fs = require("fs");
const readline = require("readline");

// Load dotenv from multiple possible locations
function loadEnv() {
  const possiblePaths = [
    path.join(__dirname, ".env"),                           // cli/.env
    path.join(__dirname, "../.env"),                        // eko-nodejs/.env
    path.join(__dirname, "../../.env"),                     // packages/.env
    path.join(__dirname, "../../../.env"),                  // eko-original/.env
    path.join(__dirname, "../../../../.env"),               // Eko/.env
    path.join(process.cwd(), ".env"),                       // current working dir
  ];

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      try {
        require("dotenv").config({ path: envPath });
        console.log(`📁 Loaded .env from: ${envPath}`);
        return true;
      } catch (e) {
        // dotenv not available, try manual parsing
        try {
          const envContent = fs.readFileSync(envPath, "utf-8");
          envContent.split("\n").forEach((line) => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith("#")) {
              const eqIndex = trimmed.indexOf("=");
              if (eqIndex > 0) {
                const key = trimmed.substring(0, eqIndex).trim();
                let value = trimmed.substring(eqIndex + 1).trim();
                // Remove quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                  value = value.slice(1, -1);
                }
                if (!process.env[key]) {
                  process.env[key] = value;
                }
              }
            }
          });
          console.log(`📁 Loaded .env from: ${envPath}`);
          return true;
        } catch (parseErr) {
          // Continue to next path
        }
      }
    }
  }
  return false;
}

loadEnv();

// ============================================================================
// Configuration
// ============================================================================

const defaultConfig = {
  headless: false,
  slowMo: 50,
  timeout: 30000,
  viewport: { width: 1400, height: 900 },
  screenshotDir: "./eko-playground-output",
  verbose: true,
  // Prioritize OpenAI Compatible settings (for development/custom endpoints)
  model: process.env.OPENAI_COMPATIBLE_MODEL || process.env.OPENAI_MODEL || "gpt-4o",
  baseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com",
  apiKey: process.env.OPENAI_COMPATIBLE_API_KEY || process.env.OPENAI_API_KEY || "",
  userDataDir: undefined,
};

// ============================================================================
// CLI Argument Parser
// ============================================================================

function parseArgs(args) {
  const result = {
    task: undefined,
    file: undefined,
    interactive: false,
    config: {},
    help: false,
    version: false,
    listExamples: false,
    showConfig: false,
  };

  const positionalArgs = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-h" || arg === "--help") {
      result.help = true;
    } else if (arg === "-v" || arg === "--version") {
      result.version = true;
    } else if (arg === "-i" || arg === "--interactive") {
      result.interactive = true;
    } else if (arg === "-f" || arg === "--file") {
      result.file = args[++i];
    } else if (arg === "--headless") {
      result.config.headless = true;
    } else if (arg === "--headless=true") {
      result.config.headless = true;
    } else if (arg === "--headless=false") {
      result.config.headless = false;
    } else if (arg === "--visible") {
      result.config.headless = false;
    } else if (arg.startsWith("--slow-mo=")) {
      result.config.slowMo = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--timeout=")) {
      result.config.timeout = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--screenshot-dir=")) {
      result.config.screenshotDir = arg.split("=")[1];
    } else if (arg.startsWith("--model=")) {
      result.config.model = arg.split("=")[1];
    } else if (arg.startsWith("--base-url=")) {
      result.config.baseUrl = arg.split("=")[1];
    } else if (arg.startsWith("--api-key=")) {
      result.config.apiKey = arg.split("=")[1];
    } else if (arg.startsWith("--user-data-dir=")) {
      result.config.userDataDir = arg.split("=")[1];
    } else if (arg === "--verbose" || arg === "-V") {
      result.config.verbose = true;
    } else if (arg === "--quiet" || arg === "-q") {
      result.config.verbose = false;
    } else if (arg === "--examples" || arg === "--list-examples") {
      result.listExamples = true;
    } else if (arg === "--show-config" || arg === "--config") {
      result.showConfig = true;
    } else if (!arg.startsWith("-")) {
      positionalArgs.push(arg);
    }
  }

  if (positionalArgs.length > 0) {
    result.task = positionalArgs.join(" ");
  }

  return result;
}

// ============================================================================
// Help and Version
// ============================================================================

function printBanner() {
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║   ███████╗██╗  ██╗ ██████╗     ██████╗ ██╗      █████╗ ██╗   ██╗           ║
║   ██╔════╝██║ ██╔╝██╔═══██╗    ██╔══██╗██║     ██╔══██╗╚██╗ ██╔╝           ║
║   █████╗  █████╔╝ ██║   ██║    ██████╔╝██║     ███████║ ╚████╔╝            ║
║   ██╔══╝  ██╔═██╗ ██║   ██║    ██╔═══╝ ██║     ██╔══██║  ╚██╔╝             ║
║   ███████╗██║  ██╗╚██████╔╝    ██║     ███████╗██║  ██║   ██║              ║
║   ╚══════╝╚═╝  ╚═╝ ╚═════╝     ╚═╝     ╚══════╝╚═╝  ╚═╝   ╚═╝              ║
║                                                                             ║
║        Interactive Browser Automation Testing Environment                   ║
╚════════════════════════════════════════════════════════════════════════════╝
`);
}

function printHelp() {
  printBanner();
  console.log(`
USAGE:
  node cli/eko-playground.cjs [options] [task]
  node cli/eko-playground.cjs -f <prompt-file>
  node cli/eko-playground.cjs --interactive

TASK INPUT:
  <task>                Direct task description as a string argument
  -f, --file <path>     Read task from a file (supports .txt, .md, .json)

MODES:
  -i, --interactive     Start interactive REPL mode for multi-step tasks
  --examples            List example tasks you can run

BROWSER OPTIONS:
  --headless            Run browser in headless mode (hidden)
  --visible             Run browser in visible mode (default)
  --headless=<bool>     Explicitly set headless mode (true/false)
  --slow-mo=<ms>        Slow down actions by N milliseconds (default: 50)
  --timeout=<ms>        Set default timeout in milliseconds (default: 30000)
  --user-data-dir=<p>   Use persistent browser profile at path

LLM OPTIONS:
  --model=<model>       LLM model to use (default: gpt-4o)
  --base-url=<url>      OpenAI-compatible API base URL
  --api-key=<key>       API key for LLM (or set OPENAI_API_KEY env var)

OUTPUT OPTIONS:
  --screenshot-dir=<p>  Directory for screenshots (default: ./eko-playground-output)
  -V, --verbose         Enable verbose logging
  -q, --quiet           Disable verbose logging

OTHER:
  -h, --help            Show this help message
  -v, --version         Show version information

EXAMPLES:
  # Run a simple task
  node cli/eko-playground.cjs "Navigate to google.com and search for Eko AI"

  # Run task from file with visible browser
  node cli/eko-playground.cjs -f ./tasks/my-task.txt --visible

  # Start interactive mode
  node cli/eko-playground.cjs --interactive

  # Use custom LLM endpoint
  node cli/eko-playground.cjs --base-url=http://localhost:8000 "Hello world"

ENVIRONMENT VARIABLES:
  OPENAI_COMPATIBLE_BASE_URL   API base URL
  OPENAI_COMPATIBLE_API_KEY    API key
  OPENAI_COMPATIBLE_MODEL      Default model name
  OPENAI_API_KEY               Fallback API key

For more information, visit: https://github.com/FellouAI/eko
`);
}

function printVersion() {
  try {
    const pkg = require("../package.json");
    console.log(`Eko Playground CLI v${pkg.version}`);
  } catch (e) {
    console.log("Eko Playground CLI v1.0.0");
  }
}

function printExamples() {
  printBanner();
  console.log(`
EXAMPLE TASKS:

📌 SIMPLE NAVIGATION:
  node cli/eko-playground.cjs "Navigate to https://example.com and take a screenshot"
  node cli/eko-playground.cjs "Go to google.com, search for 'AI automation', click first result"

📌 FORM FILLING:
  node cli/eko-playground.cjs "Go to a login page and fill in test credentials"
  node cli/eko-playground.cjs "Navigate to a contact form and fill it with sample data"

📌 CONTENT EXTRACTION:
  node cli/eko-playground.cjs "Go to news.ycombinator.com and list the top 5 headlines"
  node cli/eko-playground.cjs "Navigate to wikipedia.org, search for 'Claude AI', extract summary"

📌 CREATIVE TASKS:
  node cli/eko-playground.cjs "Open an online text editor and write a poem about coding"
  node cli/eko-playground.cjs "Go to a markdown editor and create a README for an npm package"

📌 MULTI-STEP WORKFLOWS:
  node cli/eko-playground.cjs -f ./tasks/youtube-research.txt
  node cli/eko-playground.cjs -f ./tasks/product-comparison.txt

📌 INTERACTIVE MODE:
  node cli/eko-playground.cjs --interactive
  > navigate to github.com
  > search for "eko ai"
  > click on the first repository
  > extract the README content
  > quit

TIP: Create a 'tasks' directory with .txt files for reusable task prompts!
`);
}

// ============================================================================
// HTTP Client (using native Node.js)
// ============================================================================

async function httpRequest(url, options) {
  const https = require("https");
  const http = require("http");
  const urlModule = require("url");

  return new Promise((resolve, reject) => {
    const parsedUrl = new urlModule.URL(url);
    const protocol = parsedUrl.protocol === "https:" ? https : http;

    const req = protocol.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || "GET",
        headers: options.headers || {},
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text: async () => data,
            json: async () => JSON.parse(data),
          });
        });
      }
    );

    req.on("error", reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

// ============================================================================
// LLM Integration
// ============================================================================

async function callLLM(config, messages, maxTokens = 2000) {
  const url = `${config.baseUrl}/v1/chat/completions`;

  const response = await httpRequest(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// ============================================================================
// Action Parser
// ============================================================================

const ACTION_SYSTEM_PROMPT = `You are a browser automation assistant. Given a task, you output a JSON array of browser actions to perform.

Available actions:
- { "type": "navigate", "url": "https://..." }
- { "type": "click", "selector": "css selector or text content" }
- { "type": "type", "selector": "css selector", "text": "text to type" }
- { "type": "press", "key": "Enter|Tab|Escape|etc" }
- { "type": "wait", "ms": 1000 }
- { "type": "screenshot", "name": "optional-name" }
- { "type": "scroll", "direction": "up|down", "amount": 300 }
- { "type": "select", "selector": "css selector", "value": "option value" }
- { "type": "hover", "selector": "css selector" }
- { "type": "evaluate", "script": "javascript code" }
- { "type": "extract", "selector": "css selector", "attribute": "text|href|src|etc" }
- { "type": "fill_form", "fields": { "selector1": "value1", "selector2": "value2" } }

For selectors, you can use:
- CSS selectors: "#id", ".class", "input[name='email']"
- Text-based: "text=Click me", "button:has-text('Submit')"
- Role-based: "role=button[name='Submit']"

Respond ONLY with valid JSON in this format:
{
  "explanation": "Brief explanation of what you'll do",
  "actions": [
    { "type": "navigate", "url": "..." },
    ...
  ]
}`;

async function parseTaskToPlan(config, task, pageContext) {
  const messages = [
    { role: "system", content: ACTION_SYSTEM_PROMPT },
    {
      role: "user",
      content: pageContext
        ? `Current page context:\n${pageContext}\n\nTask: ${task}`
        : `Task: ${task}`,
    },
  ];

  const response = await callLLM(config, messages);

  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = response;
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    const plan = JSON.parse(jsonStr);
    return {
      actions: plan.actions || [],
      explanation: plan.explanation || "",
    };
  } catch (e) {
    throw new Error(`Failed to parse LLM response as JSON: ${response}`);
  }
}

// ============================================================================
// Action Executor
// ============================================================================

async function executeAction(page, action, config) {
  const log = config.verbose ? console.log : () => {};

  switch (action.type) {
    case "navigate":
      log(`  → Navigating to: ${action.url}`);
      await page.goto(action.url, { waitUntil: "domcontentloaded", timeout: config.timeout });
      await page.waitForTimeout(500);
      return `Navigated to ${action.url}`;

    case "click":
      log(`  → Clicking: ${action.selector}`);
      try {
        await page.click(action.selector, { timeout: config.timeout });
      } catch (e) {
        // Try text-based selection
        await page.click(`text=${action.selector}`, { timeout: config.timeout });
      }
      return `Clicked ${action.selector}`;

    case "type":
      log(`  → Typing into: ${action.selector}`);
      await page.fill(action.selector, action.text);
      return `Typed "${action.text}" into ${action.selector}`;

    case "press":
      log(`  → Pressing: ${action.key}`);
      await page.keyboard.press(action.key);
      return `Pressed ${action.key}`;

    case "wait":
      log(`  → Waiting: ${action.ms}ms`);
      await page.waitForTimeout(action.ms);
      return `Waited ${action.ms}ms`;

    case "screenshot": {
      const name = action.name || `screenshot-${Date.now()}`;
      const filepath = path.join(config.screenshotDir, `${name}.png`);
      fs.mkdirSync(config.screenshotDir, { recursive: true });
      await page.screenshot({ path: filepath });
      log(`  → Screenshot saved: ${filepath}`);
      return `Screenshot saved to ${filepath}`;
    }

    case "scroll":
      log(`  → Scrolling ${action.direction}: ${action.amount}px`);
      const scrollAmount = action.direction === "up" ? -action.amount : action.amount;
      await page.mouse.wheel(0, scrollAmount);
      return `Scrolled ${action.direction} by ${action.amount}px`;

    case "select":
      log(`  → Selecting: ${action.value} in ${action.selector}`);
      await page.selectOption(action.selector, action.value);
      return `Selected ${action.value} in ${action.selector}`;

    case "hover":
      log(`  → Hovering over: ${action.selector}`);
      await page.hover(action.selector);
      return `Hovered over ${action.selector}`;

    case "evaluate":
      log(`  → Evaluating script`);
      const evalResult = await page.evaluate(action.script);
      return `Script result: ${JSON.stringify(evalResult)}`;

    case "extract":
      log(`  → Extracting from: ${action.selector}`);
      const element = await page.$(action.selector);
      if (!element) {
        return `Element not found: ${action.selector}`;
      }
      let extracted;
      if (action.attribute === "text") {
        extracted = (await element.textContent()) || "";
      } else {
        extracted = (await element.getAttribute(action.attribute)) || "";
      }
      return `Extracted (${action.attribute}): ${extracted.substring(0, 500)}`;

    case "fill_form":
      log(`  → Filling form with ${Object.keys(action.fields).length} fields`);
      for (const [selector, value] of Object.entries(action.fields)) {
        await page.fill(selector, value);
      }
      return `Filled form with ${Object.keys(action.fields).length} fields`;

    default:
      return `Unknown action type: ${action.type}`;
  }
}

// ============================================================================
// Playground Runner Class
// ============================================================================

class PlaygroundRunner {
  constructor(config) {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.config = config;
  }

  async init() {
    const { chromium } = require("playwright");
    const log = this.config.verbose ? console.log : () => {};

    log("\n🚀 Initializing Eko Playground...");

    const launchOptions = {
      headless: this.config.headless,
      slowMo: this.config.slowMo,
      args: [
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
        `--window-size=${this.config.viewport.width},${this.config.viewport.height}`,
      ],
    };

    if (this.config.userDataDir) {
      log(`📁 Using persistent profile: ${this.config.userDataDir}`);
      this.context = await chromium.launchPersistentContext(this.config.userDataDir, {
        ...launchOptions,
        viewport: this.config.viewport,
      });
      this.page = this.context.pages()[0] || (await this.context.newPage());
    } else {
      this.browser = await chromium.launch(launchOptions);
      this.context = await this.browser.newContext({
        viewport: this.config.viewport,
      });
      this.page = await this.context.newPage();
    }

    log("✅ Browser ready!\n");
  }

  async runTask(task) {
    if (!this.page) {
      throw new Error("Browser not initialized. Call init() first.");
    }

    const log = this.config.verbose ? console.log : () => {};

    log("═".repeat(70));
    log(`📋 Task: ${task}`);
    log("═".repeat(70));

    // Get current page context for better planning
    let pageContext = "";
    try {
      const url = this.page.url();
      const title = await this.page.title();
      if (url !== "about:blank") {
        pageContext = `URL: ${url}\nTitle: ${title}`;
      }
    } catch (e) {
      // Page might not be ready
    }

    // Parse task to actions using LLM
    log("\n🤖 Planning actions...");
    const plan = await parseTaskToPlan(this.config, task, pageContext);

    log(`\n💡 Plan: ${plan.explanation}`);
    log(`\n📝 Actions (${plan.actions.length}):`);

    // Execute each action
    const results = [];
    for (let i = 0; i < plan.actions.length; i++) {
      const action = plan.actions[i];
      log(`\n[${i + 1}/${plan.actions.length}] ${action.type.toUpperCase()}`);

      try {
        const result = await executeAction(this.page, action, this.config);
        results.push(result);
        log(`  ✓ ${result}`);
      } catch (error) {
        const errorMsg = `Error: ${error.message}`;
        results.push(errorMsg);
        log(`  ✗ ${errorMsg}`);

        // Take error screenshot
        const errorScreenshot = path.join(
          this.config.screenshotDir,
          `error-${Date.now()}.png`
        );
        fs.mkdirSync(this.config.screenshotDir, { recursive: true });
        await this.page.screenshot({ path: errorScreenshot });
        log(`  📸 Error screenshot: ${errorScreenshot}`);
      }
    }

    log("\n" + "═".repeat(70));
    log("✅ Task completed!");
    log("═".repeat(70) + "\n");

    return results.join("\n");
  }

  async runInteractive() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\n" + "═".repeat(70));
    console.log("🎮 EKO PLAYGROUND - INTERACTIVE MODE");
    console.log("═".repeat(70));
    console.log("Type your browser tasks or commands.");
    console.log("Special commands: quit, exit, screenshot, url, help, history");
    console.log("═".repeat(70) + "\n");

    const history = [];

    const prompt = () => {
      rl.question("eko> ", async (input) => {
        const trimmed = input.trim().toLowerCase();

        if (trimmed === "quit" || trimmed === "exit") {
          console.log("\n👋 Goodbye!\n");
          rl.close();
          await this.close();
          return;
        }

        if (trimmed === "help") {
          console.log(`
Commands:
  quit, exit      - Exit interactive mode
  screenshot      - Take a screenshot of current page
  url             - Show current page URL
  history         - Show command history
  clear           - Clear the terminal
  <any text>      - Run as a browser task
`);
          prompt();
          return;
        }

        if (trimmed === "screenshot") {
          const filepath = path.join(
            this.config.screenshotDir,
            `interactive-${Date.now()}.png`
          );
          fs.mkdirSync(this.config.screenshotDir, { recursive: true });
          await this.page?.screenshot({ path: filepath });
          console.log(`📸 Screenshot saved: ${filepath}\n`);
          prompt();
          return;
        }

        if (trimmed === "url") {
          console.log(`📍 Current URL: ${this.page?.url() || "about:blank"}\n`);
          prompt();
          return;
        }

        if (trimmed === "history") {
          console.log("\n📜 Command History:");
          history.forEach((cmd, i) => console.log(`  ${i + 1}. ${cmd}`));
          console.log("");
          prompt();
          return;
        }

        if (trimmed === "clear") {
          console.clear();
          prompt();
          return;
        }

        if (input.trim()) {
          history.push(input.trim());
          try {
            await this.runTask(input.trim());
          } catch (error) {
            console.error(`\n❌ Error: ${error.message}\n`);
          }
        }

        prompt();
      });
    };

    prompt();
  }

  async close() {
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }

  getPage() {
    return this.page;
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.version) {
    printVersion();
    process.exit(0);
  }

  if (args.listExamples) {
    printExamples();
    process.exit(0);
  }

  // Merge config
  const config = { ...defaultConfig, ...args.config };

  // Show config if requested or in verbose mode when starting
  if (args.showConfig) {
    console.log("\n📋 Current Configuration:");
    console.log("═".repeat(50));
    console.log(`  Model:    ${config.model}`);
    console.log(`  Base URL: ${config.baseUrl}`);
    console.log(`  API Key:  ${config.apiKey ? config.apiKey.substring(0, 10) + "..." : "(not set)"}`);
    console.log(`  Headless: ${config.headless}`);
    console.log(`  SlowMo:   ${config.slowMo}ms`);
    console.log(`  Timeout:  ${config.timeout}ms`);
    console.log("═".repeat(50) + "\n");
    if (!args.task && !args.file && !args.interactive) {
      process.exit(0);
    }
  }

  // Check for API key
  if (!config.apiKey) {
    console.error("❌ Error: No API key provided.");
    console.error("Set OPENAI_COMPATIBLE_API_KEY or OPENAI_API_KEY environment variable");
    console.error("Or use --api-key=<key>");
    console.error("\nExample:");
    console.error('  export OPENAI_COMPATIBLE_API_KEY="sk-..."');
    console.error('  export OPENAI_COMPATIBLE_BASE_URL="http://localhost:8000"');
    console.error('  node cli/eko-playground.cjs "Navigate to google.com"');
    console.error("\nOr use a .env file with:");
    console.error("  OPENAI_COMPATIBLE_API_KEY=sk-...");
    console.error("  OPENAI_COMPATIBLE_BASE_URL=http://localhost:8000");
    console.error("  OPENAI_COMPATIBLE_MODEL=gpt-4o");
    process.exit(1);
  }

  // Show LLM configuration
  console.log("\n🤖 LLM Configuration:");
  console.log(`   Model:    ${config.model}`);
  console.log(`   Endpoint: ${config.baseUrl}`);

  // Determine task source
  let task = args.task;

  if (args.file) {
    const filePath = path.resolve(args.file);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Error: File not found: ${filePath}`);
      process.exit(1);
    }
    task = fs.readFileSync(filePath, "utf-8").trim();
  }

  // Create and run playground
  const playground = new PlaygroundRunner(config);

  try {
    await playground.init();

    if (args.interactive) {
      await playground.runInteractive();
    } else if (task) {
      const result = await playground.runTask(task);
      console.log("\n📊 Results:\n" + result);

      // Keep browser open for a few seconds to see results
      if (!config.headless) {
        console.log("\n⏳ Browser will close in 5 seconds...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      await playground.close();
    } else {
      console.error("❌ Error: No task provided.");
      console.error("Use: node cli/eko-playground.cjs <task>");
      console.error("  or: node cli/eko-playground.cjs --interactive");
      console.error("\nRun with --help for more options.");
      await playground.close();
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ Fatal Error: ${error.message}`);
    if (config.verbose) {
      console.error(error.stack);
    }
    await playground.close();
    process.exit(1);
  }
}

// Export for programmatic use
module.exports = {
  PlaygroundRunner,
  parseArgs,
  defaultConfig,
};

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}
