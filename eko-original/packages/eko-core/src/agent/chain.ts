/**
 * @fileoverview Execution Chain Tracking and Orchestration
 *
 * Provides hierarchical tracking of task execution from planning through
 * agent execution to individual tool calls. Enables observability, debugging,
 * and real-time progress monitoring of complex workflows.
 *
 * ## Chain Hierarchy
 *
 * ```
 * Chain (Task Level)
 * ├── planRequest/planResult (Planning phase)
 * └── AgentChain[] (Agent executions)
 *     ├── agentRequest/agentResult (Agent LLM calls)
 *     └── ToolChain[] (Tool executions)
 *         ├── params (Tool arguments)
 *         └── toolResult (Tool outputs)
 * ```
 *
 * ## Event System
 *
 * Chains use an observer pattern to notify listeners of execution progress,
 * enabling UI updates, logging, and external integrations.
 */

import { ToolResult } from "../types/tools.types";
import { LLMRequest } from "../types/llm.types";
import { WorkflowAgent } from "../types/agent.types";
import { LanguageModelV2ToolCallPart } from "@ai-sdk/provider";

/** Chain event types for execution tracking */
type ChainEvent = {
  type: "update";
  target: AgentChain | ToolChain;
};

/** Callback interface for chain event listeners */
interface Callback {
  (chain: Chain, event: ChainEvent): void;
}

/**
 * Tool Execution Chain - Tracks individual tool calls within agent execution
 *
 * Represents a single tool invocation within an agent's execution, maintaining
 * the complete lifecycle from LLM tool call request through parameter processing
 * to result generation. Essential for debugging and observability.
 *
 * ## Execution Lifecycle
 *
 * 1. **Creation**: LLM requests tool execution
 * 2. **Parameter Processing**: Arguments parsed and validated
 * 3. **Execution**: Tool runs with provided parameters
 * 4. **Result Capture**: Output stored for agent reasoning
 * 5. **Event Notification**: Updates propagated to listeners
 */
export class ToolChain {
  /** Name of the tool being executed */
  readonly toolName: string;
  /** Unique identifier for this tool call instance */
  readonly toolCallId: string;
  /** Original LLM request that initiated this tool call */
  readonly request: LLMRequest;
  /** Processed tool parameters (set after parsing) */
  params?: Record<string, unknown>;
  /** Tool execution result (set after completion) */
  toolResult?: ToolResult;
  /** Update callback for event propagation */
  onUpdate?: () => void;

  /**
   * Creates a new tool chain for tracking tool execution
   *
   * @param toolUse - LLM tool call request with metadata
   * @param request - Complete LLM request context for debugging
   */
  constructor(toolUse: LanguageModelV2ToolCallPart, request: LLMRequest) {
    this.toolName = toolUse.toolName;
    this.toolCallId = toolUse.toolCallId;
    this.request = JSON.parse(JSON.stringify(request)); // Deep copy for immutability
  }

  /**
   * Updates tool parameters after parsing/validation
   *
   * @param params - Processed and validated tool arguments
   */
  updateParams(params: Record<string, unknown>): void {
    this.params = params;
    this.onUpdate && this.onUpdate();
  }

  /**
   * Records tool execution result
   *
   * @param toolResult - Complete tool execution outcome
   */
  updateToolResult(toolResult: ToolResult): void {
    this.toolResult = toolResult;
    this.onUpdate && this.onUpdate();
  }
}

/**
 * Agent Execution Chain - Tracks complete agent lifecycle within workflow
 *
 * Represents one agent's execution within a larger workflow, maintaining the
 * complete execution history from initial LLM call through tool usage to final
 * result. Provides hierarchical organization of complex multi-agent tasks.
 *
 * ## Agent Execution Flow
 *
 * 1. **Initialization**: Agent receives task from workflow
 * 2. **LLM Interaction**: Agent makes reasoning calls to LLM
 * 3. **Tool Orchestration**: Agent executes tools as needed
 * 4. **Result Synthesis**: Agent produces final output
 * 5. **Chain Completion**: Execution context preserved for debugging
 */
