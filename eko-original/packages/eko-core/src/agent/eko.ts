import config from "../config";
import { Agent } from "../agent";
import { Planner } from "./plan";
import Log from "../common/log";
import TaskContext from "./agent-context";
import Chain, { AgentChain } from "./chain";
import { buildAgentTree } from "../common/tree";
import { mergeAgents, uuidv4 } from "../common/utils";
import {
  EkoConfig,
  EkoResult,
  Workflow,
  NormalAgentNode,
} from "../types/agent.types";
import global from "../config/global";
import { checkTaskReplan, replanWorkflow } from "./replan";

/**
 * Eko - Main Orchestrator for Agent-Based Workflow Automation
 *
 * The Eko class serves as the central coordinator for natural language-driven task execution.
 * It transforms human-readable task descriptions into structured workflows of specialized agents,
 * manages execution lifecycle, handles errors and interruptions, and provides real-time progress updates.
 *
 * ## Core Responsibilities
 *
 * 1. **Task Planning**: Convert natural language tasks into executable agent workflows
 * 2. **Execution Orchestration**: Coordinate parallel/serial agent execution with dependency management
 * 3. **State Management**: Track task context, variables, and conversation history
 * 4. **Error Handling**: Graceful failure recovery with retry logic and user intervention
 * 5. **Memory Integration**: Record execution episodes for continuous learning
 * 6. **Streaming Updates**: Real-time progress reporting through callback interfaces
 *
 * ## Execution Flow
 *
 * ```
 * Natural Language Task → Workflow Planning → Agent Execution → Result Aggregation
 *       ↓                        ↓                    ↓              ↓
 *   "Search news" → [{agent: "browser", task: "..."}] → DOM scraping → Structured data
 * ```
 *
 * ## Memory Integration
 *
 * When episodic memory is configured, Eko automatically records task executions to improve
 * future performance through pattern recognition and learned behaviors.
 *
 * @example
 * ```typescript
 * const eko = new Eko({
 *   llms: { default: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', apiKey: '...' } },
 *   agents: [new BrowserAgent(), new FileAgent()],
 *   episodicMemory: new EpisodicMemory(new InMemoryStorageProvider())
 * });
 *
 * // Plan and execute a task
 * const result = await eko.run('Find latest AI news and save summary to file');
 * console.log(result.success ? 'Task completed' : 'Task failed');
 * ```
 */
export class Eko {
  /** Unique identifier for the chat session containing multiple tasks */
  protected chatId: string;
  /** Framework configuration including LLMs, agents, and optional memory/callbacks */
  protected config: EkoConfig;
  /** Promise tracking episodic memory initialization to avoid blocking constructor */
  private memoryInitPromise?: Promise<void>;

  /**
   * Creates a new Eko orchestrator instance
   *
   * @param config - Framework configuration specifying LLMs, agents, and optional features
   * @param chatId - Unique session identifier (auto-generated if not provided)
   *
   * @remarks
   * The constructor performs lightweight initialization and starts background memory setup
   * if episodic memory is configured. Memory initialization doesn't block the constructor
   * to maintain responsive instantiation.
   */
  constructor(config: EkoConfig, chatId: string = uuidv4()) {
    this.config = config;
    this.chatId = chatId;

    // Start episodic memory initialization asynchronously (non-blocking)
    // This allows the Eko instance to be used immediately while memory warms up
    if (this.config.episodicMemory) {
      this.memoryInitPromise = this.config.episodicMemory.init().catch(err => {
        Log.error("Failed to initialize episodic memory:", err);
        // Resolve to undefined to prevent blocking - memory features will be unavailable
        return undefined;
      });
    }
  }

  /**
   * Ensures episodic memory system is fully initialized before use
   *
   * @returns Promise that resolves when memory is ready or immediately if no memory configured
   *
   * @remarks
   * Memory initialization happens asynchronously in the constructor. This method provides
   * a synchronization point for operations that require memory to be available.
   * If memory initialization fails, this method will still resolve to prevent blocking.
   */
  private async ensureMemoryReady(): Promise<void> {
    if (this.memoryInitPromise) {
      await this.memoryInitPromise;
    }
  }

