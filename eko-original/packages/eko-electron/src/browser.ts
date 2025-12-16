import { AgentContext, BaseBrowserLabelsAgent } from "@eko-ai/eko";
import { Tool, IMcpClient } from "@eko-ai/eko/types";
import type { WebContentsView, CookiesSetDetails } from "electron";

/**
 * PDF.js library configuration for PDF content extraction.
 */
export interface PdfJsConfig {
  /** URL to the PDF.js library script */
  libraryUrl: string;
  /** URL to the PDF.js worker script */
  workerUrl: string;
  /** URL to the PDF.js character maps directory */
  cmapUrl: string;
}

/**
 * Default PDF.js CDN configuration.
 * Uses cdnjs for convenience, but bundling locally is recommended for production.
 */
export const DEFAULT_PDFJS_CONFIG: PdfJsConfig = {
  libraryUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  workerUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  cmapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
};

/**
 * BrowserAgent for Electron environments.
 * Uses Electron's WebContentsView for browser automation within desktop applications.
 *
 * Security expectations for host views:
 * - contextIsolation: true
 * - sandbox: true
 * - nodeIntegration: false
 *
 * @example
 * ```ts
 * import { BrowserAgent, DEFAULT_PDFJS_CONFIG } from '@eko-ai/eko-electron';
 *
 * const agent = new BrowserAgent(myWebContentsView);
 *
 * // Optional: Enable PDF extraction (CDN)
 * agent.setPdfJsConfig(DEFAULT_PDFJS_CONFIG);
 *
 * // Or with local bundle (recommended for production)
 * agent.setPdfJsConfig({
 *   libraryUrl: 'app://assets/pdf.min.js',
 *   workerUrl: 'app://assets/pdf.worker.min.js',
 *   cmapUrl: 'app://assets/cmaps/',
 * });
 * ```
 */
export default class BrowserAgent extends BaseBrowserLabelsAgent {
  private detailView: WebContentsView;
  private customPrompt?: string;
  private pdfJsConfig?: PdfJsConfig;
  private cookies?: CookiesSetDetails[];

  /**
   * Create a new BrowserAgent for Electron.
   *
   * @param detailView - The Electron WebContentsView to automate
   * @param mcpClient - Optional MCP client for external tool integration
   * @param customPrompt - Optional custom system prompt extension
   */
  constructor(
    detailView: WebContentsView,
    mcpClient?: IMcpClient,
    customPrompt?: string
  ) {
    super(["default"], [], mcpClient);
    this.detailView = detailView;
    this.customPrompt = customPrompt;
  }

  /**
   * Configure PDF.js for PDF content extraction.
   * Call this before executing workflows that need PDF support.
   *
   * @param config - PDF.js library URLs
   *
   * @example
   * ```ts
   * // Use CDN (development/testing only)
   * agent.setPdfJsConfig(DEFAULT_PDFJS_CONFIG);
   *
   * // Use local bundle (production)
   * agent.setPdfJsConfig({
   *   libraryUrl: 'app://assets/pdf.min.js',
   *   workerUrl: 'app://assets/pdf.worker.min.js',
   *   cmapUrl: 'app://assets/cmaps/',
   * });
   * ```
   */
  public setPdfJsConfig(config: PdfJsConfig): void {
    this.pdfJsConfig = config;
  }

  /**
   * Set cookies to be applied before navigation.
   * Cookies are set on the session when navigate_to is called.
   *
   * @param cookies - Array of cookies to set
   *
   * @example
   * ```ts
   * agent.setCookies([
   *   { url: 'https://example.com', name: 'session', value: 'abc123' },
   *   { url: 'https://example.com', name: 'auth', value: 'token', httpOnly: true }
   * ]);
   * ```
   */
  public setCookies(cookies: CookiesSetDetails[]): void {
    this.cookies = cookies;
  }

