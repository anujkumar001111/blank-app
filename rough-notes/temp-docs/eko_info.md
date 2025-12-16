Eko AI Agent Framework: Complete Codebase Walkthrough
1. What is Eko?
Eko is a production-ready JavaScript framework for building AI agents that can run in multiple environments (Node.js, Browser, Electron, Extensions). It converts a natural language prompt into a structured workflow and executes it using specialized agents.

2. Repository Structure
Eko/
├── eko-original/                 # <-- THE MAIN CODEBASE (pnpm monorepo)
│   ├── packages/
│   │   ├── eko-core/             # Platform-agnostic core logic
│   │   ├── eko-nodejs/           # Node.js runtime (Playwright)
│   │   ├── eko-web/              # Browser DOM runtime
│   │   ├── eko-extension/        # Chrome Extension APIs
│   │   └── eko-electron/         # Electron App integration
│   └── example/                  # Demo projects
├── CLAUDE.md                     # AI assistant instructions
├── AGENTS.md                     # Copy for other AI IDEs
└── rough-notes/                  # Planning docs
3. Package Breakdown
Package	Purpose	Key Constraint
eko-core	LLM calls, Planning, Agent base class, Tools	No fs, path, or browser-specific APIs
eko-nodejs	Node.js. Uses Playwright for browser control	File ops, shell commands, real browser
eko-web	Runs directly in a web page	Uses html2canvas for screenshots, DOM APIs
eko-extension	Chrome Extension (MV3)	Uses chrome.* APIs
eko-electron	Electron desktop apps	Bridges Node.js and Electron APIs
4. Core Architecture (eko-core/src/)
eko-core/src/
├── agent/          # Core Agent logic
│   ├── eko.ts      # <-- Main entry point: Eko class
│   ├── plan.ts     # <-- Planner: converts prompt -> workflow
│   ├── base.ts     # <-- Agent base class (ReAct loop)
│   ├── chain.ts    # Execution history (Chain of Thought)
│   └── browser/    # Abstract browser agent definitions
├── llm/            # LLM provider abstraction (Anthropic, OpenAI, Google)
├── mcp/            # Model Context Protocol clients
├── tools/          # Built-in tools (variables, human interact, etc.)
├── prompt/         # System/User prompt templates
├── types/          # TypeScript interfaces
└── index.ts        # Public exports
5. Key Files Explained
eko-core/src/agent/eko.ts
 (The Brain)
The 
Eko
 class is the main entry point.

run(prompt)
: High-level method. Calls 
generate()
 then 
execute()
.
generate(prompt)
: Uses 
Planner
 to create a 
Workflow
.
execute(taskId)
: Runs the workflow agent by agent.
Task Lifecycle: Start, Pause, Resume, Abort.
eko-core/src/agent/plan.ts
 (The Planner)
The 
Planner
 class converts a user's natural language into a structured XML workflow.

Calls the LLM with a planning prompt.
Parses the LLM's XML output into a 
Workflow
 object.
eko-core/src/agent/base.ts
 (The Agent)
The 
Agent
 base class defines how an agent thinks and acts.

run(context, chain)
: Entry point for executing an agent node.
runWithContext(...)
: The ReAct Loop. Calls LLM, executes tools, repeats.
Uses callAgentLLM to interact with the model.
Tools are dynamically loaded (including from MCP servers).
eko-nodejs/src/browser.ts
 (Node.js Browser Agent)
Implements BaseBrowserLabelsAgent from eko-core.

