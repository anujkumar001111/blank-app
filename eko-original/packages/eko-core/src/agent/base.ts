import config from "../config";
import Log from "../common/log";
import * as memory from "../memory";
import { RetryLanguageModel } from "../llm";
import { mergeTools } from "../common/utils";
import { ToolWrapper } from "../tools/wrapper";
import { AgentChain, ToolChain } from "./chain";
import {
  McpTool,
  ForeachTaskTool,
  WatchTriggerTool,
  HumanInteractTool,
  VariableStorageTool,
} from "../tools";
import {
  Tool,
  IMcpClient,
  LLMRequest,
  ToolResult,
  ToolSchema,
  ToolExecuter,
  WorkflowAgent,
  HumanCallback,
  AgentStreamCallback,
} from "../types";
import {
  LanguageModelV2Prompt,
  LanguageModelV2FilePart,
  LanguageModelV2TextPart,
  LanguageModelV2ToolCallPart,
  LanguageModelV2ToolResultPart,
} from "@ai-sdk/provider";
import {
  getTool,
  convertTools,
  callAgentLLM,
  convertToolResult,
  defaultMessageProviderOptions,
} from "./agent-llm";
import TaskContext, { AgentContext } from "./agent-context";
import { doTaskResultCheck } from "../tools/task-result-check";
import { doTodoListManager } from "../tools/todo-list-manager";
import { getAgentSystemPrompt, getAgentUserPrompt } from "../prompt/agent";

/**
 * Configuration parameters for creating an Agent instance
 *
 * Defines the capabilities, behavior, and integration points for an agent.
 * Agents are specialized AI workers that can execute tools and interact with LLMs.
 */
export type AgentParams = {
  /** Unique identifier for this agent type */
  name: string;
  /** Human-readable description of agent's capabilities and purpose */
  description: string;
  /** Array of tools this agent can execute */
  tools: Tool[];
  /** Preferred LLM configurations for this agent (overrides global defaults) */
  llms?: string[];
  /** MCP client for dynamic tool discovery and execution */
  mcpClient?: IMcpClient;
  /** Description used during workflow planning to determine agent selection */
  planDescription?: string;
  /** Optional callback to intercept and modify LLM requests */
  requestHandler?: (request: LLMRequest) => void;
};

/**
 * Base Agent Class - Foundation for AI-Powered Task Execution
 *
 * Agents are the core execution units in the Eko framework, combining AI language models
 * with specialized tools to accomplish complex tasks. Each agent encapsulates domain expertise,
 * tool capabilities, and execution logic.
 *
 * ## Agent Architecture
 *
 * ```
 * ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
 * │   Natural       │ -> │   Agent         │ -> │   Tool          │
 * │   Language      │    │   Reasoning     │    │   Execution     │
 * │   Task          │    │   (LLM)         │    │   (Functions)    │
 * └─────────────────┘    └─────────────────┘    └─────────────────┘
 * ```
 *
 * ## Execution Lifecycle
 *
 * 1. **Initialization**: Agent created with tools and configuration
 * 2. **Planning**: Agent receives task and builds execution strategy
 * 3. **Tool Discovery**: Dynamic tool loading via MCP if configured
 * 4. **ReAct Loop**: Iterative reasoning and tool execution cycle
 * 5. **Result Synthesis**: Combine tool outputs into final answer
 * 6. **Memory Recording**: Store execution episode for learning
 *
 * ## Key Features
 *
 * - **Tool Integration**: Execute functions and APIs through standardized interfaces
 * - **MCP Support**: Dynamic tool discovery and execution via Model Context Protocol
 * - **Streaming Callbacks**: Real-time progress reporting and human intervention
 * - **Error Recovery**: Automatic retry logic and graceful failure handling
 * - **Parallel Execution**: Support for concurrent tool calls when safe
 * - **Context Awareness**: Access to task variables, conversation history, and workflow state
 *
 * @example
 * ```typescript
 * class CustomAgent extends Agent {
 *   constructor() {
 *     super({
 *       name: 'DataAnalyzer',
 *       description: 'Analyzes datasets and generates insights',
 *       tools: [new FileReaderTool(), new ChartGeneratorTool()],
 *       llms: ['claude-3-5-sonnet']
 *     });
 *   }
 * }
 * ```
 */
