/**
 * Parser HTML "lite" para el cuerpo de los posts del blog. Convierte el HTML
 * SANEADO por el backend (`sanitizeBlogHtml`, whitelist cerrada de tags) en el
 * mismo árbol de bloques de `markdown-lite`, más dos bloques propios (imagen y
 * embed de video), para renderizarlo 100% nativo con `HtmlView` — sin WebView.
 *
 * Mismo patrón que `markdown-lite`:
 *   1. ESTE módulo: parser PURO (sin imports de RN) — testeable en vitest.
 *   2. `components/HtmlView.tsx`: componente RN que pinta el árbol (delega los
 *      MdBlock en el renderer de `MarkdownView`).
 *
 * Whitelist del backend (blog-ai.service.ts): p, br, h1–h4, ul, ol, li,
 * strong/b, em/i, u, s, blockquote, a, code, pre, img, hr, span, figure,
 * figcaption e iframe (solo YouTube/Vimeo). Todo lo demás ya viene eliminado,
 * así que aquí basta con ignorar lo desconocido (defensa en profundidad).
 */
import type { MdBlock, MdInline, MdList, MdListItem } from "./markdown-lite";

// ── Árbol público ────────────────────────────────────────────────────────────

export type HtmlImageBlock = { t: "image"; src: string; alt: string; caption: string | null };
/** Embed de video (iframe YouTube/Vimeo): se pinta como tarjeta que abre el navegador. */
export type HtmlEmbedBlock = { t: "embed"; src: string; title: string | null };
export type HtmlBlock = MdBlock | HtmlImageBlock | HtmlEmbedBlock;

// ── Tokenizador → árbol DOM-lite ─────────────────────────────────────────────

type ElNode = { kind: "el"; tag: string; attrs: Record<string, string>; children: DomNode[] };
type TextNode = { kind: "text"; text: string };
type DomNode = ElNode | TextNode;

