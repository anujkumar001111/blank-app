/**
 * MCP SSE Client - Server-Sent Events Transport
 *
 * Implements Model Context Protocol client over HTTP Server-Sent Events,
 * enabling long-lived bidirectional communication with MCP servers using
 * standard HTTP infrastructure (no WebSocket required).
 *
 * Architecture:
 * - SSE stream (server → client): Tool updates, server notifications
 * - HTTP POST (client → server): Tool calls, requests
 * - Ping/reconnect: Maintains connection health across network failures
 *
 * MCP initialization flow:
 * 1. Connect to SSE endpoint (/sse)
 * 2. Server sends "endpoint" event with message URL
 * 3. Client sends "initialize" handshake
 * 4. Client sends "notifications/initialized"
 * 5. Connection ready for tool list/call operations
 *
 * WHY SSE over WebSocket?
 * - Pros: Works through HTTP proxies, simpler infrastructure
 * - Pros: Automatic reconnection built into browser EventSource
 * - Pros: No special server setup (standard HTTP/1.1)
 * - Cons: Unidirectional (requires POST for client → server)
 * - Cons: No binary frame support (JSON only)
 *
 * Request/response correlation:
 * - Each request gets unique UUID
 * - Response matched via message.id field
 * - Promise-based API hides async complexity
 *
 * Error handling:
 * - Auto-reconnect after 500ms on connection drop
 * - Ping every 10s to detect broken connections
 * - 15s initialization timeout for slow servers
 *
 * Design tradeoff: SSE+POST hybrid more complex than pure WebSocket,
 * but works in restrictive network environments (corporate proxies).
 */

import Log from "../common/log";
import { uuidv4 } from "../common/utils";
import {
  ToolResult,
  IMcpClient,
  McpCallToolParam,
  McpListToolParam,
  McpListToolResult,
} from "../types";

/**
 * SSE event data structure (browser EventSource format)
 */
type SseEventData = {
  id?: string;
  event?: string;
  data?: string;
  [key: string]: unknown;
};

/**
 * SSE connection handler interface (platform abstraction)
 *
 * Allows using browser EventSource or Node.js polyfill via same interface.
 */
type SseHandler = {
  onopen: () => void;
  onmessage: (data: SseEventData) => void;
  onerror: (e: unknown) => void;
  readyState?: 0 | 1 | 2; // 0 init; 1 connected; 2 closed
  close?: Function;
};

export class SimpleSseMcpClient implements IMcpClient {
  private sseUrl: string;
  private clientName: string;
  private sseHandler?: SseHandler;
  private msgUrl?: string;
  private pingTimer?: any;
  private reconnectTimer?: any;
  private headers: Record<string, string>;
  private protocolVersion: string = "2025-06-18";
  private requestMap: Map<string, (messageData: any) => void>;

  constructor(
    sseServerUrl: string,
    clientName: string = "EkoMcpClient",
    headers: Record<string, string> = {}
  ) {
    this.sseUrl = sseServerUrl;
    this.clientName = clientName;
    this.headers = headers;
    this.requestMap = new Map();
  }

