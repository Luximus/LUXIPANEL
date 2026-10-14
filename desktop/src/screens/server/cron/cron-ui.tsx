/* eslint-disable react-refresh/only-export-components -- fichero compartido del split: exporta helpers y constantes además de componentes */
/**
 * cron-ui (desktop) — constantes, helpers y primitivas DOM compartidas del
 * módulo Cron: guards del gateway, catálogo de proveedores IA, `StatusPill`,
 * el `runServerMutation` espejo del hook de app y el shell de modal
 * `lp-modal-*` (`ModalShell` + `Field`) que usan `CronModule` y `cron-dialogs`.
 */
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { withJob, type GatewayResponse } from "../../../api/serverApi";
import type { CronAiJob, CronJob } from "./cron-types";

export const GUARDS = ["NO_CREDENTIALS", "FINGERPRINT_PENDING", "PANEL_UNAVAILABLE"];

export const PROVIDERS = [
  { value: "claude", label: "Claude" },
  { value: "codex", label: "Codex" },
  { value: "gemini", label: "Gemini" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "grok", label: "Grok" },
  { value: "minimax", label: "MiniMax" },
];

export const jobActive = (j: CronJob) => j.enabled !== false;
export const agentRunning = (a: CronAiJob) => a.running === true || a.lastStatus === "running";

export type PillKind = "ok" | "neutral" | "amber" | "danger";
const PILL_CLASS: Record<PillKind, string> = {
  ok: "bg-success/10 border-success/30 text-success",
  neutral: "bg-base-300 border-base-300 text-base-content/60",
  amber: "bg-warning/10 border-warning/30 text-warning",
  danger: "bg-error/10 border-error/30 text-error",
};

export function StatusPill({ label, kind }: { label: string; kind: PillKind }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${PILL_CLASS[kind]}`}>
      {label}
    </span>
  );
}

/** Espejo del `runServerMutation` de app (`app/src/hooks/useServerApi.ts`). */
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

// ── Shell de modal reutilizable (lp-modal-*) ─────────────────────────────────
export function ModalShell({
  title,
  onClose,
  closeLabel,
  children,
  footer,
  maxW = "max-w-lg",
  bodyClassName = "flex flex-col gap-3",
}: {
  title: string;
  onClose: () => void;
  closeLabel: string;
  children: ReactNode;
  footer: ReactNode;
  maxW?: string;
  bodyClassName?: string;
}) {
  return (
    <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4">
      <div className={`lp-modal-card flex max-h-full w-full ${maxW} flex-col`} onClick={(e) => e.stopPropagation()}>
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{title}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={closeLabel}>
            <X size={18} />
          </button>
        </div>
        <div className={`lp-modal-body ${bodyClassName}`}>{children}</div>
        <div className="lp-modal-footer">{footer}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-base-content/80">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-base-content/50">{hint}</span> : null}
    </label>
  );
}
