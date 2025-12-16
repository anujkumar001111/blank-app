import config from "../config";
import { LanguageModelV2Message } from "@ai-sdk/provider";
import { defaultMessageProviderOptions } from "../agent/agent-llm";
import { toFile, uuidv4, getMimeType, sub } from "../common/utils";
import { EkoMessage, LanguageModelV2Prompt, MemoryConfig } from "../types";

/**
 * Core Memory Management System for Conversation Context
 *
 * Manages conversation history, system prompts, and context window optimization
 * for effective agent interactions. Provides capacity management, message compression,
 * and token estimation to ensure optimal LLM performance within context limits.
 *
 * ## Key Features
 *
 * - **Capacity Management**: Automatic pruning of old messages to stay within limits
 * - **Message Compression**: Intelligent truncation of long content to preserve context
 * - **Token Estimation**: Accurate token counting for context window management
 * - **Message Repair**: Automatic fixing of conversation discontinuities
 * - **Multi-format Support**: Handles text, files, tool calls, and tool results
 *
 * ## Memory Strategies
 *
 * 1. **Message Count Limits**: Remove oldest messages when exceeding maximum count
 * 2. **Token Limits**: Prune messages when total tokens exceed LLM context window
 * 3. **Content Compression**: Truncate long assistant/tool messages while preserving structure
 * 4. **Conversation Repair**: Fix broken message sequences and add missing tool results
 *
 * @example
 * ```typescript
 * const memory = new EkoMemory(
 *   "You are a helpful coding assistant",
 *   [], // initial messages
 *   { maxMessageNum: 50, maxInputTokens: 8000 }
 * );
 *
 * // Add conversation messages
 * await memory.addMessages([userMessage, assistantMessage]);
 *
 * // Build context for LLM call
 * const context = memory.buildMessages();
 * ```
 */
export class EkoMemory {
  /** System prompt defining agent behavior and role */
  protected systemPrompt?: string;
  /** Ordered array of conversation messages */
  protected messages: EkoMessage[];
  /** Configuration for memory management behavior */
  private memoryConfig: MemoryConfig;

  /**
   * Creates a new memory instance with optional initial state
   *
   * @param systemPrompt - System message defining agent behavior (optional)
   * @param messages - Initial conversation messages (default: empty array)
   * @param memoryConfig - Memory management configuration (default: global config)
   */
  constructor(
    systemPrompt?: string,
    messages: EkoMessage[] = [],
    memoryConfig: MemoryConfig = config.memoryConfig
  ) {
    this.messages = messages;
    this.systemPrompt = systemPrompt;
    this.memoryConfig = memoryConfig;
  }

  public genMessageId(): string {
    return uuidv4();
  }

  public async import(data: {
    messages: EkoMessage[];
    config?: MemoryConfig;
  }): Promise<void> {
    this.messages = [...data.messages];
    if (data.config) {
      await this.updateConfig(data.config);
    } else {
      await this.manageCapacity();
    }
  }

  public setSystemPrompt(systemPrompt: string): void {
    this.systemPrompt = systemPrompt;
  }

  public getSystemPrompt(): string | undefined {
    return this.systemPrompt;
  }

  public async addMessages(messages: EkoMessage[]): Promise<void> {
    this.messages.push(...messages);
    await this.manageCapacity();
  }

  public getMessages(): EkoMessage[] {
    return this.messages;
  }

  public getMessageById(id: string): EkoMessage | undefined {
    return this.messages.find((message) => message.id === id);
  }

  public removeMessageById(
    id: string,
    removeToNextUserMessages: boolean = true
  ): string[] | undefined {
    const removedIds: string[] = [];
    for (let i = 0; i < this.messages.length; i++) {
      const message = this.messages[i];
      if (message.id === id) {
        removedIds.push(id);
        if (removeToNextUserMessages) {
          for (let j = i + 1; j < this.messages.length; j++) {
            const nextMessage = this.messages[j];
            if (nextMessage.role == "user") {
              break;
            }
            removedIds.push(nextMessage.id);
          }
        }
        this.messages.splice(i, removedIds.length);
        break;
      }
    }
    return removedIds.length > 0 ? removedIds : undefined;
  }