  /**
   * Establishes SSE connection and performs MCP handshake
   *
   * Flow:
   * 1. Close existing connection if present
   * 2. Create new SSE handler with callbacks
   * 3. Connect to SSE endpoint (with 15s timeout)
   * 4. Wait for "endpoint" event (contains POST URL)
   * 5. Send initialize + initialized messages
   * 6. Start 10s ping keepalive
   *
   * Auto-reconnect: On error with readyState=2, retries after 500ms.
   * AbortSignal: Allows cancellation during connection.
   */
  async connect(signal?: AbortSignal): Promise<void> {
    Log.info("MCP Client, connecting...", this.sseUrl);
    if (this.sseHandler && this.sseHandler.readyState == 1) {
      this.sseHandler.close && this.sseHandler.close();
      this.sseHandler = undefined;
    }
    this.pingTimer && clearInterval(this.pingTimer);
    this.reconnectTimer && clearTimeout(this.reconnectTimer);
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 15000);
      this.sseHandler = {
        onopen: () => {
          Log.info("MCP Client, connection successful", this.sseUrl);
          clearTimeout(timer);
          setTimeout(resolve, 200);
        },
        onmessage: (data) => this.onmessage(data),
        onerror: (e) => {
          Log.error("MCP Client, error: ", e);
          clearTimeout(timer);
          if (this.sseHandler?.readyState === 2) {
            this.pingTimer && clearInterval(this.pingTimer);
            this.reconnectTimer = setTimeout(() => {
              this.connect();
            }, 500);
          }
          resolve();
        },
      };
      connectSse(this.sseUrl, this.sseHandler, this.headers, signal);
    });
    this.pingTimer = setInterval(() => this.ping(), 10000);
  }

  /**
   * Handles incoming SSE messages
   *
   * Event types:
   * - "endpoint": Server announces POST URL for client requests
   * - "message": RPC response (matched via message.id)
   *
   * Triggers initialize sequence when endpoint received.
   */
  onmessage(data: SseEventData) {
    Log.debug("MCP Client, onmessage", this.sseUrl, data);
    if (data.event == "endpoint") {
      let uri = data.data as string;
      let msgUrl: string;
      let idx = this.sseUrl.indexOf("/", 10);
      if (idx > -1) {
        msgUrl = this.sseUrl.substring(0, idx) + uri;
      } else {
        msgUrl = this.sseUrl + uri;
      }
      this.msgUrl = msgUrl;
      this.initialize();
    } else if (data.event == "message") {
      let message = JSON.parse(data.data as string);
      let _resolve = this.requestMap.get(message.id);
      _resolve && _resolve(message);
    }
  }

  /**
   * MCP handshake: Announces client capabilities
   *
   * Declares support for:
   * - tools.listChanged: Client handles dynamic tool list updates
   * - sampling: Client supports LLM sampling requests
   */
  private async initialize() {
    await this.request("initialize", {
      protocolVersion: this.protocolVersion,
      capabilities: {
        tools: {
          listChanged: true,
        },
        sampling: {},
      },
      clientInfo: {
        name: this.clientName,
        version: "1.0.0",
      },
    });
    try {
      await this.request("notifications/initialized", {});
    } catch (ignored) { }
  }

  private ping() {
    this.request("ping", {});
  }

  async listTools(
    param: McpListToolParam,
    signal?: AbortSignal
  ): Promise<McpListToolResult> {
    const message = await this.request(
      "tools/list",
      {
        ...param,
      },
      signal
    );
    return message.result.tools || [];
  }

  async callTool(
    param: McpCallToolParam,
    signal?: AbortSignal
  ): Promise<ToolResult> {
    const message = await this.request(
      "tools/call",
      {
        ...param,
      },
      signal
    );
    return message.result;
  }

  private async request(
    method: string,
    params: Record<string, any>,
    signal?: AbortSignal
  ): Promise<any> {
    const id = method.startsWith("notifications/") ? undefined : uuidv4();
    try {
      // Create callback promise with timeout to prevent indefinite hanging
      const CALLBACK_TIMEOUT_MS = 60000; // 60 seconds
      const callback = new Promise<any>((resolve, reject) => {
        // Timeout handler
        const timeoutId = setTimeout(() => {
          id && this.requestMap.delete(id);
          reject(new Error(`MCP ${method} timeout: No response received within ${CALLBACK_TIMEOUT_MS / 1000}s`));
        }, CALLBACK_TIMEOUT_MS);

        if (signal) {
          signal.addEventListener("abort", () => {
            clearTimeout(timeoutId);
            const error = new Error("Operation was interrupted");
            error.name = "AbortError";
            reject(error);
          });
        }

        // Wrap resolve to clear timeout
        id && this.requestMap.set(id, (message: any) => {
          clearTimeout(timeoutId);
          resolve(message);
        });
      });
      Log.debug(`MCP Client, ${method}`, id, params);
      const response = await fetch(this.msgUrl as string, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.headers,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: id,
          method: method,
          params: {
            ...params,
          },
        }),
        signal: signal,
      });
      // Handle response per MCP specification (aligned with official TypeScript SDK)
      // The official SDK checks response.ok (true for 2xx status codes including 202)
      // and does NOT verify specific body content
      if (response.ok) {
        // SSE transport model: Server returns 202 Accepted, actual response comes via SSE stream
        // This client ONLY supports the SSE response model - for direct JSON responses use SimpleHttpMcpClient
        const message = await callback;
        if (message.error) {
          Log.error(`MCP ${method} error: ` + message.error);
          throw new Error(
            `MCP ${method} error: ` +
            (typeof message.error === "string"
              ? message.error
              : message.error.message)
          );
        }
        if (message.result?.isError == true) {
          if (message.result.content) {
            throw new Error(
              `MCP ${method} error: ` +
              (typeof message.result.content === "string"
                ? message.result.content
                : message.result.content[0].text)
            );
          } else {
            throw new Error(
              `MCP ${method} error: ` + JSON.stringify(message.result)
            );
          }
        }
        return message;
      } else {
        // Non-2xx status: Read body for error details
        const errorBody = await response.text().catch(() => "unknown error");
        throw new Error(`MCP ${method} error (HTTP ${response.status}): ${errorBody}`);
      }
    } finally {
      id && this.requestMap.delete(id);
    }
  }

  isConnected(): boolean {
    if (this.sseHandler && this.sseHandler.readyState == 1) {
      return true;
    }
    return false;
  }

  async close(): Promise<void> {
    try {
      await this.request("notifications/cancelled", {
        requestId: uuidv4(),
        reason: "User requested cancellation",
      });
    } catch (ignored) { }
    this.pingTimer && clearInterval(this.pingTimer);
    this.reconnectTimer && clearTimeout(this.reconnectTimer);
    this.sseHandler && this.sseHandler.close && this.sseHandler.close();
    this.pingTimer = undefined;
    this.sseHandler = undefined;
    this.reconnectTimer = undefined;
  }
}

