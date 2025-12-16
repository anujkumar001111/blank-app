# Fellou Browser - Complete Reverse Engineering Analysis

## Executive Summary

Fellou is an AI-powered Electron-based browser built on **Electron 34.4.1** with extensive computer automation capabilities. The application combines a traditional web browser with AI agent functionality that can control the user's desktop, execute shell commands, and automate browser interactions.

**Key Findings:**
- Full desktop automation via RobotJS (mouse, keyboard, screenshots)
- Browser automation via Puppeteer-core CDP protocol
- Voice Activity Detection using Sherpa-ONNX
- SQLite3 local storage for passwords, addresses, payment methods
- User behavior tracking to external servers
- Chrome extension API emulation
- Authentication via Authing SSO

---

## Technology Stack

| Category | Technology | Version/Details |
|----------|------------|-----------------|
| Framework | Electron | 34.4.1 |
| UI | React | 18.3.1 |
| State | Zustand | 5.0.3 |
| Bundler | Vite | 5.4.18 |
| Database | better-sqlite3 | 11.9.1 |
| Desktop Automation | @jitsi/robotjs | 0.6.14 |
| Browser Automation | puppeteer-core | 23.9.0 |
| Voice Detection | sherpa-onnx-node | 1.11.3 |
| Auth | Authing SSO | fellou.us.authing.co |
| Analytics | PostHog, Sentry | Latest |

---

## Application Architecture

### Process Model

```
┌─────────────────────────────────────────────────────────────────┐
│                        MAIN PROCESS                              │
│  (dist/main/index.cjs - ~90,000 lines bundled)                  │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │TabsService  │  │AgentService │  │ProfileService│             │
│  │ ~Line 62350 │  │ ~Line 27070 │  │ ~Line 30618  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │HistoryServ │  │DownloadServ │  │PermissionServ│             │
│  │ ~Line 10429 │  │ ~Line 10665 │  │ ~Line 58641  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ VADService │  │ComputerUse  │  │StorageService│             │
│  │ ~Line 88653 │  │ ~Line 85135 │  │ ~Line varies │             │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                    IPC (200+ handlers)
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      PRELOAD SCRIPTS                             │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ fellou-D8DJ2uno.cjs - Core API Layer (~5000 lines)         │ │
│  │ Exposes: window.chrome API with all IPC wrappers           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │tabs.preload.cjs │  │extensions.preload│                      │
│  │Password Manager │  │Chrome Extension  │                      │
│  │Address Collector│  │API Emulation     │                      │
│  │Payment Collector│  │Action Tracking   │                      │
│  └─────────────────┘  └─────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RENDERER PROCESS                            │
│                                                                  │
│  dist/render/index.html                                          │
│  dist/render/assets/*.js (React components)                     │
│                                                                  │
│  Pages:                                                          │
│  - newtab.html        (New tab page)                            │
│  - historyPage.html   (History view)                            │
│  - passwordsPage.html (Password manager UI)                     │
│  - devtools.html      (Developer tools)                         │
│  - controlPanel.html  (Agent control interface)                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Services (Main Process)

### 1. TabsService (~Line 62350)

Manages browser tabs using Electron's `WebContentsView` architecture.

**Key Features:**
- Creates WebContentsView for each tab (not BrowserView - deprecated)
- Handles tab navigation, reload, back/forward
- Manages tab groups and pinned tabs
- Captures screenshots for tab thumbnails
- Implements CDP (Chrome DevTools Protocol) connections

**Key IPC Handlers:**
- `tabs.create` - Create new tab
- `tabs.update` - Update tab URL/properties
- `tabs.remove` - Close tab
- `tabs.query` - Query tabs by properties
- `tabs.captureVisibleTab` - Screenshot current tab
- `tabs.executeScript` - Inject JavaScript into tab
- `tabs.insertCSS` - Inject CSS into tab
- `tabs.sendMessage` - Send message to tab content script

### 2. AgentService (~Line 27070)

The AI agent orchestration system that connects to Fellou's backend.

**API Endpoints:**
- `https://api.fellou.ai` - Main API
- `https://agent.fellou.ai` - Agent execution
- `https://knowledge.prod.fellou.ai` - Knowledge base

**Key Capabilities:**
- WebSocket communication for real-time agent control
- Task management and execution
- Browser automation commands
- Screenshot capture and analysis
- Action sequence recording and playback

**Key IPC Handlers:**
- `agent.createTask` - Create new agent task
- `agent.submitAction` - Submit action for agent
- `agent.getTaskStatus` - Check task status
- `agent.stopTask` - Stop running task
- `agent.chat` - Chat with agent

### 3. Computer Use System (~Line 85135-85863)

Desktop automation powered by RobotJS.

**Initialization (Line ~85042):**
```javascript
// RobotJS is loaded dynamically from app.asar.unpacked
// Native .node binaries for different architectures
```