  /**
   * Generates a structured workflow from a natural language task description
   *
   * This method performs the planning phase of task execution, converting human-readable
   * instructions into a machine-executable workflow with agents, dependencies, and execution order.
   *
   * @param taskPrompt - Natural language description of the task to accomplish
   * @param taskId - Unique identifier for this task (auto-generated if not provided)
   * @param contextParams - Initial variables to inject into task context
   * @param datetime - Optional timestamp for time-aware planning
   * @returns Structured workflow with agents, dependencies, and execution metadata
   *
   * @throws Error if workflow planning fails or required agents are unavailable
   *
   * @example
   * ```typescript
   * const workflow = await eko.generate('Analyze quarterly sales data and generate report');
   * console.log(`Planned ${workflow.agents.length} agents for execution`);
   * ```
   *
   * @remarks
   * The planning process involves:
   * 1. Agent discovery and capability matching
   * 2. Dependency analysis and parallelization opportunities
   * 3. Resource allocation and execution ordering
   * 4. Fallback strategy development for error scenarios
   */
  public async generate(
    taskPrompt: string,
    taskId: string = uuidv4(),
    contextParams?: Record<string, any>,
    datetime?: string
  ): Promise<Workflow> {
    // Initialize execution context with available agents and task metadata
    const agents = [...(this.config.agents || [])];
    const chain: Chain = new Chain(taskPrompt);
    const context = new TaskContext(
      this.chatId,
      taskId,
      this.config,
      agents,
      chain
    );

    // Inject initial context variables if provided
    if (contextParams) {
      Object.keys(contextParams).forEach((key) =>
        context.variables.set(key, contextParams[key])
      );
    }

    try {
      // Register task globally for cross-session management
      global.taskMap.set(taskId, context);

      // Discover additional agents via A2A (Agent-to-Agent) protocol if configured
      if (this.config.a2aClient) {
        const a2aList = await this.config.a2aClient.listAgents(taskPrompt);
        context.agents = mergeAgents(context.agents, a2aList);
      }

      // Plan the workflow using the configured planner with LLM assistance
      const planner = new Planner(context);
      context.workflow = await planner.plan(taskPrompt, true, datetime);
      return context.workflow;
    } catch (e) {
      // Clean up failed task initialization
      this.deleteTask(taskId);
      throw e;
    }
  }

  /**
   * Modifies an existing task's workflow based on new requirements
   *
   * This method enables dynamic workflow adaptation during execution, allowing users to
   * refine or redirect task execution without restarting from scratch.
   *
   * @param taskId - Identifier of the existing task to modify
   * @param modifyTaskPrompt - New requirements or changes to apply
   * @returns Updated workflow reflecting the modifications
   *
   * @throws Error if task doesn't exist or modification planning fails
   *
   * @example
   * ```typescript
   * // Start with a basic task
   * await eko.generate('Search for news', 'task-123');
   *
   * // Modify to be more specific during execution
   * const updatedWorkflow = await eko.modify('task-123', 'Focus on AI news from last week');
   * ```
   *
   * @remarks
   * Modification can involve:
   * - Adding/removing agents from the workflow
   * - Changing agent parameters or tasks
   * - Adjusting execution dependencies
   * - Replanning based on current progress
   */
  public async modify(
    taskId: string,
    modifyTaskPrompt: string
  ): Promise<Workflow> {
    const context = global.taskMap.get(taskId);
    if (!context) {
      return await this.generate(modifyTaskPrompt, taskId);
    }
    if (this.config.a2aClient) {
      const a2aList = await this.config.a2aClient.listAgents(modifyTaskPrompt);
      context.agents = mergeAgents(context.agents, a2aList);
    }
    const planner = new Planner(context);
    context.workflow = await planner.replan(modifyTaskPrompt);
    return context.workflow;
  }

