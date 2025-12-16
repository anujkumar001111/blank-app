# Product Requirements Document (PRD)
## Eko AI Agent Framework

---

## 1. Executive Summary

| Field | Value |
|-------|-------|
| **Product Name** | Eko |
| **Version** | 4.0.5 |
| **Tagline** | Build Production-ready Agentic Workflows with Natural Language |
| **Organization** | FellouAI |
| **License** | MIT |

**Eko** (pronounced like "echo") is a production-ready JavaScript/TypeScript framework that enables developers to create reliable AI agents, from simple commands to complex multi-step workflows. It provides a unified interface for running agents across browser, Node.js, Electron, and browser extension environments.

---

## 2. Problem Statement

### Current Challenges
1. **Platform Fragmentation**: Developers struggle to build AI agents that work across different environments (browser, server, desktop, extensions)
2. **Complexity in Multi-Agent Orchestration**: Coordinating multiple AI agents with dependencies is error-prone
3. **Lack of Learning**: Most agent frameworks don't learn from past successes/failures
4. **Provider Lock-in**: Switching between LLM providers requires significant code changes
5. **Security Concerns**: Executing shell commands and file operations without proper safeguards

### Solution
Eko provides:
- Unified cross-platform agent execution
- Dependency-aware parallel agent orchestration
- Episodic memory for persistent learning
- Multi-provider LLM support with automatic failover
- Security-first file and shell operations

---

## 3. Target Audience

### Primary Users

| Persona | Description | Goals | Pain Points |
|---------|-------------|-------|-------------|
| **SDK Developers** | Build AI-powered applications | Integrate AI agents into products | Need reliable, type-safe APIs |
| **Automation Engineers** | Automate browser and system tasks | Create repeatable workflows | Complex tool chaining |
| **AI Researchers** | Experiment with agent architectures | Prototype agent systems quickly | Need extensible framework |
| **Enterprise Teams** | Build internal automation tools | Scale agent operations | Security and reliability |

### Secondary Users
- Open-source contributors extending the framework
- DevOps teams deploying agent systems

---

## 4. Key Features

### Priority 1 (Core)
| Feature | Description | Status |
|---------|-------------|--------|
| **Multi-Platform Support** | Run agents in Node.js, Browser, Electron, Extensions | ✅ Complete |
| **LLM Provider Abstraction** | 7 providers with automatic failover | ✅ Complete |
| **Workflow Generation** | Natural language to XML workflow conversion | ✅ Complete |
| **Agent Orchestration** | Dependency-aware parallel execution | ✅ Complete |
| **Browser Automation** | Playwright-based web automation | ✅ Complete |

### Priority 2 (Enhanced)
| Feature | Description | Status |
|---------|-------------|--------|
| **Episodic Memory** | Learn from past task executions | ✅ Complete |
| **MCP Integration** | Model Context Protocol clients | ✅ Complete |
| **Human-in-the-Loop** | Intervention points for user input | ✅ Complete |
| **Task Control** | Pause, resume, abort workflows | ✅ Complete |
| **System Tools** | File operations, shell execution | ✅ Complete |

### Priority 3 (Future)
| Feature | Description | Status |
|---------|-------------|--------|
| **Observable Chain** | Real-time workflow monitoring | 🔄 Coming Soon |
| **Native A2A** | Agent-to-Agent communication protocol | ✅ Beta (see `a2a.ts`) |

---

## 5. Technical Requirements

### Platform Requirements

| Platform | Runtime | Dependencies |
|----------|---------|--------------|
| Node.js | 18+ | Playwright, glob, canvas |
| Browser | Modern (ES2020+) | None (bundled) |
| Electron | 20+ | Main/renderer bridge |
| Extension | MV3 | Chrome APIs |

### LLM Provider Support

| Provider | SDK | Status |
|----------|-----|--------|
| OpenAI | @ai-sdk/openai | ✅ |
| Anthropic | @ai-sdk/anthropic | ✅ |
| Google | @ai-sdk/google | ✅ |
| AWS Bedrock | @ai-sdk/amazon-bedrock | ✅ |
| OpenRouter | @openrouter/ai-sdk-provider | ✅ |
| OpenAI-Compatible | @ai-sdk/openai-compatible | ✅ |
| ModelScope | @ai-sdk/openai-compatible | ✅ |

---

## 6. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Test Pass Rate** | >95% | Jest test suite |
| **Build Success** | 100% | CI/CD pipeline |
| **Type Coverage** | 100% | TypeScript strict mode |
| **API Response Time** | <100ms | Agent initialization |
| **Memory Footprint** | <50MB | Base agent instance |

---

## 7. Assumptions & Risks

### Assumptions
1. Users have Node.js 18+ installed for server-side usage
2. LLM API keys are provided by users
3. Browser automation requires Playwright browsers installed
4. Users understand basic AI agent concepts

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM API rate limits | High | Retry with failover providers |
| Browser detection | Medium | Stealth plugin integration |
| Security vulnerabilities | High | Pattern blocking, path validation |
| Provider API changes | Medium | SDK abstraction layer |

---

## 8. Release History

| Version | Date | Highlights |
|---------|------|------------|
| 4.0.5 | Nov 2025 | Chat conversations, agent logic optimization |
| 3.0.0 | Sep 2025 | Dependency-aware parallel execution, pause/resume |
| 2.x | 2024 | Initial multi-platform support |

---

## 9. Competitive Analysis

| Feature | Eko | Langchain | Browser-use | Dify.ai |
|---------|-----|-----------|-------------|---------|
| **Multi-Platform** | ✅ All | ❌ Server | ❌ Browser | ❌ Web |
| **NL to Workflow** | ✅ | ❌ | ✅ | ❌ |
| **Intervenability** | ✅ | ✅ | ❌ | ❌ |
| **Task Parallel** | ✅ | ❌ | ❌ | ❌ |
| **Open Source** | ✅ | ✅ | ✅ | ✅ |