**Available Tools:**
| Tool | Description |
|------|-------------|
| `screenshot` | Capture screen region or full screen |
| `move_to` | Move mouse to coordinates |
| `left_click` | Left mouse click |
| `right_click` | Right mouse click |
| `double_click` | Double click |
| `scroll` | Scroll by offset |
| `typing` | Type text |
| `press` | Press specific key |
| `hotkey` | Key combination (e.g., Cmd+C) |
| `shell_exec` | Execute shell command |
| `file_read` | Read file contents |
| `file_write` | Write to file |
| `file_delete` | Delete file |
| `list_dir` | List directory contents |

**IPC Handlers:**
- `computerUse.screenshot`
- `computerUse.executeAction`
- `computerUse.move_to`
- `computerUse.click`
- `computerUse.scroll`
- `computerUse.typing`
- `computerUse.press`
- `computerUse.hotkey`
- `computerUse.shell_exec`

### 4. HistoryService (~Line 10429)

Manages browsing history with SQLite storage.

**Database Table: `history`**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| url | TEXT | Page URL |
| title | TEXT | Page title |
| visitTime | INTEGER | Unix timestamp |
| visitCount | INTEGER | Number of visits |

**IPC Handlers:**
- `history.addUrl` - Add URL to history
- `history.getVisits` - Get visit records
- `history.search` - Search history
- `history.deleteUrl` - Delete specific URL
- `history.deleteAll` - Clear all history
- `history.deleteRange` - Delete by date range

### 5. DownloadService (~Line 10665)

Handles file downloads.

**IPC Handlers:**
- `downloads.download` - Start download
- `downloads.pause` - Pause download
- `downloads.resume` - Resume download
- `downloads.cancel` - Cancel download
- `downloads.getFileIcon` - Get file icon
- `downloads.open` - Open downloaded file
- `downloads.showInFolder` - Show in file manager

### 6. ProfileService (~Line 30618)

Manages user profiles and data persistence.

**Key Features:**
- Profile creation and switching
- User data directory management
- Extension storage per profile
- Sync settings

### 7. VADService (~Line 88653)

Voice Activity Detection using Sherpa-ONNX.

**Key Features:**
- Real-time speech detection
- Audio stream processing
- Start/stop speech events
- Integration with AI agent for voice commands

### 8. PermissionService (~Line 58641)

Manages web permissions.

**Handled Permissions:**
- Microphone
- Camera
- Geolocation
- Notifications
- Clipboard
- Screen capture

---

## Preload Scripts Deep Dive

### fellou-D8DJ2uno.cjs (Core API Layer)

This is the most critical preload script. It creates the `window.chrome` object that web pages and extensions use.

**Exposed APIs:**