export class Agent {
  /** Unique identifier for this agent instance */
  protected name: string;
  /** Human-readable description of agent's capabilities */
  protected description: string;
  /** Available tools for task execution */
  protected tools: Tool[] = [];
  /** Preferred LLM configurations (overrides global defaults) */
  protected llms?: string[];
  /** MCP client for dynamic tool discovery */
  protected mcpClient?: IMcpClient;
  /** Description used during planning phase */
  protected planDescription?: string;
  /** Optional request interceptor for LLM calls */
  protected requestHandler?: (request: LLMRequest) => void;
  /** Callback interfaces for streaming updates and human interaction */
  protected callback?: AgentStreamCallback & HumanCallback;
  /** Current execution context (set during run) */
  protected agentContext?: AgentContext;

  /**
   * Creates a new agent instance with specified capabilities
   *
   * @param params - Configuration defining agent's behavior and tools
   *
   * @remarks
   * Agent construction is lightweight - heavy initialization like MCP connections
   * happens during the run() method to avoid blocking instantiation.
   */
  constructor(params: AgentParams) {
    this.name = params.name;
    this.description = params.description;
    this.tools = params.tools;
    this.llms = params.llms;
    this.mcpClient = params.mcpClient;
    this.planDescription = params.planDescription;
    this.requestHandler = params.requestHandler;
  }

  /**
   * Executes the agent within a task context
   *
   * This is the main entry point for agent execution, coordinating the full lifecycle
   * from initialization through completion. The method handles MCP setup, context
   * management, and resource cleanup.
   *
   * @param context - Task execution context with workflow state and configuration
   * @param agentChain - Chain object tracking this agent's execution history
   * @returns Final result string from agent execution
   *
   * @throws Propagates execution errors after cleanup
   *
   * @remarks
   * Execution flow:
   * 1. **Setup**: Initialize MCP connection and agent context
   * 2. **Delegation**: Call runWithContext for actual execution logic
   * 3. **Cleanup**: Close MCP connection regardless of success/failure
   *
   * The method ensures proper resource management and error propagation.
   */
  public async run(
    context: TaskContext,
    agentChain: AgentChain
  ): Promise<string> {
    const mcpClient = this.mcpClient || context.config.defaultMcpClient;
    const agentContext = new AgentContext(context, this, agentChain);
    try {
      this.agentContext = agentContext;
      mcpClient &&
        !mcpClient.isConnected() &&
        (await mcpClient.connect(context.controller.signal));
      return await this.runWithContext(
        agentContext,
        mcpClient,
        config.maxReactNum
      );
    } finally {
      mcpClient && (await mcpClient.close());
    }
  }