const VOID_TAGS = new Set(["br", "hr", "img"]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0",
  ndash: "–", mdash: "—", hellip: "…",
  ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
  copy: "©", reg: "®", trade: "™", deg: "°", middot: "·", bull: "•",
  laquo: "«", raquo: "»", iexcl: "¡", iquest: "¿", sect: "§", para: "¶",
  euro: "€", pound: "£", yen: "¥", cent: "¢",
  times: "×", divide: "÷", plusmn: "±", minus: "−",
  frac12: "½", frac14: "¼", frac34: "¾", sup1: "¹", sup2: "²", sup3: "³",
  larr: "←", rarr: "→", uarr: "↑", darr: "↓", harr: "↔",
  dagger: "†", Dagger: "‡", permil: "‰", prime: "′", Prime: "″",
  // Letras acentuadas Latin-1 (posts en ES/FR/DE/PT): el navegador (web) las
  // decodifica todas; sin esta tabla la app pintaba "&eacute;" literal.
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", yacute: "ý",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Yacute: "Ý",
  agrave: "à", egrave: "è", igrave: "ì", ograve: "ò", ugrave: "ù",
  Agrave: "À", Egrave: "È", Igrave: "Ì", Ograve: "Ò", Ugrave: "Ù",
  acirc: "â", ecirc: "ê", icirc: "î", ocirc: "ô", ucirc: "û",
  Acirc: "Â", Ecirc: "Ê", Icirc: "Î", Ocirc: "Ô", Ucirc: "Û",
  auml: "ä", euml: "ë", iuml: "ï", ouml: "ö", uuml: "ü", yuml: "ÿ",
  Auml: "Ä", Euml: "Ë", Iuml: "Ï", Ouml: "Ö", Uuml: "Ü",
  atilde: "ã", ntilde: "ñ", otilde: "õ",
  Atilde: "Ã", Ntilde: "Ñ", Otilde: "Õ",
  ccedil: "ç", Ccedil: "Ç", szlig: "ß",
  aring: "å", Aring: "Å", aelig: "æ", AElig: "Æ", oslash: "ø", Oslash: "Ø",
  eth: "ð", ETH: "Ð", thorn: "þ", THORN: "Þ", oelig: "œ", OElig: "Œ",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, body: string) => {
    if (body[0] === "#") {
      const hex = body[1] === "x" || body[1] === "X";
      const code = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      // Fuera de rango Unicode (>0x10FFFF) String.fromCodePoint LANZA RangeError
      // → un solo `&#999999999;` tumbaría la pantalla entera; se deja crudo.
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[body] ?? m;
  });
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z][a-zA-Z0-9-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

/** HTML saneado → árbol de nodos. Tolerante: cierres desbalanceados se resuelven
 *  desapilando hasta el tag más cercano (o ignorando el cierre huérfano). */
export function parseHtmlTree(html: string): DomNode[] {
  const root: ElNode = { kind: "el", tag: "#root", attrs: {}, children: [] };
  const stack: ElNode[] = [root];
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const pushText = (raw: string) => {
    if (!raw) return;
    const text = decodeEntities(raw);
    if (text) stack[stack.length - 1].children.push({ kind: "text", text });
  };
  while ((m = tagRe.exec(html))) {
    pushText(html.slice(last, m.index));
    last = m.index + m[0].length;
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    if (closing) {
      for (let i = stack.length - 1; i >= 1; i--) {
        if (stack[i].tag === tag) { stack.length = i; break; }
      }
      continue;
    }
    const node: ElNode = { kind: "el", tag, attrs: m[3] ? parseAttrs(m[3]) : {}, children: [] };
    stack[stack.length - 1].children.push(node);
    const selfClosed = /\/\s*$/.test(m[3] ?? "");
    if (!VOID_TAGS.has(tag) && !selfClosed) stack.push(node);
  }
  pushText(html.slice(last));
  return root.children;
}

// ── Árbol DOM-lite → bloques ─────────────────────────────────────────────────

const INLINE_WRAPPERS: Record<string, "bold" | "italic" | "strike" | "u"> = {
  strong: "bold", b: "bold", em: "italic", i: "italic", s: "strike", u: "u",
};

function flatText(nodes: DomNode[]): string {
  let out = "";
  for (const n of nodes) {
    if (n.kind === "text") out += n.text;
    else if (n.tag === "br") out += "\n";
    else out += flatText(n.children);
  }
  return out;
}

/** Trozo del flujo inline: o líneas de texto, o un bloque de media que apareció
 *  en medio del flujo y debe emitirse EN SU POSICIÓN (orden del documento). */
type InlineChunk =
  | { kind: "lines"; lines: MdInline[][] }
  | { kind: "block"; block: HtmlBlock };

/** Recolecta inlines partiendo en líneas por `<br>`. Los `img`/`iframe` que
 *  aparezcan en medio del flujo (incluso envueltos en `<a>`) cortan el chunk de
 *  líneas y salen como bloque propio en su posición, nunca antes de su texto. */
function collectInlineChunks(nodes: DomNode[]): InlineChunk[] {
  const chunks: InlineChunk[] = [];
  let lines: MdInline[][] = [[]];
  const flushLines = () => {
    const trimmed = lines.map((ln) => trimInlineLine(ln)).filter((ln) => ln.length > 0);
    if (trimmed.length) chunks.push({ kind: "lines", lines: trimmed });
    lines = [[]];
  };
  const pushBlock = (block: HtmlBlock | null) => {
    if (!block) return;
    flushLines();
    chunks.push({ kind: "block", block });
  };
  const walk = (ns: DomNode[], wrap: (children: MdInline[]) => MdInline[]) => {
    for (const n of ns) {
      if (n.kind === "text") {
        const text = n.text.replace(/\s+/g, " ");
        if (text) lines[lines.length - 1].push(...wrap([{ t: "text", text }]));
        continue;
      }
      switch (n.tag) {
        case "br":
          lines.push([]);
          break;
        case "img":
          pushBlock(imageBlock(n, null));
          break;
        case "iframe":
          pushBlock(embedBlock(n, null));
          break;
        case "code": {
          const text = flatText(n.children);
          if (text) lines[lines.length - 1].push(...wrap([{ t: "code", text }]));
          break;
        }
        case "a": {
          // La media envuelta (<a><img/></a>, patrón típico de TipTap) se
          // hoistea como bloque; solo el texto restante queda como link.
          const href = n.attrs.href ?? "";
          let buf = "";
          const flushLink = () => {
            const text = buf.replace(/\s+/g, " ").trim();
            buf = "";
            if (text) lines[lines.length - 1].push(...wrap([{ t: "link", text, href }]));
          };
          const walkLink = (cs: DomNode[]) => {
            for (const c of cs) {
              if (c.kind === "text") { buf += c.text; continue; }
              if (c.tag === "img") { flushLink(); pushBlock(imageBlock(c, null)); continue; }
              if (c.tag === "iframe") { flushLink(); pushBlock(embedBlock(c, null)); continue; }
              if (c.tag === "br") { buf += " "; continue; }
              walkLink(c.children);
            }
          };
          walkLink(n.children);
          flushLink();
          break;
        }
        default: {
          const kind = INLINE_WRAPPERS[n.tag];
          if (kind) walk(n.children, (children) => wrap([{ t: kind, children } as MdInline]));
          else walk(n.children, wrap); // span y desconocidos: passthrough
        }
      }
    }
  };
  walk(nodes, (c) => c);
  flushLines();
  return chunks;
}

/** Variante para bloques que no admiten partirse (heading/quote/li): devuelve
 *  las líneas juntas y difiere la media interna vía `deferred`, que el caller
 *  emite justo DESPUÉS del bloque contenedor. */
function collectInlineLines(nodes: DomNode[], deferred: HtmlBlock[]): MdInline[][] {
  const lines: MdInline[][] = [];
  for (const chunk of collectInlineChunks(nodes)) {
    if (chunk.kind === "block") deferred.push(chunk.block);
    else lines.push(...chunk.lines);
  }
  return lines;
}

/** Emite el flujo inline como párrafos intercalados con su media, en orden. */
function emitParagraphChunks(nodes: DomNode[], out: HtmlBlock[]): void {
  for (const chunk of collectInlineChunks(nodes)) {
    if (chunk.kind === "block") out.push(chunk.block);
    else out.push({ t: "p", lines: chunk.lines });
  }
}

function trimInlineLine(line: MdInline[]): MdInline[] {
  // Fusiona textos adyacentes (p. ej. alrededor de una imagen hoisteada)
  // colapsando el espacio duplicado en la unión.
  const out: MdInline[] = [];
  for (const n of line) {
    const prev = out[out.length - 1];
    if (n.t === "text" && prev?.t === "text") {
      prev.text = (prev.text + n.text).replace(/\s{2,}/g, " ");
      continue;
    }
    out.push(n);
  }
  const first = out[0];
  if (first?.t === "text") {
    first.text = first.text.replace(/^\s+/, "");
    if (!first.text) out.shift();
  }
  const lastN = out[out.length - 1];
  if (lastN?.t === "text") {
    lastN.text = lastN.text.replace(/\s+$/, "");
    if (!lastN.text) out.pop();
  }
  return out;
}

function imageBlock(img: ElNode, caption: string | null): HtmlImageBlock | null {
  const src = img.attrs.src ?? "";
  return src ? { t: "image", src, alt: img.attrs.alt ?? "", caption } : null;
}

/** El caption (figcaption) tiene prioridad sobre el `title` del iframe. */
function embedBlock(iframe: ElNode, caption: string | null): HtmlEmbedBlock | null {
  const src = iframe.attrs.src ?? "";
  return src ? { t: "embed", src, title: caption || iframe.attrs.title || null } : null;
}

function findFirst(nodes: DomNode[], tag: string): ElNode | null {
  for (const n of nodes) {
    if (n.kind !== "el") continue;
    if (n.tag === tag) return n;
    const inner = findFirst(n.children, tag);
    if (inner) return inner;
  }
  return null;
}

function listFrom(el: ElNode, deferred: HtmlBlock[]): MdList {
  const items: MdListItem[] = [];
  for (const child of el.children) {
    if (child.kind !== "el" || child.tag !== "li") continue;
    const inlineNodes: DomNode[] = [];
    let nested: MdList | null = null;
    for (const c of child.children) {
      if (c.kind === "el" && (c.tag === "ul" || c.tag === "ol")) nested = listFrom(c, deferred);
      else inlineNodes.push(c);
    }
    // TipTap envuelve el contenido del <li> en <p>; se aplana a una sola línea.
    const lines = collectInlineLines(inlineNodes, deferred);
    const children = lines.flatMap((ln, i) => (i > 0 ? [{ t: "text", text: " " } as MdInline, ...ln] : ln));
    items.push({ children, nested });
  }
  return { t: "list", ordered: el.tag === "ol", items };
}

function blockFrom(node: DomNode, out: HtmlBlock[]): void {
  if (node.kind === "text") {
    emitParagraphChunks([node], out);
    return;
  }
  switch (node.tag) {
    case "p": case "span": {
      // El párrafo se parte alrededor de su media para preservar el orden:
      // '<p>Antes <img/> después</p>' → [p "Antes", image, p "después"].
      emitParagraphChunks(node.children, out);
      return;
    }
    case "h1": case "h2": case "h3": case "h4": {
      const deferred: HtmlBlock[] = [];
      const lines = collectInlineLines(node.children, deferred);
      const children = lines.flat();
      if (children.length) out.push({ t: "heading", level: Number(node.tag[1]), children });
      out.push(...deferred);
      return;
    }
    case "ul": case "ol": {
      const deferred: HtmlBlock[] = [];
      const list = listFrom(node, deferred);
      out.push(list, ...deferred);
      return;
    }
    case "blockquote": {
      const deferred: HtmlBlock[] = [];
      const lines: MdInline[][] = [];
      for (const c of node.children) {
        if (c.kind === "el" && (c.tag === "p" || c.tag === "blockquote")) {
          lines.push(...collectInlineLines(c.children, deferred));
        } else {
          lines.push(...collectInlineLines([c], deferred));
        }
      }
      if (lines.length) out.push({ t: "quote", lines });
      out.push(...deferred);
      return;
    }
    case "pre": {
      // El saneador no conserva clases en <code>, así que no hay lenguaje.
      const code = flatText(node.children).replace(/^\n+|\s+$/g, "");
      if (code) out.push({ t: "codeblock", lang: "", code });
      return;
    }
    case "hr":
      out.push({ t: "hr" });
      return;
    case "img": {
      const block = imageBlock(node, null);
      if (block) out.push(block);
      return;
    }
    case "iframe": {
      const block = embedBlock(node, null);
      if (block) out.push(block);
      return;
    }
    case "figure": {
      const caption = (() => {
        const fc = findFirst(node.children, "figcaption");
        const text = fc ? flatText(fc.children).replace(/\s+/g, " ").trim() : "";
        return text || null;
      })();
      const img = findFirst(node.children, "img");
      if (img) {
        const block = imageBlock(img, caption);
        if (block) out.push(block);
        return;
      }
      const iframe = findFirst(node.children, "iframe");
      if (iframe) {
        const block = embedBlock(iframe, caption);
        if (block) out.push(block);
        return;
      }
      // figure sin media: trata el contenido como párrafo.
      emitParagraphChunks(node.children, out);
      return;
    }
    default: {
      // Tag fuera de whitelist (no debería llegar): rescata su texto plano.
      emitParagraphChunks(node.kind === "el" ? node.children : [node], out);
    }
  }
}

/** HTML saneado del blog → bloques nativos listos para `HtmlView`. */
export function parseBlogHtml(html: string): HtmlBlock[] {
  const out: HtmlBlock[] = [];
  for (const node of parseHtmlTree(html)) {
    if (node.kind === "text" && !node.text.trim()) continue;
    blockFrom(node, out);
  }
  return out;
}
