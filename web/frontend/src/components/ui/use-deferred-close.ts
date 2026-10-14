// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * useDeferredClose — exit animation for React overlays that UNMOUNT on close.
 *
 * The panel's motion standard (`src/styles/motion.css`, mirrored from the
 * left sidebar collapse) is 200ms ease-out. Overlays rendered conditionally
 * (`{open && <Modal onClose=… />}`) vanish instantly when `onClose` flips the
 * parent's state, so this hook interposes: `requestClose()` marks the overlay
 * as `closing` (the caller renders its exit classes), waits the motion
 * duration, and only THEN invokes the real `onClose`.
 *
 * - Double calls while closing are ignored (no double `onClose`).
 * - `prefers-reduced-motion: reduce` → `onClose` runs immediately.
 * - Unmount during the delay cancels the timer.
 * - `requestClose(fn)` lets a nested control (e.g. a header ✕ whose consumer
 *   passed its own handler) play the SAME exit and then run `fn` instead.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export const MOTION_DURATION_MS = 200;

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export type DeferredClose = {
  /** True while the exit animation plays (render exit classes). */
  closing: boolean;
  /** Play the exit animation, then call `fn` (defaults to the hook's `onClose`). */
  requestClose: (fn?: () => void) => void;
};

export function useDeferredClose(onClose: () => void, ms: number = MOTION_DURATION_MS): DeferredClose {
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const requestClose = useCallback((fn?: () => void) => {
    const run = fn ?? onCloseRef.current;
    if (timerRef.current) return; // already closing
    if (prefersReducedMotion() || ms <= 0) { run(); return; }
    setClosing(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      run();
    }, ms);
  }, [ms]);

  return { closing, requestClose };
}

/**
 * Context published by `ModalShell` so nested chrome (ModalNavbar ✕, footer
 * "Cancelar" buttons) can route their close through the shell's exit
 * animation without the consumer threading a prop.
 */
export const ModalCloseContext = createContext<DeferredClose | null>(null);

export function useModalClose(): DeferredClose | null {
  return useContext(ModalCloseContext);
}
