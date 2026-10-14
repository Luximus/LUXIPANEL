// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Pure constants + helper functions for the ChatPane decomposition. Extracted
 * verbatim from the original `ChatPane.tsx` (no behavior change); the top-level
 * declarations are re-exported so the split components/hook import them.
 */
import { fmtBytes, formatDateStamp } from "@/lib/format";
import { ASSISTANT_AGENTS_SCOPE_EVENT } from "@/lib/panel-events";
import type { ChatTurn } from "../chat-engine";
import type { AgentMessage } from "../assistant-api";
import type { ModifiedFileEntry, ModifiedFileKind } from "./types";

export const PAGE = 10;
// Fetch the next page only on a user scroll or explicit request.
export const CONVOS_PAGE = 15;


export const MAX_ATTACH_BYTES = 8 * 1024 * 1024; // 8 MB per file (post-compression)
/** Reject before we even try to decode/rasterize — guards the tab against an
 *  enormous file. Above the attach cap because compression usually rescues big
 *  photos into the limit; only the truly huge are turned away up front. */
export const MAX_DECODE_BYTES = 40 * 1024 * 1024; // 40 MB
/** Attachment sizes are always quoted in MB with one decimal (T-07). */
export const formatMb = (bytes: number): string => fmtBytes(bytes, { unit: "MB", decimals: 1, zero: "0.0 MB" });
export const PROJECTS_PAGE = 10;
// "Agentes IA" conversation lists page in blocks of 5 — both the top-level list
// and every nested per-agent chat list (restores the historic 5-per-page pager).
export const AGENTS_PER_PAGE = 5;

export const MAX_MSG_CONTENT = 32_000;
export const MAX_SEND_MESSAGES = 40;

// Quick-start suggestions shown in an EMPTY chat. A LOOSE chat (no project)
// gets server-admin / new-project starters; a PROJECT chat samples from the
// project's own pre-generated set (server-side, up to 50) and falls back to
// these generic project starters when it has none yet.
//
// These Spanish arrays are the FALLBACK only. The displayed (and sent) text is
// localized via `i18n.chatTab.quickStartLoose` / `quickStartProjectFallback`
// (see `quickStartSuggestions` below); the chips must follow the selected
// language like the rest of the empty-state, so keep these in sync if you edit
// the locale arrays.
export const LOOSE_SUGGESTIONS: string[] = [
  "¿Cómo está la salud del servidor ahora mismo?",
  "Muéstrame el uso de CPU, memoria y disco.",
  "¿Qué servicios están caídos o con errores?",
  "Revisa los últimos errores en los logs del sistema.",
  "¿Hay actualizaciones de seguridad pendientes?",
  "Lista los puertos abiertos y qué proceso los usa.",
  "Ayúdame a crear un proyecto nuevo.",
  "¿Qué tareas de mantenimiento me recomiendas hoy?",
  "Revisa el uso de disco por carpeta en este servidor.",
  "¿Qué usuarios tienen acceso a este servidor?",
];
export const PROJECT_FALLBACK_SUGGESTIONS: string[] = [
  "Dame un resumen de este proyecto y su estado.",
  "Explícame la estructura de archivos de este proyecto.",
  "¿Cuál es el siguiente paso recomendado en este proyecto?",
  "Busca posibles errores o mejoras en este proyecto.",
  "¿Qué archivos componen este proyecto?",
  "¿Qué puedo pedirte sobre este proyecto?",
];

// Rotating palette for the empty-state "starting point" tiles (Tailwind Plus
// "Empty states" pattern): a coloured square icon per card, white glyph. Index
// the suggestion position into this list so cards cycle through the colours.
export const START_TILES: { color: string; icon: string }[] = [
  { color: "bg-indigo-500", icon: "ti-sparkles" },
  { color: "bg-emerald-500", icon: "ti-server-cog" },
  { color: "bg-sky-500", icon: "ti-terminal-2" },
  { color: "bg-amber-500", icon: "ti-shield-check" },
  { color: "bg-rose-500", icon: "ti-activity" },
  { color: "bg-violet-500", icon: "ti-bolt" },
];

