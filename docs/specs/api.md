# API Documentation
## Eko AI Framework

---

## 1. Core API

### 1.1 Eko Class

The main orchestrator for workflow generation and execution.

```typescript
import { Eko } from '@eko-ai/eko';

const eko = new Eko(config: EkoConfig, chatId?: string);
```

#### Constructor Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `config` | `EkoConfig` | Yes | Framework configuration |
| `chatId` | `string` | No | Unique chat session ID (auto-generated) |

#### EkoConfig

```typescript
interface EkoConfig {
  llms: LLMs;                      // Required: LLM provider configs
  agents?: Agent[];                // Custom agents
  planLlms?: string[];            // LLMs for workflow planning
  compressLlms?: string[];        // LLMs for context compression
  callback?: AgentStreamCallback; // Stream event handler
  defaultMcpClient?: IMcpClient;  // Default MCP client
  episodicMemory?: EpisodicMemory; // Learning memory
}
```

---

### 1.2 Workflow Generation

#### `generate()`

Generate a workflow from natural language without execution.

```typescript
async generate(
  taskPrompt: string,
  taskId?: string,
  contextParams?: Record<string, any>,
  datetime?: string
): Promise<Workflow>
```

**Example:**
```typescript
const workflow = await eko.generate(
  'Search for AI news and save to desktop'
);
console.log(workflow.agents); // Array of WorkflowAgent
```

#### `modify()`

Modify an existing workflow with natural language.

```typescript
async modify(
  taskId: string,
  modifyPrompt: string
): Promise<Workflow>
```

---

### 1.3 Execution

#### `execute()`

Execute an already-generated workflow.

```typescript
async execute(taskId: string): Promise<EkoResult>
```

#### `run()`

Generate and execute a workflow in one call.

```typescript
async run(
  taskPrompt: string,
  taskId?: string,
  contextParams?: Record<string, any>
): Promise<EkoResult>
```

**Example:**
```typescript
const result = await eko.run(
  'Navigate to GitHub and star the eko repository'
);

if (result.success) {
  console.log('Result:', result.result);
} else {
  console.error('Error:', result.error);
}
```

#### EkoResult

```typescript
interface EkoResult {
  taskId: string;
  success: boolean;
  stopReason: 'abort' | 'error' | 'done';
  result: string;
  error?: unknown;
}
```

---

### 1.4 Task Control

#### `getTask()`

```typescript
getTask(taskId: string): TaskContext | undefined
```

#### `getAllTaskId()`

```typescript
getAllTaskId(): string[]
```

#### `abortTask()`

```typescript
abortTask(taskId: string, reason?: string): boolean
```

#### `pauseTask()`

```typescript
pauseTask(
  taskId: string,
  pause: boolean,
  abortCurrentStep?: boolean,
  reason?: string
): boolean
```

#### `deleteTask()`

```typescript
deleteTask(taskId: string): boolean
```

---

## 2. Agent API

### 2.1 Agent Base Class

```typescript
import { Agent, AgentParams } from '@eko-ai/eko';

class CustomAgent extends Agent {
  constructor() {
    super({
      name: 'CustomAgent',
      description: 'Agent description for LLM',
      tools: [/* Tool[] */],
      llms: ['default'],
      planDescription: 'How this agent fits in workflows'
    });
  }
}
```

#### AgentParams

```typescript
interface AgentParams {
  name: string;
  description: string;
  tools: Tool[];
  llms?: string[];
  mcpClient?: IMcpClient;
  planDescription?: string;
  requestHandler?: (request: LLMRequest) => void;
}
```

### 2.2 Agent Methods

| Method | Return | Description |
|--------|--------|-------------|
| `run(context, chain)` | `Promise<string>` | Execute agent |
| `Name()` | `string` | Agent name |
| `Description()` | `string` | Agent description |
| `Tools()` | `Tool[]` | Registered tools |
| `addTool(tool)` | `void` | Add tool dynamically |

### 2.3 Extension Hooks

```typescript
class CustomAgent extends Agent {
  // Override system prompt
  async extSysPrompt(context: AgentContext, tools: Tool[]): Promise<string> {
    return 'Additional instructions...';
  }
  
  // Override tool loading
  async loadTools(context: TaskContext): Promise<Tool[]> {
    return [...super.loadTools(context), new CustomTool()];
  }
  
  // Override prompt building
  async buildSystemPrompt(context: AgentContext, tools: Tool[]): Promise<string>;
  async buildUserPrompt(context: AgentContext, tools: Tool[]): Promise<TextPart[]>;
}
```

---

## 3. Tool API

