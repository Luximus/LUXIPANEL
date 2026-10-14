// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Browser — AI agent capability (verificación VISUAL para agentes QA).
 *
 * Corre Chromium HEADLESS en el servidor conectado (vía Executor) para que un
 * agente compruebe el resultado RENDERIZADO de un trabajo web:
 *  - `browser.check`      → señales textuales (HTTP status, URL final, título,
 *                           tamaño del DOM, errores de consola).
 *  - `browser.screenshot` → PNG en disco del target. Un agente CLI (claude)
 *                           lo LEE con su tool Read nativa y lo ve de verdad;
 *                           un agente API-mode recibe la ruta + usa check.
 *
 * Diseño:
 *  - Probe fail-open con TTL por target (patrón graph-index.service): si no hay
 *    chromium, las tools responden con el comando de instalación y el agente
 *    puede instalarlo él mismo con `admin.bash` (el broker de permisos pide
 *    aprobación en modo manual). Nada se instala desde el panel.
 *  - Ambas tools son `kind:"read"` (no piden confirmación; no rompen el gate
 *    de solo-lectura del orquestador multi). Solo CARGAN una URL — nunca
 *    interactúan (sin click/type) ni devuelven base64 en el output (headroom
 *    comprime outputs grandes; la imagen viaja por disco).
 *  - `moduleId:"browser"` no tiene mapeo de sidebar ⇒ ADMIN-ONLY para
 *    no-admins (assistant-modules.service.userMayUseModule) — intencional.
 *  - "Solo cuando sea necesario": las descripciones abren con esa directiva,
 *    el módulo tiene toggle en la pestaña Modules y el kill-switch global es
 *    ASSISTANT_BROWSER_TOOLS_ENABLED.
 */

import { env, CACHE_REDIS_PORT } from "../../config/env.js";
import type { AgentCapability } from "../../shared/agent-capability/index.js";
import {
  getContextExecutor,
  getFileJailPaths,
  pathInFileJail,
  quoteArg,
  type Executor,
} from "../../shared/executor/index.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { AVAILABILITY_TTL_MS } from "./shared/constants.js";

const log = createModuleLogger("browser-capability");

/** Candidatos de binario, en orden de preferencia (Debian primero). */
const BIN_CANDIDATES = ["chromium", "chromium-browser", "google-chrome-stable"] as const;
const MAX_WAIT_MS = 15_000;
const DEFAULT_WAIT_MS = 3_000;
const MAX_CONSOLE_ERRORS = 10;

/** Comando de instalación multi-distro (espejo de tmux.controller.ts). */
export const CHROMIUM_INSTALL_HINT =
  "Chromium no está instalado en este servidor. Puedes instalarlo tú mismo con la herramienta admin.bash " +
  "(el usuario aprobará el comando si el modo es manual). Debian/Ubuntu: " +
  "sudo sh -c 'export DEBIAN_FRONTEND=noninteractive; apt-get update -qq; apt-get install -y chromium' " +
  "(en otras distros: dnf/yum/apk/pacman/zypper install chromium). Tras instalar, reintenta esta herramienta.";

interface BrowserAvailability {
  available: boolean;
  binPath?: string;
  checkedAt: number;
}

const availabilityCache = new Map<string, BrowserAvailability>();

function targetKey(executor: Executor): string {
  const t = (executor as { target?: { id?: string; name?: string } }).target;
  return t?.id || t?.name || "default";
}

/** Test helper — wipe the probe cache. */
export function _resetBrowserProbeCacheForTest(): void {
  availabilityCache.clear();
}

/** Probe fail-open con TTL: chromium presente en el target → binPath. */
export async function probeChromium(
  executor: Executor,
  opts: { refresh?: boolean } = {},
): Promise<BrowserAvailability> {
  const key = targetKey(executor);
  const cached = availabilityCache.get(key);
  if (!opts.refresh && cached && Date.now() - cached.checkedAt < AVAILABILITY_TTL_MS) return cached;
  let result: BrowserAvailability = { available: false, checkedAt: Date.now() };
  try {
    const probe = await executor.exec(
      BIN_CANDIDATES.map((b) => `command -v ${b}`).join(" || "),
      { timeoutMs: 8_000 },
    );
    const binPath = probe.stdout
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.startsWith("/"));
    if (probe.exitCode === 0 && binPath) result = { available: true, binPath, checkedAt: Date.now() };
  } catch (err) {
    // Fail-open a "no disponible": la tool responde con el hint de instalación.
    log.debug({ err: (err as Error).message }, "chromium probe failed");
  }
  availabilityCache.set(key, result);
  return result;
}

