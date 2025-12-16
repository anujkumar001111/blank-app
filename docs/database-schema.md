# Database Schema Documentation
## Eko AI Framework

---

## 1. Overview

Eko uses an **in-memory + pluggable storage** architecture. The framework doesn't require a traditional database but provides interfaces for persistence.

---

## 2. Core Data Models

### 2.1 Workflow

The primary data structure for task execution.

```typescript
interface Workflow {
  taskId: string;        // Unique identifier
  name: string;          // Human-readable name
  thought: string;       // LLM reasoning text
  agents: WorkflowAgent[];
  xml: string;           // Serialized XML representation
  modified?: boolean;    // Has been modified
  taskPrompt?: string;   // Original user prompt
}
```

### 2.2 WorkflowAgent

Individual agent within a workflow.

```typescript
interface WorkflowAgent {
  id: string;                    // Unique within workflow
  name: string;                  // Agent class name
  task: string;                  // Agent-specific task
  dependsOn: string[];          // Dependencies (agent IDs)
  nodes: WorkflowNode[];        // Execution nodes
  parallel?: boolean;           // Can run in parallel
  status: 'init' | 'running' | 'done' | 'error';
  xml: string;                  // Agent XML representation
}
```

### 2.3 WorkflowNode Types

```typescript
// Simple text node
interface WorkflowTextNode {
  type: 'normal';
  text: string;
  input?: string | null;   // Input variable reference
  output?: string | null;  // Output variable name
}

// Iteration node
interface WorkflowForEachNode {
  type: 'forEach';
  items: string;           // Variable name or list
  nodes: WorkflowNode[];
}

// Event trigger node
interface WorkflowWatchNode {
  type: 'watch';
  event: 'dom' | 'gui' | 'file';
  loop: boolean;
  description: string;
  triggerNodes: (WorkflowTextNode | WorkflowForEachNode)[];
}

type WorkflowNode = WorkflowTextNode | WorkflowForEachNode | WorkflowWatchNode;
```

---

## 3. Episodic Memory Schema

### 3.1 Episode

Stores task execution history for learning.

```typescript
interface Episode {
  id: string;              // Unique identifier
  timestamp: number;       // Execution time (Unix ms)
  goal: string;            // Original task goal
  plan?: string;           // Generated plan
  actions: string[];       // Tools called
  outcome: string;         // Execution result
  success: boolean;        // Success/failure flag
  errorType?: string;      // Error classification
  lesson?: string;         // Learned lesson
  embedding?: number[];    // Semantic embedding vector
  metadata?: Record<string, unknown>;
}
```

### 3.2 Storage Schema (JSON)

```json
{
  "episodes": [
    {
      "id": "ep_abc123",
      "timestamp": 1702656000000,
      "goal": "Search for AI news",
      "plan": "1. Navigate to Google\n2. Search...",
      "actions": ["navigate_to", "input_text", "click_element"],
      "outcome": "Successfully found 10 articles",
      "success": true,
      "lesson": "Google News provides faster results",
      "embedding": [0.1, 0.2, ...]
    }
  ]
}
```

---

## 4. Context Schemas

### 4.1 TaskContext

Runtime state for active tasks.

```typescript
interface TaskContext {
  taskId: string;
  chatId: string;
  config: EkoConfig;
  workflow: Workflow;
  controller: AbortController;
  chain: Chain;
  status: 'running' | 'paused' | 'aborted' | 'done';
  contextParams: Record<string, any>;
}
```

### 4.2 AgentContext

Per-agent execution context.

```typescript
interface AgentContext {
  context: TaskContext;      // Parent context
  agentNode: WorkflowAgent;  // Current agent
  messages: LLMMessage[];    // Conversation history
  loopNum: number;           // ReAct iteration count
}
```

### 4.3 Chain

Conversation history chain.

```typescript
interface Chain {
  planRequest?: LLMRequest;  // Planning request
  planResult?: string;       // Planning response
  messages: LLMMessage[];    // Full conversation
}
```

---

## 5. Configuration Schema

### 5.1 Global Config

```typescript
interface Config {
  name: string;                    // "Eko"
  mode: 'fast' | 'normal' | 'expert';
  platform: 'windows' | 'mac' | 'linux';
  maxReactNum: number;            // 500
  maxOutputTokens: number;        // 16000
  maxRetryNum: number;            // 3
  agentParallel: boolean;         // false
  compressThreshold: number;      // 80
  compressTokensThreshold: number; // 80000
  largeTextLength: number;        // 8000
  fileTextMaxLength: number;      // 20000
  maxDialogueImgFileNum: number;  // 1
  toolResultMultimodal: boolean;  // true
  parallelToolCalls: boolean;     // true
  markImageMode: 'dom' | 'draw';  // 'draw'
  expertModeTodoLoopNum: number;  // 10
  memoryConfig: MemoryConfig;
}

interface MemoryConfig {
  maxMessageNum: number;          // 15
  maxInputTokens: number;         // 64000
  enableCompression: boolean;     // true
  compressionThreshold: number;   // 10
  compressionMaxLength: number;   // 6000
}
```

---

## 6. Storage Interfaces

### 6.1 EpisodicStorageProvider

```typescript
interface EpisodicStorageProvider {
  read(): Promise<Episode[]>;
  write(episodes: Episode[]): Promise<void>;
  exists(): Promise<boolean>;
}
```

### 6.2 Implementations

| Provider | Location | Storage |
|----------|----------|---------|
| `InMemoryStorageProvider` | eko-core | RAM (no persistence) |
| `FileStorageProvider` | eko-nodejs | JSON file |

---

## 7. Entity Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                         EkoConfig                           │
│  ┌─────────┐  ┌──────────┐  ┌──────────────────────────┐   │
│  │  LLMs   │  │  Agents  │  │    EpisodicMemory        │   │
│  └────┬────┘  └────┬─────┘  │  ┌────────────────────┐  │   │
│       │            │        │  │     Episodes       │  │   │
│       │            │        │  └────────────────────┘  │   │
│       │            │        └──────────────────────────┘   │
└───────┼────────────┼───────────────────────────────────────┘
        │            │
        ▼            ▼
┌─────────────────────────────────────────────────────────────┐
│                       TaskContext                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                     Workflow                          │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │              WorkflowAgent[]                   │  │  │
│  │  │  ┌──────────────────────────────────────────┐  │  │  │
│  │  │  │           WorkflowNode[]                 │  │  │  │
│  │  │  │  • normal (text)                         │  │  │  │
│  │  │  │  • forEach (iteration)                   │  │  │  │
│  │  │  │  • watch (event trigger)                 │  │  │  │
│  │  │  └──────────────────────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                      Chain                            │  │
│  │  • planRequest: LLMRequest                            │  │
│  │  • planResult: string                                 │  │
│  │  • messages: LLMMessage[]                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Indexing Recommendations

For custom storage implementations:

| Field | Entity | Index Type | Purpose |
|-------|--------|------------|---------|
| `id` | Episode | Primary | Unique lookup |
| `timestamp` | Episode | B-tree | Time-based queries |
| `goal` | Episode | Full-text | Keyword search |
| `success` | Episode | Hash | Failure filtering |
| `embedding` | Episode | Vector (ANN) | Semantic search |
| `taskId` | Workflow | Primary | Task lookup |

---

## 9. Migration Notes

No migrations needed - Eko uses:
- In-memory storage by default
- File-based JSON for FileStorageProvider
- Backward-compatible Episode schema
