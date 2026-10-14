import { useNativeModuleVisible } from "../module-visibility";
/* eslint-disable react-refresh/only-export-components -- fichero compartido del split: exporta helpers y constantes además de componentes */
/**
 * settings-shared (desktop) — tipos, catálogos de conectores, helpers puros y
 * subcomponentes de presentación del módulo Ajustes, extraídos de
 * `SettingsModule.tsx` (espejo de `settings-types`/`settings-connectors` de la
 * app). Sin estado compartido: todo es puro o presentacional.
 */
import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Cloud, Database, GitBranch, ShieldCheck, Smartphone, Sparkles, X } from "lucide-react";
import { withJob, type GatewayResponse } from "../../../api/serverApi";
import { getMessages } from "../../../i18n";

export const GUARDS = ["NO_CREDENTIALS", "FINGERPRINT_PENDING", "PANEL_UNAVAILABLE"];
export const RESTART_SERVICES = ["postfix", "dovecot", "opendkim", "redis-server", "postgresql"];

// ── Tipos (espejo de settings-types) ────────────────────────────────────────
export type TokenConnector = {
  id: string;
  label: string;
  icon: ReactNode;
  base: string;
  del: string;
  test?: string;
  putKey: string;
  setField: string;
  previewField?: string;
  /** módulo que habilita la tarjeta; undefined = siempre (admin). */
  gate?: string;
};
export type KV = { key: string; value: string };
export type ConnState = { configured: boolean; preview?: string };
export type StorageCred = { provider: string; configured?: boolean; accountId?: string; endpoint?: string; region?: string; accessKeyId?: string; hasSecret?: boolean };
export type Ticket = { id: string; title?: string; status?: string; createdAt?: string; lastResponderRole?: string };
export type TicketMessage = { content?: string; createdAt?: string; isAdmin?: boolean };
export type TicketDetail = { id: string; title?: string; status?: string; createdAt?: string; messages?: TicketMessage[] };
export type SysInfo = {
  hostname?: string;
  platform?: string;
  release?: string;
  arch?: string;
  uptime?: number;
  cpu?: { model?: string; cores?: number; loadAvg?: { "1m"?: number } };
  memory?: { total?: number; used?: number; usagePercent?: string };
  disk?: { total?: number; used?: number; percent?: string };
};
export type ImageEntry = { name: string; url: string; size?: number; modifiedAt?: string };
export type PillKind = "ok" | "sky" | "amber" | "neutral";

// ── Catálogos de conectores (espejo de settings-connectors) ─────────────────
export const TOKEN_CONNECTORS: TokenConnector[] = [
  { id: "cloudflare", label: "Cloudflare", icon: <Cloud size={20} />, base: "/api/cloudflare/config", del: "/api/cloudflare/config", test: "/api/cloudflare/test", putKey: "apiToken", setField: "tokenSet", previewField: "tokenPreview", gate: "cloudflare" },
  { id: "expo", label: "Expo (EAS)", icon: <Smartphone size={20} />, base: "/api/expo/config", del: "/api/expo/config", putKey: "token", setField: "tokenSet", previewField: "tokenPreview", gate: "expo" },
  { id: "openclaw", label: "OpenClaw", icon: <Sparkles size={20} />, base: "/api/openclaw/config", del: "/api/openclaw/api-key", test: "/api/openclaw/test", putKey: "apiKey", setField: "apiKeySet", previewField: "apiKeyPreview", gate: "openclaw" },
  { id: "repository-store", label: "GitHub", icon: <GitBranch size={20} />, base: "/api/admin/repository-store/config", del: "/api/admin/repository-store/config", putKey: "token", setField: "tokenConfigured", gate: undefined },
  { id: "bitninja", label: "BitNinja", icon: <ShieldCheck size={20} />, base: "/api/bitninja/config", del: "/api/bitninja/config", putKey: "licenseKey", setField: "tokenSet", previewField: "tokenPreview", gate: "bitninja" },
];
export const STORAGE_CONNECTORS: { provider: string; label: string; icon: ReactNode }[] = [
  { provider: "r2", label: "Cloudflare R2", icon: <Cloud size={20} /> },
  { provider: "s3", label: "Amazon S3", icon: <Database size={20} /> },
];

