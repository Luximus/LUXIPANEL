import { useNativeModuleVisible } from "../module-visibility";
/**
 * mail-ui (desktop) — primitivas DOM compartidas del port del módulo Correo.
 * Equivalentes React DOM de los componentes RN que usa `MailScreen` de app
 * (`Modal`, `Field`, `Input`, `Select`, `Checkbox`, `InfoBox`, `SegmentedControl`,
 * `StringListEditor`, esqueletos) más el `runServerMutation` espejo del hook de
 * app. Estilo Tailwind + daisyUI + lucide-react (mismo look que MonitorModule),
 * shell de modal con las clases `lp-modal-*` (igual que `ConfirmDialog`).
 */
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info, Plus, Trash2, X } from "lucide-react";
import { GUARDS } from "./mail-constants";
import type { GatewayResponse } from "../../../api/serverApi";
import { withJob } from "../../../api/serverApi";

/** Espejo de `runServerMutation` de app (`app/src/hooks/useServerApi.ts`). */
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

// ── Modal (portal, shell lp-modal-*) ─────────────────────────────────────────

export function Modal({
  title,
  onClose,
  footer,
  children,
  maxWidth = "max-w-lg",
}: {
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
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
    <div hidden={!moduleVisible} inert={!moduleVisible} aria-hidden={!moduleVisible} role="dialog" aria-modal="true" style={{display:moduleVisible?undefined:"none"}}
      className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[160] grid place-items-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`lp-modal-card flex max-h-full w-full ${maxWidth} flex-col`}>
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{title}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label="close">
            <X size={18} />
          </button>
        </div>
        <div className="lp-modal-body">{children}</div>
        {footer ? <div className="lp-modal-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/** Pie estándar cancelar/guardar (espejo de `DialogFooter` de app). */
export function DialogFooter({
  onCancel,
  cancelLabel,
  onSubmit,
  submitLabel,
  submitting,
  disabled,
  danger,
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
      <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={submitting}>
        {cancelLabel}
      </button>
      <button
        type="button"
        className={`btn btn-sm gap-1.5 ${danger ? "btn-error" : "btn-primary"}`}
        onClick={onSubmit}
        disabled={submitting || disabled}
      >
        {submitting ? <span className="loading loading-spinner loading-xs" /> : null}
        {submitLabel}
      </button>
    </>
  );
}

// ── Campos de formulario (daisyUI) ───────────────────────────────────────────

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-base-content/70">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-base-content/50">{hint}</span> : null}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
  onSubmit,
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  onSubmit?: () => void;
}) {
  return (
    <input
      type={type}
      className="input input-bordered input-sm w-full"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={!onChange}
      onChange={(e) => onChange?.(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onSubmit) onSubmit();
      }}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 5,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  mono?: boolean;
}) {
  return (
    <textarea
      className={`textarea textarea-bordered w-full text-sm ${mono ? "font-mono text-xs" : ""}`}
      value={value}
      placeholder={placeholder}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function SelectInput({
  value,
  options,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <select
      className="select select-bordered select-sm w-full"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function CheckboxRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1">
      <input
        type="checkbox"
        className="checkbox checkbox-sm checkbox-primary"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

// ── Cajas informativas / píldoras / esqueletos ───────────────────────────────

export function InfoBox({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "danger" }) {
  const cls =
    tone === "danger"
      ? "border-error/30 bg-error/10 text-error"
      : tone === "warn"
        ? "border-warning/30 bg-warning/10 text-warning"
        : "border-info/30 bg-info/10 text-info";
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${cls}`}>
      <Info size={14} className="mt-0.5 shrink-0" />
      <span className="whitespace-pre-line">{children}</span>
    </div>
  );
}

export type PillTone = "ok" | "neutral" | "sky" | "warn";

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-success/15 text-success border-success/30"
      : tone === "sky"
        ? "bg-info/15 text-info border-info/30"
        : tone === "warn"
          ? "bg-warning/15 text-warning border-warning/30"
          : "bg-base-300 text-base-content/60 border-base-300";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

/** Barra de sub-pestañas con scroll horizontal (espejo del SegmentedControl). */
export function SegTabs<K extends string>({
  items,
  value,
  onChange,
}: {
  items: { key: K; label: string; icon?: ReactNode }[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          className={`btn btn-xs shrink-0 gap-1 ${value === it.key ? "btn-primary" : "btn-ghost border border-base-300"}`}
          onClick={() => onChange(it.key)}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-6">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-3 rounded bg-base-content/15"
          style={{ width: `${88 - i * 10}%` }}
        />
      ))}
    </div>
  );
}

/** Editor inline de una lista de direcciones (whitelist/blacklist/destinos). */
export function StringListEditor({
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  addLabel: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <div className="flex flex-col gap-2">
      {items.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className="input input-bordered input-sm flex-1" value={v} readOnly />
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square text-error"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input
          className="input input-bordered input-sm flex-1"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn btn-outline btn-sm gap-1" onClick={add}>
          <Plus size={14} /> {addLabel}
        </button>
      </div>
    </div>
  );
}

/** Lista de "configuración actual" (mapa dominio→valor) bajo cada formulario. */
export function CurrentMap({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: { key: string; label: string; value: string }[];
}) {
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <span className="text-xs font-bold text-base-content/60">{title}</span>
      {rows.length === 0 ? (
        <span className="text-xs text-base-content/50">{empty}</span>
      ) : (
        rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between gap-2 rounded-lg border border-base-300 px-2.5 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-[13px] text-base-content/70">{row.label}</span>
            <span className="truncate text-[13px] font-semibold">{row.value}</span>
          </div>
        ))
      )}
    </div>
  );
}
