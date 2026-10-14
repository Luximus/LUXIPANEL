// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * XSS regression tests for the server-side email HTML sanitizer
 * (audit finding: `parsed.html` from mailparser was exposed verbatim).
 */

import { describe, it, expect } from "vitest";
import { sanitizeEmailHtml } from "./mail-html-sanitizer.js";

describe("sanitizeEmailHtml — active content is removed", () => {
  it("drops <script> tags including their content", () => {
    const out = sanitizeEmailHtml('<p>hola</p><script>alert(document.cookie)</script>');
    expect(out).toBe("<p>hola</p>");
    expect(out).not.toContain("script");
    expect(out).not.toContain("alert");
  });

  it("strips on* event handlers", () => {
    const out = sanitizeEmailHtml('<img src="https://cdn.example.com/a.png" onerror="alert(1)" onload="x()">');
    expect(out).toContain('src="https://cdn.example.com/a.png"');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("onload");
    expect(out).not.toContain("alert");
  });

  it("removes javascript: URLs from links", () => {
    const out = sanitizeEmailHtml('<a href="javascript:alert(1)">clic</a>');
    expect(out).not.toContain("javascript:");
    expect(out).toContain("clic");
  });

  it("drops iframe/object/embed/form entirely", () => {
    const out = sanitizeEmailHtml(
      '<iframe src="https://evil.example"></iframe>'
      + '<object data="https://evil.example/x.swf"></object>'
      + '<embed src="https://evil.example/x.swf">'
      + '<form action="https://evil.example/phish"><input name="pw"></form>ok',
    );
    expect(out).toBe("ok");
  });

  it("drops <style> blocks including their CSS text", () => {
    const out = sanitizeEmailHtml("<style>body{background:url(https://evil.example)}</style><p>x</p>");
    expect(out).toBe("<p>x</p>");
  });

  it("neutralizes SVG-based vectors (svg not in allowlist)", () => {
    const out = sanitizeEmailHtml('<svg onload="alert(1)"><circle r="1"/></svg>texto');
    expect(out).toBe("texto");
  });
});

describe("sanitizeEmailHtml — img src scheme allowlist (https + cid)", () => {
  it("keeps https: and cid: image sources", () => {
    expect(sanitizeEmailHtml('<img src="https://cdn.example.com/a.png">')).toContain("https://cdn.example.com/a.png");
    expect(sanitizeEmailHtml('<img src="cid:part1.abc@example.com">')).toContain("cid:part1.abc@example.com");
  });

  it("drops http:, data: and javascript: image sources", () => {
    for (const src of ["http://x.example/a.png", "data:image/png;base64,AAAA", "javascript:alert(1)"]) {
      const out = sanitizeEmailHtml(`<img src="${src}">`);
      expect(out).not.toContain(src.slice(0, 5));
    }
  });

  it("drops protocol-relative URLs", () => {
    expect(sanitizeEmailHtml('<img src="//evil.example/a.png">')).not.toContain("//evil.example");
  });
});

describe("sanitizeEmailHtml — basic formatting survives", () => {
  it("keeps typical newsletter markup (tables, headings, formatting, links)", () => {
    const input =
      '<h1>Título</h1><p>Hola <b>mundo</b> <em>énfasis</em></p>'
      + '<table><tbody><tr><td colspan="2">celda</td></tr></tbody></table>'
      + '<blockquote>cita</blockquote><ul><li>uno</li></ul>'
      + '<a href="https://example.com/x">enlace</a>';
    const out = sanitizeEmailHtml(input);
    expect(out).toContain("<h1>Título</h1>");
    expect(out).toContain("<b>mundo</b>");
    expect(out).toContain("<em>énfasis</em>");
    expect(out).toContain('<td colspan="2">celda</td>');
    expect(out).toContain("<blockquote>cita</blockquote>");
    expect(out).toContain("<li>uno</li>");
    expect(out).toContain('href="https://example.com/x"');
  });

  it("hardens surviving links with rel=noopener + target=_blank", () => {
    const out = sanitizeEmailHtml('<a href="https://example.com">x</a>');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('target="_blank"');
  });

  it("keeps bounded inline styles and drops the rest", () => {
    const out = sanitizeEmailHtml('<span style="color:#ff0000;position:fixed;top:0;background-image:url(https://evil.example)">x</span>');
    expect(out).toContain("color:#ff0000");
    expect(out).not.toContain("position");
    expect(out).not.toContain("url(");
  });

  it("returns empty string for empty/nullish input", () => {
    expect(sanitizeEmailHtml("")).toBe("");
    expect(sanitizeEmailHtml(null)).toBe("");
    expect(sanitizeEmailHtml(undefined)).toBe("");
  });
});
