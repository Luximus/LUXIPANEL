// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Panel-to-panel MCP — outbound side (this box = "panel A").
 *
 * A thin JSON-RPC-over-HTTP client for another LUXIPANEL's `/api/ai/mcp/peer`
 * endpoint. Used by the AI agent's servers.* tools when an associated target is
 * flagged `hasLuxipanel` and paired: instead of A opening a raw SSH connection
 * to B, A asks B to run the op itself (peer.exec / peer.read_file /
 * peer.list_dir) under B's audit. Falls back to direct SSH on any transport
 * error (the caller handles that).
 */

import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("panel-peer-mcp");

const DEFAULT_TIMEOUT_MS = 130_000; // a hair over the tool exec cap

export interface PeerExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Transport-level failure (HTTP, network, abort, JSON-RPC error) — the caller
 *  should FALL BACK to direct SSH. */
export class PanelPeerMcpError extends Error {}

/** A tool executed on the target and returned a legitimate error (file not
 *  found, permission denied). NOT a transport failure — do NOT fall back to
 *  SSH (the same server would just fail the same way); surface it as-is. */
export class PanelPeerToolError extends PanelPeerMcpError {}

export class PanelPeerMcpClient {
  private readonly endpoint: string;

  constructor(
    baseUrl: string,
    private readonly token: string,
  ) {
    // Normalize: strip a trailing slash, then append the peer path.
    this.endpoint = `${baseUrl.replace(/\/+$/, "")}/api/ai/mcp/peer`;
  }

  private async rpc(method: string, params?: Record<string, unknown>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, ...(params ? { params } : {}) }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new PanelPeerMcpError(`peer MCP HTTP ${res.status}`);
      }
      const json = (await res.json()) as { result?: unknown; error?: { message?: string } };
      if (json.error) throw new PanelPeerMcpError(json.error.message ?? "peer MCP error");
      return json.result;
    } catch (err) {
      if (err instanceof PanelPeerMcpError) throw err;
      throw new PanelPeerMcpError((err as Error).message);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Handshake + tools/list — used by the pairing flow to verify a credential. */
  async probe(): Promise<boolean> {
    await this.rpc("initialize", {}, 15_000);
    const result = (await this.rpc("tools/list", {}, 15_000)) as { tools?: unknown[] };
    return Array.isArray(result?.tools) && result.tools.length > 0;
  }

  private async callTool(name: string, args: Record<string, unknown>, timeoutMs?: number): Promise<{ ok: boolean; text: string }> {
    const result = (await this.rpc("tools/call", { name, arguments: args }, timeoutMs)) as {
      content?: Array<{ text?: string }>;
      isError?: boolean;
    };
    const text = result?.content?.[0]?.text ?? "";
    return { ok: !result?.isError, text };
  }

  async exec(command: string, opts?: { cwd?: string; timeoutMs?: number }): Promise<PeerExecResult> {
    const { text } = await this.callTool(
      "peer.exec",
      { command, ...(opts?.cwd ? { cwd: opts.cwd } : {}), ...(opts?.timeoutMs ? { timeoutMs: opts.timeoutMs } : {}) },
      opts?.timeoutMs ? opts.timeoutMs + 5_000 : undefined,
    );
    try {
      const parsed = JSON.parse(text) as PeerExecResult;
      return { exitCode: parsed.exitCode ?? 1, stdout: parsed.stdout ?? "", stderr: parsed.stderr ?? "" };
    } catch {
      // Non-JSON body ⇒ a tool-level error string; surface it as stderr/exit 1.
      return { exitCode: 1, stdout: "", stderr: text };
    }
  }

  async readFile(path: string): Promise<string> {
    const { ok, text } = await this.callTool("peer.read_file", { path });
    if (!ok) throw new PanelPeerToolError(text); // real tool error, not transport
    return text;
  }

  async listDir(path: string): Promise<Array<{ name: string; type: string; size?: number; mode?: number }>> {
    const { ok, text } = await this.callTool("peer.list_dir", { path });
    if (!ok) throw new PanelPeerToolError(text); // real tool error, not transport
    try {
      return JSON.parse(text) as Array<{ name: string; type: string; size?: number; mode?: number }>;
    } catch {
      throw new PanelPeerToolError("Respuesta inválida de list_dir");
    }
  }

  /** True ⇒ the caller should fall back to direct SSH. A tool-level error
   *  (PanelPeerToolError) is a genuine failure on the target, so it returns
   *  false — retrying over SSH would only reproduce it. */
  static isReachableError(err: unknown): boolean {
    if (err instanceof PanelPeerToolError) return false;
    if (err instanceof PanelPeerMcpError) {
      log.debug({ err: err.message }, "peer MCP unreachable — falling back to SSH");
      return true;
    }
    return false;
  }
}