  /**
   * Executes a planned workflow and returns the final result
   *
   * This method orchestrates the actual execution of agents according to the workflow plan,
   * managing parallel execution, error handling, memory recording, and result aggregation.
   *
   * @param taskId - Identifier of the task to execute (must be previously generated)
   * @returns Execution result with success status, output data, and error information
   *
   * @throws Error if task doesn't exist or execution setup fails
   *
   * @example
   * ```typescript
   * const workflow = await eko.generate('Analyze sales data');
   * const result = await eko.execute(workflow.taskId);
   *
   * if (result.success) {
   *   console.log('Task completed:', result.result);
   * } else {
   *   console.error('Task failed:', result.error);
   * }
   * ```
   *
   * @remarks
   * Execution phases:
   * 1. **Setup**: Initialize execution context and reset state
   * 2. **Orchestration**: Execute agents in dependency order with parallelization
   * 3. **Monitoring**: Track progress and handle interruptions
   * 4. **Completion**: Aggregate results and record episode in memory
   * 5. **Cleanup**: Release resources and update global state
   */
  public async execute(taskId: string): Promise<EkoResult> {
    const context = this.getTask(taskId);
    if (!context) {
      throw new Error("The task does not exist");
    }
    if (context.pause) {
      context.setPause(false);
    }
    if (context.controller.signal.aborted) {
      context.reset();
    }
    context.conversation = [];

    let result: EkoResult;
    try {
      result = await this.doRunWorkflow(context);
    } catch (e: any) {
      Log.error("execute error", e);
      result = {
        taskId,
        success: false,
        stopReason: e?.name == "AbortError" ? "abort" : "error",
        result:
          typeof e == "string"
            ? e
            : e instanceof Error
              ? e.name + ": " + e.message
              : String(e || "Unknown error"),
        error: e,
      };
    }

    // Auto-record episode if episodic memory is enabled
    if (this.config.episodicMemory) {
      try {
        await this.ensureMemoryReady(); // Wait for init to complete

        const actions = this.extractActions(context);
        const errorType = result.success ? undefined : this.extractErrorType(result.error);

        await this.config.episodicMemory.recordEpisode({
          goal: context.chain.taskPrompt || context.workflow?.taskPrompt || "Unknown task",
          plan: context.workflow?.thought,
          actions,
          outcome: result.result,
          success: result.success,
          errorType,
          metadata: {
            taskId: result.taskId,
            stopReason: result.stopReason,
          },
        });
      } catch (memoryError) {
        Log.error("Failed to record episode:", memoryError);
        // Don't fail the task if memory recording fails
      }
    }

    return result;
  }

  /**
   * Convenience method to plan and execute a task in a single call
   *
   * This is the primary entry point for most use cases, combining workflow generation
   * and execution into a single operation for simplicity.
   *
   * @param taskPrompt - Natural language description of the task to accomplish
   * @param taskId - Unique identifier for this task (auto-generated if not provided)
   * @param contextParams - Initial variables to inject into task context
   * @returns Execution result with success status and output data
   *
   * @throws Error if planning or execution fails
   *
   * @example
   * ```typescript
   * const result = await eko.run('Find the latest TypeScript features and create a summary');
   *
   * if (result.success) {
   *   console.log('Summary generated:', result.result);
   * } else {
   *   console.error('Task failed:', result.stopReason);
   * }
   * ```
   *
   * @remarks
   * This method internally calls `generate()` followed by `execute()`. For advanced
   * use cases requiring workflow inspection or modification between planning and
   * execution, use the separate methods instead.
   */
  public async run(
    taskPrompt: string,
    taskId: string = uuidv4(),
    contextParams?: Record<string, any>
  ): Promise<EkoResult> {
    await this.generate(taskPrompt, taskId, contextParams);
    return await this.execute(taskId);
  }

  public async initContext(
    workflow: Workflow,
    contextParams?: Record<string, any>
  ): Promise<TaskContext> {
    const agents = this.config.agents || [];
    const chain: Chain = new Chain(workflow.taskPrompt || workflow.name);
    const context = new TaskContext(
      this.chatId,
      workflow.taskId,
      this.config,
      agents,
      chain
    );
    if (this.config.a2aClient) {
      const a2aList = await this.config.a2aClient.listAgents(
        workflow.taskPrompt || workflow.name
      );
      context.agents = mergeAgents(context.agents, a2aList);
    }
    if (contextParams) {
      Object.keys(contextParams).forEach((key) =>
        context.variables.set(key, contextParams[key])
      );
    }
    context.workflow = workflow;
    global.taskMap.set(workflow.taskId, context);
    return context;
  }

