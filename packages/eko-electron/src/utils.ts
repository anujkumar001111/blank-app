import type { WebContents } from "electron";

/**
 * Get the Chrome DevTools Protocol WebSocket endpoint from a port.
 * Useful when connecting to an external Chrome/Chromium instance.
 *
 * @param port - The debugging port Chrome is listening on
 * @returns The WebSocket debugger URL
 *
 * @example
 * ```ts
 * // Start Chrome with --remote-debugging-port=9222
 * const wsEndpoint = await getCdpWsEndpoint(9222);
 * // Returns: ws://localhost:9222/devtools/browser/{session-id}
 * ```
 */
export async function getCdpWsEndpoint(port: number): Promise<string> {
  const response = await fetch(`http://localhost:${port}/json/version`);
  const browserInfo = await response.json();
  return browserInfo.webSocketDebuggerUrl as string;
}

/**
 * Attach a CDP session to an Electron WebContents.
 * This allows direct CDP protocol communication with the renderer process.
 *
 * @param webContents - The Electron WebContents to attach to
 * @returns A debugger session that can send CDP commands
 *
 * @example
 * ```ts
 * const debugger = attachCdpSession(myWebContents);
 * await debugger.sendCommand('Page.captureScreenshot', { format: 'png' });
 * ```
 */
export function attachCdpSession(webContents: WebContents): Electron.Debugger {
  const debuggerSession = webContents.debugger;
  if (!debuggerSession.isAttached()) {
    debuggerSession.attach("1.3");
  }
  return debuggerSession;
}

/**
 * Detach a CDP session from an Electron WebContents.
 *
 * @param webContents - The Electron WebContents to detach from
 */
export function detachCdpSession(webContents: WebContents): void {
  const debuggerSession = webContents.debugger;
  if (debuggerSession.isAttached()) {
    debuggerSession.detach();
  }
}

/**
 * Execute a CDP command on an Electron WebContents.
 *
 * @param webContents - The Electron WebContents to send the command to
 * @param method - The CDP method to call
 * @param params - Optional parameters for the CDP method
 * @returns The result of the CDP command
 *
 * @example
 * ```ts
 * // Take a screenshot using CDP
 * const result = await sendCdpCommand(
 *   myWebContents,
 *   'Page.captureScreenshot',
 *   { format: 'png', quality: 80 }
 * );
 * const imageBase64 = result.data;
 * ```
 */
export async function sendCdpCommand<T = unknown>(
  webContents: WebContents,
  method: string,
  params?: Record<string, unknown>
): Promise<T> {
  const debuggerSession = webContents.debugger;
  const wasAttached = debuggerSession.isAttached();

  if (!wasAttached) {
    debuggerSession.attach("1.3");
  }

  try {
    const result = await debuggerSession.sendCommand(method, params);
    return result as T;
  } finally {
    if (!wasAttached) {
      debuggerSession.detach();
    }
  }
}