// ── Helpers puros (espejo de settings-types) ────────────────────────────────
function scalar(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
/** Aplana el objeto de settings (posiblemente anidado por categoría) a [{key,value}]. */
export function flattenSettings(data: unknown): KV[] {
  if (!data || typeof data !== "object") return [];
  const out: KV[] = [];
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) out.push({ key: k2, value: scalar(v2) });
    } else {
      out.push({ key: k, value: scalar(v) });
    }
  }
  return out;
}
/** Convierte la respuesta de /api/settings[/:category] (array de filas) a [{key,value}]. */
export function settingsRowsToKv(data: unknown): KV[] {
  if (Array.isArray(data)) {
    const out: KV[] = [];
    for (const row of data) {
      if (row && typeof row === "object" && "key" in row) {
        const r = row as { key?: unknown; value?: unknown };
        const key = scalar(r.key);
        if (key) out.push({ key, value: scalar(r.value) });
      }
    }
    return out;
  }
  return flattenSettings(data);
}
export function fmtBytes(n?: number): string {
  if (!n || n <= 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}
export function fmtUptime(sec?: number): string {
  if (!sec || sec <= 0) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m || parts.length === 0) parts.push(`${m}m`);
  return parts.join(" ");
}
export function fmtDate(s?: string): string {
  if (!s) return "";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}
export type Tt = ReturnType<typeof getMessages>["serverSettings"];
export function statusLabel(t: Tt, s?: string): string {
  switch (s) {
    case "open":
      return t.report.statusOpen;
    case "in_progress":
      return t.report.statusInProgress;
    case "resolved":
      return t.report.statusResolved;
    case "closed":
      return t.report.statusClosed;
    default:
      return s ?? "—";
  }
}
export function statusKind(s?: string): PillKind {
  switch (s) {
    case "open":
      return "sky";
    case "in_progress":
      return "amber";
    case "resolved":
      return "ok";
    default:
      return "neutral";
  }
}
/** Clases daisyUI para las píldoras de estado (equivalente DOM de `pillColors`). */
export function pillClass(kind: PillKind): string {
  switch (kind) {
    case "ok":
      return "border-success/30 bg-success/10 text-success";
    case "sky":
      return "border-info/30 bg-info/10 text-info";
    case "amber":
      return "border-warning/30 bg-warning/10 text-warning";
    default:
      return "border-base-300 bg-base-200 text-base-content/60";
  }
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

// ── Subcomponentes de fila ──────────────────────────────────────────────────

export function SecurityRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-base-300 bg-base-100 p-4">
      <span className="text-sm">{label}</span>
      <span className="text-sm text-base-content/60">{value}</span>
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-base-content/50">{label}</span>
      <span className="flex-shrink text-right text-xs text-base-content/70">{value}</span>
    </div>
  );
}


export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-base-content/70">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-base-content/50">{hint}</span> : null}
    </label>
  );
}

// ── Modal shell (espejo DOM del `Modal` de app; usa las clases lp-modal-*) ────

export function ModalShell({
  title,
  onClose,
  closeLabel,
  maxW = "max-w-lg",
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  closeLabel: string;
  maxW?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const moduleVisible=useNativeModuleVisible();
  return createPortal(
    <div hidden={!moduleVisible} inert={!moduleVisible} aria-hidden={!moduleVisible} role="dialog" aria-modal="true" style={{display:moduleVisible?undefined:"none"}} className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4">
      <div className={`lp-modal-card flex max-h-full w-full ${maxW} flex-col`} onClick={(e) => e.stopPropagation()}>
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{title}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={closeLabel}>
            <X size={18} />
          </button>
        </div>
        <div className="lp-modal-body flex flex-col gap-3">{children}</div>
        {footer ? <div className="lp-modal-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function DialogFooter({
  onCancel,
  cancelLabel,
  onSubmit,
  submitLabel,
  submitting,
  disabled,
}: {
  onCancel: () => void;
  cancelLabel: string;
  onSubmit: () => void;
  submitLabel: string;
  submitting?: boolean;
  disabled?: boolean;
}) {
  return (
    <>
      <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onCancel}>
        {cancelLabel}
      </button>
      <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={onSubmit} disabled={submitting || disabled}>
        {submitting ? <span className="loading loading-spinner loading-xs" /> : null}
        {submitLabel}
      </button>
    </>
  );
}
