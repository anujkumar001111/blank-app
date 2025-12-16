/**
 * @fileoverview Core Type Definitions for Eko Agent Framework
 *
 * This module defines the fundamental data structures and interfaces that govern
 * agent behavior, workflow execution, and system integration. These types provide
 * the contract between components and enable type-safe agent development.
 *
 * ## Type Hierarchy
 *
 * ```
 * EkoConfig                    # Framework configuration
 * ├── LLMs                     # Language model registry
 * ├── Agent[]                  # Available agents
 * ├── EpisodicMemory?          # Learning system
 * └── Callbacks                # Event handlers
 *
 * Workflow                     # Execution plan
 * ├── WorkflowAgent[]          # Agent specifications
 * ├── WorkflowNode[]           # Task definitions
 * └── Dependencies             # Execution ordering
 *
 * AgentStreamMessage           # Real-time updates
 * ├── Agent execution events
 * ├── Tool call notifications
 * └── Progress indicators
 * ```
 */

import { Agent } from "../agent";
import { IMcpClient } from "./mcp.types";
import { IA2aClient } from "../agent/a2a";
import { AgentContext } from "../agent/agent-context";
import { LLMs, ReActStreamMessage } from "./llm.types";
import type { EpisodicMemory } from "../memory/episodic";

/**
 * Main configuration interface for the Eko framework
 *
 * Defines all configurable aspects of the agent orchestration system,
 * including AI models, available agents, external integrations, and behavioral settings.
 *
 * @example
 * ```typescript
 * const config: EkoConfig = {
 *   llms: {
 *     default: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', apiKey: '...' },
 *     fast: { provider: 'openai', model: 'gpt-4o-mini', apiKey: '...' }
 *   },
 *   agents: [new BrowserAgent(), new FileAgent()],
 *   episodicMemory: new EpisodicMemory(new InMemoryStorageProvider()),
 *   callback: {
 *     onMessage: (msg) => console.log('Agent update:', msg)
 *   }
 * };
 * ```
 */
export type EkoConfig = {
  /** Language model configurations indexed by usage context */
  llms: LLMs;
  /** Pre-configured agents available for task execution */
  agents?: Agent[];
  /** LLM configurations specialized for workflow planning */
  planLlms?: string[];
  /** LLM configurations for context compression and summarization */
  compressLlms?: string[];
  /** Callback interfaces for streaming updates and human interaction */
  callback?: AgentStreamCallback & HumanCallback;
  /** Default MCP client for tool discovery across all agents */
  defaultMcpClient?: IMcpClient;
  /** Agent-to-Agent client for dynamic agent discovery */
  a2aClient?: IA2aClient;
  /** Episodic memory system for learning from task executions */
  episodicMemory?: EpisodicMemory;
};

/**
 * Streaming message format for real-time agent execution updates
 *
 * Provides structured notifications about agent lifecycle events, tool usage,
 * and execution progress. Enables building responsive UIs and monitoring systems.
 *
 * @example
 * ```typescript
 * const callback = {
 *   onMessage: (message: AgentStreamMessage) => {
 *     switch (message.type) {
 *       case 'agent_start':
 *         console.log(`Agent ${message.agentName} started task`);
 *         break;
 *       case 'tool_result':
 *         console.log(`Tool ${message.toolName} completed`);
 *         break;
 *       case 'agent_result':
 *         if (message.error) {
 *           console.error(`Agent failed:`, message.error);
 *         } else {
 *           console.log(`Agent completed:`, message.result);
 *         }
 *         break;
 *     }
 *   }
 * };
 * ```
 */
