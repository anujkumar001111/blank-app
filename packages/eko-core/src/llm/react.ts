/**
 * @fileoverview ReAct (Reasoning + Acting) pattern implementation for LLM agents.
 * 
 * Implements the think-act-observe loop:
 * 1. Agent reasons about current state and decides on actions (tools to call)
 * 2. Tools execute and return results
 * 3. Results appended to conversation, agent reasons about outcomes
 * 4. Loop continues until agent decides task is complete or max iterations hit
 * 
 * PAPER: "ReAct: Synergizing Reasoning and Acting in Language Models" (Yao et al.)
 * 
 * @module llm/react
 */

import {
  LLMRequest,
  ReActLoopControl,
  ReActErrorHandler,
  ReActFinishHandler,
  ReActStreamMessage,
  ReActStreamCallback,
  ReActToolCallCallback,
  LanguageModelV2TextPart,
  LanguageModelV2ToolCallPart,
} from "../types";
import config from "../config";
import Log from "../common/log";
import { RetryLanguageModel } from ".";
import { sleep, uuidv4 } from "../common/utils";
import { LanguageModelV2StreamPart } from "@ai-sdk/provider";

/**
 * Orchestrates ReAct loop: LLM call → tool execution → repeat until done.
 * 
 * WHY: Agents need multi-step reasoning to complete complex tasks. Single LLM
 * calls can't handle "book flight, then email confirmation" - requires loop:
 * - Call LLM: decides to search flights (tool call)
 * - Execute search_flights tool, return results
 * - Call LLM again: decides to book specific flight (tool call)
 * - Execute book_flight tool, return confirmation
 * - Call LLM again: decides to email (tool call)
 * - Execute send_email tool
 * - Call LLM again: sees task complete, returns text instead of tool calls
 * - Loop exits
 * 
 * @param rlm - Retry-enabled LLM client (handles provider failover)
 * @param request - Initial request with system/user messages and tool definitions
 * @param toolCallCallback - Executes tool calls, returns results to append
 * @param streamCallback - Optional streaming callback for real-time updates
 * @param errorHandler - Optional error handler for retry logic customization
 * @param finishHandler - Optional finish handler (can trigger retry on bad output)
 * @param loopControl - Optional function to decide if loop should continue
 *                      Default: stop after 15 iterations or when no tool calls
 * 
 * @returns Final assistant message parts (text + tool calls from last iteration)
 */
export async function callWithReAct(
  rlm: RetryLanguageModel,
  request: LLMRequest,
  toolCallCallback: ReActToolCallCallback,
  streamCallback?: ReActStreamCallback,
  errorHandler?: ReActErrorHandler,
  finishHandler?: ReActFinishHandler,
  loopControl?: ReActLoopControl
): Promise<Array<LanguageModelV2TextPart | LanguageModelV2ToolCallPart>> {
  if (!loopControl) {
    // Default: continue if tools were called AND under 15 iterations
    loopControl = async (request, assistantParts, loopNum) => {
      if (loopNum >= 15) {
        return false;
      }
      return assistantParts.filter((s) => s.type == "tool-call").length > 0;
    };
  }
  let loopNum = 0;
  let assistantParts: Array<
    LanguageModelV2TextPart | LanguageModelV2ToolCallPart
  > | null = null;
  while (true) {
    // Step 1: Call LLM with current conversation context
    assistantParts = await callLLM(
      rlm,
      request,
      streamCallback,
      errorHandler,
      finishHandler
    );
    // Step 2: Append assistant's response to conversation
    if (assistantParts.length > 0) {
      request.messages.push({
        role: "assistant",
        content: assistantParts
          .filter((part) => part.type == "text" || part.type == "tool-call")
          .map((part) =>
            part.type === "text"
              ? {
                  type: "text",
                  text: part.text,
                }
              : {
                  type: "tool-call",
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                  input: JSON.parse((part.input || "{}") as string),
                }
          ),
      });
    }
    // Step 3: Check if loop should continue (default: stop if no tool calls)
    const continueLoop = await loopControl(request, assistantParts, loopNum);
    if (!continueLoop) {
      break;
    }
    // Step 4: Execute tool calls and append results to conversation
    const toolUses = assistantParts.filter((s) => s.type == "tool-call");
    const toolResults = await toolCallCallback(request, toolUses);
    if (toolResults.length > 0) {
      request.messages.push({
        role: "tool",
        content: toolResults.map((result, index) => ({
          type: "tool-result",
          toolCallId: toolUses[index].toolCallId,
          toolName: toolUses[index].toolName,
          output: result,
        })),
      });
    }
    loopNum++;
  }
  return assistantParts;
}

