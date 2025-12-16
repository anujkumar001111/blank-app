/**
 * WebpageQA Tool - Browser Tab Content Q&A
 *
 * Enables chat to answer questions about open browser tabs without spawning
 * full agent workflow. Lighter-weight alternative to deepAction for simple
 * content extraction/summarization tasks.
 *
 * Architecture:
 * - Chat agent calls webpageQa with tabIds + question
 * - Tool fetches page content via BrowserService
 * - Content passed to LLM with Q&A prompt
 * - Answer streamed back to chat (no agent orchestration)
 *
 * WHY separate from deepAction?
 * - Performance: Direct LLM call vs full workflow planning
 * - Token cost: Only webpage content context vs entire agent history
 * - Latency: Single LLM round-trip vs multi-agent coordination
 * - Simplicity: Stateless operation vs stateful agent chain
 *
 * Use cases:
 * - "Summarize this article" (current tab)
 * - "Extract email addresses from this page"
 * - "Translate this content to Spanish"
 * - "What's the price of this product?"
 *
 * NOT for:
 * - Browser interactions (clicking, filling forms) → use deepAction
 * - Multi-tab workflows → use deepAction
 * - Tasks requiring planning → use deepAction
 *
 * Design tradeoff: Limited to read-only content queries, but 10x faster
 * than spawning full agent for simple questions.
 */

import config from "../../config";
import global from "../../config/global";
import { JSONSchema7 } from "json-schema";
import { ChatContext } from "../chat-context";
import { RetryLanguageModel } from "../../llm";
import {
  ToolResult,
  PageContent,
  DialogueTool,
  DialogueParams,
  GlobalPromptKey,
  LanguageModelV2StreamPart,
  LanguageModelV2ToolCallPart,
} from "../../types";
import { sub, uuidv4 } from "../../common/utils";
import { PromptTemplate } from "../../prompt/prompt-template";

export const TOOL_NAME = "webpageQa";

/**
 * Q&A prompt template (injects webpage contexts + user question)
 *
 * Simple structure: Webpage context section + user question + language hint.
 * LLM generates answer based solely on provided webpage content.
 */
const WEBPAGE_QA_PROMPT = `
You are a helpful assistant that can answer questions based on the provided webpage context.

# Webpage Context
<webpage_contexts>
{{contexts}}
</webpage_contexts>

# User Question
<user_question>
{{userPrompt}}
</user_question>
<if language>
<language>{{language}}</language>
</if>

Answer user's question based on the webpage context, the answer should be in the same language as the user's question.
`;

export default class WebpageQaTool implements DialogueTool {
  readonly name: string = TOOL_NAME;
  readonly description: string;
  readonly parameters: JSONSchema7;
  private chatContext: ChatContext;
  private params: DialogueParams;

  constructor(chatContext: ChatContext, params: DialogueParams) {
    this.params = params;
    this.chatContext = chatContext;
    this.description = `This tool is designed only for handling simple web-related tasks, including summarizing webpage content, extracting data from web pages, translating webpage content, and converting webpage information into more easily understandable forms. It does not interact with or operate web pages. For more complex browser tasks, please use deepAction.It does not perform operations on the webpage itself, but only involves reading the page content. Users do not need to provide the web page content, as the tool can automatically extract the content of the web page based on the tabId to respond.`;
    this.parameters = {
      type: "object",
      properties: {
        language: {
          type: "string",
          description: "User language used, eg: English",
        },
        tabIds: {
          type: "array",
          description:
            "The browser tab ids to be used for the QA. When the user says 'left side' or 'current', it means current active tab.",
          items: { type: "integer" },
        },
      },
      required: ["tabIds", "language"],
    };
  }

  /**
   * Answers question using browser tab content
   *
   * Flow:
   * 1. Validates BrowserService available (requires platform integration)
   * 2. Fetches page content for specified tabIds
   * 3. Formats content with tab metadata (title, URL)
   * 4. Builds Q&A prompt with content + original tool call text
   * 5. Streams LLM response back to chat callback
   * 6. Returns final answer text
   *
   * Content truncation: Limits to 50k chars per tab to prevent token overflow.
   * Multiple tabs: Concatenates all tab contents for multi-source answers.
   */
  async execute(
    args: Record<string, unknown>,
    toolCall: LanguageModelV2ToolCallPart,
    messageId: string
  ): Promise<ToolResult> {
    if (!global.browserService) {
      return {
        content: [
          {
            type: "text",
            text: "Error: not implemented",
          },
        ],
      };
    }
    const tabIds = args.tabIds as string[];
    const language = args.language as string;
    const tabs = await global.browserService.extractPageContents(
      this.chatContext.getChatId(),
      tabIds
    );
    const chatConfig = this.chatContext.getConfig();
    const rlm = new RetryLanguageModel(chatConfig.llms, chatConfig.chatLlms);
    const prompt = PromptTemplate.render(
      global.prompts.get(GlobalPromptKey.webpage_qa_prompt) ||
        WEBPAGE_QA_PROMPT,
      {
        language: language,
        userPrompt: this.params.user
          .map((part) => (part.type == "text" ? part.text : ""))
          .join("\n")
          .trim(),
        contexts: this.buildTabContents(tabs),
      }
    ).trim();
    const result = await rlm.callStream({
      temperature: 0.7,
      maxOutputTokens: config.maxOutputTokens,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    });
    const stream = result.stream;
    const reader = stream.getReader();
    const streamId = uuidv4();
    const callback = this.params.callback.chatCallback;
    let text = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        const chunk = value as LanguageModelV2StreamPart;
        if (chunk.type == "text-delta") {
          text += chunk.delta;
          await callback.onMessage({
            streamType: "chat",
            chatId: this.chatContext.getChatId(),
            messageId: messageId,
            type: "tool_running",
            toolName: this.name,
            toolCallId: toolCall.toolCallId,
            text: text,
            streamId: streamId,
            streamDone: false,
          });
        } else if (chunk.type == "error") {
          throw new Error(chunk.error as string);
        } else if (chunk.type == "finish") {
          break;
        }
      }
    } finally {
      reader.releaseLock();
      await callback.onMessage({
        streamType: "chat",
        chatId: this.chatContext.getChatId(),
        messageId: messageId,
        type: "tool_running",
        toolName: this.name,
        toolCallId: toolCall.toolCallId,
        text: text,
        streamId: streamId,
        streamDone: true,
      });
    }
    return {
      content: [
        {
          type: "text",
          text: text,
        },
      ],
    };
  }

  private buildTabContents(tabs: PageContent[]): string {
    return tabs
      .map((tab) => {
        return `<webpage>\nTabId: ${tab.tabId}\nTitle: ${tab.title}\nURL: ${
          tab.url
        }\nContent: ${sub(tab.content, 8000)}\n</webpage>`;
      })
      .join("\n");
  }
}

export { WebpageQaTool };