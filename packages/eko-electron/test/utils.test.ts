import {
  getCdpWsEndpoint,
  attachCdpSession,
  detachCdpSession,
  sendCdpCommand,
} from "../src/utils";

// Mock WebContents for testing CDP utilities
const makeMockWebContents = () => {
  let attached = false;
  const commands: Array<{ method: string; params?: any }> = [];

  return {
    debugger: {
      isAttached: () => attached,
      attach: (version: string) => {
        attached = true;
      },
      detach: () => {
        attached = false;
      },
      sendCommand: async (method: string, params?: any) => {
        commands.push({ method, params });
        return { success: true, data: "mock-result" };
      },
    },
    _commands: commands,
    _isAttached: () => attached,
  } as any;
};

describe("CDP Utilities", () => {
  describe("getCdpWsEndpoint", () => {
    it("fetches WebSocket endpoint from CDP port", async () => {
      // Mock global fetch
      const mockFetch = jest.fn().mockResolvedValue({
        json: async () => ({
          webSocketDebuggerUrl: "ws://localhost:9222/devtools/browser/abc123",
        }),
      });
      global.fetch = mockFetch as any;

      const result = await getCdpWsEndpoint(9222);

      expect(mockFetch).toHaveBeenCalledWith("http://localhost:9222/json/version");
      expect(result).toBe("ws://localhost:9222/devtools/browser/abc123");
    });
  });

  describe("attachCdpSession", () => {
    it("attaches debugger when not already attached", () => {
      const mockWebContents = makeMockWebContents();

      const debuggerSession = attachCdpSession(mockWebContents);

      expect(mockWebContents._isAttached()).toBe(true);
      expect(debuggerSession).toBe(mockWebContents.debugger);
    });

    it("does not re-attach if already attached", () => {
      const mockWebContents = makeMockWebContents();
      mockWebContents.debugger.attach("1.3");

      const debuggerSession = attachCdpSession(mockWebContents);

      expect(mockWebContents._isAttached()).toBe(true);
      expect(debuggerSession).toBe(mockWebContents.debugger);
    });
  });

  describe("detachCdpSession", () => {
    it("detaches debugger when attached", () => {
      const mockWebContents = makeMockWebContents();
      mockWebContents.debugger.attach("1.3");

      detachCdpSession(mockWebContents);

      expect(mockWebContents._isAttached()).toBe(false);
    });

    it("does nothing if not attached", () => {
      const mockWebContents = makeMockWebContents();

      detachCdpSession(mockWebContents);

      expect(mockWebContents._isAttached()).toBe(false);
    });
  });

  describe("sendCdpCommand", () => {
    it("sends CDP command and auto-attaches/detaches", async () => {
      const mockWebContents = makeMockWebContents();

      const result = await sendCdpCommand(
        mockWebContents,
        "Page.captureScreenshot",
        { format: "png" }
      );

      expect(mockWebContents._commands.length).toBe(1);
      expect(mockWebContents._commands[0]).toEqual({
        method: "Page.captureScreenshot",
        params: { format: "png" },
      });
      expect(result).toEqual({ success: true, data: "mock-result" });
      expect(mockWebContents._isAttached()).toBe(false); // Should auto-detach
    });

    it("does not detach if already attached before call", async () => {
      const mockWebContents = makeMockWebContents();
      mockWebContents.debugger.attach("1.3");

      await sendCdpCommand(mockWebContents, "Page.reload");

      expect(mockWebContents._isAttached()).toBe(true); // Should stay attached
    });

    it("handles commands without parameters", async () => {
      const mockWebContents = makeMockWebContents();

      const result = await sendCdpCommand(mockWebContents, "Page.reload");

      expect(mockWebContents._commands.length).toBe(1);
      expect(mockWebContents._commands[0]).toEqual({
        method: "Page.reload",
        params: undefined,
      });
    });

    it("detaches on error if was not previously attached", async () => {
      const mockWebContents = makeMockWebContents();
      mockWebContents.debugger.sendCommand = async () => {
        throw new Error("CDP command failed");
      };

      await expect(
        sendCdpCommand(mockWebContents, "Invalid.command")
      ).rejects.toThrow("CDP command failed");

      expect(mockWebContents._isAttached()).toBe(false); // Should detach on error
    });
  });
});
