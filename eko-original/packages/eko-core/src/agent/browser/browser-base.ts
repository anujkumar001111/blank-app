/**
 * @fileoverview Base browser automation agent with DOM interaction capabilities.
 * 
 * Provides abstract foundation for platform-specific browser agents (Playwright,
 * Puppeteer, WebDriver, Chrome Extension). Implements common browser operations
 * while leaving platform-specific primitives (screenshots, navigation) to subclasses.
 * 
 * @module agent/browser/browser-base
 */

import {
  LanguageModelV2Prompt,
  LanguageModelV2ToolCallPart,
} from "@ai-sdk/provider";
import { Agent } from "../base";
import * as utils from "./utils";
import { sleep } from "../../common/utils";
import { AgentContext } from "../agent-context";
import { ToolExecuter, ToolResult, IMcpClient } from "../../types";

export const AGENT_NAME = "Browser";

/**
 * Abstract base class for browser automation agents.
 * 
 * WHY: Browser automation varies significantly across platforms (Node.js uses
 * Playwright, extensions use chrome.tabs API, Electron uses webContents). This
 * base class provides common logic (page extraction, MCP tool integration) while
 * delegating platform primitives to concrete implementations.
 * 
 * SUBCLASSES:
 * - BrowserLabelsAgent: Vision-based interaction using element labels/coordinates
 * - BrowserScreenAgent: Vision-only interaction via screenshot analysis
 * 
 * @example
 * ```typescript
 * class PlaywrightBrowserAgent extends BaseBrowserAgent {
 *   async screenshot(ctx: AgentContext) {
 *     return { imageBase64: await this.page.screenshot(), imageType: 'image/png' };
 *   }
 *   async navigate_to(ctx: AgentContext, url: string) {
 *     await this.page.goto(url);
 *     return { url: this.page.url(), title: await this.page.title() };
 *   }
 *   // ... implement other abstract methods
 * }
 * ```
 */
export default abstract class BaseBrowserAgent extends Agent {
  /** Captures current browser viewport as base64-encoded image */
  protected abstract screenshot(agentContext: AgentContext): Promise<{
    imageBase64: string;
    imageType: "image/jpeg" | "image/png";
  }>;

  /** Navigates to specified URL and returns final URL/title after redirects */
  protected abstract navigate_to(
    agentContext: AgentContext,
    url: string
  ): Promise<{
    url: string;
    title?: string;
  }>;

  /** Lists all open tabs/windows in current browser session */
  protected abstract get_all_tabs(agentContext: AgentContext): Promise<
    Array<{
      tabId: number;
      url: string;
      title: string;
    }>
  >;

  /** Switches focus to specified tab by ID */
  protected abstract switch_tab(
    agentContext: AgentContext,
    tabId: number
  ): Promise<{
    tabId: number;
    url: string;
    title: string;
  }>;

  protected async go_back(agentContext: AgentContext): Promise<void> {
    try {
      await this.execute_script(
        agentContext,
        () => {
          (window as any).navigation.back();
        },
        []
      );
      await sleep(100);
    } catch (e) {}
  }

  /**
   * Extracts textual content from current page for LLM processing.
   * 
   * Uses injected script to traverse DOM and extract visible text, preserving
   * semantic structure (headings, lists, tables) while removing scripts/styles.
   * Output is formatted for token-efficient LLM consumption.
   * 
   * @param variable_name - Optional variable name to store result in context
   * @returns Page metadata and extracted content
   */
  protected async extract_page_content(
    agentContext: AgentContext,
    variable_name?: string
  ): Promise<{
    title: string;
    page_url: string;
    page_content: string;
  }> {
    let content = await this.execute_script(
      agentContext,
      utils.extract_page_content,
      []
    );
    let pageInfo = await this.get_current_page(agentContext);
    let result = `title: ${pageInfo.title}\npage_url: ${pageInfo.url}\npage_content: \n${content}`;
    if (variable_name) {
      agentContext.context.variables.set(variable_name, result);
    }
    return {
      title: pageInfo.title || "",
      page_url: pageInfo.url,
      page_content: content,
    };
  }

