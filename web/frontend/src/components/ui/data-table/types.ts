// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import * as React from "react";
import type { PageWindowSource } from "@/lib/page-window";

export type DataTableColumnConfig = {
  id: string;
  header: string;
  accessorKey: string;
  sortable?: boolean;
  hideable?: boolean;
  /** Renders a per-row button in this column and emits the usual row-action event. */
  actionId?: string;
  actionLabel?: string;
  actionIcon?: string;
  actionLabelAccessor?: string;
  /**
   * When set, sorting for this column compares the numeric value at
   * `row[sortAccessor]` instead of the (possibly structured/formatted)
   * cell value. Used by columns whose cell is a widget (e.g. a usage
   * progress bar) but must still sort by the underlying number.
   */
  sortAccessor?: string;
  /**
   * Cuando es `true`, se renderiza una fila fija de totales al final de la
   * tabla que SUMA los valores numéricos de esta columna sobre TODAS las
   * filas que pasan el filtro actual (no solo la página visible). El número
   * a sumar se toma de `totalAccessor ?? sortAccessor ?? accessorKey`, así
   * que columnas cuya celda es un texto formateado (p.ej. "1.2 GB") pueden
   * sumar por su valor numérico subyacente.
   */
  total?: boolean;
  /** Campo numérico a sumar para el total. Default: `sortAccessor ?? accessorKey`. */
  totalAccessor?: string;
  /**
   * Cómo formatear el total mostrado. `integer` redondea; `decimal` muestra
   * hasta 2 decimales; `bytes` usa unidades B/KB/MB/GB/TB. Default: `decimal`.
   */
  totalFormat?: "integer" | "decimal" | "bytes";
};

/**
 * Structured cell value: a usage progress bar (mirrors the
 * "Uso total de almacenamiento" card). Pass this object as the row's value
 * for the column instead of a string.
 */
export type UsageBarCell = {
  __cell: "usagebar";
  /** 0–100 (clamped). Negative / non-finite → empty bar (unknown). */
  percent: number;
  /** Text shown above the bar, e.g. "1.2 GB / 5 GB · 24%". */
  label: string;
  /** Tailwind bg-* class for the filled portion. */
  barClass: string;
};

/**
 * Structured cell value: a colored status dot + label with a hover tooltip.
 * Pass this object as the row's value for the column (it is plain data, so it
 * survives the Astro island boundary unlike a `renderCell` function).
 */
export type StatusDotCell = {
  __cell: "statusdot";
  /** Tailwind bg-* class for the dot (e.g. "bg-emerald-500", "bg-gray-400"). */
  dotClass: string;
  /** Visible text next to the dot AND the title/tooltip. */
  label: string;
};

export type DataTableFilterConfig = {
  id: string;
  label: string;
  accessorKey: string;
  type: "text" | "select";
  options?: Array<{ label: string; value: string }>;
};

export type DataTableRowActionConfig = {
  id: string;
  label: string;
  icon?: string;
  variant?: "default" | "danger";
  /** Optional row condition for actions that only apply to a subset of rows. */
  visibleWhen?: { field: string; equals: string | boolean };
};

export type DataTableQuickActionConfig = {
  id: string;
  label: string;
  icon?: string;
  variant?: "default" | "danger";
};

export type DataTableValueBadgeConfig = {
  value: string;
  className: string;
  label?: string;
};

export type DataTableProps = {
  tableId: string;
  /** Keep this table's display settings separate for each user and server. */
  scopedPreferences?: boolean;
  title?: string;
  columns: DataTableColumnConfig[];
  data: Record<string, unknown>[];
  filters?: DataTableFilterConfig[];
  rowActions?: DataTableRowActionConfig[];
  quickActions?: DataTableQuickActionConfig[];
  valueBadges?: DataTableValueBadgeConfig[];
  pageSizeOptions?: number[];
  /** Render the same settings control beside an owning module's counter. */
  settingsButtonContainer?: HTMLElement | null;
  /** Incremental API source; snapshots use the same two-page window locally. */
  pageWindowSource?: PageWindowSource;
  /** Cuando es false, oculta la columna de selección (checkboxes) y, por
   * tanto, la barra de acciones masivas. Default: true. */
  selectable?: boolean;
  /**
   * Cuando se proporciona, sustituye la celda por defecto de acciones
   * (botón ⋯ con menú) por contenido custom inline por fila. Útil para
   * mostrar siempre íconos rápidos (estrella favorita, copiar, eliminar)
   * sin esconderlos detrás de un menú.
   */
  renderRowActions?: (row: Record<string, unknown>) => React.ReactNode;
  /**
   * Permite anular cómo se pinta el contenido de una columna por id.
   * El renderer recibe la fila entera. Sólo aplica a columnas de datos
   * (no a `_select` ni a `_actions`).
   */
  renderCell?: Partial<Record<string, (row: Record<string, unknown>) => React.ReactNode>>;
  /**
   * Textos internos del componente (paginación, estado vacío, botones de
   * chrome, etc.). Las páginas pasan `t.components.dataTable`. Si se omite,
   * se usan los textos en español por defecto (sin regresión).
   */
  i18n?: DataTableI18n;
  /**
   * Modo de paginación EXTERNA (server-side). Cuando es `true`, el componente
   * NO pagina client-side: muestra TODAS las filas que recibe (= la página
   * actual entregada por el servidor) y su pie de paginación emite eventos
   * `lxp:data-table:page` (`{tableId, dir:"prev"|"next"}`) en vez de cambiar el
   * índice local. El host responde recargando y empuja el estado de los botones
   * + el texto informativo con `lxp:data-table:set-pagination`
   * (`{tableId, canPrev, canNext, info}`). Default `false` → paginación
   * client-side de siempre (sin regresión para las tablas existentes).
   */
  externalPagination?: boolean;
  /** Filters/sorting are applied by the host API over the whole collection. */
  serverQuery?: boolean;
};

/** Textos internos del DataTable (chrome del componente). */
export type DataTableI18n = {
  retry?: string;
  boolTrue: string;
  boolFalse: string;
  selectPage: string;
  selectRow: string;
  actions: string;
  configure: string;
  empty: string;
  total: string;
  selectedSummary: string;
  summary: string;
  prev: string;
  next: string;
  pageOf: string;
  configureTitle: string;
  columnsAndOrder: string;
  resultsPerPage: string;
  moveUp: string;
  moveDown: string;
  defaultTitle: string;
  dragHandle: string;
  moveUpAria: string;
  moveDownAria: string;
  emptyCell: string;
};

export type RowData = Record<string, unknown>;
export type FilterState = Record<string, string>;