Uses Playwright to launch/control a real Chromium browser.
Methods: 
screenshot()
, 
navigate_to()
, 
click_element()
, 
input_text()
, etc.
Includes anti-detection ("stealth") logic.
6. Execution Flow (ASCII Diagram)
┌─────────────────────────────────────────────────────────────────────────────┐
│                            USER PROMPT                                      │
│      "Search for the latest news about AI and save it to ai_news.md"        │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  1. EKO.generate(prompt)                                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  PLANNER                                                                │  │
│  │  ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐ │  │
│  │  │ Build System     │ ──▶ │ Call LLM         │ ──▶ │ Parse XML       │ │  │
│  │  │ Prompt (Agents)  │     │ (Streaming)      │     │ Output          │ │  │
│  │  └──────────────────┘     └──────────────────┘     └─────────────────┘ │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                   │                                          │
│                                   ▼                                          │
│                        ┌──────────────────────┐                              │
│                        │      WORKFLOW        │                              │
│                        │  ┌────────────────┐  │                              │
│                        │  │ Agent 1:       │  │                              │
│                        │  │ BrowserAgent   │──────────┐                      │
│                        │  │ "Search Google"│  │       │ (depends on)         │
│                        │  └────────────────┘  │       │                      │
│                        │  ┌────────────────┐  │       │                      │
│                        │  │ Agent 2:       │◀─────────┘                      │
│                        │  │ FileAgent      │  │                              │
│                        │  │ "Save to file" │  │                              │
│                        │  └────────────────┘  │                              │
│                        └──────────────────────┘                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  2. EKO.execute(taskId)                                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  doRunWorkflow()                                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │  │
│  │  │                          AGENT LOOP                              │  │  │
│  │  │                                                                  │  │  │
│  │  │   ┌───────────────┐                                              │  │  │
│  │  │   │ Get Next Agent│                                              │  │  │
│  │  │   │ from Tree     │                                              │  │  │
│  │  │   └───────┬───────┘                                              │  │  │
│  │  │           │                                                      │  │  │
│  │  │           ▼                                                      │  │  │
│  │  │   ┌───────────────────────────────────────────────────────────┐  │  │  │
│  │  │   │                  runAgent()                               │  │  │  │
│  │  │   │  ┌─────────────────────────────────────────────────────┐  │  │  │  │
│  │  │   │  │               REACT LOOP (Agent)                    │  │  │  │  │
│  │  │   │  │                                                     │  │  │  │  │
│  │  │   │  │  ┌────────┐   ┌────────────┐   ┌────────────────┐  │  │  │  │  │
│  │  │   │  │  │ Build  │ → │ Call LLM   │ → │ LLM Response   │  │  │  │  │  │
│  │  │   │  │  │ Prompt │   │ (Streaming)│   │                │  │  │  │  │  │
│  │  │   │  │  └────────┘   └────────────┘   └───────┬────────┘  │  │  │  │  │
│  │  │   │  │                                        │           │  │  │  │  │
│  │  │   │  │            ┌───────────────────────────┴───────┐   │  │  │  │  │
│  │  │   │  │            │                                   │   │  │  │  │  │
│  │  │   │  │            ▼                                   ▼   │  │  │  │  │
│  │  │   │  │  ┌─────────────────┐               ┌───────────────┴┐  │  │  │  │
│  │  │   │  │  │ Tool Calls?     │               │ Text Response │  │  │  │  │
│  │  │   │  │  │ (e.g., click,   │               │ (Final Answer)│  │  │  │  │
│  │  │   │  │  │  type, save)    │               └───────┬───────┘  │  │  │  │
│  │  │   │  │  └────────┬────────┘                       │        │  │  │  │  │
│  │  │   │  │           │                                │        │  │  │  │  │
│  │  │   │  │           ▼                                │        │  │  │  │  │
│  │  │   │  │  ┌─────────────────┐                       │        │  │  │  │  │
│  │  │   │  │  │ Execute Tool    │                       │        │  │  │  │  │
│  │  │   │  │  │ (e.g., Playwright)                      │        │  │  │  │  │
│  │  │   │  │  └────────┬────────┘                       │        │  │  │  │  │
│  │  │   │  │           │                                │        │  │  │  │  │
│  │  │   │  │           ▼                                │        │  │  │  │  │
│  │  │   │  │  ┌─────────────────┐                       │        │  │  │  │  │
│  │  │   │  │  │ Tool Result Back│ ────(loop)────────────┘        │  │  │  │  │
│  │  │   │  │  │ to LLM          │                                │  │  │  │  │
│  │  │   │  │  └─────────────────┘                                │  │  │  │  │
│  │  │   │  │                                                     │  │  │  │  │
│  │  │   │  └─────────────────────────────────────────────────────┘  │  │  │  │
│  │  │   │                   │                                       │  │  │  │
│  │  │   │                   ▼                                       │  │  │  │
│  │  │   │           Agent Result String                             │  │  │  │
│  │  │   └───────────────────────────────────────────────────────────┘  │  │  │
│  │  │           │                                                      │  │  │
│  │  │           │ (If more agents in tree)                             │  │  │
│  │  │           └──────────────────────────────────loop──────────────▶│  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                   │                                          │
│                                   ▼                                          │
│                        ┌──────────────────────┐                              │
│                        │      EkoResult       │                              │
│                        │  { success: true,    │                              │
│                        │    result: "..." }   │                              │
│                        └──────────────────────┘                              │
└──────────────────────────────────────────────────────────────────────────────┘
7. Dependency Graph (Packages)
┌─────────────────────────────────────────────┐
                   │                  eko-core                   │
                   │ (LLM, Planner, Agent, Tools, Types, Memory) │
                   └──────────────┬──────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   eko-nodejs    │     │    eko-web      │     │  eko-extension  │
