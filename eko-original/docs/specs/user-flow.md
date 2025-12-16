# User Flow Documentation
## Eko AI Framework

---

## 1. Overview

This document describes the user flows for developers integrating and using the Eko AI Framework.

---

## 2. Primary User Flow

### 2.1 SDK Integration Flow

```mermaid
graph TD
    A[Install Package] --> B[Configure LLMs]
    B --> C[Create Eko Instance]
    C --> D{Choose Mode}
    D -->|Simple| E[eko.run]
    D -->|Advanced| F[eko.generate]
    E --> G[Receive EkoResult]
    F --> H[Review Workflow]
    H --> I{Approve?}
    I -->|Yes| J[eko.execute]
    I -->|No| K[eko.modify]
    K --> H
    J --> G
    G --> L{Success?}
    L -->|Yes| M[Use Result]
    L -->|No| N[Handle Error]
```

### 2.2 Step-by-Step

| Step | Action | Code |
|------|--------|------|
| 1 | Install | `pnpm add @eko-ai/eko @eko-ai/eko-nodejs` |
| 2 | Import | `import { Eko } from '@eko-ai/eko'` |
| 3 | Configure | Set up LLMs object with API keys |
| 4 | Create | `new Eko({ llms, agents })` |
| 5 | Execute | `await eko.run('task prompt')` |
| 6 | Process | Handle result or error |

---

## 3. Workflow Generation Flow

```mermaid
sequenceDiagram
    participant User
    participant Eko
    participant Planner
    participant LLM

    User->>Eko: run("Search for news")
    Eko->>Planner: plan(taskPrompt)
    Planner->>LLM: Stream request
    LLM-->>Planner: XML workflow chunks
    Planner-->>Eko: Parsed Workflow
    Eko->>Eko: Build AgentNode tree
    Eko->>Eko: Execute agents
    Eko-->>User: EkoResult
```

---

## 4. Agent Execution Flow

```mermaid
graph LR
    subgraph Workflow Execution
        A[Start] --> B{Next Agent?}
        B -->|Yes| C[Check Dependencies]
        C --> D{Dependencies Done?}
        D -->|No| E[Wait]
        E --> D
        D -->|Yes| F[Run Agent]
        F --> G{Parallel Agents?}
        G -->|Yes| H[Run in Parallel]
        G -->|No| I[Run Sequential]
        H --> B
        I --> B
        B -->|No| J[Complete]
    end
```

---

## 5. Tool Execution Flow (ReAct Loop)

```mermaid
graph TD
    A[Agent Start] --> B[Build Prompts]
    B --> C[Call LLM]
    C --> D{Response Type}
    D -->|Text| E[Extract Text]
    D -->|Tool Call| F[Execute Tool]
    F --> G[Get Tool Result]
    G --> H{More Iterations?}
    H -->|Yes| C
    H -->|No| I[Return Result]
    E --> I
    
    subgraph Safety Checks
        F --> J{Dangerous?}
        J -->|Yes| K[Block & Return Error]
        J -->|No| L[Execute Safely]
    end
```

---

## 6. Human-in-the-Loop Flow

```mermaid
sequenceDiagram
    participant Agent
    participant Tool
    participant Callback
    participant User

    Agent->>Tool: HumanInteractTool.execute
    Tool->>Callback: onHumanConfirm(prompt)
    Callback->>User: Show confirmation dialog
    User-->>Callback: Accept/Reject
    Callback-->>Tool: boolean result
    Tool-->>Agent: ToolResult
```

### Interaction Types

| Type | Callback | User Action |
|------|----------|-------------|
| Confirm | `onHumanConfirm` | Yes/No button |
| Input | `onHumanInput` | Text field |
| Select | `onHumanSelect` | Dropdown/Checkboxes |
| Help | `onHumanHelp` | Login/Assistance request |

---

## 7. Task Control Flow

