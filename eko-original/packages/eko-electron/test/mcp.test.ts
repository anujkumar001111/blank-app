import { SimpleStdioMcpClient } from "../src";

describe("SimpleStdioMcpClient", () => {
  it("constructs with command only", () => {
    const client = new SimpleStdioMcpClient("echo");
    expect(client).toBeTruthy();
  });
});
