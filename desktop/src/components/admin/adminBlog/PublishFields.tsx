import { type RefObject } from "react";
import { Sparkles } from "lucide-react";
import { type Messages } from "../../../i18n";
import type { BlogCategory } from "../../../api/blog";
import styles from "../AdminBlogModal.module.css";

/**
 * Campos cohesivos del tab Publicar extraídos como componentes presentacionales
 * (el estado del formulario sigue en `AdminBlogModal`, que es su único dueño y
 * quien orquesta los handlers de IA/subida). Prop surface acotada por campo.
 */

/** Fila de generación con IA: mín. caracteres, nº de imágenes y botón. */
export function AiDraftRow({
  b,
  busy,
  minChars,
  onMinCharsChange,
  imageCount,
  onImageCountChange,
  aiBusy,
  aiCanRun,
  aiTitle,
  onRun,
}: {
  b: Messages["blog"];
  busy: boolean;
  minChars: string;
  onMinCharsChange: (value: string) => void;
  imageCount: string;
  onImageCountChange: (value: string) => void;
  aiBusy: boolean;
  aiCanRun: boolean;
  aiTitle: string;
  onRun: () => void;
}) {
  return (
    <div className={styles.aiRow}>
      <label className={`lp-modal-label ${styles.labelFlexLg}`}>
        <span>{b.aiMinChars}</span>
        <input className="lp-modal-input" type="number" min={0} value={minChars} disabled={busy} onChange={(e) => onMinCharsChange(e.target.value)} />
      </label>
      <label className={`lp-modal-label ${styles.labelFlexSm}`}>
        <span>{b.aiImageCount}</span>
        <input className="lp-modal-input" type="number" min={0} value={imageCount} disabled={busy} onChange={(e) => onImageCountChange(e.target.value)} />
      </label>
      <button
        type="button"
        className={`lp-modal-btn lp-modal-btn--ghost tooltip tooltip-top ${styles.aiBtn}`}
        onClick={onRun}
        disabled={busy || !aiCanRun}
        data-tip={aiTitle}
      >
        <Sparkles size={15} /> {aiBusy ? b.aiGenerating : b.aiGenerate}
      </button>
    </div>
  );
}

/** Selector de tags de la categoría activa (checkboxes). */
export function TagsPicker({
  b,
  busy,
  currentCategory,
  selectedTags,
  onToggle,
}: {
  b: Messages["blog"];
  busy: boolean;
  currentCategory: BlogCategory | null;
  selectedTags: Set<string>;
  onToggle: (name: string, checked: boolean) => void;
}) {
  return (
    <div className={`lp-modal-label ${styles.label}`}>
      <span>{b.fieldTagsLabel}</span>
      {!currentCategory ? (
        <p className="text-xs opacity-70">{b.tagsHintNoCategory}</p>
      ) : currentCategory.tags.length === 0 ? (
        <p className="text-xs opacity-70">{b.tagsHintNoTags}</p>
      ) : (
        <div className={styles.tagsList}>
          {currentCategory.tags.map((tg) => (
            <label key={tg.id} className={styles.tagItem}>
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={selectedTags.has(tg.name)}
                disabled={busy}
                onChange={(e) => onToggle(tg.name, e.target.checked)}
              />
              <span>{tg.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/** Campo de contenido Markdown + subida de imagen que se inserta al final. */
export function ContentField({
  b,
  busy,
  content,
  onContentChange,
  contentRef,
  failed,
  uploadingContent,
  contentFileRef,
  onUploadContentImage,
}: {
  b: Messages["blog"];
  busy: boolean;
  content: string;
  onContentChange: (value: string) => void;
  contentRef: RefObject<HTMLTextAreaElement | null>;
  failed: boolean;
  uploadingContent: boolean;
  contentFileRef: RefObject<HTMLInputElement | null>;
  onUploadContentImage: (file: File) => void;
}) {
  return (
    <label className={`lp-modal-label ${styles.label}`}>
      <span>{b.fieldContent}</span>
      <textarea
        ref={contentRef}
        className={`lp-modal-input ${styles.contentTextarea}${failed ? " lp-modal-input--error" : ""}`}
        aria-invalid={failed || undefined}
        rows={10}
        value={content}
        disabled={busy}
        placeholder={b.contentPlaceholder}
        onChange={(e) => onContentChange(e.target.value)}
      />
      <span className="text-xs opacity-60">{b.contentHelp}</span>
      <div>
        <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={() => contentFileRef.current?.click()} disabled={busy}>
          {uploadingContent ? b.coverUploading : b.contentImageUpload}
        </button>
        <input
          ref={contentFileRef}
          type="file"
          accept="image/*"
          className={styles.hidden}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onUploadContentImage(f); }}
        />
      </div>
    </label>
  );
}

/** Campo de portada: URL manual, subir/quitar imagen y previsualización. */
export function CoverImageField({
  b,
  busy,
  coverUrl,
  onCoverUrlChange,
  onClearCover,
  uploadingCover,
  coverFileRef,
  onUploadCover,
}: {
  b: Messages["blog"];
  busy: boolean;
  coverUrl: string | null;
  onCoverUrlChange: (value: string | null) => void;
  onClearCover: () => void;
  uploadingCover: boolean;
  coverFileRef: RefObject<HTMLInputElement | null>;
  onUploadCover: (file: File) => void;
}) {
  return (
    <div className={`lp-modal-label ${styles.label}`}>
      <span>{b.fieldCover}</span>
      <input
        className="lp-modal-input"
        type="text"
        value={coverUrl ?? ""}
        disabled={busy}
        placeholder={b.fieldCoverUrl}
        onChange={(e) => onCoverUrlChange(e.target.value || null)}
      />
      <div className={styles.coverActions}>
        <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={() => coverFileRef.current?.click()} disabled={busy}>
          {uploadingCover ? b.coverUploading : b.coverUpload}
        </button>
        <input
          ref={coverFileRef}
          type="file"
          accept="image/*"
          className={styles.hidden}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onUploadCover(f); }}
        />
        {coverUrl ? (
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClearCover} disabled={busy}>
            {b.coverRemove}
          </button>
        ) : null}
      </div>
      {coverUrl ? (
        <img src={coverUrl} alt="" loading="lazy" className={styles.coverPreview} />
      ) : (
        <span className="text-xs opacity-60">{b.coverEmpty}</span>
      )}
    </div>
  );
}
