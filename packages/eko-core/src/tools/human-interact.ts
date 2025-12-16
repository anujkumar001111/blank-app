/**
 * @fileoverview Human-in-the-loop interaction tool for agent workflows.
 * 
 * Enables agents to request user input when automation reaches its limits
 * (ambiguous instructions, captchas, payment confirmations, login requirements).
 * Provides multiple interaction types (confirm/input/select/help) routed through
 * HumanCallback interface.
 * 
 * @module tools/human-interact
 */

import { JSONSchema7 } from "json-schema";
import { LLMRequest } from "../types";
import { toImage } from "../common/utils";
import { RetryLanguageModel } from "../llm";
import { AgentContext } from "../agent/agent-context";
import { Tool, ToolResult } from "../types/tools.types";

export const TOOL_NAME = "human_interact";

/**
 * Routes agent requests for human input to application-defined callbacks.
 * 
 * WHY: Full automation is impossible for:
 * - Security challenges (captchas, 2FA codes, QR scans)
 * - Ambiguous tasks requiring clarification
 * - Dangerous operations needing confirmation (delete data, payments)
 * - Authentication requiring credentials
 * 
 * DESIGN: Delegates all UI rendering to host application via HumanCallback.
 * Agent pauses execution until callback resolves with user's response.
 * 
 * SAFETY: Marks tool as `noPlan: true` to prevent planner from including it
 * in workflow XML (should only be used when truly needed).
 */
export default class HumanInteractTool implements Tool {
  readonly name: string = TOOL_NAME;
  readonly description: string;
  readonly noPlan: boolean = true;
  readonly parameters: JSONSchema7;

  constructor() {
    this.description = `AI interacts with humans:
confirm: Ask the user to confirm whether to execute an operation, especially when performing dangerous actions such as deleting system files, users will choose Yes or No.
input: Prompt the user to enter text; for example, when a task is ambiguous, the AI can choose to ask the user for details, and the user can respond by inputting.
select: Allow the user to make a choice; in situations that require selection, the AI can ask the user to make a decision.
request_help: Request assistance from the user; for instance, when an operation is blocked, the AI can ask the user for help, For example, login required, CAPTCHA verification, SMS verification code, QR code scanning, payment operations, etc.`;
    this.parameters = {
      type: "object",
      properties: {
        interactType: {
          type: "string",
          description: "The type of interaction with users.",
          enum: ["confirm", "input", "select", "request_help"],
        },
        prompt: {
          type: "string",
          description: "Display prompts to users",
        },
        selectOptions: {
          type: "array",
          description:
            "Options provided to users, this parameter is required when interactType is select.",
          items: {
            type: "string",
          },
        },
        selectMultiple: {
          type: "boolean",
          description: "isMultiple, used when interactType is select",
        },
        helpType: {
          type: "string",
          description: "Help type, required when interactType is request_help.",
          enum: ["request_login", "request_assistance"],
        },
      },
      required: ["interactType", "prompt"],
    };
  }

  /**
   * Routes interaction request to appropriate callback and returns user response.
   * 
   * INTERACTION TYPES:
   * - confirm: Yes/No questions (e.g., "Delete all files?")
   * - input: Free-text collection (e.g., "Enter API key")
   * - select: Choice from options (single or multi-select)
   * - request_help: Blocking issues requiring manual intervention
   *   - request_login: Auto-checks if already logged in before prompting
   *   - request_assistance: Generic help request (captcha, payment, etc.)
   * 
   * @param args.interactType - Type of interaction to perform
   * @param args.prompt - Message displayed to user
   * @param args.selectOptions - Options array (required for select type)
   * @param args.helpType - Subtype for request_help interactions
   * 
   * @returns User's response formatted as text result.
   * @throws Error if callback not implemented or interaction type unknown.
   */
  async execute(
    args: Record<string, unknown>,
    agentContext: AgentContext
  ): Promise<ToolResult> {
    let interactType = args.interactType as string;
    let callback = agentContext.context.config.callback;
    let resultText = "";
    if (callback) {
      switch (interactType) {
        case "confirm":
          if (callback.onHumanConfirm) {
            let result = await callback.onHumanConfirm(
              agentContext,
              args.prompt as string
            );
            resultText = `confirm result: ${result ? "Yes" : "No"}`;
          }
          break;
        case "input":
          if (callback.onHumanInput) {
            let result = await callback.onHumanInput(
              agentContext,
              args.prompt as string
            );
            resultText = `input result: ${result}`;
          }
          break;
        case "select":
          if (callback.onHumanSelect) {
            let result = await callback.onHumanSelect(
              agentContext,
              args.prompt as string,
              (args.selectOptions || []) as string[],
              (args.selectMultiple || false) as boolean
            );
            resultText = `select result: ${JSON.stringify(result)}`;
          }
          break;
        case "request_help":
          if (callback.onHumanHelp) {
            // Optimization: auto-check login state before interrupting user
            if (
              args.helpType == "request_login" &&
              (await this.checkIsLogined(agentContext))
            ) {
              resultText = "Already logged in";
              break;
            }
            let result = await callback.onHumanHelp(
              agentContext,
              (args.helpType || "request_assistance") as any,
              args.prompt as string
            );
            resultText = `request_help result: ${
              result ? "Solved" : "Unresolved"
            }`;
          }
          break;
      }
    }
    if (resultText) {
      return {
        content: [
          {
            type: "text",
            text: resultText,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: `Error: Unsupported ${interactType} interaction operation`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Uses vision AI to detect if user is already logged in before prompting.
   * 
   * Captures current page screenshot and asks LLM to identify login state.
   * Prevents unnecessary interruptions when session is already active.
   * Returns false on errors to fail-safe toward showing login prompt.
   */
  private async checkIsLogined(agentContext: AgentContext) {
    let screenshot = (agentContext.agent as any)["screenshot"];
    if (!screenshot) {
      return false;
    }
    try {
      let imageResult = (await screenshot.call(agentContext.agent, agentContext)) as {
        imageBase64: string;
        imageType: "image/jpeg" | "image/png";
      };
      let rlm = new RetryLanguageModel(
        agentContext.context.config.llms,
        agentContext.agent.Llms
      );
      rlm.setContext(agentContext);
      let image = toImage(imageResult.imageBase64);
      let request: LLMRequest = {
        messages: [
          {
            role: "user",
            content: [
              {
                type: "file",
                data: image,
                mediaType: imageResult.imageType,
              },
              {
                type: "text",
                text: "Check if the current website is logged in. If not logged in, output `NOT_LOGIN`. If logged in, output `LOGGED_IN`. Output directly without explanation.",
              },
            ],
          },
        ],
        abortSignal: agentContext.context.controller.signal,
      };
      let result = await rlm.call(request);
      return result.text && result.text.indexOf("LOGGED_IN") > -1;
    } catch (error) {
      console.error("Error auto checking login status:", error);
      return false;
    }
  }
}

export { HumanInteractTool };
