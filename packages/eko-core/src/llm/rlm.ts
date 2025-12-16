/**
 * @fileoverview Multi-provider LLM client with automatic failover and retry.
 * 
 * Provides resilient LLM access by:
 * - Supporting multiple providers (OpenAI, Anthropic, Google, AWS, etc.)
 * - Automatic failover when primary provider fails
 * - Retry logic with exponential backoff
 * - Streaming with timeout detection (first token + inter-token)
 * - Unified interface across different provider APIs
 * 
 * WHY: Production agents can't depend on single provider availability. This
 * class enables fault-tolerant LLM access with seamless provider switching.
 * 
 * @module llm/rlm
 */

import {
  LanguageModelV2,
  LanguageModelV2StreamPart,
  LanguageModelV2CallOptions,
} from "@ai-sdk/provider";
import Log from "../common/log";
import config from "../config";
import { createOpenAI } from "@ai-sdk/openai";
import { call_timeout } from "../common/utils";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  LLMs,
  LLMRequest,
  StreamResult,
  GenerateResult,
} from "../types/llm.types";
import { defaultLLMProviderOptions } from "../agent/agent-llm";
import TaskContext, { AgentContext } from "../agent/agent-context";

/**
 * Multi-provider LLM client with automatic retry and failover.
 * 
 * ARCHITECTURE:
 * - Takes map of provider configurations (LLMs object)
 * - Tries providers in order specified by `names` array
 * - On failure, automatically tries next provider
 * - Doubles provider list internally (each provider gets 2 attempts)
 * - Returns first successful response
 * 
 * STREAMING TIMEOUTS:
 * - stream_first_timeout: Max wait for first token (default 30s)
 *   - Detects stalled connections, routing issues
 * - stream_token_timeout: Max gap between tokens (default 180s)
 *   - Detects mid-stream hangs, allows slow generation
 * 
 * USAGE EXAMPLE:
 * ```typescript
 * const rlm = new RetryLanguageModel(
 *   {
 *     primary: { provider: "openai", model: "gpt-4", apiKey: "..." },
 *     backup: { provider: "anthropic", model: "claude-3", apiKey: "..." }
 *   },
 *   ["primary", "backup"]  // Try primary first, fallback to backup
 * );
 * const result = await rlm.call({ messages: [...], tools: [...] });
 * ```
 */
export class RetryLanguageModel {
  private llms: LLMs;
  private names: string[];
  private stream_first_timeout: number;
  private stream_token_timeout: number;
  private context?: TaskContext;
  private agentContext?: AgentContext;

  constructor(
    llms: LLMs,
    names?: string[],
    stream_first_timeout?: number,
    stream_token_timeout?: number,
    context?: TaskContext | AgentContext,
  ) {
    this.llms = llms;
    this.names = names || [];
    context && this.setContext(context);
    this.stream_first_timeout = stream_first_timeout || 30_000;
    this.stream_token_timeout = stream_token_timeout || 180_000;
    if (this.names.indexOf("default") == -1) {
      this.names.push("default");
    }
  }

  setContext(context?: TaskContext | AgentContext) {
    if (!context) {
      this.context = undefined;
      this.agentContext = undefined;
      return;
    }
    this.context = context instanceof TaskContext ? context : context.context;
    this.agentContext = context instanceof AgentContext ? context : undefined;
  }

  async call(request: LLMRequest): Promise<GenerateResult> {
    return await this.doGenerate({
      prompt: request.messages,
      tools: request.tools,
      toolChoice: request.toolChoice,
      maxOutputTokens: request.maxOutputTokens,
      temperature: request.temperature,
      topP: request.topP,
      topK: request.topK,
      stopSequences: request.stopSequences,
      abortSignal: request.abortSignal,
    });
  }

