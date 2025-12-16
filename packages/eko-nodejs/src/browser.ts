import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { AgentContext, BaseBrowserLabelsAgent, Log } from "@eko-ai/eko";
import { Page, Browser, ElementHandle, BrowserContext } from "playwright";

export default class BrowserAgent extends BaseBrowserLabelsAgent {
  private cdpWsEndpoint?: string;
  private userDataDir?: string;
  private options?: Record<string, any>;
  private cookies?: Array<any>;
  protected browser: Browser | null = null;
  private browser_context: BrowserContext | null = null;
  private current_page: Page | null = null;
  private headless: boolean = false;

  public setHeadless(headless: boolean) {
    this.headless = headless;
  }

  public setCdpWsEndpoint(cdpWsEndpoint: string) {
    this.cdpWsEndpoint = cdpWsEndpoint;
  }

  public initUserDataDir(userDataDir: string): string | undefined {
    this.userDataDir = userDataDir;
    return this.userDataDir;
  }

  public setCookies(
    cookies: Array<{
      name: string;
      value: string;
      url?: string;
      domain?: string;
      path?: string;
      expires?: number;
      httpOnly?: boolean;
    }>
  ) {
    this.cookies = cookies;
  }

  public setOptions(options?: Record<string, any>) {
    this.options = options;
  }

  protected async screenshot(
    agentContext: AgentContext
  ): Promise<{ imageBase64: string; imageType: "image/jpeg" | "image/png" }> {
    const page = await this.currentPage();
    const screenshotBuffer = await page.screenshot({
      fullPage: false,
      type: "jpeg",
      quality: 60,
    });
    const base64 = screenshotBuffer.toString("base64");
    return {
      imageType: "image/jpeg",
      imageBase64: base64,
    };
  }

  protected async navigate_to(
    agentContext: AgentContext,
    url: string
  ): Promise<{
    url: string;
    title?: string;
    tabId?: number;
  }> {
    const page = await this.open_url(agentContext, url);
    await this.sleep(200);
    return {
      url: page.url(),
      title: await page.title(),
    };
  }

  protected async get_all_tabs(
    agentContext: AgentContext
  ): Promise<Array<{ tabId: number; url: string; title: string }>> {
    if (!this.browser_context) {
      return [];
    }
    const result: Array<{ tabId: number; url: string; title: string }> = [];
    const pages = await this.browser_context.pages();
    for (let i = 0; i < pages.length; i++) {
      let page = pages[i];
      result.push({
        tabId: i,
        url: page.url(),
        title: await page.title(),
      });
    }
    return result;
  }

  protected async switch_tab(
    agentContext: AgentContext,
    tabId: number
  ): Promise<{ tabId: number; url: string; title: string }> {
    if (!this.browser_context) {
      throw new Error("tabId does not exist: " + tabId);
    }
    const pages = await this.browser_context.pages();
    const page = pages[tabId];
    if (!page) {
      throw new Error("tabId does not exist: " + tabId);
    }
    this.current_page = page;
    return {
      tabId: tabId,
      url: page.url(),
      title: await page.title(),
    };
  }