  /**
   * Core workflow execution engine implementing agent orchestration logic
   *
   * This private method handles the complex orchestration of agent execution including:
   * - Sequential and parallel agent execution based on workflow dependencies
   * - Dynamic replanning in expert mode when execution deviates from plan
   * - Workflow modification handling during execution
   * - Result aggregation from multiple agent outputs
   *
   * @param context - Task execution context containing workflow and state
   * @returns Aggregated execution result from all agents in the workflow
   *
   * @remarks
   * The execution follows a tree-walking algorithm:
   * 1. Build execution tree from workflow agent dependencies
   * 2. Traverse tree depth-first, executing agents as dependencies are met
   * 3. Handle parallel branches concurrently when possible
   * 4. Aggregate results from leaf nodes up through the tree
   * 5. Support dynamic workflow modifications during execution
   */
  private async doRunWorkflow(context: TaskContext): Promise<EkoResult> {
    const agents = context.agents as Agent[];
    const workflow = context.workflow as Workflow;
    if (!workflow || workflow.agents.length == 0) {
      throw new Error("Workflow error");
    }
    const agentNameMap = agents.reduce((map, item) => {
      map[item.Name] = item;
      return map;
    }, {} as { [key: string]: Agent });
    let agentTree = buildAgentTree(workflow.agents);
    const results: string[] = [];
    while (true) {
      await context.checkAborted();
      let lastAgent: Agent | undefined;
      if (agentTree.type === "normal") {
        // normal agent
        const agent = agentNameMap[agentTree.agent.name];
        if (!agent) {
          throw new Error("Unknown Agent: " + agentTree.agent.name);
        }
        lastAgent = agent;
        const agentNode = agentTree.agent;
        const agentChain = new AgentChain(agentNode);
        context.chain.push(agentChain);
        agentTree.result = await this.runAgent(
          context,
          agent,
          agentTree,
          agentChain
        );
        results.push(agentTree.result);
      } else {
        // parallel agent
        const parallelAgents = agentTree.agents;
        const doRunAgent = async (
          agentNode: NormalAgentNode,
          index: number
        ) => {
          const agent = agentNameMap[agentNode.agent.name];
          if (!agent) {
            throw new Error("Unknown Agent: " + agentNode.agent.name);
          }
          lastAgent = agent;
          const agentChain = new AgentChain(agentNode.agent);
          context.chain.push(agentChain);
          const result = await this.runAgent(
            context,
            agent,
            agentNode,
            agentChain
          );
          return { result: result, agentChain, index };
        };
        let agent_results: string[] = [];
        let agentParallel = context.variables.get("agentParallel");
        if (agentParallel === undefined) {
          agentParallel = config.agentParallel;
        }
        if (agentParallel) {
          // parallel execution
          const parallelResults = await Promise.all(
            parallelAgents.map((agent, index) => doRunAgent(agent, index))
          );
          parallelResults.sort((a, b) => a.index - b.index);
          parallelResults.forEach(({ agentChain }) => {
            context.chain.push(agentChain);
          });
          agent_results = parallelResults.map(({ result }) => result);
        } else {
          // serial execution
          for (let i = 0; i < parallelAgents.length; i++) {
            const { result, agentChain } = await doRunAgent(
              parallelAgents[i],
              i
            );
            context.chain.push(agentChain);
            agent_results.push(result);
          }
        }
        results.push(agent_results.join("\n\n"));
      }
      context.conversation.splice(0, context.conversation.length);
      if (
        config.mode == "expert" &&
        !workflow.modified &&
        agentTree.nextAgent &&
        lastAgent?.AgentContext &&
        (await checkTaskReplan(lastAgent.AgentContext))
      ) {
        // replan
        await replanWorkflow(lastAgent.AgentContext);
      }
      if (workflow.modified) {
        workflow.modified = false;
        agentTree = buildAgentTree(
          workflow.agents.filter((agent) => agent.status == "init")
        );
        continue;
      }
      if (!agentTree.nextAgent) {
        break;
      }
      agentTree = agentTree.nextAgent;
    }
    return {
      success: true,
      stopReason: "done",
      taskId: context.taskId,
      result: results[results.length - 1] || "",
    };
  }

