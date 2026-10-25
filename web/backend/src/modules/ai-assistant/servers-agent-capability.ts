// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Cross-server — AI agent capability.
 *
 * Lets a project-scoped chat run commands and read files on OTHER server
 * connections the user owns (the ones picked in the bottom-left server
 * selector and associated to the project), not just the currently-connected
 * server the agent's shell runs on.
 *
 * How it reaches another server WITHOUT a second login: it decrypts the target's
 * credentials from LUXIPANEL's single SSH vault (`modules/servers`, the same one
 * the sidebar server-selector uses) and builds a sudo-wrapped `DirectSshExecutor`
 * against it. Nothing touches LP-LICENSE-SERVER. The vault also carries the
 * approved host-key fingerprint, so the connection pins the host key and fails
 * closed on mismatch.
 *
 * Optional panel-to-panel MCP (flag `PANEL_PEER_MCP_ENABLED`, off by default):
 * when a target is flagged `hasLuxipanel` and paired, the op is sent to the
 * target's own MCP endpoint (`/api/ai/mcp/peer`, which runs it on the target and
 * records it in the target's audit) instead of raw SSH, falling back to SSH on
 * any transport error. The interactive per-command confirmation is on THIS side
 * (servers.exec is `kind: "action"`); the target does not re-prompt.
 *
 * Scope/identity: handlers read the pinned `SessionUser` from the request /
 * MCP-loopback context (`getContextUser()`). Before handing out material the
 * capability re-checks the SAME ownership rule as the sidebar switch
 * (`userMayUseTarget`): the agent can only ever reach servers this user could
 * switch to themselves (global targets honoring the allowlist, or the user's own
 * private targets; admins any). A disabled or unapproved-fingerprint target
 * yields a clear, actionable error instead of a silent fallback.
 *
 * Gating: `moduleId: "servers"` has no sidebar mapping, so
 * `assistantModulesService.allowedTools` treats it as ADMIN-ONLY for
 * non-admins — cross-server execution is privileged by default. The `exec`
 * tool is `kind: "action"` ⇒ the chat asks the user to confirm before each
 * run. Which servers a project may use is communicated to the agent via the
 * per-chat "Servidores asociados" context block (see agent.service); the hard
 * security boundary is the vault ownership check.
 */

import type { AgentCapability } from "../../shared/agent-capability/index.js";
import { EXEC_DEFAULT_TIMEOUT_MS, EXEC_TIMEOUT_CAP_MS } from "../../shared/constants.js";
import { getContextExecutor, getContextUser, type Executor } from "../../shared/executor/index.js";
import { isAbsoluteUnixPath } from "../../shared/utils/posix-path.js";
import { DirectSshExecutor } from "../../shared/executor/direct-ssh-executor.js";
import { wrapExecutorWithSudo } from "../../shared/executor/sudo-exec-wrap.js";
import { assistantAuditRepository } from "./repositories/assistant-audit.repository.js";
import { targetsRepository, userMayUseTarget } from "../servers/index.js";
import { PanelPeerMcpClient } from "./services/panel-peer-mcp-client.js";
import { env } from "../../config/env.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { ServerAccessError, serverToolError, type ServerToolErrorContext } from "./services/server-tool-error.js";
import { isBuildOrDeployCommand, withAssistantBuildLease } from "../../shared/assistant-build-lease.js";

const log = createModuleLogger("servers-capability");

const EXEC_MAX_TIMEOUT_MS = EXEC_TIMEOUT_CAP_MS;
const READ_MAX_BYTES = 65_536; // 64 KiB — mirrors files.read

// Tool results re-enter the model context on EVERY subsequent turn of the run
// loop, so an unbounded exec output multiplies its token cost. Head+tail keeps
// both the start (banner/first error) and the end (exit summary) visible.
const EXEC_STDOUT_MAX_CHARS = 16_000;
const EXEC_STDERR_MAX_CHARS = 8_000;

/** Head+tail truncation with an explicit marker (no-op on short strings). */
function capExecOutput(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = Math.floor(max * 0.6);
  const tail = max - head;
  return `${text.slice(0, head)}\n…[recortado ${text.length - max} caracteres]…\n${text.slice(-tail)}`;
}

/** Charset for a registered-server id (UUID-ish). */
function isValidServerId(id: string): boolean {
  return /^[A-Za-z0-9._:-]{1,128}$/.test(id);
}

