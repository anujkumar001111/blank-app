# Fellou Electron App – Evidence-Backed Notes (Consolidated)

## Confirmed artifacts (current build)
- Bundle metadata (Contents/Info.plist): `CFBundleIdentifier=com.fellou.ai`, `CFBundleShortVersionString=2.5.19`, TeamID `43D2K77YM8`, ATS allows arbitrary loads/local networking, URL schemes http/https, execution level `highestAvailable`.
- App manifest mismatch: `extracted_app/package.json` reports `version: 2.5.18`, `productName: "Fellou"` (differs from Info.plist 2.5.19).
- Unpacked natives: `@sentry/cli-darwin`, `canvas`, `sherpa-onnx-darwin-arm64`. (app.asar.unpacked/node_modules)
- Runtime deps (extracted_app/package.json): `puppeteer-core@24.22.3`, `robotjs@0.6.0`, `sqlite3@5.1.7`, `sherpa-onnx-node@1.12.14`, `canvas@3.1.0`, `authing-js-sdk@4.23.53`, `@sentry/electron@6.2.0`, `posthog-node@4.11.3`, plus React/AntD/Radix/HeadlessUI/Framer/Tailwind/etc.
- Renderer pages (extracted_app/dist/render/pages): `addressModal`, `agentLoading`, `computerUse.html`, `createProfileModal`, `defaultBrowserBar`, `downloads`, `drop`, `dynamicIsland`, `error`, `extenal.html`, `history`, `homePage`, `imageOverlay`, `index.html`, `invite`, `mcpAuthSuccess`, `modal`, `networkError`, `notification`, `profileManagement`, `settings`, `taskShadow`, `update`, `updateTip`, `upgradeModal`, `v3-background`.
- Main process (extracted_app/dist/main/index.cjs): frameless BrowserWindow; WebContentsView for main/global/block; preload `../preload/fellou.preload.cjs`; `webviewTag: true`; `contextIsolation: false`; `webSecurity` disabled only in development; partitions `persist:user-<id>` or temp incognito; injects `window.FELLOU_WINDOW_ID`/`FELLOU_SHADOW` via executeJavaScript during tab/view creation (~63140–63200, ~68740–68920).
- Services: `TabsService`, `AgentService`; windowManager maps windowId → tab/agent services (TabsService ~62340+, AgentService ~27070+).
- Preload surface: `dist/preload/fellou.preload.cjs` and `fellou-D8DJ2uno.cjs` bind `window.chrome` (not `window.fellou`) to a large IPC wrapper: tabs/windows/downloads/history/bookmarks/profileService/settings/userData/permission/computerUse/browseruse/postHog/sqlite/language/oauth/invite/update/defaultBrowserBar/theme/menu/etc.; listeners kept in WeakMaps. `tabs.preload.cjs` emulates extension-like APIs on `window.chrome` for content scripts.
- Security flags: numerous `contextIsolation: false` entries; `webSecurity` guarded to enable in prod; `nodeIntegration` true on most views except special cases.
- IPC handlers: computer-use (screenshot/move/click/typing/press/drag/hotkey/file ops), tabs CRUD, downloads/history/profileService, bookmark, permission, webview.* deepsearch bridge, VAD, OAuth server port, etc. Example: `computeruse.screenshot` around line ~85139 returns base64 JPEG + dimensions.
- URLs/strings in main bundle: `https://api.fellou.ai`, `https://agent.fellou.ai/`, `https://agent.pre.fellou.ai/`, `https://fellou.ai/download`, `https://knowledge.prod.fellou.ai`, BetterStack (`https://in.logs.betterstack.com`, `https://s1516556.us-east-9.betterstackdata.com`), PostHog hosts, Authing, S3 buckets.
- macOS entitlements (Contents/Resources/buildResources/entitlements.mac.plist): sandbox disabled; allows JIT/unsigned executable memory, disables library validation; screen recording, mic, camera, location, user-selected read/write, bookmarks; temp exceptions for Chrome/Edge/Arc/Firefox/Brave/Opera profile paths.
- Bundled extensions (Contents/Resources/buildResources/extensions): `fellou-agent-extension` (MV3, v1.22.14, broad permissions incl. tabs/history/webRequest, host `*://*/*`, newtab override); `data-collection` (MV3, tracks events; matches `<all_urls>`).
- Native binaries present (Contents/Resources/buildResources): `Fellou_gateway` (Mach-O arm64), `robot` (Mach-O arm64). Roles are not evidenced from code; only presence is confirmed.
- SQLite schema observed in main bundle (~lines 3806–3944): tables `key_value_store`, `history`, `redux_store`, `permission`, `bookmark`, `bookmark_folder`, `temp_pass`, `pass_table`, `address_table` (with extra URL/originId), `payment_method`.

## Corrections vs. previous claims
- Chrome API surface: `window.chrome` is defined (not `window.fellou`) in both `fellou.preload.cjs` and `tabs.preload.cjs`.
- Native binaries’ purposes are unknown; only their presence is verified.
- Version mismatch: Info.plist 2.5.19 vs package.json 2.5.18 is real.

## Remaining uncertainty
- Electron runtime version not extracted from the framework binary in this pass.
- No evidence of `better-sqlite3` or `@jitsi/robotjs`; dependencies are `sqlite3` and `robotjs`.