│  (Playwright)   │     │  (html2canvas)  │     │  (chrome.* API) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
          │
          ▼
┌─────────────────┐
│  eko-electron   │
│  (Electron)     │
└─────────────────┘
8. Built-in Tools (eko-core/src/tools/)
Tool	Purpose
VariableStorageTool	Store/retrieve variables during workflow
ForeachTaskTool	Loop over items (e.g., for each URL)
WatchTriggerTool	Watch for conditions (e.g., element appears)
HumanInteractTool	Pause for human input/confirmation
TaskNodeStatusTool	Query/update task status
TaskResultCheckTool	Verify if agent completed successfully
TodoListManagerTool	Manage a to-do list for complex tasks
9. How to Run
From the repository root:

cd eko-original && pnpm install   # Install all dependencies
cd eko-original && pnpm build     # Build all packages
cd eko-original && pnpm test      # Run all tests
Running the Playground (Interactive CLI)
cd eko-original/packages/eko-nodejs
node cli/eko-playground-full.cjs -i
10. Summary
User provides a prompt (e.g., "Find flights to Paris").
Eko.generate() calls the Planner, which asks the LLM to create a multi-step workflow.
Eko.execute() runs the workflow. For each agent in the plan:
The Agent enters a ReAct loop: Prompt LLM -> Get Tool Calls -> Execute Tools -> Return Result to LLM -> Repeat until final answer.
The result is returned to the user.

