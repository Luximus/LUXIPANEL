// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { createContext, useContext, useEffect, useRef } from "react";

/**
 * Per-screen provider selector, lifted to the drawer so the mobile bottom strip
 * can drive it. On phones each internal screen (Dashboard / Stats)
 * HIDES its own top provider strip and registers its selector here instead; the
 * shared bottom strip renders/controls it — per-screen, with NO navigation to
 * the chat tab. On desktop the in-screen strips stay and this is unused.
 */

/** Sentinel id for the "all providers" entry (screens that support it). */
export const SCREEN_PROVIDER_ALL = "__all__";

/** One selectable entry in a screen's provider strip. */
export interface ScreenProviderOption {
  /** Provider id, or {@link SCREEN_PROVIDER_ALL}. */
  id: string;
  /** Small uppercase mode suffix (e.g. "cli"/"api"); optional. */
  mode?: string;
}

/** A screen's provider selector state + setter. */
export interface ScreenProviderController {
  options: ScreenProviderOption[];
  /** Currently selected option id (a provider id or SCREEN_PROVIDER_ALL). */
  selected: string;
  onSelect: (id: string) => void;
}

/** Context value: only the (stable) setter children need to register. */
export interface ScreenProviderRegistry {
  setController: (c: ScreenProviderController | null) => void;
}

export const ScreenProviderContext = createContext<ScreenProviderRegistry | null>(null);

/**
 * Register the active screen's provider selector with the drawer.
 *
 * Loop-safe by construction: the live controller is kept in a ref, and the
 * drawer is only re-registered when the *displayed* content (option ids/modes +
 * selected id) changes BY VALUE — never on mere referential churn of the
 * controller object or its `options` array. This prevents the
 * register → setState → re-render → register feedback loop (React error #185)
 * that a deps-based effect hits when callers pass freshly-built arrays/closures
 * each render. `onSelect` always calls through to the latest closure via the ref.
 */
export function useRegisterScreenProvider(controller: ScreenProviderController): void {
  const reg = useContext(ScreenProviderContext);
  const setController = reg?.setController;

  // Always-current controller, read by the stable registered object.
  const ref = useRef(controller);
  ref.current = controller;

  // Value signature of what the strip shows; changes only when content changes.
  const signature =
    controller.options.map((o) => `${o.id}:${o.mode ?? ""}`).join("|") +
    "@" +
    controller.selected;

  useEffect(() => {
    if (!setController) return;
    setController({
      options: ref.current.options,
      selected: ref.current.selected,
      onSelect: (id) => ref.current.onSelect(id),
    });
    return () => setController(null);
    // Re-register only when the displayed content changes by value, or the
    // (stable) setter identity changes. NOT on every render.
  }, [setController, signature]);
}
