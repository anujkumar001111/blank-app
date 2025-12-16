# PRD: Fellou Browser

## 1. Product overview
### 1.1 Document title and version
   - PRD: Fellou Browser
   - Version: 1.1

### 1.2 Product summary
Fellou is an AI-powered desktop browser that merges familiar browsing with an embedded agent, automation tools, and system-level controls. It supports multi-profile partitions, tab/group organization, special pages (home, downloads, history, settings, profile management), and bundled MV3 extensions for agent UI and data collection.

The browser integrates Authing sign-in, PostHog analytics, Sentry/BetterStack logging, automation (computer-use, browser automation), and permissive macOS entitlements for camera/mic/screen access. It emphasizes responsive navigation, clear permission handling, durable automation responses, and transparent update flows.

## 2. Goals
### 2.1 Business goals
   - Differentiate via AI-assisted browsing and automation to drive engagement.
   - Increase activation and retention through smooth onboarding and profile support.
   - Collect actionable analytics to steer roadmap decisions.
   - Deliver reliability suitable for primary-browser use while introducing automation value.

### 2.2 User goals
   - Browse efficiently with tabs/groups and quick navigation.
   - Use an AI side panel to summarize, query, and act on current pages.
   - Automate repetitive tasks across web and desktop safely.
   - Manage profiles, history, downloads, bookmarks, passwords, addresses, and payments in one place.

### 2.3 Non-goals
   - Launching a third-party extension marketplace beyond bundled extensions.
   - Shipping cross-device cloud sync in the first release.
   - Replacing OS password managers beyond basic storage helpers.

## 3. User personas
### 3.1 Key user types
   - Power browsers
   - AI-first knowledge workers
   - Automation-minded professionals
   - Privacy-aware users

### 3.2 Basic persona details
   - **Power browsers**: Heavy tab/group users needing organization and persistence.
   - **AI-first knowledge workers**: Researchers who summarize and query content via the agent.
   - **Automation-minded professionals**: Users automating workflows across web and desktop.
   - **Privacy-aware users**: Users controlling permissions, history, and saved data.

### 3.3 Role-based access
   - **Authenticated users**: Full access to profiles, agent, automation, settings, and data features.
   - **Guest mode (incognito)**: Temporary partitions; no persistent data after session.
   - **Admin (internal/support)**: Diagnostic/logging toggles; no extra end-user features.

