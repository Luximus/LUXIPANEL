// Formateadores puros del módulo Mail (direcciones, fechas, uso, HTML→texto).
import type { MailAccount } from "./mail-types";

/** Formatea una dirección (objeto {name?,address}, string o lista) a texto. */
export function fmtAddress(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map(fmtAddress).filter(Boolean).join(", ");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const address = typeof o.address === "string" ? o.address.trim() : typeof o.email === "string" ? o.email.trim() : "";
    if (name && address) return `${name} <${address}>`;
    return address || name;
  }
  return "";
}

/** Solo la parte de correo de una dirección (para pre-llenar el "Para" al responder). */
export function addressEmail(v: unknown): string {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const a = (v as Record<string, unknown>).address ?? (v as Record<string, unknown>).email;
    if (typeof a === "string" && a) return a.trim();
  }
  const s = fmtAddress(v);
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim();
}

/** Conversión básica HTML→texto plano (cuando el mensaje sólo trae html). */
export function htmlToText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, " ")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|tr|li|h[1-6]|table)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Divide un campo de destinatarios en una lista de correos. */
export function splitEmails(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function fmtUsage(a: MailAccount, unlimited: string): string {
  const quota = a.quotaMb ?? a.quota;
  const used = a.usedMb ?? a.used;
  const q = quota == null || quota === 0 ? unlimited : `${quota} MB`;
  if (used == null) return q;
  return `${used} / ${q}`;
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

export function pick(o: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v) return v;
    if (typeof v === "number") return String(v);
  }
  return "";
}
