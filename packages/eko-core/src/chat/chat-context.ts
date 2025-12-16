/**
 * Chat Session State Manager
 *
 * Simple container holding chat-scoped state:
 * - Config: LLM settings, callback hooks
 * - Eko instances: Tasks spawned by this chat (via deepAction tool)
 * - Global variables: Shared data across chat messages (key-value store)
 *
 * WHY separate from ChatAgent? State management isolated from execution
 * logic, enabling state inspection/debugging without entangling business
 * logic. Registered in global.chatMap for cross-agent access.
 *
 * Lifecycle: Created per chatId, persists until chat deleted. Allows
 * multiple messages to share context (e.g., "use the data from before").
 */

import Eko from "../agent";
import { EkoDialogueConfig } from "../types";

export class ChatContext {
  protected chatId: string;
  protected config: EkoDialogueConfig;
  protected ekoMap: Map<string, Eko>;
  protected globalVariables: Map<string, any>;

  constructor(chatId: string, config: EkoDialogueConfig) {
    this.chatId = chatId;
    this.config = config;
    this.ekoMap = new Map<string, Eko>();
    this.globalVariables = new Map<string, any>();
  }

  public getChatId(): string {
    return this.chatId;
  }
  public getConfig(): EkoDialogueConfig {
    return this.config;
  }
  public addEko(taskId: string, eko: Eko): void {
    this.ekoMap.set(taskId, eko);
  }
  public getEko(taskId: string): Eko | undefined {
    return this.ekoMap.get(taskId);
  }
  public getGlobalVariables(): Map<string, any> {
    return this.globalVariables;
  }
}
