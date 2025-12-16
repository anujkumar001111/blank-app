# Backend Documentation
## Eko AI Framework

---

## 1. Overview

Eko's backend architecture is implemented in the `eko-nodejs` package, providing:
- **Browser Automation** via Playwright
- **File System Operations** with security controls
- **Shell Command Execution** with dangerous pattern blocking
- **MCP Client** for stdio-based integrations

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        eko-nodejs                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  BrowserAgent   │  │  SystemAgent    │  │  MCP Client     │  │
│  │                 │  │                 │  │                 │  │
│  │  • Playwright   │  │  • ShellExec    │  │  • Stdio        │  │
│  │  • Stealth      │  │  • FileRead     │  │  • Transport    │  │
│  │  • CDP          │  │  • FileWrite    │  │                 │  │
│  └────────┬────────┘  │  • FileDelete   │  └─────────────────┘  │
│           │           │  • FileList     │                       │
│           │           │  • FileFind     │                       │
│           │           └────────┬────────┘                       │
│           │                    │                                │
│           ▼                    ▼                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Security Layer                           ││
│  │                                                             ││
│  │  • resolvePath()     - Path traversal protection            ││
│  │  • DANGEROUS_PATTERNS - Shell command blocking              ││
│  │  • formatFileSize()   - Safe output formatting              ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Components

### 3.1 BrowserAgent

**Location**: `eko-nodejs/src/browser.ts`

```typescript
class BrowserAgent extends BaseBrowserLabelsAgent {
  // Configuration
  setHeadless(headless: boolean): void;
  setCdpWsEndpoint(endpoint: string): void;
  setCookies(cookies: Cookie[]): void;
  
  // Navigation
  navigate_to(context, url): Promise<PageInfo>;
  open_url(context, url): Promise<Page>;
  get_all_tabs(context): Promise<TabInfo[]>;
  switch_tab(context, tabId): Promise<TabInfo>;
  
  // Interaction
  click_element(context, index, clicks, button): Promise<void>;
  input_text(context, index, text, enter): Promise<void>;
  hover_to_element(context, index): Promise<void>;
  
  // Input
  typing(context, text): Promise<void>;
  press(context, key): Promise<void>;
  hotkey(context, keys): Promise<void>;
  
  // Capture
  screenshot(context): Promise<ImageData>;
}
```

**Dependencies**:
- `playwright-extra` - Enhanced Playwright with plugin support
- `puppeteer-extra-plugin-stealth` - Bot detection avoidance
- `chromium-bidi` - BiDi protocol support

### 3.2 SystemAgent

**Location**: `eko-nodejs/src/system.ts`

```typescript
interface SystemAgentOptions {
  workPath?: string;           // Working directory
  enableShellSafety?: boolean; // Enable command blocking (default: true)
  restrictToWorkPath?: boolean; // Restrict file ops to workPath
  allowedPaths?: string[];     // Additional allowed paths
}

class SystemAgent extends Agent {
  constructor(options?: SystemAgentOptions);
  
  // Provides these tools:
  // - shell_exec
  // - file_read
  // - file_write
  // - file_delete
  // - file_list
  // - file_find
}
```

### 3.3 File Tools

| Tool | File | Purpose |
|------|------|---------|
| `FileReadTool` | `tools/file-read.ts` | Read file contents (UTF-8) |
| `FileWriteTool` | `tools/file-write.ts` | Write/append to files |
| `FileDeleteTool` | `tools/file-delete.ts` | Delete files/directories |
| `FileListTool` | `tools/file-list.ts` | List directory contents |
| `FileFindTool` | `tools/file-find.ts` | Glob pattern file search |

### 3.4 ShellExecTool

**Location**: `eko-nodejs/src/tools/shell-exec.ts`

```typescript
interface ShellExecArgs {
  action?: 'run' | 'view' | 'kill' | 'list';
  command?: string;      // Required for 'run'
  cwd?: string;          // Working directory
  timeout?: number;      // Default: 30000ms
  env?: Record<string, string>;
  background?: boolean;  // Non-blocking execution
  jobId?: string;        // For view/kill actions
}

// Background job management
const result = await tool.execute({
  command: 'npm run dev',
  background: true
}); // Returns { jobId: "job-123", status: "started" }

// View job output
await tool.execute({ action: 'view', jobId: 'job-123' });
```

