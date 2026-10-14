// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import * as React from "react";
import { createPortal } from "react-dom";
import { useModuleVisibility } from "@/components/workspace/module-visibility";
import type { DataTableRowActionConfig } from "./types";

const VIEWPORT_MARGIN = 8;
const TRIGGER_GAP = 4;
// Rough per-action row height (button padding + icon line) used ONLY to size the
// menu before it is measured. The real height from the mounted node refines it.
const EST_ACTION_H = 36;
const EST_MENU_PAD = 12;

interface Layout {
  top: number;
  right: number;
  maxHeight: number;
}

/**
 * Anchor the menu to the trigger button. Preference order:
 *   1. Fully below the trigger (natural dropdown) when it fits.
 *   2. Fully above the trigger when it fits (last rows of a long table).
 *   3. Otherwise, the side with more room, capped to that room (the menu then
 *      scrolls internally). The menu ALWAYS butts against the trigger — it never
 *      jumps to the top of the screen — so it stays visually attached to the row.
 */
function computeLayout(rect: DOMRect, menuH: number): Layout {
  const right = Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.right);
  const roomBelow = window.innerHeight - rect.bottom - TRIGGER_GAP - VIEWPORT_MARGIN;
  const roomAbove = rect.top - TRIGGER_GAP - VIEWPORT_MARGIN;

  if (menuH <= roomBelow) {
    return { top: rect.bottom + TRIGGER_GAP, right, maxHeight: menuH };
  }
  if (menuH <= roomAbove) {
    return { top: rect.top - menuH - TRIGGER_GAP, right, maxHeight: menuH };
  }
  // Doesn't fit whole on either side → use the roomier side, capped + scrolled.
  if (roomBelow >= roomAbove) {
    const maxHeight = Math.max(80, roomBelow);
    return { top: rect.bottom + TRIGGER_GAP, right, maxHeight };
  }
  const maxHeight = Math.max(80, roomAbove);
  return { top: Math.max(VIEWPORT_MARGIN, rect.top - TRIGGER_GAP - maxHeight), right, maxHeight };
}

export function RowActionsMenu({
  trigger,
  initialRect,
  container,
  actions,
  onSelect,
  onClose,
}: {
  trigger: HTMLElement;
  /** Trigger rect captured at click time — the reliable anchor even after the
   *  table re-render detaches the original trigger button from the DOM. */
  initialRect: DOMRect;
  /** Keep menus inside the owning dialog or workspace drawer's layer. */
  container: HTMLElement;
  actions: DataTableRowActionConfig[];
  onSelect: (actionId: string) => void;
  onClose: () => void;
}) {
  const visible = useModuleVisibility();
  React.useEffect(() => {
    if (!visible) onClose();
  }, [visible, onClose]);
  React.useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", closeOnEscape, true);
    return () => document.removeEventListener("keydown", closeOnEscape, true);
  }, [onClose]);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const lastRect = React.useRef<DOMRect>(initialRect);
  const estHeight = actions.length * EST_ACTION_H + EST_MENU_PAD;

  // Prefer the live trigger position (follows scroll) but fall back to the last
  // known-good rect when the trigger has been detached/replaced by a re-render
  // (its getBoundingClientRect would otherwise return zeros → off-screen menu).
  const resolveRect = React.useCallback((): DOMRect => {
    if (trigger.isConnected) {
      const r = trigger.getBoundingClientRect();
      if (r.width > 0 || r.height > 0) {
        lastRect.current = r;
        return r;
      }
    }
    return lastRect.current;
  }, [trigger]);

  const [layout, setLayout] = React.useState<Layout>(() => computeLayout(resolveRect(), estHeight));

  React.useEffect(() => {
    function update() {
      // Measure the content's natural height (scrollHeight), not the clamped
      // box height, so the placement decision uses the true size.
      const natural = menuRef.current?.scrollHeight || estHeight;
      const next = computeLayout(resolveRect(), natural);
      setLayout((prev) =>
        prev.top === next.top && prev.right === next.right && prev.maxHeight === next.maxHeight
          ? prev
          : next,
      );
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [resolveRect, estHeight]);

  const hostRect = container === document.body ? null : container.getBoundingClientRect();
  const top = hostRect ? layout.top - hostRect.top + container.scrollTop : layout.top;
  const right = hostRect
    ? hostRect.right - (window.innerWidth - layout.right)
    : layout.right;

  if (!visible) return null;
  return createPortal(
    <div
      ref={menuRef}
      data-data-table-actions-menu="true"
      role="menu"
      // A native modal dialog lives in the browser's top layer. Portaling to
      // body puts this menu behind its backdrop regardless of z-index.
      // Place it inside the dialog and convert viewport coordinates to the
      // dialog's positioned content coordinates.
      // `maxHeight`/`overflowY` para que una lista larga (p.ej. las 15 acciones
      // de correo) tenga scroll interno en lugar de salirse de la pantalla.
      style={{
        position: hostRect ? "absolute" : "fixed",
        top,
        right,
        // The drawer stylesheet gives every direct <div> child width: 100%.
        // Keep a portaled action menu sized to its own labels.
        width: "max-content",
        maxWidth: "min(90vw, 20rem)",
        zIndex: 1000,
        pointerEvents: "auto",
        maxHeight: layout.maxHeight,
        overflowY: "auto",
      }}
      className="min-w-[150px] rounded-lg border border-border bg-popover p-1 shadow-lg"
    >
      {actions.map((action) => {
        const isDanger = action.variant === "danger";
        return (
          <button
            key={action.id}
            type="button"
            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
              isDanger
                ? "mt-1 border-t border-border pt-2 text-destructive hover:bg-destructive/10"
                : "text-foreground hover:bg-accent"
            }`}
            onClick={() => onSelect(action.id)}
          >
            <i className={`ti ${action.icon ?? "ti-dots"} text-sm`} />
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>,
    container,
  );
}
