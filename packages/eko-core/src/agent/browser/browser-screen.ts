/**
 * Pure Vision-Based Browser Agent (Coordinate-Only Interaction)
 *
 * Simplified browser automation using raw screenshot + (x,y) coordinates.
 * Contrasts with BaseBrowserLabelsAgent's hybrid DOM+vision approach.
 *
 * Key difference: No element indexing, no DOM extraction, no labeled boxes.
 * LLM receives only screenshot and must reason spatially to determine click
 * coordinates (mimics pure computer vision agents like Anthropic Computer Use).
 *
 * Tool set:
 * - Coordinate-based: click(x,y), move_to(x,y), drag_and_drop(x1,y1,x2,y2)
 * - Keyboard: typing(text), press(key), hotkey(combo)
 * - Navigation: navigate_to, go_back, switch_tab
 * - Content: extract_page_content (text extraction without DOM)
 *
 * WHY coordinate-only mode?
 * - Pro: Simpler architecture (no DOM injection scripts)
 * - Pro: Works with any visual UI (games, canvas apps, desktop apps via screen share)
 * - Con: LLM vision less precise than labeled elements (OCR ambiguity)
 * - Con: Requires vision models with spatial reasoning (GPT-4V, Claude 3+)
 *
 * Use cases:
 * - Applications where DOM access unavailable (Electron webviews, embedded browsers)
 * - Testing vision model capabilities in pure computer vision mode
 * - Fallback when element labeling fails (heavy JavaScript obfuscation)
 *
 * Design choice: Abstract methods delegate platform-specific implementations
 * (Playwright, Puppeteer, Selenium) to concrete subclasses. This class
 * defines tool contracts only.
 */

import { BaseBrowserAgent, AGENT_NAME } from "./browser-base";
import { AgentContext } from "../agent-context";
import { LanguageModelV2Prompt } from "@ai-sdk/provider";
import { Tool, ToolResult, IMcpClient } from "../../types";
import { mergeTools, sleep, toImage } from "../../common/utils";

export default abstract class BaseBrowserScreenAgent extends BaseBrowserAgent {
  constructor(llms?: string[], ext_tools?: Tool[], mcpClient?: IMcpClient) {
    const description = `You are a browser operation agent, use a mouse and keyboard to interact with a browser.
* This is a browser GUI interface, observe the webpage execution through screenshots, and specify action sequences to complete designated tasks.
* For the first visit, please call the \`navigate_to\` or \`current_page\` tool first. After that, each of your actions will return a screenshot of the page.
* BROWSER OPERATIONS:
  - Navigate to URLs and manage history
  - Fill forms and submit data
  - Click elements and interact with pages
  - Extract text and HTML content
  - Wait for elements to load
  - Scroll pages and handle infinite scroll
  - YOU CAN DO ANYTHING ON THE BROWSER - including clicking on elements, filling forms, submitting data, etc.`;
    const _tools_ = [] as Tool[];
    super({
      name: AGENT_NAME,
      description: description,
      tools: _tools_,
      llms: llms,
      mcpClient: mcpClient,
      planDescription:
        "Browser operation agent, interact with the browser using the mouse and keyboard.",
    });
    let init_tools = this.buildInitTools();
    if (ext_tools && ext_tools.length > 0) {
      init_tools = mergeTools(init_tools, ext_tools);
    }
    init_tools.forEach((tool) => _tools_.push(tool));
  }

  /**
   * Platform-specific text input (abstract contract)
   *
   * Implementation must focus current input element and type text
   * character-by-character (simulates human typing vs instant setValue).
   */
  protected abstract typing(
    agentContext: AgentContext,
    text: string
  ): Promise<void>;

  /**
   * Platform-specific mouse click at coordinates (abstract contract)
   *
   * Must support: left/right/middle buttons, single/double/triple clicks.
   * Coordinates relative to viewport top-left (0,0).
   */
  protected abstract click(
    agentContext: AgentContext,
    x: number,
    y: number,
    num_clicks: number,
    button_type: "left" | "right" | "middle"
  ): Promise<void>;

  /**
   * Platform-specific scroll at current position (abstract contract)
   *
   * Amount: positive = down, negative = up (matches wheel delta convention).
   */
  protected abstract scroll(
    agentContext: AgentContext,
    amount: number
  ): Promise<void>;