export type AgentStreamMessage = {
  /** Message type identifier (always "agent" for agent-related messages) */
  streamType: "agent";
  /** Unique conversation session identifier */
  chatId: string;
  /** Unique task execution identifier */
  taskId: string; // messageId
  /** Name of the agent sending this message */
  agentName: string;
  /** Optional node identifier within the workflow */
  nodeId?: string | null; // agent nodeId
} & (
  | {
    /** Workflow planning completion notification */
    type: "workflow";
    /** True when workflow planning is finished */
    streamDone: boolean;
    /** The planned workflow structure */
    workflow: Workflow;
  }
  | {
    /** Agent execution start notification */
    type: "agent_start";
    /** Agent node being executed */
    agentNode: WorkflowAgent;
  }
  | ReActStreamMessage // Tool call and reasoning messages
  | {
    /** Agent execution completion notification */
    type: "agent_result";
    /** Agent node that completed */
    agentNode: WorkflowAgent;
    /** Error if execution failed */
    error?: any;
    /** Result string if execution succeeded */
    result?: string;
  }
);

/**
 * Callback interface for receiving real-time agent execution updates
 *
 * Implement this interface to monitor agent progress, handle tool results,
 * and enable human-in-the-loop interactions during task execution.
 */
export interface AgentStreamCallback {
  /**
   * Handles streaming messages from agent execution
   *
   * @param message - Structured message about execution progress or events
   * @param agentContext - Optional execution context for advanced interactions
   *
   * @remarks
   * Common use cases:
   * - **Progress tracking**: Update UI with execution status
   * - **Logging**: Record execution events for debugging/analysis
   * - **Human intervention**: Present choices or request input
   * - **Result processing**: Handle intermediate or final results
   */
  onMessage: (
    message: AgentStreamMessage,
    agentContext?: AgentContext | undefined
  ) => Promise<void>;
}

/**
 * Basic workflow node containing text-based task instructions
 *
 * Represents the fundamental unit of work in a workflow - a text description
 * that an agent will execute, potentially with input/output variable bindings.
 *
 * @example
 * ```typescript
 * const node: WorkflowTextNode = {
 *   type: "normal",
 *   text: "Search for the latest news about artificial intelligence",
 *   input: "search_query",    // Variable containing search terms
 *   output: "search_results"  // Variable to store results
 * };
 * ```
 */
export type WorkflowTextNode = {
  /** Node type identifier */
  type: "normal";
  /** Task description or instructions for the agent */
  text: string;
  /** Optional variable name for input data */
  input?: string | null;
  /** Optional variable name for output data */
  output?: string | null;
};

/**
 * Workflow node that iterates over a collection of items
 *
 * Enables batch processing by executing a set of nodes repeatedly for each item
 * in a collection. The iteration variable is available to child nodes.
 *
 * @example
 * ```typescript
 * const node: WorkflowForEachNode = {
 *   type: "forEach",
 *   items: "product_list",  // Variable containing array of products
 *   nodes: [
 *     {
 *       type: "normal",
 *       text: "Analyze product pricing and competition",
 *       input: "current_item",   // Automatically set to current iteration item
 *       output: "analysis_result"
 *     }
 *   ]
 * };
 * ```
 */
export type WorkflowForEachNode = {
  /** Node type identifier */
  type: "forEach";
  /** Variable name containing the collection to iterate over */
  items: string; // list or variable name
  /** Child nodes to execute for each item in the collection */
  nodes: WorkflowNode[];
};

/**
 * Workflow node that monitors for events and triggers execution
 *
 * Sets up event-driven execution that watches for changes in the environment
 * (DOM updates, file system changes, GUI events) and executes trigger nodes
 * when events occur. Can operate in one-shot or continuous monitoring mode.
 *
 * @example
 * ```typescript
 * const node: WorkflowWatchNode = {
 *   type: "watch",
 *   event: "file",
 *   loop: true,  // Continuous monitoring
 *   description: "Monitor for new data files in upload directory",
 *   triggerNodes: [
 *     {
 *       type: "normal",
 *       text: "Process the new data file and update dashboard",
 *       input: "new_file_path"
 *     }
 *   ]
 * };
 * ```
 */
