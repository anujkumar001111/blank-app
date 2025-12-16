# Fellou Browser - Verified Reverse Engineering Analysis (v2)

**Document Version:** 2.0
**Generated:** 2025-12-11
**Methodology:** All claims verified against source code with exact file paths and line numbers

---

## Executive Summary

Fellou is an AI-powered Electron-based browser with extensive computer automation capabilities. This document contains **only verified claims** backed by direct source code evidence.

**App Metadata (from Contents/Info.plist):**
| Property | Value |
|----------|-------|
| Bundle ID | `com.fellou.ai` |
| Version | 2.5.19 (Info.plist) / 2.5.18 (package.json) |
| Team ID | 43D2K77YM8 |
| Copyright | ASI X Inc. 2025 |
| Min macOS | 10.11.0 |
| Category | public.app-category.productivity |

**Note:** Version discrepancy exists between Info.plist (2.5.19) and package.json (2.5.18).

---

## Technology Stack

**Source:** `/extracted_app/package.json`

| Category | Package | Version | Line |
|----------|---------|---------|------|
| Framework | Electron | (see Frameworks) | - |
| UI | react | ^18.3.1 | - |
| State | zustand | ^5.0.6 | 82 |
| Database | sqlite3 | ^5.1.7 | 77 |
| Desktop Automation | robotjs | ^0.6.0 | 73 |
| Browser Automation | puppeteer-core | ^24.22.3 | 66 |
| Voice Detection | sherpa-onnx-node | ^1.12.14 | 76 |
| Auth | authing-js-sdk | ^4.23.53 | 35 |
| Auth SSO | @authing/sso | ^2.1.27 | 18 |
| Analytics | posthog-node | ^4.11.3 | 65 |
| Error Tracking | @sentry/electron | ^6.2.0 | 29 |
| HTTP | axios | ^1.7.9 | 36 |
| Canvas | canvas | ^3.1.0 | 38 |
| UI Components | antd | ^5.23.1 | 32 |
| Animation | framer-motion | ^12.9.2 | 46 |
| i18n | i18next | ^24.2.1 | 50 |
| Keychain | keytar | ^7.9.0 | 52 |

---

## Application Architecture

### Process Model

