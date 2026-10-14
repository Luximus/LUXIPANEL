/* eslint-disable react-refresh/only-export-components -- fichero compartido del split: exporta helpers y constantes además de componentes */
/**
 * expo-shared (desktop) — tipos, helpers puros y subcomponentes de
 * presentación del módulo Expo, extraídos de `ExpoModule.tsx` (espejo de
 * `app/src/screens/server/expo/expo-types.ts` + expo-icons). Sin estado
 * compartido: todo es puro o presentacional.
 */
import { type ReactNode } from "react";
import { X } from "lucide-react";
import { withJob, type GatewayResponse } from "../../../api/serverApi";

export const GUARDS = ["NO_CREDENTIALS", "FINGERPRINT_PENDING", "PANEL_UNAVAILABLE"];

// ── Tipos (espejo de app/src/screens/server/expo/expo-types.ts) ─────────────
export type ExpoConfig = { tokenSet?: boolean; tokenPreview?: string | null; hasToken?: boolean; preview?: string | null };
export type ExpoProject = {
  path: string;
  name?: string | null;
  slug?: string | null;
  projectId?: string | null;
  androidPackage?: string | null;
  iosBundleIdentifier?: string | null;
};
export type ExpoBuild = {
  id: string;
  platform?: string | null;
  status?: string | null;
  profile?: string | null;
  createdAt?: string | null;
  url?: string | null;
  artifactUrl?: string | null;
  appVersion?: string | null;
};
export type ExpoEnvVar = {
  id?: string | null;
  name: string;
  value?: string | null;
  scope?: string | null;
  visibility?: string | null;
  environments?: string[];
};
export type DevClientSession = {
  url?: string | null;
  artifactUrl?: string | null;
  buildId?: string | null;
  platform?: string | null;
  profile?: string | null;
  status?: string | null;
  qr?: string | null;
  raw?: string | null;
};
export type StoreGoogleKey = { clientEmail?: string | null; projectIdentifier?: string | null; updatedAt?: string | null };
export type StoreAppleKey = { keyIdentifier?: string | null; issuerIdentifier?: string | null; name?: string | null; updatedAt?: string | null };
export type StoreGoogleProjectFile = { path?: string | null; clientEmail?: string | null };
export type StoreAppleProjectFile = { path?: string | null; keyId?: string | null; issuerId?: string | null };
export type ExpoStoreCredentials = {
  google?: { cloudKeys?: StoreGoogleKey[]; projectFile?: StoreGoogleProjectFile | null; localFile?: boolean };
  apple?: { cloudKeys?: StoreAppleKey[]; projectFile?: StoreAppleProjectFile | null; localFile?: boolean };
};
export type ExpoCliResult = { ok?: boolean; url?: string | null; stdout?: string | null; stderr?: string | null; exitCode?: number | null };

export const VISIBILITIES = ["plaintext", "sensitive", "secret"] as const;
export const ENV_TARGETS = ["production", "preview", "development"] as const;

export type PillKind = "ok" | "neutral" | "sky" | "amber" | "danger";

// ── Helpers puros ────────────────────────────────────────────────────────────
export function envDisplayValue(v: ExpoEnvVar): string {
  const vis = (v.visibility ?? "").toLowerCase();
  if (vis === "secret" || vis === "sensitive") return "••••••";
  return v.value ?? "—";
}
export function visibilityKind(vis: string | null | undefined): PillKind {
  const v = (vis ?? "").toLowerCase();
  if (v === "secret") return "danger";
  if (v === "sensitive") return "amber";
  return "sky"; // plaintext / public
}
export function hasToken(c: ExpoConfig): boolean {
  return c.tokenSet === true || c.hasToken === true;
}
export function tokenPreview(c: ExpoConfig): string {
  return c.tokenPreview ?? c.preview ?? "";
}
export function statusKind(status: string | null | undefined): PillKind {
  const s = (status ?? "").toLowerCase();
  if (s === "finished") return "ok";
  if (s === "errored" || s === "error" || s === "failed") return "danger";
  if (s === "canceled" || s === "cancelled") return "neutral";
  if (["new", "in-queue", "in-progress", "pending", "building", "queued"].includes(s)) return "amber";
  return "sky";
}
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  try {
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" } as Intl.DateTimeFormatOptions);
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
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

// ── Subcomponentes de presentación ──────────────────────────────────────────

const PILL_CLASS: Record<PillKind, string> = {
  ok: "border-success/30 bg-success/10 text-success",
  neutral: "border-base-300 bg-base-200 text-base-content/60",
  sky: "border-info/30 bg-info/10 text-info",
  amber: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-error/30 bg-error/10 text-error",
};

export function Pill({ label, kind }: { label: string; kind: PillKind }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${PILL_CLASS[kind]}`}>{label}</span>
  );
}

export function InfoBox({ tone, children }: { tone: "info" | "warn" | "danger"; children: ReactNode }) {
  const cls =
    tone === "danger"
      ? "border-error/30 bg-error/10 text-error"
      : tone === "warn"
        ? "border-warning/30 bg-warning/10 text-warning"
        : "border-info/30 bg-info/10 text-info";
  return <div className={`rounded-lg border px-3 py-2 text-xs ${cls}`}>{children}</div>;
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

export function StoreCredCard({ title, badges, rows }: { title: string; badges: { label: string; kind: PillKind }[]; rows: { label: string; value: string }[] }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-base-300 bg-base-100 p-4">
      <h4 className="text-[13px] font-semibold">{title}</h4>
      <div className="flex flex-wrap gap-1.5">
        {badges.map((b, i) => (
          <Pill key={i} label={b.label} kind={b.kind} />
        ))}
      </div>
      {rows.map((r, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <span className="text-[11px] text-base-content/50">{r.label}</span>
          <span className="select-all break-all text-xs text-base-content/80">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Modal reutilizable (patrón lp-modal-* de desktop) ────────────────────────
export function ModalShell({
  title,
  onClose,
  closeLabel,
  footer,
  maxW = "max-w-lg",
  children,
}: {
  title: string;
  onClose: () => void;
  closeLabel: string;
  footer: ReactNode;
  maxW?: string;
  children: ReactNode;
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
        <div className="lp-modal-body flex flex-col gap-3">{children}</div>
        <div className="lp-modal-footer">{footer}</div>
      </div>
    </div>
  );
}

/** Pie estándar cancelar/guardar de un diálogo con acción principal. */
export function DialogFooter({
  onCancel,
  cancelLabel,
  onSubmit,
  submitLabel,
  submitting,
}: {
  onCancel: () => void;
  cancelLabel: string;
  onSubmit: () => void;
  submitLabel: string;
  submitting: boolean;
}) {
  return (
    <>
      <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onCancel} disabled={submitting}>
        {cancelLabel}
      </button>
      <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={onSubmit} disabled={submitting}>
        {submitting ? <span className="loading loading-spinner loading-xs" /> : null}
        {submitLabel}
      </button>
    </>
  );
}

export function UrlBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-base-content/50">{label}</span>
      <span className="select-all break-all text-xs text-base-content/80">{value}</span>
    </div>
  );
}
