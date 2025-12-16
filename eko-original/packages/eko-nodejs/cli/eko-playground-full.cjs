#!/usr/bin/env node
/**
 * Eko Playground CLI - Full Framework Integration
 *
 * A comprehensive CLI for testing Eko browser automation and system operations
 * with full access to all Eko framework capabilities.
 *
 * Features:
 * - BrowserAgent with visual element labeling and full browser tools
 * - SystemAgent with file/shell operations
 * - Eko workflow orchestrator with AI planning
 * - Variable substitution for prompt templates
 * - Multi-tab browser support
 * - MCP client integration
 * - Streaming callbacks for real-time feedback
 * - Interactive REPL mode
 *
 * Usage:
 *   node cli/eko-playground-full.cjs [options] [task]
 *   node cli/eko-playground-full.cjs --mode=browser "Navigate to google.com"
 *   node cli/eko-playground-full.cjs --mode=workflow -f task.md --var FROM=NYC --var TO=LAX
 */

const path = require("path");
const fs = require("fs");
const readline = require("readline");

// ============================================================================
// Environment Loading
// ============================================================================

function loadEnv() {
  const possiblePaths = [
    path.join(__dirname, ".env"),
    path.join(__dirname, "../.env"),
    path.join(__dirname, "../../.env"),
    path.join(__dirname, "../../../.env"),
    path.join(__dirname, "../../../../.env"),
    path.join(process.cwd(), ".env"),
  ];

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      try {
        require("dotenv").config({ path: envPath });
        return envPath;
      } catch (e) {
        // Manual parsing fallback
        const content = fs.readFileSync(envPath, "utf-8");
        content.split("\n").forEach((line) => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#")) {
            const eqIndex = trimmed.indexOf("=");
            if (eqIndex > 0) {
              const key = trimmed.substring(0, eqIndex).trim();
              let value = trimmed.substring(eqIndex + 1).trim();
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
        return envPath;
      }
    }
  }
  return null;
}

const loadedEnvPath = loadEnv();

// ============================================================================
// Configuration
// ============================================================================

const defaultConfig = {
  // Execution mode
  mode: "browser", // browser | system | workflow | interactive

  // Browser options
  headless: false,
  slowMo: 50,
  timeout: 30000,
  viewport: { width: 1400, height: 900 },
  userDataDir: undefined,

  // Output options
  screenshotDir: "./eko-playground-output",
  verbose: true,
  streamOutput: true,

  // LLM Configuration (prioritize OpenAI Compatible)
  llm: {
    provider: "openai-compatible",
    model: process.env.OPENAI_COMPATIBLE_MODEL || process.env.OPENAI_MODEL || "gpt-4o",
    baseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_COMPATIBLE_API_KEY || process.env.OPENAI_API_KEY || "",
  },

  // System agent options
  workPath: process.cwd(),
  enableShellSafety: true,
  restrictToWorkPath: false,

  // Variable substitutions
  variables: {},

  // MCP options
  mcpEndpoint: process.env.MCP_ENDPOINT || undefined,
};

// ============================================================================
// CLI Argument Parser
// ============================================================================

function parseArgs(args) {
  const result = {
    task: undefined,
    file: undefined,
    mode: undefined,
    interactive: false,
    config: { variables: {} },
    help: false,
    version: false,
    listExamples: false,
    showConfig: false,
    listTools: false,
    listAgents: false,
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
    } else if (arg.startsWith("--mode=")) {
      result.mode = arg.split("=")[1];
    } else if (arg === "--browser") {
      result.mode = "browser";
    } else if (arg === "--system") {
      result.mode = "system";
    } else if (arg === "--workflow") {
      result.mode = "workflow";
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
      result.config.llm = result.config.llm || {};
      result.config.llm.model = arg.split("=")[1];
    } else if (arg.startsWith("--base-url=")) {
      result.config.llm = result.config.llm || {};
      result.config.llm.baseUrl = arg.split("=")[1];
    } else if (arg.startsWith("--api-key=")) {
      result.config.llm = result.config.llm || {};
      result.config.llm.apiKey = arg.split("=")[1];
    } else if (arg.startsWith("--provider=")) {
      result.config.llm = result.config.llm || {};
      result.config.llm.provider = arg.split("=")[1];
    } else if (arg.startsWith("--user-data-dir=")) {
      result.config.userDataDir = arg.split("=")[1];
    } else if (arg.startsWith("--work-path=")) {
      result.config.workPath = arg.split("=")[1];
    } else if (arg.startsWith("--var=") || arg.startsWith("-D")) {
      // Variable substitution: --var=KEY=VALUE or -DKEY=VALUE
      const varPart = arg.startsWith("--var=") ? arg.slice(6) : arg.slice(2);
      const eqIndex = varPart.indexOf("=");
      if (eqIndex > 0) {
        const key = varPart.substring(0, eqIndex);
        const value = varPart.substring(eqIndex + 1);
        result.config.variables[key] = value;
      }
    } else if (arg === "--verbose" || arg === "-V") {
      result.config.verbose = true;
    } else if (arg === "--quiet" || arg === "-q") {
      result.config.verbose = false;
    } else if (arg === "--examples" || arg === "--list-examples") {
      result.listExamples = true;
    } else if (arg === "--show-config" || arg === "--config") {
      result.showConfig = true;
    } else if (arg === "--list-tools" || arg === "--tools") {
      result.listTools = true;
    } else if (arg === "--list-agents" || arg === "--agents") {
      result.listAgents = true;
    } else if (arg === "--no-stream") {
      result.config.streamOutput = false;
    } else if (arg === "--unsafe-shell") {
      result.config.enableShellSafety = false;
    } else if (arg.startsWith("--mcp=")) {
      result.config.mcpEndpoint = arg.split("=")[1];
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
// Variable Substitution
// ============================================================================

function substituteVariables(text, variables) {
  let result = text;

  // Replace {{VAR}} patterns
  result = result.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    if (variables[varName] !== undefined) {
      return variables[varName];
    }
    // Check environment variables as fallback
    if (process.env[varName] !== undefined) {
      return process.env[varName];
    }
    return match; // Keep original if not found
  });

  // Replace ${VAR} patterns
  result = result.replace(/\$\{(\w+)\}/g, (match, varName) => {
    if (variables[varName] !== undefined) {
      return variables[varName];
    }
    if (process.env[varName] !== undefined) {
      return process.env[varName];
    }
    return match;
  });

  return result;
}

// ============================================================================
// Frontmatter Parser
// ============================================================================

function parseFrontmatter(content) {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { metadata: {}, content: content };
  }

  const yamlContent = match[1];
  const mainContent = match[2];

  // Simple YAML parser for common cases
  const metadata = {};
  yamlContent.split("\n").forEach((line) => {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();

      // Handle arrays (simple case)
      if (value === "") {
        metadata[key] = [];
      } else if (value.startsWith("[") && value.endsWith("]")) {
        metadata[key] = value.slice(1, -1).split(",").map((s) => s.trim());
      } else {
        metadata[key] = value;
      }
    } else if (line.startsWith("- ") && Object.keys(metadata).length > 0) {
      // Array item
      const lastKey = Object.keys(metadata).pop();
      if (Array.isArray(metadata[lastKey])) {
        metadata[lastKey].push(line.slice(2).trim());
      }
    }
  });

  return { metadata, content: mainContent };
}

// ============================================================================
// Help and Info
// ============================================================================

