import type { Severity } from "./types.js";

export function historyRecord(raw: string, stderr = false): { severity: Severity; message: string; stack?: string; module: string; timestamp?: string; details?: Record<string, unknown>; requestId?: string; id?: string; scope?: string } | undefined {
  const text = raw.replace(/\u001b\[[0-9;]*m/g, "").trim(); if (!text) return;
  let data: Record<string, unknown> | undefined;
  try { data = JSON.parse(text); } catch { /* console/Astro text */ }
  if (data) {
    const level = Number(data.level) || (data.level === "warn" || data.warning ? 40 : data.level === "error" || data.err || data.error ? 50 : stderr ? 50 : 0);
    if (level < 40) return;
    const error = data.err as { message?: string; stack?: string } | undefined;
    const time = typeof data.time === "number" ? data.time : typeof data.time === "string" ? Date.parse(data.time) : NaN;
    return { severity: level >= 60 ? "fatal" : level >= 50 ? "error" : "warn", module: String(data.module || "runtime"), message: String(data.msg || error?.message || data.error || data.warning || "Error"), stack: error?.stack,
      timestamp: Number.isFinite(time) ? new Date(time).toISOString() : undefined, details: data, requestId: typeof data.requestId === "string" ? data.requestId : undefined,
      id: typeof data.diagnosticId === "string" ? data.diagnosticId : undefined, scope: typeof data.diagnosticScope === "string" ? data.diagnosticScope : undefined };
  }
  if (!stderr && !/(?:\berror\b|\bwarn(?:ing)?\b|\bfatal\b|exception|rejection|\bat\s+\S+\s*\()/i.test(text)) return;
  const lines = text.split("\n");
  return { severity: /fatal/i.test(lines[0]!) ? "fatal" : /warn/i.test(lines[0]!) ? "warn" : "error", module: "runtime", message: lines[0]!, stack: lines.length > 1 ? text : undefined };
}