/**
 * Executes single LLM call with streaming support and automatic retry.
 * 
 * WHY: Raw LLM API streaming is complex (SSE parsing, chunked JSON, error
 * handling, timeout detection). This function:
 * - Consumes AI SDK streaming response chunk-by-chunk
 * - Normalizes different chunk types (text-delta, tool-call, reasoning)
 * - Aggregates partial JSON for tool arguments
 * - Calls streamCallback for real-time UI updates
 * - Retries on transient errors (network, rate limits)
 * - Returns final aggregated message parts
 * 
 * STREAM CHUNK TYPES:
 * - text-delta: Partial response text (aggregate before displaying)
 * - reasoning-delta: OpenAI O1 thinking tokens (stream separately)
 * - tool-call: Complete tool invocation with parsed args
 * - file: Binary data (images from vision models)
 * - finish: Stream complete with token usage stats
 * - error: Failure (trigger retry or fail)
 * 
 * @param rlm - Retry-enabled LLM client
 * @param request - Message history + tool definitions
 * @param streamCallback - Called for each chunk (optional, for UI updates)
 * @param errorHandler - Called before retry (optional, for logging/telemetry)
 * @param finishHandler - Called on completion (can return "retry" to redo call)
 * @param retryNum - Current retry attempt (used for exponential backoff)
 * 
 * @returns Array of text parts and tool call parts from final response
 */
