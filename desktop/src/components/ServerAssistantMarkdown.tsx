/**
 * Markdown ligero para las burbujas del asistente del servidor — port directo
 * del renderer regex de LUXIPANEL (`floating-assistant/Markdown.tsx` +
 * `MessageContent.tsx`), sin librerías. Cubre el subset que emiten los
 * asistentes: headings, negrita, cursiva, código inline, tachado, enlaces,
 * listas (anidadas), blockquotes, hr y saltos de línea.
 *
 * Los bloques ```cercados``` se separan aquí mismo (MessageContent) y se
 * renderizan con `CodeBlock` (header de lenguaje + Copiar, <pre> scrollable;
 * NO Monaco — en la tarjeta del carousel no amerita cargar el editor).
 */
import { Fragment, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

export type MarkdownLabels = { copy: string; copied: string };

// ── Inline ──────────────────────────────────────────────────────────────────
// El orden importa: código primero (para no formatear dentro), luego enlaces,
// luego énfasis. Tokenizamos buscando la coincidencia más temprana por pasada.
const INLINE = [
  { re: /`([^`]+)`/, render: (m: RegExpExecArray, k: number) => <code key={k} className="rounded bg-black/10 dark:bg-white/10 px-1 py-0.5 font-mono text-[0.85em] break-words">{m[1]}</code> },
  { re: /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/, render: (m: RegExpExecArray, k: number) => <a key={k} href={m[2]} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 break-all hover:opacity-80">{m[1]}</a> },
  { re: /\*\*([^*]+)\*\*/, render: (m: RegExpExecArray, k: number) => <strong key={k}>{renderInline(m[1])}</strong> },
  { re: /__([^_]+)__/, render: (m: RegExpExecArray, k: number) => <strong key={k}>{renderInline(m[1])}</strong> },
  { re: /~~([^~]+)~~/, render: (m: RegExpExecArray, k: number) => <del key={k}>{renderInline(m[1])}</del> },
  { re: /\*([^*\n]+)\*/, render: (m: RegExpExecArray, k: number) => <em key={k}>{renderInline(m[1])}</em> },
  { re: /(?<![A-Za-z0-9])_([^_\n]+)_(?![A-Za-z0-9])/, render: (m: RegExpExecArray, k: number) => <em key={k}>{renderInline(m[1])}</em> },
];

function renderInline(text: string): ReactNode {
  if (!text) return null;
  let best: { idx: number; rule: (typeof INLINE)[number]; m: RegExpExecArray } | null = null;
  for (const rule of INLINE) {
    const m = rule.re.exec(text);
    if (m && (best === null || m.index < best.idx)) best = { idx: m.index, rule, m };
  }
  if (!best) return text;
  const { idx, rule, m } = best;
  return (
    <>
      {idx > 0 && text.slice(0, idx)}
      {rule.render(m, idx)}
      {renderInline(text.slice(idx + m[0].length))}
    </>
  );
}

// ── Block ────────────────────────────────────────────────────────────────────
interface ListItem { indent: number; ordered: boolean; content: string }

function renderList(items: ListItem[], from: number, indent: number, keyBase: string): { node: ReactNode; next: number } {
  const ordered = items[from].ordered;
  const children: ReactNode[] = [];
  let i = from;
  while (i < items.length && items[i].indent === indent && items[i].ordered === ordered) {
    const content = renderInline(items[i].content);
    const liKey = `${keyBase}-li-${i}`;
    i++;
    let nested: ReactNode = null;
    if (i < items.length && items[i].indent > indent) {
      const sub = renderList(items, i, items[i].indent, `${keyBase}-${i}`);
      nested = sub.node;
      i = sub.next;
    }
    children.push(<li key={liKey}>{content}{nested}</li>);
  }
  const node = ordered
    ? <ol key={keyBase} className="list-decimal my-1 ml-5 space-y-0.5">{children}</ol>
    : <ul key={keyBase} className="list-disc my-1 ml-5 space-y-0.5">{children}</ul>;
  return { node, next: i };
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let key = 0;

  const flushPara = () => {
    if (para.length === 0) return;
    const joined = para.join("\n");
    blocks.push(
      <p key={`p-${key++}`} className="my-1 leading-relaxed whitespace-pre-wrap break-words">
        {joined.split("\n").map((ln, j) => (
          <Fragment key={j}>{j > 0 && <br />}{renderInline(ln)}</Fragment>
        ))}
      </p>,
    );
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") { flushPara(); continue; }

    if (/^(---|\*\*\*|___)\s*$/.test(trimmed)) {
      flushPara();
      blocks.push(<hr key={`hr-${key++}`} className="my-2 border-black/15 dark:border-white/15" />);
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (h) {
      flushPara();
      const level = h[1].length;
      const size = level <= 1 ? "text-base" : level === 2 ? "text-sm" : "text-[0.95em]";
      blocks.push(<p key={`h-${key++}`} className={`mt-2 mb-1 font-semibold ${size} break-words`}>{renderInline(h[2])}</p>);
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      flushPara();
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quote.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      i--;
      blocks.push(
        <blockquote key={`q-${key++}`} className="my-1 border-l-2 border-black/20 dark:border-white/20 pl-3 opacity-80 break-words">
          {quote.map((q, j) => <Fragment key={j}>{j > 0 && <br />}{renderInline(q)}</Fragment>)}
        </blockquote>,
      );
      continue;
    }

    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      flushPara();
      const items: ListItem[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        const lm = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (!lm) break;
        items.push({ indent: Math.floor(lm[1].length / 2), ordered: /\d+\./.test(lm[2]), content: lm[3] });
        i++;
      }
      i--;
      const baseIndent = Math.min(...items.map((it) => it.indent));
      const { node } = renderList(items, 0, baseIndent, `l-${key++}`);
      blocks.push(node);
      continue;
    }

    para.push(line);
  }
  flushPara();

  return <div className="space-y-0.5">{blocks}</div>;
}

// ── Code block ───────────────────────────────────────────────────────────────
/**
 * Contenedor de código de solo lectura para las respuestas. Header con el
 * lenguaje + botón Copiar→Copiado y <pre> scrollable acotado (~360px). Oscuro
 * en ambos temas, como toda consola del pane (mismo criterio que LUXIPANEL).
 */
export function CodeBlock({ code, lang, labels }: { code: string; lang: string; labels: MarkdownLabels }) {
  const [copied, setCopied] = useState(false);
  const language = (lang || "plaintext").toLowerCase();

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard bloqueado */
    }
  }

  return (
    <div className="my-2 rounded-lg border border-black/30 overflow-hidden bg-[#1e1e1e]">
      <div className="flex items-center justify-between bg-black/40 px-2.5 py-1 text-[10px]">
        <span className="font-mono uppercase tracking-wide text-[#9aa4b2]">{language}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[#9aa4b2] hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
          {copied ? labels.copied : labels.copy}
        </button>
      </div>
      <pre className="overflow-auto max-h-[360px] px-3 py-2 text-[12px] leading-snug text-[#d4d4d4] font-mono whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

// ── MessageContent ───────────────────────────────────────────────────────────
interface Segment { type: "text" | "code"; content: string; lang?: string }

function parse(text: string): Segment[] {
  const segments: Segment[] = [];
  const fence = /```([\w+-]*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(text)) !== null) {
    if (m.index > last) segments.push({ type: "text", content: text.slice(last, m.index) });
    segments.push({ type: "code", lang: m[1] || "", content: (m[2] ?? "").replace(/\n$/, "") });
    last = fence.lastIndex;
  }
  if (last < text.length) segments.push({ type: "text", content: text.slice(last) });
  if (segments.length === 0) segments.push({ type: "text", content: text });
  return segments;
}

/** Texto del mensaje: separa los bloques ```cercados``` y deja el resto en Markdown. */
export function MessageContent({ text, labels }: { text: string; labels: MarkdownLabels }) {
  if (!text.includes("```")) return <Markdown text={text} />;
  const segments = parse(text);
  return (
    <>
      {segments.map((s, i) =>
        s.type === "code" ? (
          <CodeBlock key={i} code={s.content} lang={s.lang ?? ""} labels={labels} />
        ) : (
          s.content.trim() && <Markdown key={i} text={s.content} />
        ),
      )}
    </>
  );
}
