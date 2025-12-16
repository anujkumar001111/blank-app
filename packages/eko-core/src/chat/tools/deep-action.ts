/**
 * DeepAction Tool - Full Agent Workflow Delegation
 *
 * The bridge between conversational chat and deep task execution. When
 * a user's request requires multi-step planning, browser automation,
 * or specialized agent workflows, chat delegates to full Eko execution.
 *
 * Architecture:
 * - Chat agent detects complex task → calls deepAction tool
 * - Tool spawns new Eko instance with full agent ecosystem
 * - Eko runs planning → browser agent → specialized agents
 * - Results streamed back to chat via taskCallback
 * - Final result returned as text to chat ReAct loop
 *
 * WHY separate chat + agent layers?
 * 1. Chat: Fast conversational turns (Q&A, simple queries)
 * 2. DeepAction: Complex multi-agent orchestration (browser tasks, workflows)
 * 3. Progressive disclosure: User starts with chat, escalates to deep tasks
 * 4. Resource management: Only spawn heavy agent workflows when needed
 *
 * Context injection:
 * - Browser tabs: Pass tabIds to agent for webpage awareness
 * - Global variables: Share data between chat messages and tasks
 * - Dependent variables: Chain task outputs (e.g., search → analyze results)
 * - Language: Maintain user's language preference across layers
 *
 * Design tradeoff: Extra indirection (chat → deepAction → Eko → agents)
 * adds complexity but enables hybrid UX (chat for simple, deep for complex).
 *
 * Example flow:
 * User: "Find the cheapest laptop on Amazon and summarize reviews"
 * Chat: Calls deepAction with taskDescription
 * DeepAction: Spawns Eko workflow
 * Eko: Plans subtasks → browser agent searches → extracts data → summarizes
 * Result: Text summary returned to chat, displayed to user
 */

import { JSONSchema7 } from "json-schema";
import {
  ToolResult,
  DialogueTool,
  DialogueParams,
  GlobalPromptKey,
  LanguageModelV2ToolCallPart,
} from "../../types";
import { sub } from "../../common/utils";
import global from "../../config/global";
import Eko, { Agent } from "../../agent";
import { ChatContext } from "../chat-context";
import { recursiveTextNode } from "../../common/workflow";

export const TOOL_NAME = "deepAction";

/**
 * Default tool description (overridable via global.prompts)
 *
 * Emphasizes full computer control, diverse output types (reports, images,
 * programs), and operational task completion (batch operations, workflows).
 */
const deep_action_description =
  "Delegate tasks to a Javis AI assistant for completion. This assistant can understand natural language instructions and has full control over both networked computers, browser agent, and multiple specialized agents ({agentNames}). The assistant can autonomously decide to use various software tools, browse the internet to query information, write code, and perform direct operations to complete tasks. He can deliver various digitized outputs (text reports, tables, images, music, videos, websites, deepSearch, programs, etc.) and handle design/analysis tasks. and execute operational tasks (such as batch following bloggers of specific topics on certain websites). For operational tasks, the focus is on completing the process actions rather than delivering final outputs, and the assistant can complete these types of tasks well. It should also be noted that users may actively mention deepsearch, which is also one of the capabilities of this tool. If users mention it, please explicitly tell the assistant to use deepsearch. Supports parallel execution of multiple tasks.";

/**
 * Parameter description for task field (preserves user intent verbatim)
 *
 * Critical: Instructs chat to pass exact user wording without interpretation
 * or summarization. Prevents information loss during chat → agent handoff.
 */
const deep_action_param_task_description =
  "Task description, please output the user's original instructions without omitting any information from the user's instructions, and use the same language as the user's question.";

export default class DeepActionTool implements DialogueTool {
  readonly name: string = TOOL_NAME;
  readonly description: string;
  readonly parameters: JSONSchema7;

  private chatContext: ChatContext;
  private params: DialogueParams;

