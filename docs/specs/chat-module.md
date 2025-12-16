# Chat Module Documentation
## Eko AI Framework

---

## 1. Overview

The Chat module provides conversational AI capabilities separate from workflow execution. It enables interactive dialogue sessions with tool access, memory persistence, and streaming responses.

**Location**: `eko-core/src/chat/`

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ChatAgent                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   ChatContext   │  │    EkoMemory    │                   │
│  │                 │  │                 │                   │
│  │  • Messages     │  │  • History      │                   │
│  │  • Config       │  │  • Compression  │                   │
│  │  • Stream       │  │                 │                   │
│  └────────┬────────┘  └─────────────────┘                   │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   Chat Tools                            ││
│  │                                                         ││
│  │  • WebSearchTool      - Web search capabilities         ││
│  │  • WebpageQaTool      - Q&A on web page content         ││
│  │  • DeepActionTool     - Trigger workflow execution      ││
│  │  • TaskVariableStorage - Cross-session variables        ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Core Components

### 3.1 ChatAgent

The main class for conversational interactions.

```typescript
import { ChatAgent } from '@eko-ai/eko';

const agent = new ChatAgent(
  config: EkoDialogueConfig,
  chatId?: string,
  memory?: EkoMemory,
  tools?: DialogueTool[]
);

// Simple chat
const response = await agent.chat({
  message: 'What is the capital of France?',
  pageTab?: PageTab
});
```

### 3.2 ChatContext

Manages conversation state for a chat session.

```typescript
interface ChatContext {
  chatId: string;
  config: EkoDialogueConfig;
  messages: EkoMessage[];
  // Managed internally by ChatAgent
}
```

### 3.3 EkoDialogueConfig

Configuration for chat sessions.

```typescript
interface EkoDialogueConfig extends EkoConfig {
  // Inherits LLM configuration from EkoConfig
  // Additional chat-specific settings
}
```

---

## 4. Chat Tools

### 4.1 WebSearchTool

Performs web searches and returns results.

```typescript
import { WebSearchTool } from '@eko-ai/eko';

const searchTool = new WebSearchTool();
// Used internally by ChatAgent for web queries
```

### 4.2 WebpageQaTool

Answers questions about webpage content.

```typescript
import { WebpageQaTool } from '@eko-ai/eko';

const qaTool = new WebpageQaTool();
// Processes current page context for Q&A
```

### 4.3 DeepActionTool

Triggers workflow execution from chat context.

```typescript
import { DeepActionTool } from '@eko-ai/eko';

const actionTool = new DeepActionTool();
// Bridges chat to workflow execution
```

### 4.4 TaskVariableStorageTool

Stores and retrieves variables across chat sessions.

```typescript
import { TaskVariableStorageTool } from '@eko-ai/eko';

const storageTool = new TaskVariableStorageTool();
// Enables persistent context in conversations
```

---

## 5. Message Types

### 5.1 EkoMessage

```typescript
type EkoMessage = { id: string } & (
  | { role: 'user'; content: string | EkoMessageUserPart[]; }
  | { role: 'assistant'; content: EkoMessageAssistantPart[]; }
  | { role: 'tool'; content: EkoMessageToolPart[]; }
) & {
  timestamp: number;
  extra?: Record<string, any>;
};
```

### 5.2 Message Parts

```typescript
// User message parts
type EkoMessageUserPart =
  | { type: 'text'; text: string; }
  | { type: 'file'; fileId: string; mimeType: string; data: string; };

// Tool call/result parts
type ToolCallPart = {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  input: Record<string, any>;
};

type ToolResultPart = {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  isError: boolean;
  output: string | Record<string, any>;
};
```

---

## 6. Streaming API

### 6.1 ChatStreamCallback

```typescript
interface ChatStreamCallback {
  chatCallback: {
    onMessage: (message: ChatStreamMessage) => Promise<void>;
  };
  taskCallback?: AgentStreamCallback & HumanCallback;
}
```

### 6.2 ChatStreamMessage

```typescript
type ChatStreamMessage = {
  streamType: 'chat';
  chatId: string;
  messageId: string;
} & (
  | { type: 'chat_start'; }
  | ReActStreamMessage  // Text/tool streaming
  | { type: 'chat_end'; error: string | null; duration: number; reactLoopNum: number; }
);
```

---

## 7. Usage Example

```typescript
import { ChatAgent, EkoMemory } from '@eko-ai/eko';

// Create chat agent with memory
const memory = new EkoMemory();
const chatAgent = new ChatAgent(
  {
    llms: {
      default: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
        apiKey: process.env.ANTHROPIC_API_KEY!
      }
    }
  },
  'chat-session-1',
  memory
);

// Chat with streaming
const response = await chatAgent.chat({
  message: 'Search for the latest AI news and summarize it',
  callback: {
    chatCallback: {
      onMessage: async (msg) => {
        if (msg.type === 'text') {
          process.stdout.write(msg.text);
        }
      }
    }
  }
});

console.log('Final response:', response);
```

---

## 8. Integration with Workflows

The DeepActionTool enables seamless transition from chat to workflow execution:

```
User Message
     │
     ▼
┌─────────────┐     ┌─────────────┐
│  ChatAgent  │────▶│DeepActionTool│
└─────────────┘     └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Eko.run()  │
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Workflow   │
                    │  Execution  │
                    └─────────────┘
```

---

## 9. Memory Management

### 9.1 EkoMemory

Handles conversation history with automatic compression.

```typescript
import { EkoMemory } from '@eko-ai/eko';

const memory = new EkoMemory({
  maxMessages: 50,
  compressionEnabled: true
});
```

### 9.2 Session Persistence

Chat sessions are stored in the global chatMap:

```typescript
import global from '@eko-ai/eko';

// Access active chat
const context = global.chatMap.get(chatId);

// Clean up when done
global.chatMap.delete(chatId);
```

---

## 10. Comparison: Chat vs Workflow

| Aspect | ChatAgent | Eko (Workflow) |
|--------|-----------|----------------|
| **Purpose** | Conversational dialogue | Task automation |
| **Execution** | Interactive, turn-based | Autonomous, multi-step |
| **Tools** | Chat-specific (search, Q&A) | Full agent toolset |
| **State** | Message history | Workflow + agent context |
| **Use Case** | Q&A, research, assistance | Browser automation, file ops |