### 3.1 Tool Interface

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;  // Zod schema or JSON Schema
  execute: (
    args: Record<string, unknown>,
    context?: AgentContext
  ) => Promise<ToolResult>;
}

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  extInfo?: Record<string, unknown>;
}
```

### 3.2 Built-in Tools

#### Core Tools (eko-core)

| Tool | Description |
|------|-------------|
| `ForeachTaskTool` | Iterate over items in workflows |
| `WatchTriggerTool` | DOM/GUI/file event listeners |
| `HumanInteractTool` | User confirmation/input dialogs |
| `HttpRequestTool` | HTTP requests with method/headers/body |
| `VariableStorageTool` | Workflow variable get/set/list operations |
| `TodoListManagerTool` | Manage task todo lists during execution |
| `TaskNodeStatusTool` | Query and update workflow node status |
| `TaskResultCheckTool` | Validate task completion criteria |

#### Node.js Tools (eko-nodejs)

| Tool | Parameters | Description |
|------|------------|-------------|
| `ShellExecTool` | `command`, `cwd`, `timeout`, `background` | Shell execution |
| `FileReadTool` | `path` | Read file contents |
| `FileWriteTool` | `path`, `content`, `append` | Write to file |
| `FileDeleteTool` | `path` | Delete file/directory |
| `FileListTool` | `path` | List directory |
| `FileFindTool` | `pattern`, `path` | Glob search |

---

## 4. LLM Configuration

### 4.1 LLMs Type

```typescript
interface LLMs {
  default: LLMConfig;  // Required default config
  [key: string]: LLMConfig;
}

interface LLMConfig {
  provider: LLMprovider;
  model: string;
  apiKey: string | (() => Promise<string>);
  config?: {
    baseURL?: string | (() => Promise<string>);
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
  };
  handler?: (options, context, agentContext) => Promise<options>;
}

type LLMprovider = 
  | 'openai' 
  | 'anthropic' 
  | 'google' 
  | 'aws' 
  | 'openrouter' 
  | 'openai-compatible' 
  | 'modelscope' 
  | ProviderV2;
```

### 4.2 Multi-Provider Example

```typescript
const llms: LLMs = {
  default: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    apiKey: process.env.ANTHROPIC_API_KEY!
  },
  openai: {
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY!
  },
  local: {
    provider: 'openai-compatible',
    model: 'llama3',
    apiKey: 'ollama',
    config: { baseURL: 'http://localhost:11434/v1' }
  }
};
```

---

## 5. Streaming API

### 5.1 Stream Callback

```typescript
interface AgentStreamCallback {
  onMessage: (
    message: AgentStreamMessage,
    context?: AgentContext
  ) => Promise<void>;
}
```

### 5.2 Message Types

```typescript
type AgentStreamMessage = {
  streamType: 'agent';
  chatId: string;
  taskId: string;
  agentName: string;
  nodeId?: string;
} & (
  | { type: 'workflow'; streamDone: boolean; workflow: Workflow; }
  | { type: 'agent_start'; agentNode: WorkflowAgent; }
  | { type: 'text'; streamId: string; streamDone: boolean; text: string; }
  | { type: 'tool_use'; toolName: string; toolCallId: string; params: object; }
  | { type: 'tool_result'; toolName: string; toolResult: ToolResult; }
  | { type: 'agent_result'; agentNode: WorkflowAgent; result?: string; error?: any; }
  | { type: 'error'; error: unknown; }
  | { type: 'finish'; finishReason: string; usage: TokenUsage; }
);
```

---

## 6. MCP Client API

### 6.1 IMcpClient Interface

```typescript
interface IMcpClient {
  listTools(): Promise<Tool[]>;
  callTool(name: string, args: object): Promise<ToolResult>;
}
```

### 6.2 Available Clients

| Client | Transport | Package |
|--------|-----------|---------|
| `SimpleSseMcpClient` | Server-Sent Events | eko-core |
| `SimpleHttpMcpClient` | HTTP | eko-core |
| `SimpleStdioMcpClient` | Standard I/O | eko-nodejs |

---

## 7. Error Handling

### 7.1 Error Types

| Error | Cause | Recovery |
|-------|-------|----------|
| `AbortError` | User cancellation | Clean exit |
| `LLM Error` | Provider failure | Retry with failover |
| `Tool Error` | Tool execution failure | Return in ToolResult |
| `Security Error` | Blocked operation | Reject immediately |

### 7.2 Best Practices

```typescript
try {
  const result = await eko.run('complex task');
} catch (error) {
  if (error.name === 'AbortError') {
    // User cancelled
  } else if (error.message?.includes('content-filter')) {
    // LLM content policy violation
  } else {
    // General error
  }
}
```