  /**
   * Capture a screenshot of the current page.
   * Returns base64-encoded JPEG for consistency with core expectations.
   */
  protected async screenshot(
    agentContext: AgentContext
  ): Promise<{ imageBase64: string; imageType: "image/jpeg" | "image/png" }> {
    const image = await this.detailView.webContents.capturePage();
    // Use JPEG with quality 60 for smaller payload, matching eko-nodejs behavior
    const jpegBuffer = image.toJPEG(60);
    return {
      imageBase64: jpegBuffer.toString("base64"),
      imageType: "image/jpeg",
    };
  }

  /**
   * Navigate to a URL in the view.
   * If cookies have been set via setCookies(), they are applied before navigation.
   */
  protected async navigate_to(
    agentContext: AgentContext,
    url: string
  ): Promise<{ url: string; title?: string }> {
    // Apply cookies before navigation if set
    if (this.cookies && this.cookies.length > 0) {
      const session = this.detailView.webContents.session;
      for (const cookie of this.cookies) {
        await session.cookies.set(cookie);
      }
    }
    await this.detailView.webContents.loadURL(url);
    await this.sleep(200);
    return {
      url: this.detailView.webContents.getURL(),
      title: this.detailView.webContents.getTitle(),
    };
  }

  /**
   * Execute JavaScript in the page context.
   * Serializes function and arguments safely for injection.
   */
  protected async execute_script(
    agentContext: AgentContext,
    func: (...args: unknown[]) => unknown,
    args: unknown[]
  ): Promise<unknown> {
    const viewWebContents = this.detailView.webContents;

    // Serialize function and args for safe injection
    const serializedArgs = JSON.stringify(args, (key, value) => {
      // Filter out undefined and symbols which can't be serialized
      if (typeof value === "undefined" || typeof value === "symbol") {
        return null;
      }
      return value;
    });

    const code = `(async() => {
      const func = ${func.toString()};
      const result = await func(...${serializedArgs});
      return result;
    })()`;

    const result = await viewWebContents.executeJavaScript(code, true);
    return result;
  }

  /**
   * Get the current page information.
   */
  protected async get_current_page(
    agentContext: AgentContext
  ): Promise<{ tabId: number; url: string; title: string }> {
    return {
      tabId: 0,
      url: this.detailView.webContents.getURL(),
      title: this.detailView.webContents.getTitle(),
    };
  }

  /**
   * Get all tabs. In single-view Electron context, returns current view only.
   */
  protected async get_all_tabs(
    agentContext: AgentContext
  ): Promise<Array<{ tabId: number; url: string; title: string }>> {
    const url = this.detailView.webContents.getURL();
    const title = this.detailView.webContents.getTitle();
    return [
      {
        tabId: 0,
        url,
        title,
      },
    ];
  }

  /**
   * Switch to a tab. In single-view context, returns current view.
   */
  protected async switch_tab(
    agentContext: AgentContext,
    tabId: number
  ): Promise<{ tabId: number; url: string; title: string }> {
    // Single view context - just return current state
    return (await this.get_all_tabs(agentContext))[0];
  }

  /**
   * Navigate back in history.
   */
  protected async go_back(agentContext: AgentContext): Promise<void> {
    if (this.detailView.webContents.navigationHistory.canGoBack()) {
      this.detailView.webContents.navigationHistory.goBack();
      await this.sleep(200);
    }
  }

  /**
   * Type text using keyboard simulation.
   */
  protected async typing(
    agentContext: AgentContext,
    text: string
  ): Promise<void> {
    for (const char of text) {
      this.detailView.webContents.sendInputEvent({
        type: "char",
        keyCode: char,
      } as any);
    }
  }

  /**
   * Click at specified coordinates.
   */
  protected async click(
    agentContext: AgentContext,
    x: number,
    y: number,
    num_clicks: number,
    button_type: "left" | "right" | "middle"
  ): Promise<void> {
    const button = button_type === "left" ? "left" : button_type === "right" ? "right" : "middle";

    for (let i = 0; i < num_clicks; i++) {
      this.detailView.webContents.sendInputEvent({
        type: "mouseDown",
        x,
        y,
        button,
        clickCount: 1,
      } as any);

      this.detailView.webContents.sendInputEvent({
        type: "mouseUp",
        x,
        y,
        button,
        clickCount: 1,
      } as any);
    }
  }