  constructor(chatContext: ChatContext, params: DialogueParams) {
    this.chatContext = chatContext;
    const agents = this.chatContext.getConfig().agents || [];
    const agentNames = agents.map((agent: Agent) => agent.Name).join(", ");
    const description =
      global.prompts.get(GlobalPromptKey.deep_action_description) ||
      deep_action_description;
    const paramTaskDescription =
      global.prompts.get(GlobalPromptKey.deep_action_param_task_description) ||
      deep_action_param_task_description;
    this.description = description.replace("{agentNames}", agentNames).trim();
    this.parameters = {
      type: "object",
      properties: {
        language: {
          type: "string",
          description: "User language used, eg: English",
        },
        taskDescription: {
          type: "string",
          description: paramTaskDescription.trim(),
        },
        tabIds: {
          type: "array",
          description:
            "Browser Tab IDs associated with this task, When user says 'left side' or 'current', it means current active tab",
          items: { type: "integer" },
        },
        dependentVariables: {
          type: "array",
          description:
            "The current task relies on variable data from prerequisite execution outputs. Provide the name of the dependent variable.",
          items: {
            type: "string",
          },
        },
      },
      required: ["language", "taskDescription"],
    };
    this.params = params;
  }

  /**
   * Executes deep task by spawning full Eko workflow
   *
   * Flow:
   * 1. Creates new Eko instance with chat config + task callback
   * 2. Registers Eko in chatContext for later access (status queries)
   * 3. Wires abort signal for user cancellation
   * 4. Loads dependent variable values from previous tasks
   * 5. Calls eko.run() with task description + context
   * 6. Extracts text result from workflow output
   * 7. Returns result to chat for display/further reasoning
   *
   * Error handling: Returns error text on failure (chat can retry/rephrase)
   */
  async execute(
    args: Record<string, unknown>,
    toolCall: LanguageModelV2ToolCallPart,
    messageId: string
  ): Promise<ToolResult> {
    const chatId = this.chatContext.getChatId();
    const language = args.language as string;
    const taskDescription = args.taskDescription as string;
    const tabIds = args.tabIds as string[];
    const dependentVariables = args.dependentVariables as string[];
    const config = this.chatContext.getConfig();
    const globalVariables = this.chatContext.getGlobalVariables();
    const eko = new Eko(
      {
        ...config,
        callback: this.params.callback?.taskCallback,
      },
      chatId
    );
    this.chatContext.addEko(messageId, eko);
    if (this.params.signal) {
      if (this.params.signal.aborted) {
        const error = new Error("Operation was interrupted");
        error.name = "AbortError";
        throw error;
      }
      this.params.signal.addEventListener("abort", () => {
        eko.abortTask(messageId, "User aborted");
      });
    }
    const attachments = this.params.user
      .filter((part) => part.type === "file")
      .filter((part) => part.data && part.data.length < 500)
      .map((part) => {
        return {
          file_name: part.filename,
          file_path: part.filePath,
          file_url: part.data,
        };
      });
    const taskWebsite = await this.gettaskWebsite(tabIds);
    const workflow = await eko.generate(taskDescription, messageId, {
      ...(this.params.extra || {}),
      ...globalVariables,
      tabIds: tabIds,
      language: language,
      attachments: attachments,
      taskWebsite: taskWebsite,
      dependentVariables: dependentVariables,
      datetime: this.params.datetime || new Date().toLocaleString(),
    });
    const context = eko.getTask(messageId)!;
    console.log("==> workflow", workflow);
    const result = await eko.execute(messageId);
    const variableNames: string[] = [];
    if (context.variables && context.variables.size > 0) {
      workflow.agents
        .map((agent) => agent.nodes)
        .flat()
        .forEach((node) => {
          recursiveTextNode(node, async (textNode) => {
            if (textNode.output) {
              variableNames.push(textNode.output);
              globalVariables.set(
                textNode.output,
                context.variables.get(textNode.output)
              );
            }
          });
        });
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            taskPlan: workflow.xml,
            subAgents: context.chain.agents.map((agent) => {
              return {
                agent: agent.agent.name,
                subTask: agent.agent.task,
                agentResult: sub(agent.agentResult || "", 800, true),
              };
            }),
            variables: variableNames,
            taskResult: result.result,
            success: result.success,
          }),
        },
      ],
    };
  }

  private async gettaskWebsite(tabIds: string[]): Promise<any[]> {
    if (!global.browserService) {
      return [];
    }
    const tabs = await global.browserService.loadTabs(
      this.chatContext.getChatId(),
      tabIds
    );
    return tabs.map((tab) => {
      return {
        tabId: tab.tabId,
        title: tab.title,
        url: sub(tab.url, 300),
      };
    });
  }
}

export { DeepActionTool };
