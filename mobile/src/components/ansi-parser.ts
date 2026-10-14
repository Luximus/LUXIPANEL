// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Parser ANSI SGR puro (sin dependencias, sin React Native) que reemplaza a
 * xterm.js en la app móvil. Convierte una salida de terminal con secuencias de
 * escape ANSI en una lista de segmentos `{ text, color?, bgColor?, bold?, … }`
 * que `AnsiTerminalView` pinta como `<Text>` anidados con color.
 *
 * Cubre: SGR `\x1b[…m` con reset (0), bold (1), dim (2), underline (4),
 * intensidad/subrayado off (22/24), colores estándar (30-37/40-47), brillantes
 * (90-97/100-107), default (39/49) y extendidos 256/truecolor (38/48;5/2;…).
 * Otras secuencias CSI (mover cursor, borrar) y OSC se descartan. Los retornos
 * de carro (`\r`) de barras de progreso se colapsan ("último escribe gana" por
 * línea física), como hace una terminal real al redibujar la misma línea.
 *
 * Es una función pura testeable: el color se devuelve como un NOMBRE ANSI
 * (p. ej. "red", "brightgreen") o un hex literal (truecolor/256), y la vista lo
 * resuelve a un hex concreto contra la paleta del tema con `resolveAnsiColor`.
 */

export interface AnsiSegment {
  text: string;
  /** Nombre ANSI ("red"…/"brightred"…) o hex literal ("#rrggbb"). */
  color?: string;
  /** Igual que `color`, pero para el fondo. */
  bgColor?: string;
  bold?: boolean;
  dim?: boolean;
  underline?: boolean;
}

interface Style {
  color?: string;
  bgColor?: string;
  bold?: boolean;
  dim?: boolean;
  underline?: boolean;
}

// Exportado para reutilizarlo en el emulador de terminal nativo (`terminal-emulator.ts`),
// que necesita la MISMA tabla de nombres ANSI sin duplicarla aquí.
export const NAMES = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"] as const;

/** Paleta ANSI para fondo oscuro (#0a0a0a). Colores legibles sobre negro. */
export const ANSI_DARK_PALETTE: Record<string, string> = {
  black: "#6b7280",
  red: "#f87171",
  green: "#4ade80",
  yellow: "#fbbf24",
  blue: "#60a5fa",
  magenta: "#c084fc",
  cyan: "#22d3ee",
  white: "#e4e4e7",
  brightblack: "#9ca3af",
  brightred: "#fca5a5",
  brightgreen: "#86efac",
  brightyellow: "#fde047",
  brightblue: "#93c5fd",
  brightmagenta: "#d8b4fe",
  brightcyan: "#67e8f9",
  brightwhite: "#ffffff",
};

/** Paleta ANSI para fondo claro (#e5e7eb). Colores oscurecidos para contraste. */
export const ANSI_LIGHT_PALETTE: Record<string, string> = {
  black: "#0f172a",
  red: "#dc2626",
  green: "#15803d",
  yellow: "#b45309",
  blue: "#2563eb",
  magenta: "#7c3aed",
  cyan: "#0e7490",
  white: "#334155",
  brightblack: "#64748b",
  brightred: "#ef4444",
  brightgreen: "#16a34a",
  brightyellow: "#a16207",
  brightblue: "#3b82f6",
  brightmagenta: "#a855f7",
  brightcyan: "#0891b2",
  brightwhite: "#0f172a",
};

/**
 * Resuelve el `color`/`bgColor` de un segmento a un hex concreto: si ya es un
 * hex literal (truecolor/256) se devuelve tal cual; si es un nombre ANSI se
 * busca en la paleta del tema. Devuelve `undefined` si no hay color.
 */
export function resolveAnsiColor(color: string | undefined, palette: Record<string, string>): string | undefined {
  if (!color) return undefined;
  if (color.startsWith("#")) return color;
  return palette[color.toLowerCase()];
}

function rgbHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, n | 0)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Índice de la paleta extendida de 256 colores → nombre ANSI o hex.
 *  Exportado para que el emulador nativo reuse el cubo 6×6×6 / grises sin duplicarlo. */
export function color256(idx: number): string | undefined {
  if (idx < 0 || idx > 255) return undefined;
  if (idx < 8) return NAMES[idx];
  if (idx < 16) return `bright${NAMES[idx - 8]}`;
  if (idx < 232) {
    // Cubo 6×6×6.
    const c = idx - 16;
    const r = Math.floor(c / 36);
    const g = Math.floor((c % 36) / 6);
    const b = c % 6;
    const lvl = (n: number) => (n === 0 ? 0 : 55 + n * 40);
    return rgbHex(lvl(r), lvl(g), lvl(b));
  }
  // Escala de grises 232-255.
  const v = 8 + (idx - 232) * 10;
  return rgbHex(v, v, v);
}

