// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
//
// Shared plumbing for the three offline SVG-icon codegen scripts
// (build-provider-icons, build-module-icons, build-file-icons).
//
// All three emit the SAME inline `<svg>` envelope — 1em box, vertical-align
// nudge, aria-hidden — and then write a banner + a `Record<string,string>` TS
// module. Only the icon SOURCE differs (simple-icons paths, lucide multi-element
// bodies, an @iconify vscode-icons set). That envelope is what lives here: if it
// drifts between scripts, some icons silently render at a different size or stop
// inheriting `currentColor`.

import fs from "node:fs";
import path from "node:path";

/**
 * The canonical inline-SVG envelope.
 *
 * @param {string} body       inner markup (`<path .../>`, lucide elements, …)
 * @param {object} [opts]
 * @param {string} [opts.viewBox] defaults to the simple-icons 24x24 box
 * @param {string} [opts.attrs]   extra presentation attributes, ALREADY
 *   space-terminated (e.g. `fill="currentColor" `). Pass "" for icon sets that
 *   carry their own fills.
 */
export function inlineSvg(body, { viewBox = "0 0 24 24", attrs = 'fill="currentColor" ' } = {}) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ` +
    `width="1em" height="1em" ${attrs}` +
    `style="vertical-align:-0.125em" aria-hidden="true">${body}</svg>`
  );
}

/** simple-icons style: one `path d` on a 24x24 box, filled with currentColor. */
export const simpleIconSvg = (d) => inlineSvg(`<path d="${d}"/>`);

/** `{ id: "path d" }` -> `{ id: "<svg …/>" }`. */
export function simpleIconSvgs(paths) {
  const svgs = {};
  for (const [id, d] of Object.entries(paths)) svgs[id] = simpleIconSvg(d);
  return svgs;
}

/** lucide style: stroked multi-element body, no fill. */
export const lucideIconSvg = (body) =>
  inlineSvg(body, {
    attrs:
      'fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ',
  });

/** The shared "do not edit" header for the two brand-logo generators. */
export function brandIconBanner(scriptName) {
  return (
    `// AUTOGENERADO por scripts/${scriptName} - NO EDITAR A MANO.\n` +
    "// Logos de marca (simple-icons) embebidos offline, dimensionados a 1em.\n" +
    `// Regenerar: node scripts/${scriptName}\n\n`
  );
}

/** Write a generated module, creating its directory if needed. */
export function writeGenerated(outPath, contents) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, contents, "utf8");
}