function printBanner() {
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║   ███████╗██╗  ██╗ ██████╗     ███████╗██╗   ██╗██╗     ██╗                 ║
║   ██╔════╝██║ ██╔╝██╔═══██╗    ██╔════╝██║   ██║██║     ██║                 ║
║   █████╗  █████╔╝ ██║   ██║    █████╗  ██║   ██║██║     ██║                 ║
║   ██╔══╝  ██╔═██╗ ██║   ██║    ██╔══╝  ██║   ██║██║     ██║                 ║
║   ███████╗██║  ██╗╚██████╔╝    ██║     ╚██████╔╝███████╗███████╗            ║
║   ╚══════╝╚═╝  ╚═╝ ╚═════╝     ╚═╝      ╚═════╝ ╚══════╝╚══════╝            ║
║                                                                             ║
║        Full Eko Framework Integration - Browser, System & Workflows        ║
╚════════════════════════════════════════════════════════════════════════════╝
`);
}

function printHelp() {
  printBanner();
  console.log(`
USAGE:
  node cli/eko-playground-full.cjs [options] [task]
  node cli/eko-playground-full.cjs --mode=browser "Navigate to google.com"
  node cli/eko-playground-full.cjs --mode=workflow -f task.md --var FROM=NYC

MODES:
  --browser             Browser automation mode (default)
  --system              System/file operations mode
  --workflow            Full Eko workflow with AI planning
  -i, --interactive     Interactive REPL mode

TASK INPUT:
  <task>                Direct task description
  -f, --file <path>     Read task from file (supports .txt, .md with frontmatter)
  --var=KEY=VALUE       Variable substitution (replaces {{KEY}} in prompts)
  -DKEY=VALUE           Shorthand for --var=KEY=VALUE

BROWSER OPTIONS:
  --headless            Run browser in headless mode
  --visible             Run browser in visible mode (default)
  --slow-mo=<ms>        Slow down actions (default: 50)
  --timeout=<ms>        Default timeout (default: 30000)
  --user-data-dir=<p>   Persistent browser profile path

SYSTEM OPTIONS:
  --work-path=<path>    Base working directory for file ops
  --unsafe-shell        Disable shell safety checks (dangerous!)

LLM OPTIONS:
  --provider=<name>     LLM provider (openai-compatible, anthropic, google)
  --model=<model>       Model name
  --base-url=<url>      API base URL
  --api-key=<key>       API key

OUTPUT OPTIONS:
  --screenshot-dir=<p>  Screenshot directory (default: ./eko-playground-output)
  -V, --verbose         Enable verbose logging
  -q, --quiet           Disable verbose logging
  --no-stream           Disable streaming output

INFO:
  --show-config         Show current configuration
  --list-tools          List all available tools
  --list-agents         List all available agents
  --examples            Show example tasks
  -h, --help            Show this help
  -v, --version         Show version

EXAMPLES:
  # Browser automation
  node cli/eko-playground-full.cjs --browser "Search google for Eko AI"

  # With variable substitution
  node cli/eko-playground-full.cjs -f flight.md --var FROM=NYC --var TO=LAX

  # System operations
  node cli/eko-playground-full.cjs --system "List files in current directory"

  # Full workflow mode
  node cli/eko-playground-full.cjs --workflow "Research competitor pricing"

  # Interactive mode
  node cli/eko-playground-full.cjs -i

ENVIRONMENT VARIABLES:
  OPENAI_COMPATIBLE_BASE_URL   Custom API endpoint (prioritized)
  OPENAI_COMPATIBLE_API_KEY    Custom API key (prioritized)
  OPENAI_COMPATIBLE_MODEL      Default model name
  OPENAI_API_KEY               Fallback API key
`);
}

function printVersion() {
  try {
    const pkg = require("../package.json");
    console.log(`Eko Playground CLI (Full) v${pkg.version}`);
  } catch (e) {
    console.log("Eko Playground CLI (Full) v1.0.0");
  }
}

function printTools() {
  printBanner();
  console.log(`
AVAILABLE TOOLS:

📌 BROWSER TOOLS (BrowserAgent):
  • navigate_to         - Navigate to URL
  • current_page        - Get current page info (URL, title)
  • go_back             - Navigate back in history
  • get_all_tabs        - List all open tabs
  • switch_tab          - Switch between tabs
  • input_text          - Type text into elements
  • click_element       - Click on elements
  • hover_to_element    - Hover over elements
  • scroll_mouse_wheel  - Scroll the page
  • get_select_options  - Get dropdown options
  • select_option       - Select dropdown option
  • wait                - Wait for specified time
  • screenshot_and_html - Capture screenshot and HTML
  • extract_page_content - Extract page text

📌 SYSTEM TOOLS (SystemAgent):
  • shell_exec          - Execute shell commands (with safety)
  • file_read           - Read file contents
  • file_write          - Write/create files
  • file_delete         - Delete files/directories
  • file_list           - List directory contents
  • file_find           - Find files by pattern

📌 WORKFLOW TOOLS (Eko Orchestrator):
  • foreach_task        - Loop execution for repetitive tasks
  • watch_trigger       - Event-based triggering
  • human_interact      - Human-in-the-loop interactions
  • variable_storage    - Cross-agent variable sharing
  • task_result_check   - Validate execution results

📌 CHAT TOOLS (ChatAgent):
  • web_search          - Search the internet
  • webpage_qa          - Q&A on webpage content
  • deep_action         - Complex task execution
`);
}

function printAgents() {
  printBanner();
  console.log(`
AVAILABLE AGENTS:

🤖 BrowserAgent
   Browser automation with Playwright + Chromium
   Features: Element labeling, visual inspection, multi-tab support
   Use: --mode=browser or --browser

🖥️  SystemAgent
   File system and shell operations
   Features: Safe shell execution, file CRUD, glob patterns
   Use: --mode=system or --system

🔄 Eko (Workflow Orchestrator)
   AI-powered task planning and multi-agent coordination
   Features: Natural language planning, parallel execution, replanning
   Use: --mode=workflow or --workflow

💬 ChatAgent
   Conversational AI with web integration
   Features: Web search, webpage Q&A, memory system
   Use: Integrated in workflow mode
`);
}

function printExamples() {
  printBanner();
  console.log(`
EXAMPLE TASKS:

📌 BROWSER AUTOMATION:
  node cli/eko-playground-full.cjs --browser \\
    "Navigate to google.com, search for 'AI automation', click first result"

  node cli/eko-playground-full.cjs --browser \\
    "Go to news.ycombinator.com and extract top 5 headlines"

📌 WITH VARIABLE SUBSTITUTION:
  node cli/eko-playground-full.cjs -f cli/tasks/flight-search.md \\
    --var FROM="New York" --var TO="Los Angeles" --var DATE="2024-03-15"

📌 SYSTEM OPERATIONS:
  node cli/eko-playground-full.cjs --system \\
    "List all TypeScript files in the current directory"

  node cli/eko-playground-full.cjs --system \\
    "Create a new file called test.txt with content 'Hello World'"

📌 WORKFLOW MODE (AI Planning):
  node cli/eko-playground-full.cjs --workflow \\
    "Research competitor pricing for cloud hosting services"

  node cli/eko-playground-full.cjs --workflow \\
    "Compare flight prices on Google Flights, Kayak, and Skyscanner"

📌 INTERACTIVE MODE:
  node cli/eko-playground-full.cjs -i

  Commands in interactive mode:
  > mode browser     - Switch to browser mode
  > mode system      - Switch to system mode
  > mode workflow    - Switch to workflow mode
  > set VAR value    - Set a variable
  > vars             - Show all variables
  > screenshot       - Take a screenshot
  > url              - Show current URL
  > tools            - List available tools
  > help             - Show help
  > quit             - Exit

📌 SAMPLE TASK FILES:
  cli/tasks/google-search.txt
  cli/tasks/hackernews-browse.txt
  cli/tasks/wikipedia-research.txt
  cli/tasks/github-explore.txt
  cli/tasks/text-editor-demo.txt
`);
}

function showConfig(config) {
  console.log("\n📋 Current Configuration:");
  console.log("═".repeat(60));
  console.log(`  Mode:           ${config.mode}`);
  console.log(`  LLM Provider:   ${config.llm.provider}`);
  console.log(`  LLM Model:      ${config.llm.model}`);
  console.log(`  LLM Endpoint:   ${config.llm.baseUrl}`);
  console.log(`  API Key:        ${config.llm.apiKey ? config.llm.apiKey.substring(0, 12) + "..." : "(not set)"}`);
  console.log(`  Headless:       ${config.headless}`);
  console.log(`  SlowMo:         ${config.slowMo}ms`);
  console.log(`  Timeout:        ${config.timeout}ms`);
  console.log(`  Work Path:      ${config.workPath}`);
  console.log(`  Shell Safety:   ${config.enableShellSafety}`);
  console.log(`  Screenshot Dir: ${config.screenshotDir}`);
  if (Object.keys(config.variables).length > 0) {
    console.log(`  Variables:`);
    Object.entries(config.variables).forEach(([k, v]) => {
      console.log(`    ${k} = ${v}`);
    });
  }
  console.log("═".repeat(60) + "\n");
}

// ============================================================================
// LLM Configuration Builder
// ============================================================================

function buildLLMConfig(config) {
  const llmConfig = config.llm;

  // Build the LLMs object for Eko
  return {
    default: {
      provider: llmConfig.provider === "openai-compatible" ? "openai-compatible" : llmConfig.provider,
      model: llmConfig.model,
      apiKey: llmConfig.apiKey,
      baseURL: llmConfig.baseUrl,
    }
  };
}

// ============================================================================
// Streaming Callback
// ============================================================================

function createStreamCallback(config) {
  const log = config.verbose ? console.log : () => { };

  return {
    onMessage: async (message, agentContext) => {
      if (!config.streamOutput) return;

      switch (message.type) {
        case "agent_start":
          log(`\n🤖 Agent Started: ${message.agentName}`);
          log(`   Task: ${message.agentNode?.task || "N/A"}`);
          break;

        case "agent_result":
          if (message.error) {
            log(`\n❌ Agent Error: ${message.agentName}`);
            log(`   Error: ${message.error}`);
          } else {
            log(`\n✅ Agent Completed: ${message.agentName}`);
            if (message.result) {
              const preview = message.result.substring(0, 200);
              log(`   Result: ${preview}${message.result.length > 200 ? "..." : ""}`);
            }
          }
          break;

        case "tool_result":
          const toolIcon = message.toolResult?.isError ? "❌" : "✓";
          log(`  ${toolIcon} Tool: ${message.toolName}`);
          if (message.toolResult?.content?.[0]?.text) {
            const text = message.toolResult.content[0].text;
            const preview = text.substring(0, 100);
            log(`    Result: ${preview}${text.length > 100 ? "..." : ""}`);
          }
          break;

        case "llm_response":
          if (config.verbose) {
            log(`  💭 LLM thinking...`);
          }
          break;
      }
    },

    // Human interaction callbacks
    onHumanConfirm: async (message, options) => {
      return new Promise((resolve) => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        rl.question(`\n🙋 Confirm: ${message} (y/n): `, (answer) => {
          rl.close();
          resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
        });
      });
    },

    onHumanInput: async (message, options) => {
      return new Promise((resolve) => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        rl.question(`\n🙋 Input: ${message}: `, (answer) => {
          rl.close();
          resolve(answer);
        });
      });
    },

    onHumanSelect: async (message, choices) => {
      return new Promise((resolve) => {
        console.log(`\n🙋 Select: ${message}`);
        choices.forEach((choice, i) => {
          console.log(`  ${i + 1}. ${choice}`);
        });
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        rl.question("Enter number: ", (answer) => {
          rl.close();
          const index = parseInt(answer, 10) - 1;
          resolve(choices[index] || choices[0]);
        });
      });
    },
  };
}

// ============================================================================
// Browser Mode Runner
// ============================================================================

class BrowserModeRunner {
  constructor(config) {
    this.config = config;
    this.browserAgent = null;
    this.page = null;
  }

  async init() {
    const log = this.config.verbose ? console.log : () => { };
    log("\n🌐 Initializing BrowserAgent...");

    try {
      // Try to load the built module first
      const { BrowserAgent } = require("../dist/index.cjs.js");
      this.browserAgent = new BrowserAgent();
      this.browserAgent.setHeadless(this.config.headless);

      if (this.config.userDataDir) {
        this.browserAgent.initUserDataDir(this.config.userDataDir);
      }

      log("✅ BrowserAgent ready!");
      return true;
    } catch (e) {
      log(`⚠️  Could not load BrowserAgent from built module: ${e.message}`);
      log("   Falling back to direct Playwright mode...");
      return false;
    }
  }

  async runTask(task) {
    const log = this.config.verbose ? console.log : () => { };

    log("\n" + "═".repeat(70));
    log(`📋 Task: ${task.substring(0, 100)}${task.length > 100 ? "..." : ""}`);
    log("═".repeat(70));

    // If BrowserAgent is available, use full Eko integration
    if (this.browserAgent) {
      return await this.runWithEko(task);
    } else {
      // Fallback to simplified mode
      return await this.runSimplified(task);
    }
  }

  async runWithEko(task) {
    const log = this.config.verbose ? console.log : () => { };

    try {
      const { Eko } = require("../../eko-core/dist/index.cjs.js");

      const llms = buildLLMConfig(this.config);
      const callback = createStreamCallback(this.config);

      const eko = new Eko({
        llms,
        agents: [this.browserAgent],
        callback,
      });

      log("\n🤖 Planning workflow...");
      const result = await eko.run(task);

      return result;
    } catch (e) {
      log(`❌ Eko execution failed: ${e.message}`);
      throw e;
    }
  }

  async runSimplified(task) {
    // Enhanced browser mode using direct Playwright with iterative LLM planning
    const { chromium } = require("playwright");
    const log = this.config.verbose ? console.log : () => { };

    const browser = await chromium.launch({
      headless: this.config.headless,
      slowMo: this.config.slowMo,
    });

    this.context = await browser.newContext({
      viewport: this.config.viewport,
    });

    this.page = await this.context.newPage();
    this.pages = [this.page]; // Track all tabs
    this.extractedData = {}; // Store extracted data across iterations

    try {
      const allResults = [];
      const conversationHistory = [];
      const maxIterations = 20; // Safety limit
      let iteration = 0;
      let taskComplete = false;

      log("\n🔄 Starting iterative workflow execution...");

      while (!taskComplete && iteration < maxIterations) {
        iteration++;

        // Get current page state
        const pageState = await this.getPageState();

        // Build context message
        const contextMessage = this.buildContextMessage(pageState, allResults);

        // Get next actions from LLM
        const plan = await this.planActionsIterative(task, conversationHistory, contextMessage);

        // Don't complete on first iteration with no results
        const hasResults = allResults.length > 0;
        const hasActions = plan.actions && plan.actions.length > 0;

        if (plan.complete && hasResults) {
          taskComplete = true;
          if (plan.summary) {
            log(`\n📊 Task Summary: ${plan.summary}`);
            allResults.push(`Summary: ${plan.summary}`);
          }
          break;
        }

        // If no actions but not complete, or first iteration with no actions, prompt again
        if (!hasActions) {
          if (iteration >= 3) {
            log(`\n⚠️ No actions returned after ${iteration} iterations, stopping`);
            break;
          }
          conversationHistory.push({
            role: "user",
            content: "You returned no actions. Please provide the actual browser actions needed to complete the task."
          });
          continue;
        }

        log(`\n🔄 Iteration ${iteration}: ${plan.explanation}`);

        // Execute actions
        for (const action of plan.actions) {
          try {
            const result = await this.executeAction(action);
            allResults.push(result);
            log(`  ✓ ${result}`);

            // Brief pause between actions
            await this.page.waitForTimeout(500);
          } catch (actionError) {
            // Check if browser context was closed - attempt recovery
            if (actionError.message && actionError.message.includes('has been closed')) {
              log(`  ⚠️ Browser context closed, attempting recovery...`);
              try {
                // Reinitialize browser - this is a simplified approach
                // In production, you'd want to restore the last URL as well
                const chromium = require('playwright').chromium;
                const newBrowser = await chromium.launch({ headless: this.config.headless });
                const newContext = await newBrowser.newContext();
                this.page = await newContext.newPage();
                this.context = newContext;
                this.browser = newBrowser;
                this.pages = [this.page];
                allResults.push('Browser recovered - session restarted');
                log(`  🔄 Browser recovered successfully`);
                // Skip to next iteration to let LLM replan
                break;
              } catch (recoveryError) {
                allResults.push(`Browser recovery failed: ${recoveryError.message}`);
                log(`  ❌ Recovery failed: ${recoveryError.message}`);
              }
            }
            const errorMsg = `Action failed: ${action.type} - ${actionError.message}`;
            log(`  ❌ ${errorMsg}`);
            allResults.push(errorMsg);
          }
        }

        // Add to conversation history for context
        conversationHistory.push({
          role: "assistant",
          content: JSON.stringify(plan)
        });
        conversationHistory.push({
          role: "user",
          content: `Actions executed. Results: ${allResults.slice(-3).join("; ")}. Current state: ${await this.getPageState().then(s => s.url)}`
        });
      }

      // Generate final summary if we have extracted data
      if (Object.keys(this.extractedData).length > 0) {
        log("\n📋 Extracted Data:");
        Object.entries(this.extractedData).forEach(([key, value]) => {
          log(`  ${key}: ${JSON.stringify(value).substring(0, 100)}...`);
        });
      }

      return { success: true, result: allResults.join("\n"), data: this.extractedData };
    } finally {
      await browser.close();
    }
  }

  async getPageState() {
    try {
      const url = this.page.url();
      const title = await this.page.title();

      // Extract semantic role information using Playwright locators
      const roles = {
        buttons: [],
        headings: [],
        links: [],
        textboxes: 0,
        checkboxes: 0,
        forms: 0
      };

      // Get button texts (limit to first 10 to avoid token bloat)
      const buttons = await this.page.getByRole('button').all().catch(() => []);
      for (let i = 0; i < Math.min(buttons.length, 10); i++) {
        const text = await buttons[i].textContent().catch(() => '');
        if (text && text.length > 0 && text.length < 50) {
          roles.buttons.push(text.trim());
        }
      }

      // Get heading texts (limit to first 5)
      const headings = await this.page.getByRole('heading').all().catch(() => []);
      for (let i = 0; i < Math.min(headings.length, 5); i++) {
        const text = await headings[i].textContent().catch(() => '');
        if (text && text.length > 0 && text.length < 100) {
          roles.headings.push(text.trim());
        }
      }

      // Get link texts (limit to first 8)
      const links = await this.page.getByRole('link').all().catch(() => []);
      for (let i = 0; i < Math.min(links.length, 8); i++) {
        const text = await links[i].textContent().catch(() => '');
        if (text && text.length > 0 && text.length < 50) {
          roles.links.push(text.trim());
        }
      }

      // Count interactive elements (no text needed)
      roles.textboxes = await this.page.getByRole('textbox').count().catch(() => 0);
      roles.checkboxes = await this.page.getByRole('checkbox').count().catch(() => 0);

      // Check for ARIA landmarks
      const landmarks = {
        navigation: await this.page.locator('[role="navigation"]').count().catch(() => 0) > 0,
        main: await this.page.locator('main, [role="main"]').count().catch(() => 0) > 0,
        form: await this.page.locator('form').count().catch(() => 0) > 0
      };
      roles.forms = landmarks.form ? 1 : 0;

      // Get visible text elements for context (keep existing logic)
      const visibleText = await this.page.evaluate(() => {
        const elements = [];
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) => {
              if (!node.parentElement) return NodeFilter.FILTER_REJECT;
              const style = window.getComputedStyle(node.parentElement);
              if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                return NodeFilter.FILTER_REJECT;
              }
              return NodeFilter.FILTER_ACCEPT;
            }
          },
          false
        );

        let count = 0;
        while (walker.nextNode() && count < 200) {
          const text = walker.currentNode.textContent.trim();
          if (text.length > 2 && text.length < 200) {
            // Add interactive indicators
            const parent = walker.currentNode.parentElement;
            const isInteractive = parent.tagName === 'BUTTON' ||
              parent.tagName === 'A' ||
              parent.onclick ||
              parent.role === 'button' ||
              parent.className.includes('btn');

            elements.push(isInteractive ? `[${text}]` : text);
            count++;
          }
        }
        return elements.slice(0, 100).join(" | ");
      }).catch(() => "");

      return {
        url,
        title,
        tabCount: this.pages.length,
        roles,
        landmarks,
        visibleText: visibleText.substring(0, 2000)
      };
    } catch (e) {
      return {
        url: "unknown",
        title: "unknown",
        tabCount: 1,
        roles: { buttons: [], headings: [], links: [], textboxes: 0, checkboxes: 0, forms: 0 },
        landmarks: { navigation: false, main: false, form: false },
        visibleText: ""
      };
    }
  }

  buildContextMessage(pageState, results) {
    // Build semantic role context
    const roleContext = [];

    if (pageState.roles) {
      if (pageState.roles.buttons.length > 0) {
        roleContext.push(`Buttons: ${pageState.roles.buttons.join(", ")}`);
      }
      if (pageState.roles.headings.length > 0) {
        roleContext.push(`Headings: ${pageState.roles.headings.join(", ")}`);
      }
      if (pageState.roles.textboxes > 0) {
        roleContext.push(`Input fields: ${pageState.roles.textboxes}`);
      }
      if (pageState.roles.checkboxes > 0) {
        roleContext.push(`Checkboxes: ${pageState.roles.checkboxes}`);
      }
      if (pageState.roles.forms > 0) {
        roleContext.push(`Forms: ${pageState.roles.forms}`);
      }
      if (pageState.roles.links.length > 0) {
        roleContext.push(`Links: ${pageState.roles.links.slice(0, 5).join(", ")}${pageState.roles.links.length > 5 ? "..." : ""}`);
      }
    }

    return `Current page: ${pageState.url}
Title: ${pageState.title}
Open tabs: ${pageState.tabCount}
Recent actions: ${results.slice(-5).join("; ")}
Page elements: ${roleContext.length > 0 ? roleContext.join(" | ") : "No semantic elements detected"}
Visible content preview: ${pageState.visibleText.substring(0, 300)}`;
  }

  async planActionsIterative(task, history, context) {
    const response = await this.callLLMIterative(task, history, context);
    try {
      let jsonStr = response;
      // Extract JSON from markdown code blocks if present
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) jsonStr = jsonMatch[1];

      // Try to parse the response
      const parsed = JSON.parse(jsonStr);
      return {
        explanation: parsed.explanation || "Executing actions",
        actions: parsed.actions || [],
        complete: parsed.complete || false,
        summary: parsed.summary || null
      };
    } catch (e) {
      console.error(`  ⚠️ Could not parse LLM response: ${e.message}`);
      return { explanation: "Parse error", actions: [], complete: true };
    }
  }

  async callLLMIterative(task, history, context) {
    const https = require("https");
    const http = require("http");
    const url = require("url");

    const config = this.config.llm;
    let baseUrl = config.baseUrl;
    if (!baseUrl.endsWith("/v1") && !baseUrl.includes("/v1/")) {
      baseUrl = baseUrl.replace(/\/$/, "") + "/v1";
    }
    const endpoint = `${baseUrl}/chat/completions`;

    const systemPrompt = `You are a browser automation assistant executing a multi-step workflow iteratively.

AVAILABLE ACTIONS:
- { "type": "navigate", "url": "https://..." }
- { "type": "click", "selector": "selector" }
- { "type": "type", "selector": "selector", "text": "text to type" }
- { "type": "press", "key": "Enter|Tab|Escape" }
- { "type": "wait", "ms": 1000 }
- { "type": "screenshot", "name": "filename" }
- { "type": "scroll", "direction": "up|down", "amount": 300 }
- { "type": "extract", "key": "dataName", "selector": "selector", "attribute": "text|href|src" }
- { "type": "extract_all", "key": "dataName", "selector": "selector", "attribute": "text" }
- { "type": "new_tab", "url": "https://..." }
- { "type": "switch_tab", "index": 0 }
- { "type": "close_tab" }
- { "type": "wait_for_selector", "selector": "selector" }
- { "type": "hover", "selector": "selector" }
- { "type": "select", "selector": "selector", "value": "option value" }

SELECTOR BEST PRACTICES (in priority order):
1. TEXT-BASED (Most Reliable):
   - For buttons/links: "text=Submit" or "text=Click here"
   - For partial text: "text=More" (matches "More Info", "Read More", etc.)

2. ROLE-BASED (Semantic):
   - Buttons: "role=button[name='Submit']"
   - Links: "role=link[name='Learn More']"
   - Inputs: "role=textbox[name='Email']"
   - Checkboxes: "role=checkbox[name='Subscribe']"

3. FORM LABELS (For inputs):
   - "label=Email" (finds input with label "Email")
   - "placeholder=Search..." (finds input by placeholder)

4. CSS SELECTORS (Last Resort):
   - Only use when text/role/label won't work
   - Prefer simple selectors: "button", "input[type=email]", "#submit-btn"
   - AVOID dynamic classes: ".MuiButton-root-xyz123"

SELECTOR EXAMPLES:
✓ GOOD: "text=Generate", "text=More Info", "text=Sign In"
✓ GOOD: "role=button[name='Generate']", "label=Search"
✗ BAD: ".css-1a2b3c4-button", "button:nth-child(3)"
✗ BAD: Complex selectors with dynamic IDs or class names

CRITICAL RULES:
1. You MUST actually execute actions - don't just claim you did them
2. Execute 2-5 related actions per iteration
3. Only set "complete": true AFTER all required actions are executed
4. Use "extract" with a unique "key" to save important data
5. For multi-site comparisons, use "new_tab" to open additional sites
6. If the task asks to extract data, you MUST include extract actions
7. If the task asks for a screenshot, you MUST include a screenshot action
8. ALWAYS prefer text= selectors for clickable elements with visible text

RESPONSE FORMAT (JSON only, no markdown):
{
  "explanation": "What you're doing in this step",
  "actions": [...],
  "complete": false,
  "summary": "Final summary when complete=true"
}`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `ORIGINAL TASK:\n${task}\n\nCURRENT STATE:\n${context}` },
      ...history.slice(-6) // Keep last 3 exchanges for context
    ];

    return new Promise((resolve, reject) => {
      const parsedUrl = new url.URL(endpoint);
      const protocol = parsedUrl.protocol === "https:" ? https : http;

      const requestBody = JSON.stringify({
        model: config.model,
        messages,
        max_tokens: 2000,
        temperature: 0.3, // Lower temperature for more consistent actions
      });

      const req = protocol.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestBody),
          "Authorization": `Bearer ${config.apiKey}`,
        },
      }, (res) => {
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
          try {
            if (res.statusCode >= 400) {
              console.error(`  ⚠️ LLM API Error (${res.statusCode}): ${data.substring(0, 200)}`);
              resolve('{"explanation":"API error","actions":[],"complete":true}');
              return;
            }
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.message?.content || "{}";
            resolve(content);
          } catch (e) {
            console.error(`  ⚠️ JSON Parse Error: ${e.message}`);
            resolve('{"explanation":"Parse error","actions":[],"complete":true}');
          }
        });
      });

      req.on("error", (e) => {
        console.error(`  ⚠️ Request Error: ${e.message}`);
        resolve('{"explanation":"Request error","actions":[],"complete":true}');
      });

      req.write(requestBody);
      req.end();
    });
  }

  async planActions(task) {
    const response = await this.callLLM(task);
    try {
      let jsonStr = response;
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) jsonStr = jsonMatch[1];
      return JSON.parse(jsonStr);
    } catch (e) {
      return { explanation: "Direct execution", actions: [] };
    }
  }

  async callLLM(task) {
    const https = require("https");
    const http = require("http");
    const url = require("url");

    const config = this.config.llm;
    // Ensure proper endpoint path
    let baseUrl = config.baseUrl;
    if (!baseUrl.endsWith("/v1") && !baseUrl.includes("/v1/")) {
      baseUrl = baseUrl.replace(/\/$/, "") + "/v1";
    }
    const endpoint = `${baseUrl}/chat/completions`;

    const systemPrompt = `You are a browser automation assistant. Output ONLY valid JSON with browser actions.

Available actions:
- { "type": "navigate", "url": "https://..." }
- { "type": "click", "selector": "css selector or text=content" }
- { "type": "type", "selector": "css selector", "text": "text to type" }
- { "type": "press", "key": "Enter|Tab|Escape|etc" }
- { "type": "wait", "ms": 1000 }
- { "type": "screenshot", "name": "optional-name" }
- { "type": "scroll", "direction": "up|down", "amount": 300 }
- { "type": "extract", "selector": "css selector", "attribute": "text|href|src" }

Respond with ONLY this JSON format (no markdown, no explanation outside JSON):
{
  "explanation": "Brief description of what you'll do",
  "actions": [...]
}`;

    return new Promise((resolve, reject) => {
      const parsedUrl = new url.URL(endpoint);
      const protocol = parsedUrl.protocol === "https:" ? https : http;

      const requestBody = JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Task: ${task}` },
        ],
        max_tokens: 2000,
      });

      const req = protocol.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestBody),
          "Authorization": `Bearer ${config.apiKey}`,
        },
      }, (res) => {
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
          try {
            if (res.statusCode >= 400) {
              console.error(`  ⚠️ LLM API Error (${res.statusCode}): ${data.substring(0, 200)}`);
              resolve('{"explanation":"API error","actions":[]}');
              return;
            }
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.message?.content || "{}";
            resolve(content);
          } catch (e) {
            console.error(`  ⚠️ JSON Parse Error: ${e.message}`);
            console.error(`  Response preview: ${data.substring(0, 200)}`);
            resolve('{"explanation":"Parse error","actions":[]}');
          }
        });
      });

      req.on("error", (e) => {
        console.error(`  ⚠️ Request Error: ${e.message}`);
        resolve('{"explanation":"Request error","actions":[]}');
      });

      req.write(requestBody);
      req.end();
    });
  }

  // Sanitize selector to convert invalid patterns to valid Playwright selectors
  sanitizeSelector(selector) {
    if (!selector || typeof selector !== 'string') return selector;

    // Convert jQuery :contains() to Playwright text= selector
    // e.g., "button:contains('Generate')" -> "text=Generate"
    const containsMatch = selector.match(/:contains\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
    if (containsMatch) {
      const text = containsMatch[1];
      const prefix = selector.split(':contains')[0].trim();
      // If there's a tag prefix like "button", use it with text
      if (prefix && prefix !== selector) {
        return `${prefix}:has-text("${text}")`;
      }
      return `text=${text}`;
    }

    // Convert :has-text without proper quoting
    if (selector.includes(':has-text(') && !selector.includes(':has-text("')) {
      return selector.replace(/:has-text\(([^)]+)\)/g, ':has-text("$1")');
    }

    return selector;
  }

  async executeAction(action) {
    if (!this.page) return "No page available";

    // Sanitize selector if present
    if (action.selector) {
      action.selector = this.sanitizeSelector(action.selector);
    }

    switch (action.type) {
      case "navigate":
        await this.page.goto(action.url, { waitUntil: "domcontentloaded", timeout: this.config.timeout });
        return `Navigated to ${action.url}`;

      case "click":
        try {
          const clickTimeout = action.timeout || 10000;
          const sanitizedSelector = this.sanitizeSelector(action.selector);

          // Strategy 1: Handle semantic selectors (role=, label=, placeholder=)
          // role=button[name='Submit'] → getByRole('button', { name: 'Submit' })
          const roleMatch = sanitizedSelector.match(/^role=(\w+)(?:\[name=['"]([^'"]+)['"]\])?$/i);
          if (roleMatch) {
            const [, role, name] = roleMatch;
            try {
              const roleLocator = name
                ? this.page.getByRole(role, { name })
                : this.page.getByRole(role);
              const roleCount = await roleLocator.count().catch(() => 0);
              if (roleCount > 0) {
                await roleLocator.first().click({ timeout: clickTimeout });
                return `Clicked via getByRole(${role}${name ? `, name='${name}'` : ''})`;
              }
            } catch (e) {
              console.log(`    getByRole failed: ${e.message}`);
            }
          }

          // label=Email → getByLabel('Email')
          const labelMatch = sanitizedSelector.match(/^label=(.+)$/i);
          if (labelMatch) {
            const labelText = labelMatch[1];
            try {
              const labelLocator = this.page.getByLabel(labelText);
              const labelCount = await labelLocator.count().catch(() => 0);
              if (labelCount > 0) {
                await labelLocator.first().click({ timeout: clickTimeout });
                return `Clicked via getByLabel('${labelText}')`;
              }
            } catch (e) {
              console.log(`    getByLabel failed: ${e.message}`);
            }
          }

          // placeholder=Search → getByPlaceholder('Search')
          const placeholderMatch = sanitizedSelector.match(/^placeholder=(.+)$/i);
          if (placeholderMatch) {
            const placeholderText = placeholderMatch[1];
            try {
              const placeholderLocator = this.page.getByPlaceholder(placeholderText);
              const placeholderCount = await placeholderLocator.count().catch(() => 0);
              if (placeholderCount > 0) {
                await placeholderLocator.first().click({ timeout: clickTimeout });
                return `Clicked via getByPlaceholder('${placeholderText}')`;
              }
            } catch (e) {
              console.log(`    getByPlaceholder failed: ${e.message}`);
            }
          }

          // Strategy 2: Try comma-separated selectors one by one
          if (sanitizedSelector.includes(',')) {
            const selectors = sanitizedSelector.split(',').map(s => s.trim());
            for (const sel of selectors) {
              try {
                const count = await this.page.locator(sel).count().catch(() => 0);
                if (count > 0) {
                  await this.page.locator(sel).first().click({ timeout: clickTimeout });
                  return `Clicked ${sel}`;
                }
              } catch (e) {
                // Try next selector
              }
            }
          }

          // Strategy 3: getByText for text= selectors (high priority)
          const textMatch = sanitizedSelector.match(/^text=(.+)$/i) ||
            sanitizedSelector.match(/^([a-zA-Z0-9\s]+)$/);
          if (textMatch) {
            const searchText = textMatch[1].trim();
            try {
              const textLocator = this.page.getByText(searchText, { exact: false });
              const textCount = await textLocator.count().catch(() => 0);
              if (textCount > 0) {
                await textLocator.first().click({ timeout: clickTimeout });
                return `Clicked via getByText: ${searchText}`;
              }
            } catch (e) {
              // Try force
              try {
                await this.page.getByText(searchText, { exact: false }).first().click({ timeout: clickTimeout, force: true });
                return `Force-clicked via getByText: ${searchText}`;
              } catch (e2) { }
            }
          }

          // Strategy 4: Direct CSS locator
          const locator = this.page.locator(sanitizedSelector);
          const count = await locator.count().catch(() => 0);
          if (count > 0) {
            try {
              await locator.first().click({ timeout: clickTimeout });
              return `Clicked ${sanitizedSelector}`;
            } catch (e) {
              // Try force click
              try {
                await locator.first().click({ timeout: clickTimeout, force: true });
                return `Force-clicked ${sanitizedSelector}`;
              } catch (e2) {
                console.log(`    Force click failed, trying alternatives...`);
              }
            }
          }

          // Strategy 5: Try getByRole for common interactive elements
          for (const role of ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio']) {
            try {
              const roleLocator = this.page.getByRole(role, { name: sanitizedSelector });
              const roleCount = await roleLocator.count().catch(() => 0);
              if (roleCount > 0) {
                await roleLocator.first().click({ timeout: clickTimeout });
                return `Clicked via getByRole(${role}): ${sanitizedSelector}`;
              }
            } catch (e) { }
          }

          // Strategy 6: JavaScript click via evaluate (bypasses all Playwright checks)
          const jsClicked = await this.page.evaluate((sel) => {
            // Try CSS selector first
            let el = null;
            try { el = document.querySelector(sel); } catch (e) { }

            // Try text content match if selector didn't work
            if (!el) {
              const textToFind = sel.replace(/^text[=:]"?/, '').replace(/"$/, '').toLowerCase();
              const allElements = document.querySelectorAll('a, button, [role="button"], [onclick], .btn, .card, [class*="card"], div[class*="name"], span, h1, h2, h3, h4, h5, h6');
              for (const candidate of allElements) {
                if (candidate.textContent?.toLowerCase().includes(textToFind)) {
                  el = candidate;
                  break;
                }
              }
            }

            if (el) {
              el.scrollIntoView({ block: 'center' });
              el.click();
              return true;
            }
            return false;
          }, sanitizedSelector).catch(() => false);

          if (jsClicked) {
            return `JS-clicked ${sanitizedSelector}`;
          }

          // Strategy 7: Coordinate-based click using element position
          const coordClicked = await this.page.evaluate((sel) => {
            const textToFind = sel.replace(/^text[=:]"?/, '').replace(/"$/, '').toLowerCase();
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            while (walker.nextNode()) {
              if (walker.currentNode.textContent?.toLowerCase().includes(textToFind)) {
                const parent = walker.currentNode.parentElement;
                if (parent) {
                  const rect = parent.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
                  }
                }
              }
            }
            return null;
          }, sanitizedSelector).catch(() => null);

          if (coordClicked) {
            await this.page.mouse.click(coordClicked.x, coordClicked.y);
            return `Coord-clicked ${sanitizedSelector} at (${Math.round(coordClicked.x)}, ${Math.round(coordClicked.y)})`;
          }

          throw new Error(`No clickable element found for: ${action.selector}`);
        } catch (clickError) {
          return `Click failed: ${clickError.message.substring(0, 100)}`;
        }


      case "type":
        try {
          // Strategy 1: Try standard fill on input/textarea elements
          await this.page.fill(action.selector, action.text);
          return `Typed "${action.text}"`;
        } catch (fillError) {
          // Strategy 2: Try keyboard.type for global key listeners (e.g., Wordle)
          try {
            await this.page.keyboard.type(action.text);
            return `Typed "${action.text}" via keyboard`;
          } catch (keyboardError) {
            // Strategy 3: Try clicking virtual keyboard keys (data-key attribute)
            const hasVirtualKeyboard = await this.page.$('[data-key]').catch(() => null);
            if (hasVirtualKeyboard) {
              for (const char of action.text.toLowerCase()) {
                const keySelector = `[data-key="${char}"]`;
                const keyExists = await this.page.$(keySelector).catch(() => null);
                if (keyExists) {
                  await this.page.click(keySelector);
                  await this.page.waitForTimeout(100);
                } else {
                  // Fallback to pressing the key
                  await this.page.keyboard.press(char);
                }
              }
              return `Typed "${action.text}" via virtual keyboard`;
            }
            throw fillError; // Re-throw original error if no fallback worked
          }
        }

      case "press":
        await this.page.keyboard.press(action.key);
        return `Pressed ${action.key}`;

      case "wait":
        await this.page.waitForTimeout(action.ms || 1000);
        return `Waited ${action.ms || 1000}ms`;

      case "screenshot":
        const screenshotPath = `${this.config.screenshotDir}/${action.name || Date.now()}.png`;
        fs.mkdirSync(this.config.screenshotDir, { recursive: true });
        await this.page.screenshot({ path: screenshotPath, fullPage: action.fullPage || false });
        return `Screenshot saved: ${screenshotPath}`;

      case "scroll":
        const amount = action.amount || 300;
        const direction = action.direction === "up" ? -amount : amount;
        await this.page.mouse.wheel(0, direction);
        return `Scrolled ${action.direction} by ${amount}px`;

      case "extract":
        try {
          const extractSelector = action.selector;
          const extractAttr = action.attribute || "text";
          const extracted = await this.page.evaluate(({ sel, attr }) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            if (attr === "text") return el.textContent?.trim();
            if (attr === "href") return el.href || el.getAttribute("href");
            if (attr === "src") return el.src || el.getAttribute("src");
            return el.getAttribute(attr);
          }, { sel: extractSelector, attr: extractAttr });

          if (extracted && action.key) {
            this.extractedData[action.key] = extracted;
          }
          return `Extracted [${action.key}]: ${extracted?.substring(0, 100) || "null"}`;
        } catch (e) {
          return `Extract failed: ${e.message}`;
        }

      case "extract_all":
        try {
          const selector = action.selector;
          const attribute = action.attribute || "text";
          const extractedAll = await this.page.evaluate(({ sel, attr }) => {
            const elements = document.querySelectorAll(sel);
            return Array.from(elements).slice(0, 10).map(el => {
              if (attr === "text") return el.textContent?.trim();
              if (attr === "href") return el.href || el.getAttribute("href");
              return el.getAttribute(attr);
            }).filter(Boolean);
          }, { sel: selector, attr: attribute });

          if (action.key) {
            this.extractedData[action.key] = extractedAll;
          }
          return `Extracted ${extractedAll.length} items for [${action.key}]: ${extractedAll.slice(0, 3).join("; ")}...`;
        } catch (e) {
          return `Extract all failed: ${e.message}`;
        }

      case "new_tab":
        const newPage = await this.context.newPage();
        this.pages.push(newPage);
        this.page = newPage;
        if (action.url) {
          await this.page.goto(action.url, { waitUntil: "domcontentloaded", timeout: this.config.timeout });
        }
        return `Opened new tab (${this.pages.length} total)${action.url ? ` at ${action.url}` : ""}`;

      case "switch_tab":
        const tabIndex = action.index || 0;
        if (tabIndex >= 0 && tabIndex < this.pages.length) {
          this.page = this.pages[tabIndex];
          await this.page.bringToFront();
          return `Switched to tab ${tabIndex} (${this.page.url()})`;
        }
        return `Invalid tab index: ${tabIndex}`;

      case "close_tab":
        if (this.pages.length > 1) {
          const currentIndex = this.pages.indexOf(this.page);
          await this.page.close();
          this.pages.splice(currentIndex, 1);
          this.page = this.pages[Math.max(0, currentIndex - 1)];
          return `Closed tab, now on ${this.page.url()}`;
        }
        return "Cannot close the last tab";

      case "wait_for_selector":
        await this.page.waitForSelector(action.selector, { timeout: action.timeout || this.config.timeout });
        return `Found selector: ${action.selector}`;

      case "hover":
        try {
          const sanitizedHoverSelector = this.sanitizeSelector(action.selector);
          const hoverLocator = this.page.locator(sanitizedHoverSelector);
          const hoverTimeout = action.timeout || 8000;

          // First check if element exists
          const hoverCount = await hoverLocator.count().catch(() => 0);
          if (hoverCount > 0) {
            await hoverLocator.first().hover({ timeout: hoverTimeout, force: true });
            return `Hovered over ${sanitizedHoverSelector}`;
          }

          // Try alternative selectors for common patterns
          const altSelectors = [
            sanitizedHoverSelector.replace(':nth-child', ':nth-of-type'),
            sanitizedHoverSelector.replace('.figure:nth-child(1)', '.figure >> nth=0'),
            sanitizedHoverSelector.replace('.figure:nth-child(2)', '.figure >> nth=1'),
            sanitizedHoverSelector.replace('.figure:nth-child(3)', '.figure >> nth=2'),
          ];

          for (const altSel of altSelectors) {
            const altCount = await this.page.locator(altSel).count().catch(() => 0);
            if (altCount > 0) {
              await this.page.locator(altSel).first().hover({ timeout: hoverTimeout, force: true });
              return `Hovered over ${altSel} (alt selector)`;
            }
          }

          // Try getByText for text-based selectors
          const hoverTextMatch = sanitizedHoverSelector.match(/text[=:]"?([^"]+)"?/i) ||
            sanitizedHoverSelector.match(/^([a-zA-Z0-9\s]+)$/);
          if (hoverTextMatch) {
            const hoverSearchText = hoverTextMatch[1].trim();
            try {
              const textLocator = this.page.getByText(hoverSearchText, { exact: false });
              if (await textLocator.count().catch(() => 0) > 0) {
                await textLocator.first().hover({ timeout: hoverTimeout, force: true });
                return `Hovered via getByText: ${hoverSearchText}`;
              }
            } catch (e) { }
          }

          // JS fallback: dispatch mouseover event on matching element
          const jsHovered = await this.page.evaluate((sel) => {
            let el = null;
            try { el = document.querySelector(sel); } catch (e) { }

            if (!el) {
              const textToFind = sel.replace(/^text[=:]"?/, '').replace(/"$/, '').toLowerCase();
              const allElements = document.querySelectorAll('a, button, [role="button"], .card, [class*="card"], div[class*="name"], img, .figure');
              for (const candidate of allElements) {
                if (candidate.textContent?.toLowerCase().includes(textToFind)) {
                  el = candidate;
                  break;
                }
              }
            }

            if (el) {
              el.scrollIntoView({ block: 'center' });
              el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
              el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
              return true;
            }
            return false;
          }, sanitizedHoverSelector).catch(() => false);

          if (jsHovered) {
            return `JS-hovered ${sanitizedHoverSelector}`;
          }

          throw new Error(`No elements found for selector: ${action.selector}`);
        } catch (hoverError) {
          return `Hover failed: ${hoverError.message.substring(0, 100)}`;
        }

      case "select":
        await this.page.selectOption(action.selector, action.value);
        return `Selected "${action.value}" from ${action.selector}`;

      case "store":
        if (action.key && action.value !== undefined) {
          this.extractedData[action.key] = action.value;
          return `Stored [${action.key}]: ${action.value}`;
        }
        return "Store requires key and value";

      default:
        return `Unknown action: ${action.type}`;
    }
  }

  async close() {
    // Cleanup handled in runSimplified
  }
}

