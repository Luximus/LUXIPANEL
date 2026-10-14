/**
 * Parser Markdown "lite" para las burbujas del asistente del servidor. Portado
 * del renderer regex de LUXIPANEL (`floating-assistant/Markdown.tsx`) pero
 * separado en dos piezas para React Native:
 *
 *   1. ESTE módulo: parser PURO (sin imports de RN) que devuelve un árbol
 *      simple de bloques/inlines — testeable en vitest (entorno node).
 *   2. `components/MarkdownView.tsx`: componente RN que renderiza el árbol con
 *      <Text> anidados / <View>s (no hay DOM en RN).
 *
 * Cubre el subconjunto que los asistentes emiten de verdad: headings, bold,
 * italic, inline code, strikethrough, links, listas (ordenadas/desordenadas,
 * anidadas), blockquotes, hr, saltos de línea y bloques ```cercados``` con
 * etiqueta de lenguaje (en LUXIPANEL los separa MessageContent aguas arriba;
 * aquí los maneja el propio parser).
 */

// ── Árbol ───────────────────────────────────────────────────────────────────

export type MdInline =
  | { t: "text"; text: string }
  | { t: "code"; text: string }
  | { t: "link"; text: string; href: string }
  | { t: "bold"; children: MdInline[] }
  | { t: "italic"; children: MdInline[] }
  | { t: "strike"; children: MdInline[] }
  // Subrayado: el markdown del asistente no lo emite; lo produce `html-lite`
  // (tag <u> del blog), que reutiliza este árbol de inlines.
  | { t: "u"; children: MdInline[] };

export type MdListItem = { children: MdInline[]; nested: MdList | null };
export type MdList = { t: "list"; ordered: boolean; items: MdListItem[] };

export type MdAlign = "left" | "center" | "right" | null;
export type MdTable = {
  t: "table";
  header: MdInline[][];
  align: MdAlign[];
  rows: MdInline[][][];
};

export type MdBlock =
  | { t: "p"; lines: MdInline[][] }
  | { t: "heading"; level: number; children: MdInline[] }
  | { t: "quote"; lines: MdInline[][] }
  | MdList
  | { t: "hr" }
  | MdTable
  | { t: "codeblock"; lang: string; code: string };

// ── Tablas GFM ───────────────────────────────────────────────────────────────
// Una tabla es una fila `| a | b |`, seguida de una fila separadora
// `|---|:--:|` (guiones con `:` opcionales para la alineación), seguida de 0+
// filas de datos. Se renderiza como rejilla nativa en `MarkdownView`.

/** Separa una fila `| a | b |` en celdas crudas (sin los bordes externos). */
function splitTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  // Divide por `|` no escapado (`\|` dentro de una celda no corta).
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") { cur += "|"; i++; continue; }
    if (s[i] === "|") { cells.push(cur.trim()); cur = ""; continue; }
    cur += s[i];
  }
  cells.push(cur.trim());
  return cells;
}

const TABLE_SEP_RE = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/;

/** Alineación por celda a partir de la fila separadora (`:--`, `:-:`, `--:`). */
function parseAlign(sepCells: string[]): MdAlign[] {
  return sepCells.map((c) => {
    const cell = c.trim();
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    if (left) return "left";
    return null;
  });
}

// ── Inlines ─────────────────────────────────────────────────────────────────
// El orden importa: code primero (no formatear dentro), luego links, luego
// énfasis. Tokenizamos buscando la coincidencia MÁS TEMPRANA en cada pasada
// (mismo algoritmo que LUXIPANEL).

type InlineRule = { re: RegExp; make: (m: RegExpExecArray) => MdInline };

