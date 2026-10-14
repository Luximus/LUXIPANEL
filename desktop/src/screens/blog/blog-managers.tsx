// blog-managers (desktop) — pestañas de gestión de Categorías y Tags del
// editor de Blog. Extraído de `screens/BlogScreen.tsx`; espeja la convención
// de hermanos de la app RN (`blog-managers`). Subcomponentes autocontenidos:
// todo su estado llega por props (categories/setCategories del padre).
import { useState, type Dispatch, type SetStateAction } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { useToast } from "../../components/ToastProvider";
import type { DialogApi } from "../../hooks/useDialog";
import { formatMessage } from "../../i18n";
import {
  createBlogCategory, renameBlogCategory, deleteBlogCategory,
  createBlogTag, renameBlogTag, deleteBlogTag,
  type BlogCategory,
} from "../../api/blog";
import type { BlogT } from "./blog-shared";

// ── Gestión de categorías ─────────────────────────────────────────────────────

export function CategoryManager({
  token, t, dialog, toast, categories, setCategories,
}: {
  token: string;
  t: BlogT;
  dialog: DialogApi;
  toast: ReturnType<typeof useToast>;
  categories: BlogCategory[];
  setCategories: Dispatch<SetStateAction<BlogCategory[]>>;
}) {
  const [name, setName] = useState("");

  const add = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    try {
      const created = await createBlogCategory(trimmed, token);
      if (created) {
        setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        setName("");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.catCreateError);
    }
  };

  const doRename = async (c: BlogCategory) => {
    const value = await dialog.prompt({ title: t.rename, label: t.renameCategoryPrompt, defaultValue: c.name, confirmLabel: t.save, cancelLabel: t.cancel, required: true });
    const trimmed = value?.trim();
    if (!trimmed || trimmed.length < 2 || trimmed === c.name) return;
    try {
      await renameBlogCategory(c.id, trimmed, token);
      setCategories((prev) => prev.map((x) => (x.id === c.id ? { ...x, name: trimmed } : x)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.catRenameError);
    }
  };

  const askDelete = async (c: BlogCategory) => {
    const ok = await dialog.confirm({ title: t.deleteCategoryTitle, message: formatMessage(t.deleteCategoryConfirm, { name: c.name }), tone: "danger", confirmLabel: t.delete, cancelLabel: t.cancel });
    if (!ok) return;
    try {
      await deleteBlogCategory(c.id, token);
      setCategories((prev) => prev.filter((x) => x.id !== c.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.catDeleteError);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="lp-modal-label">{t.catManagerTitle}</span>
          <input
            className="input input-bordered input-sm w-full"
            placeholder={t.catNew}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }}
          />
        </label>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void add()}>{t.catAdd}</button>
      </div>
      {categories.length === 0 ? (
        <p className="text-sm text-base-content/60">{t.catEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-box border border-base-300 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="text-xs text-base-content/60">{formatMessage(t.catTagsCount, { count: c.tags.length })}</p>
              </div>
              <button type="button" className="btn btn-ghost btn-xs btn-square" title={t.rename} onClick={() => void doRename(c)}><Pencil size={15} /></button>
              <button type="button" className="btn btn-ghost btn-xs btn-square text-error" title={t.delete} onClick={() => void askDelete(c)}><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Gestión de tags por categoría ─────────────────────────────────────────────

export function TagManager({
  token, t, dialog, toast, categories, setCategories,
}: {
  token: string;
  t: BlogT;
  dialog: DialogApi;
  toast: ReturnType<typeof useToast>;
  categories: BlogCategory[];
  setCategories: Dispatch<SetStateAction<BlogCategory[]>>;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");

  const cat = categories.find((c) => c.id === categoryId) ?? null;

  const add = async () => {
    if (!cat) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const created = await createBlogTag(cat.id, trimmed, token);
      if (created) {
        setCategories((prev) =>
          prev.map((c) => (c.id === cat.id ? { ...c, tags: [...c.tags, created].sort((a, b) => a.name.localeCompare(b.name)) } : c)),
        );
        setName("");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.tagCreateError);
    }
  };

  const doRename = async (tagId: string, tagName: string) => {
    if (!cat) return;
    const value = await dialog.prompt({ title: t.rename, label: t.renameTagPrompt, defaultValue: tagName, confirmLabel: t.save, cancelLabel: t.cancel, required: true });
    const trimmed = value?.trim();
    if (!trimmed || trimmed === tagName) return;
    try {
      await renameBlogTag(tagId, trimmed, token);
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, tags: c.tags.map((tg) => (tg.id === tagId ? { ...tg, name: trimmed } : tg)) } : c)),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.tagRenameError);
    }
  };

  const askDelete = async (tagId: string, tagName: string) => {
    const ok = await dialog.confirm({ title: t.deleteTagTitle, message: formatMessage(t.deleteTagConfirm, { name: tagName }), tone: "danger", confirmLabel: t.delete, cancelLabel: t.cancel });
    if (!ok) return;
    try {
      await deleteBlogTag(tagId, token);
      if (cat) {
        setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, tags: c.tags.filter((tg) => tg.id !== tagId) } : c)));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.tagDeleteError);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="lp-modal-label">{t.tagManagerTitle}</span>
        <select className="select select-bordered select-sm w-full" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">{t.tagSelectCategory}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      {cat ? (
        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className="lp-modal-label">{t.tagNew}</span>
            <input
              className="input input-bordered input-sm w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }}
            />
          </label>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void add()}>{t.tagAdd}</button>
        </div>
      ) : null}

      {!cat ? (
        <p className="text-sm text-base-content/60">{t.tagPickCategory}</p>
      ) : cat.tags.length === 0 ? (
        <p className="text-sm text-base-content/60">{t.tagEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {cat.tags.map((tg) => (
            <li key={tg.id} className="flex items-center gap-2 rounded-box border border-base-300 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-semibold">{tg.name}</span>
              <button type="button" className="btn btn-ghost btn-xs btn-square" title={t.rename} onClick={() => void doRename(tg.id, tg.name)}><Pencil size={15} /></button>
              <button type="button" className="btn btn-ghost btn-xs btn-square text-error" title={t.delete} onClick={() => void askDelete(tg.id, tg.name)}><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