  /**
   * Executes a single agent within the workflow orchestration
   *
   * This method manages the lifecycle of individual agent execution including:
   * - Status tracking and progress reporting
   * - Error handling with proper status updates
   * - Streaming callbacks for real-time monitoring
   * - Result integration into the execution chain
   *
   * @param context - Task execution context
   * @param agent - The agent instance to execute
   * @param agentNode - Node in the execution tree containing agent metadata
   * @param agentChain - Chain context for this agent's execution
   * @returns The agent's output result as a string
   *
   * @throws Propagates agent execution errors after proper status cleanup
   *
   * @remarks
   * Agent execution involves multiple phases:
   * 1. **Pre-execution**: Update status to 'running' and notify callbacks
   * 2. **Execution**: Delegate to agent's run method with full context
   * 3. **Post-execution**: Update status and results, notify completion
   * 4. **Error handling**: Mark as failed and re-throw with context
   */
  protected async runAgent(
    context: TaskContext,
    agent: Agent,
    agentNode: NormalAgentNode,
    agentChain: AgentChain
  ): Promise<string> {
    try {
      agentNode.agent.status = "running";
      this.config.callback &&
        (await this.config.callback.onMessage(
          {
            streamType: "agent",
            chatId: context.chatId,
            taskId: context.taskId,
            agentName: agentNode.agent.name,
            nodeId: agentNode.agent.id,
            type: "agent_start",
            agentNode: agentNode.agent,
          },
          agent.AgentContext
        ));
      agentNode.result = await agent.run(context, agentChain);
      agentNode.agent.status = "done";
      this.config.callback &&
        (await this.config.callback.onMessage(
          {
            streamType: "agent",
            chatId: context.chatId,
            taskId: context.taskId,
            agentName: agentNode.agent.name,
            nodeId: agentNode.agent.id,
            type: "agent_result",
            agentNode: agentNode.agent,
            result: agentNode.result,
          },
          agent.AgentContext
        ));
      return agentNode.result;
    } catch (e) {
      agentNode.agent.status = "error";
      this.config.callback &&
        (await this.config.callback.onMessage(
          {
            streamType: "agent",
            chatId: context.chatId,
            taskId: context.taskId,
            agentName: agentNode.agent.name,
            nodeId: agentNode.agent.id,
            type: "agent_result",
            agentNode: agentNode.agent,
            error: e,
          },
          agent.AgentContext
        ));
      throw e;
    }
  }

  /**
   * Retrieves the execution context for a specific task
   *
   * @param taskId - Unique identifier of the task
   * @returns Task context if found, undefined otherwise
   *
   * @remarks
   * Task contexts contain the complete execution state including:
   * - Workflow definition and current execution status
   * - Variable storage and conversation history
   * - Agent instances and their current state
   * - Execution chain with intermediate results
   */
  public getTask(taskId: string): TaskContext | undefined {
    return global.taskMap.get(taskId);
  }

  public getAllTaskId(): string[] {
    return [...global.taskMap.keys()];
  }

  public deleteTask(taskId: string): boolean {
    this.abortTask(taskId);
    const context = global.taskMap.get(taskId);
    if (context) {
      context.variables.clear();
    }
    return global.taskMap.delete(taskId);
  }

  public abortTask(taskId: string, reason?: string): boolean {
    const context = global.taskMap.get(taskId);
    if (context) {
      context.setPause(false);
      this.onTaskStatus(context, "abort", reason);
      context.controller.abort(reason);
      return true;
    } else {
      return false;
    }
  }

  /**
   * Pauses or resumes task execution
   *
   * This method provides fine-grained control over task execution, allowing users to
   * temporarily halt execution for inspection, modification, or external coordination.
   *
   * @param taskId - Identifier of the task to control
   * @param pause - True to pause, false to resume
   * @param abortCurrentStep - When pausing, whether to abort the currently running agent
   * @param reason - Optional reason for the pause/resume operation
   * @returns True if operation succeeded, false if task not found
   *
   * @example
   * ```typescript
   * // Pause execution for user review
   * eko.pauseTask('task-123', true, false, 'User requested review');
   *
   * // Resume after modifications
   * eko.pauseTask('task-123', false);
   * ```
   *
   * @remarks
   * Pause behavior:
   * - **Graceful pause**: Completes current agent execution before pausing
   * - **Abort pause**: Immediately stops current agent and pauses
   * - **Resume**: Continues execution from the next pending agent
   */
  public pauseTask(
    taskId: string,
    pause: boolean,
    abortCurrentStep?: boolean,
    reason?: string
  ): boolean {
    const context = global.taskMap.get(taskId);
    if (context) {
      this.onTaskStatus(context, pause ? "pause" : "resume-pause", reason);
      context.setPause(pause, abortCurrentStep);
      return true;
    } else {
      return false;
    }
  }