```javascript
window.chrome = {
  // System APIs
  system: {
    display: { getInfo: () => {...} },
    cpu: { getInfo: () => {...} },
    memory: { getInfo: () => {...} }
  },

  // Tab Management
  tabs: {
    create: (options) => ipcRenderer.invoke('tabs.create', options),
    update: (tabId, options) => ipcRenderer.invoke('tabs.update', tabId, options),
    remove: (tabIds) => ipcRenderer.invoke('tabs.remove', tabIds),
    query: (queryInfo) => ipcRenderer.invoke('tabs.query', queryInfo),
    get: (tabId) => ipcRenderer.invoke('tabs.get', tabId),
    getCurrent: () => ipcRenderer.invoke('tabs.getCurrent'),
    captureVisibleTab: () => ipcRenderer.invoke('tabs.captureVisibleTab'),
    executeScript: (tabId, details) => ipcRenderer.invoke('tabs.executeScript', tabId, details),
    sendMessage: (tabId, message) => ipcRenderer.invoke('tabs.sendMessage', tabId, message),
    onUpdated: { addListener: (cb) => {...}, removeListener: (cb) => {...} },
    onCreated: { addListener: (cb) => {...} },
    onRemoved: { addListener: (cb) => {...} },
    onActivated: { addListener: (cb) => {...} }
  },

  // Window Management
  windows: {
    create: (options) => ipcRenderer.invoke('windows.create', options),
    update: (windowId, options) => ipcRenderer.invoke('windows.update', windowId, options),
    remove: (windowId) => ipcRenderer.invoke('windows.remove', windowId),
    get: (windowId) => ipcRenderer.invoke('windows.get', windowId),
    getCurrent: () => ipcRenderer.invoke('windows.getCurrent'),
    getAll: () => ipcRenderer.invoke('windows.getAll'),
    onCreated: { addListener: (cb) => {...} },
    onRemoved: { addListener: (cb) => {...} }
  },

  // Local Storage
  storage: {
    local: {
      get: (keys) => ipcRenderer.invoke('storage.local.get', keys),
      set: (items) => ipcRenderer.invoke('storage.local.set', items),
      remove: (keys) => ipcRenderer.invoke('storage.local.remove', keys),
      clear: () => ipcRenderer.invoke('storage.local.clear')
    },
    sync: {
      get: (keys) => ipcRenderer.invoke('storage.sync.get', keys),
      set: (items) => ipcRenderer.invoke('storage.sync.set', items)
    }
  },

  // Agent Control
  agent: {
    createTask: (task) => ipcRenderer.invoke('agent.createTask', task),
    submitAction: (action) => ipcRenderer.invoke('agent.submitAction', action),
    getTaskStatus: (taskId) => ipcRenderer.invoke('agent.getTaskStatus', taskId),
    stopTask: (taskId) => ipcRenderer.invoke('agent.stopTask', taskId),
    chat: (message) => ipcRenderer.invoke('agent.chat', message)
  },

  // Computer Use (Desktop Automation)
  computerUse: {
    screenshot: (options) => ipcRenderer.invoke('computerUse.screenshot', options),
    move_to: (x, y) => ipcRenderer.invoke('computerUse.move_to', x, y),
    click: (button, options) => ipcRenderer.invoke('computerUse.click', button, options),
    scroll: (x, y) => ipcRenderer.invoke('computerUse.scroll', x, y),
    typing: (text) => ipcRenderer.invoke('computerUse.typing', text),
    press: (key) => ipcRenderer.invoke('computerUse.press', key),
    hotkey: (keys) => ipcRenderer.invoke('computerUse.hotkey', keys),
    shell_exec: (command) => ipcRenderer.invoke('computerUse.shell_exec', command)
  },

  // Browser Use (Puppeteer CDP)
  browseruse: {
    connect: () => ipcRenderer.invoke('browseruse.connect'),
    goto: (url) => ipcRenderer.invoke('browseruse.goto', url),
    evaluate: (script) => ipcRenderer.invoke('browseruse.evaluate', script),
    screenshot: () => ipcRenderer.invoke('browseruse.screenshot'),
    click: (selector) => ipcRenderer.invoke('browseruse.click', selector),
    type: (selector, text) => ipcRenderer.invoke('browseruse.type', selector, text)
  },

  // History
  history: {
    search: (query) => ipcRenderer.invoke('history.search', query),
    addUrl: (url) => ipcRenderer.invoke('history.addUrl', url),
    deleteUrl: (url) => ipcRenderer.invoke('history.deleteUrl', url),
    deleteAll: () => ipcRenderer.invoke('history.deleteAll')
  },

  // Downloads
  downloads: {
    download: (options) => ipcRenderer.invoke('downloads.download', options),
    pause: (downloadId) => ipcRenderer.invoke('downloads.pause', downloadId),
    resume: (downloadId) => ipcRenderer.invoke('downloads.resume', downloadId),
    cancel: (downloadId) => ipcRenderer.invoke('downloads.cancel', downloadId)
  },

  // Scripting
  scripting: {
    executeScript: (injection) => ipcRenderer.invoke('scripting.executeScript', injection),
    insertCSS: (injection) => ipcRenderer.invoke('scripting.insertCSS', injection),
    removeCSS: (injection) => ipcRenderer.invoke('scripting.removeCSS', injection)
  },

  // Bookmarks
  bookmarks: {
    create: (bookmark) => ipcRenderer.invoke('bookmark.create', bookmark),
    get: (idOrList) => ipcRenderer.invoke('bookmark.get', idOrList),
    getTree: () => ipcRenderer.invoke('bookmark.getTree'),
    update: (id, changes) => ipcRenderer.invoke('bookmark.update', id, changes),
    remove: (id) => ipcRenderer.invoke('bookmark.remove', id)
  },

  // Runtime (for extensions)
  runtime: {
    id: 'fellou-browser',
    getURL: (path) => `chrome-extension://fellou-browser/${path}`,
    sendMessage: (message) => ipcRenderer.invoke('runtime.sendMessage', message),
    onMessage: { addListener: (cb) => {...} },
    onInstalled: { addListener: (cb) => {...} }
  },

  // Permissions
  permissions: {
    request: (perms) => ipcRenderer.invoke('permission.request', perms),
    contains: (perms) => ipcRenderer.invoke('permission.contains', perms),
    remove: (perms) => ipcRenderer.invoke('permission.remove', perms)
  },

  // VAD (Voice Activity Detection)
  vad: {
    start: () => ipcRenderer.invoke('vad.start'),
    stop: () => ipcRenderer.invoke('vad.stop'),
    onSpeechStart: { addListener: (cb) => {...} },
    onSpeechEnd: { addListener: (cb) => {...} }
  }
};
```

### tabs.preload.cjs (Form Autofill System)

**Components:**

#### 1. PasswordManager Class
```javascript
class PasswordManager {
  passwordSelectors = [
    'input[autocomplete="password"]',
    'input[autocomplete="current-password"]',
    'input[type="password"]',
    'input[name="password"]',
    'input[name*="pass"]'
  ];

  usernameSelectors = [
    'input[autocomplete="username"]',
    'input[autocomplete="email"]',
    'input[type="email"]',
    'input[name*="user"]',
    'input[name*="email"]'
  ];

  // Detects login forms and saves credentials
  recordFormPassword(form) { ... }

  // Autofills login forms from saved credentials
  autoFillLoginForm() { ... }

  // Shows account selector dropdown
  showAccountSelector(input, accounts) { ... }
}
```

#### 2. PaymentFormCollector Class
```javascript
class PaymentFormCollector {
  fieldMapping = {
    cardnumber: 'cardNumber',
    card_number: 'cardNumber',
    cardholder: 'cardHolderName',
    expiry_month: 'expiryMonth',
    cvv: 'cvv',
    // ... many more mappings
  };

