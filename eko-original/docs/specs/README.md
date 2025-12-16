# Eko AI Framework - Specifications

Comprehensive documentation for building and understanding the Eko AI Framework.

**To use in a new project:**
```bash
npm install @eko-ai/eko-nodejs
```

**Quick start:**
```typescript
// Unified import from the Node.js SDK
import { Eko, BrowserAgent, SystemAgent } from '@eko-ai/eko-nodejs';

const eko = new Eko({
  llms: { default: { provider: 'anthropic', model: 'claude-3-5-sonnet', apiKey: '...' } },
  agents: [new BrowserAgent(), new SystemAgent()]
});

// Generate workflow from natural language, then execute
const workflow = await eko.generate('Search for AI news and save to file', 'task-001');
const results = await eko.execute(workflow);
```

## Documents

| Document | Description |
|----------|-------------|
| [prd.md](prd.md) | Product Requirements Document |
| [frontend.md](frontend.md) | Frontend architecture and components |
| [backend.md](backend.md) | Backend architecture and Node.js tools |
| [api.md](api.md) | Complete API reference |
| [chat-module.md](chat-module.md) | Chat conversation module |
| [database-schema.md](database-schema.md) | Data models and storage |
| [user-flow.md](user-flow.md) | User flows with mermaid diagrams |
| [state-management.md](state-management.md) | State hierarchy and patterns |
| [devops.md](devops.md) | Build, test, and deployment |
| [testing-plan.md](testing-plan.md) | Testing strategies and coverage |
| [security.md](security.md) | Security controls and best practices |
| [performance-optimization.md](performance-optimization.md) | Performance tuning |
| [code-documentation.md](code-documentation.md) | Documentation standards |
| [third-party-libraries.md](third-party-libraries.md) | Dependency catalog |

## Quick Links

- **Getting Started**: See [api.md](api.md) for basic usage
- **Architecture**: See [backend.md](backend.md) for component overview
- **Contributing**: See [devops.md](devops.md) for build setup

## Framework Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         eko-core                            │
│  LLM Abstraction │ Agent Orchestration │ Memory │ MCP      │
└─────────────────────────────────────────────────────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  eko-nodejs │     │   eko-web   │     │eko-extension│
│  Playwright │     │     DOM     │     │  Chrome MV3 │
│  File/Shell │     │   Browser   │     │    APIs     │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Version

- Framework: 4.0.5
- Documentation: 2025-12-16