## 4. Functional requirements
   - **Window and view management** (Priority: High)
     - Open normal/shadow/incognito windows; frameless main/global/overlay views.
     - Track window registry; handle focus/resize/fullscreen/close.
   - **Profiles and partitions** (Priority: High)
     - Create/switch/remove profiles; profile management page.
     - Persist partitions per profile; temp partition for incognito; restore tabs/groups per profile.
     - Enforce per-profile data isolation; incognito non-persistence.
   - **Authing sign-in** (Priority: High)
     - Authenticate with Authing; store/refresh access/id tokens; logout; onboarding callbacks.
     - Handle token refresh failures and offline/signed-out states gracefully.
   - **Tabs and groups** (Priority: High)
     - Create/update/select/remove tabs; foreground/background open; reorder/move; capture previews.
     - Create/update/select/remove groups; pin groups; sync pinned groups across windows of same profile.
     - Route special pages: home, downloads, history, settings, profile management, invite, update.
   - **Navigation** (Priority: High)
     - Address bar/modal for URL/search/commands; back/forward/reload/zoom; copy link; open devtools.
     - Block unknown custom protocols; allowed external links open via OS.
   - **Home and commands** (Priority: Medium)
     - Home page with search, AI hints, quick links, localized placeholders; command shortcuts and suggestions.
   - **Agent overlay** (Priority: High)
     - Floating agent: show/hide/pin/unpin/resize/move; load agent state; task queue; open URLs; search; theme/onboarding controls.
     - Clear error handling for agent API downtime/timeouts with retries/fallback.
   - **Computer-use automation** (Priority: High)
     - Enforce accessibility permission checks; actions: screenshot/move/click/drag/scroll/type/press/hotkey/wait.
     - File actions with per-path permission gating: list/find/read/read_base64/write/copy/rename/mkdir/upload/download/exists/replace/open folder.
     - Shell sessions: create/close/exec with permission enforcement and timeouts.
   - **Browser automation (browseruse/deepsearch)** (Priority: High)
     - Create/remove/select/update embedded tabs/windows; executeScript; captureScreenshot; window front.
     - Element/page actions: click/focus/hover/select/tap/type/press/upload; keyboard/mouse helpers; callbacks for tab/window events.
   - **Downloads** (Priority: Medium)
     - Track id/status/progress/path/time; pause/resume/cancel/clear; latest list; manager page; save-path dialog.
   - **History** (Priority: Medium)
     - Add/search/delete/clear/remove by time; history page; sync query time.
   - **Bookmarks** (Priority: Medium)
     - Manage bookmarks/folders with sync/deletion flags; create/update/delete/soft-delete/reset; toggle bookmark bar; export HTML; init on load.
   - **Passwords/addresses/payments** (Priority: Medium)
     - Store/update/delete passwords (temp/pass tables), addresses (with origin/url), payment methods; safe storage helpers.
   - **Permissions** (Priority: High)
     - Per-site permission records; add/update/reset/setAll/clearData; return current permissions.
     - Explicit prompts and “don’t ask again”/re-prompt flows for screen/mic/camera/file/accessibility.
   - **Notifications and modals** (Priority: Medium)
     - Create/close notifications; bubble masks; update tip modal; upgrade modal; invite modal; password/address/payment modals; window controls.
   - **Default browser and settings** (Priority: Medium)
     - Detect/set default browser; show/hide default-browser bar; open settings page from menu/command.
   - **Invites and rewards** (Priority: Medium)
     - Create/copy code/text; enter code; show stats/progress/limits; tips; enforce max rewards.
   - **Updates** (Priority: Medium)
     - Manual and periodic update checks; show update modal/tip; close/update tip positioning; restart on update when needed; handle failed downloads with retries.
   - **Theme and menu** (Priority: Low)
     - Get/set theme; menu toggles for bookmarks manager, privacy mode, history menu.
   - **Storage and safe storage** (Priority: High)
     - App/user/profile-scoped storage; sync storage; encrypt/decrypt helpers; Redux-like state persistence per profile.
   - **Language and localization** (Priority: Medium)
     - Load content by language; list contents; get/set current language/config; preload i18n strings.
   - **Audio (VAD)** (Priority: Medium)
     - Init/start/stop/process/reset/destroy; get status; speech events (started/detected/ended/start/stop).
   - **Analytics and logging** (Priority: High)
     - PostHog analytics; BetterStack logging; Sentry errors; static/dynamic properties; PC info collection; opt-in/opt-out and consent handling where required.
   - **App info and control** (Priority: Low)
     - Get version/product name; app/work/root/userData paths; restart app; installed apps; display info; admin config get/set; page path resolver; Chrome-style language settings.
   - **Extension surface** (Priority: High)
     - Bundle agent MV3 extension and data-collection MV3 extension; expose custom `window.chrome` API (not full Chrome API); no third-party extensions.
   - **Entitlements and OS permissions** (Priority: High)
     - macOS sandbox disabled; allow JIT/unsigned code; disable library validation; allow screen recording/mic/camera/location; user-selected read/write + bookmarks; temp exceptions for other browser profiles.
   - **Schema (SQLite)** (Priority: High)
     - Tables: key_value_store, history, redux_store, permission, bookmark, bookmark_folder, temp_pass, pass_table, address_table (with URL/originId), payment_method.
   - **Endpoints** (Priority: High)
     - Use api/agent/authing/knowledge endpoints; BetterStack logging; PostHog; S3 buckets; download page.

## 5. User experience
### 5.1. Entry points & first-time user flow
   - Launch app → home page with search/shortcuts → prompt for Authing sign-in → optional onboarding for agent and permissions (accessibility, screen, mic/camera, file).

### 5.2. Core experience
   - **Browse and navigate**: Open tabs/groups, load URLs or special pages, navigate back/forward/reload/zoom.
     - Responsive UI with loading states and page titles.
   - **Invoke agent**: Toggle side panel; ask questions or commands referencing current page.
     - Clear status/responses; quick hide/show; pinning; error states and retries when agent is unavailable.
   - **Automate actions**: Trigger computer-use/browseruse actions; view results (screenshots/status).
     - Permission prompts; structured errors; retry guidance.
   - **Manage data**: Access downloads, history, bookmarks, settings, profiles.
     - Consistent layouts; fast access.

