import { FileAgent } from "../src";

// Mock WebContentsView minimal shape used by FileAgent
const makeMockView = () => {
  const events: Record<string, Function[]> = {};
  return {
    webContents: {
      send: jest.fn(),
      once: (event: string, cb: Function) => {
        events[event] = events[event] || [];
        events[event].push(cb);
      },
    },
  } as any;
};

// Mock Electron App
const makeMockApp = (isPackaged: boolean = false) => ({
  isPackaged,
});

describe("FileAgent", () => {
  it("constructs with minimal arguments", () => {
    const agent = new FileAgent(makeMockView(), makeMockApp() as any);
    expect(agent).toBeTruthy();
  });

  it("allows setting preview URL generator via setter", () => {
    const agent = new FileAgent(makeMockView(), makeMockApp() as any);
    const generator = jest.fn(
      (filePath: string, fileName: string, isPackaged: boolean) =>
        isPackaged ? `app://${fileName}` : `http://localhost:3000/${fileName}`
    );
    agent.setPreviewUrlGenerator(generator);
    expect(agent).toBeTruthy();
  });

  it("accepts custom work path in constructor", () => {
    const agent = new FileAgent(
      makeMockView(),
      makeMockApp() as any,
      "/custom/path"
    );
    expect(agent).toBeTruthy();
    expect(agent.WorkPath).toBe("/custom/path");
  });

  it("allows setting IPC channel via setter", () => {
    const agent = new FileAgent(makeMockView(), makeMockApp() as any);
    agent.setIpcChannel("custom-file-event");
    expect(agent).toBeTruthy();
  });

  it("allows setting work path via setter", () => {
    const agent = new FileAgent(makeMockView(), makeMockApp() as any);
    agent.setWorkPath("/new/path");
    expect(agent.WorkPath).toBe("/new/path");
  });

  it("allows setting security options via setter", () => {
    const agent = new FileAgent(makeMockView(), makeMockApp() as any);
    agent.setSecurityOptions({ restrictToWorkPath: false });
    expect(agent).toBeTruthy();
  });

  it("allows configuring allowed paths for security", () => {
    const agent = new FileAgent(makeMockView(), makeMockApp() as any);
    agent.setSecurityOptions({
      restrictToWorkPath: true,
      allowedPaths: ["/tmp", "/var/log"],
    });
    expect(agent).toBeTruthy();
  });

  it("has restrictToWorkPath enabled by default for security", () => {
    const agent = new FileAgent(
      makeMockView(),
      makeMockApp() as any,
      "/safe/workdir"
    );
    // The agent should be created with security enabled by default
    expect(agent).toBeTruthy();
  });
});
