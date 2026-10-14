// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect } from "react";
import {
  acquireBodyPointerEvents,
  releaseBodyPointerEvents,
} from "./body-pointer-events-core";

// Re-export the React-free core so existing `@/lib/body-pointer-events`
// importers keep working unchanged.
export { acquireBodyPointerEvents, releaseBodyPointerEvents };

/**
 * Ref-counted override for `document.body.style.pointerEvents`.
 *
 * The terminal and AI-assistant modules render their UI inside a **vaul**
 * drawer. vaul sits on top of a Radix `Dialog` that is *always* `modal=true`
 * (vaul never forwards `modal={false}` to the underlying `DialogPrimitive.Root`),
 * so Radix's `DismissableLayer` forces `body { pointer-events: none }` while the
 * drawer is open and only re-enables pointer events on the drawer content itself.
 *
 * Any modal/lightbox/dialog we render ABOVE the drawer (portaled to `<body>`, or
 * a native `<dialog>` opened with `showModal()`) is therefore a sibling of that
 * dead body and *inherits* `pointer-events: none` — its inputs and buttons stop
 * responding even though it is painted on top. The full-screen overlay already
 * blocks the drawer underneath, so re-enabling body pointer events is safe.
 *
 * `acquire()` flips the body to `pointer-events: auto` (remembering the previous
 * inline value the first time), and `release()` restores the original value once
 * the last layer is gone — so the drawer's own dismiss behaviour is untouched.
 * Ref counting keeps stacked layers (e.g. ProjectModal → child edit modal)
 * correct: the body only reverts when every layer has released.
 */

/**
 * React hook: while `active` is true, keep the body interactive (see module
 * docs). Releases automatically on unmount or when `active` turns false.
 */
export function useBodyPointerEventsWhileOpen(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    acquireBodyPointerEvents();
    return () => releaseBodyPointerEvents();
  }, [active]);
}
