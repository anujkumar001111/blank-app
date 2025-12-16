import { EkoMessage, WebSearchResult } from "../types";

/**
 * Chat Service Interface - Conversation and knowledge management
 *
 * Defines the contract for services that handle conversational interactions,
 * message persistence, file uploads, and external knowledge retrieval.
 * Implementations can range from local storage to cloud-based solutions.
 *
 * ## Responsibilities
 *
 * - **Message Management**: Store and retrieve conversation history
 * - **Memory Integration**: Provide context-aware memory recall
 * - **File Handling**: Upload and manage files in conversations
 * - **Web Search**: Access external knowledge sources
 *
 * ## Implementation Patterns
 *
 * Services can be implemented for different platforms:
 * - **Web**: Browser localStorage, IndexedDB, or server APIs
 * - **Desktop**: File system storage or embedded databases
 * - **Cloud**: Remote APIs with user accounts and sharing
 *
 * @example
 * ```typescript
 * class LocalChatService implements ChatService {
 *   async loadMessages(chatId: string): Promise<EkoMessage[]> {
 *     // Load from local storage
 *     return JSON.parse(localStorage.getItem(`chat_${chatId}`) || '[]');
 *   }
 *
 *   async websearch(chatId: string, query: string): Promise<WebSearchResult[]> {
 *     // Implement web search using preferred provider
 *     return await searchApi.search(query);
 *   }
 * }
 * ```
 */
export default interface ChatService {
  /**
   * Loads conversation history for a specific chat session
   *
   * Retrieves all messages associated with a chat ID, enabling conversation
   * continuity and context-aware interactions.
   *
   * @param chatId - Unique identifier for the chat session
   * @returns Array of messages in chronological order
   */
  loadMessages(chatId: string): Promise<EkoMessage[]>;

  /**
   * Adds new messages to a chat conversation
   *
   * Persists message data for future retrieval and maintains conversation state.
   * Messages can include user inputs, agent responses, and system notifications.
   *
   * @param chatId - Target chat session identifier
   * @param messages - Array of messages to add to the conversation
   */
  addMessage(chatId: string, messages: EkoMessage[]): Promise<void>;

  /**
   * Performs context-aware memory recall for enhanced responses
   *
   * Searches conversation history and stored knowledge to provide relevant
   * context for the current interaction, improving agent responses.
   *
   * @param chatId - Chat session to search for relevant memories
   * @param prompt - Current user prompt to find related context for
   * @returns Relevant context string from conversation history or knowledge base
   */
  memoryRecall(chatId: string, prompt: string): Promise<string>;

  /**
   * Uploads and stores files for use in conversations
   *
   * Handles file uploads from various sources, providing accessible URLs
   * for agents to reference and process file content.
   *
   * @param file - File object or base64-encoded file data
   * @param chatId - Chat session to associate the file with
   * @param taskId - Optional task identifier for file organization
   * @returns File metadata including unique ID and access URL
   */
  uploadFile(
    file: File | { base64Data: string; mimeType: string; filename: string },
    chatId: string,
    taskId?: string | undefined // messageId
  ): Promise<{
    fileId: string;
    url: string;
  }>;

  /**
   * Performs web search to gather external information
   *
   * Queries web search engines or knowledge sources to provide current
   * and comprehensive information for agent responses.
   *
   * @param chatId - Chat session context for the search
   * @param query - Search query string
   * @param site - Optional domain restriction (e.g., "wikipedia.org")
   * @param language - Optional language code for localized results
   * @param maxResults - Maximum number of results to return (default: service-specific)
   * @returns Array of search results with titles, snippets, and URLs
   */
  websearch(
    chatId: string,
    query: string,
    site?: string,
    language?: string,
    maxResults?: number
  ): Promise<WebSearchResult[]>;
}

export type { ChatService };