### 5.3. Advanced features & edge cases
   - Incognito uses temp partitions; no persistence.
   - Permission-denied flows for accessibility/file/mic/camera/screen with re-prompt or “don’t ask again.”
   - Update available tip/modal; handle failed update downloads with retry/backoff.
   - Invite/reward limits; code entry failures.
   - Network errors on agent/automation with retries/backoff.

### 5.4. UI/UX highlights
   - Frameless window with overlay views; smooth animations for agent and modals.
   - Clear permission prompts and status toasts.
   - Localized copy/placeholders; consistent iconography across special pages.

## 6. Narrative
Priya is an AI-first knowledge worker who needs to research quickly and automate routine web tasks. She signs in, opens multiple tab groups, asks the side panel to summarize pages, and triggers automation to click, type, and capture screenshots. The tool keeps her profiles separate, remembers her tabs, and handles downloads, history, and bookmarks so she can work faster without leaving the app—even when permissions or network issues arise, the app guides her to fix them.

## 7. Success metrics
### 7.1. User-centric metrics
   - Daily/weekly active users.
   - Agent side panel daily opens per user.
   - Automation success rate and median time to complete.
   - Permission grant rate (accessibility/screen/mic).

### 7.2. Business metrics
   - Activation rate post-sign-in.
   - Retention at day 7/day 30.
   - Conversion from invite flows.

### 7.3. Technical metrics
   - App startup time.
   - Renderer/main thread responsiveness (avg/95th percentile).
   - Crash rate and unhandled error rate.
   - IPC call success/failure ratios.
   - Update check and apply success rates.

## 8. Technical considerations
### 8.1. Integration points
   - Authing (auth).
   - PostHog (analytics), BetterStack (logs), Sentry (errors).
   - Agent/knowledge APIs; S3 buckets for assets.
   - Bundled MV3 extensions (agent, data-collection).

### 8.2. Data storage & privacy
   - SQLite for tabs/history/permissions/bookmarks/passwords/addresses/payments.
   - Profile-scoped partitions; incognito temp partitions; no persistence after incognito close.
   - Safe storage helpers for secrets; respect OS permission scopes.
   - Optional telemetry consent/opt-out.

### 8.3. Scalability & performance
   - Efficient tab/view lifecycle; limit background work.
   - Cache i18n and settings locally.
   - Handle many tabs/groups without UI degradation; backpressure for automation queues.

### 8.4. Potential challenges
   - OS permission gating for accessibility/file/screen/mic/camera.
   - Agent panel performance with contextIsolation off.
   - Automation errors and retries; update failures.
   - Keeping bundled extensions constrained to custom API surface.

## 9. Milestones & sequencing
### 9.1. Project estimate
   - Large: 8-12 weeks

### 9.2. Team size & composition
   - Medium Team: 5-7 total people
     - Product manager, 3-4 engineers (desktop + frontend), 1 designer, 1 QA specialist

### 9.3. Suggested phases
   - **Phase 1**: Core shell, profiles, tabs/groups, special pages, Authing sign-in, settings (3-4 weeks)
     - Deliverables: window/view shell; tab/group management; profile page; special pages; auth; basic telemetry wiring.
   - **Phase 2**: Agent overlay, automation (computer-use/browseruse), permissions UX (3-4 weeks)
     - Deliverables: agent panel; automation IPC; permission flows; error handling; retries for automation.
   - **Phase 3**: Data features and polish (downloads/history/bookmarks/passwords/addresses/payments), invites, updates, analytics/logging, language (2-4 weeks)
     - Deliverables: data pages; invite flow; update modals with retry; i18n; full telemetry/consent.

## 10. User stories
### 10.1. Sign in with Authing
   - **ID**: US-001
   - **Description**: As a user, I want to sign in with Authing so that I can access my profiles and settings.
   - **Acceptance criteria**:
     - User can enter Authing credentials and receive access/id tokens.
     - Tokens are stored securely and refreshed before expiry.
     - Logout clears tokens and returns to signed-out state.
     - If offline or Authing fails, user sees a clear error and can retry.

### 10.2. Open and manage tabs
   - **ID**: US-002
   - **Description**: As a user, I want to open, switch, reorder, and close tabs so that I can browse efficiently.
   - **Acceptance criteria**:
     - Tabs can be created in foreground or background.
     - Tabs display title and favicon when available.
     - Tabs can be reordered via drag; closing a tab updates active tab correctly.

