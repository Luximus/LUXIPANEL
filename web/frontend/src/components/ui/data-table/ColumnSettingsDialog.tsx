// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import * as React from "react";
import { DIALOG_CHROME } from "@/lib/ui-classes";
import type { DataTableColumnConfig, DataTableI18n } from "./types";
import { ReorderList } from "@/components/reactbits-controls/ReorderList";

type ColumnSettingsDialogProps = {
  title: string;
  columnsAndOrderLabel: string;
  resultsPerPageLabel: string;
  i18n: DataTableI18n;
  columns: DataTableColumnConfig[];
  visibility: Record<string, boolean>;
  pageSize: number;
  pageSizeOptions: number[];
  showPageSize: boolean;
  onToggle: (columnId: string, checked: boolean) => void;
  onReorder: (sourceId: string, targetId: string) => void;
  onPageSizeChange: (size: number) => void;
  onClose: () => void;
};

/**
 * Modal "Configure table". Reordena columnas por drag-and-drop (handle
 * `ti-grip-vertical`, mismo patrón que `/panel/modules`) con botones ↑/↓
 * como fallback accesible. El ref + showModal/close se hace en el padre
 * para mantener sincronizado `showSettings` con los cierres nativos
 * (Escape, clic en backdrop) — ver effect en `DataTable`.
 */
export const ColumnSettingsDialog = React.forwardRef<
  HTMLDialogElement,
  ColumnSettingsDialogProps
>(function ColumnSettingsDialog(
  {
    title,
    columnsAndOrderLabel,
    resultsPerPageLabel,
    i18n: dt,
    columns,
    visibility,
    pageSize,
    pageSizeOptions,
    showPageSize,
    onToggle,
    onReorder,
    onPageSizeChange,
    onClose,
  },
  ref,
) {
  return (
    <dialog ref={ref} className={`w-full max-w-2xl ${DIALOG_CHROME}`}>
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h3 className="text-base font-semibold">{title}</h3>
        <button
          type="button"
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={onClose}
        >
          <i className="ti ti-x text-lg" />
        </button>
      </div>

      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">{columnsAndOrderLabel}</h4>
          <ReorderList
            items={columns}
            label={columnsAndOrderLabel}
            rowHeight={58}
            onReorder={(next) => {
              for (let from = 0; from < columns.length; from++) {
                const to = next.findIndex((c) => c.id === columns[from].id);
                if (to === from) continue;
                const candidate = [...columns];
                const [moved] = candidate.splice(from, 1);
                candidate.splice(to, 0, moved);
                if (candidate.every((c, i) => c.id === next[i].id)) {
                  onReorder(moved.id, columns[to].id);
                  break;
                }
              }
            }}
            renderItem={(column, index) => (
              <div
                key={column.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-2 py-2"
                style={{ height: 58 }}
              >
                <button
                  type="button"
                  data-reorder-handle
                  className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground/60 hover:bg-accent hover:text-foreground active:cursor-grabbing"
                  title={dt.dragHandle}
                  aria-label={dt.dragHandle}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowUp" && event.key !== "ArrowDown")
                      return;
                    event.preventDefault();
                    const target =
                      columns[index + (event.key === "ArrowUp" ? -1 : 1)];
                    if (target) onReorder(column.id, target.id);
                  }}
                >
                  <i className="ti ti-grip-vertical text-base" />
                </button>

                <label className="inline-flex flex-1 cursor-pointer items-center gap-2 pl-1 text-sm">
                  <input
                    type="checkbox"
                    checked={visibility[column.id] !== false}
                    onChange={(event) =>
                      onToggle(column.id, event.target.checked)
                    }
                  />
                  {column.header}
                </label>

                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="rounded border border-border px-2 py-1 text-xs transition-colors hover:bg-accent disabled:opacity-40"
                    onClick={() =>
                      onReorder(columns[index - 1]?.id ?? "", column.id)
                    }
                    disabled={index === 0}
                    aria-label={dt.moveUpAria.replace("{col}", column.header)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rounded border border-border px-2 py-1 text-xs transition-colors hover:bg-accent disabled:opacity-40"
                    onClick={() =>
                      onReorder(columns[index + 1]?.id ?? "", column.id)
                    }
                    disabled={index === columns.length - 1}
                    aria-label={dt.moveDownAria.replace("{col}", column.header)}
                  >
                    ↓
                  </button>
                </div>
              </div>
            )}
          />
        </div>

        {showPageSize ? (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{resultsPerPageLabel}</label>
            <select
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={String(pageSize)}
              onChange={(event) => {
                const nextSize =
                  Number.parseInt(event.target.value, 10) ||
                  pageSizeOptions[0] ||
                  10;
                onPageSizeChange(nextSize);
              }}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
    </dialog>
  );
});
