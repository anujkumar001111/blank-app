# Testing Plan Documentation
## Eko AI Framework

---

## 1. Overview

Eko uses Jest for testing with ts-jest for TypeScript support. Tests are organized by package and category.

---

## 2. Test Structure

```
packages/
├── eko-core/test/
│   ├── core/           # Core functionality
│   ├── integration/    # Integration tests
│   ├── llm/            # LLM provider tests
│   ├── memory/         # Memory system tests
│   ├── tools/          # Tool tests
│   └── setup-jest.ts   # Test configuration
│
├── eko-nodejs/test/
│   ├── browser/        # BrowserAgent tests
│   ├── system/         # SystemAgent tests
│   └── tools/          # Node.js tool tests
│
└── eko-web/test/
    └── browser/        # Web browser tests
```

---

## 3. Test Categories

### 3.1 Unit Tests

Test individual functions and classes in isolation.

| Category | Location | Coverage |
|----------|----------|----------|
| XML Parsing | `test/core/xml.test.ts` | parseWorkflow, resetWorkflowXml |
| Utilities | `test/core/utils.test.ts` | uuid, mergeTools, etc. |
| Memory | `test/memory/` | EpisodicMemory, storage |
| Tools | `test/tools/` | Individual tool execution |

**Example:**

```typescript
// test/core/xml.test.ts
describe('parseWorkflow', () => {
  it('should parse valid XML workflow', () => {
    const xml = '<root><name>Test</name><agents>...</agents></root>';
    const workflow = parseWorkflow('task-1', xml, true);
    expect(workflow).toBeDefined();
    expect(workflow.name).toBe('Test');
  });
  
  it('should handle incomplete XML during streaming', () => {
    const partial = '<root><name>Test';
    const workflow = parseWorkflow('task-1', partial, false);
    expect(workflow).toBeNull();
  });
});
```

### 3.2 Integration Tests

Test component interactions and full workflows.

| Category | Location | Coverage |
|----------|----------|----------|
| Agent Execution | `test/integration/` | Agent + Tool interaction |
| LLM Calls | `test/llm/` | Provider integration |
| MCP | `test/integration/mcp.test.ts` | MCP client integration |

**Example:**

```typescript
// test/integration/agent.test.ts
describe('Agent Integration', () => {
  it('should execute tool chain', async () => {
    const agent = new TestAgent();
    const context = createMockContext();
    
    const result = await agent.run(context, agentChain);
    
    expect(result).toContain('success');
    expect(context.chain.messages.length).toBeGreaterThan(0);
  });
});
```

### 3.3 End-to-End Tests

Test complete user flows (requires API keys).

```typescript
// test/e2e/workflow.test.ts
describe('Workflow E2E', () => {
  it('should generate and execute workflow', async () => {
    const eko = new Eko({ llms, agents });
    
    const result = await eko.run('Test task prompt');
    
    expect(result.success).toBe(true);
    expect(result.stopReason).toBe('done');
  });
});
```

---

## 4. Test Configuration

### 4.1 Jest Config

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  setupFilesAfterEnv: ['<rootDir>/test/setup-jest.ts'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  moduleNameMapper: {
    '^@eko-ai/eko$': '<rootDir>/../eko-core/src'
  }
};
```

### 4.2 Test Setup

```typescript
// test/setup-jest.ts
import { config } from 'dotenv';
config({ path: '.env' });

// Increase timeout for LLM tests
jest.setTimeout(60000);

// Mock global fetch if needed
global.fetch = jest.fn();
```

---

## 5. Mocking Strategies

### 5.1 LLM Mocking

```typescript
const mockLLM = {
  doGenerate: jest.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'Mock response' }],
    finishReason: 'stop',
    usage: { promptTokens: 100, completionTokens: 50 }
  }),
  doStream: jest.fn().mockResolvedValue({
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'text-delta', delta: 'Hello' });
        controller.close();
      }
    })
  })
};
```

### 5.2 Tool Mocking

```typescript
const mockTool: Tool = {
  name: 'mock_tool',
  description: 'Mock tool for testing',
  parameters: { type: 'object', properties: {} },
  execute: jest.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'Tool result' }],
    isError: false
  })
};
```

### 5.3 Browser Mocking

```typescript
const mockPage = {
  goto: jest.fn().mockResolvedValue(undefined),
  click: jest.fn().mockResolvedValue(undefined),
  fill: jest.fn().mockResolvedValue(undefined),
  screenshot: jest.fn().mockResolvedValue(Buffer.from(''))
};
```

---

## 6. Test Commands

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test -- --coverage

# Run specific test file
npx jest test/core/xml.test.ts

# Run tests matching pattern
npx jest --testPathPattern="memory"

# Run tests in watch mode
npx jest --watch

# Run only failed tests
npx jest --onlyFailures
```

---

## 7. Coverage Requirements

> **Note**: Coverage percentages are estimates. Run `pnpm test -- --coverage` to generate actual reports.

| Package | Target | Estimated |
|---------|--------|-----------|
| eko-core | 80% | ~75% |
| eko-nodejs | 70% | ~65% |
| eko-web | 60% | ~50% |

### Coverage Report

```bash
cd packages/eko-core
npx jest --coverage --coverageReporters="text" --coverageReporters="html"
```

Output saved to `coverage/` directory.

---

## 8. Test Data

### 8.1 Fixtures

```
test/fixtures/
├── workflows/
│   ├── simple.xml
│   ├── parallel.xml
│   └── foreach.xml
├── episodes/
│   └── sample-episodes.json
└── responses/
    └── mock-llm-responses.json
```

### 8.2 Factories

```typescript
// test/factories/workflow.ts
export function createWorkflow(overrides = {}): Workflow {
  return {
    taskId: 'test-task-1',
    name: 'Test Workflow',
    thought: 'Test reasoning',
    agents: [],
    xml: '<root>...</root>',
    ...overrides
  };
}

export function createAgent(overrides = {}): WorkflowAgent {
  return {
    id: 'agent-1',
    name: 'TestAgent',
    task: 'Test task',
    dependsOn: [],
    nodes: [],
    status: 'init',
    xml: '<agent>...</agent>',
    ...overrides
  };
}
```

---

## 9. CI/CD Integration

### 9.1 GitHub Actions

```yaml
- name: Test
  run: pnpm test -- --coverage --ci
  working-directory: eko-original
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### 9.2 Test Splitting (Large Suites)

```bash
# Run unit tests only
npx jest --testPathPattern="test/(core|tools)"

# Run integration tests only
npx jest --testPathPattern="test/integration"
```

---

## 10. Manual Testing

### 10.1 Playground Testing

```bash
cd packages/eko-nodejs

# Interactive mode
pnpm playground:interactive

# Browser automation demo
pnpm playground:browser

# System tools demo
pnpm playground:system
```

### 10.2 Exploratory Testing Checklist

- [ ] Generate workflow from complex prompt
- [ ] Execute workflow with multiple agents
- [ ] Test pause/resume functionality
- [ ] Test abort functionality
- [ ] Verify streaming output
- [ ] Test human-in-the-loop callbacks
- [ ] Verify browser automation actions
- [ ] Test file operations with security enabled
- [ ] Verify LLM failover behavior
- [ ] Test episodic memory recall
