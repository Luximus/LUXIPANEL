// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

/**
 * Detección PURA de "archivos modificados" desde el log de tools de un turno.
 * Extraída 1:1 de `ServerAssistantPane.tsx` (fase A2); sin imports de React/RN.
 *
 * Espejo recortado de `extractModifiedFiles` de la web: escanea la salida de las
 * tools en busca de líneas de write/edit (→ modificado) y de `rm`/`unlink` en
 * shells (→ eliminado). Sin `projectPath` solo resolvemos rutas ABSOLUTAS.
 */
import type { ChatMsg } from "./types";

// eslint-disable-next-line no-control-regex
const MF_ANSI_RE = /\x1b\[[0-9;]*m/g;
const MF_WRITE_RE = /^[^A-Za-z]*(write|edit|multiedit|notebookedit|update|create)\b[ \t]+(\S.*)$/i;
const MF_SHELL_RE = /^[^A-Za-z]*(?:bash|shell|sh|exec|command|run)\b(.*)$/i;
const MF_RM_RE = /\b(?:rm|unlink)\b([^;&|]*)/gi;

export type ModFileKind = "modified" | "deleted";
export type ModFile = { path: string; kind: ModFileKind };

/** Normaliza un candidato a ruta: recorta decoraciones y exige ruta absoluta. */
export function resolveAbsPath(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const cand = raw.trim().replace(/\s{2,}.*$/, "").replace(/\s*\(.*\)$/, "").replace(/^["'`]|["'`]$/g, "").trim();
  if (!cand || cand.length > 400) return null;
  if (/[*?]/.test(cand)) return null;
  if (!cand.startsWith("/")) return null; // sin cwd del proyecto solo absolutas
  return cand;
}

/** Acumula los archivos tocados por el agente en un turno (máx. 50; el último
 *  veredicto por ruta gana: un write posterior a un rm lo vuelve "modified"). */
export function extractModifiedFiles(msg: Pick<ChatMsg, "tools" | "cliHistoryLog">): ModFile[] {
  const sources: string[] = [];
  for (const tr of msg.tools ?? []) if (tr.output) sources.push(tr.output);
  if (msg.cliHistoryLog) sources.push(msg.cliHistoryLog);
  const text = sources.join("\n").replace(MF_ANSI_RE, "");
  const order: string[] = [];
  const kindByPath = new Map<string, ModFileKind>();
  const note = (abs: string, kind: ModFileKind) => {
    if (!kindByPath.has(abs)) order.push(abs);
    kindByPath.set(abs, kind);
  };
  for (const line of text.split(/\r?\n/)) {
    const w = line.match(MF_WRITE_RE);
    if (w) for (const part of w[2].split(",")) { const abs = resolveAbsPath(part); if (abs) note(abs, "modified"); }
    const s = line.match(MF_SHELL_RE);
    if (s) {
      const cmd = s[1] ?? "";
      MF_RM_RE.lastIndex = 0;
      let rm: RegExpExecArray | null;
      while ((rm = MF_RM_RE.exec(cmd))) {
        for (const tok of (rm[1] ?? "").split(/\s+/)) {
          if (!tok || tok.startsWith("-")) continue;
          const abs = resolveAbsPath(tok);
          if (abs) note(abs, "deleted");
        }
      }
    }
    if (order.length >= 50) break;
  }
  return order.slice(0, 50).map((path) => ({ path, kind: kindByPath.get(path) ?? "modified" }));
}
