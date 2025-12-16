# @eko-ai/eko-electron

Electron environment support for the Eko framework. Provides agents and utilities for building AI-powered desktop applications.

## Installation

```bash
pnpm add @eko-ai/eko-electron @eko-ai/eko
# or
npm install @eko-ai/eko-electron @eko-ai/eko
```

**Peer Dependencies:** Requires `electron >= 20.0.0` (recommended: `>= 35.0.0` for best compatibility)

## Features

- **BrowserAgent** - Browser automation using Electron's WebContentsView
- **FileAgent** - File system operations with fs/promises
- **SimpleStdioMcpClient** - STDIO-based MCP client for external tool integration
- **CDP Utilities** - Chrome DevTools Protocol helpers for advanced automation

## Security Requirements

For secure operation, configure your host WebContentsView with:

```typescript
const view = new WebContentsView({
  webPreferences: {
    contextIsolation: true,   // Required: isolate preload scripts
    sandbox: true,            // Required: enable sandbox
    nodeIntegration: false,   // Required: disable Node in renderer
  }
});
```

## Usage

### BrowserAgent

Automates browser actions within an Electron WebContentsView:

```typescript
import { BrowserAgent, DEFAULT_PDFJS_CONFIG } from '@eko-ai/eko-electron';
import { Eko } from '@eko-ai/eko';
import { WebContentsView } from 'electron';

// Create and configure your WebContentsView
const detailView = new WebContentsView({
  webPreferences: {
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
  }
});

// Create BrowserAgent
const browserAgent = new BrowserAgent(detailView);

// Optional: Enable PDF content extraction
browserAgent.setPdfJsConfig(DEFAULT_PDFJS_CONFIG);

// Use with Eko workflow
const eko = new Eko({
  llms: {
    default: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5-20250929',
      apiKey: process.env.ANTHROPIC_API_KEY
    }
  }
});

const workflow = await eko.generate('Navigate to example.com and take a screenshot');
const result = await eko.execute(workflow, {
  agents: [browserAgent]
});
```

#### PDF Extraction Configuration

PDF extraction is opt-in using the `setPdfJsConfig()` method. For production, bundle PDF.js locally:

```typescript
const browserAgent = new BrowserAgent(detailView);

// Production: Use local bundle
browserAgent.setPdfJsConfig({
  libraryUrl: 'app://assets/pdf.min.js',
  workerUrl: 'app://assets/pdf.worker.min.js',
  cmapUrl: 'app://assets/cmaps/',
});

// Development: Use CDN (not recommended for production)
browserAgent.setPdfJsConfig(DEFAULT_PDFJS_CONFIG);
```

### FileAgent

Provides file system operations for desktop applications:

```typescript
import { FileAgent } from '@eko-ai/eko-electron';
import { app, WebContentsView } from 'electron';

// Create FileAgent
const fileAgent = new FileAgent(
  detailView,              // WebContentsView for file update notifications
  app,                     // Electron app instance
  '/path/to/workdir'       // Optional: base working directory
);

// Optional: Configure preview URL generation
fileAgent.setPreviewUrlGenerator((filePath, fileName, isPackaged) =>
  isPackaged ? `app://${fileName}` : `http://localhost:3000/${fileName}`
);

// Optional: Customize IPC channel (default: 'file-updated')
fileAgent.setIpcChannel('custom-file-channel');

// Available tools:
// - file_list: List files and directories
// - file_read: Read file contents
// - file_write: Write content to file (creates directories as needed)
// - file_str_replace: Replace strings in files using regex
// - file_find_by_name: Find files using glob patterns
```

### SimpleStdioMcpClient

Connect to MCP servers via STDIO:

```typescript
import { SimpleStdioMcpClient, BrowserAgent } from '@eko-ai/eko-electron';

// Create MCP client
const mcpClient = new SimpleStdioMcpClient(
  'npx',                           // Command
  ['-y', '@anthropic/mcp-server'], // Arguments
  { stdio: ['pipe', 'pipe', 'pipe'] }  // Spawn options
);

// Connect and use with agents
await mcpClient.connect();

const browserAgent = new BrowserAgent(detailView, mcpClient);

// List available tools
const tools = await mcpClient.listTools({});

// Call a tool directly
const result = await mcpClient.callTool({
  name: 'tool_name',
  arguments: { key: 'value' }
});

// Close when done
await mcpClient.close();
```

## API Reference

### BrowserAgent

**Constructor:**

```typescript
new BrowserAgent(
  detailView: WebContentsView,
  mcpClient?: IMcpClient,
  customPrompt?: string
)
```

**Configuration Methods:**

| Method | Description |
|--------|-------------|
| `setPdfJsConfig(config)` | Configure PDF.js for PDF extraction (opt-in) |
| `setCookies(cookies)` | Set cookies to apply before navigation |

**Cookie Management:**

```typescript
import { BrowserAgent, CookiesSetDetails } from '@eko-ai/eko-electron';

