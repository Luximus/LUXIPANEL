// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * DrawerSectionNav — the left section menu of the panel's "wide" drawers
 * (Ajustes de Agentes IA, Nuevo/Editar proyecto). One shared component so the
 * two drawers never drift apart: icon-only rail (w-14) that widens to labels
 * from the `@xl` container breakpoint, `aria-current` on the active item and
 * the panel's 200ms ease-out colour transition.
 *
 * Usage: the drawer body is `flex h-full min-h-0` → `<DrawerSectionNav …>` +
 * a `min-w-0 flex-1 overflow-y-auto … @container` content column.
 */
import { cn } from "@/lib/utils";

export type DrawerSectionItem = {
  id: string;
  label: string;
  /** Tabler icon class (e.g. "ti-settings"). */
  icon: string;
  /** Native tooltip / header description of the section. */
  description?: string;
};

export type DrawerSectionNavProps = {
  items: DrawerSectionItem[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
};

export function DrawerSectionNav({ items, activeId, onSelect, className }: DrawerSectionNavProps) {
  return (
    <nav data-rubber-tabs aria-orientation="vertical" className={cn("flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-muted/20 p-2 @xl:w-52", className)}>
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={isActive ? "page" : undefined}
            title={item.description ?? item.label}
            className={cn(
              "flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 ease-out @xl:justify-start",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <i className={cn("ti shrink-0 text-lg", item.icon)} aria-hidden></i>
            <span className="hidden truncate @xl:inline">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
