// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { fmtBytes } from "@/lib/format";
import { formatMessage } from "@/i18n/client";
import type {
  DataTableColumnConfig,
  RowData,
  StatusDotCell,
  UsageBarCell,
} from "./types";

export function isUsageBarCell(v: unknown): v is UsageBarCell {
  return !!v && typeof v === "object" && (v as { __cell?: unknown }).__cell === "usagebar";
}

export function isStatusDotCell(v: unknown): v is StatusDotCell {
  return !!v && typeof v === "object" && (v as { __cell?: unknown }).__cell === "statusdot";
}

// Interpolación {clave}: alias del canónico `formatMessage` (T-08).
export const dtFormat = formatMessage;

export function formatColumnTotal(sum: number, format: DataTableColumnConfig["totalFormat"]): string {
  if (format === "bytes") {
    return fmtBytes(sum, { decimals: "trim2" });
  }
  if (format === "integer") return Math.round(sum).toLocaleString();
  return sum.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function normalizeFilterValue(raw: unknown): string {
  if (Array.isArray(raw)) return raw.map((item) => String(item ?? "")).join(" ").toLowerCase();
  if (raw === null || raw === undefined) return "";
  return String(raw).toLowerCase();
}

// Columnas centinela fijas: selección a la izquierda, acciones a la derecha.
// El orden de columnas de datos vive ENTRE ellas; estos helpers lo separan y
// lo reenvuelven sin re-teclear los ids centinela en cada sitio.
export function dataColumnIds(order: string[]): string[] {
  return order.filter((id) => id !== "_select" && id !== "_actions");
}

export function withSentinels(ids: string[]): string[] {
  return ["_select", ...ids, "_actions"];
}

// Igualdad superficial de dos datasets de filas: misma longitud y, por índice,
// misma referencia o mismo `id` + mismas claves + mismos valores (===). Sirve
// para no re-setear `rows` cuando el origen re-emite un dataset equivalente,
// lo que dispararía renders extra y `autoResetPageIndex`.
export function rowsEqual(prev: RowData[], next: RowData[]): boolean {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] === next[i]) continue;
    const p = prev[i];
    const n = next[i];
    if (!p || !n || p.id !== n.id) return false;
    const pk = Object.keys(p);
    const nk = Object.keys(n);
    if (pk.length !== nk.length) return false;
    for (const k of pk) {
      if (p[k] !== n[k]) return false;
    }
  }
  return true;
}
