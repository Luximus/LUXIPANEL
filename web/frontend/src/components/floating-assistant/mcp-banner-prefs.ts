// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Persistent dismissal of the "MCP session expired" chat banner (UI-only,
 * localStorage) — same model as `ui-prefs`/`bubble-prefs`.
 *
 * The banner is DERIVED from the persisted transcript (a `MCP_SESSION_EXPIRED`
 * marker embedded in a turn), so nothing clears it once the marker is stored.
 * When the user presses "Cerrar" we remember the timestamp of the newest marker
 * turn keyed by conversationId; the banner stays hidden across reloads as long
 * as no LATER marker appears (a fresh failed run re-raises it). A successful
 * "Solucionar" writes here too, in addition to the durable server signal
 * (`ConversationMeta.mcpRepairedAt`).
 *
 * SSR-safe and never throws (private mode / blocked storage) — see
 * `createJsonPrefsStore`.
 */
import { createJsonPrefsStore } from "@/lib/prefs-store";

/** conversationId → epoch ms of the newest marker the user dismissed/repaired. */
type DismissMap = Record<string, number>;

const store = createJsonPrefsStore<DismissMap>("lxp.assistant.mcpBannerDismissed");

export const mcpBannerPrefs = {
  /** Whole map, filtered to finite numbers so a corrupt blob can't leak. */
  getAll(): DismissMap {
    const raw = store.read();
    const out: DismissMap = {};
    for (const [id, ts] of Object.entries(raw)) {
      if (typeof ts === "number" && Number.isFinite(ts)) out[id] = ts;
    }
    return out;
  },
  /**
   * Remember that markers up to `markerAt` (epoch ms) are dismissed for this
   * conversation. Monotonic: never lowers an existing (newer) dismissal.
   */
  dismiss(conversationId: string, markerAt: number): void {
    const all = mcpBannerPrefs.getAll();
    if ((all[conversationId] ?? -1) >= markerAt) return;
    store.write({ ...all, [conversationId]: markerAt });
  },
};
