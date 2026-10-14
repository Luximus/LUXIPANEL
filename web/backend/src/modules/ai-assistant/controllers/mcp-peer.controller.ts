// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Panel-to-panel MCP — inbound side (this box = "panel B").
 *
 * POST /api/ai/mcp/peer accepts JSON-RPC from ANOTHER LUXIPANEL ("panel A") that
 * already manages this box over SSH and has paired a `lxp_peer_…` credential.
 * It exposes a MINIMAL, fixed toolset — `peer.exec` / `peer.read_file` /
 * `peer.list_dir` — that runs on THIS box's own executor (sudo-wrapped
 * localExecutor). This is the MCP-preferred alternative to A opening a raw SSH
 * connection to B: B runs the op itself, under B's audit.
 *
 * Auth (self-contained, NOT the session middleware):
 *  - `PANEL_PEER_MCP_ENABLED=false` (default) → 404 (feature off).
 *  - `Authorization: Bearer lxp_peer_…` verified against B's stored hashes
 *    (peerCredentialsService); anything else → 401.
 *
 * The interactive per-command confirmation happens on panel A (its agent gates
 * `servers.exec` as an action). B does not re-prompt; it records every access in
 * its own assistant audit sidecar (provider `mcp:peer`).
 */

import type { Request, Response } from "express";
import { env } from "../../../config/env.js";
import { EXEC_DEFAULT_TIMEOUT_MS, EXEC_TIMEOUT_CAP_MS } from "../../../shared/constants.js";
import {
  MCP_PARSE_ERROR,
  MCP_INVALID_REQUEST,
  MCP_METHOD_NOT_FOUND,
  MCP_SERVER_ERROR,
} from "../../../shared/mcp/rpc-codes.js";
import { localExecutor, runWithExecutor } from "../../../shared/executor/index.js";
import { wrapExecutorWithSudo } from "../../../shared/executor/sudo-exec-wrap.js";
import { isAbsoluteUnixPath } from "../../../shared/utils/posix-path.js";
import { peerCredentialsService, PEER_CREDENTIAL_PREFIX } from "../services/peer-credentials.service.js";
import { assistantAuditRepository } from "../repositories/assistant-audit.repository.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("ai-mcp-peer");

const MCP_PROTOCOL_VERSION = "2024-11-05";
const READ_MAX_BYTES = 65_536;
const STDOUT_MAX = 16_000;
const STDERR_MAX = 8_000;

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

function cap(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = Math.floor(max * 0.6);
  return `${text.slice(0, head)}\n…[recortado ${text.length - max}]…\n${text.slice(-(max - head))}`;
}

const PEER_TOOLS = [
  {
    name: "peer.exec",
    description:
      "Run a shell command on THIS LUXIPANEL box (the peer target). Returns stdout, stderr and exit code.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string" },
        cwd: { type: "string" },
        timeoutMs: { type: "number" },
      },
      required: ["command"],
    },
  },
  {
    name: "peer.read_file",
    description: "Read up to 64KB of an absolute-path file on this box.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "peer.list_dir",
    description: "List entries of an absolute-path directory on this box.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
];

async function recordAccess(args: {
  tool: string;
  command: string;
  success: boolean;
  durationMs: number;
  outputPreview?: string;
}): Promise<void> {
  try {
    await assistantAuditRepository.append(
      {
        ts: new Date().toISOString(),
        provider: "mcp:peer",
        tool: args.tool,
        success: args.success,
        durationMs: args.durationMs,
        kind: "peer-inbound",
        command: args.command.slice(0, 500),
        ...(args.outputPreview ? { outputPreview: args.outputPreview.slice(0, 200) } : {}),
      },
      localExecutor,
    );
  } catch (err) {
    log.warn({ err, tool: args.tool }, "Failed to record peer access");
  }
}