  public getEstimatedTokens(calcSystemPrompt: boolean = true): number {
    let tokens = 0;
    if (calcSystemPrompt && this.systemPrompt) {
      tokens += this.calcTokens(this.systemPrompt);
    }
    return this.messages.reduce((total, message) => {
      const content =
        typeof message.content === "string"
          ? message.content
          : JSON.stringify(
              message.content.filter((part) => part.type != "file")
            );
      return total + this.calcTokens(content);
    }, tokens);
  }

  protected calcTokens(content: string): number {
    // Simple estimation: Each Chinese character is 1 token, other characters are counted as 1 token for every 4.
    const chineseCharCount = (content.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherCharCount = content.length - chineseCharCount;
    return chineseCharCount + Math.ceil(otherCharCount / 4);
  }

  public async updateConfig(config: Partial<MemoryConfig>): Promise<void> {
    if (config.maxMessageNum !== undefined) {
      this.memoryConfig.maxMessageNum = config.maxMessageNum;
    }
    if (config.maxInputTokens !== undefined) {
      this.memoryConfig.maxInputTokens = config.maxInputTokens;
    }
    if (config.enableCompression !== undefined) {
      this.memoryConfig.enableCompression = config.enableCompression;
    }
    if (config.compressionThreshold !== undefined) {
      this.memoryConfig.compressionThreshold = config.compressionThreshold;
    }
    if (config.compressionMaxLength !== undefined) {
      this.memoryConfig.compressionMaxLength = config.compressionMaxLength;
    }
    await this.manageCapacity();
  }

  /**
   * Manages memory capacity by enforcing limits and compressing content
   *
   * Applies multiple strategies to keep memory within configured bounds:
   * 1. **Message count pruning**: Remove oldest messages beyond maxMessageNum
   * 2. **Content compression**: Truncate long messages when compression enabled
   * 3. **Token limit enforcement**: Remove messages until under maxInputTokens
   * 4. **Conversation repair**: Fix any discontinuities caused by pruning
   *
   * @remarks
   * Compression targets:
   * - Assistant messages longer than compressionMaxLength
   * - Tool results exceeding size limits
   * - Preserves message structure while reducing content size
   */
  protected async manageCapacity(): Promise<void> {
    if (this.messages.length > this.memoryConfig.maxMessageNum) {
      const excess = this.messages.length - this.memoryConfig.maxMessageNum;
      this.messages.splice(0, excess);
    }
    if (
      this.memoryConfig.enableCompression &&
      this.messages.length > this.memoryConfig.compressionThreshold
    ) {
      // compress messages
      for (let i = 0; i < this.messages.length; i++) {
        const message = this.messages[i];
        if (message.role == "assistant") {
          message.content = message.content.map((part) => {
            if (
              part.type == "text" &&
              part.text.length > this.memoryConfig.compressionMaxLength
            ) {
              return {
                type: "text",
                text: sub(
                  part.text,
                  this.memoryConfig.compressionMaxLength,
                  true
                ),
              };
            }
            return part;
          });
        }
        if (message.role == "tool") {
          message.content = message.content.map((part) => {
            if (
              typeof part.result === "string" &&
              part.result.length > this.memoryConfig.compressionMaxLength
            ) {
              return {
                ...part,
                result: sub(
                  part.result,
                  this.memoryConfig.compressionMaxLength,
                  true
                ),
              };
            }
            return part;
          });
        }
      }
    }
    while (
      this.getEstimatedTokens(true) > this.memoryConfig.maxInputTokens &&
      this.messages.length > 0
    ) {
      this.messages.shift();
    }
    this.fixDiscontinuousMessages();
  }

  public fixDiscontinuousMessages() {
    if (this.messages.length > 0 && this.messages[0].role != "user") {
      for (let i = 0; i < this.messages.length; i++) {
        const message = this.messages[i];
        if (message.role == "user") {
          this.messages.splice(0, i);
          break;
        }
      }
    }
    const removeIds: string[] = [];
    let lastMessage: EkoMessage | null = null;
    for (let i = 0; i < this.messages.length; i++) {
      const message = this.messages[i];
      if (
        message.role == "user" &&
        lastMessage &&
        lastMessage.role == "user"
        // && message.content == lastMessage.content
      ) {
        // remove duplicate user messages
        removeIds.push(lastMessage.id);
        continue;
      }
      if (
        lastMessage &&
        lastMessage.role == "assistant" &&
        lastMessage.content.filter((part) => part.type == "tool-call").length >
          0 &&
        message.role != "tool"
      ) {
        // add tool result message
        this.messages.push({
          role: "tool",
          id: this.genMessageId(),
          timestamp: message.timestamp + 1,
          content: lastMessage.content
            .filter((part) => part.type == "tool-call")
            .map((part) => {
              return {
                type: "tool-result",
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                result: "Error: No result",
              };
            }),
        });
      }
      lastMessage = message;
    }
    if (removeIds.length > 0) {
      removeIds.forEach((id) => this.removeMessageById(id));
    }
  }

  public getFirstUserMessage(): EkoMessage | undefined {
    return this.messages.filter((message) => message.role === "user")[0];
  }

  public getLastUserMessage(): EkoMessage | undefined {
    const userMessages = this.messages.filter(
      (message) => message.role === "user"
    );
    return userMessages[userMessages.length - 1];
  }

  public hasMessage(id: string): boolean {
    return this.messages.some((message) => message.id === id);
  }

  public clear(): void {
    this.messages = [];
  }

  /**
   * Builds LLM-compatible message format from internal memory
   *
   * Converts Eko's internal message format to the standardized LLM prompt format
   * expected by AI SDK providers. Handles all message types including text, files,
   * tool calls, and tool results.
   *
   * @returns Complete prompt array ready for LLM consumption
   *
   * @remarks
   * Message conversion handles:
   * - **User messages**: Text and file content
   * - **Assistant messages**: Text, reasoning, and tool calls
   * - **Tool messages**: Tool execution results
   * - **System prompt**: Prepended to conversation
   * - **File handling**: Base64 data with proper MIME types
   */
  public buildMessages(): LanguageModelV2Prompt {
    const llmMessages: LanguageModelV2Message[] = [];
    for (let i = 0; i < this.messages.length; i++) {
      const message = this.messages[i];
      if (message.role == "user") {
        llmMessages.push({
          role: message.role,
          content:
            typeof message.content === "string"
              ? [
                  {
                    type: "text",
                    text: message.content,
                  },
                ]
              : message.content.map((part) => {
                  if (part.type == "text") {
                    return {
                      type: "text",
                      text: part.text,
                    };
                  } else {
                    return {
                      type: "file",
                      data: toFile(part.data),
                      mediaType: part.mimeType || getMimeType(part.data),
                    };
                  }
                }),
        });
      } else if (message.role == "assistant") {
        llmMessages.push({
          role: message.role,
          content: message.content.map((part) => {
            if (part.type == "text") {
              return {
                type: "text",
                text: part.text,
              };
            } else if (part.type == "reasoning") {
              return {
                type: "reasoning",
                text: part.text,
              };
            } else if (part.type == "tool-call") {
              return {
                type: "tool-call",
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                input: part.args as unknown,
              };
            } else {
              return part;
            }
          }),
        });
      } else if (message.role == "tool") {
        llmMessages.push({
          role: message.role,
          content: message.content.map((part) => {
            return {
              type: "tool-result",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              output:
                typeof part.result == "string"
                  ? {
                      type: "text",
                      value: part.result,
                    }
                  : {
                      type: "json",
                      value: part.result as any,
                    },
            };
          }),
        });
      }
    }
    return [
      {
        role: "system",
        content: this.getSystemPrompt() || "You are a helpful assistant.",
        providerOptions: defaultMessageProviderOptions(),
      },
      ...llmMessages,
    ];
  }
}
