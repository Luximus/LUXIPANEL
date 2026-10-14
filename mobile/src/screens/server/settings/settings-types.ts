/**
 * settings-types — constantes, tipos y helpers PUROS del módulo Ajustes (sin
 * React ni RN), extraídos de SettingsViewScreen para compartirlos con sus
 * subcomponentes (diálogos/conectores) sin duplicarlos.
 */
import type { ReactNode } from "react";
import { getMessages } from "../../../i18n";
import type { PillKind } from "../../../components/server/badges";

export const GUARDS = ["NO_CREDENTIALS", "FINGERPRINT_PENDING", "PANEL_UNAVAILABLE", "DIRECT_AUTH_REQUIRED"];

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
export const RESTART_SERVICES = ["postfix", "dovecot", "opendkim", "redis-server", "postgresql"];

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
export type ImageEntry = { name: string; url: string; previewUrl?: string; size?: number; modifiedAt?: string };

/** Convierte la respuesta de /api/settings[/:category] a [{key,value}]. El
 *  backend devuelve un array de filas {key,value,category,…}; si llegara un
 *  objeto plano/anidado se reutiliza flattenSettings. */
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

/** Aplana el objeto de settings (posiblemente anidado por categoría) a [{key,value}]. */
export function flattenSettings(data: unknown): KV[] {
  if (!data || typeof data !== "object") return [];
  const out: KV[] = [];
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
        out.push({ key: k2, value: scalar(v2) });
      }
    } else {
      out.push({ key: k, value: scalar(v) });
    }
  }
  return out;
}
function scalar(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
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

type Tt = ReturnType<typeof getMessages>["serverSettings"];
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

