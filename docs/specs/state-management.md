# State Management Documentation
## Eko AI Framework

---

## 1. Overview

Eko implements a hierarchical state management system with three levels:
- **Global State** - Framework-wide configuration
- **Task State** - Per-workflow execution context
- **Agent State** - Per-agent execution context

---

## 2. State Hierarchy

```
┌──────────────────────────────────────────────────────────────┐
│                      Global State                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  chatMap: Map<string, ChatContext>                     │  │
│  │  taskMap: Map<string, TaskContext>                     │  │
│  │  prompts: Map<string, string>                          │  │
│  │  chatService?: ChatService                             │  │
│  │  browserService?: BrowserService                       │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    Task State (TaskContext)                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  taskId: string                                        │  │
│  │  chatId: string                                        │  │
│  │  config: EkoConfig                                     │  │
│  │  workflow: Workflow                                    │  │
│  │  controller: AbortController                           │  │
│  │  chain: Chain                                          │  │
│  │  status: 'running' | 'paused' | 'aborted' | 'done'     │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                   Agent State (AgentContext)                 │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  context: TaskContext (parent)                         │  │
│  │  agentNode: WorkflowAgent                              │  │
│  │  messages: LanguageModelV2Prompt                       │  │
│  │  loopNum: number                                       │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Global State

### 3.1 Location

```typescript
// eko-core/src/config/global.ts
const global: Global = {
  chatMap: new Map(),
  taskMap: new Map(),
  prompts: new Map(),
};
```

### 3.2 Global Type

```typescript
interface Global {
  chatMap: Map<string, ChatContext>;   // Active chat sessions
  taskMap: Map<string, TaskContext>;   // Active task executions
  prompts: Map<string, string>;        // Custom prompt overrides
  chatService?: ChatService;
  browserService?: BrowserService;
}
```

### 3.3 Access Pattern

```typescript
import global from '@eko-ai/eko';

// Get active task
const task = global.taskMap.get(taskId);

// Override system prompts
global.prompts.set('planner_system', 'Custom planning prompt...');
```

---

## 4. Task State (TaskContext)

### 4.1 Creation

```typescript
// Created automatically by Eko.run() or Eko.generate()
const context = await eko.initContext(workflow, contextParams);
```

### 4.2 Properties

| Property | Type | Description |
|----------|------|-------------|
| `taskId` | `string` | Unique task identifier |
| `chatId` | `string` | Parent chat session ID |
| `config` | `EkoConfig` | Framework configuration |
| `workflow` | `Workflow` | Current workflow state |
| `controller` | `AbortController` | Cancellation control |
| `chain` | `Chain` | Conversation history |
| `contextParams` | `Record<string, any>` | User-provided parameters |

### 4.3 Lifecycle

```
Created ──► Running ──► Done
                │
                ├──► Paused ──► Running
                │
                └──► Aborted
```

---

## 5. Agent State (AgentContext)

### 5.1 Creation

```typescript
// Created per-agent during workflow execution
const agentContext = new AgentContext(taskContext, agentNode);
```

### 5.2 Properties

| Property | Type | Description |
|----------|------|-------------|
| `context` | `TaskContext` | Parent task context |
| `agentNode` | `WorkflowAgent` | Current workflow agent |
| `messages` | `LanguageModelV2Prompt` | LLM conversation |
| `loopNum` | `number` | ReAct iteration count |

### 5.3 Message Accumulation

```typescript
// Messages accumulate during agent execution
[
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userPrompt },
  { role: 'assistant', content: [...toolCalls] },
  { role: 'tool', content: [...toolResults] },
  // ... continues until task complete
]
```

---

## 6. Workflow State

### 6.1 Agent Status

```typescript
type AgentStatus = 'init' | 'running' | 'done' | 'error';

// Status transitions
init ──► running ──► done
              │
              └──► error
```

### 6.2 Dependency Tracking

```typescript
interface WorkflowAgent {
  dependsOn: string[];  // Agent IDs this depends on
  status: AgentStatus;
}

// Execution logic
function canRun(agent: WorkflowAgent, agents: WorkflowAgent[]): boolean {
  return agent.dependsOn.every(depId => {
    const dep = agents.find(a => a.id === depId);
    return dep?.status === 'done';
  });
}
```

---

## 7. Chain State (Conversation History)

### 7.1 Structure

```typescript
interface Chain {
  planRequest?: LLMRequest;    // Planning phase request
  planResult?: string;         // Planning phase response
  messages: LanguageModelV2Prompt;  // Full message history
}
```

### 7.2 Compression

When history exceeds thresholds:

```typescript
// config/index.ts defaults
memoryConfig: {
  maxMessageNum: 15,           // Max messages before compression
  maxInputTokens: 64000,       // Max input tokens
  enableCompression: true,
  compressionThreshold: 10,    // Message count trigger
  compressionMaxLength: 6000,  // Compressed summary max length
}
```

---

## 8. Variable Storage

### 8.1 Task Variables

```typescript
// VariableStorageTool allows agents to store/retrieve values
const variableTool = new VariableStorageTool();

// Usage by agent
await variableTool.execute({
  action: 'set',
  key: 'searchResults',
  value: ['result1', 'result2']
});

const value = await variableTool.execute({
  action: 'get',
  key: 'searchResults'
});
```

### 8.2 Context Parameters

```typescript
// User-provided at execution time
const result = await eko.run('Search for {topic}', undefined, {
  topic: 'AI news'
});

// Accessible in TaskContext
context.contextParams.topic; // 'AI news'
```

---

## 9. Episodic Memory State

### 9.1 Memory Initialization

```typescript
// Lazy initialization
private async ensureMemoryReady(): Promise<void> {
  if (!this.memoryInitPromise) {
    this.memoryInitPromise = this.config.episodicMemory?.init();
  }
  await this.memoryInitPromise;
}
```

### 9.2 Episode Recording

```typescript
// After task completion
const episode: Episode = {
  id: uuidv4(),
  timestamp: Date.now(),
  goal: workflow.taskPrompt,
  plan: workflow.thought,
  actions: this.extractActions(context),
  outcome: result.result,
  success: result.success
};

await episodicMemory.recordEpisode(episode);
```

---

## 10. State Persistence

### 10.1 Default Behavior

| State | Persistence | Storage |
|-------|-------------|---------|
| Global | In-memory | None |
| TaskContext | In-memory | None |
| AgentContext | In-memory | None |
| EpisodicMemory | Configurable | Provider-based |

### 10.2 Custom Persistence

```typescript
// For TaskContext persistence
class PersistentTaskStore {
  async save(context: TaskContext): Promise<void> {
    // Serialize workflow + chain
    const data = {
      taskId: context.taskId,
      workflow: context.workflow,
      chain: context.chain
    };
    await redis.set(`task:${context.taskId}`, JSON.stringify(data));
  }
  
  async restore(taskId: string): Promise<TaskContext | null> {
    const data = await redis.get(`task:${taskId}`);
    // Reconstruct TaskContext
  }
}
```

---

## 11. Best Practices

1. **Don't mutate workflow directly** - Use `eko.modify()` for changes
2. **Check status before operations** - Task may be paused/aborted
3. **Use AbortController** - For proper cancellation handling
4. **Limit message history** - Enable compression for long tasks
5. **Clear completed tasks** - Use `eko.deleteTask()` to free memory
