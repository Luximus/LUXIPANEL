import { useMemo, useRef, useState } from "react";
import styles from "../DataTableSettings.module.css";
import { formatMessage, type Messages } from "../../i18n";
import { createPanelTag, deletePanelTag, updatePanelTag } from "../../api/client";
import DataTable, { type DataTableQuickActionConfig } from "../DataTable";
import { useConfirm } from "../ConfirmDialog";
import { useToast } from "../ToastProvider";
import type { DataTableSettingsAdvanced, TagRow } from "./types";
import {
  AccordionSection,
  InlineAlert,
  getSettingsTagsColumns,
  getSettingsTagsFilters,
  getSettingsTagsRowActions,
} from "./shared";

export function TagsTab({ advanced, t, language, fillHeight = false }: { advanced: DataTableSettingsAdvanced; t: Messages; language?: string; fillHeight?: boolean }) {
  const { token, taxonomy, applyTagCreated, applyTagRenamed, applyTagDeleted } = advanced;
  const { confirm, dialog: confirmDialog } = useConfirm();
  const toast = useToast();
  const [categoryId, setCategoryId] = useState("");
  const [tagName, setTagName] = useState("");
  // Accordion controlado: tras crear se abre "Tabla de registros".
  const [section, setSection] = useState<"form" | "records">("records");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  // Foco/resalte del campo obligatorio que falte al crear/renombrar.
  const tagNameRef = useRef<HTMLInputElement>(null);
  const tagCategoryRef = useRef<HTMLSelectElement>(null);
  const editTagRef = useRef<HTMLInputElement>(null);
  const [invalidField, setInvalidField] = useState<"category" | "tagName" | "editName" | null>(null);

  const effectiveCategoryId = categoryId || (taxonomy[0]?.id ?? "");

  const rows: TagRow[] = useMemo(() => {
    const all: TagRow[] = [];
    for (const category of taxonomy) {
      for (const tag of category.tags) {
        all.push({
          id: tag.id,
          name: tag.name,
          categoryId: category.id,
          categoryName: category.name,
          searchBlob: `${tag.name} ${category.name}`.toLowerCase(),
        });
      }
    }
    return all;
  }, [taxonomy]);

  async function handleCreate() {
    if (!effectiveCategoryId) {
      setError(t.dataTableSettings.subTables.fieldRequired);
      setInvalidField("category");
      setSection("form");
      window.requestAnimationFrame(() => tagCategoryRef.current?.focus());
      return;
    }
    if (!tagName.trim()) {
      setError(t.dataTableSettings.subTables.fieldRequired);
      setInvalidField("tagName");
      setSection("form");
      window.requestAnimationFrame(() => tagNameRef.current?.focus());
      return;
    }
    setInvalidField(null);
    setBusy(true);
    setError("");
    try {
      const { tag } = await createPanelTag(effectiveCategoryId, tagName.trim(), token);
      if (tag) applyTagCreated(effectiveCategoryId, tag);
      setTagName("");
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
      message: t.dataTableSettings.tagsTab.confirmDelete,
      confirmLabel: t.common.delete,
      cancelLabel: t.common.cancel,
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deletePanelTag(id, token);
      applyTagDeleted(id);
      toast.success(t.toast.deleted);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteMany(rows: TagRow[]) {
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
        await deletePanelTag(row.id, token);
        applyTagDeleted(row.id);
      }
      toast.success(t.toast.deleted);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  const bulkActions: DataTableQuickActionConfig<TagRow>[] = [
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
      editTagRef.current?.focus();
      return;
    }
    setInvalidField(null);
    setBusy(true);
    try {
      await updatePanelTag(editing.id, editing.name.trim(), token);
      applyTagRenamed(editing.id, editing.name.trim());
      setEditing(null);
      toast.success(t.toast.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  function handleRowAction(actionId: string, row: TagRow) {
    if (actionId === "edit_tag") {
      setEditing({ id: row.id, name: row.name });
    } else if (actionId === "delete_tag") {
      void handleDelete(row.id);
    }
  }

  return (
    <div className={fillHeight ? "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto" : "space-y-2"}>
      <h4 className={`lp-modal-label ${styles.tabHeading}`}>{t.dataTableSettings.tagsTab.heading}</h4>
      <p className="text-xs opacity-70">{t.dataTableSettings.tagsTab.help}</p>

      <InlineAlert message={error} />

      <AccordionSection
        groupName="acc-tags"
        title={t.dataTableSettings.accordion.form}
        open={section === "form"}
        onOpen={() => setSection("form")}
      >
        <div className="flex gap-2">
          <select
            ref={tagCategoryRef}
            className={`${styles.categorySelect} lp-modal-select shrink-0${invalidField === "category" ? " lp-modal-input--error" : ""}`}
            aria-invalid={invalidField === "category" || undefined}
            value={effectiveCategoryId}
            onChange={(event) => { setCategoryId(event.target.value); if (invalidField === "category") setInvalidField(null); }}
          >
            {taxonomy.length === 0 ? <option value="">{t.dataTableSettings.tagsTab.noCategories}</option> : null}
            {taxonomy.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input
            ref={tagNameRef}
            className={`lp-modal-input flex-1 min-w-0${invalidField === "tagName" ? " lp-modal-input--error" : ""}`}
            aria-invalid={invalidField === "tagName" || undefined}
            type="text"
            maxLength={30}
            placeholder={t.dataTableSettings.tagsTab.newPlaceholder}
            value={tagName}
            onBlur={(event) => setTagName(event.target.value.trim())}
            onChange={(event) => { setTagName(event.target.value.replace(/^\s+/, "")); if (invalidField === "tagName") setInvalidField(null); }}
          />
          <button
            type="button"
            className="lp-modal-btn lp-modal-btn--primary"
            onClick={handleCreate}
            disabled={busy || !tagName.trim() || !effectiveCategoryId}
          >
            {t.dataTableSettings.tagsTab.create}
          </button>
        </div>
      </AccordionSection>

      <AccordionSection
        groupName="acc-tags"
        title={t.dataTableSettings.accordion.records}
        open={section === "records"}
        onOpen={() => setSection("records")}
      >
        {editing ? (
          <div className={`${styles.editBox} flex gap-2 rounded-md p-2`}>
            <input
              ref={editTagRef}
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
          tableId="data-table-settings-tags"
          title={t.dataTableSettings.tagsTab.tableTitle}
          columns={getSettingsTagsColumns(t)}
          data={rows}
          filters={getSettingsTagsFilters(t)}
          rowActions={getSettingsTagsRowActions(t)}
          quickActions={bulkActions}
          pageSizeOptions={[5, 10, 20]}
          language={language}
          onRowAction={handleRowAction}
          inlineToolbar
        />
      </AccordionSection>
      {confirmDialog}
    </div>
  );
}
