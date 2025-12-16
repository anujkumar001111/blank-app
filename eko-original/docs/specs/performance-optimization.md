# Performance Optimization Documentation
## Eko AI Framework

---

## 1. LLM Performance

### 1.1 Streaming

Eko uses streaming for all LLM calls to reduce time-to-first-token:

```typescript
// Default streaming with timeout handling
stream_first_timeout: 30_000,    // 30s for first token
stream_token_timeout: 180_000,   // 3min between tokens
```

### 1.2 Provider Failover

```typescript
// RetryLanguageModel tries providers in order
const rlm = new RetryLanguageModel(llms, ['fast', 'default']);
// Tries 'fast' first, falls back to 'default'
```

### 1.3 Token Optimization

| Setting | Default | Purpose |
|---------|---------|---------|
| `maxOutputTokens` | 16000 | Limit response size |
| `compressThreshold` | 80 | Compress at 80 messages |
| `memoryConfig.maxInputTokens` | 64000 | Max context window |

---

## 2. Memory Optimization

### 2.1 Conversation Compression

When history exceeds limits:

```typescript
memoryConfig: {
  maxMessageNum: 15,           // Compress after 15 messages
  compressionMaxLength: 6000,  // Summary max 6000 chars
  enableCompression: true
}
```

### 2.2 Episodic Memory Limits

```typescript
const memory = new EpisodicMemory({
  maxEpisodes: 100,  // Auto-prune old episodes
});
```

### 2.3 Task Cleanup

```typescript
// Clear finished tasks to free memory
eko.deleteTask(taskId);
```

---

## 3. Browser Automation Performance

### 3.1 Persistent Browser Context

```typescript
// Reuse browser across tasks
const agent = new BrowserAgent();
agent.setCdpWsEndpoint('ws://localhost:9222');
```

### 3.2 Screenshot Optimization

```typescript
// Compressed JPEG screenshots for LLM
screenshot(): Promise<{
  imageBase64: string;
  imageType: "image/jpeg" | "image/png";
}>
```

### 3.3 Stealth Mode

```typescript
// Applied automatically via playwright-extra
chromium.use(StealthPlugin());
```

---

## 4. Parallel Execution

### 4.1 Agent Parallelism

```typescript
// Agents without dependencies run in parallel
const workflow = {
  agents: [
    { id: 'a1', dependsOn: [] },      // Runs first
    { id: 'a2', dependsOn: ['a1'] },  // Waits for a1
    { id: 'a3', dependsOn: ['a1'] },  // Runs parallel with a2
  ]
};
```

### 4.2 Tool Parallelism

```typescript
// Enable parallel tool calls
config: {
  parallelToolCalls: true  // Default: true
}
```

---

## 5. Network Optimization

### 5.1 Minimal Payloads

- Tool results truncated to 100KB
- Images compressed before LLM calls
- Large text chunked automatically

### 5.2 Abort Handling

```typescript
// All requests use AbortController
const controller = new AbortController();
await rlm.callStream({
  messages: [...],
  abortSignal: controller.signal
});
```

---

## 6. Shell Execution Performance

### 6.1 Background Jobs

```typescript
// Non-blocking for long-running commands
await shell.execute({
  command: 'npm run build',
  background: true
});
```

### 6.2 Output Buffering

```typescript
maxBuffer: 10 * 1024 * 1024  // 10MB buffer limit
```

---

## 7. Caching Strategies

### 7.1 Embedding Cache

```typescript
// OpenAIEmbeddingProvider includes caching
class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private cache = new Map<string, number[]>();
}
```

### 7.2 Browser State Cache

- Cookies persisted across sessions
- LocalStorage auto-loaded
- Session reuse when possible

---

## 8. Monitoring Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to first token | <2s | Stream callback timing |
| Tool execution | <1s avg | Tool execute() duration |
| Browser navigation | <3s | page.goto() timing |
| Memory per task | <50MB | Process.memoryUsage() |

---

## 9. Optimization Checklist

- [ ] Enable streaming for all LLM calls
- [ ] Configure provider failover
- [ ] Set appropriate max tokens
- [ ] Enable conversation compression
- [ ] Limit episodic memory size
- [ ] Cleanup finished tasks
- [ ] Use persistent browser contexts
- [ ] Enable parallel tool calls
- [ ] Use background jobs for long commands
