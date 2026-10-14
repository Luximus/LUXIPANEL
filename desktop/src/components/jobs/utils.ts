// Utilidades de presentación del módulo "Empleos" (Fase 6, IMPL-B).
// Espejo de los helpers de formato del web (`portal-jobs.ts`): tokens, fechas,
// bytes y el gate de elegibilidad de disputa. No tocan red ni i18n.
import type { Requirement } from "../../api/jobs";

/** Formatea una cantidad de tokens con separadores de miles. */
export function fmtTokens(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString();
}

/** Fecha corta (sin hora). "—" si la entrada es nula/ inválida. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

/** Fecha + hora (para la bitácora del canal). */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

/** Tamaño legible de un adjunto (B/KB/MB/GB). */
export function fmtBytes(n: number | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Convierte un ISO a valor de `<input type="date">` (YYYY-MM-DD). */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

/** ¿Transcurrió >30% del tiempo estimado? (gate UI de disputa; el backend re-valida). */
export function disputeEligible(r: Requirement): boolean {
  if (!r.publishedAt || !r.deadlineAt) return false;
  const start = new Date(r.publishedAt).getTime();
  const end = new Date(r.deadlineAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;
  return Date.now() >= start + 0.3 * (end - start);
}
