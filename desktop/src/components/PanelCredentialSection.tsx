import React from "react";
import { Copy, KeyRound, RefreshCw, Trash2 } from "lucide-react";
import { getPanelCredential, rotatePanelCredential, revokePanelCredential, type PanelCredentialMasked } from "../api/client";
import { getMessages } from "../i18n";
import { useAuth } from "../context/useAuth";
import { useConfirm } from "./ConfirmDialog";

/**
 * Sección "Credencial de conexión (LUXIPANEL)" del editor de panel (modo
 * editar). Muestra la credencial por-panel (`lxp_live_`) enmascarada y permite
 * verla/rotarla/copiarla/revocarla. El secreto en claro solo se revela una vez
 * (tras rotar) con copiar-al-portapapeles. El usuario lo pega en el `.env` de
 * su caja LUXIPANEL para identificarse. Paridad con la sección del portal.
 */
export function PanelCredentialSection({ panelId, language }: { panelId: string; language?: string }) {
  const t = getMessages(language);
  const c = t.panelEditor;
  const { token } = useAuth();
  const { confirm, dialog } = useConfirm();

  const [masked, setMasked] = React.useState<PanelCredentialMasked>(null);
  const [plaintext, setPlaintext] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!token) return;
    setFeedback(null);
    try {
      setMasked(await getPanelCredential(panelId, token));
    } catch {
      // Sin credencial todavía (o no disponible): estado vacío, sin ruido.
      setMasked(null);
    }
  }, [panelId, token]);

  React.useEffect(() => {
    setPlaintext(null);
    void load();
  }, [load]);

  const maskedDisplay = masked ? `${masked.prefix || ""}••••••${masked.last4 || ""}` : "";

  async function copy(value: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard bloqueado */
    }
  }

  async function rotate() {
    if (!token || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await rotatePanelCredential(panelId, token);
      if (res.plaintext) setPlaintext(res.plaintext);
      setMasked(res.masked);
      await load();
      setFeedback(c.credRotated);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : c.credRotateFailed);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!token || busy) return;
    const ok = await confirm({
      title: c.credRevokeConfirmTitle,
      message: c.credRevokeConfirmMsg,
      confirmLabel: c.credConfirmRevoke,
      cancelLabel: c.cancel,
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setFeedback(null);
    try {
      await revokePanelCredential(panelId, token);
      setMasked(null);
      setPlaintext(null);
      setFeedback(c.credRevoked);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : c.credRevokeFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 16, borderTop: "1px solid var(--lp-border, rgba(148,163,184,0.2))", paddingTop: 14 }}>
      <span className="lp-modal-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <KeyRound size={14} /> {c.credSectionTitle}
      </span>
      <p className="lp-modal-hint">{c.credSectionHint}</p>

      {masked ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <code className="lp-modal-input" style={{ flex: 1, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{maskedDisplay}</code>
        </div>
      ) : (
        <p className="lp-modal-hint" style={{ fontStyle: "italic" }}>{c.credEmpty}</p>
      )}

      {plaintext ? (
        <div style={{ display: "grid", gap: 6, border: "1px solid var(--lp-brand, #6366f1)", borderRadius: 8, padding: 10, marginTop: 8 }}>
          <p className="lp-modal-hint" style={{ color: "var(--lp-danger, #f87171)" }}>{c.credOnceWarning}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <code style={{ flex: 1, wordBreak: "break-all", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>{plaintext}</code>
            <button type="button" className="lp-modal-btn lp-modal-btn--primary lp-modal-btn--sm" onClick={() => void copy(plaintext)}>
              <Copy size={13} /> {copied ? c.credCopied : c.credCopy}
            </button>
          </div>
        </div>
      ) : null}

      {feedback ? <p className="lp-modal-hint" style={{ marginTop: 4 }}>{feedback}</p> : null}

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" className="lp-modal-btn lp-modal-btn--ghost lp-modal-btn--sm" disabled={busy} onClick={() => void rotate()}>
          <RefreshCw size={14} /> {c.credRotateBtn}
        </button>
        {masked ? (
          <button type="button" className="lp-modal-btn lp-modal-btn--danger lp-modal-btn--sm" disabled={busy} onClick={() => void revoke()}>
            <Trash2 size={14} /> {c.credRevokeBtn}
          </button>
        ) : null}
      </div>
      {dialog}
    </div>
  );
}

export default PanelCredentialSection;
