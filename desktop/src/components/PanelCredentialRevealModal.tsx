import React from "react";
import { Copy, X } from "lucide-react";
import { getMessages } from "../i18n";

/**
 * Modal que revela el secreto de la credencial de conexión por-panel
 * (`lxp_live_`) UNA sola vez tras crear un panel. Muestra el secreto en claro
 * con copiar-al-portapapeles y el aviso de que no volverá a mostrarse. El
 * usuario lo pega en el `.env` de su caja LUXIPANEL.
 */
export function PanelCredentialRevealModal({
  secret,
  onClose,
  language,
}: {
  secret: string | null;
  onClose: () => void;
  language?: string;
}) {
  const t = getMessages(language);
  const c = t.panelEditor;
  const [copied, setCopied] = React.useState(false);

  if (!secret) return null;

  async function copy() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard bloqueado */
    }
  }

  return (
    <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[190] grid place-items-center p-4">
      <div className="lp-modal-card flex w-full max-w-lg flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{c.credRevealTitle}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={c.closeAria}>
            <X size={18} />
          </button>
        </div>
        <div className="lp-modal-body" style={{ display: "grid", gap: 10 }}>
          <p className="lp-modal-hint" style={{ color: "var(--lp-danger, #f87171)" }}>{c.credOnceWarning}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <code className="lp-modal-input" style={{ flex: 1, wordBreak: "break-all", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>{secret}</code>
            <button type="button" className="lp-modal-btn lp-modal-btn--primary lp-modal-btn--sm" onClick={() => void copy()}>
              <Copy size={13} /> {copied ? c.credCopied : c.credCopy}
            </button>
          </div>
        </div>
        <div className="lp-modal-footer">
          <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={onClose}>
            {c.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PanelCredentialRevealModal;
