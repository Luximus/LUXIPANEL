// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Expo shared runtime — shell/EAS execution primitives, Metro dev-server
 * helpers and small utilities used across the Expo sub-services. Every command
 * runs on the CONNECTED server through the Executor (managed-mode isolation
 * invariant), wrapped in `sh -lc` + `injectSudoIntoShellScript`.
 */

import { panelConfigDir } from "@config/paths.js";
import type { Executor } from "../../../../shared/executor/index.js";
import { execShell, quoteArg } from "../../../../shared/executor/index.js";
import { createModuleLogger } from "../../../../shared/logger/index.js";
import { injectSudoIntoShellScript } from "../../../../shared/system/sudo-runtime.js";
import type { CliResult } from "../../models/index.js";
import { expoConfigService } from "../expo-config.service.js";

export const log = createModuleLogger("expo");

export const DEFAULT_TIMEOUT_MS = 120_000;
export const SCAN_TIMEOUT_MS = 30_000;

/** Where store-account credential files live on the connected server. */
export function credentialsDir(): string {
  const base = panelConfigDir();
  return `${base}/expo/credentials`;
}

const EXPO_URL_RE = /https?:\/\/(?:expo\.dev|expo\.io)\/[^\s"')]+/i;

export function firstUrl(text: string): string | null {
  return text.match(EXPO_URL_RE)?.[0] ?? null;
}

// ── Metro dev-server (live testing tunnel) helpers ──────────────────────────
/** Filesystem-safe, deterministic key per project path (for log/pid files). */
export function devSlug(projectPath: string): string {
  return projectPath.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "default";
}

/**
 * Grep the Metro log for the connection URL. A dev-client tunnel prints
 * `exp+<slug>://expo-development-client/?url=https%3A%2F%2F…exp.direct` (Expo Go
 * would print plain `exp://…`). The char class deliberately excludes `[` and ESC
 * so the match stops cleanly before any trailing ANSI color codes.
 */
export async function readExpUrlFromLog(executor: Executor, logFile: string): Promise<string | null> {
  const inner = `grep -aoE 'exp[+A-Za-z0-9._-]*://[A-Za-z0-9._:/?=%&~#-]+' ${quoteArg(logFile)} 2>/dev/null | tail -n1`;
  const r = await execShell(executor, inner, { timeoutMs: 10_000 }).catch(() => null);
  const url = (r?.stdout ?? "").trim().split("\n").pop()?.trim() ?? "";
  return url.startsWith("exp") && url.includes("://") ? url : null;
}

/** systemd transient unit name for a project's Metro dev server. */
export function metroUnit(slug: string): string {
  return `luxipanel-expo-metro-${slug}`;
}

/** systemd transient unit name for a project's create-app job. */
export function createUnit(slug: string): string {
  return `luxipanel-expo-create-${slug}`;
}

/** End-of-job marker the detached create writes to its log (with exit code). */
export const CREATE_EXIT_RE = /__LXP_CREATE_EXIT__:(\d+)/;

/** Por qué murió Metro antes de exponer la URL del túnel. */
export type DevClientFailure =
  /** Hipo del túnel de ngrok (su API o su servicio). Reintentable. */
  | "tunnelTransient"
  /** Falta `@expo/ngrok` en el proyecto. NO reintentable: hay que instalarlo. */
  | "ngrokMissing"
  /** Cualquier otro fallo (error de build, Metro reventado…). NO reintentable. */
  | "exited";

/**
 * Clasifica el tail del log de Metro para decidir si merece la pena reintentar.
 *
 * La distinción importa mucho y es sutil: un simple `/ngrok/i.test(tail)` daba
 * por "falta el paquete @expo/ngrok" CUALQUIER tail que mencionara ngrok —
 * incluido el de un corte del propio servicio de ngrok, cuyo mensaje dice
 * literalmente "Check the Ngrok status page for outages". Resultado: se culpaba
 * al proyecto ("instala @expo/ngrok") de una caída ajena, y no se reintentaba.
 *
 * El orden es deliberado: primero la señal INEQUÍVOCA de paquete ausente (expo
 * te dice que lo instales), y solo después las de fallo transitorio.
 */
export function classifyDevClientFailure(tail: string): DevClientFailure {
  // Expo pide explícitamente instalarlo → falta de verdad.
  if (/install\s+@expo\/ngrok/i.test(tail) || /@expo\/ngrok\s+is\s+not\s+installed/i.test(tail)) {
    return "ngrokMissing";
  }
  // Hipo conocido de la API de ngrok (respuesta sin cuerpo) o corte anunciado.
  if (/reading\s+'body'/i.test(tail) || /ngrok\s+status\s+page/i.test(tail)) {
    return "tunnelTransient";
  }
  return "exited";
}

/** Is the Metro systemd unit currently active? (`systemctl is-active`.) */
export async function metroAlive(executor: Executor, unit: string): Promise<boolean> {
  const r = await execShell(executor, `systemctl is-active ${quoteArg(unit)}`, { timeoutMs: 8_000 })
    .catch(() => null);
  return (r?.stdout ?? "").trim() === "active";
}

/** Resolve the connected SSH user + its home dir (for the systemd unit's env). */
export async function resolveUserHome(executor: Executor): Promise<{ user: string; home: string }> {
  const r = await execShell(
      executor,
      `printf '%s\\n' "$(id -un)" "$(getent passwd "$(id -un)" | cut -d: -f6)"`,
      { timeoutMs: 8_000 },
    )
    .catch(() => null);
  const [user = "", home = ""] = (r?.stdout ?? "").trim().split("\n");
  const u = user.trim() || "root";
  return { user: u, home: home.trim() || `/home/${u}` };
}

/** Last lines of the Metro log, for diagnostics when it fails to start. */
export async function tailLog(executor: Executor, logFile: string): Promise<string> {
  const inner = `tail -n 12 ${quoteArg(logFile)} 2>/dev/null`;
  const r = await execShell(executor, inner, { timeoutMs: 8_000 }).catch(() => null);
  return (r?.stdout ?? "").trim();
}

/** Lanzamientos máximos de Metro por petición (el 1º + hasta 3 reintentos). */
export const MAX_DEV_CLIENT_LAUNCHES = 4;
/** Respiro entre un intento fallido y el siguiente (deja respirar a ngrok). */
export const DEV_CLIENT_RETRY_BACKOFF_MS = 2_000;
/** Margen para que el kernel libere puertos/FDs cuando SÍ se mató algo. */
export const DEV_CLIENT_SETTLE_MS = 1_500;

/**
 * Patrones de procesos residuales de un intento anterior (Metro y su ngrok).
 *
 * ¡El corchete NO es decorativo! Todo esto se ejecuta como `sh -lc '<cuerpo>'`,
 * así que el argv del shell que lo lanza contiene LITERALMENTE estos patrones.
 * Con `pkill -f 'expo start --dev-client'`, ese pkill se encontraría a sí mismo
 * y se suicidaría a mitad de script — es exactamente el fallo que documenta el
 * comentario de `startDevClient` ("el journal mostraba stop+reset-failed pero
 * systemd-run nunca llegaba a ejecutarse"). Escribiéndolo `[e]xpo`, la regex
 * sigue casando con el proceso real ("expo start…") pero NO con el literal
 * "[e]xpo start…" que lleva el argv del propio shell.
 */
const DEV_CLIENT_RESIDUAL_PATTERNS = ["[e]xpo start --dev-client", "[n]grok"];

/**
 * Mata restos de Metro/ngrok de un intento anterior y devuelve cuántos mató.
 * Un ngrok zombi del intento fallido es justamente lo que hace que el siguiente
 * intento vuelva a fallar, así que esto corre ANTES DE CADA lanzamiento.
 */
export async function reapDevClientResiduals(executor: Executor): Promise<number> {
  const body =
    `n=0; for p in ${DEV_CLIENT_RESIDUAL_PATTERNS.map(quoteArg).join(" ")}; do ` +
    `c=$(pgrep -f "$p" 2>/dev/null | wc -l); ` +
    `if [ "$c" -gt 0 ]; then pkill -f "$p" 2>/dev/null; n=$((n+c)); fi; ` +
    `done; echo "$n"`;
  const withSudo = await injectSudoIntoShellScript(executor, body);
  const r = await execShell(executor, withSudo, { timeoutMs: 15_000 }).catch(() => null);
  return Number.parseInt((r?.stdout ?? "").trim(), 10) || 0;
}

/**
 * Run a shell command on the target with the Expo access token exported and
 * `sudo` credentials injected (sudo lives inside `sh -lc '<body>'`, hidden from
 * the executor-boundary interceptor, so we inject the password up-front).
 *
 * The token is exported via a one-shot env prefix INSIDE the script body so it
 * never appears in the outer argv. EAS reads EXPO_TOKEN for non-interactive
 * authentication.
 */
export async function runEas(
  executor: Executor,
  cwd: string,
  command: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<CliResult> {
  const token = await expoConfigService.getToken();
  // Token is set via `export` (not argv); cd into the project; then run.
  // MUST stay single-line: the managed executor proxies through the License
  // Server, which rejects commands containing control characters (newlines),
  // so the steps are joined with `;`/`&&`, never "\n".
  const body =
    `export EXPO_TOKEN=${quoteArg(token)}; export CI=1; ` +
    `cd ${quoteArg(cwd)} && ${command}`;
  const withSudo = await injectSudoIntoShellScript(executor, body);
  const result = await execShell(executor, withSudo, { timeoutMs });
  return {
    ok: result.exitCode === 0,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    url: firstUrl(`${result.stdout}\n${result.stderr}`),
  };
}

/** Plain shell on the target (no token), for scans / file probes. */
export async function sh(executor: Executor, command: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  // The `sh -lc <quoted body>` wrapping is the shared `execShell` (B-23); the
  // sudo injection has to happen FIRST because a `sudo` nested inside the body
  // is invisible to the executor-boundary interceptor.
  const body = await injectSudoIntoShellScript(executor, command);
  return execShell(executor, body, { timeoutMs });
}

/** Resolve the eas binary invocation (prefer global `eas`, fall back to npx). */
export const EAS = "eas";

export function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
