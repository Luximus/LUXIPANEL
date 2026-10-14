import type { AssistantStrings } from "./types";

// ── Formateadores (port de TurnMeta de LUXIPANEL ChatPane.tsx) ───────────────
/** Separador de miles del locale ("." en es, "," en en…). Varios locales (es-ES)
 *  NO agrupan números de 4 cifras por defecto (8595 → "8595"); aquí siempre lo
 *  queremos. */
const THOUSANDS_SEP = (() => {
  const m = (11111).toLocaleString().match(/11(\D)111/);
  return m ? m[1] : ",";
})();

/** Tokens con separador de miles siempre: 8595 → "8.595", 1234567 → "1.234.567". */
export function formatTokens(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEP);
}

/** Tiempo transcurrido legible: "820 ms", "3.4 s", "1 m 12 s". */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(secs < 10 ? 1 : 0)} s`;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m} m ${String(s).padStart(2, "0")} s`;
}

export function formatTime(at: number, language?: string): string {
  try {
    return new Date(at).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
}

/** Fecha relativa corta para el historial ("hace 5 min", "ayer"…). */
export function formatRelative(iso: string | undefined, language: string | undefined, t: AssistantStrings): string {
  if (!iso) return "";
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "";
  const diffSec = Math.round((at - Date.now()) / 1000);
  if (diffSec > -60) return t.justNow;
  try {
    const rtf = new Intl.RelativeTimeFormat((language ?? "es").slice(0, 2), { numeric: "auto", style: "narrow" });
    const abs = Math.abs(diffSec);
    if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
    if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day");
    return new Date(at).toLocaleDateString(language);
  } catch {
    return new Date(at).toLocaleDateString();
  }
}