/** http(s) sin credenciales embebidas ni control chars. */
function sanitizeUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (raw.length > 2048 || /[\s\0'"`]/.test(raw)) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  return parsed.toString();
}

function clampInt(v: unknown, min: number, max: number, def: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : def;
  return Math.min(Math.max(n, min), max);
}

/** Flags server-safe comunes a check/screenshot. */
function chromiumBase(binPath: string, waitMs: number): string {
  return (
    `${quoteArg(binPath)} --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage ` +
    `--hide-scrollbars --no-first-run --virtual-time-budget=${waitMs}`
  );
}

// ── Descubrimiento de URLs (el QA no debe preguntar al usuario) ─────────────

export interface DiscoveredUrl {
  url: string;
  /** De dónde salió: vhost nginx o puerto en escucha. */
  source: "nginx" | "listen";
  serverName?: string;
  root?: string;
  proxyPass?: string;
  process?: string;
  /** True cuando el vhost sirve/proxya la ruta consultada (proyecto). */
  matchesPath?: boolean;
}

/** Normaliza una ruta de worktree de tarea a la raíz del repo real
 *  (/repo/.lxp/worktrees/<id>[/sub] → /repo[/sub]) para correlacionar con
 *  los `root` de nginx, que sirven el checkout principal. */
export function stripWorktreeSegment(p: string): string {
  return p.replace(/\/\.lxp\/worktrees\/[A-Za-z0-9-]+(?=\/|$)/, "");
}

/** Parse tosco (best-effort) de bloques server{} de nginx. */
export function parseNginxServers(conf: string): Array<{
  serverNames: string[];
  listens: string[];
  roots: string[];
  proxyPasses: string[];
}> {
  const out: Array<{ serverNames: string[]; listens: string[]; roots: string[]; proxyPasses: string[] }> = [];
  let depth = 0;
  let cur: (typeof out)[number] | null = null;
  for (const rawLine of conf.split("\n")) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    if (/^server\s*\{/.test(line) && depth >= 0 && !cur) {
      cur = { serverNames: [], listens: [], roots: [], proxyPasses: [] };
      depth = 1;
      continue;
    }
    if (!cur) continue;
    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
    const m = line.match(/^(server_name|listen|root|proxy_pass)\s+([^;]+);/);
    if (m) {
      const [, key, value] = m as unknown as [string, string, string];
      const v = value.trim();
      if (key === "server_name") cur.serverNames.push(...v.split(/\s+/).filter((s) => s && s !== "_"));
      else if (key === "listen") cur.listens.push(v);
      else if (key === "root") cur.roots.push(v);
      else cur.proxyPasses.push(v);
    }
    if (depth <= 0) {
      out.push(cur);
      cur = null;
      depth = 0;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Candidatas desde los vhosts + puertos del target. Best-effort, sin sudo. */
export async function discoverUrls(executor: Executor, wantedPath?: string): Promise<DiscoveredUrl[]> {
  const results: DiscoveredUrl[] = [];
  const seen = new Set<string>();
  const push = (d: DiscoveredUrl) => {
    if (seen.has(d.url) || results.length >= 25) return;
    seen.add(d.url);
    results.push(d);
  };
  const normalizedWanted = wantedPath ? stripWorktreeSegment(wantedPath.replace(/\/+$/, "")) : "";

  // 1. Vhosts nginx (sites-enabled + conf.d, legibles sin sudo normalmente).
  const conf = await executor
    .exec(
      `for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do [ -f "$f" ] && cat "$f"; done 2>/dev/null`,
      { timeoutMs: 10_000 },
    )
    .catch(() => null);
  if (conf?.stdout) {
    for (const block of parseNginxServers(conf.stdout)) {
      const https = block.listens.some((l) => /(^|\s)443(\s|$)|ssl/.test(l));
      const matchesPath = Boolean(
        normalizedWanted &&
          block.roots.some(
            (r) => r.startsWith(normalizedWanted) || normalizedWanted.startsWith(r.replace(/\/+$/, "")),
          ),
      );
      for (const name of block.serverNames.slice(0, 4)) {
        if (!/^[A-Za-z0-9.*-]+$/.test(name) || name.startsWith("*")) continue;
        push({
          url: `${https ? "https" : "http"}://${name}/`,
          source: "nginx",
          serverName: name,
          ...(block.roots[0] ? { root: block.roots[0] } : {}),
          ...(block.proxyPasses[0] ? { proxyPass: block.proxyPasses[0] } : {}),
          ...(matchesPath ? { matchesPath: true } : {}),
        });
      }
      // Vhost proxy sin nombre útil → el upstream local también es verificable
      // (chromium corre EN este servidor).
      for (const pp of block.proxyPasses.slice(0, 2)) {
        const port = pp.match(/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::(\d{2,5}))?/)?.[1];
        if (port) push({ url: `http://127.0.0.1:${port}/`, source: "listen", ...(matchesPath ? { matchesPath: true } : {}) });
      }
    }
  }

  // 2. Puertos HTTP-like en escucha (ss sin sudo: puertos siempre; proceso solo
  //    si es propio). Chromium corre en el target → 127.0.0.1 funciona.
  const ss = await executor.exec(`ss -ltnpH 2>/dev/null || ss -ltnH 2>/dev/null`, { timeoutMs: 10_000 }).catch(() => null);
  if (ss?.stdout) {
    for (const line of ss.stdout.split("\n")) {
      // Columnas de `ss -ltnH`: State Recv-Q Send-Q Local:Port Peer:Port [users]
      const local = line.trim().split(/\s+/)[3] ?? "";
      const p = Number(local.slice(local.lastIndexOf(":") + 1));
      if (!Number.isInteger(p) || p <= 0) continue;
      // Solo rangos típicos de apps web; fuera 22/25/53/…, redis, dbs comunes.
      if (p < 1024 || [3306, 5432, 6379, CACHE_REDIS_PORT, 11211, 27017].includes(p)) continue;
      const process = line.match(/users:\(\("([^"]+)"/)?.[1];
      push({ url: `http://127.0.0.1:${p}/`, source: "listen", ...(process ? { process } : {}) });
    }
  }

  // Las que matchean la ruta consultada, primero.
  return results.sort((a, b) => Number(Boolean(b.matchesPath)) - Number(Boolean(a.matchesPath)));
}

/** Extrae <title> del DOM volcado (best-effort). */
function extractTitle(dom: string): string {
  const m = dom.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i);
  return m?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

/** Líneas de consola nivel error del stderr de chromium (--enable-logging). */
function extractConsoleErrors(stderr: string): string[] {
  const out: string[] = [];
  for (const line of stderr.split("\n")) {
    if (!/:ERROR:CONSOLE|\[.*ERROR.*CONSOLE/i.test(line) && !/CONSOLE\(\d+\)\]\s*"?(Uncaught|Error|Failed)/i.test(line)) continue;
    out.push(line.trim().slice(0, 200));
    if (out.length >= MAX_CONSOLE_ERRORS) break;
  }
  return out;
}

export const browserAgentCapability: AgentCapability = {
  moduleId: "browser",
  version: 1,
  tools: [
    {
      name: "browser.discover_urls",
      title: "Descubrir URLs verificables del servidor",
      description:
        "Discover which URLs this server actually serves, WITHOUT asking the user: parses nginx vhosts " +
        "(server_name/root/proxy_pass) and lists listening web ports (http://127.0.0.1:<port> works — Chromium " +
        "runs ON this server). Pass `path` (your project/working directory) to rank the vhosts that serve it " +
        "first (`matchesPath`). Use it BEFORE browser.check/browser.screenshot when the task doesn't state a URL.",
      kind: "read",
      dangerous: false,
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Optional absolute project/working dir to correlate with vhost roots (worktree paths are normalized).",
          },
        },
      },
      handler: async (input: unknown) => {
        const obj = (input ?? {}) as { path?: unknown };
        const executor = getContextExecutor();
        if (!executor) return { ok: false, output: "Sin servidor conectado." };
        const wanted =
          typeof obj.path === "string" && obj.path.trim().startsWith("/") && !obj.path.includes("..")
            ? obj.path.trim()
            : undefined;
        try {
          const urls = await discoverUrls(executor, wanted);
          if (urls.length === 0) {
            return {
              ok: true,
              output:
                "No se encontraron vhosts nginx ni puertos web en escucha. Si la app aún no está desplegada/arrancada, " +
                "levántala primero (o verifica archivos estáticos sirviéndolos con un server temporal).",
            };
          }
          return {
            ok: true,
            output: {
              urls,
              hint:
                (wanted ? "Las entradas con matchesPath sirven tu ruta. " : "") +
                "Elige la URL correcta y verifícala con browser.check / browser.screenshot — no preguntes al usuario.",
            },
          };
        } catch (err) {
          return { ok: false, output: `No se pudieron descubrir URLs: ${(err as Error).message}` };
        }
      },
    },
    {
      name: "browser.check",
      title: "Comprobar una página renderizada (señales)",
      description:
        "Use ONLY when the task requires verifying a rendered web page. Loads the URL in headless Chromium ON " +
        "THE CONNECTED SERVER and returns textual signals: HTTP status, final URL (redirects), <title>, DOM size " +
        "and console errors. Don't know the URL? Call browser.discover_urls first (never ask the user). If " +
        "Chromium is missing you'll get the install command (you may run it via admin.bash).",
      kind: "read",
      dangerous: false,
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "http(s) URL to load (no embedded credentials)." },
          waitMs: { type: "number", description: `Virtual time budget for JS rendering (0-${MAX_WAIT_MS}, default ${DEFAULT_WAIT_MS}).` },
        },
        required: ["url"],
      },
      handler: async (input: unknown) => {
        const obj = (input ?? {}) as { url?: unknown; waitMs?: unknown };
        const url = sanitizeUrl(obj.url);
        if (!url) return { ok: false, output: "URL inválida: usa http(s) sin credenciales embebidas." };
        const executor = getContextExecutor();
        if (!executor) return { ok: false, output: "Sin servidor conectado." };
        const probe = await probeChromium(executor);
        if (!probe.available || !probe.binPath) return { ok: false, output: CHROMIUM_INSTALL_HINT };
        const waitMs = clampInt(obj.waitMs, 0, MAX_WAIT_MS, DEFAULT_WAIT_MS);

        // (a) status + URL final por curl (barato); (b) DOM + consola por chromium.
        const curl = await executor
          .exec(`curl -sIL -o /dev/null -m 20 -w '%{http_code} %{url_effective}' ${quoteArg(url)}`, {
            timeoutMs: 25_000,
          })
          .catch(() => null);
        const [httpStatus = "", finalUrl = url] = (curl?.stdout ?? "").trim().split(/\s+/, 2);

        let dump: { stdout: string; stderr: string; exitCode: number };
        try {
          dump = await executor.exec(
            `${chromiumBase(probe.binPath, waitMs)} --enable-logging=stderr --dump-dom ${quoteArg(url)}`,
            { timeoutMs: env.ASSISTANT_BROWSER_TIMEOUT_MS },
          );
        } catch (err) {
          return { ok: false, output: `Chromium no pudo cargar la página: ${(err as Error).message}` };
        }
        if (dump.exitCode !== 0 && !dump.stdout.trim()) {
          return {
            ok: false,
            output: `Chromium salió con código ${dump.exitCode}: ${(dump.stderr || "sin salida").trim().slice(-300)}`,
          };
        }
        return {
          ok: true,
          output: {
            httpStatus: Number(httpStatus) || null,
            finalUrl,
            title: extractTitle(dump.stdout),
            domBytes: dump.stdout.length,
            consoleErrors: extractConsoleErrors(dump.stderr),
            hint: "Para VER la página usa browser.screenshot y (si eres un agente CLI) lee el PNG con tu tool Read.",
          },
        };
      },
    },
    {
      name: "browser.screenshot",
      title: "Capturar screenshot de una página",
      description:
        "Use ONLY when the task requires VISUALLY verifying a rendered web page. Don't know the URL? Call " +
        "browser.discover_urls first (never ask the user). Loads the URL in headless " +
        "Chromium ON THE CONNECTED SERVER and saves a PNG there. CLI agents (claude): READ the returned PNG path " +
        "with your Read tool to actually SEE it (pass outPath inside your working directory if the default path " +
        "is outside your sandbox). API agents: use browser.check for textual signals instead. Raise `height` to " +
        "capture more of the page.",
      kind: "read",
      dangerous: false,
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "http(s) URL to render (no embedded credentials)." },
          width: { type: "number", description: "Viewport width px (360-3840, default 1280)." },
          height: { type: "number", description: "Viewport height px (400-10000, default 800). Raise for full page." },
          waitMs: { type: "number", description: `Virtual time budget for JS rendering (0-${MAX_WAIT_MS}, default ${DEFAULT_WAIT_MS}).` },
          outPath: { type: "string", description: "Optional absolute .png path (inside your working directory / jail)." },
        },
        required: ["url"],
      },
      handler: async (input: unknown) => {
        const obj = (input ?? {}) as { url?: unknown; width?: unknown; height?: unknown; waitMs?: unknown; outPath?: unknown };
        const url = sanitizeUrl(obj.url);
        if (!url) return { ok: false, output: "URL inválida: usa http(s) sin credenciales embebidas." };
        const executor = getContextExecutor();
        if (!executor) return { ok: false, output: "Sin servidor conectado." };
        const probe = await probeChromium(executor);
        if (!probe.available || !probe.binPath) return { ok: false, output: CHROMIUM_INSTALL_HINT };
        const width = clampInt(obj.width, 360, 3840, 1280);
        const height = clampInt(obj.height, 400, 10_000, 800);
        const waitMs = clampInt(obj.waitMs, 0, MAX_WAIT_MS, DEFAULT_WAIT_MS);

        // Ruta de salida: default bajo el dir de screenshots (añadido al jail
        // cuando el run tiene jail); outPath propio validado contra el jail.
        let outPath = `${env.ASSISTANT_BROWSER_SHOT_DIR}/shot-${Date.now()}.png`;
        if (typeof obj.outPath === "string" && obj.outPath.trim()) {
          const wanted = obj.outPath.trim();
          if (!wanted.startsWith("/") || !wanted.endsWith(".png") || wanted.includes("..") || /[\s'"`\0]/.test(wanted)) {
            return { ok: false, output: "outPath inválido: ruta absoluta .png sin espacios ni '..'." };
          }
          const jail = getFileJailPaths() ?? [];
          if (jail.length > 0 && !pathInFileJail(wanted)) {
            return { ok: false, output: `outPath fuera de tus directorios permitidos. Usa una ruta bajo tu directorio de trabajo o omítelo (default: ${env.ASSISTANT_BROWSER_SHOT_DIR}).` };
          }
          outPath = wanted;
        }
        const dir = outPath.slice(0, outPath.lastIndexOf("/")) || "/";
        try {
          await executor.exec(`mkdir -p ${quoteArg(dir)}`, { timeoutMs: 8_000 });
          const shot = await executor.exec(
            `${chromiumBase(probe.binPath, waitMs)} --window-size=${width},${height} --screenshot=${quoteArg(outPath)} ${quoteArg(url)}`,
            { timeoutMs: env.ASSISTANT_BROWSER_TIMEOUT_MS },
          );
          const stat = await executor.exec(`stat -c %s ${quoteArg(outPath)} 2>/dev/null || wc -c < ${quoteArg(outPath)}`, {
            timeoutMs: 8_000,
          });
          const bytes = Number(stat.stdout.trim()) || 0;
          if (stat.exitCode !== 0 || bytes === 0) {
            return {
              ok: false,
              output: `El screenshot no se generó (exit ${shot.exitCode}): ${(shot.stderr || "sin salida").trim().slice(-300)}`,
            };
          }
          return {
            ok: true,
            output: {
              path: outPath,
              bytes,
              viewport: `${width}x${height}`,
              hint:
                "Agente CLI: LEE este PNG con tu tool Read para verificarlo visualmente. " +
                "Agente API: usa browser.check para señales textuales.",
            },
          };
        } catch (err) {
          return { ok: false, output: `No se pudo capturar: ${(err as Error).message}` };
        }
      },
    },
  ],
  suggestedPrompts: [
    "Verifica visualmente que https://mi-sitio.com se renderiza bien en escritorio",
    "Comprueba si la home tiene errores de consola tras el último despliegue",
  ],
};
