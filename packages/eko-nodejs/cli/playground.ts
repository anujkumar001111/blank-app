#!/usr/bin/env node
/**
 * Eko Playground CLI
 *
 * A command-line interface for testing Eko browser automation implementations
 * and performing real-life tasks in visible browsers.
 *
 * Usage:
 *   eko-playground [options] [task]
 *   eko-playground -f <prompt-file>
 *   eko-playground --interactive
 *
 * Examples:
 *   eko-playground "Navigate to google.com and search for Eko AI"
 *   eko-playground -f ./tasks/youtube-script.txt
 *   eko-playground --interactive --headless=false
 */

import { resolve, dirname, join } from "path";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import * as readline from "readline";

// ============================================================================
// Configuration
// ============================================================================

interface PlaygroundConfig {
  headless: boolean;
  slowMo: number;
  timeout: number;
  viewport: { width: number; height: number };
  screenshotDir: string;
  verbose: boolean;
  model: string;
  baseUrl: string;
  apiKey: string;
  userDataDir?: string;
}

const defaultConfig: PlaygroundConfig = {
  headless: false,
  slowMo: 50,
  timeout: 30000,
  viewport: { width: 1400, height: 900 },
  screenshotDir: "./eko-playground-output",
  verbose: true,
  model: process.env.OPENAI_COMPATIBLE_MODEL || "gpt-4o",
  baseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL || "https://api.openai.com",
  apiKey: process.env.OPENAI_COMPATIBLE_API_KEY || process.env.OPENAI_API_KEY || "",
  userDataDir: undefined,
};

// ============================================================================
// CLI Argument Parser
// ============================================================================

interface CLIArgs {
  task?: string;
  file?: string;
  interactive: boolean;
  config: Partial<PlaygroundConfig>;
  help: boolean;
  version: boolean;
  listExamples: boolean;
}

function parseArgs(args: string[]): CLIArgs {
  const result: CLIArgs = {
    interactive: false,
    config: {},
    help: false,
    version: false,
    listExamples: false,
  };

  const positionalArgs: string[] = [];

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

function printHelp(): void {
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                         EKO PLAYGROUND CLI                                  ║
║        Interactive Browser Automation Testing Environment                   ║
╚════════════════════════════════════════════════════════════════════════════╝

USAGE:
  eko-playground [options] [task]
  eko-playground -f <prompt-file>
  eko-playground --interactive

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
  eko-playground "Navigate to google.com and search for Eko AI"

  # Run task from file with visible browser
  eko-playground -f ./tasks/my-task.txt --visible

  # Start interactive mode
  eko-playground --interactive

  # Use custom LLM endpoint
  eko-playground --base-url=http://localhost:8000 --model=local-model "Hello world"

ENVIRONMENT VARIABLES:
  OPENAI_COMPATIBLE_BASE_URL   API base URL
  OPENAI_COMPATIBLE_API_KEY    API key
  OPENAI_COMPATIBLE_MODEL      Default model name
  OPENAI_API_KEY               Fallback API key

For more information, visit: https://github.com/FellouAI/eko
`);
}

function printVersion(): void {
  const pkg = require("../package.json");
  console.log(`Eko Playground CLI v${pkg.version}`);
}

function printExamples(): void {
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                         EXAMPLE TASKS                                       ║
╚════════════════════════════════════════════════════════════════════════════╝

SIMPLE NAVIGATION:
  eko-playground "Navigate to https://example.com and take a screenshot"
  eko-playground "Go to google.com, search for 'AI automation', click first result"

FORM FILLING:
  eko-playground "Go to a login page and fill in test credentials"
  eko-playground "Navigate to a contact form and fill it with sample data"

CONTENT EXTRACTION:
  eko-playground "Go to news.ycombinator.com and list the top 5 headlines"
  eko-playground "Navigate to wikipedia.org, search for 'Claude AI', extract summary"

CREATIVE TASKS:
  eko-playground "Open an online text editor and write a poem about coding"
  eko-playground "Go to a markdown editor and create a README for an npm package"

MULTI-STEP WORKFLOWS:
  eko-playground -f ./tasks/youtube-research.txt
  eko-playground -f ./tasks/product-comparison.txt

INTERACTIVE MODE:
  eko-playground --interactive
  > navigate to github.com
  > search for "eko ai"
  > click on the first repository
  > extract the README content
  > quit

TIP: Create a 'tasks' directory with .txt files for reusable task prompts!
`);
}

// ============================================================================
// LLM Integration
// ============================================================================

interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callLLM(
  config: PlaygroundConfig,
  messages: LLMMessage[],
  maxTokens: number = 2000
): Promise<string> {
  const url = `${config.baseUrl}/v1/chat/completions`;

  const response = await fetch(url, {
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
// Browser Action Types
// ============================================================================

interface BrowserAction {
  type: string;
  [key: string]: any;
}

interface ParsedPlan {
  actions: BrowserAction[];
  explanation: string;
}

// ============================================================================
// Action Parser & Executor
// ============================================================================

const ACTION_SYSTEM_PROMPT = `You are a browser automation assistant. Given a task, you output a JSON array of browser actions to perform.

Available actions:
- { "type": "navigate", "url": "https://..." }
- { "type": "click", "selector": "css selector" }
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

Respond ONLY with valid JSON in this format:
{
  "explanation": "Brief explanation of what you'll do",
  "actions": [
    { "type": "navigate", "url": "..." },
    ...
  ]
}`;

async function parseTaskToPlan(
  config: PlaygroundConfig,
  task: string,
  pageContext?: string
): Promise<ParsedPlan> {
  const messages: LLMMessage[] = [
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

async function executeAction(
  page: Page,
  action: BrowserAction,
  config: PlaygroundConfig
): Promise<string> {
  const log = config.verbose ? console.log : () => {};

  switch (action.type) {
    case "navigate":
      log(`  → Navigating to: ${action.url}`);
      await page.goto(action.url, { waitUntil: "domcontentloaded", timeout: config.timeout });
      return `Navigated to ${action.url}`;

    case "click":
      log(`  → Clicking: ${action.selector}`);
      await page.click(action.selector, { timeout: config.timeout });
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
      const filepath = join(config.screenshotDir, `${name}.png`);
      mkdirSync(config.screenshotDir, { recursive: true });
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
      let extracted: string;
      if (action.attribute === "text") {
        extracted = (await element.textContent()) || "";
      } else {
        extracted = (await element.getAttribute(action.attribute)) || "";
      }
      return `Extracted (${action.attribute}): ${extracted.substring(0, 500)}`;

    case "fill_form":
      log(`  → Filling form with ${Object.keys(action.fields).length} fields`);
      for (const [selector, value] of Object.entries(action.fields)) {
        await page.fill(selector, value as string);
      }
      return `Filled form with ${Object.keys(action.fields).length} fields`;

    default:
      return `Unknown action type: ${action.type}`;
  }
}

// ============================================================================
// Playground Runner
// ============================================================================

class PlaygroundRunner {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: PlaygroundConfig;

  constructor(config: PlaygroundConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    const log = this.config.verbose ? console.log : () => {};

    log("\n🚀 Initializing Eko Playground...");

    const launchOptions: any = {
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
      this.context = await chromium.launchPersistentContext(
        this.config.userDataDir,
        {
          ...launchOptions,
          viewport: this.config.viewport,
        }
      );
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

  async runTask(task: string): Promise<string> {
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
    const results: string[] = [];
    for (let i = 0; i < plan.actions.length; i++) {
      const action = plan.actions[i];
      log(`\n[${i + 1}/${plan.actions.length}] ${action.type.toUpperCase()}`);

      try {
        const result = await executeAction(this.page, action, this.config);
        results.push(result);
        log(`  ✓ ${result}`);
      } catch (error: any) {
        const errorMsg = `Error: ${error.message}`;
        results.push(errorMsg);
        log(`  ✗ ${errorMsg}`);

        // Take error screenshot
        const errorScreenshot = join(
          this.config.screenshotDir,
          `error-${Date.now()}.png`
        );
        mkdirSync(this.config.screenshotDir, { recursive: true });
        await this.page.screenshot({ path: errorScreenshot });
        log(`  📸 Error screenshot: ${errorScreenshot}`);
      }
    }

    log("\n" + "═".repeat(70));
    log("✅ Task completed!");
    log("═".repeat(70) + "\n");

    return results.join("\n");
  }

  async runInteractive(): Promise<void> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\n" + "═".repeat(70));
    console.log("🎮 EKO PLAYGROUND - INTERACTIVE MODE");
    console.log("═".repeat(70));
    console.log("Type your browser tasks or commands.");
    console.log("Special commands: quit, exit, screenshot, url, help");
    console.log("═".repeat(70) + "\n");

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
  quit, exit    - Exit interactive mode
  screenshot    - Take a screenshot of current page
  url           - Show current page URL
  clear         - Clear the terminal
  <any text>    - Run as a browser task
`);
          prompt();
          return;
        }

        if (trimmed === "screenshot") {
          const filepath = join(
            this.config.screenshotDir,
            `interactive-${Date.now()}.png`
          );
          mkdirSync(this.config.screenshotDir, { recursive: true });
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

        if (trimmed === "clear") {
          console.clear();
          prompt();
          return;
        }

        if (input.trim()) {
          try {
            await this.runTask(input.trim());
          } catch (error: any) {
            console.error(`\n❌ Error: ${error.message}\n`);
          }
        }

        prompt();
      });
    };

    prompt();
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }

  getPage(): Page | null {
    return this.page;
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
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
  const config: PlaygroundConfig = { ...defaultConfig, ...args.config };

  // Check for API key
  if (!config.apiKey) {
    console.error("❌ Error: No API key provided.");
    console.error("Set OPENAI_API_KEY environment variable or use --api-key=<key>");
    process.exit(1);
  }

  // Determine task source
  let task: string | undefined = args.task;

  if (args.file) {
    const filePath = resolve(args.file);
    if (!existsSync(filePath)) {
      console.error(`❌ Error: File not found: ${filePath}`);
      process.exit(1);
    }
    task = readFileSync(filePath, "utf-8").trim();
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
      console.error("Use: eko-playground <task> or eko-playground --interactive");
      console.error("Run eko-playground --help for more options.");
      await playground.close();
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`\n❌ Fatal Error: ${error.message}`);
    await playground.close();
    process.exit(1);
  }
}

// Export for programmatic use
export { PlaygroundRunner, PlaygroundConfig, parseArgs, CLIArgs };

// Run if executed directly
main().catch(console.error);
