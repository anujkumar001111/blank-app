/**
 * @eko-ai/eko-electron
 *
 * Electron environment support for the Eko framework.
 * Provides agents and utilities for building AI-powered desktop applications.
 *
 * @packageDocumentation
 */

export { default as BrowserAgent } from "./browser";
export { default as FileAgent } from "./file";
export { SimpleStdioMcpClient } from "./mcp/stdio";

// CDP utilities
export {
  getCdpWsEndpoint,
  attachCdpSession,
  detachCdpSession,
  sendCdpCommand,
} from "./utils";

// Re-export types for configuration
export type { PdfJsConfig } from "./browser";
export { DEFAULT_PDFJS_CONFIG } from "./browser";
export type { FileInfo, FileWriteResult, PreviewUrlGenerator, FileSecurityOptions } from "./file";

// Re-export Electron types for convenience
export type { CookiesSetDetails } from "electron";