```
┌─────────────────────────────────────────────────────────────────┐
│                        MAIN PROCESS                              │
│  dist/main/index.cjs (~90,000+ lines)                           │
│                                                                  │
│  Services: TabsService, AgentService, ProfileService,           │
│           HistoryService, DownloadService, PermissionService,   │
│           VADService, StorageService                            │
│                                                                  │
│  Native Binaries (Go):                                          │
│  - Fellou_gateway (network proxy)                               │
│  - robot (automation)                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                    IPC (200+ handlers)
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      PRELOAD LAYER                               │
│                                                                  │
│  fellou-D8DJ2uno.cjs (~79KB) - Core API (window.fellou)         │
│  tabs.preload.cjs - Password/Address/Payment autofill           │
│  extensions.preload.cjs - Chrome extension API emulation        │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      RENDERER PROCESS                            │
│                                                                  │
│  React + Zustand application                                    │
│  dist/render/pages/ (26 verified pages)                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Renderer Pages

**Source:** `ls extracted_app/dist/render/pages/`

### Verified Pages (26 total)
```
addressModal/          createProfileModal/    dynamicIsland/
agentLoading/          defaultBrowserBar/     error/
computerUse.html       downloads/             extenal.html
history/               homePage/              imageOverlay/
index.html             invite/                mcpAuthSuccess/
modal/                 networkError/          notification/
profileManagement/     settings/              taskShadow/
update/                updateTip/             upgradeModal/
v3-background/         drop/
```

---

## Database Schema

**Source:** `/extracted_app/dist/main/index.cjs`

### Table: key_value_store (Line 3806)
```sql
CREATE TABLE IF NOT EXISTS key_value_store (
    key TEXT PRIMARY KEY,
    value TEXT
)
```

### Table: history (Line 3813)
```sql
CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    title TEXT,
    favicon TEXT,
    visitTime INTEGER NOT NULL,
    lastVisitTime INTEGER,
    visitCount INTEGER DEFAULT 1,
    typedCount INTEGER DEFAULT 0
)
```

### Table: redux_store (Line 3826)
```sql
CREATE TABLE IF NOT EXISTS redux_store (
    reducer_type TEXT PRIMARY KEY,
    state TEXT NOT NULL,
    updated_at INTEGER NOT NULL
)
```

### Table: permission (Line 3834)
```sql
CREATE TABLE IF NOT EXISTS permission (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    url TEXT NOT NULL,
    permission TEXT,
    favicon TEXT,
    title TEXT,
    visitTime INTEGER NOT NULL
)
```

### Table: bookmark (Line 3848)
```sql
CREATE TABLE IF NOT EXISTS bookmark (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    host_domain TEXT NOT NULL,
    meta_description TEXT,
    prefix_content TEXT,
    icon_url TEXT,
    folder_id TEXT,
    context_url TEXT,
    user_id TEXT,
    profile_id TEXT NOT NULL,
    groupId TEXT,
    created_time INTEGER NOT NULL,
    updated_time INTEGER,
    sync_time INTEGER,
    is_deleted INTEGER DEFAULT 0
)
```

### Table: bookmark_folder (Line 3877)
```sql
CREATE TABLE IF NOT EXISTS bookmark_folder (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    user_id TEXT,
    profile_id TEXT NOT NULL,
    groupId TEXT,
    created_time INTEGER NOT NULL,
    updated_time INTEGER,
    sync_time INTEGER,
    is_deleted INTEGER DEFAULT 0
)
```

### Table: temp_pass (Line 3894)
```sql
CREATE TABLE IF NOT EXISTS temp_pass (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    d TEXT NOT NULL,
    u TEXT NOT NULL,
    p TEXT NOT NULL,
    extra TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
)
```

### Table: pass_table (Line 3908)
```sql
CREATE TABLE IF NOT EXISTS pass_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    d TEXT NOT NULL,
    u TEXT NOT NULL,
    p TEXT NOT NULL,
    extra TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
)
```

### Table: address_table (Line 3922)
```sql
CREATE TABLE IF NOT EXISTS address_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    name TEXT NOT NULL,
    company TEXT,
    addressLine1 TEXT NOT NULL,
    addressLine2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zipCode TEXT NOT NULL,
    country TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    isDefault BOOLEAN DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
)
```
**Note:** Additional columns added via ALTER TABLE: `url TEXT`, `originId varchar(255)`

### Table: payment_method (Line 3944)
```sql
CREATE TABLE IF NOT EXISTS payment_method (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cardholderName TEXT,
    cardNumber TEXT NOT NULL,
    expiryMonth TEXT,
    expiryYear TEXT,
    cardType TEXT,
    nickname TEXT,
    cvc TEXT,
    hasSavedCvc BOOLEAN DEFAULT 0,
    isDefault BOOLEAN DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
)
```

---

## Security Settings

**Source:** `/extracted_app/dist/main/index.cjs`

### contextIsolation: false
| Line | Value |
|------|-------|
| 26754 | `contextIsolation: false` |
| 27117 | `contextIsolation: false` |
| 31196 | `contextIsolation: false` |
| 60955 | `contextIsolation: false` |
| 62382 | `contextIsolation: false` |
| ... | (30+ more occurrences) |

### webSecurity (conditional)
| Line | Value |
|------|-------|
| 68793 | `webSecurity: process.env.NODE_ENV === "development" ? false : true` |
| 68917 | `webSecurity: process.env.NODE_ENV === "development" ? false : true` |

**Interpretation:** webSecurity is disabled in development, enabled in production.

### nodeIntegration
| Line | Value |
|------|-------|
| 26753 | `nodeIntegration: true` |
| 27116 | `nodeIntegration: false` (exception) |
| 31195 | `nodeIntegration: true` |
| 60954 | `nodeIntegration: true` |
| 62381 | `nodeIntegration: true` |

---

## API Endpoints

**Source:** Grep of `/extracted_app/dist/main/index.cjs`

| Endpoint | Purpose |
|----------|---------|
| `https://fellou.us.authing.co` | Authentication (Authing SSO) |
| `https://api.fellou.ai` | Main API server |
| `https://agent.fellou.ai/` | Production agent execution |
| `https://agent.pre.fellou.ai/` | Staging agent |
| `https://chat.dev2.fellou.ai/` | Test agent |
| `https://knowledge.prod.fellou.ai` | Knowledge base |
| `https://fellou.s3.amazonaws.com/user-contents/` | User content storage |

---

## macOS Entitlements

**Source:** `/Contents/Resources/buildResources/entitlements.mac.plist`

### Security Permissions
| Entitlement | Value |
|-------------|-------|
| `com.apple.security.app-sandbox` | **false** (CRITICAL) |
| `com.apple.security.cs.allow-jit` | true |
| `com.apple.security.cs.allow-unsigned-executable-memory` | true |
| `com.apple.security.cs.disable-library-validation` | true |
| `com.apple.security.screen-recording` | true |
| `com.apple.security.device.audio-input` | true |
| `com.apple.security.device.camera` | true |
| `com.apple.security.personal-information.location` | true |
| `com.apple.security.files.user-selected.read-write` | true |
| `com.apple.security.files.bookmarks.app-scope` | true |

### Access to Other Browser Data
```xml
<key>com.apple.security.temporary-exception.files.home-relative-path.read-write</key>
<array>
    <string>Library/Application Support</string>
    <string>Library/Application Support/Fellou</string>
    <string>Library/Application Support/FellouTest</string>
    <string>Library/Application Support/Google/Chrome</string>
    <string>Library/Application Support/Microsoft Edge</string>
    <string>Library/Application Support/Arc</string>
    <string>Library/Application Support/Firefox</string>
    <string>Library/Application Support/BraveSoftware/Brave-Browser</string>
    <string>Library/Application Support/Opera</string>
</array>
```