// Pick a Tabler icon that reflects what a quick-start suggestion is ABOUT, so
// the tiles read as topical instead of a blind colour rotation. Keyword matcher
// with basic ES/EN coverage (suggestions can be custom per-project, so keying
// off intent keywords beats indexing a fixed list). Returns `null` when nothing
// matches → the caller falls back to the rotating START_TILES icon. Order
// matters: earlier, more specific intents win over generic ones (e.g. a
// "maintenance" question also containing "recommend" stays a wrench, not a
// route). The COLOUR still rotates by index at the call site.
export function iconForSuggestion(text: string): string | null {
  const s = text.toLowerCase();
  const has = (...keys: string[]) => keys.some((k) => s.includes(k));
  if (has("mantenimiento", "maintenance")) return "ti-tool";
  if (has("siguiente paso", "next step", "recomien", "recommend")) return "ti-route";
  if (has("mejora", "bug", "código", "codigo", " code")) return "ti-bug";
  if (has("disco", "disk", "espacio", "almacen", "storage")) return "ti-database";
  if (has("puerto", "port", "network", "firewall", "conexión", "conexion")) return "ti-network";
  if (has("usuario", "user", "acceso", "access", "permiso")) return "ti-users";
  if (has("servicio", "service", "caíd", "caid", "down", "error", "fall")) return "ti-alert-triangle";
  if (has("resumen", "summary", "estado", "status", "salud", "health")) return "ti-file-text";
  if (has("proyecto", "project", "estructura", "structure", "archivo", "file")) return "ti-folder-code";
  return null;
}

declare global {
  interface Window {
    /** Última señal de "el scope visible del asistente es Agentes IA". La lee
     *  FloatingTerminalDrawer para ocultar su FAB también en el asistente
     *  flotante (donde el path no cambia). */
    __lxpAssistantAgentsScopeActive?: boolean;
  }
}

/** Publica (con dedup) si el scope visible del asistente es "Agentes IA".
 *  Guarda el último valor en `window` para la lectura inicial del FAB y emite
 *  `lxp:assistant:agents-scope` solo cuando cambia, evitando parpadeos. */
export function setFabAgentsScopeActive(active: boolean): void {
  if (typeof window === "undefined") return;
  if (window.__lxpAssistantAgentsScopeActive === active) return;
  window.__lxpAssistantAgentsScopeActive = active;
  window.dispatchEvent(new CustomEvent(ASSISTANT_AGENTS_SCOPE_EVENT, { detail: { active } }));
}