---

## 4. Security Architecture

### 4.1 Dangerous Pattern Blocking

```typescript
// eko-nodejs/src/tools/shell-exec.ts
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\/(?!\w)/,  // rm -rf / (but allow rm -rf /path)
  />\s*\/dev\/sd/,         // Write to block devices
  /mkfs/,                  // Format filesystems
  /:\(\)\{.*\};:/,         // Fork bombs
];
```

### 4.2 Path Traversal Protection

```typescript
// eko-nodejs/src/tools/security.ts
function resolvePath(
  basePath: string,
  userPath: string,
  options?: FileSecurityOptions
): string {
  // Resolves path relative to basePath
  // Blocks traversal attempts (../)
  // Validates against allowedPaths
}
```

### 4.3 Security Configuration

```typescript
// Recommended production configuration
const systemAgent = new SystemAgent({
  workPath: '/app/workspace',
  enableShellSafety: true,
  restrictToWorkPath: true,
  allowedPaths: ['/tmp']
});
```

---

## 5. MCP Integration

### 5.1 Stdio Client

**Location**: `eko-nodejs/src/mcp/stdio.ts`

```typescript
class SimpleStdioMcpClient implements IMcpClient {
  constructor(command: string, args?: string[]);
  
  // MCP protocol methods
  listTools(): Promise<Tool[]>;
  callTool(name: string, args: object): Promise<ToolResult>;
}
```

### 5.2 Usage Example

```typescript
const mcpClient = new SimpleStdioMcpClient('npx', [
  '-y', '@modelcontextprotocol/server-filesystem', '/path'
]);

const agent = new Agent({
  name: 'FileAgent',
  description: 'File operations via MCP',
  tools: [],
  mcpClient: mcpClient
});
```

---

## 6. Memory & Storage

### 6.1 FileStorageProvider

**Location**: `eko-nodejs/src/memory/`

```typescript
class FileStorageProvider implements EpisodicStorageProvider {
  constructor(filePath: string);
  
  read(): Promise<Episode[]>;
  write(episodes: Episode[]): Promise<void>;
  exists(): Promise<boolean>;
}
```

### 6.2 Usage

```typescript
import { EpisodicMemory } from '@eko-ai/eko';
import { FileStorageProvider } from '@eko-ai/eko-nodejs';

const memory = new EpisodicMemory({
  storage: new FileStorageProvider('./episodes.json'),
  maxEpisodes: 100
});
```

---

## 7. CLI Playground

**Location**: `eko-nodejs/cli/`

```bash
# Interactive mode
cd packages/eko-nodejs
pnpm playground:interactive

# Full demo with options
pnpm playground:full --browser   # Browser automation demo
pnpm playground:full --system    # System tools demo
pnpm playground:full --workflow  # Workflow demo
```

---

## 8. API Endpoints (When Used as Service)

Eko is primarily a library, but when wrapped in an API server:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/eko/generate` | POST | Generate workflow from prompt |
| `/api/eko/execute` | POST | Execute existing workflow |
| `/api/eko/run` | POST | Generate + execute in one call |
| `/api/eko/task/:id` | GET | Get task status |
| `/api/eko/task/:id/abort` | POST | Abort task execution |
| `/api/eko/task/:id/pause` | POST | Pause/resume task |

---

## 9. Error Handling

### Error Types

| Error | Source | Handling |
|-------|--------|----------|
| `AbortError` | Task cancellation | Clean shutdown |
| `TimeoutError` | Shell/browser timeout | Return partial result |
| `SecurityError` | Blocked command/path | Reject with message |
| `ToolError` | Tool execution failure | Return in ToolResult |

### Example

```typescript
try {
  const result = await eko.run('dangerous task');
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Task was cancelled');
  } else {
    console.error('Task failed:', error.message);
  }
}
```

---

## 10. Performance Considerations

### Playwright Optimization
- **Persistent browser context** for cookie/session reuse
- **Stealth plugin** to avoid detection overhead
- **CDP endpoint** support for existing browsers

### Shell Execution
- **Background jobs** for long-running commands
- **Output buffering** with 10MB limit
- **Process cleanup** on exit/signal

### Memory Management
- **Episode limits** in EpisodicMemory
- **Message compression** in conversation history
- **Streaming** for LLM responses
