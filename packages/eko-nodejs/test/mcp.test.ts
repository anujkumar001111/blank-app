import { Log } from "@eko-ai/eko";
import { SimpleStdioMcpClient } from "../src";

async function testMcp() {
  const mcpClient = new SimpleStdioMcpClient("pnpm", [
    "-y",
    "mcp-server-code-runner@latest",
  ]);
  await mcpClient.connect();
  const tools = await mcpClient.listTools({
    environment: "browser",
    agent_name: "Browser",
    prompt: "Hello, world!",
  });
  console.log("tools:", JSON.stringify(tools, null, 2));
  const toolResult = await mcpClient.callTool({
    name: tools[0].name,
    arguments: {
      languageId: "javascript",
      code: "console.log('Hello, world!');",
    },
  });
  console.log("toolResult:", JSON.stringify(toolResult, null, 2));
  await mcpClient.close();
}

/**
 * Integration test for MCP client.
 * Skipped by default because it requires network access and external MCP server.
 * Run manually with: npm test -- --testNamePattern="mcp integration"
 */
test.skip("mcp integration", async () => {
  Log.setLevel(0);
  await testMcp();
}, 120000);

/**
 * Unit test for SimpleStdioMcpClient instantiation
 */
test("SimpleStdioMcpClient can be instantiated", () => {
  const client = new SimpleStdioMcpClient("echo", ["hello"]);
  expect(client).toBeDefined();
});
