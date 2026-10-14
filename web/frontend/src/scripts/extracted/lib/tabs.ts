// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tab-state helpers for the extracted page scripts (E-03).
 *
 * Three families of `classList.toggle(...)` with VERBATIM Tailwind literals had
 * been cloned across the panel:
 *
 *  1. "underline + count badge" (`setUnderlineTabState`) — users / settings /
 *     mail / server-alerts. Byte-for-byte identical bodies, badge swap included.
 *  2. "pill" (`setPillTabState`) — cloudflare / databases.
 *  3. "border-primary + hidden panes" (`setBorderTabState` + `setPaneVisibility`)
 *     — settings credentials sub-tabs / hosting modal sub-tabs.
 *
 * The class literals live here ONCE so a design tweak can't drift between
 * modules again. Every helper takes an element + an `active` flag, which fits
 * both call shapes in the codebase (an explicit button array and a
 * `querySelectorAll` sweep).
 *
 * Imported by the runtime URL `/scripts/extracted/lib/tabs.js` (stays external
 * in bundled entries via the `/scripts/extracted/lib/*` glob).
 *
 * Cambio de vista animado: los helpers `setPaneVisibility*` animan la entrada
 * del panel que pasa a visible (preset `.lxp-view-enter*` de motion.css, vía
 * `switchView` de lib/dom.js). `direction` opcional ("right" = tab posterior,
 * "left" = anterior); `tabDirectionOf()` la calcula desde un tablist.
 */
import { animateViewEnter, switchView, tabDirection, type ViewDirection } from "/scripts/extracted/lib/dom.js";

/**
 * Family 1 — underline tab (`border-primary` + `text-primary`) with the
 * optional `[id$='-count']` badge whose background swaps primary/muted.
 */
export function setUnderlineTabState(btn: HTMLElement | null | undefined, active: boolean): void {
  if (!btn) return;
  btn.classList.toggle("border-primary", active);
  btn.classList.toggle("text-primary", active);
  btn.classList.toggle("hover:text-primary/80", active);
  btn.classList.toggle("border-transparent", !active);
  btn.classList.toggle("text-muted-foreground", !active);
  btn.classList.toggle("hover:text-foreground", !active);
  // Badge bg swap: activo = realce primary, inactivo = muted.
  const badge = btn.querySelector<HTMLElement>("[id$='-count']");
  if (badge) {
    badge.classList.toggle("bg-primary/10", active);
    badge.classList.toggle("bg-muted", !active);
  }
}

/** Family 1, sweep form: apply `setUnderlineTabState` over a CSS selector. */
export function highlightUnderlineTabs(
  selector: string,
  isActive: (btn: HTMLButtonElement) => boolean,
  root: ParentNode = document,
): void {
  root.querySelectorAll<HTMLButtonElement>(selector).forEach((btn) => {
    setUnderlineTabState(btn, isActive(btn));
  });
}

/** Family 2 — segmented "pill" tab (raised background + shadow when active). */
export function setPillTabState(btn: HTMLElement | null | undefined, active: boolean): void {
  if (!btn) return;
  btn.classList.toggle("bg-background", active);
  btn.classList.toggle("shadow-sm", active);
  btn.classList.toggle("text-foreground", active);
  btn.classList.toggle("text-muted-foreground", !active);
}

/** Family 2, sweep form. */
export function highlightPillTabs(
  selector: string,
  isActive: (btn: HTMLButtonElement) => boolean,
  root: ParentNode = document,
): void {
  root.querySelectorAll<HTMLButtonElement>(selector).forEach((btn) => {
    setPillTabState(btn, isActive(btn));
  });
}

/** Family 3 — bordered sub-tab inside a card/modal (no badge). */
export function setBorderTabState(btn: HTMLElement | null | undefined, active: boolean): void {
  if (!btn) return;
  btn.classList.toggle("border-primary", active);
  btn.classList.toggle("text-foreground", active);
  btn.classList.toggle("border-transparent", !active);
  btn.classList.toggle("text-muted-foreground", !active);
}

/** Family 3, sweep form. */
export function highlightBorderTabs(
  selector: string,
  isActive: (btn: HTMLButtonElement) => boolean,
  root: ParentNode = document,
): void {
  root.querySelectorAll<HTMLButtonElement>(selector).forEach((btn) => {
    setBorderTabState(btn, isActive(btn));
  });
}

/**
 * Show exactly one pane out of a set, by `data-*` attribute (family 3 style).
 * `attr` is the dataset key (`"pane"` → `data-pane`, `"hostPane"` → `data-host-pane`).
 */
export function setPaneVisibilityByData(
  selector: string,
  attr: string,
  activeValue: string,
  root: ParentNode = document,
  direction: ViewDirection = "none",
): void {
  const panes = Array.from(root.querySelectorAll<HTMLElement>(selector));
  switchView(panes, panes.find((pane) => pane.dataset[attr] === activeValue), { direction });
}

/**
 * Show exactly one pane out of a set, by element id (`showTab` style used by
 * cloudflare / server-alerts). `flexIds` lists the panes that must also get
 * `flex` while active (their layout depends on it). Missing nodes are skipped.
 */
export function setPaneVisibilityById(
  ids: readonly string[],
  activeId: string,
  options: { idFor?: (id: string) => string; flexIds?: readonly string[]; direction?: ViewDirection } = {},
): void {
  const { idFor = (id: string) => id, flexIds, direction = "none" } = options;
  const next = document.getElementById(idFor(activeId));
  const wasHidden = !!next && next.classList.contains("hidden");
  for (const id of ids) {
    const pane = document.getElementById(idFor(id));
    if (!pane) continue;
    pane.classList.toggle("hidden", id !== activeId);
    if (flexIds?.includes(id)) pane.classList.toggle("flex", id === activeId);
  }
  // Solo el panel que pasa a visible entra animado (nunca el re-activado).
  if (next && wasHidden) animateViewEnter(next, direction);
}

/**
 * Dirección de entrada según el orden de los botones de un tablist: `prev` →
 * `next` identificados por su valor (`data-*`) o por el propio botón.
 */
export function tabDirectionOf(
  buttons: ArrayLike<HTMLElement> | Iterable<HTMLElement>,
  isPrev: (btn: HTMLElement) => boolean,
  isNext: (btn: HTMLElement) => boolean,
): ViewDirection {
  const list = Array.from(buttons as Iterable<HTMLElement>);
  return tabDirection(list.findIndex(isPrev), list.findIndex(isNext));
}
