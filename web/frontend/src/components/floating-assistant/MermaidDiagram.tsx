// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Reusable Mermaid renderer — same mechanism as the Files module's project map
 * (ProjectMapDrawer): lazy dynamic `import("mermaid")`, a single re-themed
 * instance, `mermaid.render(id, code)` → innerHTML, plus a zoom toolbar. Renders
 * an arbitrary diagram string (e.g. a `graph TD` agent-hierarchy tree).
 */
import { useEffect, useRef, useState } from "react";
import { useAssistantI18n } from "./i18n";
import { currentMermaidTheme, getMermaid, nextMermaidId, normalizeMermaidSvg } from "@/lib/mermaid";

/** Inject an avatar image above each node whose mermaid id is in `nodeImages`.
 *  Done by post-processing the rendered SVG (keeps securityLevel "strict" — no
 *  HTML labels). Robust across mermaid versions: only relies on `g.node` + its
 *  `<rect>`, and expands the viewBox so the top row's avatars aren't clipped. */
function injectNodeImages(svgEl: SVGSVGElement, nodeImages: Record<string, string>): void {
  const SIZE = 24;
  let added = false;
  for (const g of Array.from(svgEl.querySelectorAll("g.node"))) {
    const rawId = g.id || g.getAttribute("data-id") || "";
    const m = rawId.match(/^flowchart-(.+?)-\d+$/);
    const nodeId = m ? m[1]! : rawId;
    const url = nodeImages[nodeId];
    if (!url) continue;
    const rect = g.querySelector("rect");
    const h = rect ? parseFloat(rect.getAttribute("height") || "36") : 36;
    const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
    img.setAttribute("href", url);
    img.setAttributeNS("http://www.w3.org/1999/xlink", "href", url);
    img.setAttribute("width", String(SIZE));
    img.setAttribute("height", String(SIZE));
    img.setAttribute("x", String(-SIZE / 2));
    img.setAttribute("y", String(-h / 2 - SIZE - 3));
    img.setAttribute("preserveAspectRatio", "xMidYMid slice");
    img.setAttribute("clip-path", "circle()");
    g.appendChild(img);
    added = true;
  }
  if (added) {
    const vb = svgEl.getAttribute("viewBox");
    if (vb) {
      const p = vb.split(/[\s,]+/).map(Number);
      if (p.length === 4) svgEl.setAttribute("viewBox", `${p[0]} ${p[1]! - (SIZE + 6)} ${p[2]} ${p[3]! + (SIZE + 6)}`);
    }
  }
}

export function MermaidDiagram({ code, nodeImages }: { code: string; nodeImages?: Record<string, string> }) {
  const svgRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState(false);
  // Toolbar tooltip labels come from the assistant i18n bundle (mermaidDiagram
  // namespace); the deep-merge in the parent gives us English at runtime for
  // any locale that ships a translation.
  const i18n = useAssistantI18n() as ReturnType<typeof useAssistantI18n> & {
    mermaidDiagram?: { zoomOut: string; zoomIn: string; zoomReset: string };
  };
  const tZoom = {
    zoomOut: i18n.mermaidDiagram?.zoomOut ?? "Zoom out",
    zoomIn: i18n.mermaidDiagram?.zoomIn ?? "Zoom in",
    zoomReset: i18n.mermaidDiagram?.zoomReset ?? "Reset zoom",
  };

  useEffect(() => {
    let cancelled = false;
    setError(false);
    void (async () => {
      try {
        const mermaid = await getMermaid(currentMermaidTheme());
        const { svg } = await mermaid.render(nextMermaidId("agent-tree"), code);
        if (cancelled || !svgRef.current) return;
        svgRef.current.innerHTML = svg;
        const el = svgRef.current.querySelector("svg");
        if (el) {
          if (nodeImages && Object.keys(nodeImages).length) injectNodeImages(el as SVGSVGElement, nodeImages);
          normalizeMermaidSvg(el);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [code, nodeImages]);

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1.5">
        <button type="button" onClick={() => setZoom((z) => Math.max(0.25, z - 0.15))} className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted/50" title={tZoom.zoomOut}>
          <i className="ti ti-minus" aria-hidden></i>
        </button>
        <span className="w-12 text-center text-[11px] tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.15))} className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted/50" title={tZoom.zoomIn}>
          <i className="ti ti-plus" aria-hidden></i>
        </button>
        <button type="button" onClick={() => setZoom(1)} className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted/50" title={tZoom.zoomReset}>
          <i className="ti ti-focus-centered" aria-hidden></i>
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-4">
        {error ? (
          <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-[11px] text-muted-foreground">{code}</pre>
        ) : (
          <div
            ref={svgRef}
            className="m-auto w-fit origin-top-left [&_svg]:block"
            style={{ transform: `scale(${zoom})` }}
          />
        )}
      </div>
    </div>
  );
}