  /**
   * Executes non-streaming LLM call with multi-provider failover.
   * 
   * FLOW:
   * 1. Iterate through provider names (doubled for 2 attempts each)
   * 2. For each provider:
   *    - Get LLM client via getLLM()
   *    - Apply config defaults (maxOutputTokens, provider options)
   *    - Call optional request handler (for custom preprocessing)
   *    - Execute doGenerate()
   *    - On success: attach metadata (llm name, config) and return
   *    - On error: log and continue to next provider
   * 3. If all providers fail, reject with last error
   * 
   * ABORT HANDLING: Immediately throws on AbortError (don't retry on cancel)
   * 
   * @returns GenerateResult with text, tool calls, and usage stats
   */
  async doGenerate(
    options: LanguageModelV2CallOptions
  ): Promise<GenerateResult> {
    const maxOutputTokens = options.maxOutputTokens;
    const providerOptions = options.providerOptions;
    const names = [...this.names, ...this.names]; // Double for 2 attempts each
    let lastError;
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const llmConfig = this.llms[name];
      const llm = await this.getLLM(name);
      if (!llm) {
        continue;
      }
      // Apply defaults if not explicitly set
      if (!maxOutputTokens) {
        options.maxOutputTokens =
          llmConfig.config?.maxOutputTokens || config.maxOutputTokens;
      }
      if (!providerOptions) {
        options.providerOptions = defaultLLMProviderOptions();
        options.providerOptions[llm.provider] = llmConfig.options || {};
      }
      let _options = options;
      // Allow custom request transformation (e.g., prompt rewriting)
      if (llmConfig.handler) {
        _options = await llmConfig.handler(_options, this.context, this.agentContext);
      }
      try {
        let result = (await llm.doGenerate(_options)) as GenerateResult;
        if (Log.isEnableDebug()) {
          Log.debug(
            `LLM nonstream body, name: ${name} => `,
            result.request?.body
          );
        }
        result.llm = name;
        result.llmConfig = llmConfig;
        result.text = result.content.find((c) => c.type === "text")?.text;
        return result;
      } catch (e: any) {
        if (e?.name === "AbortError") {
          throw e; // Don't retry on explicit cancellation
        }
        lastError = e;
        if (Log.isEnableInfo()) {
          Log.info(`LLM nonstream request, name: ${name} => `, {
            tools: _options.tools,
            messages: _options.prompt,
          });
        }
        Log.error(`LLM error, name: ${name} => `, e);
      }
    }
    return Promise.reject(
      lastError ? lastError : new Error("No LLM available")
    );
  }

  async callStream(request: LLMRequest): Promise<StreamResult> {
    return await this.doStream({
      prompt: request.messages,
      tools: request.tools,
      toolChoice: request.toolChoice,
      maxOutputTokens: request.maxOutputTokens,
      temperature: request.temperature,
      topP: request.topP,
      topK: request.topK,
      stopSequences: request.stopSequences,
      abortSignal: request.abortSignal,
    });
  }

  /**
   * Executes streaming LLM call with timeout detection and failover.
   * 
   * CRITICAL TIMEOUTS:
   * 1. Connection timeout (stream_first_timeout): Waits for stream creation
   * 2. First token timeout (stream_first_timeout): Waits for initial chunk
   *    - If no data arrives, provider may be routing to wrong region/model
   * 3. Inter-token timeout (stream_token_timeout): Applied by streamWrapper()
   *    - Detects mid-stream hangs (network issues, model stalls)
   * 
   * FLOW:
   * 1. Create abort controller for timeout enforcement
   * 2. Call doStream() with timeout on connection
   * 3. Read first chunk with timeout (validates stream is actually working)
   * 4. Wrap remaining stream with inter-token timeout
   * 5. On any failure, automatically try next provider
   * 
   * WHY READ FIRST CHUNK: Some providers return successful connection but
   * never send data (routing errors, quota exhaustion). Reading first chunk
   * validates the stream is functional before returning to caller.
   * 
   * @returns StreamResult with readable stream (pre-seeded with first chunk)
   */
  async doStream(options: LanguageModelV2CallOptions): Promise<StreamResult> {
    const maxOutputTokens = options.maxOutputTokens;
    const providerOptions = options.providerOptions;
    const names = [...this.names, ...this.names];
    let lastError;
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const llmConfig = this.llms[name];
      const llm = await this.getLLM(name);
      if (!llm) {
        continue;
      }
      if (!maxOutputTokens) {
        options.maxOutputTokens =
          llmConfig.config?.maxOutputTokens || config.maxOutputTokens;
      }
      if (!providerOptions) {
        options.providerOptions = defaultLLMProviderOptions();
        options.providerOptions[llm.provider] = llmConfig.options || {};
      }
      let _options = options;
      if (llmConfig.handler) {
        _options = await llmConfig.handler(_options, this.context, this.agentContext);
      }
      try {
        const controller = new AbortController();
        const signal = _options.abortSignal
          ? AbortSignal.any([_options.abortSignal, controller.signal])
          : controller.signal;
        // Timeout #1: Wait for stream connection
        const result = (await call_timeout(
          async () => await llm.doStream({ ..._options, abortSignal: signal }),
          this.stream_first_timeout,
          (e) => {
            controller.abort();
          }
        )) as StreamResult;
        const stream = result.stream;
        const reader = stream.getReader();
        // Timeout #2: Wait for first chunk (validates stream is working)
        const { done, value } = await call_timeout(
          async () => await reader.read(),
          this.stream_first_timeout,
          (e) => {
            reader.cancel();
            reader.releaseLock();
            controller.abort();
          }
        );
        if (done) {
          Log.warn(`LLM stream done, name: ${name} => `, { done, value });
          reader.releaseLock();
          continue;
        }
        if (Log.isEnableDebug()) {
          Log.debug(`LLM stream body, name: ${name} => `, result.request?.body);
        }
        let chunk = value as LanguageModelV2StreamPart;
        if (chunk.type == "error") {
          Log.error(`LLM stream error, name: ${name}`, chunk);
          reader.releaseLock();
          continue;
        }
        result.llm = name;
        result.llmConfig = llmConfig;
        // Wrap stream with inter-token timeout (Timeout #3)
        result.stream = this.streamWrapper([chunk], reader, controller);
        return result;
      } catch (e: any) {
        if (e?.name === "AbortError") {
          throw e;
        }
        lastError = e;
        if (Log.isEnableInfo()) {
          Log.info(`LLM stream request, name: ${name} => `, {
            tools: _options.tools,
            messages: _options.prompt,
          });
        }
        Log.error(`LLM error, name: ${name} => `, e);
      }
    }
    return Promise.reject(
      lastError ? lastError : new Error("No LLM available")
    );
  }

  /**
   * Creates provider-specific LanguageModelV2 client from configuration.
   * 
   * SUPPORTED PROVIDERS:
   * - openai: Official OpenAI (auto-detects from baseURL)
   * - anthropic: Claude models via Anthropic API
   * - google: Gemini models via Google AI
   * - aws: Bedrock models via AWS SDK
   * - openrouter: OpenRouter proxy service
   * - openai-compatible: Generic OpenAI-compatible endpoints
   * - modelscope: ModelScope inference service (China)
   * - custom: Provider object with languageModel() method
   * 
   * CREDENTIALS: Supports both static strings and async functions for API keys
   * (enables dynamic credential fetching from vaults, env vars, etc.).
   * 
   * @param name - Provider name from LLMs config map
   * @returns Configured LanguageModelV2 instance or null if not found
   */
  private async getLLM(name: string): Promise<LanguageModelV2 | null> {
    const llm = this.llms[name];
    if (!llm) {
      return null;
    }
    // Resolve API key (supports both string and async function)
    let apiKey;
    if (typeof llm.apiKey === "string") {
      apiKey = llm.apiKey;
    } else {
      apiKey = await llm.apiKey();
    }
    // Resolve base URL (supports both string and async function)
    let baseURL = undefined;
    if (llm.config?.baseURL) {
      if (typeof llm.config.baseURL === "string") {
        baseURL = llm.config.baseURL;
      } else {
        baseURL = await llm.config.baseURL();
      }
    }
    // Provider-specific client creation
    if (llm.provider == "openai") {
      // Auto-detect: use official OpenAI client if URL is openai.com OR config has org
      if (
        !baseURL ||
        baseURL.indexOf("openai.com") > -1 ||
        llm.config?.organization ||
        llm.config?.openai
      ) {
        return createOpenAI({
          apiKey: apiKey,
          baseURL: baseURL,
          fetch: llm.fetch,
          organization: llm.config?.organization,
          project: llm.config?.project,
          headers: llm.config?.headers,
        }).languageModel(llm.model);
      } else {
        // Custom baseURL without org - use generic OpenAI-compatible client
        return createOpenAICompatible({
          name: llm.model,
          apiKey: apiKey,
          baseURL: baseURL,
          fetch: llm.fetch,
          headers: llm.config?.headers,
        }).languageModel(llm.model);
      }
    } else if (llm.provider == "anthropic") {
      return createAnthropic({
        apiKey: apiKey,
        baseURL: baseURL,
        fetch: llm.fetch,
        headers: llm.config?.headers,
      }).languageModel(llm.model);
    } else if (llm.provider == "google") {
      return createGoogleGenerativeAI({
        apiKey: apiKey,
        baseURL: baseURL,
        fetch: llm.fetch,
        headers: llm.config?.headers,
      }).languageModel(llm.model);
    } else if (llm.provider == "aws") {
      // API key format: "accessKeyId=secretAccessKey"
      let keys = apiKey.split("=");
      return createAmazonBedrock({
        accessKeyId: keys[0],
        secretAccessKey: keys[1],
        baseURL: baseURL,
        region: llm.config?.region || "us-west-1",
        fetch: llm.fetch,
        headers: llm.config?.headers,
        sessionToken: llm.config?.sessionToken,
      }).languageModel(llm.model);
    } else if (llm.provider == "openai-compatible") {
      return createOpenAICompatible({
        name: llm.config?.name || llm.model.split("/")[0],
        apiKey: apiKey,
        baseURL: baseURL || "https://openrouter.ai/api/v1",
        fetch: llm.fetch,
        headers: llm.config?.headers,
      }).languageModel(llm.model);
    } else if (llm.provider == "openrouter") {
      return createOpenRouter({
        apiKey: apiKey,
        baseURL: baseURL || "https://openrouter.ai/api/v1",
        fetch: llm.fetch,
        headers: llm.config?.headers,
        compatibility: llm.config?.compatibility,
      }).languageModel(llm.model);
    } else if (llm.provider == "modelscope") {
      return createOpenAICompatible({
        name: llm.config?.name || llm.model.split("/")[0],
        apiKey: apiKey,
        baseURL: baseURL || "https://api-inference.modelscope.cn/v1",
        fetch: llm.fetch,
        headers: llm.config?.headers,
      }).languageModel(llm.model);
    } else {
      // Custom provider object
      return llm.provider.languageModel(llm.model);
    }
  }

  /**
   * Wraps stream reader with inter-token timeout detection.
   * 
   * Creates new ReadableStream that:
   * 1. Enqueues pre-read chunks (parts array)
   * 2. On each pull, starts timeout timer
   * 3. Reads next chunk from underlying reader
   * 4. Clears timeout if chunk arrives in time
   * 5. Aborts if timeout expires (no chunk within stream_token_timeout)
   * 
   * WHY: Streaming can hang mid-generation (network issues, model stalls).
   * Without timeout, agent would wait indefinitely. This wrapper ensures
   * reasonable progress or fails fast.
   * 
   * @param parts - Pre-read chunks to enqueue first (e.g., first chunk from validation)
   * @param reader - Underlying stream reader
   * @param abortController - Controller to abort on timeout
   * @returns New stream with timeout enforcement
   */
  private streamWrapper(
    parts: LanguageModelV2StreamPart[],
    reader: ReadableStreamDefaultReader<LanguageModelV2StreamPart>,
    abortController: AbortController
  ): ReadableStream<LanguageModelV2StreamPart> {
    let timer: any = null;
    return new ReadableStream<LanguageModelV2StreamPart>({
      start: (controller) => {
        // Enqueue any pre-read chunks
        if (parts != null && parts.length > 0) {
          for (let i = 0; i < parts.length; i++) {
            controller.enqueue(parts[i]);
          }
        }
      },
      pull: async (controller) => {
        // Start inter-token timeout
        timer = setTimeout(() => {
          abortController.abort("Streaming request timeout");
        }, this.stream_token_timeout);
        const { done, value } = await reader.read();
        clearTimeout(timer);
        if (done) {
          controller.close();
          reader.releaseLock();
          return;
        }
        controller.enqueue(value);
      },
      cancel: (reason) => {
        timer && clearTimeout(timer);
        reader.cancel(reason);
      },
    });
  }

  public get Llms(): LLMs {
    return this.llms;
  }

  public get Names(): string[] {
    return this.names;
  }
}