### 10.3. Organize tab groups
   - **ID**: US-003
   - **Description**: As a user, I want to create and pin tab groups so that I can keep related tabs together.
   - **Acceptance criteria**:
     - Groups can be created, renamed, selected, and removed.
     - Pinned groups persist across windows of the same profile.
     - Active group and active tab are restored on reopen.

### 10.4. Navigate pages
   - **ID**: US-004
   - **Description**: As a user, I want to navigate back, forward, reload, zoom, and open devtools so that I can control my browsing.
   - **Acceptance criteria**:
     - Back/forward/reload/zoom controls work per tab.
     - Unknown custom protocols are blocked; allowed external links open via OS.
     - Devtools can be opened on demand.

### 10.5. Use the home page and commands
   - **ID**: US-005
   - **Description**: As a user, I want a home page with search, shortcuts, and AI command hints so that I can start tasks quickly.
   - **Acceptance criteria**:
     - Home loads with search input, shortcuts, and localized hints.
     - Command shortcuts (e.g., slash) focus the command entry.
     - Suggestions update based on locale.

### 10.6. Toggle and use the agent panel
   - **ID**: US-006
   - **Description**: As a user, I want to open the agent side panel to ask questions or commands about the current page.
   - **Acceptance criteria**:
     - Panel can be shown/hidden/pinned/unpinned; remembers size/position.
     - User can send a query and see a response referencing the current page.
     - Panel can open URLs or trigger actions returned by the agent.
     - If agent API is unavailable, user sees error and can retry.

### 10.7. Run computer-use automation
   - **ID**: US-007
   - **Description**: As a user, I want to run actions like screenshot, click, type, drag, and file operations so that I can automate tasks.
   - **Acceptance criteria**:
     - Accessibility permission is required and prompted if missing; actions fail gracefully if denied.
     - Screenshot returns base64 and dimensions; click/drag/scroll/type/press/hotkey execute with provided coordinates/text.
     - File operations enforce per-path permissions and report success/failure.

### 10.8. Run browser automation
   - **ID**: US-008
   - **Description**: As a user, I want low-level page actions (click, type, evaluate, screenshot) so that I can automate web interactions.
   - **Acceptance criteria**:
     - User can select a target tab/window and run actions.
     - Actions return structured results or errors.
     - ExecuteScript and captureScreenshot work on the selected target.

### 10.9. Manage downloads
   - **ID**: US-009
   - **Description**: As a user, I want to view, pause/resume, cancel, and clear downloads so that I can manage files.
   - **Acceptance criteria**:
     - Downloads show id/status/progress/path/time.
     - Pause/resume/cancel works per download; clear removes completed/failed.
     - Manager page lists recent downloads and opens file locations.

### 10.10. Manage history
   - **ID**: US-010
   - **Description**: As a user, I want to view, search, filter, and clear browsing history so that I can revisit or remove past activity.
   - **Acceptance criteria**:
     - History shows URL, title, timestamp, favicon when available.
     - Search/filter by keyword/date; remove single entry or clear by time range.
     - Clear all removes all stored history.

### 10.11. Manage bookmarks
   - **ID**: US-011
   - **Description**: As a user, I want to save, edit, organize, and delete bookmarks/folders so that I can keep important sites.
   - **Acceptance criteria**:
     - Create/update/delete bookmarks and folders; soft-delete supported.
     - Toggle bookmark bar visibility; export bookmarks to HTML.
     - Bookmarks are tied to profile and restored on reopen.

### 10.12. Manage passwords, addresses, payments
   - **ID**: US-012
   - **Description**: As a user, I want to save and manage passwords, addresses, and payment methods so that I can fill forms quickly.
   - **Acceptance criteria**:
     - Save/update/delete entries; addresses include origin/url fields.
     - Sensitive data stored with safe storage helpers.
     - Autofill surfaces saved entries on supported forms.

### 10.13. Handle permissions per site
   - **ID**: US-013
   - **Description**: As a user, I want to review and update site permissions so that I control access.
   - **Acceptance criteria**:
     - View current permissions per domain/url.
     - Add/update/reset/set all; clear data for a site.
     - Changes take effect immediately on next load.

