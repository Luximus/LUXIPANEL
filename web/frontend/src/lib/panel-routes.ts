// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Route predicates shared by the floating drawers (F-12).
 *
 * `pathIsAssistantView` was declared in BOTH `FloatingAssistantDrawer.tsx` and
 * `FloatingTerminalDrawer.tsx` (verbatim). Keeping them here avoids one drawer
 * importing the other's module just for a string test.
 */

/** Internal module drawers update history without an Astro page swap. */
export const INTERNAL_ROUTE_CHANGED_EVENT = "lxp:internal-modules:route-changed";

/**
 * Dedicated Assistant view — the panel HOME (`/` public, `/panel` internal),
 * plus the legacy `/panel/assistant` mount (now a redirect to `/`). There the
 * page mounts its own `AssistantPanel`, so the floating assistant hides its FAB
 * and refuses to open (single mounted instance), and the terminal hides its FAB
 * too — the chat offers an inline "Terminal" button that drives the same drawer
 * through `window.__lxpFloatingTerminalAPI`.
 */
export function pathIsAssistantView(pathname: string): boolean {
  const p = pathname.split(/[?#]/)[0] ?? "";
  return (
    p === "/" ||
    p === "/panel" ||
    p === "/panel/" ||
    pathname === "/panel/assistant" ||
    pathname.startsWith("/panel/assistant/") ||
    pathname === "/assistant" ||
    pathname.startsWith("/assistant/")
  );
}

/** The Market route has both the public and internal panel URL. */
export function pathIsAgentMarket(pathname: string): boolean {
  const path = (pathname.split(/[?#]/)[0] ?? "").replace(/\/$/, "");
  return path === "/assistant/market" || path === "/panel/assistant/market";
}

/**
 * Dedicated Terminal view (`/panel/terminal`, plus the legacy `/terminal`
 * mount). Same single-instance rule: one `#terminal-container`, no duplicated
 * xterm sessions.
 */
export function pathIsTerminalView(pathname: string): boolean {
  return (
    pathname === "/panel/terminal" ||
    pathname.startsWith("/panel/terminal/") ||
    pathname === "/terminal" ||
    pathname.startsWith("/terminal/")
  );
}
