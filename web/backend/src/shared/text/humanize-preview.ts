// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * humanize-preview — convierte la salida CRUDA de un agente (JSON, log de
 * terminal con ANSI, markdown) en UNA línea legible para la campana de
 * notificaciones / push.
 *
 * Motivación (2026-08-25): la campana mostraba cuerpos como
 * `{ "overallRisk": "medium", "keyThreats": ["BitNinja no está …"] }` o el log
 * de consola con secuencias ANSI. Ninguno es legible para el operador. Aquí
 * traducimos ese payload a `Riesgo: medio · Amenazas: BitNinja no está … (+2)`.
 *
 * Puro y sin dependencias: se usa desde el módulo `ai-assistant` (emisores de
 * eventos) y desde `notifications`. No conoce i18n todavía — el texto de las
 * etiquetas es español, igual que el resto de `NOTIFICATION_RULES`
 * (ver `modules/notifications/README.md`, pendiente `metadata.i18n`).
 */

const ESC = String.fromCharCode(27);
const ANSI_RE = new RegExp(`${ESC}\\[[0-9;?]*[ -/]*[@-~]`, "g");
/** OSC (`ESC ] … BEL|ST`) — títulos de ventana que algunos CLIs emiten. */
const OSC_RE = new RegExp(`${ESC}\\][^\\u0007${ESC}]*(?:\\u0007|${ESC}\\\\)`, "g");

/** Glifos de marcador de herramienta de los CLIs (claude/codex/gemini). */
const CLI_GLYPH_RE = /[⏺⎿●]+\s?/g;

/** Etiquetas ES para las claves más habituales de las respuestas JSON. */
const LABELS: Record<string, string> = {
  overallrisk: "Riesgo",
  risk: "Riesgo",
  keythreats: "Amenazas",
  threats: "Amenazas",
  summary: "Resumen",
  status: "Estado",
  error: "Error",
  errors: "Errores",
  recommendations: "Recomendaciones",
  recommendation: "Recomendación",
  severity: "Severidad",
  title: "Título",
  message: "Mensaje",
  result: "Resultado",
  reason: "Motivo",
};

/** Valores enumerados habituales → español. */
const VALUES: Record<string, string> = {
  low: "bajo",
  medium: "medio",
  high: "alto",
  critical: "crítico",
  ok: "correcto",
  failed: "fallido",
  success: "correcto",
  unknown: "desconocido",
};

/** Máximo de campos que se muestran de un objeto JSON. */
const MAX_FIELDS = 3;
/** Máximo de elementos de un array antes del sufijo `(+N)`. */
const MAX_ARRAY_ITEMS = 2;
/** Techo del texto que intentamos parsear como JSON (evita O(n²) en logs). */
const MAX_JSON_SCAN = 64_000;
/** Cuántos cierres `}`/`]` probamos al reparar un JSON truncado. */
const MAX_JSON_REPAIR_TRIES = 24;

/** Quita secuencias ANSI/OSC (colores, cursor, títulos de ventana). */
export function stripAnsi(input: string): string {
  if (!input) return "";
  return input.replace(ANSI_RE, "").replace(OSC_RE, "");
}

/**
 * Markdown "lite": quita el andamiaje visual (vallas de código, backticks,
 * negritas, encabezados, viñetas, citas) y convierte `[texto](url)` en `texto`.
 * NO intenta ser un parser: solo debe dejar la línea legible.
 */