Eko Framework Capabilities Documentation

       🔧 Core Framework Components

       Eko Class (Main Orchestrator)

       - Workflow Generation: generate() - AI-powered task planning from natural language
       - Workflow Execution: execute() - Parallel/serial agent execution with error
       handling
       - Workflow Modification: modify() - Dynamic replanning during execution
       - Task Management: Pause, resume, abort, and chat with running tasks
       - Context Management: Persistent task contexts with variable storage
       - Streaming Callbacks: Real-time execution updates and agent status

       Planner System

       - Intelligent Planning: Converts natural language tasks into structured agent
       workflows
       - Replanning: Dynamic workflow modification based on execution feedback
       - XML Workflow Generation: Structured task decomposition with dependencies
       - Expert Mode: Advanced planning with loop detection and task validation

       🤖 Agent Types

       1. BrowserAgent (eko-nodejs)

       Core Capabilities:
       - Full browser automation using Playwright + Chromium
       - Stealth mode with anti-detection plugins
       - Multiple browser launch modes (CDP, persistent context, headless)
       - Cookie and localStorage management
       - Screenshot capture (JPEG/PNG with compression)
       - Tab management (multiple tabs, switching)

       Browser Tools Available:
       - navigate_to - URL navigation with load state waiting
       - current_page - Get current URL, title, tab info
       - go_back - Browser history navigation
       - get_all_tabs - List all open tabs
       - switch_tab - Switch between browser tabs
       - extract_page_content - Full page text content extraction

       2. BrowserLabelsAgent (Base Class)

       Advanced Browser Features:
       - Element Labeling: Intelligent DOM element detection with numeric indexing
       - Visual Screenshot Analysis: Screenshots with labeled bounding boxes
       - DOM Tree Building: Structured element hierarchy for analysis
       - Interactive Element Detection: Automatic identification of clickable/hoverable
       elements

       Interaction Tools:
       - input_text - Text input with element focus and Enter key support
       - click_element - Element clicking (left/right/middle mouse buttons)
       - hover_to_element - Mouse hover for dynamic content
       - scroll_mouse_wheel - Smooth scrolling with content extraction
       - get_select_options - Dropdown option enumeration
       - select_option - Dropdown selection by text/value
       - wait - Configurable execution delays (200ms-10s)
       - screenshot_and_html - Combined visual + structural page capture

       3. SystemAgent (eko-nodejs)

       Shell & File System Operations:
       - Secure Shell Execution: Command execution with dangerous pattern blocking
       - File System Management: Read, write, delete, list, find operations
       - Path Security: Configurable work directory restrictions
       - Cross-Platform Support: Windows/Mac/Linux command execution

       System Tools:
       - shell_exec - Safe command execution with timeout and output capture
       - file_read - File content reading with encoding support
       - file_write - File creation/modification with directory auto-creation
       - file_delete - Safe file/directory removal
       - file_list - Directory content listing with metadata
       - file_find - Glob pattern-based file discovery

       4. ChatAgent (eko-core)

       Conversational AI Features:
       - Web Integration: Browser service integration for webpage QA
       - Memory System: Persistent conversation context
       - Tool Integration: Web search and deep action capabilities

       Chat Tools:
       - web_search - Internet search with result integration
       - webpage_qa - Browser page content question-answering
       - deep_action - Complex conversational task execution
       - variable_storage - Chat context variable management

       🛠️ Advanced Tools & Features

       Workflow Control Tools

       - ForeachTaskTool: Loop execution management for repetitive tasks
       - WatchTriggerTool: Event-based task triggering (DOM/file/GUI events)
       - HumanInteractTool: Human-in-the-loop confirmations and inputs
       - TodoListManagerTool: Task progress tracking and loop detection
       - TaskResultCheckTool: Execution result validation and completion checking
       - VariableStorageTool: Cross-agent variable sharing and persistence

       MCP (Model Context Protocol) Integration

       - External Tool Connection: HTTP and SSE-based MCP client support
       - Dynamic Tool Loading: Runtime tool discovery and integration
       - Environment-Aware: Context-specific tool availability (browser vs system)
       - Secure Execution: Sandboxed external tool execution

       LLM Configuration System

       Supported Providers:
       - OpenAI (GPT models)
       - Anthropic (Claude models)
       - Google (Gemini)
       - AWS (Bedrock)
       - OpenRouter
       - OpenAI-compatible endpoints
       - ModelScope

       Configuration Options:
       - Multiple LLM configurations per provider
       - Custom base URLs and API keys
       - Temperature, topP, maxTokens settings
       - Request/response handlers
       - Retry logic with exponential backoff

       📊 Execution Features

       Parallel Processing

       - Agent Parallelism: Concurrent agent execution with dependency management
       - Tool Parallelism: Parallel tool calls for independent operations
       - Configurable Limits: Adjustable parallelism levels

       Memory & Context Management

       - Task Persistence: Long-running task state management
       - Variable Storage: Cross-step data sharing
       - Conversation History: Chat agent memory systems
       - Snapshot Support: Execution state snapshots

       Error Handling & Recovery

       - Graceful Degradation: Continue execution on individual failures
       - Retry Mechanisms: Configurable retry attempts for LLM calls
       - Abort Signals: Clean task cancellation
       - Error Classification: Different error types (abort/error/done)

       🔒 Security Features

       Shell Safety

       - Dangerous Pattern Blocking: Prevents rm -rf /, fork bombs, etc.
       - Path Validation: Command safety analysis
       - Configurable Security: Enable/disable safety checks

       File System Security

       - Path Traversal Protection: Prevents ../ attacks
       - Work Directory Restrictions: Configurable allowed paths
       - Permission Validation: File operation authorization

       📈 Streaming & Callbacks

       Real-time Updates

       - Agent Status: Start/complete/error events
       - Tool Execution: Tool call parameters and results
       - Workflow Progress: Task completion status
       - LLM Streaming: Token-by-token response streaming

       Human Interaction

       - Confirmation Dialogs: User approval for sensitive operations
       - Input Requests: Dynamic user input collection
       - Selection Prompts: Multiple choice interactions
       - Help Requests: Login assistance and user guidance

       🎯 Special Features for CLI Playground

       Interactive Exploration

       1. Agent Playground: Try different agent types with sample tasks
       2. Tool Testing: Individual tool execution with parameter exploration
       3. Workflow Builder: Visual workflow creation and modification
       4. Browser Inspector: Live browser automation with visual feedback
       5. System Console: Safe shell and file operation testing

       Educational Features

       1. Capability Demos: Pre-built examples for each agent type
       2. Step-by-Step Tutorials: Guided introductions to framework features
       3. Performance Metrics: Execution timing and resource usage
       4. Error Scenarios: Safe error condition demonstrations

       Development Tools

       1. Configuration Editor: LLM provider and security settings
       2. Log Viewer: Real-time execution logging and debugging
       3. Memory Inspector: Context and variable state examination
       4. MCP Tool Browser: Available external tool discovery

       Safety & Testing

       1. Sandbox Mode: Isolated execution environments
       2. Command Validation: Pre-execution safety checks
       3. Resource Limits: Memory and execution time constraints
       4. Audit Logging: Complete execution history tracking

       This comprehensive feature set makes Eko an extremely powerful framework for
       building AI agent systems, with particular strength in browser automation, system
       operations, and extensible tool integration through MCP. The CLI playground should
       expose all these capabilities in an intuitive, safe, and educational manner.