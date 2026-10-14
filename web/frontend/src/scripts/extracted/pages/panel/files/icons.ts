// Files page — icons submodule (code-move from index-script1.ts; no behavior change).
import { DEFAULT_FILE_ICON, EXT_TO_ICON, FILE_ICON_SVGS, NAME_PREFIX_TO_ICON, NAME_TO_ICON } from "/scripts/extracted/pages/panel/files/file-icons.generated.js?v=20260524media";


  // ── Git status color ───────────────────────────────────────
  export function gitStatusColor(gitStatus: string | null): string {
    if (gitStatus === "new") return "text-green-500";
    if (gitStatus === "modified") return "text-yellow-500";
    if (gitStatus === "staged") return "text-blue-500";
    if (gitStatus === "deleted") return "text-red-500";
    return "";
  }

  // ── File icons (vscode-icons, offline) ─────────────────────
  // Filled folder SVG with dynamic color via currentColor. Las carpetas
  // conservan el color (git/hasGit); los archivos usan iconos vscode-icons
  // coloreados por extensión (el git status ya se refleja en el color del
  // nombre del archivo en la fila — ver call sites de fileIcon()).
  export function folderSVG(colorClass: string, opacity: string): string {
    return `<svg class="${colorClass} ${opacity}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" style="vertical-align:-0.1em"><path d="M12.414 5H21a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h7.414l2 2z"/></svg>`;
  }

  // Algunos iconos vscode-icons (python, etc.) traen <defs> con gradientes
  // referenciados por id (`fill="url(#id)"`). Al inyectar el MISMO SVG varias
  // veces (p.ej. varios .py en la cuadrícula) los ids se duplican en el DOM y
  // `url(#id)` resuelve al primero → gradiente roto → icono invisible. Reescribe
  // los ids a únicos por instancia (equivalente a replaceIDs de Iconify, pero en
  // render). Solo toca el string si hay ids, así que es barato para el 95% planos.
  export let __iconIdSeq = 0;
  export function uniquifySvgIds(svg: string): string {
    if (!svg.includes('id="')) return svg;
    const map = new Map<string, string>();
    svg = svg.replace(/id="([^"]+)"/g, (_m, id) => {
      const nid = `lxpi${__iconIdSeq++}`;
      map.set(id, nid);
      return `id="${nid}"`;
    });
    svg = svg.replace(/url\(#([^)]+)\)/g, (m, id) => (map.has(id) ? `url(#${map.get(id)})` : m));
    svg = svg.replace(/(xlink:href|href)="#([^"]+)"/g, (m, attr, id) =>
      map.has(id) ? `${attr}="#${map.get(id)}"` : m,
    );
    return svg;
  }

  // Wrap an inline SVG (1em) preserving hidden-file opacity.
  export function iconSpan(svg: string, opacity: string): string {
    const cls = opacity ? ` class="${opacity}"` : "";
    return `<span${cls} style="display:inline-block;line-height:1;vertical-align:-0.125em">${uniquifySvgIds(svg)}</span>`;
  }

  // Resolve the vscode-icons icon name for a file by name then extension.
  export function fileIconName(name: string): string {
    const lower = name.toLowerCase();
    if (NAME_TO_ICON[lower]) return NAME_TO_ICON[lower];
    for (const [prefix, icon] of NAME_PREFIX_TO_ICON) {
      if (lower.startsWith(prefix)) return icon;
    }
    const ext = lower.includes(".") ? lower.split(".").pop()! : "";
    return EXT_TO_ICON[ext] || DEFAULT_FILE_ICON;
  }

  // Returns full icon HTML for file/folder
  export function fileIcon(name: string, isDir: boolean, isHidden = false, hasGit = false, gitStatus: string | null = null): string {
    const opacity = isHidden ? "opacity-40" : "";

    if (isDir) {
      const gitColor = gitStatusColor(gitStatus);
      const color = gitColor || (hasGit ? "text-green-500" : "text-amber-500");
      return folderSVG(color, opacity);
    }

    const iconName = fileIconName(name);
    const svg = FILE_ICON_SVGS[iconName] || FILE_ICON_SVGS[DEFAULT_FILE_ICON];
    return iconSpan(svg, opacity);
  }