  /**
   * Scroll the page.
   */
  protected async scroll(
    agentContext: AgentContext,
    amount: number
  ): Promise<void> {
    this.detailView.webContents.sendInputEvent({
      type: "mouseWheel",
      deltaX: 0,
      deltaY: amount * 100,
      x: 0,
      y: 0,
    } as any);
  }

  /**
   * Move mouse to specified coordinates.
   */
  protected async move_to(
    agentContext: AgentContext,
    x: number,
    y: number
  ): Promise<void> {
    this.detailView.webContents.sendInputEvent({
      type: "mouseMove",
      x,
      y,
    } as any);
  }

  /**
   * Press and release a single key.
   */
  protected async press(
    agentContext: AgentContext,
    key: "enter" | "tab" | "space" | "backspace" | "delete" |
         "escape" | "home" | "end" | "pageup" | "pagedown" | "insert" |
         "arrowup" | "arrowdown" | "arrowleft" | "arrowright" |
         "f1" | "f2" | "f3" | "f4" | "f5" | "f6" | "f7" | "f8" | "f9" | "f10" | "f11" | "f12"
  ): Promise<void> {
    const keyMap: Record<string, string> = {
      enter: "\n",
      tab: "\t",
      space: " ",
      backspace: "\b",
      delete: "\u007F",
      escape: "\u001B",
      home: "\uE011",
      end: "\uE012",
      pageup: "\uE013",
      pagedown: "\uE014",
      insert: "\uE016",
      arrowup: "\uE013",
      arrowdown: "\uE015",
      arrowleft: "\uE012",
      arrowright: "\uE014",
      f1: "\uE031",
      f2: "\uE032",
      f3: "\uE033",
      f4: "\uE034",
      f5: "\uE035",
      f6: "\uE036",
      f7: "\uE037",
      f8: "\uE038",
      f9: "\uE039",
      f10: "\uE03A",
      f11: "\uE03B",
      f12: "\uE03C",
    };

    const keyCode = keyMap[key];
    if (keyCode) {
      this.detailView.webContents.sendInputEvent({
        type: "keyDown",
        keyCode,
      } as any);
      this.detailView.webContents.sendInputEvent({
        type: "keyUp",
        keyCode,
      } as any);
    }
  }

  /**
   * Perform drag and drop operation.
   */
  protected async drag_and_drop(
    agentContext: AgentContext,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): Promise<void> {
    // Move to start position
    this.detailView.webContents.sendInputEvent({
      type: "mouseMove",
      x: x1,
      y: y1,
    } as any);

    // Mouse down
    this.detailView.webContents.sendInputEvent({
      type: "mouseDown",
      x: x1,
      y: y1,
      button: "left",
      clickCount: 1,
    } as any);

    // Move to end position
    this.detailView.webContents.sendInputEvent({
      type: "mouseMove",
      x: x2,
      y: y2,
    } as any);

    // Mouse up
    this.detailView.webContents.sendInputEvent({
      type: "mouseUp",
      x: x2,
      y: y2,
      button: "left",
      clickCount: 1,
    } as any);
  }