export type WorkflowWatchNode = {
  /** Node type identifier */
  type: "watch";
  /** Type of event to monitor */
  event: "dom" | "gui" | "file";
  /** Whether to continue monitoring after first trigger (true) or stop after one execution (false) */
  loop: boolean;
  /** Human-readable description of what is being watched */
  description: string;
  /** Nodes to execute when the event is triggered */
  triggerNodes: (WorkflowTextNode | WorkflowForEachNode)[];
};

export type WorkflowNode =
  | WorkflowTextNode
  | WorkflowForEachNode
  | WorkflowWatchNode;

/**
 * Agent specification within a workflow execution plan
 *
 * Defines a single agent's role, responsibilities, and execution requirements
 * within the broader workflow. Includes dependency management and status tracking.
 *
 * @example
 * ```typescript
 * const agent: WorkflowAgent = {
 *   id: "research-agent-001",
 *   name: "ResearchAgent",
 *   task: "Gather information about renewable energy trends",
 *   dependsOn: [],  // No dependencies - can run immediately
 *   nodes: [
 *     {
 *       type: "normal",
 *       text: "Search for recent articles about solar and wind energy",
 *       output: "research_results"
 *     }
 *   ],
 *   parallel: false,  // Sequential execution
 *   status: "init",
 *   xml: '<agent name="ResearchAgent"><task>Gather information...</task></agent>'
 * };
 * ```
 */
export type WorkflowAgent = {
  /** Unique identifier for this agent within the workflow */
  id: string;
  /** Agent type/class name for execution */
  name: string;
  /** High-level task description for this agent */
  task: string;
  /** IDs of agents that must complete before this agent can start */
  dependsOn: string[];
  /** Execution nodes defining the agent's work breakdown */
  nodes: WorkflowNode[];
  /** Whether this agent can run in parallel with others */
  parallel?: boolean;
  /** Current execution status */
  status: "init" | "running" | "done" | "error";
  /** XML representation of the agent specification */
  xml: string; // <agent name="xxx">...</agent>
};

/**
 * Complete workflow execution plan generated from natural language task
 *
 * Represents the structured execution strategy created by the planner, including
 * all agents, their dependencies, and the reasoning behind the plan structure.
 *
 * @example
 * ```typescript
 * const workflow: Workflow = {
 *   taskId: "task-123",
 *   name: "Market Research Analysis",
 *   thought: "To analyze market trends, I need to: 1) Gather data from multiple sources, 2) Analyze patterns, 3) Generate report",
 *   agents: [
 *     {
 *       id: "data-collector",
 *       name: "DataCollectionAgent",
 *       task: "Gather market data from web sources",
 *       dependsOn: [], // No dependencies - can run immediately
 *       nodes: [], // Task execution nodes
 *       status: "init",
 *       xml: "<agent name=\"DataCollectionAgent\">...</agent>"
 *     }
 *   ],
 *   xml: "<workflow>...</workflow>",
 *   modified: false,
 *   taskPrompt: "Analyze current market trends in renewable energy"
 * };
 * ```
 */
export type Workflow = {
  /** Unique identifier for this workflow execution */
  taskId: string;
  /** Human-readable workflow name */
  name: string;
  /** Planner's reasoning about why this workflow structure was chosen */
  thought: string;
  /** Ordered array of agents to execute with their specifications */
  agents: WorkflowAgent[];
  /** XML representation of the complete workflow */
  xml: string;
  /** Flag indicating if workflow has been modified during execution */
  modified?: boolean;
  /** Original natural language task prompt that generated this workflow */
  taskPrompt?: string;
};

/**
 * Human-in-the-loop interaction callbacks
 *
 * Enables agents to request human assistance, confirmation, or input during execution.
 * Supports various interaction patterns for different types of human intervention.
 *
 * @example
 * ```typescript
 * const humanCallbacks: HumanCallback = {
 *   onHumanConfirm: async (context, prompt) => {
 *     const answer = await showConfirmationDialog(prompt);
 *     return answer === 'yes';
 *   },
 *   onHumanInput: async (context, prompt) => {
 *     return await showInputDialog(prompt);
 *   }
 * };
 * ```
 */
