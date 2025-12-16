import config from "../config";
import { Agent } from "../agent";
import global from "../config/global";
import { sub } from "../common/utils";
import TaskContext from "../agent/agent-context";
import { buildAgentRootXml } from "../common/xml";
import { PromptTemplate } from "./prompt-template";
import { WorkflowAgent, Tool, GlobalPromptKey } from "../types";
import { TOOL_NAME as foreach_task } from "../tools/foreach-task";
import { TOOL_NAME as watch_trigger } from "../tools/watch-trigger";
import { TOOL_NAME as human_interact } from "../tools/human-interact";
import { TOOL_NAME as variable_storage } from "../tools/variable-storage";
import { TOOL_NAME as task_node_status } from "../tools/task-node-status";

/**
 * System prompt template for agent behavior and capabilities
 *
 * This template defines the core behavior, constraints, and capabilities that
 * guide agent execution. It adapts dynamically based on available tools and
 * execution context to create contextually appropriate system instructions.
 *
 * ## Template Sections
 *
 * 1. **Identity**: Agent name and description
 * 2. **Capabilities**: Tool availability and usage guidelines
 * 3. **Task Context**: Current task and execution history
 * 4. **Workflow Structure**: XML representation of execution plan
 * 5. **Execution Rules**: Parallel execution and language preferences
 *
 * ## Dynamic Features
 *
 * - **Conditional Tools**: Sections only included when tools are available
 * - **Context Awareness**: Adapts based on workflow complexity and history
 * - **Execution Mode**: Different behavior for single vs multi-agent tasks
 */
const AGENT_SYSTEM_TEMPLATE = `
You are {{name}}, an autonomous AI agent for {{agent}} agent.

# Agent Description
<if description>
{{description}}
</if>
<if extSysPrompt>
{{extSysPrompt}}
</if>
<if ${human_interact}Tool>
* HUMAN INTERACT
During the task execution process, you can use the \`${human_interact}\` tool to interact with humans, please call it in the following situations:
- When performing dangerous operations such as deleting files, confirmation from humans is required.
- When encountering obstacles while accessing websites, such as requiring user login, captcha verification, QR code scanning, or human verification, you need to request manual assistance.
- Please do not use the \`${human_interact}\` tool frequently.
- The \`${human_interact}\` tool does not support parallel calls.
</if>
<if ${variable_storage}Tool>
* VARIABLE STORAGE
When a step node has input/output variable attributes, use the \`${variable_storage}\` tool to read from and write to these variables, these variables enable context sharing and coordination between multiple agents.
The \`${variable_storage}\` tool does not support parallel calls.
</if>
<if ${foreach_task}Tool>
* forEach node
For repetitive tasks, when executing a forEach node, the \`${foreach_task}\` tool must be used. Loop tasks support parallel tool calls, and during parallel execution, this tool needs to be called interspersed throughout the process.
</if>
<if ${watch_trigger}Tool>
* watch node
monitor changes in webpage DOM elements, when executing to the watch node, require the use of the \`${watch_trigger}\` tool.
</if>

<if mainTask>
Main task: {{mainTask}}
</if>
<if preTaskResult>
Pre-task execution results:
<subtask_results>
{{preTaskResult}}
</subtask_results>
</if>

# User input task instructions
<root>
  <!-- Main task, completed through the collaboration of multiple Agents -->
  <mainTask>main task</mainTask>
  <!-- The tasks that the current agent needs to complete, the current agent only needs to complete the currentTask -->
  <currentTask>specific task</currentTask>
  <!-- Complete the corresponding step nodes of the task, Only for reference -->
  <nodes>
    <!-- node supports input/output variables to pass dependencies -->
    <node input="variable name" output="variable name" status="todo / done">task step node</node>
<if hasForEachNode>
    <!-- duplicate task node, items support list and variable -->
    <forEach items="list or variable name">
      <node>forEach item step node</node>
    </forEach>
</if>
<if hasWatchNode>
    <!-- monitor task node, the loop attribute specifies whether to listen in a loop or listen once -->
    <watch event="dom" loop="true">
      <description>Monitor task description</description>
      <trigger>
        <node>Trigger step node</node>
        <node>...</node>
      </trigger>
    </watch>
</if>
  </nodes>
</root>

Current datetime: {{datetime}}
<if canParallelToolCalls>
For maximum efficiency, when executing multiple independent operations that do not depend on each other or conflict with one another, these tools can be called in parallel simultaneously.
</if>
The output language should follow the language corresponding to the user's task.
`;