  /**
   * Execute keyboard shortcut combinations.
   * Uses Electron's sendInputEvent with modifier keys.
   */
  protected async hotkey(
    agentContext: AgentContext,
    keys: string
  ): Promise<void> {
    // Modifier mapping - cmd is mapped to Meta on Mac, Control on Windows/Linux
    const MODIFIER_MAP: Record<string, string> = {
      cmd: process.platform === "darwin" ? "meta" : "control",
      ctrl: "control",
      alt: "alt",
      shift: "shift",
      meta: "meta",
    };

    // Parse key combination
    const parts = keys.toLowerCase().split("+");
    const modifiers: string[] = [];
    let mainKey = "";

    for (const part of parts) {
      const trimmed = part.trim();
      if (MODIFIER_MAP[trimmed]) {
        modifiers.push(MODIFIER_MAP[trimmed]);
      } else {
        mainKey = trimmed;
      }
    }

    try {
      // Send keyDown event with modifiers
      if (mainKey) {
        this.detailView.webContents.sendInputEvent({
          type: "keyDown",
          keyCode: mainKey,
          modifiers: modifiers as any,
        } as any);

        // Send keyUp event with modifiers
        this.detailView.webContents.sendInputEvent({
          type: "keyUp",
          keyCode: mainKey,
          modifiers: modifiers as any,
        } as any);
      }
    } catch (error) {
      throw new Error(`Failed to execute hotkey "${keys}": ${error}`);
    }
  }

  /**
   * Override extSysPrompt to support custom prompt injection.
   */
  protected async extSysPrompt(
    agentContext: AgentContext,
    tools: Tool[]
  ): Promise<string> {
    return this.customPrompt || "";
  }

  /**
   * Override extract_page_content to support PDF documents.
   */
  protected async extract_page_content(
    agentContext: AgentContext,
    variable_name?: string
  ): Promise<{ title: string; page_url: string; page_content: string }> {
    const currentUrl = this.detailView.webContents.getURL();

    // Only attempt PDF extraction if PDF.js is configured
    if (this.pdfJsConfig) {
      if (this.isPdfUrl(currentUrl) || (await this.isPdfPage(agentContext))) {
        const pdfResult = await this.extractPdfContent(agentContext);
        const result = {
          title: pdfResult.title,
          page_url: pdfResult.page_url,
          page_content: pdfResult.page_content,
        };
        if (variable_name) {
          const fullContent = `title: ${result.title}\npage_url: ${result.page_url}\npage_content: \n${result.page_content}`;
          agentContext.context.variables.set(variable_name, fullContent);
        }
        return result;
      }
    }

    // Call parent class HTML content extraction
    return await super.extract_page_content(agentContext, variable_name);
  }

  /**
   * Check if URL appears to be a PDF.
   */
  private isPdfUrl(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    return (
      lowerUrl.includes(".pdf") ||
      lowerUrl.includes("application/pdf") ||
      lowerUrl.includes("viewer.html") ||
      lowerUrl.includes("#page=")
    );
  }

  /**
   * Detect if current page is rendering a PDF.
   */
  private async isPdfPage(agentContext: AgentContext): Promise<boolean> {
    try {
      return (await this.execute_script(
        agentContext,
        () => {
          return (
            document.querySelector('embed[type="application/pdf"]') !== null ||
            document.querySelector('iframe[src*=".pdf"]') !== null ||
            document.querySelector("#viewer") !== null ||
            document.querySelector(".pdfViewer") !== null ||
            (document as unknown as { contentType?: string }).contentType ===
              "application/pdf" ||
            window.location.href.includes("viewer.html")
          );
        },
        []
      )) as boolean;
    } catch {
      return false;
    }
  }

