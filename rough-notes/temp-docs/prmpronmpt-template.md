<project_specification>
  <project_name>${PROJECT_NAME}</project_name>

  <overview>
    Provide a concise one-paragraph overview of the product you want to build, including the primary user, core value, and success outcome.
  </overview>

  <project_mode>
    Specify the mode: cli | library/sdk | framework | service/app | agent/automation | desktop/mobile | mixed. Use this to include only relevant sections.
  </project_mode>

  <technology_stack>
    <api_key>
        Describe how credentials are provided (e.g., env var, secret manager). Avoid hard-coding secrets; reference paths or variables only.
    </api_key>
    <frontend>
      <framework>${FRONTEND_FRAMEWORK}</framework>
      <styling>${STYLING_TECH}</styling>
      <state_management>${STATE_MGMT}</state_management>
      <routing>${ROUTING}</routing>
      <markdown>${MARKDOWN_LIB}</markdown>
      <code_highlighting>${CODE_HIGHLIGHTING}</code_highlighting>
      <port>Run on port ${FRONTEND_PORT}</port>
    </frontend>
    <backend>
      <runtime>${BACKEND_RUNTIME}</runtime>
      <database>${DATABASE}</database>
      <api_integration>${PRIMARY_API}</api_integration>
      <streaming>${STREAMING_TECH}</streaming>
    </backend>
    <communication>
      <api>Describe the API style (REST/GraphQL/gRPC/etc.).</api>
      <streaming>Indicate streaming/push approach (SSE/WebSockets/etc.).</streaming>
      <primary_api>${PRIMARY_API_CLIENT}</primary_api>
    </communication>
    <packaging_distribution>
      - Packaging targets (npm/pypi/nuget/homebrew/scoop/docker/apt/apk/binary installers)
      - Language/ABI targets and build artifacts
      - Signing/notarization requirements
    </packaging_distribution>
    <compatibility_support_matrix>
      - Supported runtimes/versions (node/python/java/go/etc.), OS/arch, browsers, devices
      - Backward/forward compatibility expectations and deprecation policy
    </compatibility_support_matrix>
    <reliability_scaling>
      - Availability targets (single-region vs multi-region), HA patterns, failover/DR, RPO/RTO
      - Caching, queuing, rate limiting, backpressure, idempotency
      - Data residency/localization requirements
    </reliability_scaling>
  </technology_stack>

  <prerequisites>
    <environment_setup>
      - Note required env vars and secret locations
      - Mention initial install commands (e.g., pnpm install)
      - Specify key directories (e.g., /server, /app)
      - Call out platform-specific steps
    </environment_setup>
  </prerequisites>

  <core_features>
    <primary_feature_area>
      - Summarize main user workflow and UI experience for the core feature set
      - Include real-time/streaming behavior if applicable
      - Note rendering requirements (markdown/code/math/media/etc.)
      - Input UX details (hotkeys, counters, uploads, validations)
    </primary_feature_area>

    <secondary_outputs_assets>
      - Define secondary deliverables (files, previews, generated assets, reports)
      - Include detection/creation, rendering, editing, versioning, and export expectations
    </secondary_outputs_assets>

    <resource_management>
      - Outline CRUD and organization flows for primary domain objects (e.g., documents, tasks, conversations, items)
      - Include search, pin/archive, duplication, timestamps, unread/notification indicators
    </resource_management>

    <workspaces_projects>
      - Describe grouping/organization layer (projects/teams/spaces/folders)
      - Include knowledge base or custom config per group
      - Mention sharing, templates, analytics if relevant
    </workspaces_projects>

    <engine_tool_selection>
      - List selectable engines/models/tools/services with identifiers and defaults
      - Include capability display, limits/quotas, pricing info if relevant
      - Allow mid-session switching and comparison views where applicable
    </engine_tool_selection>

    <customization_instructions>
      - Global and scoped configuration/instruction layers (project/session/item)
      - Templates/presets and preview behavior
    </customization_instructions>

    <settings_preferences>
      - Theme, typography, density, localization, accessibility knobs
      - Data export/import and privacy/security surfaces
    </settings_preferences>

    <advanced_features>
      - Tunables or domain-specific controls (e.g., parameters, thresholds, policies)
      - Multimodal inputs, branching, regeneration/iteration, suggestions/recommendations
    </advanced_features>

    <collaboration>
      - Sharing links, exports, templates, team/workspace features
    </collaboration>

    <search_discovery>
      - Global search, filters, libraries/catalogs, command palette/quick actions
    </search_discovery>

    <usage_tracking>
      - Usage/cost/consumption metrics, limits, warnings, dashboards
    </usage_tracking>

    <onboarding>
      - Welcome flow, tours, starter examples, tips, keyboard/help overlays
    </onboarding>

    <accessibility>
      - Keyboard nav, screen reader support, ARIA, contrast, reduced motion, focus management
    </accessibility>

    <responsive_design>
      - Breakpoints, touch behavior, collapsible panels, offline/PWA if needed
    </responsive_design>
  </core_features>

  <database_schema>
    <tables>
      - Define entities with fields, relationships, timestamps, status flags
      - Include JSON/config fields where flexibility is needed
      - Add sharing/linking/audit tables as required (e.g., shared_items, usage_tracking)
    </tables>
    <migrations_versioning>
      - Migration strategy (forward-only, reversible), data backfill/cleanup plans
      - Rollback/roll-forward procedures and compatibility between app and schema versions
    </migrations_versioning>
  </database_schema>

  <api_endpoints_summary>
    <authentication>
      - List auth endpoints and profile update flows
    </authentication>

    <primary_resources>
      - CRUD for main entities (list/create/get/update/delete) and common actions (duplicate/export/archive/pin)
    </primary_resources>

    <secondary_resources>
      - Child resources (messages/items/artifacts/etc.) with CRUD; include streaming/real-time endpoints if applicable
    </secondary_resources>

    <search>
      - Search endpoints across entities with query params and filters
    </search>

    <sharing>
      - Endpoints for link sharing, settings, revoke, and public views
    </sharing>

    <settings>
      - Global/user/project settings endpoints and configuration/customization surfaces
    </settings>

    <external_integrations>
      - Proxy or integration endpoints to upstream services (REST/GraphQL/gRPC/Webhooks), note streaming variants if used
    </external_integrations>
  </api_endpoints_summary>

  <ui_layout>
    <main_structure>
      - Describe column/section layout, responsive behavior, and persistent headers/footers
    </main_structure>

    <sidebar_left>
      - Navigation, creation actions, search/filter, grouping, settings/profile anchors
    </sidebar_left>

    <main_area>
      - Primary content: titles, selectors, history feed, welcome states, inputs/actions
    </main_area>

    <side_panel>
      - Secondary context: artifacts/details/previews, tabs, fullscreen, download/edit controls
    </side_panel>

    <modals_overlays>
      - List expected modals/drawers/overlays (settings, share, export, command palette, shortcuts)
    </modals_overlays>
    <applicability_note>Include this section only for products with UI; skip for pure CLI/SDK/agent.</applicability_note>
  </ui_layout>

  <design_system>
    <color_palette>
      - Primary/secondary accents, backgrounds, surfaces, text, borders, code block themes
    </color_palette>

    <typography>
      - Heading/body fonts, weights, sizes, line heights, monospace choice
    </typography>

    <components>
      - Message/content blocks, buttons, inputs, cards with states (hover/disabled)
    </components>

    <animations>
      - Transition durations and motion patterns for entrances, loading, and interactions
    </animations>
    <applicability_note>Include only for UI products; omit for CLI/SDK/agent-only projects.</applicability_note>
  </design_system>

  <observability>
    - Logging strategy, log levels, PII redaction
    - Metrics/SLIs, tracing, dashboards, alerting/on-call
  </observability>

  <operations>
    - Incident response/runbooks, escalation paths, paging policies
    - RCA/postmortem process and action tracking
  </operations>

  <security_privacy>
    - Authn/authz model, roles/permissions, least privilege
    - Threat model, data classification, encryption in transit/at rest
    - Secrets handling, dependency policy, compliance needs
    - Data retention/deletion policies and auditability
  </security_privacy>

  <deployment_infrastructure>
    - Targets (containers, serverless, VM, desktop/mobile store), regions, HA/DR
    - IaC/tooling, build pipeline, artifact storage
  </deployment_infrastructure>

  <release_rollout>
    - Versioning/semver policy, changelog, migration strategy
    - Feature flags, canary/blue-green, rollback plan
  </release_rollout>

  <monetization_payments>
    - Pricing model (subscriptions, usage-based, one-time), plans, limits
    - Payment processor integration, invoicing, taxes/receipts, refunds
    - Entitlements/quotas enforcement and grace periods
    - Fraud/chargeback handling and revenue reporting
  </monetization_payments>

  <testing_matrix>
    - Unit/integration/e2e/perf/security/fuzz/property tests
    - Target environments/OS/arch/browser matrix
  </testing_matrix>

  <performance_benchmarks>
    - Budgets and KPIs (latency, throughput, footprint, startup time)
    - Benchmark scenarios and tooling
  </performance_benchmarks>

  <analytics_experimentation>
    - Event taxonomy, analytics instrumentation, privacy-safe aggregation
    - A/B testing or feature experimentation framework and guardrails
  </analytics_experimentation>

  <cost_finops>
    - Budget guardrails, cost monitoring/alerts, efficiency targets
    - Optimization levers (scaling policies, storage/egress control)
  </cost_finops>

  <localization_internationalization>
    - Supported locales/languages, fallback behavior, RTL support
    - Locale-aware formatting, translation workflow, content updates
  </localization_internationalization>

  <offline_sync>
    - Offline modes, sync conflict resolution, resumable uploads/downloads
    - Caching strategy and consistency expectations
  </offline_sync>

  <governance_compliance>
    - Regulatory/compliance posture (GDPR/CCPA/PCI/HIPAA/SOC2 as applicable)
    - DPIA/PIA needs, DSR handling, consent flows
    - Access controls, audit logs, vendor risk
  </governance_compliance>

  <documentation_support>
    - User/dev guides, API reference, examples, tutorials
    - Support model (SLA/SLO/SLI), runbooks, FAQ
  </documentation_support>

  <key_interactions>
    <primary_flow>
      1. Outline the main user flow steps end-to-end
      2. Include real-time/streaming/async behaviors if relevant
      3. Note rendering/preview needs (content, data, media, assets)
    </primary_flow>

    <secondary_flow>
      1. Describe output/asset flow: creation, render/preview, edit, iterate, export/download/share
    </secondary_flow>

    <management_flow>
      1. Describe lifecycle for managing core objects: create, auto-save (if any), rename, organize, search, switch
    </management_flow>
  </key_interactions>

  <implementation_steps>
    <step number="1">
      <title>Setup Foundation</title>
      <tasks>
        - Initialize runtime/build tooling; set up repo structure and environments
        - Configure DB/migrations or storage if needed
        - Wire external API clients and health checks
      </tasks>
    </step>

    <step number="2">
      <title>Build Core Experience</title>
      <tasks>
        - Implement primary workflows (UI or CLI or API surface)
        - Add streaming/real-time support if applicable
        - Handle input/output rendering (text/data/media) or API contract shape
      </tasks>
    </step>

    <step number="3">
      <title>Management & Organization</title>
      <tasks>
        - CRUD/listing for core entities or resources
        - Search, grouping, rename, delete/archive/pin
      </tasks>
    </step>

    <step number="4">
      <title>Secondary Systems</title>
      <tasks>
        - Asset/output handling, previews, versioning (if applicable)
        - Side panels/editing flows or CLI/API subcommands
      </tasks>
    </step>

    <step number="5">
      <title>Collaboration & Sharing</title>
      <tasks>
        - Sharing links/exports/templates or package distribution channels
        - Public/readonly views where relevant
      </tasks>
    </step>

    <step number="6">
      <title>Advanced Controls</title>
      <tasks>
        - Model/tool selection or domain-specific tunables
        - Regeneration/branching/rollback or analogous features
      </tasks>
    </step>

    <step number="7">
      <title>Settings & Customization</title>
      <tasks>
        - Themes/preferences/config profiles
        - Keyboard shortcuts, prompt/action libraries, presets
      </tasks>
    </step>

    <step number="8">
      <title>Polish & Performance</title>
      <tasks>
        - Responsiveness/accessibility/CLI ergonomics
        - Onboarding/help, performance and caching/footprint tuning
      </tasks>
    </step>
  </implementation_steps>

  <success_criteria>
    <functionality>
      - Enumerate functional checkpoints for core and secondary flows
      - Ensure streaming/real-time behavior (if relevant) works smoothly
    </functionality>

    <user_experience>
      - Responsiveness, feedback, navigation clarity, animation smoothness
    </user_experience>

    <technical_quality>
      - Error handling, secure secret management, optimized queries, streaming efficiency, testing coverage
    </technical_quality>

    <design_polish>
      - Visual consistency, typography, spacing, contrast, accessibility, dark/light modes if applicable
    </design_polish>
    <reliability_targets>
       - SLAs/SLOs/SLIs for availability, latency, error rates; error budget policy
       - Recovery objectives (RPO/RTO) and release/rollback criteria
    </reliability_targets>
    <cost_targets>
       - Budget limits, unit economics (e.g., cost/request/user), and alert thresholds
    </cost_targets>
  </success_criteria>
</project_specification>
