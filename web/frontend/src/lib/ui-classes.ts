// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Repeated Tailwind class chains, declared once (F-23).
 *
 * These are pure literals — Tailwind v4's source detection scans this file, so
 * the JIT still sees every utility verbatim (same mechanism as the static
 * colour maps in `floating-assistant/agents-tab/constants.ts`).
 */

/**
 * Native `<dialog>` chrome, repeated verbatim in 24 places. Compose it with the
 * dialog's own width, e.g.
 *   `class={`w-full max-w-2xl ${DIALOG_CHROME}`}`
 * NOTE: `modal-drawer.css` auto-converts every native `<dialog>` into the right
 * drawer, so this chain is what the drawer's CSS keys off — keep it verbatim.
 */
export const DIALOG_CHROME =
  "rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm";

/**
 * The peer-driven toggle switch (12 occurrences). Goes on the `<span>`/`<div>`
 * that follows the `peer` checkbox.
 */
export const TOGGLE_SWITCH =
  "h-5 w-9 rounded-full bg-muted transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 " +
  "after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-4";
