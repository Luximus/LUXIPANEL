// SPDX-License-Identifier: AGPL-3.0-only
import { executionKey } from "./execution-scope.js";

/** No dependency on the provider or task engine: also used by HTTP send guards. */
const active = new Map<string, string>();
export function liveVoiceSession(conversationId: string, targetId?: string): string | undefined {
  return active.get(executionKey(conversationId, targetId));
}
export function claimLiveVoice(conversationId: string, sessionId: string, targetId: string): boolean {
  const key = executionKey(conversationId, targetId);
  if (active.has(key)) return false;
  active.set(key, sessionId);
  return true;
}
export function releaseLiveVoice(conversationId: string, sessionId: string, targetId: string): void {
  const key = executionKey(conversationId, targetId);
  if (active.get(key) === sessionId) active.delete(key);
}
