import { useMemo, useRef, useState } from "react";
import styles from "../DataTableSettings.module.css";
import { formatMessage, type Messages } from "../../i18n";
import {
  createPanelCategory,
  deletePanelCategory,
  updatePanelCategory,
} from "../../api/client";
import DataTable, { type DataTableQuickActionConfig } from "../DataTable";
import { useConfirm } from "../ConfirmDialog";
import { useToast } from "../ToastProvider";
import { SettingsIcon } from "../ui/icons";
import type { DataTableSettingsAdvanced, CategoryRow } from "./types";
import {
  AccordionSection,
  InlineAlert,
  getSettingsCategoriesColumns,
  getSettingsCategoriesRowActions,
} from "./shared";

export function CategoriesTab({ advanced, t, language, fillHeight = false }: { advanced: DataTableSettingsAdvanced; t: Messages; language?: string; fillHeight?: boolean }) {
  const { token, taxonomy, applyCategoryCreated, applyCategoryRenamed, applyCategoryDeleted } = advanced;
  const { confirm, dialog: confirmDialog } = useConfirm();
  const toast = useToast();
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  // Accordion controlado: tras crear se abre "Tabla de registros".
  const [section, setSection] = useState<"form" | "records">("records");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  // Foco/resalte del campo obligatorio que falte al crear/renombrar.
  const nameRef = useRef<HTMLInputElement>(null);
  const editNameRef = useRef<HTMLInputElement>(null);
  const [invalidField, setInvalidField] = useState<"name" | "editName" | null>(null);
  // The sub-table's settings modal is driven by our own "Configurar" button
  // (the table's built-in toolbar button is hidden), so it lives in the records row.
  const [settingsOpen, setSettingsOpen] = useState(false);

  const rows: CategoryRow[] = useMemo(
    () =>
      taxonomy.map((category) => ({
        id: category.id,
        name: category.name,
        tagsCount: category.tags.length,
        searchBlob: category.name.toLowerCase(),
      })),
    [taxonomy],
  );

  // Filter locally: the DataTable's built-in search is replaced by the shared
  // input in the control row, so we feed it already-filtered rows.
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => row.searchBlob.includes(query));
  }, [rows, search]);

  async function handleCreate() {
    setError("");
    if (!name.trim()) {
      setError(t.dataTableSettings.subTables.fieldRequired);
      setInvalidField("name");
      setSection("form");
      window.requestAnimationFrame(() => nameRef.current?.focus());
      return;
    }
    setInvalidField(null);
    setBusy(true);
    try {
      const { category } = await createPanelCategory(name.trim(), token);
      if (category) applyCategoryCreated(category);
      setName("");
      setSection("records");
      toast.success(t.toast.created);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: t.common.confirm,
      message: t.dataTableSettings.categoriesTab.confirmDelete,
      confirmLabel: t.common.delete,
      cancelLabel: t.common.cancel,
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deletePanelCategory(id, token);
      // Update local: quita la categoría de la taxonomía y la desasigna (con sus
      // tags) de los paneles que la usaban, sin refetch.
      applyCategoryDeleted(id);
      toast.success(t.toast.deleted);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteMany(rows: CategoryRow[]) {
    if (rows.length === 0) return;
    const ok = await confirm({
      title: t.common.confirm,
      message: formatMessage(t.common.confirmDeleteSelected, { count: String(rows.length) }),
      confirmLabel: t.common.delete,
      cancelLabel: t.common.cancel,
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      for (const row of rows) {
        await deletePanelCategory(row.id, token);
        applyCategoryDeleted(row.id);
      }
      toast.success(t.toast.deleted);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  const bulkActions: DataTableQuickActionConfig<CategoryRow>[] = [
    {
      id: "delete_selected",
      label: t.common.deleteSelected,
      requiresSelection: true,
      variant: "danger",
      onClick: (rows) => void handleDeleteMany(rows),
    },
  ];

  async function handleSaveEdit() {
    if (!editing) return;
    if (!editing.name.trim()) {
      setError(t.dataTableSettings.subTables.fieldRequired);
      setInvalidField("editName");
      editNameRef.current?.focus();
      return;
    }
    setInvalidField(null);
    setBusy(true);
    try {
      await updatePanelCategory(editing.id, editing.name.trim(), token);
      applyCategoryRenamed(editing.id, editing.name.trim());
      setEditing(null);
      toast.success(t.toast.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  function handleRowAction(actionId: string, row: CategoryRow) {
    if (actionId === "edit_category") {
      setEditing({ id: row.id, name: row.name });
    } else if (actionId === "delete_category") {
      void handleDelete(row.id);
    }
  }

  return (
    <div className={fillHeight ? "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto" : "space-y-2"}>
      <h4 className={`lp-modal-label ${styles.tabHeading}`}>{t.dataTableSettings.categoriesTab.heading}</h4>
      <p className="text-xs opacity-70">
        {t.dataTableSettings.categoriesTab.help}
      </p>

      <InlineAlert message={error} />

      <AccordionSection
        groupName="acc-categories"
        title={t.dataTableSettings.accordion.form}
        open={section === "form"}
        onOpen={() => setSection("form")}
      >
        <div className="flex gap-2">
          <input
            ref={nameRef}
            className={`lp-modal-input flex-1 min-w-0${invalidField === "name" ? " lp-modal-input--error" : ""}`}
            aria-invalid={invalidField === "name" || undefined}
            type="text"
            maxLength={60}
            placeholder={t.dataTableSettings.categoriesTab.newPlaceholder}
            value={name}
            onChange={(event) => { setName(event.target.value.replace(/^\s+/, "")); if (invalidField === "name") setInvalidField(null); }}
            onBlur={(event) => setName(event.target.value.trim())}
            onKeyDown={(event) => {
              if (event.key === "Enter" && name.trim()) void handleCreate();
            }}
          />
          <button
            type="button"
            className="lp-modal-btn lp-modal-btn--primary shrink-0"
            onClick={handleCreate}
            disabled={busy || !name.trim()}
          >
            {t.dataTableSettings.categoriesTab.create}
          </button>
        </div>
      </AccordionSection>

      <AccordionSection
        groupName="acc-categories"
        title={t.dataTableSettings.accordion.records}
        open={section === "records"}
        onOpen={() => setSection("records")}
      >
        <div className="flex gap-2">
          <input
            className="lp-modal-input flex-1 min-w-0"
            type="text"
            placeholder={t.dataTableSettings.subTables.searchCategory}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button
            type="button"
            className="lp-modal-btn lp-modal-btn--ghost shrink-0"
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon />
            {t.common.configure}
          </button>
        </div>

        {editing ? (
          <div className={`${styles.editBox} flex gap-2 rounded-md p-2`}>
            <input
              ref={editNameRef}
              className={`lp-modal-input flex-1${invalidField === "editName" ? " lp-modal-input--error" : ""}`}
              aria-invalid={invalidField === "editName" || undefined}
              value={editing.name}
              onChange={(event) => { setEditing({ id: editing.id, name: event.target.value }); if (invalidField === "editName") setInvalidField(null); }}
            />
            <button
              type="button"
              className="lp-modal-btn lp-modal-btn--primary"
              onClick={handleSaveEdit}
              disabled={busy}
            >
              {t.common.save}
            </button>
            <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={() => setEditing(null)}>
              {t.common.cancel}
            </button>
          </div>
        ) : null}

        <DataTable
          tableId="data-table-settings-categories"
          title={t.dataTableSettings.categoriesTab.tableTitle}
          columns={getSettingsCategoriesColumns(t)}
          data={visibleRows}
          filters={[]}
          rowActions={getSettingsCategoriesRowActions(t)}
          quickActions={bulkActions}
          pageSizeOptions={[5, 10, 20]}
          language={language}
          onRowAction={handleRowAction}
          hideSettingsButton
          settingsOpen={settingsOpen}
          onSettingsOpenChange={setSettingsOpen}
        />
      </AccordionSection>
      {confirmDialog}
    </div>
  );
}