/**
 * Generates the system prompt for agent execution
 *
 * Constructs a comprehensive system prompt that defines the agent's role,
 * available capabilities, task context, and behavioral guidelines. The prompt
 * adapts based on available tools, workflow complexity, and execution history.
 *
 * @param agent - The agent instance for which to generate the prompt
 * @param agentNode - Current workflow agent node with task specifications
 * @param context - Task execution context with variables and history
 * @param tools - Available tools (defaults to agent's configured tools)
 * @param extSysPrompt - Additional system prompt content to include
 * @returns Complete system prompt string for LLM consumption
 *
 * @remarks
 * System prompt composition includes:
 * - **Agent Identity**: Name, description, and specialized capabilities
 * - **Tool Instructions**: Usage guidelines for available tools
 * - **Task Context**: Current task and previous agent results
 * - **Workflow Structure**: XML representation of execution plan
 * - **Execution Rules**: Parallel execution capabilities and constraints
 * - **Safety Guidelines**: Human interaction requirements for dangerous operations
 */
export function getAgentSystemPrompt(
  agent: Agent,
  agentNode: WorkflowAgent,
  context: TaskContext,
  tools?: Tool[],
  extSysPrompt?: string
): string {
  // Determine available tools and create conditional variables for template
  tools = tools || agent.Tools;
  const toolVars: Record<string, boolean> = {};
  for (let i = 0; i < tools.length; i++) {
    toolVars[tools[i].name + "Tool"] = true;
  }

  // Build context for multi-agent scenarios
  let mainTask = "";
  let preTaskResult = "";
  if (context.chain.agents.length > 1) {
    mainTask = context.chain.taskPrompt.trim();
    preTaskResult = buildPreTaskResult(context);
  }
  const agentSysPrompt =
    global.prompts.get(GlobalPromptKey.agent_system) || AGENT_SYSTEM_TEMPLATE;
  return PromptTemplate.render(agentSysPrompt, {
    name: config.name,
    agent: agent.Name,
    description: agent.Description,
    extSysPrompt: extSysPrompt?.trim() || "",
    mainTask: mainTask,
    preTaskResult: preTaskResult.trim(),
    hasWatchNode: agentNode.xml.indexOf("</watch>") > -1,
    hasForEachNode: agentNode.xml.indexOf("</forEach>") > -1,
    canParallelToolCalls: agent.canParallelToolCalls(),
    datetime: context.variables.get("datetime") || new Date().toLocaleString(),
    ...toolVars,
  }).trim();
}

/**
 * Builds summary of previous agent execution results for context
 *
 * Creates a structured summary of completed agent tasks to provide context
 * for subsequent agents in multi-agent workflows. Includes task descriptions
 * and truncated results for efficient context passing.
 *
 * @param context - Task execution context with agent chain history
 * @returns XML-formatted string of previous agent results
 *
 * @remarks
 * Result formatting:
 * - **Truncation**: Long results limited to 600 characters to manage context size
 * - **Structure**: XML format for consistent parsing by agents
 * - **Filtering**: Only includes agents with completed results
 */
function buildPreTaskResult(context: TaskContext): string {
  let preTaskResult = "";
  for (let i = 0; i < context.chain.agents.length; i++) {
    const agentChain = context.chain.agents[i];
    if (agentChain.agentResult) {
      preTaskResult += `<subtask_result agent="${
        agentChain.agent.name
      }">\nSubtask: ${agentChain.agent.task}\nResult: ${sub(
        agentChain.agentResult,
        600
      ).trim()}\n</subtask_result>`;
    }
  }
  return preTaskResult.trim();
}

/**
 * Generates the user prompt containing task instructions and workflow structure
 *
 * Creates the user-facing prompt that provides the agent with specific task
 * instructions, workflow structure, and execution context in XML format.
 *
 * @param agent - The agent for which to generate the prompt
 * @param agentNode - Current workflow agent node with task details
 * @param context - Task execution context
 * @param tools - Available tools (used to determine status attributes)
 * @returns XML-formatted user prompt with task instructions and workflow structure
 *
 * @remarks
 * User prompt includes:
 * - **Task Description**: Natural language task requirements
 * - **Workflow XML**: Structured representation of execution plan
 * - **Node Status**: Current execution state when status tool is available
 * - **Dependencies**: Input/output variable relationships between nodes
 */
export function getAgentUserPrompt(
  agent: Agent,
  agentNode: WorkflowAgent,
  context: TaskContext,
  tools?: Tool[]
): string {
  const hasTaskNodeStatusTool =
    (tools || agent.Tools).filter((tool) => tool.name == task_node_status)
      .length > 0;
  return buildAgentRootXml(
    agentNode.xml,
    context.chain.taskPrompt,
    (nodeId, node) => {
      if (hasTaskNodeStatusTool) {
        node.setAttribute("status", "todo");
      }
    }
  );
}
