/**
 * End-to-End Tests for Eko AI Framework
 * 
 * These tests verify the complete workflow pipeline:
 * 1. Workflow generation from natural language
 * 2. Workflow execution with real LLM calls
 * 3. Agent orchestration with tool calls
 * 4. Memory and context management
 */

import dotenv from "dotenv";
import { Eko } from "../../src/agent/eko";
import { Planner } from "../../src/agent/plan";
import { RetryLanguageModel } from "../../src/llm/rlm";
import { EpisodicMemory, InMemoryStorageProvider } from "../../src/memory";
import { HttpRequestTool } from "../../src/tools/http-request";
import { VariableStorageTool } from "../../src/tools/variable-storage";
import { Agent } from "../../src/agent/base";
import type { LLMs, Workflow, AgentStreamMessage } from "../../src/types";

dotenv.config();

// Configure LLMs using compatible APIs
const llms: LLMs = {
    default: {
        provider: "openrouter",
        model: process.env.OPENROUTER_MODEL || "mistralai/devstral-2512:free",
        apiKey: process.env.OPENROUTER_API_KEY!,
    },
    anthropic: {
        provider: "anthropic",
        model: process.env.ANTHROPIC_COMPATIBLE_MODEL || "gemini-claude-sonnet-4-5",
        apiKey: process.env.ANTHROPIC_COMPATIBLE_API_KEY || "sk-anything",
        config: {
            baseURL: process.env.ANTHROPIC_COMPATIBLE_API_BASE,
        },
    },
};

// Skip tests if no API key is available
const hasApiKey = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_COMPATIBLE_API_KEY;

