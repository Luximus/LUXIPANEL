import { type Dispatch, type SetStateAction } from "react";
import { formatMessage, type Messages } from "../../../i18n";
import type { DialogApi } from "../../../hooks/useDialog";
import {
  createBlogCategory, renameBlogCategory, deleteBlogCategory,
  createBlogTag, renameBlogTag, deleteBlogTag,
  type BlogCategory,
} from "../../../api/blog";

/**
 * CRUD de categorías y tags del blog (concern cohesivo separado del formulario
 * del post). Réplica exacta de los handlers que vivían inline en
 * `AdminBlogModal`: valida, llama al API, hace `syncCats` con la lista nueva
 * ordenada y refleja los cambios en la selección/categoría activa. El estado
 * (`cats`, selección, campos) sigue siendo del modal — su único dueño; este hook
 * solo agrupa la lógica de mutación.
 */
export function useBlogTaxonomy({
  t,
  b,
  token,
  dialog,
  cats,
  syncCats,
  categoryName,
  setCategoryName,
  selectedTags,
  setSelectedTags,
  tagMgrCategoryId,
  setTagMgrCategoryId,
  newCatName,
  setNewCatName,
  newTagName,
  setNewTagName,
}: {
  t: Messages;
  b: Messages["blog"];
  token: string;
  dialog: DialogApi;
  cats: BlogCategory[];
  syncCats: (next: BlogCategory[]) => void;
  categoryName: string;
  setCategoryName: Dispatch<SetStateAction<string>>;
  selectedTags: Set<string>;
  setSelectedTags: Dispatch<SetStateAction<Set<string>>>;
  tagMgrCategoryId: string;
  setTagMgrCategoryId: Dispatch<SetStateAction<string>>;
  newCatName: string;
  setNewCatName: Dispatch<SetStateAction<string>>;
  newTagName: string;
  setNewTagName: Dispatch<SetStateAction<string>>;
}) {
  const addCategory = async () => {
    const name = newCatName.trim();
    if (name.length < 2) return;
    try {
      const created = await createBlogCategory(name, token);
      const next = [...cats, created].sort((x, y) => x.name.localeCompare(y.name));
      syncCats(next);
      setNewCatName("");
    } catch (err) {
      await dialog.alert({ title: t.common.error, message: err instanceof Error ? err.message : b.catCreateError });
    }
  };

  const renameCategory = async (id: string) => {
    const cat = cats.find((c) => c.id === id);
    if (!cat) return;
    const name = await dialog.prompt({ title: b.rename, label: b.renameCategoryPrompt, defaultValue: cat.name });
    if (name === null) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    try {
      await renameBlogCategory(id, trimmed, token);
      const next = cats.map((c) => (c.id === id ? { ...c, name: trimmed } : c));
      if (categoryName === cat.name) setCategoryName(trimmed);
      syncCats(next);
    } catch (err) {
      await dialog.alert({ title: t.common.error, message: err instanceof Error ? err.message : b.catRenameError });
    }
  };

  const removeCategory = async (id: string) => {
    const cat = cats.find((c) => c.id === id);
    if (!cat) return;
    const ok = await dialog.confirm({
      title: b.deleteCategoryTitle,
      message: formatMessage(b.deleteCategoryConfirm, { name: cat.name }),
      tone: "danger",
      confirmLabel: b.delete,
    });
    if (!ok) return;
    try {
      await deleteBlogCategory(id, token);
      const next = cats.filter((c) => c.id !== id);
      if (tagMgrCategoryId === id) setTagMgrCategoryId("");
      if (categoryName === cat.name) { setCategoryName(""); setSelectedTags(new Set()); }
      syncCats(next);
    } catch (err) {
      await dialog.alert({ title: t.common.error, message: err instanceof Error ? err.message : b.catDeleteError });
    }
  };

  const addTag = async () => {
    if (!tagMgrCategoryId) { await dialog.alert({ title: t.common.error, message: b.tagNeedCategory }); return; }
    const name = newTagName.trim();
    if (!name) return;
    try {
      // El backend deduplica (200 + tag existente) o crea (201). Usamos SIEMPRE
      // el tag devuelto y evitamos duplicar la fila si ya estaba en la lista.
      const created = await createBlogTag(tagMgrCategoryId, name, token);
      const next = cats.map((c) =>
        c.id === tagMgrCategoryId
          ? {
              ...c,
              tags: [...c.tags.filter((tg) => tg.id !== created.id), created]
                .sort((x, y) => x.name.localeCompare(y.name)),
            }
          : c,
      );
      syncCats(next);
      setNewTagName("");
    } catch (err) {
      await dialog.alert({ title: t.common.error, message: err instanceof Error ? err.message : b.tagCreateError });
    }
  };

  const renameTag = async (catId: string, tagId: string) => {
    const cat = cats.find((c) => c.id === catId);
    const tag = cat?.tags.find((tg) => tg.id === tagId);
    if (!cat || !tag) return;
    const name = await dialog.prompt({ title: b.rename, label: b.renameTagPrompt, defaultValue: tag.name });
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await renameBlogTag(tagId, trimmed, token);
      const next = cats.map((c) =>
        c.id === catId ? { ...c, tags: c.tags.map((tg) => (tg.id === tagId ? { ...tg, name: trimmed } : tg)) } : c,
      );
      // Refleja el rename en la selección activa.
      if (selectedTags.has(tag.name)) {
        const s = new Set(selectedTags); s.delete(tag.name); s.add(trimmed); setSelectedTags(s);
      }
      syncCats(next);
    } catch (err) {
      await dialog.alert({ title: t.common.error, message: err instanceof Error ? err.message : b.tagRenameError });
    }
  };

  const removeTag = async (catId: string, tagId: string) => {
    const cat = cats.find((c) => c.id === catId);
    const tag = cat?.tags.find((tg) => tg.id === tagId);
    if (!cat || !tag) return;
    const ok = await dialog.confirm({
      title: b.deleteTagTitle,
      message: formatMessage(b.deleteTagConfirm, { name: tag.name }),
      tone: "danger",
      confirmLabel: b.delete,
    });
    if (!ok) return;
    try {
      await deleteBlogTag(tagId, token);
      const next = cats.map((c) => (c.id === catId ? { ...c, tags: c.tags.filter((tg) => tg.id !== tagId) } : c));
      if (selectedTags.has(tag.name)) { const s = new Set(selectedTags); s.delete(tag.name); setSelectedTags(s); }
      syncCats(next);
    } catch (err) {
      await dialog.alert({ title: t.common.error, message: err instanceof Error ? err.message : b.tagDeleteError });
    }
  };

  return { addCategory, renameCategory, removeCategory, addTag, renameTag, removeTag };
}