  // Detects payment forms
  isPaymentForm(form) { ... }

  // Autofills payment details
  fillFormWithPayment(formId, paymentData) { ... }
}
```

#### 3. AddressFormCollector Class
```javascript
class AddressFormCollector {
  fieldMapping = {
    name: 'name',
    address1: 'addressLine1',
    city: 'city',
    state: 'state',
    zipcode: 'zipCode',
    country: 'country',
    phone: 'phone',
    email: 'email'
  };

  // Detects address forms
  isAddressForm(form) { ... }

  // Autofills address data
  fillFormWithAddress(formId, addressData) { ... }
}
```

#### 4. Language/Fingerprint Override
```javascript
// Overrides navigator properties to match system language
function applyLanguageSettings(settings) {
  Object.defineProperty(navigator, 'language', {
    value: settings.primaryLanguage,
    configurable: true
  });

  Object.defineProperty(navigator, 'languages', {
    value: settings.languages,
    configurable: true
  });
}
```

### extensions.preload.cjs (Action Tracking)

**User Action Tracking:**
```javascript
// Tracks user actions and sends to Fellou servers
const trackAction = async (action) => {
  await fetch('https://proactive.fellou.ai/api/collection/pushActionSeq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: getSessionId(),
      action: action,
      timestamp: Date.now(),
      url: window.location.href
    })
  });
};

// Tracked events:
// - Click events with element details
// - Form submissions
// - Navigation changes
// - Scroll events
// - Text selection
```

**Chrome Runtime Emulation:**
```javascript
window.chrome.runtime = {
  onMessage: {
    addListener(callback) {
      ipcRenderer.on('extensionWindow.runtime.sendMessage', async (event, message, sender) => {
        return new Promise((resolve, reject) => {
          const sendResponse = (response) => {
            resolve(response);
          };
          callback(message, sender, sendResponse);
        });
      });
    }
  },
  sendMessage: (message, callback) => {
    ipcRenderer.invoke('runtime.sendMessage', { message }).then(callback);
  },
  connect: (extensionId, connectInfo) => ({
    name: connectInfo.name,
    postMessage: (message) => {
      ipcRenderer.send(`extension.port.message:${connectInfo.name}`, message);
    },
    onMessage: {
      addListener: (cb) => {
        ipcRenderer.on(`extension.port.message:${connectInfo.name}`, (event, msg) => cb(msg));
      }
    }
  })
};
```

---

## Database Schema

### SQLite Database Location
```
~/Library/Application Support/fellou/databases/
```

### Tables

#### 1. history
```sql
CREATE TABLE history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  title TEXT,
  visitTime INTEGER NOT NULL,
  visitCount INTEGER DEFAULT 1
);
```

#### 2. pass_table (Passwords)
```sql
CREATE TABLE pass_table (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  u TEXT NOT NULL,  -- username
  p TEXT NOT NULL,  -- password (encrypted)
  d TEXT NOT NULL,  -- domain
  created_at INTEGER,
  updated_at INTEGER
);
```

#### 3. temp_pass (Temporary passwords)
```sql
CREATE TABLE temp_pass (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  u TEXT,
  p TEXT,
  d TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
```

#### 4. address_table
```sql
CREATE TABLE address_table (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT,
  name TEXT,
  company TEXT,
  addressLine1 TEXT,
  addressLine2 TEXT,
  city TEXT,
  state TEXT,
  zipCode TEXT,
  country TEXT,
  phone TEXT,
  email TEXT
);
```

#### 5. payment_method
```sql
CREATE TABLE payment_method (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cardNumber TEXT,
  cardholderName TEXT,
  expiryMonth TEXT,
  expiryYear TEXT,
  cvv TEXT,
  paymentMethod TEXT,
  billingName TEXT,
  billingAddressLine1 TEXT,
  billingCity TEXT,
  billingState TEXT,
  billingZipCode TEXT,
  billingCountry TEXT
);
```

#### 6. bookmarks
```sql
CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  parentId TEXT,
  title TEXT,
  url TEXT,
  dateAdded INTEGER,
  index_ INTEGER
);
```

#### 7. extensions
```sql
CREATE TABLE extensions (
  id TEXT PRIMARY KEY,
  name TEXT,
  version TEXT,
  enabled INTEGER,
  permissions TEXT,
  manifest TEXT
);
```

---

## Authentication System

### Authing SSO Integration

**Auth Server:** `https://fellou.us.authing.co`

**OAuth Flow:**
1. User clicks login
2. Redirect to Authing login page
3. User authenticates (Google, Email, etc.)
4. Callback with auth code
5. Exchange code for tokens
6. Store tokens locally

**Token Storage:**
- Access token stored in secure storage
- Refresh token for token renewal
- User profile cached locally

**API Authentication:**
```javascript
// All API requests include auth header
const apiRequest = async (endpoint, options = {}) => {
  const token = await getAccessToken();
  return fetch(`https://api.fellou.ai${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });
};
```

---

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `https://api.fellou.ai` | Main API server |
| `https://agent.fellou.ai` | AI agent execution |
| `https://knowledge.prod.fellou.ai` | Knowledge base |
| `https://proactive.fellou.ai` | Action tracking |
| `https://fellou.us.authing.co` | Authentication |

