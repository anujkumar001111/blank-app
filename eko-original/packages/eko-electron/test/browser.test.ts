import { BrowserAgent, DEFAULT_PDFJS_CONFIG } from "../src";

// Mock WebContentsView minimal shape used by BrowserAgent
const makeMockView = () => {
  const events: Record<string, Function[]> = {};
  const setCookies: any[] = [];
  return {
    webContents: {
      capturePage: async () => ({
        toJPEG: () => Buffer.from(""),
      }),
      loadURL: async () => {},
      getURL: () => "about:blank",
      getTitle: () => "",
      navigationHistory: {
        canGoBack: () => false,
        goBack: () => {},
      },
      executeJavaScript: async () => null,
      once: (event: string, cb: Function) => {
        events[event] = events[event] || [];
        events[event].push(cb);
      },
      session: {
        cookies: {
          set: async (cookie: any) => {
            setCookies.push(cookie);
          },
        },
      },
    },
    _setCookies: setCookies,
  } as any;
};

describe("BrowserAgent", () => {
  it("constructs with minimal arguments", () => {
    const agent = new BrowserAgent(makeMockView());
    expect(agent).toBeTruthy();
  });

  it("allows configuring PDF.js via setter", () => {
    const agent = new BrowserAgent(makeMockView());
    agent.setPdfJsConfig(DEFAULT_PDFJS_CONFIG);
    expect(agent).toBeTruthy();
  });

  it("allows custom PDF.js config via setter", () => {
    const agent = new BrowserAgent(makeMockView());
    agent.setPdfJsConfig({
      libraryUrl: "app://assets/pdf.min.js",
      workerUrl: "app://assets/pdf.worker.min.js",
      cmapUrl: "app://assets/cmaps/",
    });
    expect(agent).toBeTruthy();
  });

  it("allows setting cookies via setter", () => {
    const agent = new BrowserAgent(makeMockView());
    const cookies = [
      { url: "https://example.com", name: "session", value: "abc123" },
      { url: "https://example.com", name: "auth", value: "token", httpOnly: true },
    ];
    agent.setCookies(cookies);
    expect(agent).toBeTruthy();
  });

  it("applies cookies before navigation", async () => {
    const mockView = makeMockView();
    const agent = new BrowserAgent(mockView);

    const cookies = [
      { url: "https://example.com", name: "session", value: "abc123" },
      { url: "https://example.com", name: "token", value: "xyz789", httpOnly: true },
    ];
    agent.setCookies(cookies);

    // Call navigate_to which should apply cookies
    await (agent as any).navigate_to({ context: {} }, "https://example.com");

    // Verify cookies were set on the session
    expect(mockView._setCookies.length).toBe(2);
    expect(mockView._setCookies[0]).toEqual(cookies[0]);
    expect(mockView._setCookies[1]).toEqual(cookies[1]);
  });
});