  protected async input_text(
    agentContext: AgentContext,
    index: number,
    text: string,
    enter: boolean
  ): Promise<any> {
    const page = await this.currentPage();

    // Tier 1: Try standard fill on input/textarea elements
    try {
      const elementHandle = await this.get_element(index, true);
      await elementHandle.fill("");
      await elementHandle.fill(text);
      if (enter) {
        await elementHandle.press("Enter");
        await this.sleep(200);
      }
      return;
    } catch (fillError) {
      Log.info("input_text fill failed, trying keyboard.type fallback");
    }

    // Tier 2: Try keyboard.type for global key listeners (e.g., Wordle)
    // Note: keyboard.type always "succeeds" even if nothing is focused,
    // but for games like Wordle with global listeners, this is the correct approach
    try {
      await page.keyboard.type(text);
      if (enter) {
        await page.keyboard.press("Enter");
        await this.sleep(200);
      }
      // Check if a virtual keyboard exists - if so, we may need Tier 3
      const hasVirtualKeyboard = await page.$("[data-key]").catch(() => null);
      if (!hasVirtualKeyboard) {
        return; // No virtual keyboard, keyboard.type was our best attempt
      }
      // Fall through to Tier 3 if virtual keyboard exists
    } catch (keyboardError) {
      Log.info("input_text keyboard.type failed, trying virtual keyboard fallback");
    }

    // Tier 3: Try clicking virtual keyboard keys (data-key attribute)
    const virtualKeyboard = await page.$("[data-key]").catch(() => null);
    if (virtualKeyboard) {
      for (const char of text) { // Keep original case
        // Try both lowercase and uppercase selectors
        const lowerSelector = `[data-key="${char.toLowerCase()}"]`;
        const upperSelector = `[data-key="${char.toUpperCase()}"]`;
        const exactSelector = `[data-key="${char}"]`;
        const keyExists = await page.$(exactSelector).catch(() => null) ||
          await page.$(lowerSelector).catch(() => null) ||
          await page.$(upperSelector).catch(() => null);
        if (keyExists) {
          await page.click(keyExists ? exactSelector : lowerSelector);
          await this.sleep(100);
        } else {
          await page.keyboard.press(char);
        }
      }
      if (enter) {
        const enterKey = await page.$('[data-key="↵"], [data-key="enter"], [data-key="Enter"]').catch(() => null);
        if (enterKey) {
          await enterKey.click();
        } else {
          await page.keyboard.press("Enter");
        }
        await this.sleep(200);
      }
      return;
    }

    // Final fallback: parent class implementation
    await super.input_text(agentContext, index, text, enter);
  }

  protected async click_element(
    agentContext: AgentContext,
    index: number,
    num_clicks: number,
    button: "left" | "right" | "middle"
  ): Promise<any> {
    try {
      const elementHandle = await this.get_element(index, true);
      const box = await elementHandle.boundingBox();
      if (box) {
        const page = await this.currentPage();
        page.mouse.move(
          box.x + box.width / 2 + (Math.random() * 10 - 5),
          box.y + box.height / 2 + (Math.random() * 10 - 5),
          { steps: Math.floor(Math.random() * 5) + 3 }
        );
      }
      await elementHandle.click({
        button,
        clickCount: num_clicks,
        force: false,
        delay: Math.random() * 50 + 20,
      });
    } catch (e) {
      await super.click_element(agentContext, index, num_clicks, button);
    }
  }

  protected async hover_to_element(
    agentContext: AgentContext,
    index: number
  ): Promise<void> {
    try {
      const elementHandle = await this.get_element(index, true);
      elementHandle.hover({ force: true });
    } catch (e) {
      await super.hover_to_element(agentContext, index);
    }
  }

  protected async execute_script(
    agentContext: AgentContext,
    func: (...args: any[]) => void,
    args: any[]
  ): Promise<any> {
    const page = await this.currentPage();
    return await page.evaluate(func, ...args);
  }

  protected async typing(
    agentContext: AgentContext,
    text: string
  ): Promise<void> {
    const page = await this.currentPage();
    await page.keyboard.type(text);
  }

  protected async click(
    agentContext: AgentContext,
    x: number,
    y: number,
    num_clicks: number,
    button_type: "left" | "right" | "middle"
  ): Promise<void> {
    const page = await this.currentPage();
    await page.mouse.click(x, y, {
      button: button_type,
      clickCount: num_clicks,
    });
  }

  protected async scroll(
    agentContext: AgentContext,
    amount: number
  ): Promise<void> {
    const page = await this.currentPage();
    await page.mouse.wheel(0, amount * 100);
  }

  protected async move_to(
    agentContext: AgentContext,
    x: number,
    y: number
  ): Promise<void> {
    const page = await this.currentPage();
    await page.mouse.move(x, y);
  }