---

## Security Analysis

### Concerns

1. **Context Isolation Disabled**
   - `contextIsolation: false` in webPreferences
   - Allows direct access to Node.js APIs from renderer
   - Security risk for malicious websites

2. **Shell Command Execution**
   - `computerUse.shell_exec` allows arbitrary command execution
   - Powerful but dangerous if exposed

3. **File System Access**
   - Full read/write access to file system
   - `computerUse.file_read`, `computerUse.file_write`

4. **Desktop Automation**
   - Complete mouse/keyboard control via RobotJS
   - Can interact with any application

5. **User Tracking**
   - Actions sent to `proactive.fellou.ai`
   - Includes clicks, navigation, form submissions

6. **Password Storage**
   - Passwords stored in SQLite
   - Encryption method not visible in minified code

### Mitigations Used

1. Permission requests for sensitive features
2. User consent for computer use capabilities
3. Local-only SQLite storage for credentials
4. Native module loading from unpacked asar

---

## How to Rebuild Fellou

### Project Structure
```
fellou/
├── package.json
├── electron.vite.config.ts
├── tsconfig.json
├── src/
│   ├── main/
│   │   ├── index.ts              # Main entry
│   │   ├── services/
│   │   │   ├── TabsService.ts
│   │   │   ├── AgentService.ts
│   │   │   ├── HistoryService.ts
│   │   │   ├── DownloadService.ts
│   │   │   ├── ProfileService.ts
│   │   │   ├── PermissionService.ts
│   │   │   ├── StorageService.ts
│   │   │   └── VADService.ts
│   │   ├── computerUse/
│   │   │   ├── screenshot.ts
│   │   │   ├── mouse.ts
│   │   │   ├── keyboard.ts
│   │   │   └── shell.ts
│   │   └── ipc/
│   │       └── handlers.ts
│   ├── preload/
│   │   ├── fellou.ts             # Core API exposure
│   │   ├── tabs.ts               # Form autofill
│   │   └── extensions.ts         # Extension API
│   └── renderer/
│       ├── index.html
│       ├── App.tsx
│       ├── pages/
│       ├── components/
│       └── stores/
└── resources/
    └── native/
        └── robotjs.node
```

### Key Dependencies
```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "latest",
    "@electron-toolkit/preload": "latest",
    "@electron-toolkit/utils": "latest",
    "@jitsi/robotjs": "0.6.14",
    "better-sqlite3": "11.9.1",
    "electron-updater": "latest",
    "posthog-node": "latest",
    "puppeteer-core": "23.9.0",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "sherpa-onnx-node": "1.11.3",
    "zustand": "5.0.3"
  },
  "devDependencies": {
    "electron": "34.4.1",
    "electron-builder": "latest",
    "electron-vite": "latest",
    "typescript": "5.x",
    "vite": "5.4.18"
  }
}
```

### Build Configuration

**electron.vite.config.ts:**
```typescript
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ['@jitsi/robotjs', 'better-sqlite3', 'sherpa-onnx-node']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react()]
  }
});
```

**electron-builder.json:**
```json
{
  "appId": "ai.fellou.browser",
  "productName": "Fellou",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist/**/*"
  ],
  "asarUnpack": [
    "node_modules/@jitsi/robotjs/**",
    "node_modules/better-sqlite3/**",
    "node_modules/sherpa-onnx-node/**"
  ],
  "mac": {
    "target": ["dmg", "zip"],
    "category": "public.app-category.productivity"
  }
}
```

---

## IPC Handler Categories

| Category | Count | Examples |
|----------|-------|----------|
| Tabs | ~25 | create, update, remove, query, captureVisibleTab |
| Windows | ~15 | create, update, remove, get, getAll, getCurrent |
| Storage | ~12 | local.get, local.set, sync.get, passwdTableQuery |
| Agent | ~20 | createTask, submitAction, chat, getTaskStatus |
| ComputerUse | ~15 | screenshot, click, type, scroll, shell_exec |
| History | ~8 | search, addUrl, deleteUrl, deleteAll, getVisits |
| Downloads | ~8 | download, pause, resume, cancel, open |
| Bookmarks | ~8 | create, get, getTree, update, remove |
| Permissions | ~6 | request, contains, remove, getAll |
| Extensions | ~10 | install, uninstall, enable, disable, getAll |
| VAD | ~4 | start, stop, onSpeechStart, onSpeechEnd |
| System | ~15 | getInfo, getCPU, getMemory, getDisplays |
| Profile | ~8 | create, switch, delete, getCurrent |
| Scripting | ~6 | executeScript, insertCSS, removeCSS |
| Runtime | ~10 | sendMessage, getURL, onMessage, onInstalled |
| BrowserUse | ~10 | connect, goto, evaluate, click, type |
| Log | ~4 | info, error, warn, debug |
| Modal | ~6 | savePaymentData, saveAddressData |

**Total: ~200+ IPC handlers**

---