/** The viewer identity for vault authorization, from the pinned session user. */
function contextViewer(): { userId: number | null; isAdmin: boolean } {
  const u = getContextUser();
  return {
    userId: typeof u?.userId === "number" ? u.userId : null,
    isAdmin: u?.kind === "admin",
  };
}

/**
 * How the agent will reach an associated server:
 *  - `ssh`  — a sudo-wrapped DirectSshExecutor from the single vault (always
 *    available; the transport of record and the fallback).
 *  - `peer` — a panel-to-panel MCP client to the target's own LUXIPANEL, used
 *    PREFERENTIALLY when the target is flagged `hasLuxipanel`, a peer credential
 *    is paired, and `PANEL_PEER_MCP_ENABLED` is on. On any transport error the
 *    caller falls back to `ssh`.
 */
interface ServerAccess {
  ssh: Executor;
  peer: PanelPeerMcpClient | null;
  targetName: string;
}

/**
 * Resolve access to a server in LUXIPANEL's single SSH vault (`modules/servers`).
 * Credentials are decrypted from the panel-host sidecar (nothing touches
 * LP-LICENSE-SERVER) and the approved host-key fingerprint is pinned. Fails
 * closed — not registered / disabled / unapproved-fingerprint /
 * not-permitted-for-this-user all throw an actionable error.
 */
async function resolveServerAccess(serverId: string): Promise<ServerAccess> {
  // The vault is pinned to localExecutor internally; no context executor needed.
  const found = await targetsRepository.getMaterial(serverId);
  if (!found) {
    throw new ServerAccessError("SERVER_NOT_REGISTERED",
      `Servidor no registrado: '${serverId}'. Regístralo en Ajustes → Servidores ` +
        "(nombre, IP, usuario, contraseña o llave) antes de operar en él.",
    );
  }
  const { target, material } = found;
  if (!userMayUseTarget(target, contextViewer())) {
    throw new ServerAccessError("SERVER_ACCESS_DENIED", `No tienes permiso para operar en el servidor '${target.name}'.`);
  }
  if (target.enabled === false) {
    throw new ServerAccessError("SERVER_DISABLED", `El servidor '${target.name}' está deshabilitado en Ajustes → Servidores.`);
  }
  if (!target.hostFingerprint) {
    throw new ServerAccessError("SERVER_IDENTITY_APPROVAL_REQUIRED",
      `El fingerprint del host de '${target.name}' no está aprobado. Ve a Ajustes → Servidores, ` +
        "ejecuta 'Probar' y aprueba el fingerprint antes de operar en él.",
    );
  }
  const ssh = wrapExecutorWithSudo(new DirectSshExecutor(serverId, target.name || material.host, material));

  // Panel-to-panel MCP is opt-in (flag off by default = today's behavior).
  let peer: PanelPeerMcpClient | null = null;
  if (env.PANEL_PEER_MCP_ENABLED && target.hasLuxipanel && target.luxipanelBaseUrl) {
    const cred = await targetsRepository.getPeerCredential(serverId).catch(() => null);
    if (cred) peer = new PanelPeerMcpClient(target.luxipanelBaseUrl, cred);
  }
  return { ssh, peer, targetName: target.name };
}

/**
 * Write ONE cross-server access record into the connected server's assistant
 * audit sidecar (`${LUXIPANEL_CONFIG_DIR}/assistant/audit.json`, 0600 — the
 * Access tab reads it). Built ENTIRELY from LUXIPANEL's local registry: the
 * acting panel user and the registered server's name/IP/linux-user. Credentials,
 * commands and command output must never be copied into the audit sidecar.
 * Best-effort: logging never fails the tool.
 */
async function recordCrossServerAccess(args: {
  tool: string;
  serverId: string;
  command: string;
  success: boolean;
  durationMs: number;
  outputPreview?: string;
}): Promise<void> {
  const user = getContextUser();
  try {
    const ctx = getContextExecutor();
    const target = await targetsRepository.getView(args.serverId).catch(() => null);
    await assistantAuditRepository.append(
      {
        ts: new Date().toISOString(),
        provider: "servers:cross",
        tool: args.tool,
        success: args.success,
        durationMs: args.durationMs,
        userId: user?.userId != null ? String(user.userId) : undefined,
        username: user?.username,
        kind: "cross-server",
        targetServerId: args.serverId,
        targetServerName: target?.name,
        targetHost: target?.host,
        ...(target?.username ? { linuxUser: target.username } : {}),
      },
      ctx,
    );
  } catch (err) {
    log.warn({ err, tool: args.tool, serverId: args.serverId }, "Failed to record cross-server access");
  }
}