export async function callLLM(
  rlm: RetryLanguageModel,
  request: LLMRequest,
  streamCallback?: ReActStreamCallback,
  errorHandler?: ReActErrorHandler,
  finishHandler?: ReActFinishHandler,
  retryNum: number = 0
): Promise<Array<LanguageModelV2TextPart | LanguageModelV2ToolCallPart>> {
  let streamText = "";
  let thinkText = "";
  let toolArgsText = "";
  let textStreamId = uuidv4();
  let thinkStreamId = uuidv4();
  let textStreamDone = false;
  const toolParts: LanguageModelV2ToolCallPart[] = [];
  let reader: ReadableStreamDefaultReader<LanguageModelV2StreamPart> | null =
    null;
  try {
    const result = await rlm.callStream(request);
    reader = result.stream.getReader();
    let toolPart: LanguageModelV2ToolCallPart | null = null;
    // Main streaming loop: read chunks until done
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = value as LanguageModelV2StreamPart;
      switch (chunk.type) {
        case "text-start": {
          textStreamId = uuidv4();
          break;
        }
        case "text-delta": {
          // Some models emit empty deltas when transitioning to tool calls
          if (toolPart && !chunk.delta) {
            continue;
          }
          streamText += chunk.delta || "";
          await streamCallback?.({
            type: "text",
            streamId: textStreamId,
            streamDone: false,
            text: streamText,
          });
          // If we had a pending tool part, flush it now (text came first)
          if (toolPart) {
            await streamCallback?.({
              type: "tool_use",
              toolCallId: toolPart.toolCallId,
              toolName: toolPart.toolName,
              params: toolPart.input || {},
            });
            toolPart = null;
          }
          break;
        }
        case "text-end": {
          textStreamDone = true;
          if (streamText) {
            await streamCallback?.({
              type: "text",
              streamId: textStreamId,
              streamDone: true,
              text: streamText,
            });
          }
          break;
        }
        case "reasoning-start": {
          thinkStreamId = uuidv4();
          break;
        }
        case "reasoning-delta": {
          // OpenAI O1 models expose reasoning tokens separately
          thinkText += chunk.delta || "";
          await streamCallback?.({
            type: "thinking",
            streamId: thinkStreamId,
            streamDone: false,
            text: thinkText,
          });
          break;
        }
        case "reasoning-end": {
          if (thinkText) {
            await streamCallback?.({
              type: "thinking",
              streamId: thinkStreamId,
              streamDone: true,
              text: thinkText,
            });
          }
          break;
        }
        case "tool-input-start": {
          // Tool call initiated - create or update part
          if (toolPart && toolPart.toolCallId == chunk.id) {
            toolPart.toolName = chunk.toolName;
          } else {
            const _toolPart = toolParts.filter(
              (s) => s.toolCallId == chunk.id
            )[0];
            if (_toolPart) {
              toolPart = _toolPart;
              toolPart.toolName = _toolPart.toolName || chunk.toolName;
              toolPart.input = _toolPart.input || {};
            } else {
              toolPart = {
                type: "tool-call",
                toolCallId: chunk.id,
                toolName: chunk.toolName,
                input: {},
              };
              toolParts.push(toolPart);
            }
          }
          break;
        }
        case "tool-input-delta": {
          // Streaming tool arguments as JSON chunks
          if (!textStreamDone) {
            textStreamDone = true;
            await streamCallback?.({
              type: "text",
              streamId: textStreamId,
              streamDone: true,
              text: streamText,
            });
          }
          toolArgsText += chunk.delta || "";
          await streamCallback?.({
            type: "tool_streaming",
            toolCallId: chunk.id,
            toolName: toolPart?.toolName || "",
            paramsText: toolArgsText,
          });
          break;
        }
        case "tool-call": {
          // Complete tool call with full parsed arguments
          toolArgsText = "";
          const args = chunk.input ? JSON.parse(chunk.input) : {};
          const message: ReActStreamMessage = {
            type: "tool_use",
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            params: args,
          };
          await streamCallback?.(message);
          if (toolPart == null) {
            const _toolPart = toolParts.filter(
              (s) => s.toolCallId == chunk.toolCallId
            )[0];
            if (_toolPart) {
              _toolPart.input = message.params || args;
            } else {
              toolParts.push({
                type: "tool-call",
                toolCallId: chunk.toolCallId,
                toolName: chunk.toolName,
                input: message.params || args,
              });
            }
          } else {
            toolPart.input = message.params || args;
            toolPart = null;
          }
          break;
        }
        case "file": {
          // Vision models can return images
          await streamCallback?.({
            type: "file",
            mimeType: chunk.mediaType,
            data: chunk.data as string,
          });
          break;
        }
        case "error": {
          Log.error(`chatLLM error: `, chunk);
          await streamCallback?.({
            type: "error",
            error: chunk.error,
          });
          throw new Error("LLM Error: " + chunk.error);
        }
        case "finish": {
          // Stream completed - finalize any pending parts
          if (!textStreamDone) {
            textStreamDone = true;
            await streamCallback?.({
              type: "text",
              streamId: textStreamId,
              streamDone: true,
              text: streamText,
            });
          }
          if (toolPart) {
            await streamCallback?.({
              type: "tool_use",
              toolCallId: toolPart.toolCallId,
              toolName: toolPart.toolName,
              params: toolPart.input || {},
            });
            toolPart = null;
          }
          // Allow finishHandler to trigger retry (e.g., for refusal detection)
          if (finishHandler) {
            const type = await finishHandler(
              request,
              chunk.finishReason,
              chunk,
              retryNum
            );
            if (type == "retry") {
              await sleep(200 * (retryNum + 1) * (retryNum + 1));
              return callLLM(
                rlm,
                request,
                streamCallback,
                errorHandler,
                finishHandler,
                ++retryNum
              );
            }
          }
          await streamCallback?.({
            type: "finish",
            finishReason: chunk.finishReason,
            usage: {
              promptTokens: chunk.usage.inputTokens || 0,
              completionTokens: chunk.usage.outputTokens || 0,
              totalTokens:
                chunk.usage.totalTokens ||
                (chunk.usage.inputTokens || 0) +
                  (chunk.usage.outputTokens || 0),
            },
          });
          break;
        }
      }
    }
  } catch (e: any) {
    // Exponential backoff retry on transient errors
    if (retryNum < config.maxRetryNum) {
      await sleep(200 * (retryNum + 1) * (retryNum + 1));
      if (errorHandler) {
        await errorHandler(request, e, retryNum);
      }
      return callLLM(
        rlm,
        request,
        streamCallback,
        errorHandler,
        finishHandler,
        ++retryNum
      );
    }
    throw e;
  } finally {
    reader && reader.releaseLock();
  }
  return streamText
    ? [
        { type: "text", text: streamText } as LanguageModelV2TextPart,
        ...toolParts,
      ]
    : toolParts;
}
