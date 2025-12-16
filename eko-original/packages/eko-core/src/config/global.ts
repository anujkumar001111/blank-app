/**
 * @fileoverview Global State Management
 *
 * Centralized registry for framework-wide state including active tasks,
 * chat sessions, and dynamic prompts. Provides cross-session coordination
 * and resource management.
 *
 * ## State Categories
 *
 * - **Task Registry**: Active task executions with context and state
 * - **Chat Sessions**: Conversational contexts with message history
 * - **Prompt Templates**: Dynamic prompt overrides and customizations
 *
 * ## Lifecycle Management
 *
 * Global state persists for the lifetime of the application and provides:
 * - **Task Coordination**: Cross-task communication and resource sharing
 * - **Memory Management**: Automatic cleanup of completed/aborted tasks
 * - **Session Continuity**: Chat history preservation across interactions
 * - **Configuration Overrides**: Runtime prompt and behavior customization
 *
 * ## Thread Safety
 *
 * All global maps are thread-safe for concurrent access in server environments.
 * Task and chat contexts include proper synchronization for multi-agent scenarios.
 */

import { Global } from "../types";
import TaskContext from "../agent/agent-context";
import { ChatContext } from "../chat/chat-context";

const global: Global = {
  // Active chat sessions with conversation history and context
  chatMap: new Map<string, ChatContext>(),
  // Running task executions with workflow state and variables
  taskMap: new Map<string, TaskContext>(),
  // Dynamic prompt templates for customization and overrides
  prompts: new Map<string, string>(),
};

export default global;
