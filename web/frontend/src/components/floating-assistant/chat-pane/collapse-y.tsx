// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useState, type ReactNode } from "react";

/**
 * Vertical fold used by the chat sidebar accordions (agent groups, project
 * folders, "Chats sueltos"). Same preset as the rest of the panel (motion.css
 * tokens: 200ms ease-out): grid-rows 1fr↔0fr + opacity. The children mount
 * when the fold opens and stay mounted ~200ms after it closes so the fold-up
 * is animated; while closed nothing is rendered (long lists stay cheap and out
 * of the tab order).
 */
export function CollapseY({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  // `shown` lags `open` on close so the exit transition can play.
  const [shown, setShown] = useState(open);
  useEffect(() => {
    if (open) { setShown(true); return; }
    const t = window.setTimeout(() => setShown(false), 220);
    return () => window.clearTimeout(t);
  }, [open]);
  if (!open && !shown) return null;
  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${open && shown ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"} ${className ?? ""}`}
      aria-hidden={!open}
      // `inert` keeps the folding content out of focus/AT while it animates out.
      {...(!open ? { inert: true } : {})}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
