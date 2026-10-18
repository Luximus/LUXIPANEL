// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Helpers de formato + claves de render compartidos por los componentes
 * presentacionales del asistente (portados de ChatPane de LUXIPANEL). Movidos
 * 1:1 desde `components/ServerAssistantPane.tsx` (fase A3): sin React/JSX.
 *
 * IDIOMA: todo lo que se formatea aquí (hora, fecha, separador de miles,
 * unidades) usa el idioma ACTIVO DE LA APP, no el del dispositivo. La app no
 * tiene un store module-level de idioma (vive en el árbol React, en
 * `useMainTabController`), así que la pantalla del chat lo publica aquí con
 * `setAssistantLocale(language)` y los componentes hoja que NO reciben `lang`
 * por props (TurnView → CompactionDivider / TurnQuickReplies / AskView, y el
 * MarkdownView) lo leen de aquí. Los helpers aceptan además un `lang` explícito
 * cuando el llamador sí lo tiene.
 */
import { formatMessage, getMessages, isLocaleCode, type LocaleCode } from "../../i18n";
import type { ChatMsg } from "../../features/assistant/types";

/** Idioma activo de la app. Fallback "es" (misma semántica que `strings()`:
 *  OJO, no la de `normalizeLocale`, cuyo fallback es inglés). */
let activeLocale: LocaleCode = "es";

/** Publica el idioma activo de la app (lo llama `ChatScreen` con su `language`). */
export function setAssistantLocale(lang?: string | null): void {
  activeLocale = toLocale(lang, "es");
}

/** Idioma activo de la app (para componentes hoja sin `lang` por props). */
export function getAssistantLocale(): LocaleCode {
  return activeLocale;
}

/** Textos del chat del asistente en el idioma activo (o en `lang` si se pasa). */
export function assistantChatMessages(lang?: string | null) {
  return getMessages(toLocale(lang, activeLocale)).assistantChat;
}

function toLocale(lang: string | null | undefined, fallback: LocaleCode): LocaleCode {
  const two = (lang ?? "").slice(0, 2);
  return isLocaleCode(two) ? two : fallback;
}

/** Separador de miles del IDIOMA DE LA APP ("." en es, "," en en…). Varios
 *  locales (es-ES) NO agrupan números de 4 cifras por defecto (8595 → "8595");
 *  aquí siempre lo queremos. Si el runtime no agrupa (Hermes sin Intl), cae a ",". */
const sepCache = new Map<LocaleCode, string>();
function thousandsSep(locale: LocaleCode): string {
  const cached = sepCache.get(locale);
  if (cached) return cached;
  let sep = ",";
  try {
    const m = (11111).toLocaleString(locale).match(/11(\D)111/);
    if (m?.[1]) sep = m[1];
  } catch {
    /* runtime sin Intl: se queda con "," */
  }
  sepCache.set(locale, sep);
  return sep;
}

/** Tokens con separador de miles siempre: 8595 → "8.595", 1234567 → "1.234.567". */
export function formatTokens(n: number, lang?: string): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep(toLocale(lang, activeLocale)));
}

/** Tiempo transcurrido legible: "820 ms", "3.4 s", "1 m 12 s". */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const secs = ms / 1000;
  if (secs < 10) return `${secs.toFixed(1)} s`;
  // Redondear a segundos ANTES de partir en minutos: hacerlo después producía
  // acarreos imposibles ("60 s", "1 m 60 s") en la ventana de medio segundo
  // previa al minuto.
  const total = Math.round(secs);
  if (total < 60) return `${total} s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m} m ${String(s).padStart(2, "0")} s`;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Hora del turno en el formato del IDIOMA DE LA APP (12h con AM/PM en en, 24h
 *  en es/fr…, 午後 en ja…). Sin Intl en el runtime, cae al 24h de siempre. */
