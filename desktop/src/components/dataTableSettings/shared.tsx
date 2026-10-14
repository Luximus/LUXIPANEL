import { type ReactNode } from "react";
import styles from "../DataTableSettings.module.css";
import { ENV } from "../../config/env";
import { type Messages } from "../../i18n";
import type {
  DataTableColumnConfig,
  DataTableFilterConfig,
  DataTableRowActionConfig,
} from "../DataTable";
import { openExternal } from "../../features/app/utils";
import type { CategoryRow, TagRow, SshKeyRow } from "./types";

// La huella SHA256 es muy larga para la columna; se muestra truncada (el valor
// completo queda en el `title` para verlo al pasar el cursor). El filtrado/orden
// siguen usando el valor completo guardado en la fila.
export function shortenFingerprint(value: string): string {
  if (!value || value === "—") return value;
  return value.length > 24 ? `${value.slice(0, 24)}…` : value;
}

export function docUrl(path: string): string {
  const base = (ENV.luxipanelUrl || "").replace(/\/+$/, "");
  return `${base}${path}`;
}

export function DocLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className={styles.docLink}
      onClick={(event) => {
        event.preventDefault();
        openExternal(href);
      }}
    >
      {label}
    </a>
  );
}

export function InlineAlert({ message, tone = "error" }: { message: string; tone?: "error" | "ok" }) {
  if (!message) return null;
  return (
    <div
      className={`mb-2 rounded-md border px-2 py-1 text-xs ${
        tone === "ok"
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300"
          : "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800/50 dark:bg-rose-900/20 dark:text-rose-300"
      }`}
    >
      {message}
    </div>
  );
}

/**
 * Sección de un accordion daisyUI (radio: una abierta a la vez por `groupName`).
 * Las pestañas Categorías/Tags/Integraciones agrupan «formulario de registro» y
 * «tabla de registros» en dos de estas secciones. Modo controlado (`open` +
 * `onOpen`) o no controlado (`defaultOpen`).
 */
export function AccordionSection({
  groupName,
  title,
  open,
  defaultOpen,
  onOpen,
  children,
}: {
  groupName: string;
  title: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpen?: () => void;
  children: ReactNode;
}) {
  const controlled = open !== undefined;
  return (
    <div className="collapse collapse-arrow border border-base-300 bg-base-100 dark:border-zinc-700 dark:bg-zinc-900/40">
      <input
        type="radio"
        name={groupName}
        aria-label={title}
        {...(controlled ? { checked: open, onChange: () => onOpen?.() } : { defaultChecked: defaultOpen })}
      />
      <div className="collapse-title text-sm font-semibold text-base-content/80">{title}</div>
      <div className="collapse-content">
        <div className="space-y-2 pt-1">{children}</div>
      </div>
    </div>
  );
}

// ── Sub-table column / filter / action configs ─────────────────────────────
// All labels are derived from i18n at render time.

export function getSettingsCategoriesColumns(t: Messages): DataTableColumnConfig<CategoryRow>[] {
  return [
    { id: "name", header: t.dataTableSettings.subTables.nameHeader, accessorKey: "name", sortable: true, hideable: false },
    { id: "tagsCount", header: t.dataTableSettings.subTables.tagsHeader, accessorKey: "tagsCount", sortable: true, hideable: true, summary: { value: (r) => r.tagsCount } },
  ];
}
export function getSettingsCategoriesRowActions(t: Messages): DataTableRowActionConfig<CategoryRow>[] {
  return [
    { id: "edit_category", label: t.common.rename },
    { id: "delete_category", label: t.common.delete, variant: "danger" },
  ];
}

export function getSettingsTagsColumns(t: Messages): DataTableColumnConfig<TagRow>[] {
  return [
    { id: "name", header: t.dataTableSettings.subTables.nameHeader, accessorKey: "name", sortable: true, hideable: false },
    { id: "categoryName", header: t.dataTableSettings.subTables.categoryHeader, accessorKey: "categoryName", sortable: true, hideable: true },
  ];
}
export function getSettingsTagsFilters(t: Messages): DataTableFilterConfig<TagRow>[] {
  return [
    { id: "search", label: t.dataTableSettings.subTables.searchTag, accessorKey: "searchBlob", type: "text" },
    { id: "categoryName", label: t.panelTable.filters.allCategories, accessorKey: "categoryName", type: "select" },
  ];
}
export function getSettingsTagsRowActions(t: Messages): DataTableRowActionConfig<TagRow>[] {
  return [
    { id: "edit_tag", label: t.common.rename },
    { id: "delete_tag", label: t.common.delete, variant: "danger" },
  ];
}

export function getSettingsSshKeysColumns(t: Messages): DataTableColumnConfig<SshKeyRow>[] {
  return [
    { id: "linuxUsername", header: t.dataTableSettings.subTables.sshUserHeader, accessorKey: "linuxUsername", sortable: true, hideable: false },
    {
      id: "fingerprint",
      header: t.dataTableSettings.subTables.fingerprintHeader,
      accessorKey: "fingerprint",
      sortable: true,
      hideable: true,
      cell: (row) => (
        <span title={row.fingerprint} className="font-mono text-xs">
          {shortenFingerprint(row.fingerprint)}
        </span>
      ),
    },
    { id: "panelsCount", header: t.dataTableSettings.subTables.panelsHeader, accessorKey: "panelsCount", sortable: true, hideable: true, summary: { value: (r) => r.panelsCount } },
  ];
}
export function getSettingsSshKeysFilters(t: Messages): DataTableFilterConfig<SshKeyRow>[] {
  return [{ id: "search", label: t.dataTableSettings.subTables.searchKey, accessorKey: "searchBlob", type: "text" }];
}
export function getSettingsSshKeysRowActions(t: Messages): DataTableRowActionConfig<SshKeyRow>[] {
  return [
    { id: "edit_ssh_key", label: t.common.edit },
    { id: "delete_ssh_key", label: t.common.delete, variant: "danger" },
  ];
}