// ============================================================================
// System Mode Runner
// ============================================================================

class SystemModeRunner {
  constructor(config) {
    this.config = config;
    this.systemAgent = null;
  }

  async init() {
    const log = this.config.verbose ? console.log : () => { };
    log("\n🖥️  Initializing SystemAgent...");

    try {
      const { SystemAgent } = require("../dist/index.cjs.js");
      this.systemAgent = new SystemAgent({
        workPath: this.config.workPath,
        enableShellSafety: this.config.enableShellSafety,
        restrictToWorkPath: this.config.restrictToWorkPath,
      });
      log("✅ SystemAgent ready!");
      return true;
    } catch (e) {
      log(`⚠️  Could not load SystemAgent: ${e.message}`);
      return false;
    }
  }

  async runTask(task) {
    const log = this.config.verbose ? console.log : () => { };

    log("\n" + "═".repeat(70));
    log(`📋 Task: ${task}`);
    log("═".repeat(70));

    if (this.systemAgent) {
      try {
        const { Eko } = require("../../eko-core/dist/index.cjs.js");

        const llms = buildLLMConfig(this.config);
        const callback = createStreamCallback(this.config);

        const eko = new Eko({
          llms,
          agents: [this.systemAgent],
          callback,
        });

        log("\n🤖 Planning workflow...");
        return await eko.run(task);
      } catch (e) {
        log(`❌ System execution failed: ${e.message}`);
        throw e;
      }
    }

    return { success: false, result: "SystemAgent not available" };
  }

