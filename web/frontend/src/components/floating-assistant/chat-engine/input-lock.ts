// SPDX-License-Identifier: AGPL-3.0-only
const locks = new Map<string, Set<string>>();
export function lockChatInput(key: string, token: string): () => void {
  const set = locks.get(key) ?? new Set<string>();
  set.add(token); locks.set(key, set);
  return () => { set.delete(token); if (!set.size) locks.delete(key); };
}
export function chatInputLocked(key: string): boolean { return !!locks.get(key)?.size; }
