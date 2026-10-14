import { verifyWsAuthorization } from "../../../shared/websocket/live-auth.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Terminal connection service — the cohesive PHASES of a terminal WS lifecycle,
 * extracted (SOLID) from the former god-function `handleTerminalConnection`.
 *
 * The controller (`controllers/terminal.controller.ts`) is now a thin
 * orchestrator that calls these phases **in the same load-bearing order**:
 *
 *   authenticateTerminalWs  →  resolveTerminalExecutor  →  enforceHostingJail
 *   →  openTerminalPty  →  registerTerminalSession  →  wireTerminalDispatch
 *
 * This is a pure re-organisation: the same code runs in the same order and
 * sends the exact same WS messages / close codes. Failure phases do NOT touch
 * the socket themselves — they return a typed {@link WsFailure} and the
 * orchestrator performs the `send(error)` + `ws.close(code, reason)` (identical
 * observable order to the legacy inline early-returns). This keeps each phase
 * testable with plain mocks and no live WebSocket.
 *
 * NOTE (layering): this is a service, so it never imports express/ws-router.
 * It receives the `ws`/`req` as parameters. The cross-module imports (auth,
 * worklog) are pre-existing — they were already in the controller and merely
 * moved here alongside the logic that uses them.
 */

import { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import type { IncomingMessage } from "http";
import { tokenService, type TokenPayload } from "../../auth/services/token.service.js";
import { sessionManagerService } from "./session-manager.service.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { errMessage } from "../../../shared/utils/err-message.js";
import { TerminalWsMsg } from "../../../shared/terminal-ws-protocol.js";
import { localExecutor, LOCAL_TARGET_ID, getDirectExecutorByBridgeSessionId } from "../../../shared/executor/index.js";
import type { Executor } from "../../../shared/executor/index.js";
// Fase 5 — fail-closed del Terminal para sesiones hosting: la PTY de un tenant
// SOLO puede abrirse sobre un executor con privilege-drop (`sudo -u <owner>`),
// nunca como el usuario de servicio ni en el host del panel. Import directo del
// archivo (no del barrel) para no tocar el índice compartido.
import { PrivilegeDropExecutor } from "../../../shared/executor/privilege-drop-executor.js";
// Reattach (persistencia de PTY vía tmux): solo se aplica sobre DirectSSH (honra
// el comando y asigna PTY). Import directo del archivo, igual que PrivilegeDrop.
import { DirectSshExecutor } from "../../../shared/executor/direct-ssh-executor.js";
import { env } from "../../../config/env.js";
import type { PtyProcess } from "./pty.service.js";
import { resolveOverrideBridge } from "../../../shared/session/bridge-header.js";
import {
  extractOverrideBridgeId as extractWsOverrideBridgeId,
  extractWsToken,
  parseCookies,
  wsSend,
} from "../../../shared/websocket/upgrade-auth.js";
import { canExecuteCommand, hasActionPermission } from "../../../shared/auth/role-permissions.js";
import { recordActivity, subdomainFromExecutor } from "../../../shared/worklog/worklog-recorder.service.js";
import { classifyNotableCommand } from "../../../shared/worklog/worklog-taxonomy.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { resolveTerminalIdentity } from "./terminal-access.service.js";
import { quoteArg } from "../../../shared/executor/index.js";

const log = createModuleLogger("terminal:ws");

// Hard caps to keep a single WS message from blocking the event loop or growing
// per-session memory without bound. A terminal keystroke/paste is tiny; anything
// past 256 KiB is abusive (WsRouter's default maxPayload is 100 MiB). The
// command buffer only needs to hold one shell line for the role policy check.
const MAX_TERMINAL_MESSAGE_BYTES = 256 * 1024;
const MAX_COMMAND_BUFFER_LEN = 8 * 1024;

// ──────────────────────────────────────────────────────────────────────────
// Pure request/ws helpers (already extracted; kept here next to the phases
// that use them). Exported for characterization tests.
// ──────────────────────────────────────────────────────────────────────────

// parseCookies / extractOverrideBridgeId / extractToken / send now live in
// `shared/websocket/upgrade-auth.ts` (they were copy-pasted in four WS
// endpoints). Re-exported under the historical names so the characterization
// tests and the phase code below keep their call sites.
export { parseCookies };
export const extractOverrideBridgeId = extractWsOverrideBridgeId;

/**
 * Extrae + sanea un `sessionId` provisto por el cliente (opt-in de reattach).
 * Su presencia ACTIVA la persistencia tmux; sin él, comportamiento legacy intacto.
 * Solo `[A-Za-z0-9_-]`, 8–64 chars (apto para nombre de sesión tmux y shell-quote).
 */
export function extractClientSessionId(req: IncomingMessage): string | null {
  const url = new URL(req.url ?? "/", "http://localhost");
  const raw = url.searchParams.get("sessionId");
  if (!raw) return null;
  const clean = raw.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  return clean.length >= 8 ? clean : null;
}

/**
 * Extract a JWT token for the WS upgrade.
 *
 * SECURITY: prefers the session cookie. The `?token=` query param is a fallback
 * for the cross-origin WS paths (direct :port) where the browser does NOT send
 * the same-origin session cookie on the upgrade; in those cases the client mints
 * a SHORT-LIVED `ws-token` (`/api/auth/ws-token`) for the URL — never the
 * long-lived session JWT. The query-param token is consumed only here and is
 * NEVER logged (the WS log lines carry userId/username/sessionId, not the
 * token). Do not add the token to any log payload.
 */
export const extractToken = extractWsToken;

/** Send a JSON message to a WebSocket client, swallowing errors if closed. */
export const send = wsSend;

type StreamLikePty = import("node:stream").Duplex & {
  resize?: (cols: number, rows: number) => void;
  kill?: (signal?: string) => void;
};

export function createPtyFromStream(stream: StreamLikePty): PtyProcess {
  const dataListeners: Array<(data: string) => void> = [];
  const exitListeners: Array<(code: number, signal: number) => void> = [];
  let exited = false;

  function emitExit(code: number, signal: number): void {
    if (exited) return;
    exited = true;
    for (const cb of exitListeners) cb(code, signal);
  }

  stream.on("data", (chunk) => {
    const text = Buffer.isBuffer(chunk) ? chunk.toString("utf-8") : String(chunk);
    for (const cb of dataListeners) cb(text);
  });

  stream.on("close", () => {
    emitExit(0, 0);
  });

  stream.on("end", () => {
    emitExit(0, 0);
  });

  stream.on("error", () => {
    emitExit(1, 0);
  });

  return {
    pid: 0,
    write(data: string) {
      stream.write(data);
    },
    resize(_cols: number, _rows: number) {
      stream.resize?.(_cols, _rows);
    },
    kill() {
      stream.kill?.("SIGHUP");
      stream.end();
    },
    onData(cb) {
      dataListeners.push(cb);
    },
    onExit(cb) {
      exitListeners.push(cb);
    },
  };
}

/**
 * Spawn a REAL PTY on the panel host for a LOCAL session (`localExecutor`).
 *
 * Why not `localExecutor.spawn`: it uses `child_process.spawn` with piped stdio
 * (no controlling TTY), so bash runs NON-interactive → never emits PS1 → the
 * client shows "conectado" but a blank screen with no prompt, and the pid the
 * stream adapter reports is a hardcoded `0`. A node-pty allocates a real pty, so
 * bash is interactive (prompt + job control) and the pid is the real shell pid.
 *
 * node-pty is a native addon; it's lazily `import()`ed (same as
 * `local-auth.service.ts`) so it is NOT loaded by vitest (pool: "threads") — the
 * terminal unit tests exercise the phase functions with plain mocks and never
 * reach this local branch. The returned object implements {@link PtyProcess}
 * with the SAME shape the rest of this service consumes (onData→WS output,
 * resize from the client frame, kill on close), so the dispatch code is unchanged.
 */
async function spawnLocalPty(username: string, switchUser: boolean, clientManagesCli = false): Promise<PtyProcess> {
  const pty = await import("node-pty");

  // node-pty's env must be `{ [k]: string }`; process.env has `| undefined`.
  const ptyEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") ptyEnv[k] = v;
  }
  ptyEnv.TERM = "xterm-256color";
  if (clientManagesCli) ptyEnv.NO_LXP_CLI_AUTOSTART = "1";

  const child = pty.spawn(switchUser ? "sudo" : env.TERMINAL_SHELL,
    switchUser ? ["-n", "-u", username, "-H", "--", ...(clientManagesCli ? ["env", "NO_LXP_CLI_AUTOSTART=1"] : []), env.TERMINAL_SHELL] : [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: switchUser ? "/" : (process.env.HOME || "/"),
    env: ptyEnv,
  });

  return {
    pid: child.pid,
    write(data: string) {
      child.write(data);
    },
    resize(cols: number, rows: number) {
      // node-pty throws on a 0-sized resize; clamp to at least 1x1.
      try {
        child.resize(Math.max(1, cols), Math.max(1, rows));
      } catch {
        /* pty already exited */
      }
    },
    kill(signal?: string) {
      try {
        child.kill(signal);
      } catch {
        /* already gone */
      }
    },
    onData(cb) {
      child.onData(cb);
    },
    onExit(cb) {
      child.onExit(({ exitCode, signal }) => cb(exitCode, signal ?? 0));
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Phase result types
// ──────────────────────────────────────────────────────────────────────────

/**
 * A terminal-setup failure decided by a phase. The orchestrator turns this into
 * the exact legacy `send({type:"error"})` + `ws.close(code, reason)` pair — the
 * phase itself never touches the socket, so it stays trivially testable.
 */
export interface WsFailure {
  message: string;
  code: number;
  reason: string;
}

/** Authenticated identity + session ids produced by the auth phase. */
export interface TerminalAuth {
  payload: TokenPayload;
  sessionUser: SessionUser;
  sessionId: string;
  clientSessionId: string | null;
}

// ──────────────────────────────────────────────────────────────────────────
// Phase 1 — Auth
// ──────────────────────────────────────────────────────────────────────────

/**
 * Authenticate the WS upgrade: token → verify → `terminal.open` permission, and
 * compute the (re)attach session id. Legacy lines were the `--- Auth ---` block.
 */
export async function authenticateTerminalWs(
  req: IncomingMessage,
): Promise<{ ok: true; auth: TerminalAuth } | { ok: false; failure: WsFailure }> {
  const token = extractToken(req);
  if (!token) {
    return { ok: false, failure: { message: "Authentication required", code: 1008, reason: "Unauthorized" } };
  }

  const payload = await verifyWsAuthorization(req);
  if (!payload) {
    return { ok: false, failure: { message: "Invalid or expired session", code: 1008, reason: "Unauthorized" } };
  }

  const sessionUser = tokenService.toSessionUser(payload);
  if ((payload.kind !== "admin" && !(sessionUser.hostingPolicy?.runtime && sessionUser.hostingPolicy.state === "ready" && sessionUser.hostingPolicy.security?.shell === "jailed")) || !hasActionPermission(sessionUser, "terminal.open")) {
    return { ok: false, failure: { message: "Insufficient permissions", code: 1008, reason: "Forbidden" } };
  }

  // Opt-in de reattach: si el cliente manda un sessionId estable, lo reusamos
  // (mismo nombre de sesión tmux → re-adjunta). Si no, sessionId nuevo (legacy).
  const clientSessionId = extractClientSessionId(req);
  const sessionId = clientSessionId ?? uuidv4();
  log.info({ sessionId, reattach: Boolean(clientSessionId), userId: payload.userId, username: payload.username }, "Terminal WS connect");

  return { ok: true, auth: { payload, sessionUser, sessionId, clientSessionId } };
}

// ──────────────────────────────────────────────────────────────────────────
// Phase 2 — Executor resolution (per-tab override / direct cookie / local)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Select the {@link Executor} that will back the PTY. Fail-closed: an override
 * or direct-SSH session whose cached creds no longer resolve must NOT open a
 * shell on the panel host. Legacy lines were the `--- Spawn PTY ---` executor
 * selection block (up to, but excluding, the jail check).
 */
export async function resolveTerminalExecutor(
  payload: TokenPayload,
  req: IncomingMessage,
  sessionId: string,
): Promise<{ ok: true; executor: Executor } | { ok: false; failure: WsFailure }> {
  // Per-tab override: if THIS tab sent its own bridge id (query param `bridge`),
  // resolve the executor from that id instead of the shared cookie's
  // bridgeSessionId. The shared session cookie is rewritten on every server
  // switch, so without this override a second tab would open a PTY on the wrong
  // server. `resolveOverrideBridge` NEVER throws and returns null when there's
  // no usable override (absent | equals cookie | unresolvable) → current flow.
  const overrideBridgeId = extractOverrideBridgeId(req);
  const override = await resolveOverrideBridge(overrideBridgeId, {
    userId: payload.userId,
    bridgeSessionId: payload.bridgeSessionId,
  });
  if (overrideBridgeId && overrideBridgeId !== payload.bridgeSessionId && !override) {
    return { ok: false, failure: { message: "Sesión del servidor expirada o no autorizada.", code: 1008, reason: "Invalid bridge override" } };
  }

  // Executor selection for the PTY:
  //  - Per-tab DIRECT override (a target switched from the `servers` vault) →
  //    that node's DirectSshExecutor (fail-closed if its session expired).
  //  - A `direct` session (bridge id with cached SSH creds) → same.
  //  - A `local` session (panel manages the box it runs on) → localExecutor.
  let executor: Executor;
  if (override) {
    // Per-tab DIRECT override: fail-closed — an override id that no longer
    // resolves to cached SSH creds must NOT open a shell on the panel host.
    const direct = await getDirectExecutorByBridgeSessionId(
      override.bridgeSessionId,
      override.targetId,
      override.targetName,
    );
    if (!direct) {
      log.warn({ sessionId, bridgeSessionId: override.bridgeSessionId }, "Per-tab direct executor unresolved — refusing to fall back to panel host");
      return { ok: false, failure: { message: "Sesión del servidor expirada. Reconéctate al servidor desde el panel.", code: 1008, reason: "Bridge session expired" } };
    }
    executor = direct;
  } else if (payload.bridgeSessionId && !payload.local && payload.targetId !== "local") {
    // Direct-SSH cookie session: reuse the cached connection; fail closed if
    // it no longer resolves (do NOT open a PTY on the panel host).
    //
    // `targetId !== "local"`: mirror the HTTP middleware's default. Tokens
    // minted before the ws-token endpoint propagated `local`/`direct` carry a
    // bridgeSessionId but NEITHER flag, and this branch treated them as
    // direct-SSH → unresolvable creds → "Sesión del servidor expirada" loop.
    // For `targetId: "local"` (the sentinel auth.service mints for sessions
    // managing the panel's own box — vault ids are store-generated and can
    // never be "local") the fail-closed concern doesn't apply: the PTY target
    // IS the panel host, so falling through to localExecutor is the correct
    // resolution, not a privilege escalation.
    const direct = await getDirectExecutorByBridgeSessionId(payload.bridgeSessionId);
    if (!direct) {
      log.warn({ sessionId, bridgeSessionId: payload.bridgeSessionId }, "Direct executor unresolved — refusing to fall back to panel host");
      return { ok: false, failure: { message: "Sesión del servidor expirada. Reconéctate al servidor desde el panel.", code: 1008, reason: "Bridge session expired" } };
    }
    executor = direct;
  } else if (payload.local === true || payload.targetId === LOCAL_TARGET_ID) {
    // Local session: the panel manages the server it runs on. Requires an
    // EXPLICIT local signal in the token (`local: true` or the `local` target
    // sentinel). Fail-open guard: a token that carries NEITHER a resolvable
    // bridge NOR an explicit local claim must NOT open a REAL PTY on the panel
    // host — reject with the same 1008 mechanism the direct branches use.
    executor = localExecutor;
  } else {
    log.warn(
      { sessionId, userId: payload.userId, username: payload.username, targetId: payload.targetId },
      "Terminal WS: token carries no resolvable bridge and no explicit local claim — refusing to open a PTY on the panel host",
    );
    return { ok: false, failure: { message: "Sesión sin servidor seleccionado. Reconéctate al servidor desde el panel.", code: 1008, reason: "No server selected" } };
  }

  if (payload.hostingPolicy?.runtime) {
    if (overrideBridgeId && overrideBridgeId !== payload.bridgeSessionId) return { ok: false, failure: { message: "Hosting cannot change servers", code: 1008, reason: "Forbidden" } };
    const service = executor instanceof PrivilegeDropExecutor ? executor.trustedServiceExecutorFor(payload.owner ?? "") : executor;
    if (!service || !payload.owner || payload.homeRoot !== `/home/${payload.owner}`) return { ok: false, failure: { message: "Invalid hosting identity", code: 1008, reason: "Forbidden" } };
    const dropped = new PrivilegeDropExecutor(service, payload.username, payload.homeRoot, true, payload.owner);
    dropped.configureHostingRuntime(payload.username);
    executor = dropped;
  }
  return { ok: true, executor };
}

// ──────────────────────────────────────────────────────────────────────────
// Phase 3 — Hosting jail (fail-closed chroot for tenant sessions)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Fase 5: jaula (chroot) fail-closed para sesiones hosting. Devuelve una
 * {@link WsFailure} si la sesión hosting no puede abrir shell (executor no es
 * privilege-drop, o la jaula esperada no está aprovisionada); `null` = pasa.
 * Non-hosting sessions siempre pasan. Legacy lines were the
 * `--- Fase 5: jaula (chroot) ---` block.
 */
export async function enforceHostingJail(
  executor: Executor,
  payload: TokenPayload,
  sessionId: string,
): Promise<WsFailure | null> {
  if (payload.hostingPolicy?.runtime) return executor instanceof PrivilegeDropExecutor && executor.willJailInteractiveShell && payload.hostingPolicy.state === "ready" && payload.hostingPolicy.security?.shell === "jailed" ? null : { message: "Hosting jail unavailable", code: 1008, reason: "Forbidden" };
  if (payload.kind !== "hosting" && payload.tenantId === undefined) return null;

  if (!(executor instanceof PrivilegeDropExecutor)) {
    log.warn(
      { sessionId, userId: payload.userId, username: payload.username, target: executor.target.id },
      "Hosting terminal: executor is not privilege-drop — refusing to open an un-dropped shell",
    );
    return {
      message:
        "No se pudo abrir una terminal aislada para tu cuenta. Reconéctate desde el panel; " +
        "si el problema persiste, contacta a tu proveedor de hosting.",
      code: 1008,
      reason: "Hosting terminal not privilege-dropped",
    };
  }

  // ¿Jaula prevista? Fail-closed por defecto: la jaula es la frontera de
  // aislamiento de shell del producto multi-tenant. `HOSTING_TERMINAL_REQUIRE_JAIL`
  // (default true) la EXIGE para toda sesión hosting, con independencia del
  // opt-in por cuenta (`payload.jailEnabled`) o de `JAIL_SHELL_ENABLED` — de lo
  // contrario un owner con privilege-drop pero SIN chroot podría recorrer `/`
  // y leer rutas world-readable de otros tenants/VPS. Solo cuando el operador
  // desactiva explícitamente el requisito (entornos no multi-tenant) se respeta
  // el opt-in heredado, y conceder una shell hosting SIN jaula queda auditado.
  const jailExpected = env.HOSTING_TERMINAL_REQUIRE_JAIL
    ? true
    : (payload.jailEnabled ?? env.JAIL_SHELL_ENABLED);
  if (!jailExpected) {
    // Auditar (WARN accionable) la concesión de una shell hosting SIN jaula:
    // no debe pasar silenciosamente. Es el único camino que omite el chroot.
    log.warn(
      { sessionId, userId: payload.userId, username: payload.username, target: executor.target.id },
      "Hosting terminal granted WITHOUT chroot jail (HOSTING_TERMINAL_REQUIRE_JAIL=false) — shell-isolation boundary disabled by explicit policy",
    );
  }
  if (jailExpected) {
    // Verificar que el login shell del owner es jk_chrootsh (jaula efectiva).
    // El executor corre como el owner (privilege-drop); `getent passwd` del
    // propio usuario funciona sin sudo. Si no podemos confirmarlo → rechazar.
    let ownerShell = "";
    try {
      const out = await executor.exec(`getent passwd "$(id -un)" | cut -d: -f7`);
      ownerShell = out.exitCode === 0 ? out.stdout.trim() : "";
    } catch (err) {
      log.warn({ sessionId, err: String(err) }, "Hosting terminal: jail probe failed");
    }
    const jailShell = env.JAIL_TOOL_PATH;
    if (ownerShell !== jailShell) {
      log.warn(
        { sessionId, username: payload.username, ownerShell, expected: jailShell },
        "Hosting terminal: jail expected but owner login shell is not jk_chrootsh — refusing un-jailed shell",
      );
      return {
        message:
          "Tu terminal aislada aún no está lista en el servidor. Pide a tu proveedor que " +
          "(re)aprovisione la jaula de tu cuenta e inténtalo de nuevo.",
        code: 1008,
        reason: "Hosting jail not provisioned",
      };
    }
  }

  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// Phase 4 — Open PTY (tmux reattach decision + spawn)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Decide tmux persistence (reattach) and spawn the PTY. Legacy lines were the
 * `--- Persistencia opcional vía tmux ---` block + the tmux-decision log + the
 * PTY spawn `try/catch`.
 */
export async function openTerminalPty(
  executor: Executor,
  payload: TokenPayload,
  clientSessionId: string | null,
  sessionId: string,
  clientManagesCli = false,
): Promise<{ ok: true; pty: PtyProcess; reattached: boolean } | { ok: false; failure: WsFailure }> {
  const identity = await resolveTerminalIdentity(executor, payload);
  if (!identity) {
    return { ok: false, failure: { message: "Terminal requiere una cuenta administradora del grupo sudo en este servidor.", code: 1008, reason: "Terminal identity denied" } };
  }
  const asUser = (command: string) => identity.switchUser
    ? `sudo -n -u ${quoteArg(identity.username)} -H -- sh -lc ${quoteArg(command)}`
    : command;
  // --- Persistencia opcional vía tmux (reattach) ---
  // Aplica cuando: el cliente opta (clientSessionId), NO es hosting (la ruta
  // hosting va enjaulada/fail-closed y la dejamos intacta) y el executor honra
  // `spawn(cmd,args)` con PTY: DirectSshExecutor (clave de usuario) o
  // PrivilegeDropExecutor en modo NORMAL (clave de servicio, privilege-drop SIN
  // jaula → `sudo -u <owner> -H tmux …`). Se EXCLUYE cualquier PrivilegeDrop que
  // vaya a jaula (`spawn` ignora cmd/args y abre la login shell jk_chrootsh: el
  // tmux nunca correría y el probe mentiría). LicenseProxy ignora el comando y
  // local no tiene TTY, así que ninguno de esos entra. El shell corre dentro de
  // `tmux new-session -A` (attach-or-create): al cerrar el WS, el SIGHUP DETACHA
  // el cliente tmux (la sesión sobrevive en el daemon); un reattach con el mismo
  // sessionId re-adjunta y tmux re-pinta el scrollback. El nombre va namespaced
  // por userId → un usuario no puede adjuntar al de otro (salvo que el panel
  // comparta la MISMA cuenta SSH remota — verificar).
  let usingTmux = false;
  let tmuxName = "";
  let reattached = false;
  const tmuxCapableExecutor =
    executor instanceof DirectSshExecutor
    || executor instanceof PrivilegeDropExecutor;
  const interactiveShellWillJail =
    executor instanceof PrivilegeDropExecutor && executor.willJailInteractiveShell;
  if (clientSessionId && payload.kind !== "hosting" && tmuxCapableExecutor && !interactiveShellWillJail) {
    try {
      const probe = await executor.exec(asUser("command -v tmux >/dev/null 2>&1 && printf ok"));
      usingTmux = probe.exitCode === 0 && probe.stdout.trim() === "ok";
    } catch {
      usingTmux = false;
    }
    if (usingTmux) {
      tmuxName = `lxp_${payload.userId}_${clientSessionId}`;
      // ¿La sesión tmux ya existe? Entonces es un RE-ADJUNTE: el cliente NO debe
      // re-hacer `cd` ni re-lanzar el comando de modo (corrompería un TUI vivo).
      try {
        const has = await executor.exec(asUser(`tmux has-session -t "${tmuxName}" 2>/dev/null && printf yes`));
        reattached = has.stdout.trim() === "yes";
      } catch {
        reattached = false;
      }
    }
  }

  // Diagnóstico: por qué (no) se usa tmux para este panel. `executor.constructor.name`
  // distingue DirectSshExecutor / PrivilegeDropExecutor / LicenseProxyExecutor / Local.
  log.info(
    {
      sessionId,
      kind: payload.kind,
      executor: (executor as { constructor?: { name?: string } })?.constructor?.name,
      hasClientSessionId: Boolean(clientSessionId),
      tmuxCapable: tmuxCapableExecutor,
      willJail: interactiveShellWillJail,
      usingTmux,
      reattached,
      tmuxName: tmuxName || undefined,
    },
    "Terminal tmux decision",
  );

  let pty;
  try {
    if (executor === localExecutor) {
      // LOCAL session (panel host): a real PTY, not `localExecutor.spawn` (piped
      // stdio → non-interactive bash, no prompt, pid 0). `usingTmux` is always
      // false here (localExecutor is neither DirectSsh nor PrivilegeDrop).
      pty = await spawnLocalPty(identity.username, identity.switchUser, clientManagesCli);
    } else {
      // The panel sends its saved startup command once, after WS connected.
      // Suppress the managed bashrc block for these sessions only (including
      // dedicated shells for snippets/install/history) to avoid double launch.
      const command = usingTmux ? "tmux" : clientManagesCli ? "env" : env.TERMINAL_SHELL;
      const args = usingTmux
        ? ["-u", "new-session", "-A", "-s", tmuxName, ...(clientManagesCli ? ["env", "NO_LXP_CLI_AUTOSTART=1", env.TERMINAL_SHELL] : [])]
        : clientManagesCli ? ["NO_LXP_CLI_AUTOSTART=1", env.TERMINAL_SHELL] : [];
      pty = identity.switchUser
        ? createPtyFromStream(executor.spawn("sudo", ["-n", "-u", identity.username, "-H", "--", command, ...args]))
        : createPtyFromStream(executor.spawn(command, args));
    }
  } catch (err) {
    // Don't reflect raw error text (may carry command/stderr) to the client.
    log.error({ err }, "Failed to spawn PTY");
    return { ok: false, failure: { message: "No se pudo iniciar la terminal.", code: 1011, reason: "PTY spawn failed" } };
  }

  return { ok: true, pty, reattached };
}

// ──────────────────────────────────────────────────────────────────────────
// Phase 5 — Register session (enforce concurrency cap)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Register the PTY session with the session manager. On the concurrency-cap
 * error the PTY is killed here (matching the legacy order: kill → then the
 * orchestrator sends the error + closes 1013). Returns `null` on success.
 */
export function registerTerminalSession(args: {
  ws: WebSocket;
  pty: PtyProcess;
  sessionId: string;
  payload: TokenPayload;
}): WsFailure | null {
  const { ws, pty, sessionId, payload } = args;
  try {
    sessionManagerService.add({
      sessionId,
      userId: payload.userId,
      username: payload.username,
      pty,
      ws,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    });
  } catch (err) {
    const msg = errMessage(err);
    pty.kill();
    return { message: msg, code: 1013, reason: "Session limit reached" };
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// Phase 6 — Wire dispatch (connected + PTY↔WS message routing + close/error)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Wire the live session: notify `connected`, pipe PTY output → WS, and route WS
 * messages → PTY (input with role command-policy + notable-command worklog,
 * resize, ping/pong). Also wires PTY exit and WS close/error to the session
 * manager. No failure path — this is the steady-state of an accepted session.
 * Legacy lines were everything from `--- Notify client ---` to the end.
 */
export function wireTerminalDispatch(args: {
  ws: WebSocket;
  pty: PtyProcess;
  sessionId: string;
  sessionUser: SessionUser;
  payload: TokenPayload;
  executor: Executor;
  reattached: boolean;
}): void {
  const { ws, pty, sessionId, sessionUser, payload, executor, reattached } = args;

  // --- Notify client ---
  // `reattached` avisa al cliente que esta sesión ya existía (tmux) → no re-cd
  // ni re-lanzar el comando de modo.
  send(ws, { type: "connected", sessionId, pid: pty.pid, reattached });
  let commandBuffer = "";

  // --- PTY output → WebSocket ---
  pty.onData((data) => {
    sessionManagerService.touch(payload.userId, sessionId);
    send(ws, { type: TerminalWsMsg.OUTPUT, data });
  });

  // --- PTY exit → WebSocket ---
  pty.onExit((code) => {
    log.info({ sessionId, code }, "PTY process exited");
    send(ws, { type: "exit", code });
    sessionManagerService.close(payload.userId, sessionId, "process-exit");
  });

  // --- WebSocket messages → PTY ---
  ws.on("message", (raw) => {
    sessionManagerService.touch(payload.userId, sessionId);

    // Reject oversized frames before we allocate a string / iterate char-by-char
    // (event-loop DoS + per-session memory growth).
    const rawSize = Buffer.isBuffer(raw) ? raw.length : Buffer.byteLength(String(raw));
    if (rawSize > MAX_TERMINAL_MESSAGE_BYTES) {
      send(ws, { type: "error", message: "Message too large" });
      return;
    }

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: "error", message: "Invalid message format" });
      return;
    }

    switch (msg.type) {
      case "input": {
        const data = typeof msg.data === "string" ? msg.data : "";
        if (!data) break;

        // Keep terminal escape sequences together. Writing each character as a
        // separate SSH/PTTY write lets a TUI time out after ESC and interpret
        // the rest of an arrow key or mouse report as ordinary text.
        let pendingInput = "";
        const flushInput = () => {
          if (pendingInput) pty.write(pendingInput);
          pendingInput = "";
        };

        for (const ch of data) {
          if (ch === "\r" || ch === "\n") {
            const command = commandBuffer.trim();
            commandBuffer = "";

            if (command.length > 0 && !canExecuteCommand(sessionUser, command)) {
              flushInput();
              pty.write("\u0003");
              send(ws, {
                type: TerminalWsMsg.OUTPUT,
                data: `\r\n[policy] Comando bloqueado por permisos del rol: ${command}\r\n`,
              });
              continue;
            }

            // Worklog: only NOTABLE commands (installs, restarts, deploys…)
            // — never ordinary shell usage. WS handlers run outside the
            // request ALS scope, so identity is passed explicitly. Fail-open.
            if (command.length > 0) {
              const notable = classifyNotableCommand(command);
              if (notable) {
                void recordActivity({
                  module: "terminal",
                  action: "notable_command",
                  category: notable.category,
                  detail: command.slice(0, 120),
                  linuxUsername: payload.username,
                  accessSubdomain: subdomainFromExecutor(executor) ?? undefined,
                });
              }
            }

            pendingInput += ch;
            flushInput();
            continue;
          }

          if (ch === "\u007f") {
            commandBuffer = commandBuffer.slice(0, -1);
            pendingInput += ch;
            continue;
          }

          if (ch === "\u0003" || ch === "\u0015") {
            commandBuffer = "";
            pendingInput += ch;
            continue;
          }

          // Bound the buffer: it only feeds the per-line role policy check, so a
          // very long line (paste with no newline) must not grow it unbounded.
          if (commandBuffer.length < MAX_COMMAND_BUFFER_LEN) commandBuffer += ch;
          pendingInput += ch;
        }
        flushInput();
        break;
      }

      case "resize": {
        const cols = typeof msg.cols === "number" ? msg.cols : 80;
        const rows = typeof msg.rows === "number" ? msg.rows : 24;
        pty.resize(cols, rows);
        break;
      }

      case "ping":
        send(ws, { type: TerminalWsMsg.PONG });
        break;

      default:
        send(ws, { type: "error", message: `Unknown message type: ${String(msg.type)}` });
    }
  });

  // --- WebSocket close → kill PTY ---
  ws.on("close", (code, reason) => {
    log.info(
      { sessionId, code, reason: reason.toString() },
      "Terminal WS disconnected",
    );
    sessionManagerService.close(payload.userId, sessionId, "ws-close");
  });

  ws.on("error", (err) => {
    log.error({ sessionId, err }, "Terminal WS error");
    sessionManagerService.close(payload.userId, sessionId, "ws-error");
  });
}