  async close() {
    // No cleanup needed
  }
}

// ============================================================================
// Workflow Mode Runner (Full Eko)
// ============================================================================

class WorkflowModeRunner {
  constructor(config) {
    this.config = config;
    this.eko = null;
  }

  async init() {
    const log = this.config.verbose ? console.log : () => { };
    log("\n🔄 Initializing Eko Workflow Orchestrator...");

    try {
      const { Eko } = require("../../eko-core/dist/index.cjs.js");
      const { BrowserAgent, SystemAgent } = require("../dist/index.cjs.js");

      const browserAgent = new BrowserAgent();
      browserAgent.setHeadless(this.config.headless);

      const systemAgent = new SystemAgent({
        workPath: this.config.workPath,
        enableShellSafety: this.config.enableShellSafety,
      });

      const llms = buildLLMConfig(this.config);
      const callback = createStreamCallback(this.config);

      this.eko = new Eko({
        llms,
        agents: [browserAgent, systemAgent],
        callback,
      });

      log("✅ Eko Workflow Orchestrator ready!");
      log("   Agents: BrowserAgent, SystemAgent");
      return true;
    } catch (e) {
      log(`❌ Could not initialize Eko: ${e.message}`);
      if (this.config.verbose) {
        console.error(e.stack);
      }
      return false;
    }
  }

