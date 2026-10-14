import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getMessages } from "../i18n";
import type { DataTableSettingsAdvanced, DataTableSettingsColumn, SettingsTab } from "./dataTableSettings/types";
import { ColumnsTab } from "./dataTableSettings/ColumnsTab";
import { CategoriesTab } from "./dataTableSettings/CategoriesTab";
import { TagsTab } from "./dataTableSettings/TagsTab";
import { SshKeysTab } from "./dataTableSettings/SshKeysTab";
import { IntegrationsTab } from "./dataTableSettings/IntegrationsTab";
import { ApiTab } from "./dataTableSettings/ApiTab";

// Re-exports: la API pública de este módulo se mantiene estable para los
// importadores (`./DataTableSettings`) aunque las pestañas vivan ya en
// `dataTableSettings/`. El componente de abajo queda como orquestador del modal.
export type { DataTableSettingsAdvanced, DataTableSettingsColumn } from "./dataTableSettings/types";
export { ColumnsTab } from "./dataTableSettings/ColumnsTab";
export { CategoriesTab } from "./dataTableSettings/CategoriesTab";
export { TagsTab } from "./dataTableSettings/TagsTab";
export { CategoriesTagsTab } from "./dataTableSettings/CategoriesTagsTab";
export { SshKeysTab } from "./dataTableSettings/SshKeysTab";
export { IntegrationsTab } from "./dataTableSettings/IntegrationsTab";
export { ApiTab } from "./dataTableSettings/ApiTab";

export function DataTableSettings({
  open,
  onClose,
  tableId,
  columns,
  columnVisibility,
  setColumnVisibility,
  columnOrder,
  setColumnOrder,
  pageSize,
  pageSizeOptions,
  setPageSize,
  advanced,
  language,
}: {
  open: boolean;
  onClose: () => void;
  tableId: string;
  columns: DataTableSettingsColumn[];
  columnVisibility: Record<string, boolean>;
  setColumnVisibility: (next: Record<string, boolean>) => void;
  columnOrder: string[];
  setColumnOrder: (next: string[]) => void;
  pageSize: number;
  pageSizeOptions: number[];
  setPageSize: (next: number) => void;
  advanced?: DataTableSettingsAdvanced;
  language?: string;
}) {
  const t = getMessages(language);
  const isServersTable = tableId === "portal-servers-table" && Boolean(advanced);
  const [tab, setTab] = useState<SettingsTab>(isServersTable ? "ssh_keys" : "columns");

  // La taxonomía y las SSH keys se cargan una sola vez al arrancar (en el
  // controlador) y se mantienen frescas con mutadores locales, así que cambiar
  // de pestaña ya NO vuelve a consultar la API. (Integraciones/API se cargan
  // a sí mismas al montar.)

  const orderedColumns = useMemo(() => {
    const known = new Map(columns.map((c) => [c.id, c]));
    const list: DataTableSettingsColumn[] = [];
    for (const id of columnOrder) {
      const col = known.get(id);
      if (col) {
        list.push(col);
        known.delete(id);
      }
    }
    for (const remaining of known.values()) list.push(remaining);
    return list;
  }, [columns, columnOrder]);

  if (!open) return null;

  function moveColumn(id: string, dir: "up" | "down") {
    const idx = columnOrder.indexOf(id);
    const baseOrder = idx >= 0 ? [...columnOrder] : orderedColumns.map((c) => c.id);
    const currentIdx = baseOrder.indexOf(id);
    if (currentIdx < 0) return;
    const targetIdx = dir === "up" ? currentIdx - 1 : currentIdx + 1;
    if (targetIdx < 0 || targetIdx >= baseOrder.length) return;
    [baseOrder[currentIdx], baseOrder[targetIdx]] = [baseOrder[targetIdx], baseOrder[currentIdx]];
    setColumnOrder(baseOrder);
  }

  return createPortal(
    <div
      className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4"
    >
      <div
        className="lp-modal-card flex max-h-full w-full max-w-3xl flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{t.dataTableSettings.titleConfigure}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={t.dataTableSettings.closeAria}>
            ✕
          </button>
        </div>

        {isServersTable ? (
          <div role="tablist" className="lp-modal-tabs">
            <button
              type="button"
              role="tab"
              className={`lp-modal-tab ${tab === "ssh_keys" ? "is-active" : ""}`}
              onClick={() => setTab("ssh_keys")}
            >
              {t.dataTableSettings.tabs.sshKeys}
            </button>
            <button
              type="button"
              role="tab"
              className={`lp-modal-tab ${tab === "categories" ? "is-active" : ""}`}
              onClick={() => setTab("categories")}
            >
              {t.dataTableSettings.tabs.categories}
            </button>
            <button
              type="button"
              role="tab"
              className={`lp-modal-tab ${tab === "tags" ? "is-active" : ""}`}
              onClick={() => setTab("tags")}
            >
              {t.dataTableSettings.tabs.tags}
            </button>
            <button
              type="button"
              role="tab"
              className={`lp-modal-tab ${tab === "integrations" ? "is-active" : ""}`}
              onClick={() => setTab("integrations")}
            >
              {t.dataTableSettings.tabs.integrations}
            </button>
            <button
              type="button"
              role="tab"
              className={`lp-modal-tab ${tab === "api" ? "is-active" : ""}`}
              onClick={() => setTab("api")}
            >
              {t.dataTableSettings.tabs.api}
            </button>
          </div>
        ) : null}

        <div className="lp-modal-body">
          {tab === "columns" && !isServersTable ? (
            <ColumnsTab
              columns={orderedColumns}
              visibility={columnVisibility}
              onToggle={(id, checked) =>
                setColumnVisibility({ ...columnVisibility, [id]: checked })
              }
              onMove={moveColumn}
              pageSize={pageSize}
              pageSizeOptions={pageSizeOptions}
              onPageSizeChange={setPageSize}
              t={t}
            />
          ) : null}

          {isServersTable && tab === "categories" ? (
            <CategoriesTab advanced={advanced!} t={t} language={language} />
          ) : null}

          {isServersTable && tab === "tags" ? <TagsTab advanced={advanced!} t={t} language={language} /> : null}

          {isServersTable && tab === "ssh_keys" ? <SshKeysTab advanced={advanced!} t={t} language={language} /> : null}

          {isServersTable && tab === "integrations" ? (
            <IntegrationsTab token={advanced!.token} t={t} language={language} />
          ) : null}

          {isServersTable && tab === "api" ? <ApiTab token={advanced!.token} t={t} /> : null}
        </div>

        <div className="lp-modal-footer">
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose}>
            {t.dataTableSettings.closeButton}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
