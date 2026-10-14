// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import esComponents from "@/i18n/es/components";
import type {
  DataTableFilterConfig,
  DataTableI18n,
  DataTableRowActionConfig,
  DataTableValueBadgeConfig,
} from "./types";

// Defaults estables a nivel módulo: si se usan como `prop = []` en la
// destructuración, JS crea un array NUEVO en cada render del componente,
// con la consecuencia de que `useMemo([rows, filters, ...])` se invalida
// siempre, `filteredRows` cambia de identidad cada render, TanStack
// detecta nueva `data` y dispara `_autoResetPageIndex` → `setPagination`
// → re-render → loop infinito (la pestaña Configuración y los toggles
// de favoritos del historial caían en este loop).
export const EMPTY_FILTERS: DataTableFilterConfig[] = [];
export const EMPTY_ROW_ACTIONS: DataTableRowActionConfig[] = [];
export const EMPTY_VALUE_BADGES: DataTableValueBadgeConfig[] = [];
/** Default page-size dropdown for standard tables. Exported as the SSOT so
 *  table-configs/pages need not re-declare `[10,20,50,100]` (the prop default). */
export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// Fallback desde el catálogo canónico: evita duplicar traducciones locales.
export const DATA_TABLE_I18N_ES: DataTableI18n = esComponents.dataTable as DataTableI18n;
