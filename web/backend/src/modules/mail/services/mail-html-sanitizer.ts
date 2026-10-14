// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Server-side sanitizer for HTML mail bodies (XSS — audit finding: the inbox
 * endpoint exposed mailparser's `parsed.html` verbatim, so a crafted email
 * became stored XSS for whoever opened it).
 *
 * Conservative email allowlist: formatting/table/image markup survives;
 * `script`/`iframe`/`object`/`embed`/`form`, every `on*` handler and
 * `javascript:` URL are dropped. `img src` only accepts `https:` and `cid:`
 * (inline attachments). Inline `style` is bounded to a fixed set of layout /
 * typography properties with strict value shapes; `<style>` blocks and the
 * rest of CSS (url(), expression(), position, etc.) are removed.
 *
 * The frontend's sandboxed iframe stays as defense-in-depth — this closes the
 * hole for every OTHER consumer of the API (app, desktop, AI assistant).
 */

import sanitizeHtml from "sanitize-html";

const COLOR_VALUE = [
  /^#[0-9a-fA-F]{3,8}$/,
  /^rgba?\([\d\s.,%]+\)$/,
  /^[a-zA-Z]+$/,
];
const SIZE_VALUE = [/^-?[\d.]+(px|em|rem|%|pt|vw|vh)?$/];
const SPACING_VALUE = [/^(-?[\d.]+(px|em|rem|%|pt)?\s*){1,4}$/];
const BORDER_VALUE = [
  /^[\d.]+(px|pt)?\s+(solid|dashed|dotted|double|none)(\s+(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|rgba?\([\d\s.,%]+\)))?$/,
];

const BOUNDED_STYLES: NonNullable<sanitizeHtml.IOptions["allowedStyles"]> = {
  "*": {
    "color": COLOR_VALUE,
    "background-color": COLOR_VALUE,
    "font-size": SIZE_VALUE,
    "font-family": [/^[\w\s,'"–-]+$/],
    "font-weight": [/^(bold|bolder|lighter|normal|[1-9]00)$/],
    "font-style": [/^(italic|normal|oblique)$/],
    "text-align": [/^(left|right|center|justify)$/],
    "text-decoration": [/^[a-z\s-]+$/],
    "vertical-align": [/^(top|middle|bottom|baseline)$/],
    "line-height": SIZE_VALUE,
    "width": SIZE_VALUE,
    "max-width": SIZE_VALUE,
    "height": SIZE_VALUE,
    "margin": SPACING_VALUE,
    "margin-top": SIZE_VALUE,
    "margin-right": SIZE_VALUE,
    "margin-bottom": SIZE_VALUE,
    "margin-left": SIZE_VALUE,
    "padding": SPACING_VALUE,
    "padding-top": SIZE_VALUE,
    "padding-right": SIZE_VALUE,
    "padding-bottom": SIZE_VALUE,
    "padding-left": SIZE_VALUE,
    "border": BORDER_VALUE,
    "border-top": BORDER_VALUE,
    "border-right": BORDER_VALUE,
    "border-bottom": BORDER_VALUE,
    "border-left": BORDER_VALUE,
    "border-radius": SPACING_VALUE,
    "border-collapse": [/^(collapse|separate)$/],
  },
};

const EMAIL_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "a", "abbr", "address", "b", "bdi", "bdo", "blockquote", "br", "caption",
    "center", "cite", "code", "col", "colgroup", "dd", "div", "dl", "dt",
    "em", "figcaption", "figure", "font", "h1", "h2", "h3", "h4", "h5", "h6",
    "hr", "i", "img", "li", "mark", "ol", "p", "pre", "q", "s", "small",
    "span", "strike", "strong", "sub", "sup", "table", "tbody", "td",
    "tfoot", "th", "thead", "time", "tr", "u", "ul", "wbr",
  ],
  // script/iframe/object/embed/form/style/svg/math are NOT listed → discarded
  // (script/style contents are dropped entirely via default nonTextTags).
  allowedAttributes: {
    "*": ["style", "align", "valign", "dir", "lang", "title"],
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "width", "height", "title"],
    td: ["colspan", "rowspan", "width", "height", "bgcolor", "nowrap"],
    th: ["colspan", "rowspan", "width", "height", "bgcolor", "scope"],
    table: ["border", "cellpadding", "cellspacing", "width", "bgcolor"],
    col: ["span", "width"],
    font: ["color", "face", "size"],
    ol: ["start", "type"],
    time: ["datetime"],
  },
  // `on*` handlers are never in the allowlist → always stripped.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: {
    // Images: https + cid (inline attachments) only — no http/data/javascript.
    img: ["https", "cid"],
  },
  allowProtocolRelative: false,
  allowedStyles: BOUNDED_STYLES,
  disallowedTagsMode: "discard",
  // Any <a> that survives opens outside the panel origin without an opener.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }, true),
  },
};

/** Sanitize an email HTML body for safe exposure through the API. */
export function sanitizeEmailHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, EMAIL_SANITIZE_OPTIONS);
}
