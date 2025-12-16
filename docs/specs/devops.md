# DevOps Documentation
## Eko AI Framework

---

## 1. Overview

Eko is a pnpm monorepo with 5 packages. This document covers build, test, and deployment procedures.

---

## 2. Project Structure

```
eko-original/
├── packages/
│   ├── eko-core/       # @eko-ai/eko
│   ├── eko-nodejs/     # @eko-ai/eko-nodejs
│   ├── eko-web/        # @eko-ai/eko-web
│   ├── eko-extension/  # @eko-ai/eko-extension
│   └── eko-electron/   # @eko-ai/eko-electron
├── example/
│   ├── extension/
│   ├── nodejs/
│   └── web/
├── pnpm-workspace.yaml
└── package.json
```

---

## 3. Build System

### 3.1 Requirements

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Runtime |
| pnpm | 8+ | Package management |
| TypeScript | 5.8+ | Compilation |
| Rollup | 4.40+ | Bundling |

### 3.2 Build Commands

```bash
# Install all dependencies
cd eko-original && pnpm install

# Build all packages (sequential)
pnpm build

# Build specific package
cd packages/eko-core && pnpm build

# Watch mode (development)
cd packages/eko-core && pnpm build --watch

# Clean build
pnpm clean  # Removes all node_modules and dist
```

### 3.3 Build Output

Each package produces:

| File | Format | Purpose |
|------|--------|---------|
| `dist/index.cjs.js` | CommonJS | Node.js require() |
| `dist/index.esm.js` | ES Modules | import/export |
| `dist/index.d.ts` | TypeScript | Type definitions |

---

## 4. Testing

### 4.1 Test Framework

| Tool | Version | Purpose |
|------|---------|---------|
| Jest | 29.7.0 | Test runner |
| ts-jest | 29.3.2 | TypeScript support |
| Playwright | 1.57.0 | Browser testing |

### 4.2 Test Commands

```bash
# Run all tests
cd eko-original && pnpm test

# Run package tests
cd packages/eko-core && pnpm test

# Run specific test file
cd packages/eko-core && npx jest test/core/eko.test.ts

# Run with coverage
cd packages/eko-core && npx jest --coverage
```

### 4.3 Test Structure

```
packages/eko-core/test/
├── core/           # Core functionality tests
├── integration/    # Integration tests
├── llm/            # LLM provider tests
├── memory/         # Memory system tests
├── tools/          # Tool tests
└── setup-jest.ts   # Test configuration
```

---

## 5. CI/CD Pipeline

### 5.1 Recommended GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
          
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'
          
      - name: Install dependencies
        run: pnpm install
        working-directory: eko-original
        
      - name: Build
        run: pnpm build
        working-directory: eko-original
        
      - name: Test
        run: pnpm test
        working-directory: eko-original
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### 5.2 Release Workflow

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
          
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
          
      - run: pnpm install
        working-directory: eko-original
        
      - run: pnpm build
        working-directory: eko-original
        
      - run: pnpm -r publish --access public
        working-directory: eko-original
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## 6. Environment Configuration

### 6.1 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | For tests | OpenAI API key |
| `ANTHROPIC_API_KEY` | For tests | Anthropic API key |
| `GOOGLE_API_KEY` | Optional | Google AI API key |
| `OPENROUTER_API_KEY` | Optional | OpenRouter API key |

### 6.2 .env Example

```bash
# .env.example
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
```

---

## 7. Deployment

### 7.1 NPM Publishing

```bash
# From package directory
cd packages/eko-core
./publish.sh  # Uses publish.sh script

# Or manual
npm publish --access public
```

### 7.2 Package Publishing Order

Due to workspace dependencies:

1. `@eko-ai/eko` (eko-core) - No dependencies
2. `@eko-ai/eko-nodejs` - Depends on eko-core
3. `@eko-ai/eko-web` - Depends on eko-core
4. `@eko-ai/eko-extension` - Depends on eko-core
5. `@eko-ai/eko-electron` - Depends on eko-core

---

## 8. Monitoring

### 8.1 Logging

Eko uses a custom `Log` utility:

```typescript
import Log from '@eko-ai/eko';

Log.info('Message');    // Info level
Log.warn('Warning');    // Warning level
Log.error('Error', e);  // Error level
Log.debug('Debug');     // Debug level (disabled by default)
```

### 8.2 Recommended Monitoring Tools

| Tool | Purpose |
|------|---------|
| Sentry | Error tracking |
| Datadog | APM and metrics |
| Prometheus | Custom metrics |
| Grafana | Dashboards |

---

## 9. Scaling Considerations

### 9.1 Horizontal Scaling

Eko is stateless per-instance:

- **Task contexts** are per-instance (use external storage for persistence)
- **Episodic memory** uses pluggable storage (can use shared database)
- **LLM calls** are independent per request

### 9.2 Resource Requirements

| Component | Memory | CPU |
|-----------|--------|-----|
| Base Eko instance | ~50MB | Low |
| With BrowserAgent | ~200MB | Medium |
| Playwright browser | ~500MB | High |

---

## 10. Security Checklist

- [ ] API keys stored in environment variables
- [ ] `.env` files in `.gitignore`
- [ ] `enableShellSafety: true` for production
- [ ] `restrictToWorkPath: true` for SystemAgent
- [ ] Rate limiting on API endpoints
- [ ] Input validation before LLM calls
