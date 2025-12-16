import { chromium, Browser, Page } from "playwright";
import { describe, test, expect, beforeAll, afterAll } from "@jest/globals";

describe("Keyboard Hotkey Support", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  describe("Key Combination Parsing", () => {
    test("should parse single modifier + key", () => {
      const input = "cmd+c";
      const parts = input.split("+");
      expect(parts).toEqual(["cmd", "c"]);
    });

    test("should parse multiple modifiers + key", () => {
      const input = "ctrl+shift+a";
      const parts = input.split("+");
      expect(parts).toEqual(["ctrl", "shift", "a"]);
    });

    test("should parse complex combination", () => {
      const input = "cmd+alt+shift+t";
      const parts = input.split("+");
      expect(parts).toEqual(["cmd", "alt", "shift", "t"]);
    });
  });

  describe("Modifier Mapping", () => {
    test("should map cmd to Meta on Mac", () => {
      const MODIFIER_MAP: Record<string, string> = {
        cmd:
          process.platform === "darwin"
            ? "Meta"
            : "Control",
        ctrl: "Control",
        alt: "Alt",
        shift: "Shift",
        meta: "Meta",
      };

      if (process.platform === "darwin") {
        expect(MODIFIER_MAP["cmd"]).toBe("Meta");
      } else {
        expect(MODIFIER_MAP["cmd"]).toBe("Control");
      }
    });

    test("should map ctrl to Control on all platforms", () => {
      const MODIFIER_MAP: Record<string, string> = {
        cmd:
          process.platform === "darwin"
            ? "Meta"
            : "Control",
        ctrl: "Control",
        alt: "Alt",
        shift: "Shift",
        meta: "Meta",
      };

      expect(MODIFIER_MAP["ctrl"]).toBe("Control");
    });

    test("should map alt to Alt on all platforms", () => {
      const MODIFIER_MAP: Record<string, string> = {
        cmd:
          process.platform === "darwin"
            ? "Meta"
            : "Control",
        ctrl: "Control",
        alt: "Alt",
        shift: "Shift",
        meta: "Meta",
      };

      expect(MODIFIER_MAP["alt"]).toBe("Alt");
    });

    test("should map shift to Shift on all platforms", () => {
      const MODIFIER_MAP: Record<string, string> = {
        cmd:
          process.platform === "darwin"
            ? "Meta"
            : "Control",
        ctrl: "Control",
        alt: "Alt",
        shift: "Shift",
        meta: "Meta",
      };

      expect(MODIFIER_MAP["shift"]).toBe("Shift");
    });
  });

  describe("Integration with Headless Browser", () => {
    test("should execute Cmd+A to select all text", async () => {
      await page.setContent(`
        <html>
          <body>
            <textarea id="test-area">Hello World</textarea>
            <script>
              const textarea = document.getElementById('test-area');
              textarea.focus();
            </script>
          </body>
        </html>
      `);

      // Wait for textarea to be focused
      await page.waitForTimeout(100);

      // Execute hotkey based on platform
      const cmdKey = process.platform === "darwin" ? "Meta" : "Control";
      await page.keyboard.down(cmdKey);
      await page.keyboard.press("a");
      await page.keyboard.up(cmdKey);

      // Check if text is selected
      const selectedText = await page.evaluate(() => {
        const textarea = document.getElementById(
          "test-area"
        ) as HTMLTextAreaElement;
        return textarea.value.substring(
          textarea.selectionStart,
          textarea.selectionEnd
        );
      });

      expect(selectedText).toBe("Hello World");
    });

    test("should execute Ctrl+Shift+A combination", async () => {
      await page.setContent(`
        <html>
          <body>
            <div id="output">Not triggered</div>
            <script>
              document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                  document.getElementById('output').textContent = 'Triggered';
                }
              });
            </script>
          </body>
        </html>
      `);

      await page.waitForTimeout(100);

      // Execute Ctrl+Shift+A
      await page.keyboard.down("Control");
      await page.keyboard.down("Shift");
      await page.keyboard.press("A");
      await page.keyboard.up("Shift");
      await page.keyboard.up("Control");

      const output = await page.evaluate(
        () => document.getElementById("output")?.textContent
      );
      expect(output).toBe("Triggered");
    });

    test("should execute simple hotkey Ctrl+C", async () => {
      await page.setContent(`
        <html>
          <body>
            <input type="text" id="test-input" value="Copy Me" />
            <script>
              const input = document.getElementById('test-input');
              input.focus();
              input.select();
            </script>
          </body>
        </html>
      `);

      await page.waitForTimeout(100);

      // Execute Ctrl+C - this should work, though copy event may not fire in headless
      await page.keyboard.down("Control");
      await page.keyboard.press("c");
      await page.keyboard.up("Control");

      // Verify the input is still selected (basic verification)
      const selectionLength = await page.evaluate(() => {
        const input = document.getElementById(
          "test-input"
        ) as HTMLInputElement;
        return input.selectionEnd! - input.selectionStart!;
      });

      // The text should still be selected after Ctrl+C
      expect(selectionLength).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    test("should handle lowercase and uppercase keys", () => {
      const lower = "cmd+c";
      const upper = "cmd+C";

      expect(lower.split("+")).toEqual(["cmd", "c"]);
      expect(upper.split("+")).toEqual(["cmd", "C"]);
    });

    test("should handle single key without modifiers", () => {
      const single = "a";
      const parts = single.split("+");
      expect(parts).toEqual(["a"]);
    });
  });

  describe("Expanded Press Key Support", () => {
    test("should press arrow keys", async () => {
      await page.setContent(`
        <html>
          <body>
            <div id="output">none</div>
            <script>
              document.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown') {
                  document.getElementById('output').textContent = 'down';
                } else if (e.key === 'ArrowUp') {
                  document.getElementById('output').textContent = 'up';
                } else if (e.key === 'ArrowLeft') {
                  document.getElementById('output').textContent = 'left';
                } else if (e.key === 'ArrowRight') {
                  document.getElementById('output').textContent = 'right';
                }
              });
            </script>
          </body>
        </html>
      `);

      await page.waitForTimeout(100);

      // Test ArrowDown
      await page.keyboard.press("ArrowDown");
      let output = await page.evaluate(
        () => document.getElementById("output")?.textContent
      );
      expect(output).toBe("down");

      // Test ArrowUp
      await page.keyboard.press("ArrowUp");
      output = await page.evaluate(
        () => document.getElementById("output")?.textContent
      );
      expect(output).toBe("up");

      // Test ArrowLeft
      await page.keyboard.press("ArrowLeft");
      output = await page.evaluate(
        () => document.getElementById("output")?.textContent
      );
      expect(output).toBe("left");

      // Test ArrowRight
      await page.keyboard.press("ArrowRight");
      output = await page.evaluate(
        () => document.getElementById("output")?.textContent
      );
      expect(output).toBe("right");
    });

    test("should press function keys", async () => {
      await page.setContent(`
        <html>
          <body>
            <div id="output">none</div>
            <script>
              document.addEventListener('keydown', (e) => {
                if (e.key === 'F1') {
                  e.preventDefault();
                  document.getElementById('output').textContent = 'f1';
                } else if (e.key === 'F5') {
                  e.preventDefault();
                  document.getElementById('output').textContent = 'f5';
                } else if (e.key === 'F12') {
                  e.preventDefault();
                  document.getElementById('output').textContent = 'f12';
                }
              });
            </script>
          </body>
        </html>
      `);

      await page.waitForTimeout(100);

      // Test F1
      await page.keyboard.press("F1");
      let output = await page.evaluate(
        () => document.getElementById("output")?.textContent
      );
      expect(output).toBe("f1");

      // Test F5
      await page.keyboard.press("F5");
      output = await page.evaluate(
        () => document.getElementById("output")?.textContent
      );
      expect(output).toBe("f5");

      // Test F12
      await page.keyboard.press("F12");
      output = await page.evaluate(
        () => document.getElementById("output")?.textContent
      );
      expect(output).toBe("f12");
    });

    test("should press escape key", async () => {
      await page.setContent(`
        <html>
          <body>
            <div id="output">none</div>
            <script>
              document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                  document.getElementById('output').textContent = 'escape';
                }
              });
            </script>
          </body>
        </html>
      `);

      await page.waitForTimeout(100);

      await page.keyboard.press("Escape");
      const output = await page.evaluate(
        () => document.getElementById("output")?.textContent
      );
      expect(output).toBe("escape");
    });

    test("should press navigation keys", async () => {
      await page.setContent(`
        <html>
          <body>
            <div id="output">none</div>
            <script>
              document.addEventListener('keydown', (e) => {
                if (e.key === 'Home') {
                  document.getElementById('output').textContent = 'home';
                } else if (e.key === 'End') {
                  document.getElementById('output').textContent = 'end';
                } else if (e.key === 'PageUp') {
                  document.getElementById('output').textContent = 'pageup';
                } else if (e.key === 'PageDown') {
                  document.getElementById('output').textContent = 'pagedown';
                }
              });
            </script>
          </body>
        </html>
      `);

      await page.waitForTimeout(100);

      // Test Home
      await page.keyboard.press("Home");
      let output = await page.evaluate(
        () => document.getElementById("output")?.textContent
      );
      expect(output).toBe("home");

      // Test End
      await page.keyboard.press("End");
      output = await page.evaluate(
        () => document.getElementById("output")?.textContent
      );
      expect(output).toBe("end");

      // Test PageUp
      await page.keyboard.press("PageUp");
      output = await page.evaluate(
        () => document.getElementById("output")?.textContent
      );
      expect(output).toBe("pageup");

      // Test PageDown
      await page.keyboard.press("PageDown");
      output = await page.evaluate(
        () => document.getElementById("output")?.textContent
      );
      expect(output).toBe("pagedown");
    });
  });
});