  /**
   * Adds a user message to a task's conversation history
   *
   * This enables interactive task modification and clarification during execution.
   * Agents can access conversation history to understand user intent and adapt behavior.
   *
   * @param taskId - Identifier of the task to chat with
   * @param userPrompt - User's message or clarification
   * @returns Updated conversation history, or undefined if task not found
   *
   * @example
   * ```typescript
   * // Add clarification during execution
   * eko.chatTask('task-123', 'Please focus on the last 3 months of data');
   *
   * // Continue execution with new context
   * await eko.execute('task-123');
   * ```
   *
   * @remarks
   * Conversation history is used by:
   * - Agents to understand user intent and preferences
   * - Replanning logic to incorporate user feedback
   * - Memory systems to record interactive task evolution
   */
  public chatTask(taskId: string, userPrompt: string): string[] | undefined {
    const context = global.taskMap.get(taskId);
    if (context) {
      context.conversation.push(userPrompt);
      return context.conversation;
    }
  }

  public addAgent(agent: Agent): void {
    this.config.agents = this.config.agents || [];
    this.config.agents.push(agent);
  }

  private async onTaskStatus(
    context: TaskContext,
    status: string,
    reason?: string
  ) {
    const [agent] = context.currentAgent() || [];
    if (agent) {
      const onTaskStatus = (agent as any)["onTaskStatus"];
      if (onTaskStatus) {
        await onTaskStatus.call(agent, status, reason);
      }
    }
  }

  /**
   * Extracts action/tool names from execution context for memory recording
   *
   * This method analyzes conversation history and workflow execution to identify
   * which tools and capabilities were actually used during task execution.
   * The extracted actions are stored in episodic memory to improve future planning.
   *
   * @param context - Task execution context to analyze
   * @returns Array of action names that were performed during execution
   *
   * @remarks
   * Action extraction uses multiple strategies:
   * 1. **Conversation analysis**: Parse agent messages for tool call patterns
   * 2. **Workflow inspection**: Include successfully executed agent names
   * 3. **Fallback**: Return generic 'task_execution' if no specific actions found
   *
   * This enables the memory system to learn which tools are effective for
   * different types of tasks and user requests.
   */
  private extractActions(context: TaskContext): string[] {
    const actions: string[] = [];
    const seen = new Set<string>();

    // Extract from conversation (which contains agent messages)
    for (const msg of context.conversation) {
      if (typeof msg === 'string') {
        // Simple heuristic: look for tool call patterns
        const toolMatches = msg.match(/(?:calling|using|executing)\s+(\w+)/gi);
        if (toolMatches) {
          for (const match of toolMatches) {
            const toolName = match.split(/\s+/).pop();
            if (toolName && !seen.has(toolName)) {
              actions.push(toolName);
              seen.add(toolName);
            }
          }
        }
      }
    }

    // Also check workflow agents as a proxy for high-level actions
    if (context.workflow) {
      for (const agent of context.workflow.agents) {
        if (agent.status === 'done' && !seen.has(agent.name)) {
          actions.push(agent.name);
          seen.add(agent.name);
        }
      }
    }

    return actions.length > 0 ? actions : ['task_execution'];
  }

  /**
   * Categorizes error types for memory-driven learning and debugging
   *
   * Extracts standardized error type information from various error formats
   * to enable pattern recognition in episodic memory and improve error handling.
   *
   * @param error - Error object or value to categorize
   * @returns Standardized error type string, or undefined if no error
   *
   * @remarks
   * Error categorization helps the system learn from failures by:
   * - Identifying common failure patterns across tasks
   * - Suggesting alternative approaches for known error types
   * - Improving agent selection based on historical success rates
   */
  private extractErrorType(error: unknown): string | undefined {
    if (!error) return undefined;

    if (error instanceof Error) {
      return error.name === 'Error' ? error.message.split(':')[0] : error.name;
    }

    if (typeof error === 'string') {
      return error.split(':')[0].trim();
    }

    return 'UnknownError';
  }
}
