const unlockedListeners = new Set<(panelId: string) => void>();
export function onVoiceInputUnlocked(listener: (panelId: string) => void): () => void {
  unlockedListeners.add(listener);
  return () => { unlockedListeners.delete(listener); };
}
const locks = new Map<string, Set<string>>();
export function setVoiceInputLock(panelId: string, source: string, locked: boolean): void {
  const wasLocked = voiceInputLocked(panelId);
  const set = locks.get(panelId) ?? new Set<string>();
  if (locked) set.add(source); else set.delete(source);
  if (set.size) locks.set(panelId, set); else locks.delete(panelId);
  if (wasLocked && !set.size) for (const listener of unlockedListeners) listener(panelId);
}
export function realtimeMicrophoneActive(): boolean { return [...locks.values()].some(s => s.has("realtime")); }
export function voiceInputLocked(panelId: string): boolean { return !!locks.get(panelId)?.size; }
