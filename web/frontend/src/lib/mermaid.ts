// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared lazy Mermaid singleton (F-08).
 *
 * `MermaidDiagram.tsx` (assistant) and `ProjectMapDrawer.tsx` (files) each kept
 * a byte-identical copy of the module cache + re-theme + id counter and of the
 * post-render `<svg>` width normalization. This is that copy, once.
 *
 * The dynamic `import("mermaid")` keeps the (heavy) library out of the initial
 * chunk; the module instance is shared so a second consumer never re-downloads
 * or re-initializes it unless the theme actually changed.
 */

let mermaidMod: (typeof import("mermaid"))["default"] | null = null;
let mermaidTheme: string | null = null;
let mermaidSeq = 0;

/** Lazily import + (re-)initialize Mermaid for `theme` ("dark" | "default"). */
export async function getMermaid(theme: string) {
  if (!mermaidMod) mermaidMod = (await import("mermaid")).default;
  if (mermaidTheme !== theme) {
    mermaidMod.initialize({
      startOnLoad: false,
      theme: theme as "dark" | "default",
      securityLevel: "strict",
      flowchart: { htmlLabels: false, curve: "basis", useMaxWidth: false, padding: 18 },
      themeVariables: { fontFamily: "Inter, system-ui, sans-serif", fontSize: "14px" },
    });
    mermaidTheme = theme;
  }
  return mermaidMod;
}

/** Theme mermaid should render with, derived from the live `dark` class. */
export function currentMermaidTheme(): string {
  return document.documentElement.classList.contains("dark") ? "dark" : "default";
}

/** Process-unique diagram id (`mermaid.render` requires one per call). */
export function nextMermaidId(prefix: string): string {
  return `${prefix}-${++mermaidSeq}`;
}

/**
 * Normalize a freshly-rendered `<svg>`: drop the fixed height, let the width be
 * the natural (viewBox) width and disable `max-width` so zooming can grow it.
 * Returns that natural width (0 when it can't be determined).
 */
export function normalizeMermaidSvg(el: SVGSVGElement | Element): number {
  const svg = el as SVGSVGElement;
  const w =
    svg.viewBox?.baseVal?.width ||
    parseFloat(svg.getAttribute("width") || "0") ||
    svg.getBoundingClientRect().width;
  svg.removeAttribute("height");
  svg.style.height = "auto";
  svg.style.maxWidth = "none";
  if (w) svg.style.width = `${w}px`;
  return w || 0;
}
