import type { ReactNode } from "react";

/**
 * Total de columna en la fila fija al pie de la tabla. La suma se calcula sobre
 * TODO el resultado filtrado (no solo la página visible). Como las celdas
 * suelen guardar strings ya formateados con unidades mixtas (p. ej.
 * "456,24 KB", "US$ 12,99"), sumar el texto daría basura: `value` extrae la
 * magnitud cruda de la fila (idealmente un campo numérico aparte) y `format`
 * formatea el total. Sin `value` se cae a parsear el valor mostrado, válido
 * solo para columnas de unidad única (moneda, enteros). */
export type DataTableColumnSummary<T extends Record<string, unknown>> = {
  value?: (row: T) => number | null | undefined;
  format?: (total: number) => ReactNode;
};

export type DataTableColumnConfig<T extends Record<string, unknown>> = {
  id: string;
  header: string;
  accessorKey: keyof T & string;
  sortable?: boolean;
  hideable?: boolean;
  /** Render personalizado de la celda. Si se omite se usa el valor crudo de
   *  `accessorKey`. El filtrado/orden siguen operando sobre `accessorKey`. */
  cell?: (row: T) => ReactNode;
  /** Total de columna en la fila fija al pie. Si se omite, no aporta total. */
  summary?: DataTableColumnSummary<T>;
};

export type DataTableFilterConfig<T extends Record<string, unknown>> = {
  id: string;
  label: string;
  accessorKey: keyof T & string;
  type: "text" | "select";
  options?: Array<{ label: string; value: string }>;
};

export type DataTableRowActionConfig<T extends Record<string, unknown>> = {
  id: string;
  label: string;
  variant?: "default" | "danger";
  visible?: (row: T) => boolean;
};

export type DataTableQuickActionConfig<T extends Record<string, unknown>> = {
  id: string;
  label: string;
  icon?: ReactNode;
  requiresSelection?: boolean;
  variant?: "default" | "primary" | "danger";
  onClick?: (rows: T[]) => void;
};

export type DataTableValueBadgeConfig = {
  value: string;
  className: string;
  label?: string;
};