  /**
   * Core agent execution engine implementing the ReAct (Reasoning + Acting) pattern
   *
   * This method orchestrates the iterative cycle of reasoning and tool execution that
   * characterizes agent behavior. It manages LLM interactions, tool calling, and result
   * synthesis within configurable iteration limits.
   *
   * @param agentContext - Execution context with task state and agent configuration
   * @param mcpClient - Optional MCP client for dynamic tool access
   * @param maxReactNum - Maximum number of reasoning iterations (default: 100)
   * @param historyMessages - Previous conversation messages for context continuity
   * @returns Final synthesized result from agent execution
   *
   * @remarks
   * The ReAct loop implements this algorithm:
   * ```
   * while iterations < maxReactNum:
   *   1. Build system and user prompts with current context
   *   2. Call LLM to decide next action (reasoning)
   *   3. Execute tools if requested (acting)
   *   4. Check completion conditions
   *   5. Continue with updated context
   * ```
   *
   * Tool execution can be parallelized when multiple tools are called and
   * all support parallel execution.
   */
  public async runWithContext(
    agentContext: AgentContext,
    mcpClient?: IMcpClient,
    maxReactNum: number = 100,
    historyMessages: LanguageModelV2Prompt = []
  ): Promise<string> {
    let loopNum = 0;
    let checkNum = 0;
    this.agentContext = agentContext;
    const context = agentContext.context;
    const agentNode = agentContext.agentChain.agent;
    const tools = [
      ...this.tools,
      ...this.system_auto_tools(agentNode, agentContext),
    ];
    const systemPrompt = await this.buildSystemPrompt(agentContext, tools);
    const userPrompt = await this.buildUserPrompt(agentContext, tools);
    const messages: LanguageModelV2Prompt = [
      {
        role: "system",
        content: systemPrompt,
        providerOptions: defaultMessageProviderOptions(),
      },
      ...historyMessages,
      {
        role: "user",
        content: userPrompt,
      },
    ];
    agentContext.messages = messages;
    const rlm = new RetryLanguageModel(context.config.llms, this.llms);
    rlm.setContext(agentContext);
    let agentTools = tools;
    while (loopNum < maxReactNum) {
      await context.checkAborted();
      if (mcpClient) {
        const controlMcp = await this.controlMcpTools(
          agentContext,
          messages,
          loopNum
        );
        if (controlMcp.mcpTools) {
          const mcpTools = await this.listTools(
            context,
            mcpClient,
            agentNode,
            controlMcp.mcpParams
          );
          const usedTools = memory.extractUsedTool(messages, agentTools);
          const _agentTools = mergeTools(tools, usedTools);
          agentTools = mergeTools(_agentTools, mcpTools);
        }
      }
      await this.handleMessages(agentContext, messages, tools);
      const llm_tools = convertTools(agentTools);
      const results = await callAgentLLM(
        agentContext,
        rlm,
        messages,
        llm_tools,
        false,
        undefined,
        this.callback,
        this.requestHandler
      );
      const forceStop = agentContext.variables.get("forceStop");
      if (forceStop) {
        return forceStop;
      }
      const finalResult = await this.handleCallResult(
        agentContext,
        messages,
        agentTools,
        results
      );
      loopNum++;
      if (!finalResult) {
        if (
          config.mode == "expert" &&
          loopNum % config.expertModeTodoLoopNum == 0
        ) {
          await doTodoListManager(agentContext, rlm, messages, llm_tools);
        }
        continue;
      }
      if (config.mode == "expert" && checkNum == 0) {
        checkNum++;
        const { completionStatus } = await doTaskResultCheck(
          agentContext,
          rlm,
          messages,
          llm_tools
        );
        if (completionStatus == "incomplete") {
          continue;
        }
      }
      return finalResult;
    }
    return "Unfinished";
  }

  /**
   * Processes LLM response and orchestrates tool execution
   *
   * This method interprets the LLM's response, determines if tool calls are needed,
   * executes them (potentially in parallel), and updates the conversation context.
   * It returns null if execution should continue, or a final result if complete.
   *
   * @param agentContext - Current execution context
   * @param messages - Conversation history to update
   * @param agentTools - Available tools for execution
   * @param results - LLM response parts (text and/or tool calls)
   * @returns Final result string if execution complete, null to continue iteration
   *
   * @remarks
   * Response processing logic:
   * - **Text-only responses**: Treated as final answer
   * - **Tool calls**: Executed and results added to conversation
   * - **Parallel execution**: Multiple tool calls run concurrently when safe
   * - **Sequential execution**: Tool calls executed one-by-one for safety
   *
   * Tool results are converted to the appropriate message format and added
   * to the conversation for the next LLM call.
   */
  protected async handleCallResult(
    agentContext: AgentContext,
    messages: LanguageModelV2Prompt,
    agentTools: Tool[],
    results: Array<LanguageModelV2TextPart | LanguageModelV2ToolCallPart>
  ): Promise<string | null> {
    const user_messages: LanguageModelV2Prompt = [];
    const toolResults: LanguageModelV2ToolResultPart[] = [];
    // results = memory.removeDuplicateToolUse(results);
    messages.push({
      role: "assistant",
      content: results,
    });
    if (results.length == 0) {
      return null;
    }
    if (results.every((s) => s.type == "text")) {
      return results.map((s) => s.text).join("\n\n");
    }
    const toolCalls = results.filter((s) => s.type == "tool-call");
    if (
      toolCalls.length > 1 &&
      this.canParallelToolCalls(toolCalls) &&
      toolCalls.every(
        (s) =>
          agentTools.find((t) => t.name == s.toolName)?.supportParallelCalls
      )
    ) {
      const results = await Promise.all(
        toolCalls.map((toolCall) =>
          this.callToolCall(agentContext, agentTools, toolCall, user_messages)
        )
      );
      for (let i = 0; i < results.length; i++) {
        toolResults.push(results[i]);
      }
    } else {
      for (let i = 0; i < toolCalls.length; i++) {
        const toolCall = toolCalls[i];
        const toolResult = await this.callToolCall(
          agentContext,
          agentTools,
          toolCall,
          user_messages
        );
        toolResults.push(toolResult);
      }
    }
    if (toolResults.length > 0) {
      messages.push({
        role: "tool",
        content: toolResults,
      });
      user_messages.forEach((message) => messages.push(message));
      return null;
    } else {
      return results
        .filter((s) => s.type == "text")
        .map((s) => s.text)
        .join("\n\n");
    }
  }