const browserAgent = new BrowserAgent(detailView);

// Set cookies before navigation
browserAgent.setCookies([
  { url: 'https://example.com', name: 'session', value: 'abc123' },
  { url: 'https://example.com', name: 'auth', value: 'token', httpOnly: true }
]);

// Cookies are automatically applied when navigate_to is called
```

**Core Methods:**

| Method | Description |
|--------|-------------|
| `screenshot()` | Capture page as JPEG base64 |
| `navigate_to(url)` | Navigate to URL |
| `execute_script(func, args)` | Execute JavaScript in page context |
| `get_current_page()` | Get current tab info |
| `get_all_tabs()` | List all tabs (single view returns current) |
| `switch_tab(tabId)` | Switch to tab by ID |
| `go_back()` | Navigate back in history |
| `extract_page_content()` | Extract page text (supports PDF if configured) |

### FileAgent

**Constructor:**

```typescript
new FileAgent(
  detailView: WebContentsView,
  electronApp: App,
  workPath?: string,
  mcpClient?: IMcpClient,
  customPrompt?: string
)
```

**Configuration Methods:**

| Method | Description |
|--------|-------------|
| `setPreviewUrlGenerator(fn)` | Configure preview URL generation (opt-in) |
| `setIpcChannel(channel)` | Set IPC channel name (default: `'file-updated'`) |
| `setWorkPath(path)` | Change working directory |
| `setSecurityOptions(options)` | Configure path security restrictions |

**Security Options:**

```typescript
interface FileSecurityOptions {
  restrictToWorkPath?: boolean;  // Default: true (secure by default)
  allowedPaths?: string[];       // Additional allowed directories
}

// Examples:
// Allow unrestricted file access (use with caution)
agent.setSecurityOptions({ restrictToWorkPath: false });

// Restrict to workPath but allow additional directories
agent.setSecurityOptions({
  restrictToWorkPath: true,
  allowedPaths: ['/tmp', app.getPath('downloads')]
});
```

**Properties:**

| Property | Description |
|----------|-------------|
| `WorkPath` | Get current working directory |

**Tools:**

| Tool | Description |
|------|-------------|
| `file_list` | List directory contents with metadata |
| `file_read` | Read file as UTF-8 string |
| `file_write` | Write/append content to file |
| `file_str_replace` | Regex-based string replacement |
| `file_find_by_name` | Glob pattern file search |

### SimpleStdioMcpClient

| Method | Description |
|--------|-------------|
| `connect()` | Spawn and connect to MCP server |
| `listTools(param)` | List available tools |
| `callTool(param)` | Execute a tool |
| `isConnected()` | Check connection status |
| `close()` | Terminate MCP server process |

### CDP Utilities

Low-level Chrome DevTools Protocol utilities for advanced automation:

```typescript
import {
  getCdpWsEndpoint,
  attachCdpSession,
  detachCdpSession,
  sendCdpCommand
} from '@eko-ai/eko-electron';

// Connect to external Chrome instance
const wsEndpoint = await getCdpWsEndpoint(9222);
// Returns: ws://localhost:9222/devtools/browser/{session-id}

// Attach CDP session to WebContents
const webContents = myWebContentsView.webContents;
const debuggerSession = attachCdpSession(webContents);

// Send CDP commands directly
const screenshot = await sendCdpCommand(webContents, 'Page.captureScreenshot', {
  format: 'png',
  quality: 80
});
console.log(screenshot.data); // base64 image

// Detach when done
detachCdpSession(webContents);
```

**CDP Functions:**

| Function | Description |
|----------|-------------|
| `getCdpWsEndpoint(port)` | Get WebSocket endpoint from Chrome debugging port |
| `attachCdpSession(webContents)` | Attach CDP debugger to WebContents |
| `detachCdpSession(webContents)` | Detach CDP debugger from WebContents |
| `sendCdpCommand(webContents, method, params?)` | Execute CDP command (auto-attaches/detaches) |

## Design Philosophy

This package follows the Eko framework's **builder pattern** using setter methods for optional configuration. This provides:

- **Non-breaking**: Setters are additive, not breaking changes
- **Consistency**: Matches `eko-nodejs` and other Eko packages
- **Flexibility**: Configure only what you need, when you need it
- **Production-ready**: External dependencies (PDF.js, preview URLs) are opt-in
- **Secure by default**: Path traversal protection enabled by default

Compare with `eko-nodejs`:

```typescript
// eko-nodejs pattern
const browser = new BrowserAgent();
browser.setHeadless(true);
browser.setCdpWsEndpoint('ws://...');
browser.setCookies([{ url: '...', name: '...', value: '...' }]);

// eko-electron follows the same pattern
const browser = new BrowserAgent(detailView);
browser.setPdfJsConfig(config);
browser.setCookies([{ url: '...', name: '...', value: '...' }]);
```

## License

MIT