function failureResult(tool: string, error: unknown, context: ServerToolErrorContext) {
  const output = serverToolError(error, context);
  // Never copy raw errors, commands, credentials or file contents to the log.
  log.warn({ tool, serverId: context.serverId, code: output.code, operationStatus: output.operationStatus }, "Associated server operation failed");
  return { ok: false, output };
}

export const serversAgentCapability: AgentCapability = {
  moduleId: "servers",
  version: 1,
  tools: [
    {
      name: "servers.exec",
      title: "Ejecutar en servidor asociado",
      description:
        "Run a shell command on ANOTHER server connection associated with this project " +
        "(NOT the currently-connected server). Pass `serverId` (the id listed in the project's " +
        "'Servidores asociados' context block) and the `command`. Returns stdout, stderr and the " +
        "exit code. Use this whenever the task targets one of the associated servers.",
      kind: "action",
      inputSchema: {
        type: "object",
        properties: {
          serverId: { type: "string", description: "Associated server id (from the project context block)" },
          command: { type: "string", description: "Shell command to run on that server" },
          cwd: { type: "string", description: "Optional working directory" },
          timeoutMs: { type: "number", description: `Optional timeout in ms (max ${EXEC_TIMEOUT_CAP_MS})` },
        },
        required: ["serverId", "command"],
      },
      handler: async (input) => {
        const i = (input ?? {}) as { serverId?: unknown; command?: unknown; cwd?: unknown; timeoutMs?: unknown };
        const serverId = String(i.serverId ?? "").trim();
        const command = String(i.command ?? "");
        if (!isValidServerId(serverId)) return { ok: false, output: "serverId inválido" };
        if (!command.trim()) return { ok: false, output: "command vacío" };
        const cwd = i.cwd != null && String(i.cwd).length > 0 ? String(i.cwd) : undefined;
        const exclusive = isBuildOrDeployCommand(command);
        const requestedTimeoutMs = Math.min(
          Math.max(Number(i.timeoutMs) || EXEC_DEFAULT_TIMEOUT_MS, 1_000),
          EXEC_MAX_TIMEOUT_MS,
        );
        const timeoutMs = exclusive ? EXEC_MAX_TIMEOUT_MS : requestedTimeoutMs;
        const targetCommand = exclusive ? withAssistantBuildLease(command) : command;
        const startedAt = Date.now();
        const errorContext: ServerToolErrorContext = { serverId };
        try {
          const access = await resolveServerAccess(serverId);
          errorContext.serverName = access.targetName;
          const runOpts = { ...(cwd ? { cwd } : {}), timeoutMs };
          let r: { exitCode: number; stdout: string; stderr: string };
          let transport = "ssh";
          if (access.peer) {
            errorContext.peerAttempted = true;
            try {
              r = await access.peer.exec(targetCommand, runOpts);
              transport = "mcp";
            } catch (e) {
              if (!PanelPeerMcpClient.isReachableError(e)) throw e;
              r = await access.ssh.exec(targetCommand, runOpts);
            }
          } else {
            r = await access.ssh.exec(targetCommand, runOpts);
          }
          const success = r.exitCode === 0;
          await recordCrossServerAccess({
            tool: "servers.exec", serverId, command,
            success, durationMs: Date.now() - startedAt,
            outputPreview: `[${transport}] exit ${r.exitCode} · ${(r.stdout || r.stderr).replace(/\s+/g, " ").slice(0, 150)}`,
          });
          return {
            ok: success,
            output: {
              serverId,
              exitCode: r.exitCode,
              stdout: capExecOutput(r.stdout, EXEC_STDOUT_MAX_CHARS),
              stderr: capExecOutput(r.stderr, EXEC_STDERR_MAX_CHARS),
            },
          };
        } catch (err) {
          await recordCrossServerAccess({
            tool: "servers.exec", serverId, command,
            success: false, durationMs: Date.now() - startedAt,
          });
          return failureResult("servers.exec", err, errorContext);
        }
      },
    },
    {
      name: "servers.read_file",
      title: "Leer archivo en servidor asociado",
      description:
        "Read up to 64KB of a file (by absolute path) on an associated server connection " +
        "(NOT the connected server). Pass `serverId` and `path`. Larger files are truncated.",
      kind: "read",
      inputSchema: {
        type: "object",
        properties: {
          serverId: { type: "string", description: "Associated server id (from the project context block)" },
          path: { type: "string", description: "Absolute path of the file to read on that server" },
        },
        required: ["serverId", "path"],
      },
      handler: async (input) => {
        const i = (input ?? {}) as { serverId?: unknown; path?: unknown };
        const serverId = String(i.serverId ?? "").trim();
        const path = String(i.path ?? "");
        if (!isValidServerId(serverId)) return { ok: false, output: "serverId inválido" };
        if (!isAbsoluteUnixPath(path)) return { ok: false, output: "Ruta inválida" };
        const startedAt = Date.now();
        const errorContext: ServerToolErrorContext = { serverId };
        try {
          const access = await resolveServerAccess(serverId);
          errorContext.serverName = access.targetName;
          let text: string;
          if (access.peer) {
            errorContext.peerAttempted = true;
            try {
              text = await access.peer.readFile(path);
            } catch (e) {
              if (!PanelPeerMcpClient.isReachableError(e)) throw e;
              const raw = await access.ssh.readFile(path, "utf8");
              text = typeof raw === "string" ? raw : raw.toString("utf8");
            }
          } else {
            const raw = await access.ssh.readFile(path, "utf8");
            text = typeof raw === "string" ? raw : raw.toString("utf8");
          }
          const truncated = text.length > READ_MAX_BYTES;
          await recordCrossServerAccess({
            tool: "servers.read_file", serverId, command: `read_file ${path}`,
            success: true, durationMs: Date.now() - startedAt, outputPreview: `${text.length} bytes`,
          });
          return {
            ok: true,
            output: truncated ? text.slice(0, READ_MAX_BYTES) + "\n…(truncated)" : text,
          };
        } catch (err) {
          await recordCrossServerAccess({
            tool: "servers.read_file", serverId, command: `read_file ${path}`,
            success: false, durationMs: Date.now() - startedAt,
          });
          return failureResult("servers.read_file", err, errorContext);
        }
      },
    },
    {
      name: "servers.list_dir",
      title: "Listar directorio en servidor asociado",
      description:
        "List entries of a directory (by absolute path) on an associated server connection " +
        "(NOT the connected server). Returns names with type (file/dir/symlink).",
      kind: "read",
      inputSchema: {
        type: "object",
        properties: {
          serverId: { type: "string", description: "Associated server id (from the project context block)" },
          path: { type: "string", description: "Absolute directory path on that server" },
        },
        required: ["serverId", "path"],
      },
      handler: async (input) => {
        const i = (input ?? {}) as { serverId?: unknown; path?: unknown };
        const serverId = String(i.serverId ?? "").trim();
        const path = String(i.path ?? "");
        if (!isValidServerId(serverId)) return { ok: false, output: "serverId inválido" };
        if (!isAbsoluteUnixPath(path)) return { ok: false, output: "Ruta inválida" };
        const startedAt = Date.now();
        const errorContext: ServerToolErrorContext = { serverId };
        try {
          const access = await resolveServerAccess(serverId);
          errorContext.serverName = access.targetName;
          const toShape = (e: { name: string; type: string; size?: number; mode?: string | number }) => ({
            name: e.name,
            type: String(e.type),
            ...(e.size !== undefined ? { size: e.size } : {}),
            ...(e.mode !== undefined ? { mode: e.mode } : {}),
          });
          let normalized: Array<{ name: string; type: string; size?: number; mode?: string | number }>;
          if (access.peer) {
            errorContext.peerAttempted = true;
            try {
              normalized = (await access.peer.listDir(path)).map(toShape);
            } catch (e) {
              if (!PanelPeerMcpClient.isReachableError(e)) throw e;
              normalized = (await access.ssh.readdir(path)).map(toShape);
            }
          } else {
            normalized = (await access.ssh.readdir(path)).map(toShape);
          }
          await recordCrossServerAccess({
            tool: "servers.list_dir", serverId, command: `list_dir ${path}`,
            success: true, durationMs: Date.now() - startedAt, outputPreview: `${normalized.length} entradas`,
          });
          return { ok: true, output: normalized };
        } catch (err) {
          await recordCrossServerAccess({
            tool: "servers.list_dir", serverId, command: `list_dir ${path}`,
            success: false, durationMs: Date.now() - startedAt,
          });
          return failureResult("servers.list_dir", err, errorContext);
        }
      },
    },
  ],
  suggestedPrompts: [
    "Ejecuta `uptime` en el servidor asociado",
    "Compara la versión de nginx entre este servidor y el asociado",
  ],
};
