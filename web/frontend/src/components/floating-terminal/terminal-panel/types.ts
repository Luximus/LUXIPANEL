// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

export interface SnippetCategoryRow { id: number; name: string }
export interface SnippetTagRow { id: number; name: string; categoryId: number }
export interface SnippetsSnapshot {
  categories: SnippetCategoryRow[];
  tags: SnippetTagRow[];
}

export type SidebarTab = "snippets" | "history";
export type ConfigSubtab = "general" | "categories" | "tags";

export interface TerminalPanelProps {
  /**
   * `drawer` = dentro del drawer flotante (FAB). `view` = vista de página
   * (`/panel/terminal`). El cuerpo es idéntico en ambos modos; sólo cambian el
   * shell exterior (lo aporta quien renderiza) y las affordances de cierre/lock,
   * que sólo tienen sentido en el drawer.
   */
  variant: "drawer" | "view";
  /** Locale para cargar el slice i18n del namespace "terminal". */
  locale: string;
  /** Drawer: cierra el drawer (botón chevron del header de consola). */
  onClose?: () => void;
  /** Drawer: pide que el drawer se abra (lo usa "Instalar" para revelar la consola). */
  onRequestVisible?: () => void;
  /** Drawer: refleja el candado anti-cierre-por-gesto en `dismissible`. */
  onLockedChange?: (locked: boolean) => void;
}
