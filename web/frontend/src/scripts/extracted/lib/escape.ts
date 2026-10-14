// Shared HTML-escaping helper for the extracted page scripts. Consolidates the
// ~15 per-script copies of `esc`/`escapeHtml`. Imported by the runtime URL
// `/scripts/extracted/lib/escape.js` (stays external in bundled entries via the
// `/scripts/extracted/lib/*` glob, resolved by the browser in non-bundled ones).
// Standalone (no imports).
//
// Escapes the five HTML-significant characters, which is correct for element
// text AND for double- or single-quoted attribute values. Null/undefined and
// non-strings coerce to "" so it is safe to route ANY interpolated value
// through it before it reaches `innerHTML`.
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

// Alias for readability at attribute-interpolation sites — same escaping (the
// five-char set covers quoted attributes).
export const escapeAttr = escapeHtml;

// Escape a value destined for a SINGLE-QUOTED JavaScript string literal that
// itself lives inside a DOUBLE-QUOTED HTML attribute — e.g. an `on*=` handler
// interpolated into an `innerHTML` template (`onclick="fn('${escapeJsAttr(x)}')"`).
// BOTH layers are mandatory: the HTML parser decodes entities in the attribute
// value BEFORE the JS is compiled, so HTML-escaping alone lets `'`/`\` break out
// of the JS string (`x');evil()//`), while JS-escaping alone lets `"` break out
// of the attribute. JS-escape first (so the value stays inside the `'…'`
// literal), then HTML-escape (so it stays inside the `"…"` attribute).
export function escapeJsAttr(value: unknown): string {
  const js = String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
  return escapeHtml(js);
}
