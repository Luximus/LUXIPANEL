// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * React-free core of the body pointer-events ref-count. Kept separate from
 * `body-pointer-events.ts` (which adds the React hook) so plain DOM consumers —
 * the native `<dialog>` modal helpers in `confirm.ts`, extracted page scripts —
 * can use it WITHOUT pulling React into their standalone bundles.
 *
 * See `body-pointer-events.ts` for the full rationale (vaul drawers force
 * `body { pointer-events: none }`; modals painted above must re-enable it).
 */

let lockCount = 0;
let previousValue: string | null = null;

export function acquireBodyPointerEvents(): void {
  if (typeof document === "undefined") return;
  if (lockCount === 0) {
    previousValue = document.body.style.pointerEvents;
    document.body.style.pointerEvents = "auto";
  }
  lockCount += 1;
}

export function releaseBodyPointerEvents(): void {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.pointerEvents = previousValue ?? "";
    previousValue = null;
  }
}