  /**
   * Executes a single tool call and handles the result
   *
   * This method manages the complete lifecycle of tool execution including
   * parameter parsing, execution tracking, error handling, and result formatting.
   * It integrates tool results back into the conversation flow.
   *
   * @param agentContext - Execution context for the current task
   * @param agentTools - Available tools to search for the requested tool
   * @param result - Tool call specification from LLM response
   * @param user_messages - Additional messages to add to conversation (for callbacks)
   * @returns Formatted tool result for inclusion in conversation
   *
   * @throws Error if tool execution fails after retry attempts
   *
   * @remarks
   * Tool execution pipeline:
   * 1. **Parameter parsing**: Convert JSON string to typed parameters
   * 2. **Tool lookup**: Find tool by name in available tool set
   * 3. **Execution tracking**: Create tool chain entry for observability
   * 4. **Error handling**: Retry logic with exponential backoff
   * 5. **Result formatting**: Convert tool output to message format
   * 6. **Callback notification**: Stream progress to external observers
   */
  protected async callToolCall(
    agentContext: AgentContext,
    agentTools: Tool[],
    result: LanguageModelV2ToolCallPart,
    user_messages: LanguageModelV2Prompt = []
  ): Promise<LanguageModelV2ToolResultPart> {
    const context = agentContext.context;
    const toolChain = new ToolChain(
      result,
      agentContext.agentChain.agentRequest as LLMRequest
    );
    agentContext.agentChain.push(toolChain);
    let toolResult: ToolResult;
    try {
      const args =
        typeof result.input == "string"
          ? JSON.parse(result.input || "{}")
          : result.input || {};
      toolChain.params = args;
      let tool = getTool(agentTools, result.toolName);
      if (!tool) {
        throw new Error(result.toolName + " tool does not exist");
      }
      toolResult = await tool.execute(args, agentContext, result);
      toolChain.updateToolResult(toolResult);
      agentContext.consecutiveErrorNum = 0;
    } catch (e) {
      Log.error("tool call error: ", result.toolName, result.input, e);
      toolResult = {
        content: [
          {
            type: "text",
            text: e + "",
          },
        ],
        isError: true,
      };
      toolChain.updateToolResult(toolResult);
      if (++agentContext.consecutiveErrorNum >= 10) {
        throw e;
      }
    }
    const callback = this.callback || context.config.callback;
    if (callback) {
      await callback.onMessage(
        {
          streamType: "agent",
          chatId: context.chatId,
          taskId: context.taskId,
          agentName: agentContext.agent.Name,
          nodeId: agentContext.agentChain.agent.id,
          type: "tool_result",
          toolCallId: result.toolCallId,
          toolName: result.toolName,
          params: result.input || {},
          toolResult: toolResult,
        },
        agentContext
      );
    }
    return convertToolResult(result, toolResult, user_messages);
  }

