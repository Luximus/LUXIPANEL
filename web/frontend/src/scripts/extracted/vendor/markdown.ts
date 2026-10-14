// Self-hosted markdown renderer (vendor bundle). Bundles `marked` + `dompurify`
// into one ESM file imported by URL from the assistant page script. Replaces the
// former `import("https://esm.run/marked@12")` CDN fetch (offline + no runtime
// third-party origin) and the hand-rolled regex "sanitizer" (bypassable) with a
// real DOM-based sanitizer.
//
// SECURITY: assistant replies and tool results (DNS records, service banners)
// are influenceable by external content, so their markdown -> HTML output is
// untrusted. Every string that reaches `innerHTML` in the assistant MUST pass
// through `renderMarkdown` here. The allowlist below is the exact set the chat
// actually renders (GFM: paragraphs, links, code, lists, emphasis, tables) with
// NO `on*` handlers, NO `style`, and href limited to safe protocols.
import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ breaks: true, gfm: true });

// Tags the chat markdown can legitimately produce.
const ALLOWED_TAGS = [
  "p", "br", "hr", "span", "div", "blockquote",
  "a", "code", "pre",
  "strong", "b", "em", "i", "del", "s", "u", "sub", "sup", "mark",
  "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
];

// No `style`, no `on*`, no `id`/`name` injection; `class` kept for our styling.
const ALLOWED_ATTR = ["href", "title", "class", "align", "colspan", "rowspan", "start", "type"];

// Only http(s), mailto, tel, in-page anchors and relative paths. Blocks
// javascript:/data:/vbscript: and any other scheme.
const ALLOWED_URI_REGEXP = /^(?:https?:|mailto:|tel:|#|\/(?!\/))/i;

// Harden external links: force rel and a new tab so a rendered link can't
// reverse-tabnab or leak the referrer of the panel origin.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.hasAttribute("href")) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer nofollow");
  }
});

export function renderMarkdown(src: string): string {
  if (!src) return "";
  const raw = marked.parse(src, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: ["style"],
  });
}

export { marked, DOMPurify };