  protected async press(
    agentContext: AgentContext,
    key: "enter" | "tab" | "space" | "backspace" | "delete" |
      "escape" | "home" | "end" | "pageup" | "pagedown" | "insert" |
      "arrowup" | "arrowdown" | "arrowleft" | "arrowright" |
      "f1" | "f2" | "f3" | "f4" | "f5" | "f6" | "f7" | "f8" | "f9" | "f10" | "f11" | "f12"
  ): Promise<void> {
    const page = await this.currentPage();
    const keyMap: Record<string, string> = {
      enter: "Enter",
      tab: "Tab",
      space: " ",
      backspace: "Backspace",
      delete: "Delete",
      escape: "Escape",
      home: "Home",
      end: "End",
      pageup: "PageUp",
      pagedown: "PageDown",
      insert: "Insert",
      arrowup: "ArrowUp",
      arrowdown: "ArrowDown",
      arrowleft: "ArrowLeft",
      arrowright: "ArrowRight",
      f1: "F1",
      f2: "F2",
      f3: "F3",
      f4: "F4",
      f5: "F5",
      f6: "F6",
      f7: "F7",
      f8: "F8",
      f9: "F9",
      f10: "F10",
      f11: "F11",
      f12: "F12",
    };
    await page.keyboard.press(keyMap[key] || key);
  }