  /**
   * Platform-specific mouse movement to coordinates (abstract contract)
   *
   * Use case: Hovering to reveal tooltips/dropdowns without clicking.
   */
  protected abstract move_to(
    agentContext: AgentContext,
    x: number,
    y: number
  ): Promise<void>;

  /**
   * Platform-specific special key press (abstract contract)
   *
   * Supports: Enter, Tab, arrows, function keys, etc. (see SpecialKey enum).
   */
  protected abstract press(
    agentContext: AgentContext,
    key: import("../../types/keyboard.types").SpecialKey
  ): Promise<void>;

  /**
   * Platform-specific keyboard shortcut (abstract contract)
   *
   * Format: "cmd+c", "ctrl+shift+a" (modifiers + key).
   * WHY separate from press()? Hotkeys require simultaneous key holds.
   */
  protected abstract hotkey(
    agentContext: AgentContext,
    keys: string
  ): Promise<void>;

  /**
   * Platform-specific drag-and-drop (abstract contract)
   *
   * Implements: mousedown(x1,y1) → move_to(x2,y2) → mouseup sequence.
   * Use case: Reordering lists, file uploads, canvas manipulation.
   */
  protected abstract drag_and_drop(
    agentContext: AgentContext,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): Promise<void>;

  /**
   * Builds coordinate-based tool set (no element indices)
   *
   * Tool design: All interaction via (x,y) coordinates extracted from
   * screenshot by LLM vision reasoning. No DOM context provided.
   */
  private buildInitTools(): Tool[] {
    return [
      {
        name: "navigate_to",
        description: "Navigate to a specific url",
        parameters: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The url to navigate to",
            },
          },
          required: ["url"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.navigate_to(agentContext, args.url as string)
          );
        },
      },
      {
        name: "current_page",
        description: "Get the information of the current webpage (url, title)",
        parameters: {
          type: "object",
          properties: {},
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.get_current_page(agentContext)
          );
        },
      },
      {
        name: "go_back",
        description: "Navigate back in browser history",
        parameters: {
          type: "object",
          properties: {},
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() => this.go_back(agentContext));
        },
      },
      {
        name: "typing",
        description: "Type specified text",
        parameters: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "Text to type",
            },
          },
          required: ["text"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.typing(agentContext, args.text as string)
          );
        },
      },
      {
        name: "click",
        description: "Click at current or specified position",
        parameters: {
          type: "object",
          properties: {
            x: {
              type: "number",
              description: "X coordinate",
            },
            y: {
              type: "number",
              description: "Y coordinate",
            },
            num_clicks: {
              type: "number",
              description: "Number of clicks",
              enum: [1, 2, 3],
              default: 1,
            },
            button: {
              type: "string",
              description: "Mouse button to click",
              enum: ["left", "right", "middle"],
              default: "left",
            },
          },
          required: ["x", "y"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.click(
              agentContext,
              args.x as number,
              args.y as number,
              (args.num_clicks || 1) as number,
              (args.button || "left") as any
            )
          );
        },
      },
      {
        name: "move_to",
        description: "Move cursor to specified position",
        parameters: {
          type: "object",
          properties: {
            x: {
              type: "number",
              description: "X coordinate",
            },
            y: {
              type: "number",
              description: "Y coordinate",
            },
          },
          required: ["x", "y"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.move_to(agentContext, args.x as number, args.y as number)
          );
        },
      },
      {
        name: "scroll",
        description: "Scroll the mouse wheel at current position",
        parameters: {
          type: "object",
          properties: {
            amount: {
              type: "number",
              description: "Scroll amount (up / down)",
              minimum: 1,
              maximum: 10,
            },
            direction: {
              type: "string",
              enum: ["up", "down"],
            },
          },
          required: ["amount", "direction"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(async () => {
            let amount = args.amount as number;
            await this.scroll(
              agentContext,
              args.direction == "up" ? -amount : amount
            );
          });
        },
      },
      {
        name: "extract_page_content",
        description:
          "Extract the text content and image links of the current webpage, please use this tool to obtain webpage data.",
        parameters: {
          type: "object",
          properties: {},
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.extract_page_content(agentContext)
          );
        },
      },
      {
        name: "press",
        description:
          "Press and release a key, supports Enter, Tab, Space, Backspace, Delete, Escape, Arrow keys (up/down/left/right), Navigation keys (home/end/pageup/pagedown/insert), and Function keys (F1-F12)",
        parameters: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "Key to press",
              enum: [
                "enter", "tab", "space", "backspace", "delete",
                "escape", "home", "end", "pageup", "pagedown", "insert",
                "arrowup", "arrowdown", "arrowleft", "arrowright",
                "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12"
              ],
            },
          },
          required: ["key"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.press(agentContext, args.key as any)
          );
        },
      },
      {
        name: "hotkey",
        description:
          "Execute keyboard shortcut combinations (e.g., cmd+c, ctrl+shift+a). Use 'cmd' for Mac Command/Windows Control, 'ctrl' for Control, 'alt' for Alt, 'shift' for Shift.",
        parameters: {
          type: "object",
          properties: {
            keys: {
              type: "string",
              description:
                "Key combination string (e.g., 'cmd+c', 'ctrl+shift+a', 'alt+tab')",
            },
          },
          required: ["keys"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.hotkey(agentContext, args.keys as string)
          );
        },
      },
      {
        name: "drag_and_drop",
        description: "Drag and drop operation",
        parameters: {
          type: "object",
          properties: {
            x1: {
              type: "number",
              description: "From X coordinate",
            },
            y1: {
              type: "number",
              description: "From Y coordinate",
            },
            x2: {
              type: "number",
              description: "Target X coordinate",
            },
            y2: {
              type: "number",
              description: "Target Y coordinate",
            },
          },
          required: ["x1", "y1", "x2", "y2"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.drag_and_drop(
              agentContext,
              args.x1 as number,
              args.y1 as number,
              args.x2 as number,
              args.y2 as number
            )
          );
        },
      },
      {
        name: "get_all_tabs",
        description: "Get all tabs of the current browser",
        parameters: {
          type: "object",
          properties: {},
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.get_all_tabs(agentContext)
          );
        },
      },
      {
        name: "switch_tab",
        description: "Switch to the specified tab page",
        parameters: {
          type: "object",
          properties: {
            tabId: {
              type: "number",
              description: "Tab ID, obtained through get_all_tabs",
            },
          },
          required: ["tabId"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            this.switch_tab(agentContext, args.tabId as number)
          );
        },
      },
      {
        name: "wait",
        noPlan: true,
        description: "Wait for specified duration",
        parameters: {
          type: "object",
          properties: {
            duration: {
              type: "number",
              description: "Duration in millisecond",
              default: 500,
              minimum: 200,
              maximum: 10000,
            },
          },
          required: ["duration"],
        },
        execute: async (
          args: Record<string, unknown>,
          agentContext: AgentContext
        ): Promise<ToolResult> => {
          return await this.callInnerTool(() =>
            sleep((args.duration || 200) as number)
          );
        },
      },
    ];
  }

  /**
   * Injects screenshot after each action for visual feedback loop
   *
   * Simplified vs BaseBrowserLabelsAgent: No pseudoHtml element list,
   * just screenshot + timestamp message. LLM must visually verify action
   * results (e.g., click opened menu, text appeared in field).
   *
   * Delay: 300ms allows page animations/transitions to settle before capture.
   */
  protected async handleMessages(
    agentContext: AgentContext,
    messages: LanguageModelV2Prompt,
    tools: Tool[]
  ): Promise<void> {
    let lastTool = this.lastToolResult(messages);
    if (
      lastTool &&
      lastTool.toolName !== "extract_page_content" &&
      lastTool.toolName !== "get_all_tabs" &&
      lastTool.toolName !== "variable_storage"
    ) {
      await sleep(300);
      let result = await this.screenshot(agentContext);
      let image = toImage(result.imageBase64);
      messages.push({
        role: "user",
        content: [
          {
            type: "file",
            data: image,
            mediaType: result.imageType,
          },
          {
            type: "text",
            text: "This is the latest screenshot",
          },
        ],
      });
    }
    super.handleMessages(agentContext, messages, tools);
  }
}

export { BaseBrowserScreenAgent };