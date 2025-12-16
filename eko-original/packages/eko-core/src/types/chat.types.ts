/**
 * Chat System Type Definitions
 *
 * Defines the conversational interface layer that sits above the core
 * agent system. Key distinction: Chat uses simplified message format
 * (EkoMessage) vs agent's raw LanguageModelV2Prompt for persistence/UI.
 *
 * Architecture:
 * - EkoMessage: User-facing format (stored in DB, sent to frontend)
 * - LanguageModelV2Prompt: LLM provider format (transient, in-memory)
 * - DialogueTool: Chat-aware tools (receive messageId for correlation)
 *
 * WHY separate chat types?
 * 1. Message persistence requires stable schema (EkoMessage)
 * 2. UI needs simplified format without provider-specific internals
 * 3. Chat tools need message correlation for multi-turn context
 * 4. Streaming requires chat-scoped events (chatId + messageId)
 *
 * Design choice: Chat layer wraps agent execution (ChatAgent → Eko),
 * providing conversational context while delegating task execution.
 */

import { ToolResult } from "./tools.types";
import { ReActStreamMessage } from "./llm.types";
import { JSONSchema7, LanguageModelV2ToolCallPart } from "@ai-sdk/provider";
import { EkoConfig, HumanCallback, AgentStreamCallback } from "./agent.types";

/**
 * Text content part in messages (user/assistant)
 */
export type MessageTextPart = {
  type: "text";
  text: string;
};

/**
 * File attachment part with metadata (supports images, PDFs, etc.)
 * data field contains base64 or URL for flexible storage/transfer
 */
export type MessageFilePart = {
  type: "file";
  fileId: string;
  filename?: string;
  mimeType: string;
  data: string; // base64 / URL
  filePath?: string;
};

/**
 * Tool invocation record (assistant's function call)
 */
export type ToolCallPart = {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  input: Record<string, any>;
};

/**
 * Tool execution result (system's function response)
 */
export type ToolResultPart = {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  isError: boolean;
  output: string | Record<string, any>;
};

/**
 * Chat streaming event (extends ReActStreamMessage with chat context)
 *
 * Includes: chat_start/chat_end events + all ReAct streaming events
 * (text_delta, tool_call, tool_result, etc.)
 *
 * WHY chat-specific events? Frontend needs chatId+messageId correlation
 * for multi-session UIs (e.g., Slack, Discord bots).
 */
export type ChatStreamMessage = {
  streamType: "chat";
  chatId: string;
  messageId: string;
} & (
  | {
      type: "chat_start";
    }
  | ReActStreamMessage
  | {
      type: "chat_end";
      error: string | null;
      duration: number;
      reactLoopNum: number;
    }
);

/**
 * Dual-layer streaming callback for chat + nested task execution
 *
 * chatCallback: Chat-level events (user message → assistant response)
 * taskCallback: Task-level events (when deepAction tool spawns agent)
 *
 * Design: Chat can delegate to full agent workflows, requiring nested
 * progress tracking (e.g., "Searching web" → "Planning subtasks" → ...).
 */
export interface ChatStreamCallback {
  chatCallback: {
    onMessage: (message: ChatStreamMessage) => Promise<void>;
  };
  taskCallback?: AgentStreamCallback & HumanCallback;
}

/**
 * Persistent chat message format (stored in DB, sent to frontend)
 *
 * Structure mirrors OpenAI format but simplified for storage:
 * - User: text + optional file attachments
 * - Assistant: text + tool calls + reasoning (if o1/o3 models)
 * - Tool: function execution results
 *
 * WHY persistent format? Chat history must survive browser restarts,
 * require stable schema for DB queries, and optimize for UI rendering.
 */
export type EkoMessage = { id: string } & (
  | {
      role: "user";
      content: string | EkoMessageUserPart[];
    }
  | {
      role: "assistant";
      content: EkoMessageAssistantPart[];
    }
  | {
      role: "tool";
      content: EkoMessageToolPart[];
    }
) & {
    timestamp: number;
    extra?: Record<string, any>;
  };

export type EkoMessageUserPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "file";
      mimeType: string;
      data: string; // base64 / URL
    };

export type EkoMessageAssistantPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "reasoning";
      text: string;
    }
  | {
      type: "tool-call";
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
    };

export type EkoMessageToolPart = {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  result: string | Record<string, unknown>;
};

/**
 * Chat-specific tool interface (extends Tool with message correlation)
 *
 * Key difference from Tool: execute() receives messageId for tracing
 * which user message triggered the tool (enables conversation threading).
 *
 * Example: deepAction tool creates Eko instance, links it to messageId
 * for later retrieval (user can ask "what's the status of my last task?").
 */
export interface DialogueTool {
  readonly name: string;
  readonly description?: string;
  readonly parameters: JSONSchema7;
  execute: (
    args: Record<string, unknown>,
    toolCall: LanguageModelV2ToolCallPart,
    messageId: string
  ) => Promise<ToolResult>;
}

/**
 * Chat-specific configuration (extends EkoConfig with chat LLM override)
 *
 * chatLlms: Separate LLM pool for conversational responses (e.g., use
 * faster models like gpt-4o-mini for chat, reserve Claude for deep tasks).
 */
export type EkoDialogueConfig = Omit<EkoConfig, "callback"> & {
  chatLlms?: string[];
};

/**
 * Single chat message invocation parameters
 *
 * messageId: Client-provided ID for correlation (idempotency + tracking)
 * datetime: Optional timestamp override for prompt context
 * extra: Extension point for custom metadata (e.g., user preferences)
 */
export type DialogueParams = {
  messageId: string;
  user: Array<MessageTextPart | MessageFilePart>;
  callback: ChatStreamCallback;
  datetime?: string;
  signal?: AbortSignal;
  extra?: Record<string, any>;
};