  protected async drag_and_drop(
    agentContext: AgentContext,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): Promise<void> {
    const page = await this.currentPage();
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2);
    await page.mouse.up();
  }

  protected async hotkey(
    agentContext: AgentContext,
    keys: string
  ): Promise<void> {
    const page = await this.currentPage();

    // Modifier mapping - cmd is mapped to Meta on Mac, Control on Windows/Linux
    const MODIFIER_MAP: Record<string, string> = {
      cmd: process.platform === "darwin" ? "Meta" : "Control",
      ctrl: "Control",
      alt: "Alt",
      shift: "Shift",
      meta: "Meta",
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
      // Press modifiers down
      for (const modifier of modifiers) {
        await page.keyboard.down(modifier);
      }

      // Press main key
      if (mainKey) {
        await page.keyboard.press(mainKey);
      }

      // Release modifiers in reverse order
      for (let i = modifiers.length - 1; i >= 0; i--) {
        await page.keyboard.up(modifiers[i]);
      }
    } catch (error) {
      // Ensure modifiers are released even on error
      for (const modifier of modifiers) {
        try {
          await page.keyboard.up(modifier);
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
      throw error;
    }
  }

  private async open_url(
    agentContext: AgentContext,
    url: string
  ): Promise<Page> {
    const browser_context = await this.getBrowserContext();
    const page: Page = await browser_context.newPage();
    // await page.setViewportSize({ width: 1920, height: 1080 });
    await page.setViewportSize({ width: 1536, height: 864 });
    try {
      await this.autoLoadCookies(url);
      await this.autoLoadLocalStorage(page, url);
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      });
      await page.waitForLoadState("networkidle", { timeout: 5000 });
    } catch (e) {
      if ((e + "").indexOf("Timeout") == -1) {
        throw e;
      }
    }
    this.current_page = page;
    return page;
  }

  protected async currentPage(): Promise<Page> {
    if (this.current_page == null) {
      throw new Error("There is no page, please call navigate_to first");
    }
    const page = this.current_page as Page;
    try {
      await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
    } catch (e) { }
    return page;
  }

  private async get_element(
    index: number,
    findInput?: boolean
  ): Promise<ElementHandle> {
    const page = await this.currentPage();
    return await page.evaluateHandle(
      (params: any) => {
        let element = (window as any).get_highlight_element(params.index);
        if (element && params.findInput) {
          if (
            element.tagName != "INPUT" &&
            element.tagName != "TEXTAREA" &&
            element.childElementCount != 0
          ) {
            element =
              element.querySelector("input") ||
              element.querySelector("textarea") ||
              element;
          }
        }
        return element;
      },
      { index, findInput }
    );
  }

  private sleep(time: number): Promise<void> {
    return new Promise((resolve) => setTimeout(() => resolve(), time));
  }

  protected async getBrowserContext() {
    if (!this.browser_context) {
      this.current_page = null;
      this.browser_context = null;
      if (this.cdpWsEndpoint) {
        this.browser = (await chromium.connectOverCDP(
          this.cdpWsEndpoint,
          this.options
        )) as unknown as Browser;
        this.browser_context = await this.browser.newContext({
          userAgent: this.getUserAgent(),
          viewport: { width: 1536, height: 864 },
        });
      } else if (this.userDataDir) {
        this.browser_context = (await chromium.launchPersistentContext(
          this.userDataDir,
          {
            headless: this.headless,
            channel: "chrome",
            args: this.getChromiumArgs(),
            ...this.options,
          }
        )) as unknown as BrowserContext;
      } else {
        this.browser = (await chromium.launch({
          headless: this.headless,
          args: this.getChromiumArgs(),
          ...this.options,
        })) as unknown as Browser;
        this.browser_context = await this.browser.newContext({
          userAgent: this.getUserAgent(),
          viewport: { width: 1536, height: 864 },
          ...this.options, // Include storageState and other options
        });
      }
      // Anti-crawling detection website:
      // https://bot.sannysoft.com/
      // https://www.browserscan.net/
      chromium.use(StealthPlugin());
      const init_script = await this.initScript();
      if (init_script.content || init_script.path) {
        this.browser_context.addInitScript(init_script);
      }
      this.browser_context.on("page", async (page) => {
        page.on("framenavigated", async (frame) => {
          if (frame === page.mainFrame()) {
            const url = frame.url();
            if (url.startsWith("http")) {
              await this.autoLoadCookies(url);
              await this.autoLoadLocalStorage(page, url);
            }
          }
        });
      });
    }
    if (this.cookies) {
      this.browser_context?.addCookies(this.cookies);
    }
    return this.browser_context;
  }

  private async autoLoadCookies(url: string): Promise<void> {
    try {
      const cookies = await this.loadCookiesWithUrl(url);
      if (cookies && cookies.length > 0) {
        await this.browser_context?.clearCookies();
        await this.browser_context?.addCookies(cookies);
      }
    } catch (e) {
      Log.error("Failed to auto load cookies: " + url, e);
    }
  }

  private async autoLoadLocalStorage(page: Page, url: string): Promise<void> {
    try {
      const localStorageData = await this.loadLocalStorageWithUrl(url);
      await page.addInitScript((storage: Record<string, string>) => {
        try {
          for (const [key, value] of Object.entries(storage)) {
            localStorage.setItem(key, value);
          }
        } catch (e) {
          Log.error("Failed to inject localStorage: " + url, e);
        }
      }, localStorageData);
    } catch (e) {
      Log.error("Failed to auto load localStorage: " + url, e);
    }
  }

  protected async loadCookiesWithUrl(url: string): Promise<
    Array<{
      name: string;
      value: string;
      url?: string;
      domain?: string;
      path?: string;
      expires?: number;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: "Strict" | "Lax" | "None";
      partitionKey?: string;
    }>
  > {
    return [];
  }

  protected async loadLocalStorageWithUrl(
    url: string
  ): Promise<Record<string, string>> {
    return {};
  }

  protected getChromiumArgs(): string[] {
    return [
      "--no-sandbox",
      "--remote-allow-origins=*",
      "--disable-dev-shm-usage",
      "--disable-popup-blocking",
      "--ignore-ssl-errors",
      "--ignore-certificate-errors",
      "--ignore-certificate-errors-spki-list",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--disable-notifications",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
    ];
  }

  protected getUserAgent(): string | undefined {
    // const userAgents = [
    //   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    //   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    //   "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    //   "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
    // ];
    // return userAgents[Math.floor(Math.random() * userAgents.length)];
    return undefined;
  }

  protected async initScript(): Promise<{ path?: string; content?: string }> {
    return {};
  }

  /**
   * Save the current browser session (cookies, localStorage) to a file.
   * Uses Playwright's native storageState API.
   * @param profilePath - Absolute path to save the profile JSON
   */
  public async saveProfile(profilePath: string): Promise<void> {
    if (!this.browser_context) {
      throw new Error("No browser context to save profile from");
    }
    await this.browser_context.storageState({ path: profilePath });
    Log.info(`Profile saved to: ${profilePath}`);
  }

  /**
   * Load a browser session from a saved profile.
   * Must be called before navigating to any page.
   * @param profilePath - Absolute path to the profile JSON file
   */
  public setProfilePath(profilePath: string): void {
    this.options = {
      ...this.options,
      storageState: profilePath,
    };
    Log.info(`Profile will be loaded from: ${profilePath}`);
  }

  /**
   * Attempt to recover the browser context after a crash or unexpected closure.
   * Creates a new browser and context, discarding the old state.
   */
  public async recoverBrowserContext(): Promise<void> {
    Log.info("Attempting browser context recovery...");

    // Close old resources if they exist
    try {
      if (this.browser_context) {
        await this.browser_context.close().catch(() => { });
      }
      if (this.browser) {
        await this.browser.close().catch(() => { });
      }
    } catch (e) {
      // Ignore cleanup errors
    }

    // Reset state
    this.browser = null;
    this.browser_context = null;
    this.current_page = null;

    // Reinitialize
    await this.getBrowserContext();
    Log.info("Browser context recovered successfully");
  }

  /**
   * Check if the browser context is still active.
   */
  public isBrowserContextActive(): boolean {
    try {
      return this.browser_context !== null && this.browser !== null;
    } catch (e) {
      return false;
    }
  }

  // ============================================================
  // SEMANTIC LOCATOR METHODS (Phase 2 - Playwright Best Practices)
  // ============================================================

  /**
   * Click an element by its ARIA role and accessible name.
   * More resilient than index-based clicking.
   * 
   * @param role - ARIA role (button, link, checkbox, textbox, etc.)
   * @param name - Accessible name (button text, aria-label, etc.)
   * @param options - Optional: { exact: true } for exact name matching
   */
  public async clickByRole(
    role: "button" | "link" | "checkbox" | "radio" | "textbox" | "heading" | "listitem" | "menuitem" | "tab" | "option" | string,
    name?: string | RegExp,
    options?: { exact?: boolean }
  ): Promise<void> {
    const page = await this.currentPage();
    await page.getByRole(role as any, { name, exact: options?.exact }).click();
    Log.info(`Clicked ${role}${name ? ` "${name}"` : ""}`);
  }

  /**
   * Fill a form field by its associated label text.
   * 
   * @param label - The label text associated with the input
   * @param value - The value to fill
   */
  public async fillByLabel(label: string, value: string): Promise<void> {
    const page = await this.currentPage();
    await page.getByLabel(label).fill(value);
    Log.info(`Filled "${label}" with value`);
  }

  /**
   * Click an element by its visible text content.
   * 
   * @param text - Text to find
   * @param exact - If true, match exact text only
   */
  public async clickByText(text: string | RegExp, exact?: boolean): Promise<void> {
    const page = await this.currentPage();
    await page.getByText(text, { exact }).click();
    Log.info(`Clicked text "${text}"`);
  }

  /**
   * Fill an input by its placeholder text.
   * 
   * @param placeholder - Placeholder text
   * @param value - Value to fill
   */
  public async fillByPlaceholder(placeholder: string, value: string): Promise<void> {
    const page = await this.currentPage();
    await page.getByPlaceholder(placeholder).fill(value);
    Log.info(`Filled placeholder "${placeholder}" with value`);
  }

  /**
   * Get the accessibility tree (ARIA snapshot) of the current page.
   * Useful for understanding page structure and debugging.
   * 
   * @returns YAML representation of the accessibility tree
   */
  public async getAriaSnapshot(): Promise<string> {
    const page = await this.currentPage();
    return await page.locator("body").ariaSnapshot();
  }

  /**
   * Click an element by its test ID (data-testid attribute).
   * 
   * @param testId - The data-testid value
   */
  public async clickByTestId(testId: string): Promise<void> {
    const page = await this.currentPage();
    await page.getByTestId(testId).click();
    Log.info(`Clicked testId "${testId}"`);
  }
}
export { BrowserAgent };