const INLINE: InlineRule[] = [
  { re: /`([^`]+)`/, make: (m) => ({ t: "code", text: m[1] }) },
  { re: /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/, make: (m) => ({ t: "link", text: m[1], href: m[2] }) },
  { re: /\*\*([^*]+)\*\*/, make: (m) => ({ t: "bold", children: parseInline(m[1]) }) },
  { re: /__([^_]+)__/, make: (m) => ({ t: "bold", children: parseInline(m[1]) }) },
  { re: /~~([^~]+)~~/, make: (m) => ({ t: "strike", children: parseInline(m[1]) }) },
  { re: /\*([^*\n]+)\*/, make: (m) => ({ t: "italic", children: parseInline(m[1]) }) },
  { re: /(?<![A-Za-z0-9])_([^_\n]+)_(?![A-Za-z0-9])/, make: (m) => ({ t: "italic", children: parseInline(m[1]) }) },
];

export function parseInline(text: string): MdInline[] {
  if (!text) return [];
  let best: { idx: number; rule: InlineRule; m: RegExpExecArray } | null = null;
  for (const rule of INLINE) {
    const m = rule.re.exec(text);
    if (m && (best === null || m.index < best.idx)) best = { idx: m.index, rule, m };
  }
  if (!best) return [{ t: "text", text }];
  const out: MdInline[] = [];
  if (best.idx > 0) out.push({ t: "text", text: text.slice(0, best.idx) });
  out.push(best.rule.make(best.m));
  out.push(...parseInline(text.slice(best.idx + best.m[0].length)));
  return out;
}

// ── Listas (anidación por indentación, como LUXIPANEL renderList) ───────────

type RawItem = { indent: number; ordered: boolean; content: string };

function buildList(items: RawItem[], from: number, indent: number): { node: MdList; next: number } {
  const ordered = items[from].ordered;
  const out: MdListItem[] = [];
  let i = from;
  while (i < items.length && items[i].indent === indent && items[i].ordered === ordered) {
    const children = parseInline(items[i].content);
    i++;
    let nested: MdList | null = null;
    if (i < items.length && items[i].indent > indent) {
      const sub = buildList(items, i, items[i].indent);
      nested = sub.node;
      i = sub.next;
    }
    out.push({ children, nested });
  }
  return { node: { t: "list", ordered, items: out }, next: i };
}

// ── Bloques ─────────────────────────────────────────────────────────────────

/** Apertura de bloque cercado (captura la etiqueta de lenguaje). */
const FENCE_OPEN_RE = /^```([\w+#.-]*)\s*$/;
/** Cierre de bloque cercado (``` a secas). */
const FENCE_CLOSE_RE = /^```\s*$/;

export function parseMarkdown(text: string): MdBlock[] {
  const lines = (text ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length === 0) return;
    blocks.push({ t: "p", lines: para.map((ln) => parseInline(ln)) });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Bloque de código cercado ```lang … ```
    const fence = FENCE_OPEN_RE.exec(trimmed);
    if (fence) {
      flushPara();
      const lang = fence[1] ?? "";
      const code: string[] = [];
      i++;
      while (i < lines.length && !FENCE_CLOSE_RE.test(lines[i].trim())) {
        code.push(lines[i]);
        i++;
      }
      blocks.push({ t: "codeblock", lang, code: code.join("\n") });
      continue;
    }

    // Línea en blanco → corte de párrafo.
    if (trimmed === "") { flushPara(); continue; }

    // Regla horizontal.
    if (/^(---|\*\*\*|___)\s*$/.test(trimmed)) {
      flushPara();
      blocks.push({ t: "hr" });
      continue;
    }

    // Heading.
    const h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (h) {
      flushPara();
      blocks.push({ t: "heading", level: h[1].length, children: parseInline(h[2]) });
      continue;
    }

    // Tabla GFM: fila con `|` + fila separadora `|---|` en la línea siguiente.
    if (trimmed.includes("|") && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1])) {
      flushPara();
      const header = splitTableRow(trimmed).map((c) => parseInline(c));
      const align = parseAlign(splitTableRow(lines[i + 1]));
      i += 2;
      const rows: MdInline[][][] = [];
      while (i < lines.length && lines[i].trim() !== "" && lines[i].includes("|")) {
        rows.push(splitTableRow(lines[i].trim()).map((c) => parseInline(c)));
        i++;
      }
      i--;
      blocks.push({ t: "table", header, align, rows });
      continue;
    }

    // Blockquote (líneas `> ` consecutivas).
    if (/^>\s?/.test(trimmed)) {
      flushPara();
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quote.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      i--;
      blocks.push({ t: "quote", lines: quote.map((q) => parseInline(q)) });
      continue;
    }

    // Lista (ítems consecutivos, consciente de indentación).
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      flushPara();
      const items: RawItem[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        const lm = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (!lm) break;
        items.push({ indent: Math.floor(lm[1].length / 2), ordered: /\d+\./.test(lm[2]), content: lm[3] });
        i++;
      }
      i--;
      const baseIndent = Math.min(...items.map((it) => it.indent));
      // Normaliza al indent base para que la raíz arranque en 0 relativo.
      blocks.push(buildList(items, 0, baseIndent).node);
      continue;
    }

    para.push(line);
  }
  flushPara();

  return blocks;
}

// ── Parseo INCREMENTAL con caché (streaming del asistente) ───────────────────
//
// PROBLEMA: mientras la IA escribe, la burbuja viva re-parsea el markdown
// ENTERO en CADA token. Una respuesta de 800 deltas parsea un texto que crece →
// O(n²) de trabajo (y O(n²) de basura para el GC) por respuesta: es lo que
// hacía que el chat fuera a tirones.
//
// SOLUCIÓN: partir el texto en un PREFIJO ESTABLE (ya cerrado, cuyo árbol no
// puede cambiar por mucho que siga llegando texto) + un SUFIJO VIVO (lo único
// que hay que re-parsear). El prefijo se cachea y sus bloques se REUTILIZAN con
// la misma identidad de objeto, lo que además deja que `React.memo(BlockView)`
// se salte el re-render de todo lo ya escrito.
//
// INVARIANTE DE CORTE (el porqué de que sea seguro). Un prefijo P es estable si:
//   a) termina en "\n" y su última línea es EN BLANCO, y
//   b) su parseo no deja un fence ``` abierto.
// Entonces, para CUALQUIER sufijo S:
//     parseMarkdown(P + S) === parseMarkdown(P) ++ parseMarkdown(S)
// Razones: (1) la línea en blanco vacía el párrafo pendiente; (2) TODOS los
// bucles que consumen líneas (tabla, cita, lista) paran en una línea en blanco
// — el único que no para es el del bloque de código, y por eso (b) exige que no
// haya fence abierto; (3) el único lookahead del parser es de UNA línea (la
// fila separadora de una tabla GFM), y desde la última línea del prefijo esa
// línea es la línea en blanco, que nunca es separadora. Por tanto ningún bloque
// del prefijo puede cambiar ni crecer con lo que llegue después.
//
// CASOS PELIGROSOS que este invariante cubre por construcción: fence sin cerrar
// (nunca es prefijo estable: se re-parsea entero cada token), tabla a medias
// (sus filas no tienen línea en blanco → viven en el sufijo vivo) y una línea
// `| a | b |` que hoy es párrafo y mañana es cabecera de tabla cuando llegue
// `|---|---|` (mismo motivo). Ver los tests de `markdown-lite.test.ts`.

/**
 * Offset (en caracteres) del final del PREFIJO ESTABLE de `norm`, buscando solo
 * a partir de `start` — que debe ser 0 o el final de un prefijo ya estable.
 * Simula el avance de líneas de `parseMarkdown` (incluido el salto de los
 * bloques cercados) y se queda con la ÚLTIMA línea en blanco que no sea la
 * última línea del texto (esa aún puede crecer con el siguiente token).
 */
export function stableMarkdownBoundary(norm: string, start = 0): number {
  const lines = norm.slice(start).split("\n");
  const n = lines.length;
  // Offset absoluto del inicio de cada línea del segmento.
  const offsets = new Array<number>(n);
  let off = start;
  for (let i = 0; i < n; i++) {
    offsets[i] = off;
    off += lines[i].length + 1; // +1 = el "\n" que la cierra
  }

  let safe = start;
  for (let i = 0; i < n; i++) {
    const trimmed = lines[i].trim();
    // Fence: salta hasta su cierre igual que `parseMarkdown` (el `i++` del for
    // se come la línea de cierre). Sin cierre, consume hasta el final: dentro de
    // un bloque de código NO hay corte estable posible.
    if (FENCE_OPEN_RE.test(trimmed)) {
      i++;
      while (i < n && !FENCE_CLOSE_RE.test(lines[i].trim())) i++;
      continue;
    }
    // Línea en blanco → corte estable justo después. `i < n - 1` deja SIEMPRE la
    // última línea (la que el stream está escribiendo) fuera del prefijo.
    if (trimmed === "" && i < n - 1) safe = offsets[i + 1];
  }
  return safe;
}

type Lru = Map<string, MdBlock[]>;

/** Texto completo → árbol (identidad estable para `useMemo`/`React.memo`). */
const FULL_CACHE: Lru = new Map();
/** Prefijo ESTABLE → árbol ya cerrado, reutilizado token a token. */
const STABLE_CACHE: Lru = new Map();
const FULL_MAX = 12;
const STABLE_MAX = 6;

function lruGet(cache: Lru, key: string): MdBlock[] | undefined {
  const hit = cache.get(key);
  if (hit === undefined) return undefined;
  cache.delete(key);
  cache.set(key, hit); // refresca la posición (Map mantiene orden de inserción)
  return hit;
}

function lruSet(cache: Lru, key: string, value: MdBlock[], max: number): void {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > max) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Prefijo estable cacheado MÁS LARGO que sea prefijo de `norm` (la cadena del
 *  mismo mensaje mientras crece). Todas las claves de `STABLE_CACHE` cumplen el
 *  invariante de corte, así que reanudar desde cualquiera de ellas es correcto
 *  sea cual sea el resto del texto. */
function longestStable(norm: string): { key: string; blocks: MdBlock[] } | null {
  let key = "";
  let blocks: MdBlock[] | null = null;
  for (const [k, v] of STABLE_CACHE) {
    if (k.length > key.length && k.length <= norm.length && norm.startsWith(k)) {
      key = k;
      blocks = v;
    }
  }
  return blocks ? { key, blocks } : null;
}

/** Árbol de un prefijo estable, construido a su vez desde el prefijo estable
 *  anterior (así la cadena completa del stream se parsea UNA sola vez). */
function stableBlocks(prefix: string, base: { key: string; blocks: MdBlock[] } | null): MdBlock[] {
  const hit = lruGet(STABLE_CACHE, prefix);
  if (hit) return hit;
  const blocks = base && base.key.length < prefix.length && prefix.startsWith(base.key)
    ? base.blocks.concat(parseMarkdown(prefix.slice(base.key.length)))
    : parseMarkdown(prefix);
  // El prefijo nuevo SUPERSEDE a los suyos propios (mismo mensaje, ya crecido):
  // borrarlos evita guardar N copias del mismo texto en la caché.
  for (const k of [...STABLE_CACHE.keys()]) {
    if (k.length < prefix.length && prefix.startsWith(k)) STABLE_CACHE.delete(k);
  }
  lruSet(STABLE_CACHE, prefix, blocks, STABLE_MAX);
  return blocks;
}

/**
 * `parseMarkdown` memoizado + incremental. Devuelve EXACTAMENTE lo mismo que
 * `parseMarkdown(text)` (los tests lo verifican token a token); lo único que
 * cambia es el coste: mientras la IA escribe solo se re-parsea el último bloque
 * a medias, no el mensaje entero.
 */
export function parseMarkdownCached(text: string): MdBlock[] {
  const src = text ?? "";
  const cached = lruGet(FULL_CACHE, src);
  if (cached) return cached;

  // Misma normalización que `parseMarkdown` para que cortar por offset sea
  // exacto (los offsets se calculan sobre el texto YA normalizado).
  const norm = src.includes("\r") ? src.replace(/\r\n/g, "\n") : src;

  const base = longestStable(norm);
  const bound = stableMarkdownBoundary(norm, base ? base.key.length : 0);
  let head: MdBlock[];
  if (bound === 0) head = [];
  else if (base && bound === base.key.length) head = base.blocks;
  else head = stableBlocks(norm.slice(0, bound), base);

  // `concat` siempre devuelve un array NUEVO: los bloques del prefijo se
  // comparten por identidad (bueno para `React.memo`) pero nunca se mutan.
  const blocks = head.concat(parseMarkdown(norm.slice(bound)));
  lruSet(FULL_CACHE, src, blocks, FULL_MAX);
  return blocks;
}

/** Solo para tests: vacía las cachés para poder medir el camino frío. */
export function __resetMarkdownCache(): void {
  FULL_CACHE.clear();
  STABLE_CACHE.clear();
}