export interface HumanCallback {
  /**
   * Requests human confirmation for a proposed action
   *
   * @param agentContext - Current execution context
   * @param prompt - Question requiring yes/no confirmation
   * @param extInfo - Additional context information
   * @returns Promise resolving to true (confirmed) or false (rejected)
   */
  onHumanConfirm?: (
    agentContext: AgentContext,
    prompt: string,
    extInfo?: any
  ) => Promise<boolean>;

  /**
   * Requests free-form text input from human
   *
   * @param agentContext - Current execution context
   * @param prompt - Question or instruction for input
   * @param extInfo - Additional context information
   * @returns Promise resolving to user's text input
   */
  onHumanInput?: (
    agentContext: AgentContext,
    prompt: string,
    extInfo?: any
  ) => Promise<string>;

  /**
   * Requests human selection from provided options
   *
   * @param agentContext - Current execution context
   * @param prompt - Question or instruction for selection
   * @param options - Array of available choices
   * @param multiple - Whether multiple selections are allowed
   * @param extInfo - Additional context information
   * @returns Promise resolving to array of selected option(s)
   */
  onHumanSelect?: (
    agentContext: AgentContext,
    prompt: string,
    options: string[],
    multiple?: boolean,
    extInfo?: any
  ) => Promise<string[]>;

  /**
   * Requests specific types of human assistance
   *
   * @param agentContext - Current execution context
   * @param helpType - Type of assistance needed
   * @param prompt - Description of the assistance request
   * @param extInfo - Additional context information
   * @returns Promise resolving to true if help was provided
   */
  onHumanHelp?: (
    agentContext: AgentContext,
    helpType: "request_login" | "request_assistance",
    prompt: string,
    extInfo?: any
  ) => Promise<boolean>;
}

/**
 * Result structure returned from task execution
 *
 * Contains the outcome of a completed task execution, including success status,
 * result data, and error information when applicable.
 *
 * @example
 * ```typescript
 * const result: EkoResult = await eko.run('Analyze sales data');
 * if (result.success) {
 *   console.log('Task completed successfully:', result.result);
 * } else {
 *   console.error(`Task ${result.stopReason}:`, result.error);
 * }
 * ```
 */
export type EkoResult = {
  /** Unique identifier of the completed task */
  taskId: string;
  /** Whether the task completed successfully */
  success: boolean;
  /** Reason for task termination */
  stopReason: "abort" | "error" | "done";
  /** Final result string from task execution */
  result: string;
  /** Error object if execution failed */
  error?: unknown;
};

/**
 * Execution tree node representing a single agent in the workflow
 *
 * Part of the runtime execution tree that tracks agent execution order,
 * dependencies, and results during workflow orchestration.
 */
export type NormalAgentNode = {
  /** Node type identifier */
  type: "normal";
  /** Agent specification and current status */
  agent: WorkflowAgent;
  /** Next agent to execute after this one completes */
  nextAgent?: AgentNode;
  /** Result produced by this agent's execution */
  result?: string;
};

/**
 * Execution tree node representing parallel agent execution
 *
 * Groups multiple agents that can execute concurrently, improving performance
 * for independent tasks. Results are aggregated when all parallel agents complete.
 */
export type ParallelAgentNode = {
  /** Node type identifier */
  type: "parallel";
  /** Array of agents that can execute in parallel */
  agents: NormalAgentNode[];
  /** Next agent to execute after all parallel agents complete */
  nextAgent?: AgentNode;
  /** Aggregated results from all parallel agent executions */
  result?: string;
};

export type AgentNode = NormalAgentNode | ParallelAgentNode;
