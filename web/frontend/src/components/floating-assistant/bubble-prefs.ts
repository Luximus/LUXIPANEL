// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Per-provider chat-bubble display preferences (UI-only, localStorage).
 *   - input:         show the raw user input sent, in a collapsible block.
 *   - output:        show the raw assistant/CLI output, in a collapsible block.
 *   - modifiedFiles: show the "Archivos modificados" collapsible list under each
 *                    assistant turn (created/edited/deleted files).
 *   - terminalLive:  show the CLI activity console live. When OFF the turn runs
 *                    "in the background" (console hidden) and only the final
 *                    result/summary is shown once it settles.
 *
 * These are presentation toggles (no server state) configured from the
 * provider cards and consumed by the chat panes. A tiny pub/sub lets the
 * chat re-render live when toggled. New fields default ON so existing
 * behaviour is preserved until the user flips a switch.
 */
import { createJsonPrefsStore } from "@/lib/prefs-store";

export interface BubblePrefs {
  input: boolean;
  output: boolean;
  modifiedFiles: boolean;
  terminalLive: boolean;
}

const DEFAULTS: BubblePrefs = { input: false, output: false, modifiedFiles: true, terminalLive: true };

// Persistencia + pub/sub compartidos (F-18).
const store = createJsonPrefsStore<Record<string, Partial<BubblePrefs>>>("lxp.assistant.bubblePrefs");
const readAll = store.read;
const writeAll = store.write;

export const bubblePrefs = {
  get(provider: string): BubblePrefs {
    // Merge over DEFAULTS so prefs stored before a field existed still resolve
    // (a missing field reads as its default, not `undefined`).
    return { ...DEFAULTS, ...(readAll()[provider] ?? {}) };
  },
  set(provider: string, patch: Partial<BubblePrefs>): void {
    const all = readAll();
    all[provider] = { ...DEFAULTS, ...(all[provider] ?? {}), ...patch };
    writeAll(all);
  },
  subscribe: store.subscribe,
};
