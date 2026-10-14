// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import * as React from "react";
import { isStatusDotCell, isUsageBarCell } from "./helpers";
import type { DataTableI18n, DataTableValueBadgeConfig } from "./types";

export function formatCellValue(value: unknown, valueBadges: Map<string, DataTableValueBadgeConfig>, i18n: DataTableI18n): React.ReactNode {
  if (isUsageBarCell(value)) {
    const pct = Number(value.percent);
    const width = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
    return (
      <div className="min-w-[150px]">
        <div className="mb-1 text-xs text-muted-foreground whitespace-nowrap">{value.label}</div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
          <div
            className={`h-full rounded-full transition-all ${value.barClass}`}
            style={{ width: `${width}%` }}
          />
        </div>
      </div>
    );
  }

  if (isStatusDotCell(value)) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={value.label}>
        <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${value.dotClass}`} aria-hidden="true" />
        <span className="text-xs text-muted-foreground">{value.label}</span>
      </span>
    );
  }

  if (typeof value === "string") {
    const badge = valueBadges.get(value);
    if (badge) {
      return (
        <span className={badge.className}>
          {badge.label ?? value}
        </span>
      );
    }
  }

  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.slice(0, 4).map((item, idx) => (
          <span key={`${String(item)}-${idx}`} className="rounded-full border border-border px-2 py-0.5 text-xs">
            {String(item)}
          </span>
        ))}
        {value.length > 4 ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">+{value.length - 4}</span>
        ) : null}
      </div>
    );
  }

  if (typeof value === "boolean") return value ? i18n.boolTrue : i18n.boolFalse;
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">{i18n.emptyCell}</span>;
  return String(value);
}

export function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!ref.current) return;
    ref.current.indeterminate = Boolean(indeterminate) && !checked;
  }, [checked, indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className="h-4 w-4 rounded border-input bg-background text-white accent-violet-700 checked:border-violet-700 checked:bg-violet-700 focus:ring-2 focus:ring-violet-500/30 dark:accent-primary dark:checked:border-primary dark:checked:bg-primary"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={ariaLabel}
    />
  );
}
