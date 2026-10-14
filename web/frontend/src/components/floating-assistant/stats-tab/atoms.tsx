// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import DataTable, {
  type DataTableColumnConfig,
  type DataTableFilterConfig,
  type DataTableI18n,
  type DataTableValueBadgeConfig,
} from "@/components/ui/DataTable";

export function Box({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${highlight ? "border-primary/40 bg-primary/5" : "border-border bg-background"}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}


export function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${highlight ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-base font-semibold">{value.toLocaleString()}</p>
    </div>
  );
}

/**
 * Pill variant for the cost card: same "from X, ↑Y%" semantics as
 * `StatDelta`, but it only renders the chip (no card chrome, since the
 * cost card has its own header). Renders nothing when there's no prior
 * period to compare against — the cost value stands alone.
 */