  /**
   * Dynamically determines system tools needed based on workflow requirements
   *
   * Analyzes the agent's workflow node XML to identify required capabilities and
   * automatically provides the corresponding system tools. This enables agents to
   * access context variables, handle iterations, and interact with users without
   * explicit tool configuration.
   *
   * @param agentNode - Workflow agent node with XML specification
   * @param agentContext - Execution context for tool access
   * @returns Array of automatically provisioned system tools
   *
   * @remarks
   * Automatic tool provisioning based on XML patterns:
   * - **Variable references** (`input=`, `output=`): Adds VariableStorageTool
   * - **Iteration constructs** (`</forEach>`): Adds ForeachTaskTool
   * - **Event triggers** (`</watch>`): Adds WatchTriggerTool
   * - **Human interaction callbacks**: Adds HumanInteractTool
   *
   * Tools are deduplicated to avoid conflicts with explicitly configured tools.
   */
  protected system_auto_tools(
    agentNode: WorkflowAgent,
    agentContext: AgentContext
  ): Tool[] {
    const tools: Tool[] = [];
    const agentNodeXml = agentNode.xml;
    const hasVariable =
      agentNodeXml.indexOf("input=") > -1 ||
      agentNodeXml.indexOf("output=") > -1;
    if (hasVariable) {
      tools.push(new VariableStorageTool());
    }
    const hasForeach = agentNodeXml.indexOf("</forEach>") > -1;
    if (hasForeach) {
      tools.push(new ForeachTaskTool());
    }
    const hasWatch = agentNodeXml.indexOf("</watch>") > -1;
    if (hasWatch) {
      tools.push(new WatchTriggerTool());
    }
    const callback = this.callback || agentContext.context.config.callback;
    if (
      callback?.onHumanConfirm ||
      callback?.onHumanInput ||
      callback?.onHumanSelect ||
      callback?.onHumanHelp
    ) {
      tools.push(new HumanInteractTool());
    }
    const toolNames = this.tools.map((tool) => tool.name);
    return tools.filter((tool) => toolNames.indexOf(tool.name) == -1);
  }

  /**
   * Constructs the system prompt that defines agent behavior and capabilities
   *
   * The system prompt provides the LLM with context about the agent's role,
   * available tools, task requirements, and behavioral guidelines. It serves
   * as the foundation for consistent and effective agent behavior.
   *
   * @param agentContext - Execution context with task and workflow information
   * @param tools - Available tools to include in the prompt
   * @returns Complete system prompt string for LLM consumption
   *
   * @remarks
   * System prompt composition includes:
   * - **Agent identity**: Name, description, and role definition
   * - **Tool specifications**: Available functions with schemas
   * - **Task context**: Current workflow node and requirements
   * - **Behavioral guidelines**: Response format and safety instructions
   * - **Extension content**: Subclass-specific prompt customizations
   */
  protected async buildSystemPrompt(
    agentContext: AgentContext,
    tools: Tool[]
  ): Promise<string> {
    return getAgentSystemPrompt(
      this,
      agentContext.agentChain.agent,
      agentContext.context,
      tools,
      await this.extSysPrompt(agentContext, tools)
    );
  }

  protected async buildUserPrompt(
    agentContext: AgentContext,
    tools: Tool[]
  ): Promise<Array<LanguageModelV2TextPart | LanguageModelV2FilePart>> {
    return [
      {
        type: "text",
        text: getAgentUserPrompt(
          this,
          agentContext.agentChain.agent,
          agentContext.context,
          tools
        ),
      },
    ];
  }

  protected async extSysPrompt(
    agentContext: AgentContext,
    tools: Tool[]
  ): Promise<string> {
    return "";
  }

  /**
   * Discovers and loads tools via Model Context Protocol
   *
   * Queries the MCP server for tools relevant to the current task and agent,
   * creating Tool wrappers for seamless integration with the agent framework.
   * This enables dynamic tool discovery and execution without pre-configuration.
   *
   * @param context - Task execution context for server communication
   * @param mcpClient - Connected MCP client instance
   * @param agentNode - Current workflow agent node (optional context)
   * @param mcpParams - Additional parameters for tool discovery
   * @returns Array of MCP-wrapped tools ready for execution
   *
   * @throws Error if MCP communication fails
   *
   * @remarks
   * MCP tool discovery provides:
   * - **Dynamic capabilities**: Tools discovered at runtime based on context
   * - **Server integration**: Access to external tool ecosystems
   * - **Standardized interface**: MCP tools work seamlessly with agent framework
   * - **Context awareness**: Tool selection based on task and environment
   */
  private async listTools(
    context: TaskContext,
    mcpClient: IMcpClient,
    agentNode?: WorkflowAgent,
    mcpParams?: Record<string, unknown>
  ): Promise<Tool[]> {
    try {
      if (!mcpClient.isConnected()) {
        await mcpClient.connect(context.controller.signal);
      }
      let list = await mcpClient.listTools(
        {
          taskId: context.taskId,
          nodeId: agentNode?.id,
          environment: config.platform,
          agent_name: agentNode?.name || this.name,
          params: {},
          prompt: agentNode?.task || context.chain.taskPrompt,
          ...(mcpParams || {}),
        },
        context.controller.signal
      );
      let mcpTools: Tool[] = [];
      for (let i = 0; i < list.length; i++) {
        let toolSchema: ToolSchema = list[i];
        let execute = this.toolExecuter(mcpClient, toolSchema.name);
        let toolWrapper = new ToolWrapper(toolSchema, execute);
        mcpTools.push(new McpTool(toolWrapper));
      }
      return mcpTools;
    } catch (e) {
      Log.error("Mcp listTools error", e);
      return [];
    }
  }

