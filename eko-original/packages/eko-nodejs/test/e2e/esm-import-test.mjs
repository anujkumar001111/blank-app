/**
 * ESM Import Test for Eko Agents
 */

async function testImports() {
  console.log("📦 Testing ESM imports...\n");

  // Import from built ESM package
  const ekoNodejs = await import("../../dist/index.esm.js");

  // Verify exports
  const exports = Object.keys(ekoNodejs);
  console.log(`Exports: ${exports.join(", ")}\n`);

  // Check for SystemAgent
  if (!ekoNodejs.SystemAgent) {
    throw new Error("SystemAgent not exported");
  }
  console.log("✅ SystemAgent found");

  // Check for BrowserAgent
  if (!ekoNodejs.BrowserAgent) {
    throw new Error("BrowserAgent not exported");
  }
  console.log("✅ BrowserAgent found");

  // Check for individual tools
  const tools = [
    "ShellExecTool",
    "FileReadTool",
    "FileWriteTool",
    "FileDeleteTool",
    "FileListTool",
    "FileFindTool",
  ];

  for (const tool of tools) {
    if (!ekoNodejs[tool]) {
      throw new Error(`${tool} not exported`);
    }
  }
  console.log(`✅ All tools exported: ${tools.join(", ")}`);

  // Instantiate SystemAgent
  const agent = new ekoNodejs.SystemAgent({
    workPath: process.cwd(),
    enableShellSafety: true,
    restrictToWorkPath: true,
  });

  console.log(`✅ SystemAgent instantiated: ${agent.name}`);

  // Verify tools on agent
  const agentTools = agent.tools.map(t => t.name);
  console.log(`✅ Agent tools: ${agentTools.join(", ")}`);

  console.log("\n🎉 All ESM imports verified successfully!");
}

testImports().catch(e => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