  /**
   * Extract text content from PDF using pdf.js.
   * Requires pdfJsConfig to be set in constructor options.
   */
  private async extractPdfContent(
    agentContext: AgentContext
  ): Promise<{ title: string; page_url: string; page_content: string }> {
    if (!this.pdfJsConfig) {
      return {
        title: this.detailView.webContents.getTitle() || "PDF Document",
        page_url: this.detailView.webContents.getURL(),
        page_content: "PDF extraction is not configured. Provide pdfJsConfig in BrowserAgent options.",
      };
    }

    const pdfConfig = this.pdfJsConfig;

    try {
      return (await this.execute_script(
        agentContext,
        (configArg: unknown) => {
          const config = configArg as { libraryUrl: string; workerUrl: string; cmapUrl: string };
          return new Promise(async (resolve) => {
            try {
              const win = window as unknown as {
                pdfjsLib?: {
                  GlobalWorkerOptions: { workerSrc: string };
                  getDocument: (options: {
                    url: string;
                    cMapUrl: string;
                    cMapPacked: boolean;
                  }) => { promise: Promise<unknown> };
                };
              };

              // Dynamically load PDF.js if not present
              if (!win.pdfjsLib) {
                const script = document.createElement("script");
                script.src = config.libraryUrl;
                script.crossOrigin = "anonymous";

                await new Promise<void>((scriptResolve, scriptReject) => {
                  script.onload = () => scriptResolve();
                  script.onerror = () =>
                    scriptReject(new Error("Failed to load PDF.js"));
                  document.head.appendChild(script);
                });

                win.pdfjsLib!.GlobalWorkerOptions.workerSrc = config.workerUrl;
              }

              // Get PDF URL from various sources
              let pdfUrl = window.location.href;
              const embedEl = document.querySelector(
                'embed[type="application/pdf"]'
              ) as HTMLEmbedElement | null;
              const iframeEl = document.querySelector(
                'iframe[src*=".pdf"]'
              ) as HTMLIFrameElement | null;

              if (embedEl?.src && !embedEl.src.startsWith("about:")) {
                pdfUrl = embedEl.src;
              } else if (iframeEl?.src && !iframeEl.src.startsWith("about:")) {
                pdfUrl = iframeEl.src;
              } else if (window.location.href.includes("viewer.html")) {
                const urlParams = new URLSearchParams(window.location.search);
                const srcParam = urlParams.get("src") || urlParams.get("file");
                if (srcParam) {
                  pdfUrl = decodeURIComponent(srcParam);
                }
              }

              // Validate PDF URL
              if (
                !pdfUrl ||
                pdfUrl === "about:blank" ||
                pdfUrl.startsWith("about:")
              ) {
                resolve({
                  title: document.title || "PDF Document",
                  page_url: window.location.href,
                  page_content:
                    "Unable to extract PDF content. The page may not be fully loaded.",
                  error: false,
                  content_type: "pdf",
                });
                return;
              }

              // Load and extract PDF
              const loadingTask = win.pdfjsLib!.getDocument({
                url: pdfUrl,
                cMapUrl: config.cmapUrl,
                cMapPacked: true,
              });

              const pdf = (await loadingTask.promise) as {
                numPages: number;
                getPage: (num: number) => Promise<{
                  getTextContent: () => Promise<{
                    items: Array<{ str?: string }>;
                  }>;
                }>;
              };
              let fullText = "";
              const numPages = pdf.numPages;

              for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                try {
                  const page = await pdf.getPage(pageNum);
                  const textContent = await page.getTextContent();
                  const pageText = textContent.items
                    .filter(
                      (item: { str?: string }) => item.str && item.str.trim()
                    )
                    .map((item: { str?: string }) => item.str)
                    .join(" ");

                  if (pageText.trim()) {
                    fullText += `\n--- Page ${pageNum} ---\n${pageText.trim()}\n`;
                  }
                } catch (pageError) {
                  fullText += `\n--- Page ${pageNum} ---\n[Page extraction failed]\n`;
                }
              }

              resolve({
                title: document.title || "PDF Document",
                page_url: pdfUrl,
                page_content: fullText.trim() || "No text content extracted",
                total_pages: numPages,
                extracted_pages: numPages,
                content_type: "pdf",
              });
            } catch (error) {
              resolve({
                title: document.title || "PDF Document",
                page_url: window.location.href,
                page_content: `PDF extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                error: true,
                content_type: "pdf",
              });
            }
          });
        },
        [pdfConfig]
      )) as { title: string; page_url: string; page_content: string };
    } catch (error) {
      return {
        title: this.detailView.webContents.getTitle() || "PDF Document",
        page_url: this.detailView.webContents.getURL(),
        page_content: `PDF extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Utility sleep function.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export { BrowserAgent };
