// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** React Bits Swipe Row adapted to the compact assistant rail.
 * Interaction reference: https://reactbits.dev/micro/swipe-row
 * Full swipe is intentionally disabled for destructive chat actions.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";

export interface SwipeRowAction {
  id: string;
  label: string;
  icon: string;
  onSelect: () => void;
  tone?: "danger" | "primary";
}

const ACTION_WIDTH = 48;

export function SwipeRow({ children, actions, moreLabel = "Más acciones", className = "" }: {
  children: ReactNode;
  actions: SwipeRowAction[];
  moreLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const x = useMotionValue(0);
  const reduceMotion = useReducedMotion();
  const drawerId = useId();
  const rowRef = useRef<HTMLDivElement>(null);
  const drawerWidth = actions.length * ACTION_WIDTH;

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rowRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  useEffect(() => {
    const animation = animate(x, open ? -drawerWidth : 0, reduceMotion
      ? { duration: 0 }
      : { type: "spring", stiffness: 500, damping: 42 });
    return () => animation.stop();
  }, [open, drawerWidth, x, reduceMotion]);

  const selectAction = (action: SwipeRowAction) => {
    setOpen(false);
    action.onSelect();
  };

  return (
    <div ref={rowRef} className={`relative min-w-0 overflow-hidden rounded-md ${className}`} data-swipe-row data-open={open} onKeyDown={(event) => {
      if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); }
    }}>
      <div id={drawerId} className="absolute inset-y-0 right-0 flex items-stretch" aria-hidden={!open}>
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            tabIndex={open ? 0 : -1}
            onClick={() => selectAction(action)}
            title={action.label}
            aria-label={action.label}
            className={`grid w-12 shrink-0 place-items-center border-l border-border/40 text-sm transition-colors ${action.tone === "danger" ? "bg-destructive/15 text-destructive hover:bg-destructive/25" : action.tone === "primary" ? "bg-primary/15 text-primary hover:bg-primary/25" : "bg-muted text-foreground hover:bg-accent"}`}
          >
            <i className={`ti ${action.icon}`} aria-hidden="true" />
          </button>
        ))}
      </div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -drawerWidth, right: 0 }}
        dragElastic={0.08}
        onDragEnd={(_event, info) => setOpen(info.velocity.x > 350 ? false : info.velocity.x < -350 ? true : x.get() < -drawerWidth * 0.38)}
        style={{ x, touchAction: "pan-y" }}
        className="relative flex min-w-0 items-stretch bg-card"
      >
        <div className="min-w-0 flex-1">{children}</div>
        <button
          type="button"
          aria-label={moreLabel}
          aria-expanded={open}
          aria-controls={drawerId}
          onClick={() => setOpen((value) => !value)}
          className="grid min-h-10 w-10 shrink-0 place-items-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          <i className={`ti ${open ? "ti-x" : "ti-dots-vertical"} text-sm`} aria-hidden="true" />
        </button>
      </motion.div>
    </div>
  );
}
