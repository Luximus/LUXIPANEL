// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tiny, dependency-free Markdown renderer for chat bubbles. The project has no
 * markdown library bundled, and pulling one in for chat text would bloat the
 * client, so this covers the subset assistants actually emit: headings, bold,
 * italic, inline code, strikethrough, links, ordered/unordered (nested) lists,
 * blockquotes, horizontal rules and proper line breaks.
 *
 * Fenced ```code``` blocks are split out upstream by MessageContent and rendered
 * with the Monaco CodeBlock, so this renderer never sees them.
 */
import { Fragment, type ReactNode } from "react";

// ── Inline ──────────────────────────────────────────────────────────────────
// Order matters: code first (so we don't format inside it), then links, then
// emphasis. We tokenise by scanning for the earliest match each pass.
const INLINE: { re: RegExp; render: (match: RegExpExecArray, key: number, revealWords: boolean) => ReactNode }[] = [
  { re: /`([^`]+)`/, render: (m: RegExpExecArray, k: number) => <code key={k} className="rounded bg-black/10 dark:bg-white/10 px-1 py-0.5 font-mono text-[0.85em] break-words">{m[1]}</code> },
  { re: /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/, render: (m: RegExpExecArray, k: number) => <a key={k} href={m[2]} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 break-all hover:opacity-80">{m[1]}</a> },
  { re: /\*\*([^*]+)\*\*/, render: (m, k, revealWords) => <strong key={k}>{renderInline(m[1], revealWords)}</strong> },
  { re: /(?<![A-Za-z0-9])__([^_]+)__(?![A-Za-z0-9])/, render: (m, k, revealWords) => <strong key={k}>{renderInline(m[1], revealWords)}</strong> },
  { re: /~~([^~]+)~~/, render: (m, k, revealWords) => <del key={k}>{renderInline(m[1], revealWords)}</del> },
  { re: /\*([^*\n]+)\*/, render: (m, k, revealWords) => <em key={k}>{renderInline(m[1], revealWords)}</em> },
  { re: /(?<![A-Za-z0-9])_([^_\n]+)_(?![A-Za-z0-9])/, render: (m, k, revealWords) => <em key={k}>{renderInline(m[1], revealWords)}</em> },
];

function renderWords(text: string): ReactNode {
  return text.split(/(\s+)/).map((part, index) => /^\s+$/.test(part) || !part
    ? part
    : <span key={index} data-scroll-reveal-word="">{part}</span>);
}

function renderInline(text: string, revealWords = false): ReactNode {
  if (!text) return null;
  // Find the earliest-matching inline rule and recurse on the surrounding text.
  let best: { idx: number; rule: (typeof INLINE)[number]; m: RegExpExecArray } | null = null;
  for (const rule of INLINE) {
    const m = rule.re.exec(text);
    if (m && (best === null || m.index < best.idx)) best = { idx: m.index, rule, m };
  }
  if (!best) return revealWords ? renderWords(text) : text;
  const { idx, rule, m } = best;
  return (
    <>
      {idx > 0 && (revealWords ? renderWords(text.slice(0, idx)) : text.slice(0, idx))}
      {rule.render(m, idx, revealWords)}
      {renderInline(text.slice(idx + m[0].length), revealWords)}
    </>
  );
}

// ── Block ─────────────────────────────────────────────────────────────────--
interface ListItem { indent: number; ordered: boolean; content: string }

function renderList(items: ListItem[], from: number, indent: number, keyBase: string, revealWords: boolean, revealBlocks: boolean): { node: ReactNode; next: number } {
  const ordered = items[from].ordered;
  const children: ReactNode[] = [];
  let i = from;
  while (i < items.length && items[i].indent === indent && items[i].ordered === ordered) {
    const content = renderInline(items[i].content, revealWords);
    const liKey = `${keyBase}-li-${i}`;
    i++;
    // Deeper items that follow belong to this <li> as a nested list.
    let nested: ReactNode = null;
    if (i < items.length && items[i].indent > indent) {
      const sub = renderList(items, i, items[i].indent, `${keyBase}-${i}`, revealWords, revealBlocks);
      nested = sub.node;
      i = sub.next;
    }
    children.push(<li key={liKey} data-scroll-reveal-block={revealBlocks ? "" : undefined}>{content}{nested}</li>);
  }
  const cls = ordered ? "list-decimal" : "list-disc";
  const node = ordered
    ? <ol key={keyBase} className={`${cls} my-1 ml-5 space-y-0.5`}>{children}</ol>
    : <ul key={keyBase} className={`${cls} my-1 ml-5 space-y-0.5`}>{children}</ul>;
  return { node, next: i };
}

// ── Tables ─────────────────────────────────────────────────────────────────-
// GitHub-flavoured markdown tables. Codex / Gemini / DeepSeek / MiniMax emit
// these often; without this pass the rows render as raw `|` text — which is
// what the user reports as the "fe o" reload of those chats. The matching
// shape is: a header line with `|`, followed by a separator line of `---`
// (optionally with `:` for alignment), then any number of data rows.

type Align = "left" | "center" | "right" | null;

function parseTableSeparator(line: string): Align[] | null {
  // Strip leading/trailing pipes, then split by remaining `|`.
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = trimmed.split("|").map((c) => c.trim());
  if (cells.length === 0) return null;
  // Every cell must match `:-{1,}|:-+:|---+:` etc. (no other content).
  const re = /^(:?)(-+)(:?)$/;
  const aligns: Align[] = [];
  for (const c of cells) {
    const m = re.exec(c);
    if (!m) return null;
    const left = m[1] === ":";
    const right = m[3] === ":";
    aligns.push(left && right ? "center" : right ? "right" : left ? "left" : null);
  }
  return aligns;
}

function splitTableRow(line: string): string[] {
  // Outer pipes are optional; strip them, then split on the remaining `|`.
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

function renderTable(header: string[], aligns: Align[], rows: string[][], keyBase: string, revealWords: boolean, revealBlocks: boolean): ReactNode {
  const alignClass = (a: Align) =>
    a === "center" ? "text-center" : a === "right" ? "text-right" : a === "left" ? "text-left" : "text-left";
  return (
    <div key={keyBase} className="my-2 overflow-x-auto rounded-md border border-border/60">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-muted/40">
            {header.map((h, i) => (
              <th
                key={`h-${i}`}
                data-scroll-reveal-block={revealBlocks ? "" : undefined}
                className={`border-b border-border/60 px-2 py-1 font-semibold ${alignClass(aligns[i])}`}
              >
                {renderInline(h, revealWords)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={`r-${ri}`} className="odd:bg-background even:bg-muted/15">
              {r.map((c, ci) => (
                <td
                  key={`c-${ri}-${ci}`}
                  data-scroll-reveal-block={revealBlocks ? "" : undefined}
                  className={`border-b border-border/40 px-2 py-1 align-top ${alignClass(aligns[ci])}`}
                >
                  {/* Cells can contain newlines / inline markdown — preserve. */}
                  {c.split("\n").map((ln, j) => (
                    <Fragment key={j}>{j > 0 && <br />}{renderInline(ln, revealWords)}</Fragment>
                  ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Markdown({ text, revealWords = false, revealBlocks = revealWords }: { text: string; revealWords?: boolean; revealBlocks?: boolean }) {
  // Defensive: a missing text used to crash here with
  // "Cannot read properties of undefined (reading 'replace')". Treat as empty.
  const safe = typeof text === "string" ? text : "";
  const lines = safe.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let key = 0;

  const flushPara = () => {
    if (para.length === 0) return;
    const joined = para.join("\n");
    blocks.push(
      <p key={`p-${key++}`} data-scroll-reveal-block={revealBlocks ? "" : undefined} className="my-1 leading-relaxed whitespace-pre-wrap break-words">
        {joined.split("\n").map((ln, j) => (
          <Fragment key={j}>{j > 0 && <br />}{renderInline(ln, revealWords)}</Fragment>
        ))}
      </p>,
    );
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Blank line → paragraph break.
    if (trimmed === "") { flushPara(); continue; }

    // Horizontal rule.
    if (/^(---|\*\*\*|___)\s*$/.test(trimmed)) {
      flushPara();
      blocks.push(<hr key={`hr-${key++}`} className="my-2 border-border/60" />);
      continue;
    }

    // Heading.
    const h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (h) {
      flushPara();
      const level = h[1].length;
      const size = level <= 1 ? "text-base" : level === 2 ? "text-sm" : "text-[0.95em]";
      blocks.push(<p key={`h-${key++}`} data-scroll-reveal-block={revealBlocks ? "" : undefined} className={`mt-2 mb-1 font-semibold ${size} break-words`}>{renderInline(h[2], revealWords)}</p>);
      continue;
    }

    // Blockquote (collect consecutive `> ` lines).
    if (/^>\s?/.test(trimmed)) {
      flushPara();
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quote.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      i--;
      blocks.push(
        <blockquote key={`q-${key++}`} data-scroll-reveal-block={revealBlocks ? "" : undefined} className="my-1 border-l-2 border-border pl-3 text-muted-foreground break-words">
          {quote.map((q, j) => <Fragment key={j}>{j > 0 && <br />}{renderInline(q, revealWords)}</Fragment>)}
        </blockquote>,
      );
      continue;
    }

    // Markdown table: header row → separator row → 0+ data rows. Must run
    // BEFORE the list detector because rows are pure `| foo | bar |` (no
    // marker prefix) and we want to consume them in one go.
    if (
      trimmed.includes("|") &&
      i + 1 < lines.length &&
      parseTableSeparator(lines[i + 1].trim()) !== null
    ) {
      flushPara();
      const header = splitTableRow(line);
      const aligns = parseTableSeparator(lines[i + 1].trim())!;
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes("|") && lines[i].trim() !== "") {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      i--;
      blocks.push(renderTable(header, aligns, rows, `tbl-${key++}`, revealWords, revealBlocks));
      continue;
    }

    // List (collect consecutive list items, indentation-aware).
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
      const { node } = renderList(items, 0, baseIndent, `l-${key++}`, revealWords, revealBlocks);
      blocks.push(node);
      continue;
    }

    para.push(line);
  }
  flushPara();

  return <div className="space-y-0.5">{blocks}</div>;
}