export function stripMarkdownLite(input: string): string {
  if (!input) return "";
  return input
    .replace(/```[a-zA-Z0-9_-]*\n?/g, " ")
    .replace(/~~~[a-zA-Z0-9_-]*\n?/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/__([^_]*)__/g, "$1")
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]*>[ \t]?/gm, "")
    .replace(/^[ \t]*[-*+][ \t]+/gm, "")
    .replace(/^[ \t]*\d+[.)][ \t]+/gm, "")
    .replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, " ")
    .replace(CLI_GLYPH_RE, " ");
}

/** `overallRisk` → `Riesgo`; `nextSteps` → `Next steps` (camelCase → palabras). */
function labelFor(key: string): string {
  const mapped = LABELS[key.toLowerCase()];
  if (mapped) return mapped;
  const words = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!words) return key;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function scalarToText(value: unknown): string | null {
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return null;
    return VALUES[t.toLowerCase()] ?? t;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "sí" : "no";
  return null;
}

/**
 * Valor JSON → texto legible.
 * - escalar: `medium` → `medio`, `true` → `sí`
 * - array: los 2 primeros elementos + ` (+N)`
 * - objeto/null/función: `""` (se descarta el campo)
 */
export function humanizeJsonValue(value: unknown): string {
  const scalar = scalarToText(value);
  if (scalar !== null) return scalar;
  if (Array.isArray(value)) {
    const items = value.map((v) => scalarToText(v)).filter((v): v is string => !!v);
    if (items.length === 0) return "";
    const shown = items.slice(0, MAX_ARRAY_ITEMS).join(", ");
    const rest = items.length - Math.min(items.length, MAX_ARRAY_ITEMS);
    return rest > 0 ? `${shown} (+${rest})` : shown;
  }
  return "";
}

/** ¿El texto ARRANCA como JSON? (no basta con contener llaves). */
function looksLikeJson(text: string): boolean {
  return /^[{[]/.test(text);
}

/**
 * Parsea JSON tolerando truncado: prueba el texto entero y, si falla, recorta
 * hasta el último `}`/`]` (y los anteriores, hasta un tope) — un log cortado a
 * mitad de frase es el caso normal cuando el emisor ya truncó la respuesta.
 */
function parseJsonLoose(text: string): unknown {
  const candidate = text.length > MAX_JSON_SCAN ? text.slice(0, MAX_JSON_SCAN) : text;
  try {
    return JSON.parse(candidate);
  } catch {
    /* sigue: intento de reparación */
  }
  let tries = 0;
  for (let i = candidate.length - 1; i >= 1 && tries < MAX_JSON_REPAIR_TRIES; i--) {
    const ch = candidate[i];
    if (ch !== "}" && ch !== "]") continue;
    tries++;
    try {
      return JSON.parse(candidate.slice(0, i + 1));
    } catch {
      /* siguiente cierre */
    }
  }
  return undefined;
}

/** Objeto/array parseado → `Riesgo: medio · Amenazas: A, B (+2)`. */
function describeParsed(parsed: unknown): string {
  if (Array.isArray(parsed)) return humanizeJsonValue(parsed);
  if (parsed && typeof parsed === "object") {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (parts.length >= MAX_FIELDS) break;
      const text = humanizeJsonValue(value);
      if (!text) continue;
      parts.push(`${labelFor(key)}: ${text}`);
    }
    return parts.join(" · ");
  }
  return scalarToText(parsed) ?? "";
}

/** Colapsa cualquier espacio (incluidos saltos) en un único espacio. */
function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Corta en frontera de palabra y añade `…`. */
function truncateOnWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const hard = text.slice(0, Math.max(1, max - 1));
  const lastSpace = hard.lastIndexOf(" ");
  const cut = lastSpace > Math.floor(max * 0.5) ? hard.slice(0, lastSpace) : hard;
  return `${cut.replace(/[\s.,;:·\-–—]+$/, "")}…`;
}

/**
 * Convierte `raw` (JSON, log ANSI, markdown o prosa) en una línea legible de
 * como mucho `max` caracteres. Nunca lanza: ante cualquier duda devuelve el
 * texto colapsado y truncado.
 */
export function humanizePreview(raw: unknown, max = 140): string {
  if (typeof raw !== "string" || !raw) return "";
  const limit = Math.max(16, Math.floor(max));
  const plain = stripAnsi(raw).replace(/\r\n?/g, "\n").trim();
  if (!plain) return "";

  if (looksLikeJson(plain)) {
    const parsed = parseJsonLoose(plain);
    if (parsed !== undefined) {
      const described = collapse(stripMarkdownLite(describeParsed(parsed)));
      if (described) return truncateOnWord(described, limit);
    }
    // No parseable: quita el andamiaje JSON y sigue como texto.
    const stripped = collapse(stripMarkdownLite(plain.replace(/[{}[\]"]/g, " ")).replace(/\s*,\s*/g, ", "));
    return stripped ? truncateOnWord(stripped, limit) : "";
  }

  const text = collapse(stripMarkdownLite(plain));
  return text ? truncateOnWord(text, limit) : "";
}
