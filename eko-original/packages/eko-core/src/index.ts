/**
 * @fileoverview Eko Core Package - Main API Surface
 *
 * This module exports the primary interfaces and classes for the Eko agent framework.
 * Eko enables natural language-driven workflow automation through composable agents,
 * tools, and memory systems that can operate across multiple platforms.
 *
 * ## Architecture Overview
 *
 * The framework follows a layered architecture:
 * - **Eko**: Main orchestrator for task planning and execution
 * - **Agents**: Specialized AI workers with tools and capabilities
 * - **Tools**: Reusable functions for specific operations (file I/O, web scraping, etc.)
 * - **Memory**: Episodic and semantic storage for learning and context
 * - **MCP**: Model Context Protocol integration for external tool discovery
 * - **Chains**: Execution context and result tracking for complex workflows
 *
 * ## Key Concepts
 *
 * - **Task**: A natural language description of work to be accomplished
 * - **Workflow**: Structured execution plan with agents and dependencies
 * - **Agent**: AI-powered worker with specialized tools and capabilities
 * - **Tool**: Reusable function that agents can invoke to perform actions
 * - **Context**: Execution state including variables, conversation history, and results
 *
 * @example
 * ```typescript
 * import { Eko, BrowserAgent, FileAgent } from '@eko-ai/eko';
 *
 * const eko = new Eko({
 *   llms: { default: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', apiKey: '...' } },
 *   agents: [new BrowserAgent(), new FileAgent()]
 * });
 *
 * const result = await eko.run('Search for latest news and save to file');
 * ```
 */

import config from "./config";
import Log from "./common/log";
import Eko from "./agent/index";
import global from "./config/global";
import { Planner } from "./agent/plan";
import { EkoMemory } from "./memory/memory";
import { EpisodicMemory, InMemoryStorageProvider, OpenAIEmbeddingProvider } from "./memory";
import Chain, { AgentChain } from "./agent/chain";
import { SimpleSseMcpClient, SimpleHttpMcpClient } from "./mcp";
import TaskContext, { AgentContext } from "./agent/agent-context";
import { RetryLanguageModel, callLLM, callWithReAct } from "./llm";

export default Eko;

// Core Framework Classes
export { Eko }; // Main orchestrator for agent workflows
export { Planner }; // Converts natural language tasks into structured workflows
export { Chain, AgentChain }; // Execution context and result tracking

// Memory Systems
export { EkoMemory }; // Unified memory interface
export { EpisodicMemory }; // Records task execution episodes for learning
export { InMemoryStorageProvider, OpenAIEmbeddingProvider }; // Storage and embedding providers

// Context Management
export { TaskContext, AgentContext }; // Execution state and agent-specific context
export { TaskContext as Context }; // Alias for backward compatibility

// MCP Integration
export { SimpleSseMcpClient, SimpleHttpMcpClient }; // MCP protocol clients for tool discovery

// LLM Integration
export { RetryLanguageModel, callLLM, callWithReAct }; // Language model utilities with retry logic

// Utilities
export { Log }; // Centralized logging system
export { config }; // Global configuration management
export { global }; // Global state and task registry

// Chat and Web Capabilities
export {
  ChatAgent, // Conversational agent for chat-based interactions
  ChatContext, // Chat-specific execution context
  WebSearchTool, // Web search and information retrieval
  WebpageQaTool, // Question-answering over web content
  DeepActionTool, // Complex web automation actions
  TaskVariableStorageTool, // Variable management for task state
} from "./chat";

// Agent Framework
export {
  Agent, // Base agent class for custom implementations
  type AgentParams, // Configuration parameters for agent creation
  BaseBrowserAgent, // Browser automation with DOM interaction
  BaseBrowserLabelsAgent, // Browser automation with accessibility labels
  BaseBrowserScreenAgent, // Browser automation with visual/screen understanding
} from "./agent";

// Built-in Tools
export {
  ForeachTaskTool, // Iterate over collections and execute sub-tasks
  WatchTriggerTool, // Monitor file system or DOM changes
  HumanInteractTool, // Human-in-the-loop interaction capabilities
  TaskNodeStatusTool, // Query and update task execution status
  VariableStorageTool, // Store and retrieve task variables
  HttpRequestTool, // Make HTTP requests and handle responses
} from "./tools";

// Service Interfaces
export type { ChatService, BrowserService } from "./service"; // Service contracts for chat and browser operations
// Memory System Types
export type {
  Episode, // Recorded task execution for learning
  EpisodicMemoryConfig, // Memory system configuration
  EpisodicStorageProvider, // Storage backend interface
  EmbeddingProvider // Vector embedding service interface
} from "./memory";

// Core Type Definitions
export {
  type LLMs, // Language model configuration registry
  type LLMRequest, // Request structure for LLM calls
  type HumanCallback, // Human interaction callback interfaces
  type Workflow, // Structured execution plan with agents and dependencies
  type EkoConfig, // Main framework configuration
  type WorkflowNode, // Individual node in workflow execution tree
  type WorkflowAgent, // Agent definition within a workflow
  type AgentStreamMessage, // Streaming message format for real-time updates
  type AgentStreamCallback, // Callback interface for streaming updates
  type AgentStreamCallback as StreamCallback, // Alias for backward compatibility
  type AgentStreamMessage as StreamCallbackMessage, // Alias for backward compatibility
} from "./types";

// Utility Functions
export {
  sub, // String substitution utilities
  uuidv4, // Generate unique identifiers
  toFile, // Convert data to file format
  toImage, // Convert data to image format
  mergeTools, // Combine tool collections without duplicates
  call_timeout, // Execute functions with timeout protection
  compressImageData, // Image compression utilities
  convertToolSchema, // Transform tool schemas between formats
} from "./common/utils";

// Workflow XML Utilities
export {
  parseWorkflow, // Parse XML workflow definitions
  resetWorkflowXml, // Reset workflow XML to initial state
  buildSimpleAgentWorkflow, // Create basic single-agent workflows
} from "./common/xml";

// Workflow Execution
export { buildAgentTree } from "./common/tree"; // Build execution tree from workflow agents

// Prompt Engineering
export { PromptTemplate } from "./prompt/prompt-template"; // Template system for prompt generation

// Browser Utilities
export { extract_page_content } from "./agent/browser/utils"; // Extract structured content from web pages
