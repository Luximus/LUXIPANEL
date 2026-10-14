// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Copy-to-clipboard with a transient "copied" flag (F-17).
 *
 * Four components reimplemented the same three lines
 * (`navigator.clipboard.writeText` in a try/catch, `setCopied(true)`,
 * `setTimeout(() => setCopied(false), 1500)`), two of them without any feedback
 * at all. The hook owns the state + timer (cleared on unmount so a fast close
 * never sets state on a dead component); the *markup* stays at each call site,
 * so every button keeps its own classes and labels.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** How long the "copied" confirmation stays on screen. */
export const COPY_FEEDBACK_MS = 1500;

export function useCopyToClipboard(resetMs: number = COPY_FEEDBACK_MS): {
  copied: boolean;
  /** Writes `text`; resolves to `true` on success. Never throws. */
  copy: (text: string) => Promise<boolean>;
} {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Clipboard unavailable (insecure context / denied permission) — silent.
        return false;
      }
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), resetMs);
      return true;
    },
    [resetMs],
  );

  return { copied, copy };
}
