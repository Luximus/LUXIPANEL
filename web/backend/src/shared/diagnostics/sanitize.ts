import { createHash } from "node:crypto";
import type { Severity } from "./types.js";

const SECRET_KEY = /password|passwd|passphrase|secret|token|api.?key|authorization|cookie|credential|private.?key|ticket|rawBody|body|email|remoteAddress|^ip$/i;
export function sanitizeText(value: string): string {
  return value
    .replace(/-----BEGIN [^-]*(?:PRIVATE KEY|CERTIFICATE)-----[\s\S]*?-----END [^-]+-----/g, "[redacted]")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [redacted]")
    .replace(/\b(?:lxp_live_[A-Za-z0-9_-]+|gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g, "[redacted]")
    .replace(/((?:password|passwd|passphrase|secret|token|api[_-]?key|ticket|authorization|cookie)["']?\s*[=:]\s*["']?)[^\s,"';&}\]]+/gi, "$1[redacted]")
    .replace(/([?&](?:code|pass|password|token|key|ticket|secret)=)[^&#\s]*/gi, "$1[redacted]")
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[redacted]@")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email redacted]");
}
/** Public summaries intentionally carry less context than private diagnostics. */
export function sanitizePublicText(value: string): string {
  return sanitizeText(value)
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[address]")
    .replace(/\b(?:[0-9a-f]{0,4}:){2,}[0-9a-f:]{0,39}\b/gi, "[address]")
    .replace(/(?:\/home\/|\/var\/www\/|\/etc\/|\/root\/|[A-Z]:\\Users\\)[^\s"'<>)]*/gi, "[private path]")
    .replace(/https?:\/\/[^\s<>)]*/g, (url) => /^https:\/\/github\.com\/Luxisoft\/LUXIPANEL(?:\/|$)/i.test(url) ? url : "[external URL]");
}
export function sanitize(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > 8) return "[depth limit]";
  if (typeof value === "string") return sanitizeText(value).slice(0, 65536);
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (!value || typeof value !== "object") return String(value ?? "");
  if (seen.has(value)) return "[circular]";
  seen.add(value);
  if (value instanceof Error) return { name: value.name, message: sanitizeText(value.message), stack: sanitizeText(value.stack || "") };
  if (Array.isArray(value)) return value.slice(0, 100).map((v) => sanitize(v, depth + 1, seen));
  return Object.fromEntries(Object.entries(value).slice(0, 100).map(([k, v]) => [k, SECRET_KEY.test(k) ? "[redacted]" : sanitize(v, depth + 1, seen)]));
}
export function fingerprint(severity: Severity, source: string, module: string, message: string, stack = ""): string {
  const stable = (message + "\n" + stack.split("\n").slice(0, 5).join("\n"))
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "<id>").replace(/\b\d+\b/g, "#");
  return createHash("sha256").update([severity, source, module, stable].join("\0")).digest("hex").slice(0, 24);
}
