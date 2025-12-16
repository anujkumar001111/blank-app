/**
 * Browser Enhancements Test Suite
 * Tests smart input, profile persistence, and browser recovery
 */

import { chromium, Browser, Page, BrowserContext } from "playwright";
import * as fs from "fs/promises";
import * as path from "path";

const TEST_DIR = path.join(process.cwd(), "e2e-test-results");

describe("Browser Enhancements", () => {
    let browser: Browser;
    let context: BrowserContext;
    let page: Page;

    beforeAll(async () => {
        await fs.mkdir(TEST_DIR, { recursive: true });
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext();
        page = await context.newPage();
    });

    afterAll(async () => {
        await context?.close();
        await browser?.close();
    });

    describe("Smart Input (keyboard.type fallback)", () => {
        test("keyboard.type works for global keydown listeners", async () => {
            // Simulate a game-like page that uses global keydown listeners
            await page.setContent(`
        <div id="result">None</div>
        <script>
          const result = [];
          document.addEventListener('keydown', (e) => {
            if (e.key.length === 1) {
              result.push(e.key);
              document.getElementById('result').textContent = result.join('');
            }
          });
        </script>
      `);

            // Type using keyboard.type (the fallback for non-input elements)
            await page.keyboard.type("hello");
            await page.waitForTimeout(100);

            const text = await page.textContent("#result");
            expect(text).toBe("hello");
        });

        test("virtual keyboard clicks work with data-key attributes", async () => {
            await page.setContent(`
        <div id="output"></div>
        <div class="keyboard">
          <button data-key="a">A</button>
          <button data-key="b">B</button>
          <button data-key="c">C</button>
        </div>
        <script>
          document.querySelectorAll('[data-key]').forEach(btn => {
            btn.addEventListener('click', () => {
              document.getElementById('output').textContent += btn.dataset.key;
            });
          });
        </script>
      `);

            // Click virtual keys
            await page.click('[data-key="a"]');
            await page.click('[data-key="b"]');
            await page.click('[data-key="c"]');

            const text = await page.textContent("#output");
            expect(text).toBe("abc");
        });
    });

    describe("Profile Persistence (storageState)", () => {
        const profilePath = path.join(TEST_DIR, "test-profile.json");

        test("saves and loads browser state via storageState", async () => {
            // Set a cookie and localStorage item
            await page.goto("https://example.com");
            await page.evaluate(() => {
                localStorage.setItem("testKey", "testValue");
            });
            await context.addCookies([
                { name: "testCookie", value: "testCookieValue", domain: "example.com", path: "/" },
            ]);

            // Save profile
            await context.storageState({ path: profilePath });

            // Verify file was created
            const profileExists = await fs.access(profilePath).then(() => true).catch(() => false);
            expect(profileExists).toBe(true);

            // Create new context with saved profile
            const newContext = await browser.newContext({ storageState: profilePath });
            const newPage = await newContext.newPage();
            await newPage.goto("https://example.com");

            // Verify localStorage was restored
            const restoredValue = await newPage.evaluate(() => localStorage.getItem("testKey"));
            expect(restoredValue).toBe("testValue");

            // Verify cookie was restored
            const cookies = await newContext.cookies();
            const testCookie = cookies.find((c) => c.name === "testCookie");
            expect(testCookie?.value).toBe("testCookieValue");

            await newContext.close();
        });
    });

    describe("Browser Recovery", () => {
        test("can detect when context is closed", async () => {
            const testContext = await browser.newContext();
            const testPage = await testContext.newPage();

            // Close the context
            await testContext.close();

            // Attempting to use the closed context should throw
            await expect(testPage.goto("https://example.com")).rejects.toThrow();
        });
    });
});
