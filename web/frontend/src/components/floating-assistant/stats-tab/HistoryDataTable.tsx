import type { PageWindowSource } from "@/lib/page-window";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useMemo } from "react";
import DataTable, {
  type DataTableColumnConfig,
  type DataTableFilterConfig,
  type DataTableI18n,
  type DataTableValueBadgeConfig,
} from "@/components/ui/DataTable";
import { type AssistantProviderId, type UsageRecord } from "../assistant-api";
import { useAssistantI18n } from "../i18n";

export function HistoryDataTable({
  rows,
  loading,
  models,
  provider,
  t,
  dataTableI18n,
  pageWindowSource,
}: {
  rows: UsageRecord[];
  loading: boolean;
  models: string[];
  provider: AssistantProviderId;
  t: ReturnType<typeof useAssistantI18n>["statsTab"];
  dataTableI18n?: DataTableI18n | null;
  pageWindowSource?: PageWindowSource;
}) {
  // Shape each row once: pre-format the date for display and keep the raw
  // timestamp as a `sortAccessor` so the column sorts chronologically.
  const data = useMemo(
    () =>
      rows.map((r) => ({
        id: r.id ?? `${r.ts}-${r.model}-${r.mode}`,
        ts: r.ts,
        date: new Date(r.ts).toLocaleString(),
        model: r.model,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        totalTokens: r.totalTokens,
        mode: r.mode,
        estimated: r.estimated,
      })),
    [rows],
  );

  const columns = useMemo<DataTableColumnConfig[]>(
    () => [
      { id: "date", header: t.date, accessorKey: "date", sortAccessor: "ts", sortable: true, hideable: false },
      { id: "model", header: t.model, accessorKey: "model", sortable: true, hideable: false },
      { id: "input", header: t.chartInputLabel, accessorKey: "inputTokens", sortable: true, hideable: true, total: true, totalFormat: "integer" },
      { id: "output", header: t.chartOutputLabel, accessorKey: "outputTokens", sortable: true, hideable: true, total: true, totalFormat: "integer" },
      { id: "total", header: t.total, accessorKey: "totalTokens", sortable: true, hideable: true, total: true, totalFormat: "integer" },
      {
        id: "mode",
        header: t.mode,
        accessorKey: "mode",
        sortable: true,
        hideable: false,
        renderCell: (row: Record<string, unknown>) => {
          const r = row as { mode: string; estimated: boolean };
          return (
            <span className="inline-flex items-center gap-1">
              <span>{r.mode}</span>
              {r.estimated && (
                <span className="text-[10px] text-amber-500" title={t.estimatedSuffix}>{t.estimatedSuffix}</span>
              )}
            </span>
          );
        },
      },
    ],
    [t],
  );

  const filters = useMemo<DataTableFilterConfig[]>(
    () => [
      {
        id: "model",
        label: t.model,
        accessorKey: "model",
        type: "select",
        options: models.map((m) => ({ value: m, label: m })),
      },
      {
        id: "mode",
        label: t.mode,
        accessorKey: "mode",
        type: "select",
        options: [
          { value: "api", label: "api" },
          { value: "cli", label: "cli" },
        ],
      },
    ],
    [t, models],
  );

  // `valueBadges` paints a colored pill around the matching cell value.
  const valueBadges = useMemo<DataTableValueBadgeConfig[]>(
    () => [
      { value: "api", className: "rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-600" },
      { value: "cli", className: "rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] text-violet-600" },
    ],
    [],
  );

  // Use `loading` indirectly via `key` so a refresh re-mounts the table and
  // guarantees the totals reflect the freshest dataset (TanStack otherwise
  // would short-circuit identical ref arrays).
  void loading;

  return (
    <DataTable
      tableId={`assistant-history-${provider}`}
      serverQuery
      pageWindowSource={pageWindowSource}
      title={t.history}
      columns={columns}
      data={data}
      filters={filters}
      valueBadges={valueBadges}
      selectable={false}
      pageSizeOptions={[10, 20, 50, 100]}
      i18n={dataTableI18n ?? undefined}
    />
  );
}

