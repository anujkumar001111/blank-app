# Third-Party Libraries Documentation
## Eko AI Framework

---

## 1. Overview

This document lists all third-party libraries used in the Eko AI Framework, organized by package and purpose.

---

## 2. Core Dependencies (eko-core)

### 2.1 LLM SDKs

| Library | Version | Purpose | License |
|---------|---------|---------|---------|
| `@ai-sdk/provider` | ^2.0.0 | Base provider interfaces | MIT |
| `@ai-sdk/openai` | ^2.0.52 | OpenAI API client | MIT |
| `@ai-sdk/anthropic` | ^2.0.33 | Anthropic Claude client | MIT |
| `@ai-sdk/google` | ^2.0.23 | Google AI client | MIT |
| `@ai-sdk/amazon-bedrock` | ^3.0.43 | AWS Bedrock client | MIT |
| `@ai-sdk/openai-compatible` | ^1.0.22 | OpenAI-compatible APIs | MIT |
| `@openrouter/ai-sdk-provider` | ^1.2.0 | OpenRouter client | MIT |

### 2.2 Utilities

| Library | Version | Purpose | License |
|---------|---------|---------|---------|
| `zod` | ^4.1.12 | Schema validation for tools | MIT |
| `@xmldom/xmldom` | ^0.8.11 | XML parsing for workflows | MIT |
| `secure-json-parse` | ^4.0.0 | Safe JSON parsing | MIT |

---

## 3. Node.js Dependencies (eko-nodejs)

### 3.1 Browser Automation

| Library | Version | Purpose | License |
|---------|---------|---------|---------|
| `playwright` | ^1.57.0 | Browser automation engine | Apache-2.0 |
| `playwright-extra` | ^4.3.6 | Playwright plugin system | MIT |
| `puppeteer-extra-plugin-stealth` | ^2.11.2 | Bot detection avoidance | MIT |
| `chromium-bidi` | ^0.12.0 | BiDi protocol support | Apache-2.0 |

### 3.2 Utilities

| Library | Version | Purpose | License |
|---------|---------|---------|---------|
| `glob` | ^11.0.0 | File pattern matching | ISC |
| `merge-deep` | ^3.0.3 | Deep object merging | MIT |
| `canvas` | ^3.2.0 | Image manipulation | MIT |

---

## 4. Development Dependencies

### 4.1 Build Tools

| Library | Version | Purpose | License |
|---------|---------|---------|---------|
| `typescript` | ^5.8.3 | TypeScript compiler | Apache-2.0 |
| `rollup` | ^4.40.0 | Module bundler | MIT |
| `@rollup/plugin-typescript` | ^12.1.2 | TypeScript for Rollup | MIT |
| `@rollup/plugin-commonjs` | ^28.0.3 | CommonJS plugin | MIT |
| `@rollup/plugin-node-resolve` | ^16.0.1 | Node module resolution | MIT |
| `@rollup/plugin-json` | ^6.1.0 | JSON import support | MIT |
| `rollup-plugin-copy` | ^3.5.0 | Copy files during build | MIT |
| `tslib` | ^2.8.1 | TypeScript helpers | 0BSD |

### 4.2 Testing

| Library | Version | Purpose | License |
|---------|---------|---------|---------|
| `jest` | ^29.7.0 | Test runner | MIT |
| `ts-jest` | ^29.3.2 | TypeScript Jest support | MIT |
| `@types/jest` | ^29.5.14 | Jest type definitions | MIT |

### 4.3 Documentation

| Library | Version | Purpose | License |
|---------|---------|---------|---------|
| `typedoc` | ^0.27.6 | API documentation generator | Apache-2.0 |

### 4.4 Environment

| Library | Version | Purpose | License |
|---------|---------|---------|---------|
| `dotenv` | ^16.5.0 | Environment variable loading | BSD-2-Clause |
| `undici` | ^6.21.0 | HTTP/1.1 client | MIT |

---

## 5. Type Definitions

| Library | Version | Purpose |
|---------|---------|---------|
| `@types/node` | ^22.15.19 | Node.js types |
| `@types/json-schema` | ^7.0.15 | JSON Schema types |

---

## 6. Integration Libraries

### 6.1 MCP (Model Context Protocol)

Eko implements MCP clients internally using:
- Native `fetch` for HTTP transport
- `EventSource` for SSE transport
- `child_process` for stdio transport

No external MCP libraries are required.

### 6.2 Recommended External Integrations

| Use Case | Recommended Library | Notes |
|----------|---------------------|-------|
| Payment | Stripe SDK | For payment processing |
| Email | Resend/SendGrid | For notifications |
| Storage | AWS S3 SDK | For file storage |
| Queue | Bull/BullMQ | For background jobs |
| Cache | ioredis | For distributed caching |
| Search | Algolia/Meilisearch | For semantic search |
| Vectors | Pinecone/Qdrant | For embedding storage |

---

## 7. Security Considerations

### 7.1 Vulnerability Scanning

```bash
# Check for vulnerabilities
pnpm audit

# Update vulnerable packages
pnpm audit --fix
```

### 7.2 License Compliance

All dependencies use permissive licenses:
- **MIT** - Most common, no restrictions
- **Apache-2.0** - Patent protection
- **ISC** - Simplified MIT
- **BSD-2-Clause** - Similar to MIT

No GPL or AGPL dependencies that would require source disclosure.

---

## 8. Dependency Graph

```
@eko-ai/eko (eko-core)
├── @ai-sdk/provider
├── @ai-sdk/openai
├── @ai-sdk/anthropic
├── @ai-sdk/google
├── @ai-sdk/amazon-bedrock
├── @ai-sdk/openai-compatible
├── @openrouter/ai-sdk-provider
├── zod
├── @xmldom/xmldom
└── secure-json-parse

@eko-ai/eko-nodejs
├── @eko-ai/eko (workspace)
├── playwright
├── playwright-extra
├── puppeteer-extra-plugin-stealth
├── chromium-bidi
├── glob
├── merge-deep
└── canvas

@eko-ai/eko-web
└── @eko-ai/eko (workspace)

@eko-ai/eko-extension
└── @eko-ai/eko (workspace)

@eko-ai/eko-electron
└── @eko-ai/eko (workspace)
```

---

## 9. Update Policy

### 9.1 Dependency Updates

| Type | Frequency | Process |
|------|-----------|---------|
| Security | Immediate | Patch and release |
| Major | Quarterly | Test, update, release |
| Minor/Patch | Monthly | Batch update |

### 9.2 Update Commands

```bash
# Check for updates
pnpm outdated

# Update all dependencies
pnpm update

# Update specific package
pnpm update @ai-sdk/openai
```

---

## 10. Adding New Dependencies

### 10.1 Checklist

- [ ] License compatible (MIT/Apache/BSD preferred)
- [ ] No known vulnerabilities
- [ ] Active maintenance (commits within 6 months)
- [ ] TypeScript support or types available
- [ ] Bundle size acceptable
- [ ] No duplicate functionality

### 10.2 Commands

```bash
# Add to specific package
cd packages/eko-core
pnpm add new-library

# Add as dev dependency
pnpm add -D new-dev-library

# Add with specific version
pnpm add library@^2.0.0
```
