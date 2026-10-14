import { useMemo, useRef, useState } from "react";
import styles from "../DataTableSettings.module.css";
import { formatMessage, type Messages } from "../../i18n";
import {
  createPanelCategory,
  createPanelTag,
  deletePanelCategory,
  deletePanelTag,
  updatePanelCategory,
  updatePanelTag,
} from "../../api/client";
import DataTable, { type DataTableQuickActionConfig } from "../DataTable";
import { useConfirm } from "../ConfirmDialog";
import { useToast } from "../ToastProvider";
import { SettingsIcon } from "../ui/icons";
import type { DataTableSettingsAdvanced, CategoryRow, TagRow } from "./types";
import {
  AccordionSection,
  InlineAlert,
  getSettingsCategoriesColumns,
  getSettingsCategoriesRowActions,
  getSettingsTagsColumns,
  getSettingsTagsFilters,
  getSettingsTagsRowActions,
} from "./shared";

/**
 * Pestaña unificada **Categorías + Tags** del lateral del dashboard. Reúne en un
 * solo tab lo que antes eran dos: un collapse «Registrar categoría y tags» (alta
 * de ambos) y dos collapses de consulta («Ver categorías» / «Ver tags»). Los
 * tres comparten el mismo grupo de accordion (una sección abierta a la vez).
 * Reutiliza el `advanced` (taxonomía + mutadores locales) igual que las pestañas
 * originales, así que mantiene paneles/taxonomía en sync sin refetch.
 */
