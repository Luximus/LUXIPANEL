import { useNativeModuleVisible } from "../module-visibility";
/**
 * files-ui — helpers de render DOM compartidos por el módulo Archivos (desktop):
 * modal (portal + clases `lp-modal-*` como `ConfirmDialog`), campo de formulario,
 * pie de diálogo, caja informativa, pill de estado y el `runServerMutation`
 * espejo del de la app. Todo React DOM + Tailwind/daisyUI; sin React Native.
 */
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { GUARDS } from "./files-types";
import { callServerApi, withJob, type GatewayResponse } from "../../../api/serverApi";

/** Props compartidas por cada sub-pestaña del diálogo Herramientas. */
export type ToolTabProps = {
  serverId: string;
  language?: string;
  dir: string;
  onToast: (m: string, e?: boolean) => void;
  onChanged: () => void;
};

/**
 * Espejo del `runServerMutation` de la app adaptado al contrato directo del
 * desktop (`callServerApi(serverId, "", …)`): normaliza guardias y jobs de la
 * cola write-behind a un `{ ok, error }`.
 */
export async function runServerMutation(
  serverId: string,
  op: () => Promise<GatewayResponse>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await op();
    if (res.code && GUARDS.includes(res.code)) return { ok: false, error: res.code };
    if (!res.ok) {
      const panel = res.data as { error?: string; message?: string } | undefined;
      return { ok: false, error: panel?.error ?? panel?.message ?? res.error };
    }
    await withJob(res, serverId, "");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network_error" };
  }
}

/** Atajo tipado de una llamada directa (token siempre `""` en modo directo). */
export function api(serverId: string) {
  return {
    get: <T = unknown>(path: string) => callServerApi<T>(serverId, "", "GET", path),
    post: (path: string, body?: unknown) => callServerApi(serverId, "", "POST", path, body),
    put: (path: string, body?: unknown) => callServerApi(serverId, "", "PUT", path, body),
    del: (path: string, body?: unknown) => callServerApi(serverId, "", "DELETE", path, body),
  };
}

// ── Modal (portal + clases lp-modal-*, gemelo DOM del <Modal/> nativo) ────────
type ModalWidth = "sm" | "md" | "lg" | "xl";

const WIDTH_CLASS: Record<ModalWidth, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
};

export function Modal({
  title,
  onClose,
  footer,
  children,
  width = "md",
  fillHeight = false,
}: {
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  width?: ModalWidth;
  fillHeight?: boolean;
}) {
  const moduleVisible=useNativeModuleVisible();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented && moduleVisible) {e.preventDefault();e.stopPropagation();onClose();}
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose,moduleVisible]);

  return createPortal(
    <div hidden={!moduleVisible} inert={!moduleVisible} aria-hidden={!moduleVisible} role="dialog" aria-modal="true" style={{display:moduleVisible?undefined:"none"}} className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[160] grid place-items-center p-4">
      <div className={`lp-modal-card flex w-full ${WIDTH_CLASS[width]} flex-col ${fillHeight ? "h-[80vh]" : "max-h-full"}`}>
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{title}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="lp-modal-body flex-1">{children}</div>
        {footer ? <div className="lp-modal-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/** Campo etiquetado con hint opcional (gemelo del `<Field/>` nativo). */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="lp-modal-label">{label}</span>
      {children}
      {hint ? <span className="lp-modal-hint">{hint}</span> : null}
    </label>
  );
}

/** Pie de diálogo: cancelar (ghost) + enviar (primary/danger), con spinner. */
export function DialogFooter({
  onCancel,
  cancelLabel,
  onSubmit,
  submitLabel,
  submitting = false,
  disabled = false,
  danger = false,
}: {
  onCancel: () => void;
  cancelLabel: string;
  onSubmit: () => void;
  submitLabel: string;
  submitting?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <>
      <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onCancel}>
        {cancelLabel}
      </button>
      <button
        type="button"
        className={`lp-modal-btn ${danger ? "lp-modal-btn--danger" : "lp-modal-btn--primary"}`}
        onClick={onSubmit}
        disabled={submitting || disabled}
      >
        {submitting ? <span className="loading loading-spinner loading-xs" /> : null}
        {submitLabel}
      </button>
    </>
  );
}

export type InfoTone = "info" | "warn" | "danger";

export function InfoBox({ tone = "info", children }: { tone?: InfoTone; children: ReactNode }) {
  const cls =
    tone === "danger"
      ? "border-error/30 bg-error/10 text-error"
      : tone === "warn"
        ? "border-warning/30 bg-warning/10 text-warning"
        : "border-info/30 bg-info/10 text-info";
  return <div className={`rounded-lg border px-3 py-2 text-xs ${cls}`}>{children}</div>;
}

export type PillKind = "ok" | "danger" | "warn" | "sky" | "primary" | "neutral";

export function pillClasses(kind: PillKind): string {
  switch (kind) {
    case "ok":
      return "border-success/30 bg-success/10 text-success";
    case "danger":
      return "border-error/30 bg-error/10 text-error";
    case "warn":
      return "border-warning/30 bg-warning/10 text-warning";
    case "sky":
      return "border-info/30 bg-info/10 text-info";
    case "primary":
      return "border-primary/30 bg-primary/10 text-primary";
    default:
      return "border-base-300 bg-base-200 text-base-content/60";
  }
}

export function Pill({ kind, label }: { kind: PillKind; label: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${pillClasses(kind)}`}>
      {label}
    </span>
  );
}

/** Fila "cargando…" reusable (spinner + texto). */
export function LoadingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-2 text-sm text-base-content/60">
      <span className="loading loading-spinner loading-xs text-primary" />
      {label}
    </div>
  );
}