function applySgr(params: number[], style: Style): Style {
  const s: Style = { ...style };
  for (let i = 0; i < params.length; i++) {
    const p = params[i];
    if (p === 0) {
      // Reset total.
      delete s.color; delete s.bgColor; s.bold = false; s.dim = false; s.underline = false;
    } else if (p === 1) s.bold = true;
    else if (p === 2) s.dim = true;
    else if (p === 4) s.underline = true;
    else if (p === 22) { s.bold = false; s.dim = false; }
    else if (p === 24) s.underline = false;
    else if (p >= 30 && p <= 37) s.color = NAMES[p - 30];
    else if (p === 39) delete s.color;
    else if (p >= 40 && p <= 47) s.bgColor = NAMES[p - 40];
    else if (p === 49) delete s.bgColor;
    else if (p >= 90 && p <= 97) s.color = `bright${NAMES[p - 90]}`;
    else if (p >= 100 && p <= 107) s.bgColor = `bright${NAMES[p - 100]}`;
    else if (p === 38 || p === 48) {
      // Color extendido: 38/48 ; 5 ; idx  ó  38/48 ; 2 ; r ; g ; b.
      const target = p === 38 ? "color" : "bgColor";
      const mode = params[i + 1];
      if (mode === 5) {
        const c = color256(params[i + 2]);
        i += 2;
        if (c) s[target] = c; else delete s[target];
      } else if (mode === 2) {
        s[target] = rgbHex(params[i + 2], params[i + 3], params[i + 4]);
        i += 4;
      }
    }
    // Otros códigos SGR (italic 3, blink 5, etc.) se ignoran de momento.
  }
  return s;
}

function parseParams(raw: string): number[] {
  if (raw === "") return [0];
  return raw.split(";").map((p) => {
    const n = parseInt(p, 10);
    return Number.isNaN(n) ? 0 : n;
  });
}

/**
 * Colapsa los retornos de carro de barras de progreso/spinners: por cada línea
 * física (separada por `\n`), si hay `\r` se conserva solo lo que va después
 * del último `\r` (la terminal redibuja la línea desde el principio). Se
 * normaliza `\r\n` → `\n` ANTES para no borrar líneas que solo terminan en CRLF.
 */
function collapseCarriageReturns(input: string): string {
  const normalized = input.replace(/\r\n/g, "\n");
  if (!normalized.includes("\r")) return normalized;
  return normalized
    .split("\n")
    .map((line) => {
      const idx = line.lastIndexOf("\r");
      return idx >= 0 ? line.slice(idx + 1) : line;
    })
    .join("\n");
}

/**
 * Convierte una salida ANSI en segmentos de color contiguos. Vuelve a parsear
 * la cadena COMPLETA en cada llamada (la vista guarda el buffer acumulado), así
 * que un escape partido al final de un chunk de streaming se ignora sin romper.
 */
export function parseAnsi(input: string): AnsiSegment[] {
  if (!input) return [];
  const src = collapseCarriageReturns(input);
  const segments: AnsiSegment[] = [];
  let style: Style = {};
  let buf = "";

  const flush = () => {
    if (!buf) return;
    const seg: AnsiSegment = { text: buf };
    if (style.color) seg.color = style.color;
    if (style.bgColor) seg.bgColor = style.bgColor;
    if (style.bold) seg.bold = true;
    if (style.dim) seg.dim = true;
    if (style.underline) seg.underline = true;
    segments.push(seg);
    buf = "";
  };

  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\x1b") {
      const next = src[i + 1];
      if (next === "[") {
        // CSI: leer parámetros hasta el byte final (letra A-Z/a-z).
        let j = i + 2;
        let params = "";
        while (j < src.length && !/[A-Za-z]/.test(src[j])) { params += src[j]; j++; }
        const final = src[j];
        if (final === "m") {
          flush();
          style = applySgr(parseParams(params), style);
        }
        // Resto de CSI (cursor, borrar pantalla/línea, etc.) se descartan.
        i = j + 1;
        continue;
      }
      if (next === "]") {
        // OSC: descartar hasta BEL (0x07) o terminador de cadena ESC\.
        let j = i + 2;
        while (j < src.length && src[j] !== "\x07" && !(src[j] === "\x1b" && src[j + 1] === "\\")) j++;
        i = src[j] === "\x1b" ? j + 2 : j + 1;
        continue;
      }
      // Escape desconocido: saltar ESC + el siguiente byte.
      i += 2;
      continue;
    }
    buf += ch;
    i++;
  }
  flush();
  return segments;
}

export default parseAnsi;