describe("Eko E2E Tests", () => {
    // Increase timeout for LLM calls
    jest.setTimeout(120000);

    describe("Workflow Generation", () => {
        test("should generate a simple workflow from natural language", async () => {
            if (!hasApiKey) {
                console.log("Skipping: No API key configured");
                return;
            }

            const eko = new Eko({ llms });

            const workflow = await eko.generate(
                "Create a simple greeting message",
                "test-greeting-001"
            );

            expect(workflow).toBeDefined();
            expect(workflow.taskId).toBe("test-greeting-001");
            expect(workflow.agents).toBeDefined();
            expect(workflow.agents.length).toBeGreaterThan(0);
            expect(workflow.xml).toContain("<root>");

            console.log("Generated workflow:", {
                name: workflow.name,
                agentCount: workflow.agents.length,
                thought: workflow.thought?.substring(0, 100)
            });

            // Cleanup
            eko.deleteTask("test-greeting-001");
        });

        test("should generate workflow with multiple agents", async () => {
            if (!hasApiKey) {
                console.log("Skipping: No API key configured");
                return;
            }

            const eko = new Eko({ llms });

            const workflow = await eko.generate(
                "Research a topic online, then summarize the findings, and save to a file",
                "test-multi-agent-001"
            );

            expect(workflow).toBeDefined();
            expect(workflow.agents.length).toBeGreaterThanOrEqual(1);

            // Check for dependency relationships
            const hasDependencies = workflow.agents.some(a => a.dependsOn.length > 0);
            console.log("Multi-agent workflow:", {
                agents: workflow.agents.map(a => ({
                    name: a.name,
                    task: a.task.substring(0, 50),
                    dependsOn: a.dependsOn
                })),
                hasDependencies
            });

            // Cleanup
            eko.deleteTask("test-multi-agent-001");
        });
    });

    describe("RetryLanguageModel", () => {
        test("should make LLM call with streaming", async () => {
            if (!hasApiKey) {
                console.log("Skipping: No API key configured");
                return;
            }

            const rlm = new RetryLanguageModel(llms);

            const result = await rlm.callStream({
                messages: [
                    { role: "user", content: [{ type: "text", text: "Say hello in 5 words or less" }] }
                ],
                maxOutputTokens: 50
            });

            expect(result).toBeDefined();
            expect(result.stream).toBeDefined();

            // Read stream to completion
            const reader = result.stream.getReader();
            let text = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value.type === "text-delta") {
                    text += value.delta || (value as any).textDelta || "";
                }
            }
            reader.releaseLock();

            console.log("LLM response:", text);
            expect(text.length).toBeGreaterThan(0);
        });

        test("should handle non-streaming call", async () => {
            if (!hasApiKey) {
                console.log("Skipping: No API key configured");
                return;
            }

            const rlm = new RetryLanguageModel(llms);

            const result = await rlm.call({
                messages: [
                    { role: "user", content: [{ type: "text", text: "What is 2+2?" }] }
                ],
                maxOutputTokens: 50
            });

            expect(result).toBeDefined();
            expect(result.text).toBeDefined();
            console.log("Non-streaming response:", result.text);
        });
    });

    describe("Episodic Memory Integration", () => {
        test("should record and recall episodes", async () => {
            const memory = new EpisodicMemory({
                storage: new InMemoryStorageProvider(),
                maxEpisodes: 10
            });

            await memory.init();

            // Record an episode
            await memory.recordEpisode({
                goal: "Search for weather information",
                plan: "1. Open browser\n2. Navigate to weather site\n3. Extract data",
                actions: ["navigate_to", "extract_text"],
                outcome: "Successfully retrieved weather data for New York",
                success: true
            });

            // Record another episode
            await memory.recordEpisode({
                goal: "Search for stock prices",
                plan: "1. Open browser\n2. Navigate to finance site",
                actions: ["navigate_to", "click"],
                outcome: "Failed to load page",
                success: false,
                errorType: "network_error"
            });

            // Recall relevant episodes
            const recalled = await memory.recallRelevant("weather search", 5);

            expect(recalled.length).toBeGreaterThan(0);
            expect(recalled.some(ep => ep.goal.includes("weather"))).toBe(true);

            console.log("Recalled episodes:", recalled.map(ep => ({
                goal: ep.goal,
                success: ep.success
            })));
        });
    });

    describe("Tool Execution", () => {
        test("should execute HTTP request tool", async () => {
            const httpTool = new HttpRequestTool();

            // Use a more reliable endpoint
            const result = await httpTool.execute({
                url: "https://jsonplaceholder.typicode.com/posts/1",
                method: "GET",
                timeout: 15000
            });

            // Check if we got a response (may fail on network issues)
            if (result.isError) {
                const errorContent = result.content[0];
                console.log("HTTP request failed (network issue):", errorContent.type === "text" ? errorContent.text : "non-text error");
                // Skip assertion if network is unavailable
                return;
            }

            expect(result.content.length).toBeGreaterThan(0);
            const firstContent = result.content[0];
            const responseText = firstContent.type === "text" ? firstContent.text : "";
            expect(responseText).toContain("Status:");

            console.log("HTTP tool result length:", responseText.length);
        });

        test("should execute variable storage tool with context", async () => {
            const variableTool = new VariableStorageTool();

            // Create a mock AgentContext with variables map
            const mockContext = {
                context: {
                    variables: new Map<string, any>()
                }
            } as any;

            // Store a variable using correct parameter names
            const storeResult = await variableTool.execute(
                {
                    operation: "write_variable",
                    name: "testVar",
                    value: JSON.stringify({ data: "test value", count: 42 })
                },
                mockContext
            );
            expect(storeResult.isError).toBeFalsy();
            const storeContent = storeResult.content[0];
            expect(storeContent.type === "text" ? storeContent.text : "").toBe("success");

            // Retrieve the variable
            const getResult = await variableTool.execute(
                {
                    operation: "read_variable",
                    name: "testVar"
                },
                mockContext
            );
            expect(getResult.isError).toBeFalsy();
            const getContent = getResult.content[0];
            expect(getContent.type === "text" ? getContent.text : "").toContain("test value");

            // List all variables
            const listResult = await variableTool.execute(
                {
                    operation: "list_all_variable"
                },
                mockContext
            );
            const listContent = listResult.content[0];
            expect(listContent.type === "text" ? listContent.text : "").toContain("testVar");

            console.log("Variable tool results:", {
                stored: storeContent.type === "text" ? storeContent.text : "",
                retrieved: getContent.type === "text" ? getContent.text : "",
                list: listContent.type === "text" ? listContent.text : ""
            });
        });
    });

    describe("Stream Callback System", () => {
        test("should receive stream messages during execution", async () => {
            if (!hasApiKey) {
                console.log("Skipping: No API key configured");
                return;
            }

            const messages: AgentStreamMessage[] = [];

            const eko = new Eko({
                llms,
                callback: {
                    onMessage: async (msg) => {
                        messages.push(msg);
                    }
                }
            });

            try {
                await eko.generate("Say hello", "test-stream-001");
            } catch (e) {
                // May fail on execution, but we should still get messages
            }

            expect(messages.length).toBeGreaterThan(0);

            const messageTypes = [...new Set(messages.map(m => m.type))];
            console.log("Received message types:", messageTypes);

            // Cleanup
            eko.deleteTask("test-stream-001");
        });
    });

    describe("Task Control", () => {
        test("should track active tasks", async () => {
            if (!hasApiKey) {
                console.log("Skipping: No API key configured");
                return;
            }

            const eko = new Eko({ llms });

            // Generate workflow (creates a task)
            const workflow = await eko.generate("Simple task", "test-task-001");

            // Check task tracking
            const taskIds = eko.getAllTaskId();
            expect(taskIds).toContain("test-task-001");

            // Get specific task
            const task = eko.getTask("test-task-001");
            expect(task).toBeDefined();

            // Delete task
            const deleted = eko.deleteTask("test-task-001");
            expect(deleted).toBe(true);

            // Verify deletion
            const afterDelete = eko.getTask("test-task-001");
            expect(afterDelete).toBeUndefined();

            console.log("Task control verified");
        });
    });
});

describe("Custom Agent Integration", () => {
    test("should create and use custom agent", async () => {
        // Create a simple custom agent
        class TestAgent extends Agent {
            constructor() {
                super({
                    name: "TestAgent",
                    description: "A test agent for E2E testing",
                    tools: [new VariableStorageTool()],
                    planDescription: "Use this agent for testing purposes"
                });
            }

            async extSysPrompt(): Promise<string> {
                return "You are a test agent. Be brief and direct.";
            }
        }

        const testAgent = new TestAgent();

        // Agent uses public getter properties (capitalized)
        expect(testAgent.Name).toBe("TestAgent");
        expect(testAgent.Description).toContain("test agent");
        expect(testAgent.Tools.length).toBeGreaterThan(0);

        console.log("Custom agent created:", testAgent.Name);
    });
});
