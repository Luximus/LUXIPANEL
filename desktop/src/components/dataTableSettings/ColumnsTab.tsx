import styles from "../DataTableSettings.module.css";
import { type Messages } from "../../i18n";
import type { DataTableSettingsColumn } from "./types";

export function ColumnsTab({
  columns,
  visibility,
  onToggle,
  onMove,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  t,
}: {
  columns: DataTableSettingsColumn[];
  visibility: Record<string, boolean>;
  onToggle: (id: string, checked: boolean) => void;
  onMove: (id: string, dir: "up" | "down") => void;
  pageSize: number;
  pageSizeOptions: number[];
  onPageSizeChange: (next: number) => void;
  t: Messages;
}) {
  return (
    <div className="space-y-4">
      <div>
        <span className="lp-modal-label">{t.dataTableSettings.columnsTab.visibleAndOrder}</span>
        <div className="lp-modal-checklist lp-modal-checklist--column">
          {columns.map((column, index) => (
            <div
              key={column.id}
              className={`${styles.columnRow} flex items-center justify-between gap-2 rounded-md px-2 py-1`}
            >
              <label className={`${styles.columnRowLabel} flex flex-1 items-center gap-2 text-sm`}>
                <input
                  type="checkbox"
                  checked={visibility[column.id] !== false}
                  onChange={(event) => onToggle(column.id, event.target.checked)}
                />
                {column.header}
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="lp-modal-btn lp-modal-btn--ghost lp-modal-btn--sm"
                  onClick={() => onMove(column.id, "up")}
                  disabled={index === 0}
                  aria-label={t.dataTableSettings.columnsTab.moveUpAria}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="lp-modal-btn lp-modal-btn--ghost lp-modal-btn--sm"
                  onClick={() => onMove(column.id, "down")}
                  disabled={index === columns.length - 1}
                  aria-label={t.dataTableSettings.columnsTab.moveDownAria}
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-xs">
        <label className="lp-modal-label" htmlFor="lp-page-size">{t.dataTableSettings.columnsTab.pageSize}</label>
        <select
          id="lp-page-size"
          className="lp-modal-select"
          value={String(pageSize)}
          onChange={(event) => onPageSizeChange(Number.parseInt(event.target.value, 10) || pageSize)}
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