## Renderer Architecture

### State Management (Zustand)

**Tab Store:**
```typescript
interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
  addTab: (tab: Tab) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
}
```

**Agent Store:**
```typescript
interface AgentState {
  tasks: Task[];
  currentTask: Task | null;
  isRunning: boolean;
  createTask: (prompt: string) => Promise<void>;
  stopTask: () => void;
}
```

### Component Hierarchy
```
App
├── TitleBar
│   ├── TrafficLights
│   ├── TabBar
│   │   └── Tab[]
│   └── WindowControls
├── Sidebar
│   ├── Navigation
│   ├── Bookmarks
│   └── History
├── MainContent
│   ├── AddressBar
│   ├── WebViewContainer
│   │   └── WebContentsView (native)
│   └── DevTools (conditional)
├── AgentPanel
│   ├── TaskList
│   ├── ChatInterface
│   └── ControlButtons
└── StatusBar
```

---

## Conclusion

Fellou is a sophisticated AI-powered browser that combines:

1. **Traditional Browser Features**: Tabs, history, bookmarks, downloads, extensions
2. **AI Agent Capabilities**: Task automation, intelligent browsing, chat interface
3. **Desktop Automation**: Full mouse/keyboard control, shell execution, file operations
4. **Voice Control**: Real-time VAD for voice commands
5. **Form Autofill**: Passwords, addresses, payment methods

The architecture leverages Electron's multi-process model with extensive IPC communication. The main process handles all native operations while preload scripts expose a comprehensive Chrome-compatible API to web content.

Key technologies to replicate:
- Electron 34+ with WebContentsView
- RobotJS for desktop automation
- Puppeteer-core for CDP browser control
- Sherpa-ONNX for voice processing
- SQLite for local storage
- React + Zustand for UI

The codebase is approximately 100,000+ lines across main process, preloads, and renderer.

---

## Additional Findings from Contents Folder

### App Metadata (Info.plist)

| Property | Value |
|----------|-------|
| Bundle ID | com.fellou.ai |
| Version | 2.5.19 |
| Team ID | 43D2K77YM8 |
| Copyright | ASI X Inc. |
| Min macOS | 10.13 |

**ASAR Integrity Verification:**
```
Algorithm: SHA256
Hash: 3DXWVPYFLAHPJP6JTLBDWVNMWKR26HN7HVQUZQ47SXMGQLVOPWMQ====
```

---

## Standalone Go Binaries

Two compiled Go binaries are bundled in `Contents/Resources/buildResources/`:

### 1. Fellou_gateway (8MB)

**Purpose:** Gateway/proxy service for network communication

**Identified Packages:**
- `gateway/cmd`
- Standard Go networking libraries

**Binary Details:**
```
Type: Mach-O 64-bit arm64 executable
Size: 8,295,680 bytes
Compiled with: Go toolchain
```

### 2. robot (8MB)

**Purpose:** Desktop automation service (separate from RobotJS)

**Identified Packages:**
- `github.com/kbinani/screenshot` - Screen capture library
- `github.com/go-vgo/robotgo` - Go-based robot automation
- Image processing libraries

**Capabilities:**
- Screen capture and region selection
- Keyboard simulation
- Mouse control
- Image recognition

**Binary Details:**
```
Type: Mach-O 64-bit arm64 executable
Size: 8,012,480 bytes
Compiled with: Go toolchain
```

---

## Bundled Extensions

### 1. fellou-agent-extension (v1.22.14)

**Location:** `Contents/Resources/buildResources/extensions/fellou-agent-extension/`

**Manifest V3 Configuration:**
```json
{
  "name": "fellou-agent-extension",
  "version": "1.22.14",
  "manifest_version": 3,
  "permissions": [
    "storage",
    "notifications",
    "tabs",
    "activeTab",
    "scripting",
    "cookies",
    "history",
    "webNavigation",
    "webRequest"
  ],
  "host_permissions": ["*://*/*"],
  "update_url": "https://fellou.s3.us-west-1.amazonaws.com/extensions/update.xml"
}
```

**Site-Specific Injectors:**
The extension includes content scripts for major websites:
- Google (search result extraction)
- Bing (search result extraction)
- DuckDuckGo (search result extraction)
- YouTube (video metadata extraction)
- GitHub (repository data extraction)
- LinkedIn (profile data extraction)
- Facebook (content extraction)
- Instagram (content extraction)
- Twitter/X (content extraction)
- Reddit (post/comment extraction)
- Quora (Q&A extraction)
- Notion (document extraction)
- Xiaohongshu (Chinese social media)
- Zhihu (Chinese Q&A platform)

**Key Libraries:**
- `Readability.js` - Mozilla's content extraction library
- `html2canvas` - HTML to canvas screenshot library

### 2. data-collection Extension

**Location:** `Contents/Resources/buildResources/extensions/data-collection/`

**Purpose:** Comprehensive user behavior tracking

