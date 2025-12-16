import { PageTab, PageContent } from "../types";

/**
 * Browser Service Interface - Web page interaction and content extraction
 *
 * Defines the contract for services that manage browser tabs, navigate web pages,
 * and extract structured content from web resources. Enables agents to interact
 * with web applications and consume online content.
 *
 * ## Responsibilities
 *
 * - **Tab Management**: Track and manage browser tabs across sessions
 * - **Content Extraction**: Retrieve structured data from web pages
 * - **Navigation**: Handle page loading and state management
 *
 * ## Implementation Patterns
 *
 * Services can be implemented for different browser environments:
 * - **Extension**: Chrome/Firefox extension APIs
 * - **Puppeteer/Playwright**: Headless browser automation
 * - **Web**: Limited to same-origin content via DOM APIs
 * - **Electron**: Full browser control with Node.js integration
 *
 * ## Content Types
 *
 * Services extract various content representations:
 * - **HTML**: Raw page markup
 * - **Text**: Readable text content
 * - **Structured**: Parsed elements, forms, links
 * - **Screenshots**: Visual page representations
 *
 * @example
 * ```typescript
 * class PuppeteerBrowserService implements BrowserService {
 *   async loadTabs(chatId: string): Promise<PageTab[]> {
 *     // Return currently open browser tabs
 *     return await this.browser.pages().map(page => ({
 *       id: page.target()._targetId,
 *       url: page.url(),
 *       title: await page.title()
 *     }));
 *   }
 *
 *   async extractPageContents(chatId: string, tabIds: string[]): Promise<PageContent[]> {
 *     // Extract content from specified tabs
 *     return await Promise.all(tabIds.map(id => this.extractFromTab(id)));
 *   }
 * }
 * ```
 */
export default interface BrowserService {
  /**
   * Loads browser tab information for a chat session
   *
   * Retrieves metadata about currently open or previously accessed browser tabs,
   * enabling agents to work with web content across sessions.
   *
   * @param chatId - Chat session identifier for tab association
   * @param tabIds - Optional array of specific tab IDs to load (loads all if undefined)
   * @returns Array of tab metadata including URLs, titles, and identifiers
   */
  loadTabs(chatId: string, tabIds?: string[] | undefined): Promise<PageTab[]>;

  /**
   * Extracts structured content from specified browser tabs
   *
   * Retrieves comprehensive content from web pages including text, HTML,
   * structured data, and metadata for agent processing and analysis.
   *
   * @param chatId - Chat session context for the extraction
   * @param tabIds - Array of tab identifiers to extract content from
   * @returns Array of page content objects with structured data
   *
   * @remarks
   * Content extraction may include:
   * - Visible text content
   * - HTML document structure
   * - Form elements and inputs
   * - Links and navigation elements
   * - Images and media references
   * - Page metadata (title, description, etc.)
   */
  extractPageContents(chatId: string, tabIds: string[]): Promise<PageContent[]>;
}

export type { BrowserService };