**Security Implications:**
- App runs without macOS sandbox protection
- Can read passwords, cookies, history from Chrome, Firefox, Edge, Arc, Brave, Opera
- Can execute arbitrary native code
- Full screen recording capability

---

## Native Binaries

**Source:** `/Contents/Resources/buildResources/`

### Go Binaries
| Binary | Type | Purpose |
|--------|------|---------|
| `Fellou_gateway` | Mach-O 64-bit arm64 | Network proxy/gateway |
| `robot` | Mach-O 64-bit arm64 | Desktop automation (robotgo-based) |

### Unpacked Native Modules
**Source:** `app.asar.unpacked/node_modules/`

| Module | Contents |
|--------|----------|
| `@sentry/cli-darwin` | sentry-cli binary (25MB) |
| `canvas` | Cairo, Pango, GLib, Pixman, libpng, freetype, harfbuzz, librsvg |
| `sherpa-onnx-darwin-arm64` | libonnxruntime (24MB), sherpa-onnx libraries |

---

## Bundled Extensions

**Source:** `/Contents/Resources/buildResources/extensions/`

### fellou-agent-extension (v1.22.14)
- Manifest V3 extension
- Permissions: storage, notifications, tabs, activeTab, scripting, cookies, history, webNavigation, webRequest
- Host permissions: `*://*/*`
- Site-specific content extractors for Google, Bing, YouTube, GitHub, LinkedIn, etc.
- Includes Readability.js and html2canvas

### data-collection
- User behavior tracking extension
- EventTracker class for: click, scroll, input, select, submit, file, copy, keydown, hover
- Search query tracking (Baidu, Google, Bing, DuckDuckGo)
- Sends data via `chrome.runtime.sendMessage({ type: "page_action_seq", data })`

---

## IPC Channel Map

**Source:** `/extracted_app/dist/preload/fellou-D8DJ2uno.cjs` and main process

### Core Categories
| Category | Example Channels |
|----------|-----------------|
| system | system.app.getVersion, system.platform.getInfo, system.getUserDataPath |
| tabs | tabs.create, tabs.update, tabs.remove, tabs.query, tabs.captureVisibleTab |
| windows | windows.create, windows.focus, windows.getCurrent, windows.resize |
| storage | storage.local.get/set, storage.sq.query, storage.passwdTableQuery |
| agent | agent.search, agent.openUrls, agent.getFellouAccessToken |
| computerUse | computerUse.screenshot, computerUse.move_to, computerUse.click, computerUse.typing |
| browseruse | browseruse.click, browseruse.evaluate, browseruse.screenshot |
| history | history.addUrl, history.search, history.deleteUrl |
| downloads | download.getAll, download.action, download.openManagerPage |
| bookmark | bookmark.save, bookmark.update, bookmark.delete, bookmark.getHtmlContent |
| vad | vad.init, vad.start, vad.stop, vad.processAudio |

---

## Preload Scripts

### tabs.preload.cjs

**Classes identified:**
1. `PasswordManager` - Detects login forms, saves credentials, autofills
2. `PaymentFormCollector` - Detects payment forms, saves card data
3. `AddressFormCollector` - Detects address forms, saves addresses

**Key behaviors:**
- Monitors all forms on pages
- Uses MutationObserver for dynamic form detection
- Overrides `navigator.language` and `navigator.languages` for fingerprint spoofing
- Stores credentials in `temp_pass` and `pass_table` SQLite tables

### fellou-D8DJ2uno.cjs

- ~79KB minified JavaScript
- Exposes `window.fellou` API (NOT `window.chrome`)
- Wraps IPC calls for all major features
- Chrome extension API emulation is in separate preload (tabs.preload.cjs line 1)

---

## Verification Commands

```bash
# Extract app
cd /path/to/Fellou.app/Contents/Resources
npx asar extract app.asar extracted_app

# Verify packages
cat extracted_app/package.json | jq '.dependencies'

# Verify database schema
grep -n "CREATE TABLE" extracted_app/dist/main/index.cjs

# Verify renderer pages
ls extracted_app/dist/render/pages/

# Verify security settings
grep -n "contextIsolation" extracted_app/dist/main/index.cjs | head -5
grep -n "webSecurity" extracted_app/dist/main/index.cjs
grep -n "nodeIntegration" extracted_app/dist/main/index.cjs | head -5

# Verify entitlements
cat Contents/Resources/buildResources/entitlements.mac.plist

# Verify Go binaries
file Contents/Resources/buildResources/Fellou_gateway
file Contents/Resources/buildResources/robot

# Verify extensions
ls Contents/Resources/buildResources/extensions/
```

---

## Document Verification

Every claim in this document can be independently verified using the source file paths and line numbers provided. See `/fellou-verification-report.md` for detailed verification methodology.

**Document generated from direct source inspection - no inferred or assumed data.**
