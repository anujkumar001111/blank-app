/**
 * WebSearch Tool - Live Internet Search Integration
 *
 * Enables chat to access real-time information from web search APIs.
 * Critical for queries requiring current data beyond LLM training cutoff.
 *
 * Architecture:
 * - Chat agent calls webSearch with query string
 * - Tool delegates to ChatService.websearch() implementation
 * - Service queries search API (Google, Bing, DuckDuckGo, etc.)
 * - Results formatted as JSON array (title, URL, snippet)
 * - Chat agent synthesizes answer from search results
 *
 * WHY separate tool vs built-in?
 * - Service abstraction: Different platforms use different search APIs
 * - Cost control: Search API calls may be metered/paid
 * - Rate limiting: Service handles throttling and retries
 * - Caching: Service can cache recent searches
 *
 * Use cases:
 * - "What's the weather in Tokyo today?"
 * - "Latest news about AI regulations"
 * - "Find Python libraries for image processing"
 * - "Compare prices for iPhone 15"
 *
 * Design distinction from webpageQa:
 * - webSearch: Finds relevant pages on internet
 * - webpageQa: Analyzes specific page already open in browser
 *
 * Typical flow:
 * 1. User: "What's trending on Twitter?"
 * 2. Chat calls webSearch("Twitter trending topics")
 * 3. Service returns top 10 search results
 * 4. Chat synthesizes: "According to search results, top trends are..."
 */

import { JSONSchema7 } from "json-schema";
import global from "../../config/global";
import { sub } from "../../common/utils";
import { ChatContext } from "../chat-context";
import { DialogueParams, DialogueTool, ToolResult } from "../../types";

export const TOOL_NAME = "webSearch";

export default class WebSearchTool implements DialogueTool {
  readonly name: string = TOOL_NAME;
  readonly description: string;
  readonly parameters: JSONSchema7;
  private chatContext: ChatContext;
  private params: DialogueParams;

  constructor(chatContext: ChatContext, params: DialogueParams) {
    this.params = params;
    this.chatContext = chatContext;
    this.description = `Search the web for information using search engine API. This tool can perform web searches to find current information, news, articles, and other web content related to the query. It returns search results with titles, descriptions, URLs, and other relevant metadata, use this tool when users need the latest data/information and have NOT specified a particular platform or website, use the search tool.`;
    this.parameters = {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The search query to execute. Use specific keywords and phrases for better results.",
        },
        language: {
          type: "string",
          description:
            "Language code for search results (e.g., 'en', 'zh', 'ja'). If not specified, will be auto-detected from query.",
        },
        count: {
          type: "integer",
          description:
            "Number of search results to return (default: 10, max: 50)",
          default: 10,
          minimum: 1,
          maximum: 50,
        },
      },
      required: ["query"],
    };
  }

  /**
   * Executes web search via ChatService
   *
   * Flow:
   * 1. Validates ChatService available (requires implementation)
   * 2. Extracts query, language, count from args
   * 3. Calls service.websearch() with parameters
   * 4. Formats results: title, URL, content (truncated to 6k chars)
   * 5. Returns JSON array for chat agent to synthesize answer
   *
   * Error handling: Returns "not implemented" if no ChatService configured.
   * Content truncation: Prevents token overflow from long article snippets.
   */
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    if (!global.chatService) {
      return {
        content: [
          {
            type: "text",
            text: "Error: not implemented",
          },
        ],
      };
    }
    const query = args.query as string;
    const language = args.language as string;
    const count = (args.count as number) || 10;
    const results = await global.chatService.websearch(
      this.chatContext.getChatId(),
      query,
      undefined,
      language,
      count
    );
    return Promise.resolve({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            results.map((result) => {
              return {
                title: result.title,
                url: result.url,
                content: sub(result.content || result.snippet || "", 6000),
              };
            })
          ),
        },
      ],
    });
  }
}

export { WebSearchTool };