export function formatTime(ts: number, lang?: string): string {
  const d = new Date(ts);
  try {
    const s = d.toLocaleTimeString(toLocale(lang, activeLocale), { hour: "2-digit", minute: "2-digit" });
    if (s && /\d/.test(s)) return s;
  } catch {
    /* runtime sin Intl: fallback 24h */
  }
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Compact date/time used by web chat turn headers and user bubble footers. */
export function formatTurnTimestamp(ts: number, lang?: string): string {
  try {
    return new Date(ts).toLocaleString(toLocale(lang, activeLocale), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return formatTime(ts, lang); }
}

/** Fecha corta en el formato del IDIOMA DE LA APP (es → 14/07/2026, en →
 *  07/14/2026, ja → 2026/07/14). Fallback DD/MM/YYYY sin Intl. */
export function formatShortDate(ts: number, lang?: string): string {
  const d = new Date(ts);
  try {
    const s = d.toLocaleDateString(toLocale(lang, activeLocale), { day: "2-digit", month: "2-digit", year: "numeric" });
    if (s && /\d/.test(s)) return s;
  } catch {
    /* runtime sin Intl: fallback DD/MM/YYYY */
  }
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Fecha relativa compacta para el drawer ("ahora", "5 min", "3 h", "2 d"), con
 *  las unidades y la fecha larga en el idioma activo de la app. */
export function relativeDate(iso: string | undefined, justNow: string, lang?: string): string {
  if (!iso) return "";
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  const m = assistantChatMessages(lang);
  const diff = Date.now() - ts;
  if (diff < 60_000) return justNow;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} ${m.unitMinutesShort}`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ${m.unitHoursShort}`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} ${m.unitDaysShort}`;
  return formatShortDate(ts, lang);
}

/** Etiqueta del divisor de compactación: "{n} mensajes anteriores resumidos"
 *  (o "Conversación compactada" si el backend no dice cuántos), en el idioma
 *  activo de la app. */
export function compactionLabel(n: number, lang?: string): string {
  const m = assistantChatMessages(lang);
  return n > 0 ? formatMessage(m.compactedSummary, { n }) : m.conversationCompacted;
}

/** Cuerpo del resumen de compactación sin su marcador inicial ("[Resumen de la
 *  conversación previa …]", "[Summary of the previous conversation …]"): el
 *  backend lo emite en el IDIOMA DEL HILO, así que no se puede casar contra el
 *  texto español. Se quita cualquier marcador `[…]` de una línea al principio. */
export function stripCompactionMarker(text: string): string {
  return text.replace(/^\s*\[[^\]\n]{0,200}\]\s*/, "");
}

/** Claves de render ESTABLES por mensaje (React `key`).
 *
 *  `ChatMsg` no tiene id (lo siembra el `chat-store`, que no se toca aquí), así
 *  que la clave se deriva de lo único estable del turno: rol + `createdAt` —
 *  invariantes a los deltas del stream (el reducer preserva `createdAt`) y a los
 *  reemplazos ENTEROS de la lista (apertura de hilo, compactación,
 *  pull-to-refresh, retryLast), que son los que con `key={i}` pegaban el estado
 *  local de un hijo (ModifiedFilesView.open, ToolBlockView.userOpen,
 *  CompactionDivider.open, borradores de AskView) al mensaje de OTRA posición.
 *
 *  LIMITACIÓN: los mensajes persistidos sin `ts` (`createdAt` undefined) caen a
 *  un contador por rol, que sigue siendo posicional entre ellos. La solución
 *  definitiva es sembrar un id en el store al crear/mapear el mensaje. */
export function messageKeys(messages: readonly ChatMsg[]): string[] {
  const seen = new Map<string, number>();
  return messages.map((m) => {
    const base = `${m.role}:${m.createdAt ?? "na"}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}~${n}`;
  });
}

/**
 * Firma barata del CONTENIDO MUTABLE de un turno (React `prop`), para que
 * `TurnView` pueda memoizarse.
 *
 * POR QUÉ: el reducer del stream (`applyAssistantEvent`) devuelve un array NUEVO
 * pero **muta el turno vivo EN SITIO** (`last.content += delta`, `tool.output +=
 * …`, `tools.push(…)`). Consecuencias:
 *
 * - Los turnos ANTERIORES conservan su identidad de objeto en cada delta ⇒ un
 *   `React.memo` con comparación superficial ya los salta (hoy, sin memo, cada
 *   token re-renderizaba TODA la lista: N burbujas markdown re-parseadas por
 *   token).
 * - Pero el turno VIVO también conserva su identidad (se muta), así que un memo
 *   a secas lo congelaría a media respuesta. Esta firma cambia con cada delta y
 *   lo re-renderiza a él SOLO.
 *
 * Es O(nº de tools) — sin recorrer el texto: `String.length` es O(1) — y capta
 * todo lo que `TurnView` pinta y el stream puede mutar in situ. Los campos que
 * solo se fijan al CREAR el mensaje (`role`, `createdAt`, `attachmentName`) no
 * hacen falta: cambian con el objeto entero.
 */
export function turnRevision(m: ChatMsg): string {
  let tools = "";
  for (const tool of m.tools ?? []) {
    tools += `${tool.id}~${tool.output.length}~${tool.done ? 1 : 0}~${tool.success === undefined ? "-" : tool.success ? 1 : 0};`;
  }
  return [
    m.content.length,
    m.displaySummary ?? "",
    m.pending ? 1 : 0,
    m.stopped ? 1 : 0,
    m.interrupted ? 1 : 0,
    m.status ?? "",
    m.error ?? "",
    m.translationError ?? "",
    m.permission?.id ?? "",
    m.ask?.length ?? 0,
    m.askKind ?? "",
    m.tokens?.total ?? 0,
    m.tokens?.estimated ? 1 : 0,
    m.durationMs ?? 0,
    m.summarizedCount ?? 0,
    m.provider ?? "",
    m.raw?.length ?? 0,
    m.cliHistoryLog?.length ?? 0,
    m.attachments?.length ?? 0,
    m.auto ? 1 : 0,
    tools,
  ].join("|");
}
