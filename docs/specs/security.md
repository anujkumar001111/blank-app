# Security Documentation
## Eko AI Framework

---

## 1. Overview

Eko implements defense-in-depth security for AI agent operations.

---

## 2. Authentication

### 2.1 LLM API Keys

```typescript
// Secure: Use environment variables
const llms: LLMs = {
  default: {
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY!  // Never hardcode
  }
};

// Dynamic: Use async function for rotation
apiKey: async () => await secretManager.getSecret('openai-key')
```

### 2.2 Web Environment Warning

> **NEVER expose API keys in browser/frontend code.**

```typescript
// Use baseURL proxy instead
const llms: LLMs = {
  default: {
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: 'proxy-token',  // Server validates
    config: {
      baseURL: '/api/llm-proxy'  // Your backend
    }
  }
};
```

---

## 3. Authorization

### 3.1 SystemAgent Security Options

```typescript
const agent = new SystemAgent({
  workPath: '/app/workspace',     // Restrict operations
  enableShellSafety: true,        // Block dangerous commands
  restrictToWorkPath: true,       // Enforce path restriction
  allowedPaths: ['/tmp', '/data'] // Additional allowed paths
});
```

### 3.2 Tool Authorization

```typescript
// Custom authorization in tool
async execute(args, context) {
  if (!context.config.allowFileOperations) {
    return { isError: true, content: [{ text: 'Unauthorized' }] };
  }
  // Proceed with operation
}
```

---

## 4. Input Validation

### 4.1 Zod Schema Validation

```typescript
const tool: Tool = {
  name: 'file_read',
  parameters: z.object({
    path: z.string()
      .min(1)
      .refine(p => !p.includes('..'), 'Path traversal not allowed')
  }),
  execute: async (args) => { ... }
};
```

### 4.2 Path Traversal Protection

```typescript
// eko-nodejs/src/tools/security.ts
function resolvePath(basePath: string, userPath: string): string {
  const resolved = path.resolve(basePath, userPath);
  
  // Ensure resolved path is within basePath
  if (!resolved.startsWith(basePath)) {
    throw new Error('Path traversal detected');
  }
  
  return resolved;
}
```

---

## 5. Shell Command Security

### 5.1 Dangerous Patterns

```typescript
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\/(?!\w)/,  // rm -rf /
  />\s*\/dev\/sd/,         // Block device writes
  /mkfs/,                  // Filesystem formatting
  /:\(\)\{.*\};:/,         // Fork bombs
];
```

### 5.2 Security Check

```typescript
if (this.enableShellSafety && this.isDangerous(command)) {
  return {
    isError: true,
    content: [{
      type: 'text',
      text: 'Error: dangerous command blocked'
    }]
  };
}
```

---

## 6. Data Encryption

### 6.1 Sensitive Data Handling

- API keys: Never logged, never in error messages
- User data: Use episodic memory encryption (custom provider)
- Cookies: Cleared on browser context close (optional)

### 6.2 Secure JSON Parsing

```typescript
import secureJsonParse from 'secure-json-parse';

// Protects against prototype pollution
const data = secureJsonParse(jsonString);
```

---

## 7. Network Security

### 7.1 Request Timeout

```typescript
stream_first_timeout: 30_000,   // 30s max for first response
stream_token_timeout: 180_000,  // 3min max between tokens
```

### 7.2 Abort Handling

```typescript
// All requests support cancellation
const controller = new AbortController();
await llm.doStream({ abortSignal: controller.signal });
```

---

## 8. Browser Security

### 8.1 Stealth Mode

```typescript
// Avoids detection, reduces fingerprinting
chromium.use(StealthPlugin());
```

### 8.2 Cookie Isolation

```typescript
// Cookies loaded per-context, not shared
await context.addCookies(cookies);
```

---

## 9. Security Checklist

- [ ] API keys in environment variables only
- [ ] No keys in client-side code
- [ ] `enableShellSafety: true` in production
- [ ] `restrictToWorkPath: true` for SystemAgent
- [ ] Input validation on all tools
- [ ] Path traversal protection enabled
- [ ] Secure JSON parsing used
- [ ] Request timeouts configured
- [ ] Logs sanitized (no secrets)

---

## 10. Vulnerability Reporting

Report security issues to: security@fellou.ai