```mermaid
stateDiagram-v2
    [*] --> Running: run()
    Running --> Paused: pauseTask(true)
    Paused --> Running: pauseTask(false)
    Running --> Aborted: abortTask()
    Paused --> Aborted: abortTask()
    Running --> Done: Complete
    Running --> Error: Exception
    Done --> [*]
    Aborted --> [*]
    Error --> [*]
```

### Control API

```typescript
// Pause execution
eko.pauseTask(taskId, true, false, 'User requested pause');

// Resume execution
eko.pauseTask(taskId, false);

// Abort execution
eko.abortTask(taskId, 'User cancelled');
```

---

## 8. Error Handling Flow

```mermaid
graph TD
    A[Error Occurs] --> B{Error Type}
    B -->|AbortError| C[Clean Shutdown]
    B -->|LLM Error| D{Retry Available?}
    B -->|Tool Error| E[Return in ToolResult]
    B -->|Security Error| F[Immediate Rejection]
    D -->|Yes| G[Try Next Provider]
    D -->|No| H[Throw Error]
    G --> I{Success?}
    I -->|Yes| J[Continue]
    I -->|No| D
    
    C --> K[Return EkoResult]
    E --> L[Continue Agent Loop]
    F --> K
    H --> K
```

---

## 9. Streaming Output Flow

```mermaid
sequenceDiagram
    participant App
    participant Eko
    participant Agent
    participant LLM

    App->>Eko: run() with callback
    Eko->>Agent: Execute
    Agent->>LLM: Stream request
    
    loop Streaming
        LLM-->>Agent: StreamPart
        Agent-->>Eko: AgentStreamMessage
        Eko-->>App: callback.onMessage()
    end
    
    Agent-->>Eko: Agent result
    Eko-->>App: EkoResult
```

### Message Types Timeline

```
workflow      → agent_start → tool_use → tool_result → ... → agent_result
    │              │             │            │                    │
    └──────────────┴─────────────┴────────────┴────────────────────┘
                        Streaming Messages
```

---

## 10. Browser Automation Flow

```mermaid
graph TD
    A[BrowserAgent Start] --> B{Browser Running?}
    B -->|No| C[Launch Browser]
    B -->|Yes| D[Reuse Context]
    C --> E[Apply Stealth Plugin]
    E --> F[Load Cookies]
    D --> F
    F --> G[Navigate to URL]
    G --> H[Inject Labels]
    H --> I[Screenshot for LLM]
    I --> J[LLM Decides Action]
    J --> K{Action Type}
    K -->|Click| L[click_element]
    K -->|Type| M[input_text]
    K -->|Navigate| N[navigate_to]
    L --> I
    M --> I
    N --> I
```

---

## 11. Episodic Memory Flow

```mermaid
graph TD
    A[Task Complete] --> B{Memory Configured?}
    B -->|No| C[Skip Recording]
    B -->|Yes| D[Extract Episode]
    D --> E[Generate Embedding]
    E --> F[Store Episode]
    
    G[New Task Starts] --> H{Memory Configured?}
    H -->|No| I[No Context Injection]
    H -->|Yes| J[Recall Relevant Episodes]
    J --> K[Build Context Injection]
    K --> L[Add to System Prompt]
```

### Episode Data Flow

```
Task Execution
     │
     ├──► goal: Original prompt
     ├──► plan: Generated workflow
     ├──► actions: Tools called
     ├──► outcome: Final result
     ├──► success: Boolean
     └──► lesson: Generated insight
            │
            ▼
     Storage Provider
            │
            ▼
     Future Task Recall
```

---

## 12. Edge Cases

| Scenario | Handling |
|----------|----------|
| Network failure | Retry with exponential backoff |
| LLM rate limit | Switch to fallback provider |
| Browser crash | Attempt recovery via `recoverBrowserContext()` |
| Timeout | Return partial result with `killed: true` |
| Invalid input | Zod validation error before execution |
| Circular dependencies | Detected during workflow parsing |