/** Run one peer tool call on the sudo-wrapped local executor. */
async function callPeerTool(name: string, args: Record<string, unknown>): Promise<{ ok: boolean; text: string }> {
  const exec = wrapExecutorWithSudo(localExecutor);
  const startedAt = Date.now();
  if (name === "peer.exec") {
    const command = String(args.command ?? "");
    if (!command.trim()) return { ok: false, text: "command vacío" };
    const cwd = args.cwd != null && String(args.cwd).length > 0 ? String(args.cwd) : undefined;
    const timeoutMs = Math.min(Math.max(Number(args.timeoutMs) || EXEC_DEFAULT_TIMEOUT_MS, 1_000), EXEC_TIMEOUT_CAP_MS);
    try {
      const r = await exec.exec(command, { ...(cwd ? { cwd } : {}), timeoutMs });
      const success = r.exitCode === 0;
      await recordAccess({
        tool: name, command, success, durationMs: Date.now() - startedAt,
        outputPreview: `exit ${r.exitCode} · ${(r.stdout || r.stderr).replace(/\s+/g, " ").slice(0, 160)}`,
      });
      return {
        ok: success,
        text: JSON.stringify({ exitCode: r.exitCode, stdout: cap(r.stdout, STDOUT_MAX), stderr: cap(r.stderr, STDERR_MAX) }),
      };
    } catch (err) {
      await recordAccess({ tool: name, command, success: false, durationMs: Date.now() - startedAt, outputPreview: (err as Error).message });
      return { ok: false, text: (err as Error).message };
    }
  }
  if (name === "peer.read_file") {
    const path = String(args.path ?? "");
    if (!isAbsoluteUnixPath(path)) return { ok: false, text: "Ruta inválida" };
    try {
      const raw = await exec.readFile(path, "utf8");
      const text = typeof raw === "string" ? raw : raw.toString("utf8");
      await recordAccess({ tool: name, command: `read_file ${path}`, success: true, durationMs: Date.now() - startedAt, outputPreview: `${text.length} bytes` });
      return { ok: true, text: text.length > READ_MAX_BYTES ? text.slice(0, READ_MAX_BYTES) + "\n…(truncated)" : text };
    } catch (err) {
      await recordAccess({ tool: name, command: `read_file ${path}`, success: false, durationMs: Date.now() - startedAt, outputPreview: (err as Error).message });
      return { ok: false, text: (err as Error).message };
    }
  }
  if (name === "peer.list_dir") {
    const path = String(args.path ?? "");
    if (!isAbsoluteUnixPath(path)) return { ok: false, text: "Ruta inválida" };
    try {
      const entries = await exec.readdir(path);
      await recordAccess({ tool: name, command: `list_dir ${path}`, success: true, durationMs: Date.now() - startedAt, outputPreview: `${entries.length} entradas` });
      return { ok: true, text: JSON.stringify(entries.map((e) => ({ name: e.name, type: e.type, size: e.size, mode: e.mode }))) };
    } catch (err) {
      await recordAccess({ tool: name, command: `list_dir ${path}`, success: false, durationMs: Date.now() - startedAt, outputPreview: (err as Error).message });
      return { ok: false, text: (err as Error).message };
    }
  }
  return { ok: false, text: `Unknown tool: ${name}` };
}

function bearer(req: Request): string {
  const h = req.header("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : "";
}

export const mcpPeerController = {
  async handle(req: Request, res: Response): Promise<void> {
    if (!env.PANEL_PEER_MCP_ENABLED) {
      res.status(404).json({ jsonrpc: "2.0", id: null, error: { code: MCP_METHOD_NOT_FOUND, message: "Peer MCP disabled" } });
      return;
    }
    const token = bearer(req);
    if (!token.startsWith(PEER_CREDENTIAL_PREFIX) || !(await peerCredentialsService.verify(token))) {
      res
        .status(401)
        .set("WWW-Authenticate", 'Bearer realm="luxipanel-peer-mcp"')
        .json({ jsonrpc: "2.0", id: null, error: { code: MCP_SERVER_ERROR, message: "Invalid peer credential" } });
      return;
    }

    let body: JsonRpcRequest;
    try {
      body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as JsonRpcRequest;
    } catch {
      res.status(400).json({ jsonrpc: "2.0", id: null, error: { code: MCP_PARSE_ERROR, message: "Parse error" } });
      return;
    }

    const id = body.id ?? null;
    const method = body.method ?? "";
    // Peer tools run on this box; pin the local executor in context for audit.
    await runWithExecutor(localExecutor, async () => {
      switch (method) {
        case "initialize":
          res.json({
            jsonrpc: "2.0",
            id,
            result: {
              protocolVersion: MCP_PROTOCOL_VERSION,
              capabilities: { tools: { listChanged: false } },
              serverInfo: { name: "luxipanel-peer", version: "1.0.0" },
            },
          });
          return;
        case "notifications/initialized":
        case "notifications/cancelled":
          res.status(204).end();
          return;
        case "ping":
          res.json({ jsonrpc: "2.0", id, result: {} });
          return;
        case "tools/list":
          res.json({ jsonrpc: "2.0", id, result: { tools: PEER_TOOLS } });
          return;
        case "tools/call": {
          const name = String(body.params?.name ?? "");
          if (!name) {
            res.json({ jsonrpc: "2.0", id, error: { code: MCP_INVALID_REQUEST, message: "Missing tool name" } });
            return;
          }
          const args = (body.params?.arguments ?? {}) as Record<string, unknown>;
          const out = await callPeerTool(name, args);
          res.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: out.text }], isError: !out.ok } });
          return;
        }
        default:
          res.json({ jsonrpc: "2.0", id, error: { code: MCP_METHOD_NOT_FOUND, message: `Method not found: ${method}` } });
      }
    });
  },
};
