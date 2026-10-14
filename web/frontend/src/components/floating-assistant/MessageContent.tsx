// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Renders chat message text, splitting fenced ```code``` blocks into nice
 * read-only CodeBlock containers and leaving the rest as plain text.
 */
import { CodeBlock } from "./CodeBlock";
import { Markdown } from "./Markdown";
import { ChatScrollReveal } from "./chat-pane/reactbits/ChatScrollReveal";
import { memo, type RefObject } from "react";

interface Segment {
  type: "text" | "code";
  content: string;
  lang?: string;
}

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

export const MessageContent = memo(function MessageContent({ text, scrollContainerRef, streaming = false }: {
  text: string;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  streaming?: boolean;
}) {
  // Defensive: a missing text used to crash Markdown with
  // "Cannot read properties of undefined (reading 'replace')" when an upstream
  // turn carried an undefined body (e.g. a streamed chunk that landed empty).
  if (typeof text !== "string") return null;
  // Long answers reveal paragraphs; short answers retain the word stagger.
  const revealBlocks = Boolean(scrollContainerRef && !streaming);
  const revealWords = revealBlocks && text.length <= 1600;
  const wrap = (content: React.ReactNode) => scrollContainerRef
    ? <ChatScrollReveal scrollContainerRef={scrollContainerRef} enabled={revealBlocks}>{content}</ChatScrollReveal>
    : content;
  // Fast path: no code fences → render the whole thing as markdown.
  if (!text.includes("```")) {
    return wrap(<Markdown text={text} revealWords={revealWords} revealBlocks={revealBlocks} />);
  }
  const segments = parse(text);
  return wrap(
    <>
      {segments.map((s, i) =>
        s.type === "code" ? (
          <CodeBlock key={i} code={s.content} lang={s.lang ?? ""} />
        ) : (
          s.content.trim() && <Markdown key={i} text={s.content} revealWords={revealWords} revealBlocks={revealBlocks} />
        ),
      )}
    </>
  );
});
