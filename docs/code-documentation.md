# Code Documentation Standards
## Eko AI Framework

---

## 1. Overview

This document defines documentation standards for the Eko codebase.

---

## 2. Code Comments

### 2.1 JSDoc Standards

```typescript
/**
 * Execute a workflow from natural language prompt.
 * 
 * @param taskPrompt - The natural language task description
 * @param taskId - Optional unique task identifier (auto-generated if omitted)
 * @param contextParams - Optional parameters accessible during execution
 * @returns Promise resolving to execution result
 * 
 * @example
 * ```typescript
 * const result = await eko.run('Search for AI news');
 * console.log(result.success); // true
 * ```
 */
async run(
  taskPrompt: string,
  taskId?: string,
  contextParams?: Record<string, any>
): Promise<EkoResult>
```

### 2.2 Inline Comments

```typescript
// Security: Block dangerous patterns before execution
if (this.isDangerous(command)) {
  return { isError: true, content: [...] };
}

// NOTE: Retry logic handles AbortError separately
if (error?.name === 'AbortError') {
  throw error;  // Don't retry user cancellation
}
```

---

## 3. Type Documentation

### 3.1 Interface Documentation

```typescript
/**
 * Configuration for creating an Eko instance.
 */
interface EkoConfig {
  /** LLM provider configurations (required) */
  llms: LLMs;
  
  /** Custom agents to register */
  agents?: Agent[];
  
  /** Stream event handler for real-time updates */
  callback?: AgentStreamCallback;
}
```

### 3.2 Type Aliases

```typescript
/**
 * LLM provider identifier.
 * - `openai` - OpenAI API
 * - `anthropic` - Anthropic Claude
 * - `google` - Google Generative AI
 * - `aws` - Amazon Bedrock
 * - `openrouter` - OpenRouter aggregator
 * - `openai-compatible` - Any OpenAI-compatible API
 * - `modelscope` - Alibaba ModelScope
 * - Custom ProviderV2 implementation
 */
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

---

## 4. API Documentation

### 4.1 TypeDoc Configuration

```json
// typedoc.json
{
  "entryPoints": ["src/index.ts"],
  "out": "docs/api",
  "excludePrivate": true,
  "excludeProtected": true,
  "exclude": ["**/test/**"]
}
```

### 4.2 Generate Documentation

```bash
cd packages/eko-core
pnpm docs  # Generates to docs/api/
```

---

## 5. README Standards

### 5.1 Package README

Each package should include:

```markdown
# @eko-ai/eko

Brief description of the package.

## Installation

\`\`\`bash
pnpm add @eko-ai/eko
\`\`\`

## Quick Start

\`\`\`typescript
import { Eko } from '@eko-ai/eko';

const eko = new Eko({...});
const result = await eko.run('task');
\`\`\`

## API Reference

Link to generated TypeDoc.

## License

MIT
```

---

## 6. Architecture Documentation

### 6.1 ADR Format

Architecture Decision Records in `docs/adr/`:

```markdown
# ADR-0001: Security Architecture for System Tools

## Status
Accepted

## Context
[Why was this decision needed?]

## Decision
[What was decided?]

## Consequences
[What are the implications?]
```

---

## 7. File Organization

```
docs/
├── specs/           # Specification documents
│   ├── prd.md
│   ├── api.md
│   └── ...
├── adr/             # Architecture decisions
│   └── 0001-security-architecture.md
├── api/             # Generated TypeDoc
│   └── index.html
└── guides/          # User guides
    └── getting-started.md
```

---

## 8. Documentation Checklist

- [ ] All public functions have JSDoc
- [ ] All interfaces have property descriptions
- [ ] Complex logic has inline comments
- [ ] README includes installation and quick start
- [ ] API documentation generated and up-to-date
- [ ] Architecture decisions recorded