export function CategoriesTagsTab({ advanced, t, language, fillHeight = false }: { advanced: DataTableSettingsAdvanced; t: Messages; language?: string; fillHeight?: boolean }) {
  const {
    token,
    taxonomy,
    applyCategoryCreated,
    applyCategoryRenamed,
    applyCategoryDeleted,
    applyTagCreated,
    applyTagRenamed,
    applyTagDeleted,
  } = advanced;
  const { confirm, dialog: confirmDialog } = useConfirm();
  const toast = useToast();

  // Accordion controlado: una sección abierta a la vez. Tras crear se abre la
  // tabla correspondiente (categorías o tags).
  const [section, setSection] = useState<"form" | "categories" | "tags">("categories");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState<
    "catName" | "catEdit" | "tagCategory" | "tagName" | "tagEdit" | null
  >(null);

  // ── Categorías ──────────────────────────────────────────────────────
  const [catName, setCatName] = useState("");
  const [catSearch, setCatSearch] = useState("");
  const [editingCat, setEditingCat] = useState<{ id: string; name: string } | null>(null);
  const [catSettingsOpen, setCatSettingsOpen] = useState(false);
  const catNameRef = useRef<HTMLInputElement>(null);
  const editCatRef = useRef<HTMLInputElement>(null);

  // ── Tags ────────────────────────────────────────────────────────────
  const [tagCategoryId, setTagCategoryId] = useState("");
  const [tagName, setTagName] = useState("");
  const [editingTag, setEditingTag] = useState<{ id: string; name: string } | null>(null);
  const tagNameRef = useRef<HTMLInputElement>(null);
  const tagCategoryRef = useRef<HTMLSelectElement>(null);
  const editTagRef = useRef<HTMLInputElement>(null);

  const effectiveTagCategoryId = tagCategoryId || (taxonomy[0]?.id ?? "");

  const categoryRows: CategoryRow[] = useMemo(
    () =>
      taxonomy.map((category) => ({
        id: category.id,
        name: category.name,
        tagsCount: category.tags.length,
        searchBlob: category.name.toLowerCase(),
      })),
    [taxonomy],
  );
  const visibleCategoryRows = useMemo(() => {
    const query = catSearch.trim().toLowerCase();
    if (!query) return categoryRows;
    return categoryRows.filter((row) => row.searchBlob.includes(query));
  }, [categoryRows, catSearch]);

  const tagRows: TagRow[] = useMemo(() => {
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

  // ── Handlers categorías ─────────────────────────────────────────────
  async function handleCreateCategory() {
    setError("");
    if (!catName.trim()) {
      setError(t.dataTableSettings.subTables.fieldRequired);
      setInvalidField("catName");
      setSection("form");
      window.requestAnimationFrame(() => catNameRef.current?.focus());
      return;
    }
    setInvalidField(null);
    setBusy(true);
    try {
      const { category } = await createPanelCategory(catName.trim(), token);
      if (category) applyCategoryCreated(category);
      setCatName("");
      setSection("categories");
      toast.success(t.toast.created);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCategory(id: string) {
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
      applyCategoryDeleted(id);
      toast.success(t.toast.deleted);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteManyCategories(rows: CategoryRow[]) {
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

  async function handleSaveEditCategory() {
    if (!editingCat) return;
    if (!editingCat.name.trim()) {
      setError(t.dataTableSettings.subTables.fieldRequired);
      setInvalidField("catEdit");
      editCatRef.current?.focus();
      return;
    }
    setInvalidField(null);
    setBusy(true);
    try {
      await updatePanelCategory(editingCat.id, editingCat.name.trim(), token);
      applyCategoryRenamed(editingCat.id, editingCat.name.trim());
      setEditingCat(null);
      toast.success(t.toast.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  function handleCategoryRowAction(actionId: string, row: CategoryRow) {
    if (actionId === "edit_category") setEditingCat({ id: row.id, name: row.name });
    else if (actionId === "delete_category") void handleDeleteCategory(row.id);
  }

  // ── Handlers tags ───────────────────────────────────────────────────
  async function handleCreateTag() {
    if (!effectiveTagCategoryId) {
      setError(t.dataTableSettings.subTables.fieldRequired);
      setInvalidField("tagCategory");
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
      const { tag } = await createPanelTag(effectiveTagCategoryId, tagName.trim(), token);
      if (tag) applyTagCreated(effectiveTagCategoryId, tag);
      setTagName("");
      setSection("tags");
      toast.success(t.toast.created);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteTag(id: string) {
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

  async function handleDeleteManyTags(rows: TagRow[]) {
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

  async function handleSaveEditTag() {
    if (!editingTag) return;
    if (!editingTag.name.trim()) {
      setError(t.dataTableSettings.subTables.fieldRequired);
      setInvalidField("tagEdit");
      editTagRef.current?.focus();
      return;
    }
    setInvalidField(null);
    setBusy(true);
    try {
      await updatePanelTag(editingTag.id, editingTag.name.trim(), token);
      applyTagRenamed(editingTag.id, editingTag.name.trim());
      setEditingTag(null);
      toast.success(t.toast.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  function handleTagRowAction(actionId: string, row: TagRow) {
    if (actionId === "edit_tag") setEditingTag({ id: row.id, name: row.name });
    else if (actionId === "delete_tag") void handleDeleteTag(row.id);
  }

  const categoryBulkActions: DataTableQuickActionConfig<CategoryRow>[] = [
    { id: "delete_selected", label: t.common.deleteSelected, requiresSelection: true, variant: "danger", onClick: (rows) => void handleDeleteManyCategories(rows) },
  ];
  const tagBulkActions: DataTableQuickActionConfig<TagRow>[] = [
    { id: "delete_selected", label: t.common.deleteSelected, requiresSelection: true, variant: "danger", onClick: (rows) => void handleDeleteManyTags(rows) },
  ];

  return (
    <div className={fillHeight ? "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto" : "space-y-2"}>
      <h4 className={`lp-modal-label ${styles.tabHeading}`}>
        {`${t.dataTableSettings.tabs.categories} & ${t.dataTableSettings.tabs.tags}`}
      </h4>
      <p className="text-xs opacity-70">
        {t.dataTableSettings.categoriesTab.help} {t.dataTableSettings.tagsTab.help}
      </p>

      <InlineAlert message={error} />

      <AccordionSection
        groupName="acc-cat-tags"
        title={t.dataTableSettings.accordion.registerCategoryTags}
        open={section === "form"}
        onOpen={() => setSection("form")}
      >
        <span className="text-xs font-semibold opacity-60">{t.dataTableSettings.categoriesTab.heading}</span>
        <div className="flex gap-2">
          <input
            ref={catNameRef}
            className={`lp-modal-input flex-1 min-w-0${invalidField === "catName" ? " lp-modal-input--error" : ""}`}
            aria-invalid={invalidField === "catName" || undefined}
            type="text"
            maxLength={60}
            placeholder={t.dataTableSettings.categoriesTab.newPlaceholder}
            value={catName}
            onChange={(event) => { setCatName(event.target.value.replace(/^\s+/, "")); if (invalidField === "catName") setInvalidField(null); }}
            onBlur={(event) => setCatName(event.target.value.trim())}
            onKeyDown={(event) => { if (event.key === "Enter" && catName.trim()) void handleCreateCategory(); }}
          />
          <button
            type="button"
            className="lp-modal-btn lp-modal-btn--primary shrink-0"
            onClick={handleCreateCategory}
            disabled={busy || !catName.trim()}
          >
            {t.dataTableSettings.categoriesTab.create}
          </button>
        </div>

        <span className="mt-1 block text-xs font-semibold opacity-60">{t.dataTableSettings.tagsTab.heading}</span>
        <div className="flex gap-2">
          <select
            ref={tagCategoryRef}
            className={`${styles.categorySelect} lp-modal-select shrink-0${invalidField === "tagCategory" ? " lp-modal-input--error" : ""}`}
            aria-invalid={invalidField === "tagCategory" || undefined}
            value={effectiveTagCategoryId}
            onChange={(event) => { setTagCategoryId(event.target.value); if (invalidField === "tagCategory") setInvalidField(null); }}
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
            onClick={handleCreateTag}
            disabled={busy || !tagName.trim() || !effectiveTagCategoryId}
          >
            {t.dataTableSettings.tagsTab.create}
          </button>
        </div>
      </AccordionSection>

      <AccordionSection
        groupName="acc-cat-tags"
        title={t.dataTableSettings.accordion.viewCategories}
        open={section === "categories"}
        onOpen={() => setSection("categories")}
      >
        <div className="flex gap-2">
          <input
            className="lp-modal-input flex-1 min-w-0"
            type="text"
            placeholder={t.dataTableSettings.subTables.searchCategory}
            value={catSearch}
            onChange={(event) => setCatSearch(event.target.value)}
          />
          <button
            type="button"
            className="lp-modal-btn lp-modal-btn--ghost shrink-0"
            onClick={() => setCatSettingsOpen(true)}
          >
            <SettingsIcon />
            {t.common.configure}
          </button>
        </div>

        {editingCat ? (
          <div className={`${styles.editBox} flex gap-2 rounded-md p-2`}>
            <input
              ref={editCatRef}
              className={`lp-modal-input flex-1${invalidField === "catEdit" ? " lp-modal-input--error" : ""}`}
              aria-invalid={invalidField === "catEdit" || undefined}
              value={editingCat.name}
              onChange={(event) => { setEditingCat({ id: editingCat.id, name: event.target.value }); if (invalidField === "catEdit") setInvalidField(null); }}
            />
            <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={handleSaveEditCategory} disabled={busy}>
              {t.common.save}
            </button>
            <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={() => setEditingCat(null)}>
              {t.common.cancel}
            </button>
          </div>
        ) : null}

        <DataTable
          tableId="data-table-settings-categories"
          title={t.dataTableSettings.categoriesTab.tableTitle}
          columns={getSettingsCategoriesColumns(t)}
          data={visibleCategoryRows}
          filters={[]}
          rowActions={getSettingsCategoriesRowActions(t)}
          quickActions={categoryBulkActions}
          pageSizeOptions={[5, 10, 20]}
          language={language}
          onRowAction={handleCategoryRowAction}
          hideSettingsButton
          settingsOpen={catSettingsOpen}
          onSettingsOpenChange={setCatSettingsOpen}
        />
      </AccordionSection>

      <AccordionSection
        groupName="acc-cat-tags"
        title={t.dataTableSettings.accordion.viewTags}
        open={section === "tags"}
        onOpen={() => setSection("tags")}
      >
        {editingTag ? (
          <div className={`${styles.editBox} flex gap-2 rounded-md p-2`}>
            <input
              ref={editTagRef}
              className={`lp-modal-input flex-1${invalidField === "tagEdit" ? " lp-modal-input--error" : ""}`}
              aria-invalid={invalidField === "tagEdit" || undefined}
              value={editingTag.name}
              onChange={(event) => { setEditingTag({ id: editingTag.id, name: event.target.value }); if (invalidField === "tagEdit") setInvalidField(null); }}
            />
            <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={handleSaveEditTag} disabled={busy}>
              {t.common.save}
            </button>
            <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={() => setEditingTag(null)}>
              {t.common.cancel}
            </button>
          </div>
        ) : null}

        <DataTable
          tableId="data-table-settings-tags"
          title={t.dataTableSettings.tagsTab.tableTitle}
          columns={getSettingsTagsColumns(t)}
          data={tagRows}
          filters={getSettingsTagsFilters(t)}
          rowActions={getSettingsTagsRowActions(t)}
          quickActions={tagBulkActions}
          pageSizeOptions={[5, 10, 20]}
          language={language}
          onRowAction={handleTagRowAction}
          inlineToolbar
        />
      </AccordionSection>
      {confirmDialog}
    </div>
  );
}
