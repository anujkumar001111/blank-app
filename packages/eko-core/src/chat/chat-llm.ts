/**
 * Chat-Specific LLM Wrappers and Message Format Converters
 *
 * Utility functions bridging chat layer (EkoMessage) and LLM layer
 * (LanguageModelV2Prompt). Handles format conversion for persistence.
 *
 * Key functions:
 * - callChatLLM: Wraps core LLM call with chat streaming events
 * - convertAssistantToolResults: LLM format → EkoMessage format
 * - convertToolResults: Tool result format conversion
 * - convertUserContent: User message part normalization
 *
 * WHY separate converters? Chat persistence requires stable schema
 * independent of LLM provider formats (OpenAI vs Anthropic vs Cohere).
 */

import {
  LanguageModelV2FilePart,
  LanguageModelV2ToolResultPart,
} from "@ai-sdk/provider";
import {
  LLMRequest,
  ChatStreamCallback,
  EkoMessageToolPart,
  EkoMessageUserPart,
  LanguageModelV2Prompt,
  EkoMessageAssistantPart,
  LanguageModelV2TextPart,
  LanguageModelV2ToolChoice,
  LanguageModelV2ToolCallPart,
  LanguageModelV2FunctionTool,
} from "../types";
import { RetryLanguageModel, callLLM } from "../llm";

/**
 * Executes chat LLM call with streaming and chat-scoped event wrapping
 *
 * Wraps core callLLM with chatId+messageId injection for frontend
 * correlation. Returns text + tool calls for ReAct loop processing.
 */
export async function callChatLLM(
  chatId: string,
  messageId: string,
  rlm: RetryLanguageModel,
  messages: LanguageModelV2Prompt,
  tools: LanguageModelV2FunctionTool[],
  toolChoice?: LanguageModelV2ToolChoice,
  callback?: ChatStreamCallback,
  signal?: AbortSignal
): Promise<Array<LanguageModelV2TextPart | LanguageModelV2ToolCallPart>> {
  const streamCallback = callback?.chatCallback || {
    onMessage: async () => {},
  };
  const request: LLMRequest = {
    tools,
    messages,
    toolChoice,
    abortSignal: signal,
  };
  return await callLLM(rlm, request, async (message) => {
    await streamCallback.onMessage({
      streamType: "chat",
      chatId,
      messageId,
      ...message,
    });
  });
}

/**
 * Converts LLM assistant response to persistent EkoMessage format
 *
 * Handles text parts and tool calls, normalizing provider-specific
 * formats to stable storage schema.
 */
export function convertAssistantToolResults(
  results: Array<LanguageModelV2TextPart | LanguageModelV2ToolCallPart>
): EkoMessageAssistantPart[] {
  return results.map((part) => {
    if (part.type == "text") {
      return {
        type: "text",
        text: part.text,
      };
    } else if (part.type == "tool-call") {
      return {
        type: "tool-call",
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        args: (part.input || {}) as any,
      };
    }
    return part;
  });
}

/**
 * Converts tool execution results to EkoMessage format
 *
 * Handles multiple result types: text, JSON, media (images/files).
 * Normalizes to string representation for storage/display.
 */
export function convertToolResults(
  toolResults: LanguageModelV2ToolResultPart[]
): EkoMessageToolPart[] {
  return toolResults.map((part) => {
    const output = part.output;
    return {
      type: "tool-result",
      toolCallId: part.toolCallId,
      toolName: part.toolName,
      result:
        output.type == "text" || output.type == "error-text"
          ? output.value
          : output.type == "json" || output.type == "error-json"
          ? (output.value as any)
          : output.value
              .map((s) => {
                if (s.type == "text") {
                  return s.text;
                } else if (s.type == "media") {
                  return JSON.stringify({
                    data: s.data,
                    mimeType: s.mediaType,
                  });
                }
              })
              .join("\n"),
    };
  });
}

/**
 * Converts user message parts to EkoMessage format
 *
 * Simplifies LLM provider format (LanguageModelV2FilePart with complex
 * metadata) to storage-friendly format (base64 data + mimeType only).
 */
export function convertUserContent(
  content: Array<LanguageModelV2TextPart | LanguageModelV2FilePart>
): EkoMessageUserPart[] {
  return content.map((part) => {
    if (part.type == "text") {
      return {
        type: "text",
        text: part.text,
      };
    } else if (part.type == "file") {
      return {
        type: "file",
        mimeType: part.mediaType,
        data: part.data + "",
      };
    }
    return part;
  });
}