export class AgentChain {
  /** Workflow agent specification and metadata */
  agent: WorkflowAgent;
  /** All tool executions performed by this agent */
  tools: ToolChain[] = [];
  /** Original LLM request that initiated agent execution */
  agentRequest?: LLMRequest;
  /** Final result produced by agent execution */
  agentResult?: string;
  /** Event callback for execution tracking */
  onUpdate?: (event: ChainEvent) => void;

  /**
   * Creates a new agent chain for execution tracking
   *
   * @param agent - Workflow agent definition with task and metadata
   */
  constructor(agent: WorkflowAgent) {
    this.agent = agent;
  }

  /**
   * Adds a tool execution to this agent's chain
   *
   * Registers a tool call within the agent's execution context and sets up
   * event propagation for real-time monitoring.
   *
   * @param tool - Tool chain representing the tool execution
   */
  push(tool: ToolChain): void {
    // Wire tool updates to propagate through agent chain
    tool.onUpdate = () => {
      this.onUpdate &&
        this.onUpdate({
          type: "update",
          target: tool,
        });
    };
    this.tools.push(tool);

    // Notify listeners of agent chain update
    this.onUpdate &&
      this.onUpdate({
        type: "update",
        target: this,
      });
  }
}

/**
 * Task Execution Chain - Top-level orchestrator for complete task execution
 *
 * Represents the entire execution lifecycle of a task from initial planning
 * through agent orchestration to final result. Provides the root context for
 * hierarchical execution tracking and event propagation.
 *
 * ## Chain Structure
 *
 * - **Planning Phase**: planRequest → planResult (workflow generation)
 * - **Execution Phase**: AgentChain[] (parallel/serial agent execution)
 * - **Event System**: Observer pattern for real-time progress updates
 *
 * ## Use Cases
 *
 * - **Execution Tracking**: Complete audit trail of task execution
 * - **Debugging**: Step-by-step execution analysis and replay
 * - **Monitoring**: Real-time progress updates and status reporting
 * - **Persistence**: Execution state serialization for resumption
 */
export default class Chain {
  /** Original natural language task description */
  taskPrompt: string;
  /** LLM request used for workflow planning */
  planRequest?: LLMRequest;
  /** Generated workflow plan/result from planning phase */
  planResult?: string;
  /** All agent executions within this task */
  agents: AgentChain[] = [];
  /** Registered event listeners for execution tracking */
  private listeners: Callback[] = [];

  /**
   * Creates a new execution chain for task tracking
   *
   * @param taskPrompt - Natural language description of the task to execute
   */
  constructor(taskPrompt: string) {
    this.taskPrompt = taskPrompt;
  }

  /**
   * Adds an agent execution to the task chain
   *
   * Registers an agent within the task's execution context and wires up
   * event propagation for comprehensive execution tracking.
   *
   * @param agent - Agent chain representing one agent's execution
   */
  push(agent: AgentChain): void {
    // Wire agent updates to propagate to task-level listeners
    agent.onUpdate = (event: ChainEvent) => {
      this.pub(event);
    };
    this.agents.push(agent);

    // Notify listeners of new agent addition
    this.pub({
      type: "update",
      target: agent,
    });
  }

  /**
   * Publishes chain events to all registered listeners
   *
   * @param event - Chain event with type and target information
   * @private
   */
  private pub(event: ChainEvent): void {
    this.listeners.forEach((listener) => listener(this, event));
  }

  /**
   * Registers a listener for chain execution events
   *
   * @param callback - Function to call when chain events occur
   */
  public addListener(callback: Callback): void {
    this.listeners.push(callback);
  }

  /**
   * Removes a previously registered event listener
   *
   * @param callback - The callback function to remove
   */
  public removeListener(callback: Callback): void {
    this.listeners = this.listeners.filter((listener) => listener !== callback);
  }
}
