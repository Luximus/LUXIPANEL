import { Sparkles } from "lucide-react";
import { type Messages } from "../../../i18n";
import styles from "../AdminBlogModal.module.css";

/** Bloque SEO + redes sociales del tab Publicar: botón de optimización con IA
 *  (si `aiEnabled`) + campos SEO title/description, hashtags y caption. */
export function SeoSocialFieldset({
  b,
  aiEnabled,
  busy,
  seoBusy,
  seoStatus,
  onRunSeo,
  seoTitle,
  onSeoTitleChange,
  seoDescription,
  onSeoDescriptionChange,
  hashtagsText,
  onHashtagsTextChange,
  socialCaption,
  onSocialCaptionChange,
}: {
  b: Messages["blog"];
  aiEnabled: boolean;
  busy: boolean;
  seoBusy: boolean;
  seoStatus: string;
  onRunSeo: () => void;
  seoTitle: string;
  onSeoTitleChange: (value: string) => void;
  seoDescription: string;
  onSeoDescriptionChange: (value: string) => void;
  hashtagsText: string;
  onHashtagsTextChange: (value: string) => void;
  socialCaption: string;
  onSocialCaptionChange: (value: string) => void;
}) {
  return (
    <fieldset className={styles.seoFieldset}>
      <legend className={styles.seoLegend}>{b.seoSocialTitle}</legend>
      {aiEnabled ? (
        <button
          type="button"
          className={`lp-modal-btn lp-modal-btn--ghost ${styles.aiBtn} ${styles.seoBtn}`}
          onClick={onRunSeo}
          disabled={busy}
          title={b.seoOptimize}
        >
          <Sparkles size={15} /> {seoBusy ? b.seoOptimizing : b.seoOptimize}
        </button>
      ) : null}
      {seoStatus ? <p className="text-xs opacity-80">{seoStatus}</p> : null}

      <label className={`lp-modal-label ${styles.label}`}>
        <span>{b.seoTitleLabel}</span>
        <input
          className="lp-modal-input"
          type="text"
          maxLength={70}
          value={seoTitle}
          disabled={busy}
          onChange={(e) => onSeoTitleChange(e.target.value)}
        />
      </label>

      <label className={`lp-modal-label ${styles.label}`}>
        <span>{b.seoDescLabel}</span>
        <textarea
          className={`lp-modal-input ${styles.resizable}`}
          rows={2}
          maxLength={200}
          value={seoDescription}
          disabled={busy}
          onChange={(e) => onSeoDescriptionChange(e.target.value)}
        />
      </label>

      <label className={`lp-modal-label ${styles.label}`}>
        <span>{b.hashtagsLabel}</span>
        <input
          className="lp-modal-input"
          type="text"
          value={hashtagsText}
          disabled={busy}
          onChange={(e) => onHashtagsTextChange(e.target.value)}
        />
        <span className="text-xs opacity-60">{b.hashtagsHint}</span>
      </label>

      <label className={`lp-modal-label ${styles.label}`}>
        <span>{b.socialCaptionLabel}</span>
        <textarea
          className={`lp-modal-input ${styles.resizable}`}
          rows={4}
          maxLength={2200}
          value={socialCaption}
          disabled={busy}
          onChange={(e) => onSocialCaptionChange(e.target.value)}
        />
      </label>
    </fieldset>
  );
}
