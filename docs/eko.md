<project_specification>
  <project_name>Eko Agent Framework</project_name>

  <overview>
    Eko is a TypeScript agent framework and SDK that plans and executes multi-agent workflows across Node.js, browsers (web/extension), and Electron. It targets developers building automation and LLM-powered task orchestration; the core value is reliable plan→execute loops with tool/MCP integration and platform-specific agents. Success is measured by shipping production-ready automation that runs uniformly across environments.
  </overview>

  <project_mode>
    framework; library/sdk; agent/automation; desktop/web/browser extension targets.
  </project_mode>

  <technology_stack>
    <api_key>
        LLM credentials are provided via environment variables (e.g., OPENAI_API_KEY, OPENAI_COMPATIBLE_API_KEY, ANTHROPIC_API_KEY) loaded by CLI/playground and tests; MCP endpoints are supplied via MCP client instances; A2A agent discovery (EkoConfig.a2aClient) can supply agents dynamically. No secrets are stored in the repo.
    </api_key>
    <frontend>
      <framework>None in core; example/web uses React 19 + react-scripts (example/web/package.json)</framework>
      <styling>Not defined in core; example/web uses dependency defaults</styling>
      <state_management>N/A for core SDK; example/web uses React local state</state_management>
      <routing>N/A (CRA defaults, no explicit router)</routing>
      <markdown>N/A</markdown>
      <code_highlighting>N/A</code_highlighting>
      <port>Example web uses react-scripts default (3000 unless overridden)</port>
    </frontend>
    <backend>
      <runtime>Node.js (>=18 per CONTRIBUTING) for build/test and Node agents</runtime>
      <database>None (SDK is stateless)</database>
      <api_integration>LLM providers via @ai-sdk (OpenAI/Anthropic/Google/Bedrock/OpenRouter/OpenAI-compatible); MCP tool servers</api_integration>
      <streaming>LLM streaming via @ai-sdk; SSE MCP client available (SimpleSseMcpClient)</streaming>
    </backend>
    <communication>
      <api>Library calls only; no HTTP API surface. MCP client uses HTTP/SSE; browser agents rely on Playwright/Chrome/Electron APIs. (Tools use JSONSchema7 schemas, not Zod.)</api>
      <streaming>LLM streams (ReadableStream) handled in RetryLanguageModel; Planner streams workflow deltas.</streaming>
      <primary_api>@ai-sdk providers and MCP clients (SimpleHttpMcpClient/SimpleSseMcpClient)</primary_api>
    </communication>
    <packaging_distribution>
      - npm packages: @eko-ai/eko (core), @eko-ai/eko-nodejs, @eko-ai/eko-web, @eko-ai/eko-extension, @eko-ai/eko-electron (package.json)
      - Artifacts: ESM (`dist/index.esm.js`), CJS (`dist/index.cjs.js`), types (`dist/index.d.ts`) per package
      - CLI: `eko-playground` (CJS) in @eko-ai/eko-nodejs
      - No signing/notarization specified
    </packaging_distribution>
    <compatibility_support_matrix>
      - Node.js: >=18; jest tests
      - Browsers: Chrome-based for extension; html2canvas for web; Playwright Chromium via Node; Electron WebContentsView support
      - OS: macOS/Linux/Windows for Node/Electron (Chrome profile paths handled for all three)
      - Semver; current version 4.0.5 (root package.json)
    </compatibility_support_matrix>
    <reliability_scaling>
      - SDK only; HA/DR left to host
      - Backpressure: RetryLanguageModel adds timeouts for first token and token gaps
      - Idempotency/caching: not provided; host responsibility
      - Data residency: not applicable (no storage)
    </reliability_scaling>
  </technology_stack>

  <prerequisites>
    <environment_setup>
      - Install: `cd eko-original && pnpm install`
      - Build: `pnpm build` (sequential across packages)
      - Test: `pnpm test` (jest across packages)
      - Env vars for LLMs: OPENAI_API_KEY or OPENAI_COMPATIBLE_API_KEY (+ model/base URL), ANTHROPIC_API_KEY, etc., depending on provider (see tests/CLI)
      - Key dirs: packages/eko-core (core runtime), packages/eko-nodejs (Node agents/CLI), packages/eko-web (browser agent), packages/eko-extension (Chrome), packages/eko-electron (Electron)
      - Platform steps: `pnpm playwright install` for Node browser agent; load `example/extension/dist` via Chrome; Electron consumers must supply WebContentsView
    </environment_setup>
  </prerequisites>

  <core_features>
    <primary_feature_area>
      - Plan→execute workflows: Planner streams XML-like workflows from LLM, then Eko executes agents serially or in parallel (eko-core/src/agent/plan.ts, eko.ts).
      - Agent ReAct loop with dynamic tools (built-in + MCP), streaming tool calls, retries, and completion checks (eko-core/src/agent/base.ts).
      - Browser automation agents for Node/Web/Extension/Electron with screenshot/navigation/script execution (platform-specific browser.ts).
      - System automation agent (Node) combining shell and file tools with safety controls (packages/eko-nodejs/src/system.ts).
    </primary_feature_area>

    <secondary_outputs_assets>
      - Workflow XML/thought streamed via callbacks (AgentStreamMessage workflow)
      - Screenshots (JPEG/PNG base64) from browser agents
      - File outputs from SystemAgent; no built-in versioning/export beyond tool results
    </secondary_outputs_assets>

    <resource_management>
      - In-memory maps for tasks and chats (eko-core/src/config/global.ts)
      - Variables per task/agent stored in context maps; no persistent CRUD
    </resource_management>

    <workspaces_projects>
      - Not provided; grouping is per chatId/taskId
    </workspaces_projects>

    <engine_tool_selection>
      - LLM selection via llms config (default + named providers)
      - Tools: built-ins (variable storage, foreach, watch, human-interact) auto-added per agent XML; platform tools (browser/system); MCP tools listed dynamically per agent/context; WebSearchTool/WebpageQaTool/DeepActionTool exist but WebSearchTool requires ChatService.websearch implementation to function
    </engine_tool_selection>

    <customization_instructions>
      - Define custom agents by extending Agent, supplying tools and optional extSysPrompt
      - Configure plan LLMs (planLlms), agent-specific llms, and optional a2a client for external agent discovery
    </customization_instructions>

    <settings_preferences>
      - Core config in eko-core/src/config/index.ts (mode, parallelism, token limits, compression); adjustable by importing and mutating or overriding defaults
      - No end-user UI settings in SDK
    </settings_preferences>

    <advanced_features>
      - Parallel agent execution when enabled; expert mode triggers replan and todo checks
      - MCP tool execution with browser context metadata when applicable
      - Pause/resume/abort with step cancellation via TaskContext controllers
    </advanced_features>

    <collaboration>Not provided (SDK).</collaboration>

    <search_discovery>Not provided; MCP tool listing only.</search_discovery>

    <usage_tracking>Not built-in; host can instrument callbacks and Log outputs.</usage_tracking>

    <onboarding>Starter examples: example/nodejs, example/web, example/extension.</onboarding>

    <accessibility>Not applicable (SDK).</accessibility>

    <responsive_design>Not applicable (SDK).</responsive_design>
  </core_features>

  <database_schema>
    <tables>None; SDK is stateless beyond process memory.</tables>
    <migrations_versioning>Not applicable.</migrations_versioning>
  </database_schema>

  <api_endpoints_summary>
    <authentication>No HTTP auth endpoints; credentials handled via env/config for LLMs.</authentication>

    <primary_resources>
      - Programmatic APIs: Eko (task lifecycle), Planner, Agent, RetryLanguageModel, TaskContext/AgentContext, MCP clients (exports in packages/eko-core/src/index.ts); optional A2A client for agent discovery.
    </primary_resources>

    <secondary_resources>
      - Tools invoked via ReAct loops; MCP tool calls proxied through MCP clients.
    </secondary_resources>

    <search>Not applicable.</search>

    <sharing>Not applicable.</sharing>

    <settings>Configured via imported config/global maps; no HTTP surface.</settings>

    <external_integrations>
      - LLM providers through @ai-sdk; MCP servers via SimpleHttpMcpClient/SimpleSseMcpClient; Playwright/Chrome/Electron APIs for browser automation.
    </external_integrations>
  </api_endpoints_summary>

  <ui_layout>
    <main_structure>Not applicable (SDK/CLI); refer to example apps if needed.</main_structure>
    <sidebar_left>Not applicable.</sidebar_left>
    <main_area>Not applicable.</main_area>
    <side_panel>Not applicable.</side_panel>
    <modals_overlays>Not applicable.</modals_overlays>
    <applicability_note>Skip UI layout for SDK/automation; use example apps for UI references.</applicability_note>
  </ui_layout>

  <design_system>
    <color_palette>Not defined (SDK only; examples use React defaults).</color_palette>
    <typography>Not defined.</typography>
    <components>Not defined.</components>
    <animations>Not defined.</animations>
    <applicability_note>Design system out of scope for core SDK.</applicability_note>
  </design_system>

  <observability>
    - Logging via eko-core/common/log (Log class) with info/debug/error; no metrics or tracing; PII handling is host responsibility.
  </observability>

  <operations>
    - No runbooks or on-call in repo; host application must provide operational processes.
  </operations>

  <security_privacy>
    - Secrets provided via env vars; README warns not to expose API keys in browser code.
    - SystemAgent enforces shell safety patterns and path restrictions; file/shell tools validate inputs (packages/eko-nodejs/src/tools).
    - No authz/roles in SDK; host controls access.
    - No compliance/data retention features (no data store).
  </security_privacy>

  <deployment_infrastructure>
    - Distribution via npm; rollup builds ESM/CJS bundles with typings.
    - Chrome extension built into example/extension/dist; Node demos via pnpm scripts; web demo via react-scripts.
    - No containers/IaC provided.
  </deployment_infrastructure>

  <release_rollout>
    - Semver with CHANGELOG.md; current version 4.0.5.
    - No feature-flag framework in core; rollback managed by dependency/version pinning.
  </release_rollout>

  <monetization_payments>Not covered in repo (open-source SDK).</monetization_payments>

  <testing_matrix>
    - Unit/integration/e2e via jest across packages; Playwright-based browser tests in nodejs package; requires LLM env vars for some tests.
    - Target environments: Node >=18; Playwright Chromium; Chrome extension; Electron WebContentsView.
  </testing_matrix>

  <performance_benchmarks>
    - No formal budgets; RetryLanguageModel adds timeouts to avoid hung streams; benchmarking not specified.
  </performance_benchmarks>

  <analytics_experimentation>
    - Not provided; host must supply any analytics/experimentation.
  </analytics_experimentation>

  <cost_finops>
    - Not covered; host responsible for API usage monitoring and budgeting.
  </cost_finops>

  <localization_internationalization>
    - Not implemented; no locale handling in SDK.
  </localization_internationalization>

  <offline_sync>
    - Not applicable; SDK assumes online LLM/MCP access.
  </offline_sync>

  <governance_compliance>
    - No compliance posture documented; host must handle GDPR/DSR/etc. if applicable.
  </governance_compliance>

  <documentation_support>
    - Docs: README.md, CHANGELOG.md, package READMEs, examples; typedoc script in core.
    - Support model not defined; community issues on GitHub per README.
  </documentation_support>

  <key_interactions>
    <primary_flow>
      1. User instantiates `Eko` with llms and agents and calls `run(taskPrompt)` (packages/eko-core/src/agent/eko.ts).
      2. Planner streams workflow XML; callbacks may receive workflow updates (AgentStreamMessage workflow).
      3. Agents execute ReAct loops with tool calls/MCP tools until final text result; optional replan in expert mode.
    </primary_flow>

    <secondary_flow>
      1. Browser agents capture screenshots and extract page content; SystemAgent reads/writes files and executes shell with safety.
      2. Outputs returned as tool results to the LLM loop, producing final summaries or artifacts.
    </secondary_flow>

    <management_flow>
      1. Tasks tracked in global.taskMap by taskId; variables stored per context/agent.
      2. Pause/resume/abort exposed via Eko methods; tasks can be deleted to clear variables.
    </management_flow>
  </key_interactions>

  <implementation_steps>
    <step number="1">
      <title>Setup Foundation</title>
      <tasks>
        - Install dependencies with pnpm; ensure Node >=18.
        - Configure LLM provider env vars; optionally configure MCP client endpoints.
        - Build packages with `pnpm build` to produce dist artifacts.
      </tasks>
    </step>

    <step number="2">
      <title>Build Core Experience</title>
      <tasks>
        - Instantiate Eko with agents (browser/system/custom) and llms config.
        - Wire AgentStreamCallback to surface workflow/agent/tool events.
        - Validate plan→execute loop with sample tasks or example projects.
      </tasks>
    </step>

    <step number="3">
      <title>Management & Organization</title>
      <tasks>
        - Implement task lifecycle controls (pause/resume/abort/delete) in host app.
        - Persist task/workflow state externally if needed (SDK uses in-memory maps).
      </tasks>
    </step>

    <step number="4">
      <title>Secondary Systems</title>
      <tasks>
        - Integrate platform agents (browser/system) as needed; supply browser contexts or work paths.
        - Add MCP integrations via SimpleHttpMcpClient/SimpleSseMcpClient for external tools.
      </tasks>
    </step>

    <step number="5">
      <title>Collaboration & Sharing</title>
      <tasks>
        - If required, build host-side sharing/export of workflows/results; SDK provides none.
      </tasks>
    </step>

    <step number="6">
      <title>Advanced Controls</title>
      <tasks>
        - Expose model/tool selection UI or config; enable expert mode/replan paths.
        - Provide custom Agent subclasses and Tool implementations for domain actions.
      </tasks>
    </step>

    <step number="7">
      <title>Settings & Customization</title>
      <tasks>
        - Surface config knobs (parallel agents, timeouts, compression, prompts) to users or configs.
        - Attach human-in-the-loop callbacks for confirmations/inputs when needed.
      </tasks>
    </step>

    <step number="8">
      <title>Polish & Performance</title>
      <tasks>
        - Add logging/metrics in host; tune timeouts and parallelism for workload.
        - Document example tasks and provide playground scripts; ensure Playwright/Electron/extension flows work.
      </tasks>
    </step>
  </implementation_steps>

  <future_roadmap>
    <high_priority>
      - HttpRequestTool (eko-core): platform-agnostic fetch wrapper (method, url, headers, body, timeout) returning status/headers/body.
    </high_priority>
    <short_term>
      - Shell session manager (eko-nodejs): shell_start/exec/view/input/kill with existing safety checks; session state scoped per TaskContext.
      - Tool result caching/retry (eko-core): design cache keys + TTL per tool and retry policy for transient errors.
    </short_term>
    <medium_term>
      - Browser console viewer (eko-nodejs/eko-electron): surface recent console logs from Playwright/Electron contexts for debugging.
    </medium_term>
    <non_goals>
      - App-layer features (email/calendar, scheduling, RAG storage, RobotJS desktop automation, deployment tooling, voice input).
    </non_goals>
  </future_roapmap>

  <success_criteria>
    <functionality>
      - Planner produces executable workflows for target tasks; agents complete without unhandled errors.
      - Tool/MCP calls execute safely (SystemAgent safety checks remain effective).
      - Browser/System agents operate in their environments (Playwright, chrome extension, Electron).
    </functionality>

    <user_experience>
      - Clear streaming callbacks and logs for progress; predictable pause/resume/abort behavior.
    </user_experience>

    <technical_quality>
      - Robust error handling and retries in RetryLanguageModel; timeouts applied to streams.
      - Secrets stay out of frontend; env-based configuration; tests green where env is supplied.
    </technical_quality>

    <design_polish>
      - Not applicable to SDK; example apps remain usable and clear.
    </design_polish>
    <reliability_targets>
       - Stream timeouts prevent hung calls; host defines SLOs if needed.
    </reliability_targets>
    <cost_targets>
       - Host monitors LLM usage; no built-in caps.
    </cost_targets>
  </success_criteria>
</project_specification>