**EventTracker Class Implementation:**
```javascript
class EventTracker {
  constructor() {
    this.subscribers = [];
  }

  // Tracked Events:
  // - click (with element details, coordinates)
  // - scroll (direction, position)
  // - input (text changes, masked for sensitive fields)
  // - select (text selection)
  // - submit (form submissions)
  // - file (file upload events)
  // - copy (clipboard events)
  // - keydown (keyboard shortcuts only)
  // - hover (element hover with duration)

  emit(event, data) {
    this.subscribers.forEach((callback) =>
      callback({
        action: {
          event,
          time: new Date().toISOString(),
          data
        },
        env: {
          url: window.location.href,
          title: document.title,
          web_content: window.get_clickable_element_str() || ''
        }
      })
    );
  }

  // Masks sensitive fields
  shouldMaskSensitiveField(element) {
    const sensitiveTypes = ['password', 'credit-card', 'cvv', 'ssn'];
    const sensitiveNames = ['password', 'pwd', 'pass', 'credit', 'card', 'cvv', 'ssn'];
    // Returns true if field should be masked
  }
}
```

**Search Engine Query Tracking:**
```javascript
// Tracks search queries from:
// - Baidu (wd parameter)
// - Google (q parameter)
// - Bing (q parameter)
// - DuckDuckGo (q parameter)
```

**Data Transmission:**
```javascript
chrome.runtime.sendMessage({
  type: "page_action_seq",
  data: action_sequence
});
```

---

## macOS Entitlements (CRITICAL)

**Location:** `Contents/Resources/buildResources/entitlements.mac.plist`

### Dangerous Permissions Requested:

```xml
<!-- JIT Compilation (required for V8) -->
<key>com.apple.security.cs.allow-jit</key>
<true/>

<!-- Unsigned Executable Memory (security risk) -->
<key>com.apple.security.cs.allow-unsigned-executable-memory</key>
<true/>

<!-- Library Validation Disabled (can load any dylib) -->
<key>com.apple.security.cs.disable-library-validation</key>
<true/>

<!-- Screen Recording Access -->
<key>com.apple.security.screen-recording</key>
<true/>

<!-- Microphone Access -->
<key>com.apple.security.device.audio-input</key>
<true/>

<!-- Camera Access -->
<key>com.apple.security.device.camera</key>
<true/>

<!-- Location Access -->
<key>com.apple.security.personal-information.location</key>
<true/>

<!-- SANDBOX DISABLED (CRITICAL) -->
<key>com.apple.security.app-sandbox</key>
<false/>

<!-- User-Selected File Access -->
<key>com.apple.security.files.user-selected.read-write</key>
<true/>
```

### Access to Other Browser Data:

The app explicitly requests access to other browsers' data directories:

```xml
<key>com.apple.security.temporary-exception.files.absolute-path.read-write</key>
<array>
  <string>/Users/*/Library/Application Support/Google/Chrome/</string>
  <string>/Users/*/Library/Application Support/Microsoft Edge/</string>
  <string>/Users/*/Library/Application Support/Arc/</string>
  <string>/Users/*/Library/Application Support/Firefox/</string>
  <string>/Users/*/Library/Application Support/BraveSoftware/</string>
  <string>/Users/*/Library/Application Support/com.operasoftware.Opera/</string>
</array>
```

**Implications:**
- Can read passwords, cookies, history from Chrome, Edge, Arc, Firefox, Brave, Opera
- No sandbox isolation from system
- Can execute arbitrary native code
- Full screen recording capability

---

## Auto-Update System

**Configuration:** `Contents/Resources/app-update.yml`

```yaml
provider: generic
url: http://172.17.163.15:3000/
updaterCacheDirName: fellou-updater
```

**Note:** The update URL points to an internal IP address (172.17.163.15), indicating this is a development/internal build. Production builds likely use a public update server.

**Update Framework:** Squirrel (via `Squirrel.framework` in Frameworks folder)

---

## Voice Activity Detection Model

**Location:** `Contents/Resources/models/ten-vad/model.onnx`

**Details:**
- Format: ONNX (Open Neural Network Exchange)
- Size: 129 KB
- Purpose: Voice Activity Detection for voice commands
- Runtime: Sherpa-ONNX

---

## Native Modules (app.asar.unpacked)

### 1. @sentry/cli-darwin
```
Binary: sentry-cli (25 MB)
Purpose: Error reporting and crash analytics
```

### 2. canvas
```
Libraries:
- libcairo.2.dylib (1.1 MB)
- libpango-1.0.0.dylib (355 KB)
- libpangocairo-1.0.0.dylib (66 KB)
- libglib-2.0.0.dylib (1.4 MB)
- libgobject-2.0.0.dylib (420 KB)
- libpixman-1.0.dylib (596 KB)
- libpng16.16.dylib (213 KB)
- libfontconfig.1.dylib (281 KB)
- libfreetype.6.dylib (691 KB)
- libharfbuzz.0.dylib (1.6 MB)
- libjpeg.62.dylib (433 KB)
- librsvg-2.2.dylib (2.2 MB)

Purpose: Server-side canvas rendering for image manipulation
```

