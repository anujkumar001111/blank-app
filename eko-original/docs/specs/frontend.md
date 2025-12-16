# Frontend Documentation
## Eko AI Framework

---

## 1. Overview

Eko's frontend architecture is designed for **cross-platform compatibility**, supporting:
- **Web Applications** (React, vanilla JS)
- **Browser Extensions** (Chrome MV3)
- **Electron Applications** (Desktop)

The `eko-web` and `eko-extension` packages provide browser-specific implementations while sharing core logic from `eko-core`.

---

## 2. Package Structure

```
packages/
├── eko-core/          # Platform-agnostic core (shared)
│   └── src/
│       ├── chat/      # Chat conversation UI support
│       ├── types/     # TypeScript definitions
│       └── service/   # Service interfaces
│
├── eko-web/           # Browser DOM tools
│   └── src/
│       ├── browser.ts # WebBrowserAgent implementation
│       └── index.ts   # Public exports
│
└── eko-extension/     # Chrome extension
    └── src/
        └── browser.ts # ExtensionBrowserAgent
```

---

## 3. UI Framework & Libraries

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Language** | TypeScript 5.8+ | Type-safe development |
| **Bundler** | Rollup | ESM/CJS dual output |
| **Validation** | Zod | Runtime schema validation |
| **XML Parsing** | @xmldom/xmldom | Workflow serialization |

### Build Outputs

```javascript
// package.json exports
{
  ".": {
    "require": "./dist/index.cjs.js",  // CommonJS
    "import": "./dist/index.esm.js",   // ES Modules
    "types": "./dist/index.d.ts"       // TypeScript
  }
}
```

---

## 4. State Management

### Local State
Component-specific state is managed via:
- `AgentContext` - Per-agent execution state
- `TaskContext` - Per-task workflow state
- `ChatContext` - Chat conversation state

### Global State

```typescript
// eko-core/src/config/global.ts
type Global = {
  chatMap: Map<string, ChatContext>;    // Active chats
  taskMap: Map<string, TaskContext>;    // Active tasks
  prompts: Map<string, string>;         // Custom prompts
  chatService?: ChatService;
  browserService?: BrowserService;
};
```

### State Flow

```
User Request
    │
    ▼
┌─────────────────┐
│   EkoConfig     │ ◄── LLMs, Agents, Callbacks
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  TaskContext    │ ◄── taskId, workflow, controller
│                 │
│  ├─ chain       │ ◄── Conversation history
│  ├─ workflow    │ ◄── Current workflow state
│  └─ controller  │ ◄── AbortController
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AgentContext   │ ◄── Per-agent execution
│                 │
│  ├─ context     │ ◄── Parent TaskContext
│  ├─ agentNode   │ ◄── Current workflow agent
│  └─ messages    │ ◄── LLM conversation
└─────────────────┘
```

---

## 5. Navigation Structure

### Web Application Flow

```
┌─────────────────────────────────────────┐
│              Application                │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐   ┌─────────────────┐  │
│  │  Chat Input │──▶│ Workflow View   │  │
│  │             │   │                 │  │
│  │  • NL prompt│   │ • Agent list    │  │
│  │  • History  │   │ • Status        │  │
│  └─────────────┘   │ • Results       │  │
│                    └─────────────────┘  │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │         Agent Execution             ││
│  │                                     ││
│  │  • Tool calls     • Stream output  ││
│  │  • Human prompts  • Error display  ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

### Extension Popup Flow

```
Extension Icon Click
        │
        ▼
┌───────────────────┐
│   Popup Window    │
│                   │
│  ┌─────────────┐  │
│  │ Task Input  │  │
│  └──────┬──────┘  │
│         │         │
│         ▼         │
│  ┌─────────────┐  │
│  │ Execute on  │  │
│  │ Active Tab  │  │
│  └─────────────┘  │
└───────────────────┘
```

---

## 6. Key Components

### Browser Agent (Web)

```typescript
// eko-web/src/browser.ts
class WebBrowserAgent extends BaseBrowserLabelsAgent {
  // DOM interaction methods
  click_element(index: number): Promise<void>;
  input_text(index: number, text: string): Promise<void>;
  navigate_to(url: string): Promise<PageInfo>;
  screenshot(): Promise<ImageData>;
  
  // Label-based element selection
  get_element(index: number): Promise<Element>;
}
```

### Stream Callback Interface

```typescript
interface AgentStreamCallback {
  onMessage: (message: AgentStreamMessage) => Promise<void>;
}

type AgentStreamMessage = {
  streamType: "agent";
  taskId: string;
  agentName: string;
} & (
  | { type: "workflow"; workflow: Workflow; }
  | { type: "agent_start"; agentNode: WorkflowAgent; }
  | { type: "tool_use"; toolName: string; params: object; }
  | { type: "tool_result"; toolResult: ToolResult; }
  | { type: "agent_result"; result: string; }
);
```

---

## 7. Styling Approach

### CSS Strategy
- **No framework dependency** - Core packages are style-agnostic
- **Consumer responsibility** - UI styling handled by consuming applications
- **Example styling** - Provided in `example/` projects

### Example Integration

```jsx
// React integration example
import { Eko, BrowserAgent } from '@eko-ai/eko';

function EkoChat() {
  const [messages, setMessages] = useState([]);
  
  const handleStream = {
    onMessage: async (msg) => {
      setMessages(prev => [...prev, msg]);
    }
  };
  
  const eko = new Eko({
    llms: { default: {...} },
    agents: [new BrowserAgent()],
    callback: handleStream
  });
  
  return (
    <div className="eko-chat">
      {messages.map(msg => <MessageComponent key={msg.taskId} {...msg} />)}
    </div>
  );
}
```

---

## 8. Forms & Validation

### Human Interaction Forms

```typescript
interface HumanCallback {
  // Confirmation dialog
  onHumanConfirm?: (context, prompt) => Promise<boolean>;
  
  // Text input
  onHumanInput?: (context, prompt) => Promise<string>;
  
  // Selection (single/multi)
  onHumanSelect?: (context, prompt, options, multiple?) => Promise<string[]>;
  
  // Help request (login, assistance)
  onHumanHelp?: (context, helpType, prompt) => Promise<boolean>;
}
```

### Input Validation
- **Zod schemas** for tool input validation
- **Type-safe** parameters in tool definitions
- **Runtime validation** before tool execution

---

## 9. Error Handling

### Error Display Strategy

```typescript
type AgentStreamMessage = 
  | { type: "error"; error: unknown; }
  | { type: "agent_result"; error?: any; result?: string; };
```

### Error Categories

| Error Type | Source | Handling |
|------------|--------|----------|
| LLM Errors | Provider API | Retry with failover |
| Tool Errors | Tool execution | Display in stream |
| Abort Errors | User cancellation | Clean termination |
| Validation Errors | Input schemas | Immediate rejection |

---

## 10. Browser Compatibility

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 90+ | ✅ Full |
| Firefox | 90+ | ✅ Full |
| Safari | 14+ | ✅ Full |
| Edge | 90+ | ✅ Full |

### Required Features
- ES2020 (async/await, optional chaining)
- Web APIs (fetch, AbortController, ReadableStream)
- Extension APIs (Chrome MV3 for extensions)
