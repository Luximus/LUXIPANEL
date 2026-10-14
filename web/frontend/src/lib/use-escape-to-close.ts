// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect } from "react";

/**
 * Calls `onClose` when the user presses Escape.
 *
 * Use this on any modal-like component so the Escape key always dismisses it.
 * The hook is intentionally minimal — wire the rest of the modal (backdrop
 * click, etc.) in the component. For variants that also handle Arrow keys (the
 * carousel) keep the listener local in that component, since the audit
 * flagged the plain Escape-only cases.
 */
export function useEscapeToClose(onClose: () => void, enabled: boolean = true): void {
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, onClose]);
}
