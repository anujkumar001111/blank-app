/**
 * Quick functional test for Eko's MCP client methods
 * Tests: connect, listTools, callTool, isConnected, close
 */

import { SimpleSseMcpClient } from "../../src/mcp/sse";

// Remote MCP servers for testing
const SSE_URLS = {
    technicalIndicators: "http://143.198.174.251:8013/sse",
    authless: "https://remote-mcp-server-authless.idosalomon.workers.dev/sse"
};

// Use technical indicators server (confirmed working)
const SSE_URL = SSE_URLS.technicalIndicators;

describe("Eko MCP Client Functional Tests", () => {
    let client: SimpleSseMcpClient;

    afterEach(async () => {
        if (client && client.isConnected()) {
            await client.close();
        }
    });

    /**
     * Test 1: connect() - Establishes SSE connection
     */
    test("connect() should establish SSE connection", async () => {
        client = new SimpleSseMcpClient(SSE_URL);

        expect(client.isConnected()).toBe(false);

        await client.connect();

        expect(client.isConnected()).toBe(true);
    }, 15000);

    /**
     * Test 2: isConnected() - Returns connection status
     */
    test("isConnected() should return correct status", async () => {
        client = new SimpleSseMcpClient(SSE_URL);

        // Before connect
        expect(client.isConnected()).toBe(false);

        await client.connect();

        // After connect
        expect(client.isConnected()).toBe(true);

        await client.close();

        // After close
        expect(client.isConnected()).toBe(false);
    }, 15000);

    /**
     * Test 3: listTools() - Lists available tools from MCP server
     */
    test("listTools() should return array of tools", async () => {
        client = new SimpleSseMcpClient(SSE_URL);
        await client.connect();

        const tools = await client.listTools({
            environment: "mac",
            agent_name: "TestAgent",
            prompt: "List all available tools"
        });

        expect(Array.isArray(tools)).toBe(true);
        expect(tools.length).toBeGreaterThan(0);

        // Each tool should have name and inputSchema
        tools.forEach(tool => {
            expect(tool).toHaveProperty("name");
            expect(typeof tool.name).toBe("string");
            expect(tool).toHaveProperty("inputSchema");
        });

        console.log(`✅ Found ${tools.length} tools:`, tools.map(t => t.name).slice(0, 5));
    }, 30000);

    /**
     * Test 4: close() - Properly closes the connection
     */
    test("close() should disconnect the client", async () => {
        client = new SimpleSseMcpClient(SSE_URL);
        await client.connect();

        expect(client.isConnected()).toBe(true);

        await client.close();

        expect(client.isConnected()).toBe(false);
    }, 15000);

    /**
     * Test 5: Full lifecycle - connect -> listTools -> close
     */
    test("should handle connect -> listTools -> close cycle", async () => {
        client = new SimpleSseMcpClient(SSE_URL);

        // Connect
        await client.connect();
        expect(client.isConnected()).toBe(true);

        // List tools
        const tools = await client.listTools({
            environment: "mac",
            agent_name: "TestAgent",
            prompt: "test"
        });
        expect(tools.length).toBeGreaterThan(0);

        // Close
        await client.close();
        expect(client.isConnected()).toBe(false);

        console.log("✅ Full lifecycle test passed");
    }, 30000);
});
