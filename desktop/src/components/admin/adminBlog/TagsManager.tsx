import { type Messages } from "../../../i18n";
import type { BlogCategory } from "../../../api/blog";
import styles from "../AdminBlogModal.module.css";

/** Tab "Tags": elige categoría, alta + lista con renombrar/borrar de sus tags.
 *  Presentacional; el CRUD y la sincronización de selección viven en el modal. */
export function TagsManager({
  b,
  cats,
  busy,
  tagMgrCategoryId,
  onCategoryChange,
  newTagName,
  onNewTagNameChange,
  onAdd,
  onRename,
  onRemove,
}: {
  b: Messages["blog"];
  cats: BlogCategory[];
  busy: boolean;
  tagMgrCategoryId: string;
  onCategoryChange: (id: string) => void;
  newTagName: string;
  onNewTagNameChange: (value: string) => void;
  onAdd: () => void;
  onRename: (catId: string, tagId: string) => void;
  onRemove: (catId: string, tagId: string) => void;
}) {
  const tagMgrCat = cats.find((c) => c.id === tagMgrCategoryId) ?? null;

  return (
    <div className={styles.taxTab}>
      <select className="lp-modal-input" value={tagMgrCategoryId} disabled={busy} onChange={(e) => onCategoryChange(e.target.value)}>
        <option value="">{b.tagSelectCategory}</option>
        {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {!tagMgrCat ? (
        <p className="text-sm opacity-70">{b.tagPickCategory}</p>
      ) : (
        <>
          <div className={styles.addRow}>
            <input
              className="lp-modal-input"
              type="text"
              value={newTagName}
              disabled={busy}
              placeholder={b.tagNew}
              onChange={(e) => onNewTagNameChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
            />
            <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={onAdd} disabled={busy}>{b.tagAdd}</button>
          </div>
          {tagMgrCat.tags.length === 0 ? (
            <p className="text-sm opacity-70">{b.tagEmpty}</p>
          ) : (
            tagMgrCat.tags.map((tg) => (
              <div key={tg.id} className="flex items-center justify-between gap-2 rounded-lg border border-base-300 px-3 py-2">
                <span className="font-medium">{tg.name}</span>
                <div className="flex gap-1">
                  <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={() => onRename(tagMgrCat.id, tg.id)} disabled={busy}>{b.rename}</button>
                  <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={() => onRemove(tagMgrCat.id, tg.id)} disabled={busy}>{b.delete}</button>
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