  /**
   * Controls when to refresh MCP tool discovery in browser context.
   * 
   * WHY: MCP tools may change based on current page (e.g., site-specific tools).
   * This method optimizes tool discovery by only re-fetching when URL changes,
   * avoiding expensive MCP calls on every agent loop iteration.
   * 
   * @param loopNum - Current iteration in agent's ReAct loop
   * @returns Whether to refresh tools and context parameters for MCP
   */
  protected async controlMcpTools(
    agentContext: AgentContext,
    messages: LanguageModelV2Prompt,
    loopNum: number
  ): Promise<{ mcpTools: boolean; mcpParams?: Record<string, unknown> }> {
    if (loopNum > 0) {
      let url = null;
      try {
        url = (await this.get_current_page(agentContext)).url;
      } catch (e) {}
      let lastUrl = agentContext.variables.get("lastUrl");
      agentContext.variables.set("lastUrl", url);
      // Only refresh tools if URL changed (new page may have different MCP tools)
      return {
        mcpTools: loopNum == 0 || url != lastUrl,
        mcpParams: {
          environment: "browser",
          browser_url: url,
        },
      };
    } else {
      return {
        mcpTools: true,
        mcpParams: {
          environment: "browser",
        },
      };
    }
  }

  protected toolExecuter(mcpClient: IMcpClient, name: string): ToolExecuter {
    return {
      execute: async (args, agentContext): Promise<ToolResult> => {
        let result = await mcpClient.callTool(
          {
            name: name,
            arguments: args,
            extInfo: {
              taskId: agentContext.context.taskId,
              nodeId: agentContext.agentChain.agent.id,
              environment: "browser",
              agent_name: agentContext.agent.Name,
              browser_url: agentContext.variables.get("lastUrl"),
            },
          },
          agentContext.context.controller.signal
        );
        if (
          result.extInfo &&
          result.extInfo["javascript"] &&
          result.content[0].type == "text"
        ) {
          let script = result.content[0].text;
          let params = JSON.stringify(args);
          let runScript = `${script};execute(${params})`;
          let scriptResult = await this.execute_mcp_script(
            agentContext,
            runScript
          );
          let resultText;
          if (
            typeof scriptResult == "string" ||
            typeof scriptResult == "number"
          ) {
            resultText = scriptResult + "";
          } else {
            resultText = scriptResult
              ? JSON.stringify(scriptResult)
              : "Successful";
          }
          return {
            content: [
              {
                type: "text",
                text: resultText,
              },
            ],
          };
        }
        return result;
      },
    };
  }

  protected async get_current_page(agentContext: AgentContext): Promise<{
    url: string;
    title?: string;
    tabId?: number;
  }> {
    return await this.execute_script(
      agentContext,
      () => {
        return {
          url: (window as any).location.href,
          title: (window as any).document.title,
        };
      },
      []
    );
  }

  protected lastToolResult(messages: LanguageModelV2Prompt): {
    id: string;
    toolName: string;
    args: unknown;
    result: unknown;
  } | null {
    let lastMessage = messages[messages.length - 1];
    if (lastMessage.role != "tool") {
      return null;
    }
    let toolResult = lastMessage.content.filter(
      (t) => t.type == "tool-result"
    )[0];
    if (!toolResult) {
      return null;
    }
    let result = toolResult.output.value;
    for (let i = messages.length - 2; i > 0; i--) {
      if (
        messages[i].role !== "assistant" ||
        typeof messages[i].content == "string"
      ) {
        continue;
      }
      for (let j = 0; j < messages[i].content.length; j++) {
        let content = messages[i].content[j];
        if (typeof content !== "string" && content.type !== "tool-call") {
          continue;
        }
        let toolUse = content as LanguageModelV2ToolCallPart;
        if (toolResult.toolCallId != toolUse.toolCallId) {
          continue;
        }
        return {
          id: toolResult.toolCallId,
          toolName: toolUse.toolName,
          args: toolUse.input,
          result,
        };
      }
    }
    return null;
  }

  protected toolUseNames(messages?: LanguageModelV2Prompt): string[] {
    let toolNames: string[] = [];
    if (!messages) {
      return toolNames;
    }
    for (let i = 0; i < messages.length; i++) {
      let message = messages[i];
      if (message.role == "tool") {
        toolNames.push(message.content[0].toolName);
      }
    }
    return toolNames;
  }

  protected abstract execute_script(
    agentContext: AgentContext,
    func: (...args: any[]) => void,
    args: any[]
  ): Promise<any>;

  protected async execute_mcp_script(
    agentContext: AgentContext,
    script: string
  ): Promise<string | number | Record<string, any> | undefined> {
    return;
  }
}

export { BaseBrowserAgent };
