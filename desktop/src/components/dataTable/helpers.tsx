import type { DataTableValueBadgeConfig } from "./types";

/**
 * Parsea un número formateado (es-CO/loanwords) a magnitud: descarta moneda,
 * %, unidades y espacios; "." = miles, "," = decimal. Devuelve null si no hay
 * dígitos. Fallback de `summary.value` para columnas de unidad única. */
export function parseLocaleNumber(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (input == null) return null;
  const cleaned = String(input).replace(/[^\d.,-]/g, "");
  if (!/\d/.test(cleaned)) return null;
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

export function normalizeText(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "")).join(" ").toLowerCase();
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase();
}

export function normalizeSelectValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  const text = String(value ?? "").trim();
  return text ? [text] : [];
}

function badgeForValue(value: unknown, map: Map<string, DataTableValueBadgeConfig>) {
  const key = String(value ?? "").trim().toLowerCase();
  return map.get(key) ?? map.get(String(value ?? ""));
}

export function renderCellValue(value: unknown, badgeMap: Map<string, DataTableValueBadgeConfig>, noTagsLabel: string) {
  const badge = badgeForValue(value, badgeMap);
  if (badge) {
    return <span className={`badge dt-badge ${badge.className}`}>{badge.label ?? String(value ?? "")}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="badge dt-badge border border-slate-300 bg-slate-100 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-white">{noTagsLabel}</span>;
    }

    return (
      <div className="flex flex-wrap gap-1">
        {value.slice(0, 4).map((item, index) => (
          <span key={`${String(item)}-${index}`} className="badge dt-badge border border-slate-300 bg-slate-100 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-white">
            {String(item)}
          </span>
        ))}
        {value.length > 4 ? <span className="badge dt-badge border border-slate-300 bg-slate-200 text-slate-700 dark:border-white/15 dark:bg-white/15 dark:text-white">+{value.length - 4}</span> : null}
      </div>
    );
  }

  if (value === null || value === undefined || value === "") return <span className="opacity-60">-</span>;
  return String(value);
}