async function connectSse(
  sseUrl: string,
  hander: SseHandler,
  headers: Record<string, string> = {},
  _signal?: AbortSignal
) {
  try {
    hander.readyState = 0;
    const controller = new AbortController();
    const signal = _signal
      ? AbortSignal.any([controller.signal, _signal])
      : controller.signal;
    const response = await fetch(sseUrl, {
      method: "GET",
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        ...headers,
      },
      body: null,
      keepalive: true,
      signal: signal,
    });
    const reader = response.body?.getReader() as ReadableStreamDefaultReader;
    hander.close = () => {
      controller.abort();
      hander.readyState = 2;
      Log.debug("McpClient close abort.", sseUrl);
    };
    let str = "";
    const decoder = new TextDecoder();
    hander.readyState = 1;
    hander.onopen();
    while (hander.readyState == 1) {
      const { value, done } = await reader?.read();
      if (done) {
        break;
      }
      const text = decoder.decode(value);
      str += text;
      if (str.indexOf("\n\n") > -1) {
        const chunks = str.split("\n\n");
        for (let i = 0; i < chunks.length - 1; i++) {
          const chunk = chunks[i];
          const chunkData = parseChunk(chunk);
          hander.onmessage(chunkData);
        }
        str = chunks[chunks.length - 1];
      }
    }
  } catch (e: any) {
    if (e?.name !== "AbortError") {
      Log.error("MCP Client, connectSse error:", e);
      hander.onerror(e);
    }
  } finally {
    hander.readyState = 2;
  }
}

function parseChunk(chunk: string): SseEventData {
  const lines = chunk.split("\n");
  const chunk_obj: SseEventData = {};
  for (let j = 0; j < lines.length; j++) {
    const line = lines[j];
    if (line.startsWith("id:")) {
      chunk_obj["id"] = line.substring(3).trim();
    } else if (line.startsWith("event:")) {
      chunk_obj["event"] = line.substring(6).trim();
    } else if (line.startsWith("data:")) {
      chunk_obj["data"] = line.substring(5).trim();
    } else {
      const idx = line.indexOf(":");
      if (idx > -1) {
        chunk_obj[line.substring(0, idx)] = line.substring(idx + 1).trim();
      }
    }
  }
  return chunk_obj;
}