### 3. sherpa-onnx-darwin-arm64
```
Libraries:
- libonnxruntime.1.17.1.dylib (24 MB) - ONNX runtime
- libsherpa-onnx-c-api.dylib (2.9 MB) - Sherpa C API
- libsherpa-onnx-core.dylib (1.7 MB) - Sherpa core
- libsherpa-onnx-kaldifst-core.dylib (118 KB)
- libsherpa-onnx-fstfar.dylib (89 KB)
- libkaldi-native-fbank-core.dylib (117 KB)

Purpose: Voice Activity Detection and speech processing
```

---

## Frameworks

| Framework | Purpose |
|-----------|---------|
| Electron Framework | Core Electron runtime |
| Squirrel.framework | Auto-update mechanism |
| Mantle.framework | Model layer for Cocoa (Objective-C) |
| ReactiveObjC.framework | Reactive programming for Objective-C |

---

## Complete Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FELLOU BROWSER ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        MAIN PROCESS                                  │    │
│  │                                                                      │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                 │    │
│  │  │ TabsService  │ │ AgentService │ │ ProfileServ  │                 │    │
│  │  │ (tabs, nav)  │ │ (AI tasks)   │ │ (user data)  │                 │    │
│  │  └──────────────┘ └──────────────┘ └──────────────┘                 │    │
│  │                                                                      │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                 │    │
│  │  │ ComputerUse  │ │ VADService   │ │ StorageServ  │                 │    │
│  │  │ (RobotJS)    │ │ (Sherpa-ONNX)│ │ (SQLite)     │                 │    │
│  │  └──────────────┘ └──────────────┘ └──────────────┘                 │    │
│  │                                                                      │    │
│  │  ┌──────────────────────────────────────────────────────────────┐   │    │
│  │  │            NATIVE BINARIES (Go)                               │   │    │
│  │  │  ┌─────────────────┐  ┌─────────────────┐                     │   │    │
│  │  │  │ Fellou_gateway  │  │     robot       │                     │   │    │
│  │  │  │ (proxy/network) │  │ (automation)    │                     │   │    │
│  │  │  └─────────────────┘  └─────────────────┘                     │   │    │
│  │  └──────────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                               │                                              │
│                    IPC (200+ handlers)                                       │
│                               │                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        PRELOAD LAYER                                 │    │
│  │                                                                      │    │
│  │  ┌──────────────────────────────────────────────────────────────┐   │    │
│  │  │ fellou-D8DJ2uno.cjs - window.chrome API                       │   │    │
│  │  └──────────────────────────────────────────────────────────────┘   │    │
│  │  ┌─────────────────┐  ┌─────────────────┐                          │    │
│  │  │ tabs.preload    │  │ extensions.preload│                         │    │
│  │  │ (autofill)      │  │ (tracking)        │                         │    │
│  │  └─────────────────┘  └─────────────────┘                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                               │                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        BUNDLED EXTENSIONS                            │    │
│  │                                                                      │    │
│  │  ┌─────────────────────────────┐ ┌─────────────────────────────┐    │    │
│  │  │ fellou-agent-extension      │ │ data-collection             │    │    │
│  │  │ - Site-specific extractors  │ │ - EventTracker              │    │    │
│  │  │ - Readability.js            │ │ - User behavior tracking    │    │    │
│  │  │ - html2canvas               │ │ - Search query logging      │    │    │
│  │  └─────────────────────────────┘ └─────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                               │                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        RENDERER PROCESS                              │    │
│  │                                                                      │    │
│  │  React 18.3.1 + Zustand 5.0.3                                       │    │
│  │  - TabBar, AddressBar, Sidebar                                      │    │
│  │  - AgentPanel, ChatInterface                                        │    │
│  │  - WebContentsView (tab content)                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                           EXTERNAL SERVICES                                  │
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ api.fellou.ai│ │agent.fellou  │ │proactive     │ │authing.co    │       │
│  │ (main API)   │ │(AI agent)    │ │(tracking)    │ │(auth SSO)    │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Security Concerns Summary

| Concern | Severity | Description |
|---------|----------|-------------|
| Sandbox Disabled | CRITICAL | App runs without macOS sandbox protection |
| Other Browser Access | CRITICAL | Can read Chrome, Firefox, Edge, Brave, Opera data |
| Shell Execution | HIGH | Can execute arbitrary shell commands |
| Library Validation Disabled | HIGH | Can load unsigned dynamic libraries |
| Comprehensive Tracking | HIGH | Tracks all user interactions and sends to servers |
| Screen Recording | MEDIUM | Full screen capture capability |
| File System Access | MEDIUM | Read/write access to user-selected files |
| Microphone/Camera | MEDIUM | Audio and video capture capabilities |

---

## Recommendations for Rebuilding

To build a similar browser without the concerning elements:

1. **Enable Sandbox:** Set `com.apple.security.app-sandbox` to `true`
2. **Remove Other Browser Access:** Don't request access to other browser data directories
3. **Limit Tracking:** Implement privacy-respecting analytics (or none)
4. **Require Consent:** Always get explicit user consent before automation
5. **Secure IPC:** Validate all IPC messages and limit exposed APIs
6. **Context Isolation:** Enable `contextIsolation: true` in webPreferences
7. **Sandboxed Preload:** Use `sandbox: true` for renderer processes