  async runTask(task) {
    const log = this.config.verbose ? console.log : () => { };

    log("\n" + "═".repeat(70));
    log(`📋 Task: ${task.substring(0, 100)}${task.length > 100 ? "..." : ""}`);
    log("═".repeat(70));

    if (!this.eko) {
      return { success: false, result: "Eko not initialized" };
    }

    log("\n🤖 AI Planning phase...");

    try {
      const result = await this.eko.run(task);

      log("\n" + "═".repeat(70));
      if (result.success) {
        log("✅ Workflow completed successfully!");
      } else {
        log(`❌ Workflow failed: ${result.stopReason}`);
      }
      log("═".repeat(70));

      return result;
    } catch (e) {
      log(`\n❌ Workflow error: ${e.message}`);
      throw e;
    }
  }

  async close() {
    // Cleanup handled by Eko
  }
}

// ============================================================================
// Interactive Mode
// ============================================================================

async function runInteractive(config) {
  printBanner();
  console.log("🎮 INTERACTIVE MODE");
  console.log("═".repeat(70));
  console.log("Commands: mode, set, vars, tools, agents, screenshot, url, help, quit");
  console.log("═".repeat(70) + "\n");

  let currentMode = config.mode || "browser";
  let runner = null;
  const variables = { ...config.variables };

  async function initRunner() {
    if (runner) {
      await runner.close?.();
    }

    switch (currentMode) {
      case "browser":
        runner = new BrowserModeRunner({ ...config, variables });
        break;
      case "system":
        runner = new SystemModeRunner({ ...config, variables });
        break;
      case "workflow":
        runner = new WorkflowModeRunner({ ...config, variables });
        break;
    }

    await runner.init();
  }

  await initRunner();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question(`eko[${currentMode}]> `, async (input) => {
      const trimmed = input.trim();
      const parts = trimmed.split(/\s+/);
      const cmd = parts[0]?.toLowerCase();

      if (cmd === "quit" || cmd === "exit") {
        console.log("\n👋 Goodbye!\n");
        rl.close();
        await runner?.close?.();
        return;
      }

      if (cmd === "help") {
        console.log(`
Commands:
  mode <browser|system|workflow>  - Switch mode
  set <VAR> <value>               - Set a variable
  vars                            - Show all variables
  tools                           - List available tools
  agents                          - List available agents
  config                          - Show current configuration
  screenshot                      - Take a screenshot (browser mode)
  url                             - Show current URL (browser mode)
  save-profile [name]             - Save browser session (cookies/localStorage)
  load-profile [name]             - Load saved browser session
  click-role <role> [name]        - Click by ARIA role (button, link, etc.)
  fill-label <label> <value>      - Fill input by label
  click-text <text>               - Click by visible text
  aria-snapshot                   - Get accessibility tree
  clear                           - Clear screen
  quit, exit                      - Exit interactive mode
  <anything else>                 - Execute as task
`);
        prompt();
        return;
      }

      if (cmd === "mode") {
        const newMode = parts[1];
        if (["browser", "system", "workflow"].includes(newMode)) {
          currentMode = newMode;
          console.log(`\nSwitching to ${newMode} mode...`);
          await initRunner();
        } else {
          console.log("Invalid mode. Use: browser, system, or workflow");
        }
        prompt();
        return;
      }

      if (cmd === "set") {
        const varName = parts[1];
        const varValue = parts.slice(2).join(" ");
        if (varName && varValue) {
          variables[varName] = varValue;
          console.log(`Set ${varName} = ${varValue}`);
        } else {
          console.log("Usage: set <VAR> <value>");
        }
        prompt();
        return;
      }

      if (cmd === "vars") {
        console.log("\nVariables:");
        Object.entries(variables).forEach(([k, v]) => {
          console.log(`  ${k} = ${v}`);
        });
        console.log("");
        prompt();
        return;
      }

      if (cmd === "tools") {
        printTools();
        prompt();
        return;
      }

      if (cmd === "agents") {
        printAgents();
        prompt();
        return;
      }

      if (cmd === "config") {
        showConfig({ ...config, mode: currentMode, variables });
        prompt();
        return;
      }

      if (cmd === "clear") {
        console.clear();
        prompt();
        return;
      }

      // Profile persistence commands
      if (cmd === "save-profile") {
        const profileName = parts[1] || "default";
        const profilePath = path.join(config.screenshotDir, `profile-${profileName}.json`);
        try {
          if (runner?.context) {
            await runner.context.storageState({ path: profilePath });
            console.log(`✅ Profile saved to: ${profilePath}`);
          } else {
            console.log("❌ No browser context available. Navigate to a page first.");
          }
        } catch (e) {
          console.error(`❌ Failed to save profile: ${e.message}`);
        }
        prompt();
        return;
      }

      if (cmd === "load-profile") {
        const profileName = parts[1] || "default";
        const profilePath = path.join(config.screenshotDir, `profile-${profileName}.json`);
        try {
          if (fs.existsSync(profilePath)) {
            // Store profile path to use on next context creation
            config.storageState = profilePath;
            console.log(`✅ Profile will be loaded from: ${profilePath}`);
            console.log("   (Restart browser mode or navigate to apply)");
          } else {
            console.log(`❌ Profile not found: ${profilePath}`);
          }
        } catch (e) {
          console.error(`❌ Failed to set profile: ${e.message}`);
        }
        prompt();
        return;
      }

      // Semantic locator: click-role
      if (cmd === "click-role") {
        const role = parts[1];
        const name = parts.slice(2).join(" ") || undefined;
        if (!role) {
          console.log("Usage: click-role <role> [name]");
          console.log("Roles: button, link, checkbox, radio, textbox, heading, listitem, menuitem, tab");
        } else {
          try {
            const page = await runner?.browserRunner?.browserAgent?.currentPage?.();
            if (page) {
              await page.getByRole(role, { name }).click();
              console.log(`✅ Clicked ${role}${name ? ` "${name}"` : ""}`);
            } else {
              console.log("❌ No browser page active");
            }
          } catch (e) {
            console.error(`❌ Failed: ${e.message}`);
          }
        }
        prompt();
        return;
      }

      // Semantic locator: fill-label
      if (cmd === "fill-label") {
        const label = parts[1];
        const value = parts.slice(2).join(" ");
        if (!label || !value) {
          console.log("Usage: fill-label <label> <value>");
        } else {
          try {
            const page = await runner?.browserRunner?.browserAgent?.currentPage?.();
            if (page) {
              await page.getByLabel(label).fill(value);
              console.log(`✅ Filled "${label}" with "${value}"`);
            } else {
              console.log("❌ No browser page active");
            }
          } catch (e) {
            console.error(`❌ Failed: ${e.message}`);
          }
        }
        prompt();
        return;
      }

      // Semantic locator: click-text
      if (cmd === "click-text") {
        const text = parts.slice(1).join(" ");
        if (!text) {
          console.log("Usage: click-text <text>");
        } else {
          try {
            const page = await runner?.browserRunner?.browserAgent?.currentPage?.();
            if (page) {
              await page.getByText(text).click();
              console.log(`✅ Clicked text "${text}"`);
            } else {
              console.log("❌ No browser page active");
            }
          } catch (e) {
            console.error(`❌ Failed: ${e.message}`);
          }
        }
        prompt();
        return;
      }

      // Semantic locator: aria-snapshot
      if (cmd === "aria-snapshot") {
        try {
          const page = await runner?.browserRunner?.browserAgent?.currentPage?.();
          if (page) {
            const snapshot = await page.locator("body").ariaSnapshot();
            console.log("\n📋 ARIA Snapshot:\n");
            console.log(snapshot);
          } else {
            console.log("❌ No browser page active");
          }
        } catch (e) {
          console.error(`❌ Failed: ${e.message}`);
        }
        prompt();
        return;
      }

      if (trimmed) {
        // Substitute variables
        const task = substituteVariables(trimmed, variables);

        try {
          const result = await runner.runTask(task);
          if (result?.result) {
            console.log("\n📊 Result:", result.result);
          }
        } catch (e) {
          console.error(`\n❌ Error: ${e.message}`);
        }
      }

      prompt();
    });
  };

  prompt();
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

  if (args.listTools) {
    printTools();
    process.exit(0);
  }

  if (args.listAgents) {
    printAgents();
    process.exit(0);
  }

  if (args.listExamples) {
    printExamples();
    process.exit(0);
  }

  // Merge configuration
  const config = {
    ...defaultConfig,
    ...args.config,
    mode: args.mode || args.config.mode || defaultConfig.mode,
    llm: {
      ...defaultConfig.llm,
      ...(args.config.llm || {}),
    },
    variables: {
      ...defaultConfig.variables,
      ...(args.config.variables || {}),
    },
  };

  if (loadedEnvPath) {
    console.log(`📁 Loaded .env from: ${loadedEnvPath}`);
  }

  if (args.showConfig) {
    showConfig(config);
    if (!args.task && !args.file && !args.interactive) {
      process.exit(0);
    }
  }

  // Validate API key
  if (!config.llm.apiKey) {
    console.error("❌ Error: No API key provided.");
    console.error("Set OPENAI_COMPATIBLE_API_KEY or use --api-key=<key>");
    process.exit(1);
  }

  console.log("\n🤖 LLM Configuration:");
  console.log(`   Provider: ${config.llm.provider}`);
  console.log(`   Model:    ${config.llm.model}`);
  console.log(`   Endpoint: ${config.llm.baseUrl}`);

  // Interactive mode
  if (args.interactive) {
    await runInteractive(config);
    return;
  }

  // Get task
  let task = args.task;

  if (args.file) {
    const filePath = path.resolve(args.file);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const { metadata, content } = parseFrontmatter(fileContent);

    if (Object.keys(metadata).length > 0) {
      console.log(`\n📄 Task file metadata:`);
      console.log(`   Title: ${metadata.title || "N/A"}`);
      console.log(`   Category: ${metadata.category || "N/A"}`);
      console.log(`   Difficulty: ${metadata.difficulty || "N/A"}`);
    }

    task = content.trim();
  }

  if (!task) {
    console.error("❌ No task provided.");
    console.error("Use: node cli/eko-playground-full.cjs <task>");
    console.error("  or: node cli/eko-playground-full.cjs -i");
    process.exit(1);
  }

  // Substitute variables
  task = substituteVariables(task, config.variables);

  // Create appropriate runner
  let runner;
  switch (config.mode) {
    case "system":
      runner = new SystemModeRunner(config);
      break;
    case "workflow":
      runner = new WorkflowModeRunner(config);
      break;
    case "browser":
    default:
      runner = new BrowserModeRunner(config);
      break;
  }

  try {
    await runner.init();
    const result = await runner.runTask(task);

    console.log("\n📊 Final Result:");
    console.log(result?.result || "No result");

    if (!config.headless && config.mode === "browser") {
      console.log("\n⏳ Browser will close in 5 seconds...");
      await new Promise((r) => setTimeout(r, 5000));
    }

    await runner.close?.();
  } catch (e) {
    console.error(`\n❌ Fatal Error: ${e.message}`);
    if (config.verbose) {
      console.error(e.stack);
    }
    process.exit(1);
  }
}

// Export for programmatic use
module.exports = {
  BrowserModeRunner,
  SystemModeRunner,
  WorkflowModeRunner,
  parseArgs,
  substituteVariables,
  parseFrontmatter,
  buildLLMConfig,
  createStreamCallback,
};

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}