### 10.14. View and control notifications and modals
   - **ID**: US-014
   - **Description**: As a user, I want to see notifications and modals for updates, invites, and saved data so that I stay informed.
   - **Acceptance criteria**:
     - Notifications can be created/closed; modals (update, upgrade, invite, password/address/payment) open and close reliably.
     - Window controls (close/minimize/maximize/always-on-top/privacy) work from UI.
     - Update tip/modal shows when an update is available; can be dismissed.

### 10.15. Set default browser and settings
   - **ID**: US-015
   - **Description**: As a user, I want to set the app as my default browser and adjust settings so that it fits my workflow.
   - **Acceptance criteria**:
     - Detect current default status; prompt to set as default; bar can be dismissed.
     - Settings page opens from menu/command; changes persist per profile.
     - Privacy mode toggle available.

### 10.16. Use invite and rewards
   - **ID**: US-016
   - **Description**: As a user, I want to create/share invite codes and track rewards so that I can benefit from referrals.
   - **Acceptance criteria**:
     - Create and copy invite code/text; enter a code; invalid codes show errors.
     - Stats/progress/limits displayed; max rewards enforced.
     - Invite modal can be opened/closed.

### 10.17. Apply updates
   - **ID**: US-017
   - **Description**: As a user, I want to know when updates are available and apply them with minimal disruption.
   - **Acceptance criteria**:
     - Manual and periodic update checks run; update tip/modal appears when available.
     - User can dismiss tip or proceed; if proceed, update is applied on restart.
     - Restart prompt appears when required; failed update downloads show error and allow retry.

### 10.18. Switch language
   - **ID**: US-018
   - **Description**: As a user, I want to change the app language so that the UI matches my preference.
   - **Acceptance criteria**:
     - Language selector lists available contents; selecting updates UI strings.
     - Language config is stored per profile and restored on reopen.
     - Home/commands reflect localized placeholders.

### 10.19. Use audio VAD
   - **ID**: US-019
   - **Description**: As a user, I want voice activity detection to start/stop and process audio for voice input.
   - **Acceptance criteria**:
     - VAD can be initialized, started, stopped, reset, and destroyed.
     - Status can be queried; events fire on speech started/detected/ended.
     - Denied mic permission shows a clear error and retry option.

### 10.20. Use incognito mode
   - **ID**: US-020
   - **Description**: As an incognito user, I want no history, bookmarks, or downloads persisted after I close the session.
   - **Acceptance criteria**:
     - Incognito windows use temp partitions; no data is written to persistent stores.
     - On close, incognito tabs/groups/history/downloads are cleared.
     - UI indicates incognito mode.

### 10.21. Handle automation permission denials
   - **ID**: US-021
   - **Description**: As a user, I want clear messaging when automation actions are blocked by OS permissions so that I can grant access or understand failures.
   - **Acceptance criteria**:
     - When accessibility/file/screen/mic/camera is denied, the app shows a specific prompt with steps to enable.
     - Retrying after granting permission succeeds without restart when possible.
     - Automation actions return structured errors on denial.

### 10.22. Enforce bundled extensions only
   - **ID**: US-022
   - **Description**: As a user, I want automation and bundled extensions to operate only within the allowed surface so that my data is protected.
   - **Acceptance criteria**:
     - Only bundled MV3 extensions (agent, data-collection) are loaded.
     - Custom `window.chrome` API is available; unsupported Chrome APIs are not exposed.
     - Extension and automation actions respect partition and permission scopes.

### 10.23. Handle agent/API downtime
   - **ID**: US-023
   - **Description**: As a user, I want the app to inform me if the agent or automation backend is unavailable so I can retry or switch tasks.
   - **Acceptance criteria**:
     - Agent/API errors show clear status and retry/backoff.
     - Automation requests that time out show an error with retry option.
     - UI remains responsive; no unhandled failures.

### 10.24. Manage telemetry consent
   - **ID**: US-024
   - **Description**: As a user, I want to control analytics and error reporting so that I can manage my privacy.
   - **Acceptance criteria**:
     - User can opt in/out of analytics and error reporting where required.
     - Changes take effect immediately; reflected in subsequent telemetry calls.
     - Consent state is stored per profile.

### 10.25. Persist and isolate profile data
   - **ID**: US-025
   - **Description**: As a user, I want my profile data (tabs, groups, bookmarks, history, permissions, settings) kept separate from other profiles so my work is isolated.
   - **Acceptance criteria**:
     - Data for each profile is stored and restored only for that profile.
     - Switching profiles loads the correct partitions and state.
     - No data from one profile appears in another.
