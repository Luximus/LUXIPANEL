import { formatMessage, type Messages } from "../../../i18n";
import type { BlogCategory } from "../../../api/blog";
import styles from "../AdminBlogModal.module.css";

/** Tab "Categorías": alta + lista con renombrar/borrar. Presentacional; el CRUD
 *  vive en el modal (mantiene `cats` y la selección activa en sync). */
export function CategoriesManager({
  b,
  cats,
  busy,
  newCatName,
  onNewCatNameChange,
  onAdd,
  onRename,
  onRemove,
}: {
  b: Messages["blog"];
  cats: BlogCategory[];
  busy: boolean;
  newCatName: string;
  onNewCatNameChange: (value: string) => void;
  onAdd: () => void;
  onRename: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className={styles.taxTab}>
      <div className={styles.addRow}>
        <input
          className="lp-modal-input"
          type="text"
          value={newCatName}
          disabled={busy}
          placeholder={b.catNew}
          onChange={(e) => onNewCatNameChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
        />
        <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={onAdd} disabled={busy}>{b.catAdd}</button>
      </div>
      {cats.length === 0 ? (
        <p className="text-sm opacity-70">{b.catEmpty}</p>
      ) : (
        cats.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-base-300 px-3 py-2">
            <span className="font-medium">{c.name}</span>
            <span className="text-xs opacity-60">{formatMessage(b.catTagsCount, { count: c.tags.length })}</span>
            <div className="flex gap-1">
              <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={() => onRename(c.id)} disabled={busy}>{b.rename}</button>
              <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={() => onRemove(c.id)} disabled={busy}>{b.delete}</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