/** Random sample of up to `n` items (Fisher–Yates on a copy). */
export function sampleSuggestions(arr: string[], n: number): string[] {
  const a = arr.filter((s) => s && s.trim());
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// ── Modified-files detection ────────────────────────────────────────────────
// The CLI stream transformers (claude/codex) render each tool call as a line
// `⏺ <tool> <summary>`. For write-type tools the summary is the file path; for a
// shell tool it's the command, so a DELETION surfaces as a `bash`/`sh` line whose
// command is `rm`/`unlink <path>`. We scan the turn's terminal/history log for
// both: written/edited files open in the Monaco editor modal; deleted files are
// listed too but are NOT openable (the file is gone — see ModifiedFilesView).
// eslint-disable-next-line no-control-regex
export const ANSI_RE = /\x1b\[[0-9;]*m/g;
// Match a write-type tool line REGARDLESS of the exact bullet glyph: consume any
// leading non-letter run (the `⏺`/`●` marker + spaces), then the tool name. This
// is encoding-proof — keying off a specific marker codepoint silently matched
// nothing if the glyph differed.
export const WRITE_TOOL_RE = /^[^A-Za-z]*(write|edit|multiedit|notebookedit|update|create)\b[ \t]+(\S.*)$/i;
// A shell/command tool line (`⏺ Bash <cmd>`, codex `⏺ bash <cmd>`, …). The
// captured group is the command itself, which we then scan for `rm`/`unlink`.
// Anchoring deletion detection to a shell line keeps an `rm` mentioned in prose
// or in printed file content from being mistaken for a real deletion.
export const SHELL_TOOL_RE = /^[^A-Za-z]*(?:bash|shell|sh|exec|command|run)\b(.*)$/i;
// `rm`/`unlink` invocation inside a command, captured up to the next shell
// separator so `rm a && echo b` yields only `a`.
export const RM_CMD_RE = /\b(?:rm|unlink)\b([^;&|]*)/gi;

export function resolveModifiedPath(raw: string, base: string): string | null {
  // Defensive: malformed tool summaries can land an undefined raw; bail out
  // (don't crash) instead of trying to .replace undefined.
  if (typeof raw !== "string") return null;
  const cand = raw
    .trim()
    .replace(/\s{2,}.*$/, "")
    .replace(/\s*\(.*\)$/, "")
    .replace(/^["'`]|["'`]$/g, "")
    .trim();
  if (!cand || cand.length > 400) return null;
  // Globs/wildcards can't map to one concrete file → skip (also can't be opened).
  if (/[*?]/.test(cand)) return null;
  // Looks like a path? (has a slash or a dotted filename)
  if (!cand.includes("/") && !/\.[A-Za-z0-9]{1,8}$/.test(cand)) return null;
  if (cand.startsWith("/")) return cand;
  if (!base) return null; // can't resolve a relative path without the project cwd
  return `${base}/${cand.replace(/^\.\//, "")}`;
}

/** Files the agent touched this turn: written/edited (openable) and deleted
 *  (listed, not openable). Scanned in order, so the LAST operation on a path
 *  wins — a file edited then removed shows as deleted; removed then recreated
 *  shows as modified. */
export function extractModifiedFiles(turn: ChatTurn, projectPath?: string): ModifiedFileEntry[] {
  const sources: string[] = [];
  if (turn.cliHistoryLog) sources.push(turn.cliHistoryLog);
  for (const tr of turn.tools ?? []) {
    if (tr.terminal) sources.push(tr.terminal);
    if (tr.lanes) for (const lane of Object.values(tr.lanes)) if (lane?.output) sources.push(lane.output);
  }
  if (turn.raw) sources.push(turn.raw);
  const text = sources.join("\n").replace(ANSI_RE, "");
  const base = (projectPath ?? "").replace(/\/+$/, "");
  // (use of base is guarded below; projectPath is the only entry point that
  // can hand us undefined and we coalesce it to "" here.)

  const order: string[] = [];
  const kindByPath = new Map<string, ModifiedFileKind>();
  const note = (abs: string, kind: ModifiedFileKind) => {
    if (!kindByPath.has(abs)) order.push(abs);
    kindByPath.set(abs, kind); // last operation seen wins
  };

  for (const rawLine of text.split(/\r?\n/)) {
    // 1) Write/edit tools → modified. The summary may be `path`, `"path"`,
    //    `path (extra)`, or comma-separated paths for codex `edit`.
    const w = rawLine.match(WRITE_TOOL_RE);
    if (w) {
      for (const part of w[2].split(",")) {
        const abs = resolveModifiedPath(part, base);
        if (abs) note(abs, "modified");
      }
    }
    // 2) Shell tool running rm/unlink → deleted.
    const s = rawLine.match(SHELL_TOOL_RE);
    if (s) {
      const cmd = s[1] ?? "";
      RM_CMD_RE.lastIndex = 0;
      let rm: RegExpExecArray | null;
      while ((rm = RM_CMD_RE.exec(cmd))) {
        for (const tok of (rm[1] ?? "").split(/\s+/)) {
          if (!tok || tok.startsWith("-")) continue; // skip flags (-f, -rf, --)
          const abs = resolveModifiedPath(tok, base);
          if (abs) note(abs, "deleted");
        }
      }
    }
    if (order.length >= 50) break;
  }

  return order.slice(0, 50).map((path) => ({ path, kind: kindByPath.get(path) ?? "modified" }));
}

export function clampContent(s: string): string {
  if (s.length <= MAX_MSG_CONTENT) return s;
  return `${s.slice(0, MAX_MSG_CONTENT - 24)}\n… [recortado]`;
}

/**
 * Build the bounded, schema-valid `messages` array to send: drop empty prior
 * turns, clamp each content, keep only the most recent window, and always
 * append the new user message (content may be empty for attachment-only turns).
 */
export function buildAgentMessages(prior: ChatTurn[], text: string): AgentMessage[] {
  const history = prior
    .map((t) => ({ role: t.role, content: (t.text ?? "").trim() }))
    .filter((m) => m.content.length > 0)
    .map((m) => ({ role: m.role, content: clampContent(m.content) }));
  const windowed = history.slice(-(MAX_SEND_MESSAGES - 1));
  return [...windowed, { role: "user", content: clampContent(text) }];
}

/**
 * Compact "last response" stamp for the conversation list. Shows just the time
 * for today, day+month for this year, and adds the year otherwise.
 */
export function formatConvoDate(iso?: string): string {
  return formatDateStamp(iso, { locale: "es", day: "2-digit", yearWhenDifferent: true });
}

export function fmtRecordTime(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/**
 * Paint a bar waveform on `canvas` from a list of 0..1 peak amplitudes. `live`
 * keeps only the trailing bars (scrolling, while recording); otherwise the whole
 * clip is downsampled to fit (static, while staged). Bar color follows the
 * canvas CSS `color` (set via `text-primary`), so it tracks the theme.
 */
export function paintWaveform(canvas: HTMLCanvasElement, peaks: number[], live: boolean): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
  const cssW = canvas.clientWidth || 1;
  const cssH = canvas.clientHeight || 1;
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = getComputedStyle(canvas).color || "#c084fc";
  const barW = 2;
  const step = 4; // bar + gap
  const bars = Math.max(1, Math.floor(cssW / step));
  let data: number[];
  if (live) {
    data = peaks.slice(-bars);
  } else {
    data = [];
    const n = peaks.length;
    for (let i = 0; i < bars && n > 0; i++) data.push(peaks[Math.floor((i * n) / bars)] || 0);
  }
  const mid = cssH / 2;
  for (let i = 0; i < data.length; i++) {
    const h = Math.max(2, data[i] * cssH * 0.9);
    ctx.fillRect(i * step, mid - h / 2, barW, h);
  }
}

