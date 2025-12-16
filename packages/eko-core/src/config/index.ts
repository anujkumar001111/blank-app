/**
 * @fileoverview Eko Framework Configuration
 *
 * Central configuration registry for all framework behavior and limits.
 * Controls execution parameters, resource constraints, and feature flags.
 * Values can be overridden at runtime for customization.
 *
 * ## Configuration Categories
 *
 * - **Identity**: Framework name and platform detection
 * - **Execution**: Agent behavior and iteration limits
 * - **Resources**: Token limits and memory constraints
 * - **Features**: Optional capabilities and experimental features
 * - **Performance**: Parallel execution and compression settings
 *
 * ## Runtime Overrides
 *
 * Most configuration values can be modified at runtime:
 * ```typescript
 * import config from '@eko-ai/eko/config';
 * config.maxReactNum = 100; // Reduce iteration limit
 * config.agentParallel = true; // Enable parallel execution
 * ```
 */

import { Config } from "../types";

const config: Config = {
  // Framework Identity
  name: "Eko", // Framework display name
  mode: "normal", // Execution mode: "normal" | "expert"
  platform: "mac", // Target platform: "mac" | "windows" | "linux"

  // Execution Limits
  maxReactNum: 500, // Maximum reasoning iterations per agent
  maxOutputTokens: 16000, // Maximum tokens in LLM response
  maxRetryNum: 3, // Maximum LLM call retries on failure

  // Parallel Execution
  agentParallel: false, // Enable parallel agent execution in workflows
  parallelToolCalls: true, // Allow concurrent tool execution

  // Content Processing
  compressThreshold: 80, // Message count threshold for compression
  compressTokensThreshold: 80000, // Token count threshold for compression
  largeTextLength: 8000, // Threshold for large text handling
  fileTextMaxLength: 20000, // Maximum file content length to process

  // Media Handling
  maxDialogueImgFileNum: 1, // Maximum images per conversation turn
  toolResultMultimodal: true, // Enable multimodal tool results
  markImageMode: "draw", // Image annotation mode: "draw" | "overlay"

  // Expert Mode Settings
  expertModeTodoLoopNum: 10, // Todo list check frequency in expert mode

  // Memory Management
  memoryConfig: {
    maxMessageNum: 15, // Maximum conversation messages to retain
    maxInputTokens: 64000, // Maximum context tokens for LLM
    enableCompression: true, // Enable automatic message compression
    compressionThreshold: 10, // Messages before compression starts
    compressionMaxLength: 6000, // Maximum length for compressed messages
  },
};

export default config;