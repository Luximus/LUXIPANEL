/**
 * dialog-kit — piezas de modal NATIVAS (React DOM + daisyUI + clases `lp-modal-*`)
 * reutilizadas por los diálogos del módulo Usuarios de desktop. Equivalen a los
 * componentes `Modal`/`Field`/`InfoBox`/`DialogFooter` que la app (RN) importa de
 * `components/ui` y `components/server/Form`, portados al look del frontend web.
 */
import type { ReactNode } from "react";
import { X } from "lucide-react";

/** Cascarón de modal: overlay + tarjeta + header con cierre + body scrollable +
 *  footer opcional. Espejo DOM de `components/ui/Modal` de la app. */
export function ModalShell({
  title,
  onClose,
  footer,
  children,
  maxWidth = "max-w-lg",
  closeLabel,
}: {
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
  closeLabel?: string;
}) {
  return (
    <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[160] grid place-items-center p-4">
      <div className={`lp-modal-card flex max-h-full w-full ${maxWidth} flex-col`} onClick={(e) => e.stopPropagation()}>
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{title}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={closeLabel ?? "Close"}>
            <X size={18} />
          </button>
        </div>
        <div className="lp-modal-body">{children}</div>
        {footer ? <div className="lp-modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Par botón Cancelar / Guardar del footer (espejo de `DialogFooter`). */
export function DialogFooter({
  onCancel,
  cancelLabel,
  onSubmit,
  submitLabel,
  submitting,
  danger,
}: {
  onCancel: () => void;
  cancelLabel: string;
  onSubmit: () => void;
  submitLabel: string;
  submitting?: boolean;
  danger?: boolean;
}) {
  return (
    <>
      <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onCancel} disabled={submitting}>
        {cancelLabel}
      </button>
      <button
        type="button"
        className={`lp-modal-btn ${danger ? "lp-modal-btn--danger" : "lp-modal-btn--primary"}`}
        onClick={onSubmit}
        disabled={submitting}
      >
        {submitting ? <span className="loading loading-spinner loading-xs" /> : null}
        {submitLabel}
      </button>
    </>
  );
}

/** Campo etiquetado con pista opcional (espejo de `Field`). */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="lp-modal-label">{label}</span>
      {children}
      {hint ? <p className="lp-modal-hint">{hint}</p> : null}
    </label>
  );
}

/** Caja informativa con tono neutro/aviso/peligro (espejo de `InfoBox`). */
export function InfoBox({ tone = "info", children }: { tone?: "info" | "warn" | "danger"; children: ReactNode }) {
  const cls =
    tone === "danger"
      ? "border-error/30 bg-error/10 text-error"
      : tone === "warn"
        ? "border-warning/30 bg-warning/10 text-warning"
        : "border-base-300 bg-base-200/40 text-base-content/70";
  return <div className={`mb-2 rounded-lg border px-3 py-2 text-xs ${cls}`}>{children}</div>;
}