  protected async controlMcpTools(
    agentContext: AgentContext,
    messages: LanguageModelV2Prompt,
    loopNum: number
  ): Promise<{
    mcpTools: boolean;
    mcpParams?: Record<string, unknown>;
  }> {
    return {
      mcpTools: loopNum == 0,
    };
  }

  protected toolExecuter(mcpClient: IMcpClient, name: string): ToolExecuter {
    return {
      execute: async function (args, agentContext): Promise<ToolResult> {
        return await mcpClient.callTool(
          {
            name: name,
            arguments: args,
            extInfo: {
              taskId: agentContext.context.taskId,
              nodeId: agentContext.agentChain.agent.id,
              environment: config.platform,
              agent_name: agentContext.agent.Name,
            },
          },
          agentContext.context.controller.signal
        );
      },
    };
  }

  protected async handleMessages(
    agentContext: AgentContext,
    messages: LanguageModelV2Prompt,
    tools: Tool[]
  ): Promise<void> {
    // Only keep the last image / file, large tool-text-result
    memory.handleLargeContextMessages(messages);
  }

  protected async callInnerTool(fun: () => Promise<any>): Promise<ToolResult> {
    let result = await fun();
    return {
      content: [
        {
          type: "text",
          text: result
            ? typeof result == "string"
              ? result
              : JSON.stringify(result)
            : "Successful",
        },
      ],
    };
  }

  /**
   * Loads all available tools including MCP-discovered ones
   *
   * Combines statically configured tools with dynamically discovered MCP tools
   * into a unified tool set for agent execution.
   *
   * @param context - Task context for MCP communication
   * @returns Complete set of tools available to this agent
   *
   * @remarks
   * Tool loading strategy:
   * 1. **Static tools**: Always included (configured at agent creation)
   * 2. **MCP tools**: Dynamically discovered if MCP client configured
   * 3. **Deduplication**: Prevents conflicts between static and dynamic tools
   * 4. **Caching**: MCP tools may be cached for performance
   */
  public async loadTools(context: TaskContext): Promise<Tool[]> {
    if (this.mcpClient) {
      let mcpTools = await this.listTools(context, this.mcpClient);
      if (mcpTools && mcpTools.length > 0) {
        return mergeTools(this.tools, mcpTools);
      }
    }
    return this.tools;
  }

  public addTool(tool: Tool) {
    this.tools.push(tool);
  }

  protected async onTaskStatus(
    status: "pause" | "abort" | "resume-pause",
    reason?: string
  ) {
    if (status == "abort" && this.agentContext) {
      this.agentContext?.variables.clear();
    }
  }

  /**
   * Determines if multiple tool calls can be executed in parallel
   *
   * Evaluates tool calls for parallel execution safety based on tool capabilities
   * and system configuration. Parallel execution can significantly improve
   * performance for independent operations.
   *
   * @param toolCalls - Tool calls to evaluate for parallel execution
   * @returns True if all tool calls can be executed concurrently
   *
   * @remarks
   * Parallel execution requirements:
   * - **System configuration**: `parallelToolCalls` must be enabled globally
   * - **Tool support**: All tools must declare `supportParallelCalls = true`
   * - **Safety**: No tools should have side effects that conflict with others
   * - **Performance**: Parallel execution should provide meaningful speedup
   */
  public canParallelToolCalls(
    toolCalls?: LanguageModelV2ToolCallPart[]
  ): boolean {
    return config.parallelToolCalls;
  }

  get Llms(): string[] | undefined {
    return this.llms;
  }

  get Name(): string {
    return this.name;
  }

  get Description(): string {
    return this.description;
  }

  get Tools(): Tool[] {
    return this.tools;
  }

  get PlanDescription() {
    return this.planDescription;
  }

  get McpClient() {
    return this.mcpClient;
  }

  get AgentContext(): AgentContext | undefined {
    return this.agentContext;
  }
}
