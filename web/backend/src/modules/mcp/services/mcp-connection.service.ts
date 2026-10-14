// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { createHash } from "node:crypto";
import { agentCapabilityRegistry } from "../../../shared/agent-capability/registry.js";
import { getModuleCatalog } from "../../../shared/module-state/index.js";
import { mcpPolicyService } from "./mcp-policy.service.js";
import { getContextUser } from "../../../shared/executor/context.js";
import { ForbiddenError } from "../../../shared/errors/index.js";
/**
 * MCP Connection Service — Manage connections to MCP servers
 *
 * Uses @modelcontextprotocol/sdk to connect via stdio transport.
 * Each MCP gets its own client instance with lifecycle management.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("mcp-connection");

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, any>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
}

interface MCPClientInstance {
  client: Client;
  transport: StdioClientTransport;
  isConnected: boolean;
  lastError?: string;
}

const clients = new Map<string, MCPClientInstance>();
const toolFingerprints = new Map<string, string>();
const refreshing = new Map<string, Promise<void>>();
function catalogId(extensionId: string): string { return extensionId.replace(/^office:/, ""); }
function removeConnectionTools(extensionId: string): void {
  const id = catalogId(extensionId), previous = agentCapabilityRegistry.get(id);
  toolFingerprints.delete(extensionId);
  if (previous) agentCapabilityRegistry.register({ ...previous, tools: previous.tools.filter(tool => !tool.name.startsWith(`${id}.mcp_`)) });
}


/**
 * In-flight connect promises per extension. The "already connected" guard runs
 * BEFORE the `await client.connect()`, but the instance is only stored AFTER it
 * — so two concurrent `connect()` calls both passed the guard and each spawned
 * its own child (the second overwriting the first in the Map, leaking a
 * process). Single-flight: concurrent callers share the first connect.
 */
const connecting = new Map<string, Promise<void>>();

/**
 * Minimal, secret-free environment for a spawned MCP child process. Only a
 * handful of benign vars needed to locate binaries/locale are forwarded; the
 * panel's secrets are deliberately excluded. The extension's own configured
 * `env` is layered on top by the caller.
 */
const CHILD_ENV_ALLOWLIST = ["PATH", "HOME", "LANG", "LC_ALL", "TMPDIR", "TZ", "TERM"];

/**
 * Process-control vars an extension must NEVER be able to set on the child: they
 * change WHAT code runs (loader/interpreter hijack), not just configuration.
 * Stripped from the extension's `env` before merge; the allowlisted vars are
 * then re-applied on top so the panel's benign values win.
 */
const CHILD_ENV_DENYLIST = new Set([
  "NODE_OPTIONS",
  "LD_PRELOAD",
  "LD_LIBRARY_PATH",
  "LD_AUDIT",
  "DYLD_INSERT_LIBRARIES",
  "DYLD_LIBRARY_PATH",
  "PYTHONPATH",
  "PYTHONSTARTUP",
  "BASH_ENV",
  "ENV",
  "IFS",
]);

function buildChildEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of CHILD_ENV_ALLOWLIST) {
    const value = process.env[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/** Drop loader/interpreter-hijack keys from the extension-supplied env. */
function sanitizeExtensionEnv(env: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (CHILD_ENV_DENYLIST.has(k.toUpperCase())) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Reject with `Error(label)` if `promise` does not settle within `ms`. The
 * timer is ALWAYS cleared (it no longer keeps the event loop alive for the full
 * `ms` after the request already resolved) and `onTimeout` fires so the caller
 * can abort the still-in-flight MCP request instead of leaking it.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string, onTimeout?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout?.();
      reject(new Error(label));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/** Actual connect (spawn + handshake). Single-flighted by the service method. */
async function doConnect(
  extensionId: string,
  entrypoint: string | readonly string[],
  env: Record<string, string>,
): Promise<void> {
  log.info({ extensionId, entrypoint }, "Connecting to MCP server");

  // Parse entrypoint: "npx @modelcontextprotocol/server-filesystem" or "node /path/to/server.js"
  const parts = typeof entrypoint === "string" ? entrypoint.split(" ").filter((p) => p.length > 0) : [...entrypoint];
  if (parts.length === 0) {
    throw new Error(`Invalid entrypoint: ${entrypoint}`);
  }

  const command = parts[0]!;
  const args = parts.slice(1);

  // SECURITY: never inherit the full `process.env` — it carries the panel's
  // secrets (LUXIPANEL_KEY, ENCRYPTION_KEY, base64 TLS material, license/Redis
  // creds) and any installed MCP server / npx package would receive them all.
  // Pass only a minimal allowlist of benign vars plus the explicitly
  // configured `env` for this extension.
  const transport = new StdioClientTransport({
    command,
    args,
    // Extension env first (minus loader-hijack keys), THEN the panel allowlist
    // so `PATH`/`HOME`/locale come from the panel's benign values and can't be
    // overridden by the extension.
    env: {
      ...sanitizeExtensionEnv(env),
      ...buildChildEnv(),
    },
  });

  const client = new Client({
    name: "luxipanel",
    version: "1.0.0",
  });

  try {
    await client.connect(transport);
    clients.set(extensionId, { client, transport, isConnected: true });
    await mcpConnectionService.refreshTools(extensionId);
    log.info({ extensionId }, "MCP connection established");
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error({ err, extensionId }, "Failed to connect to MCP");

    // `client.connect` already spawned the child; a failed handshake would
    // otherwise leave that process alive with no reference. Tear it down.
    try {
      transport.close?.();
    } catch {
      /* best-effort */
    }

    // Store error state
    clients.set(extensionId, {
      client: null as any,
      transport: null as any,
      isConnected: false,
      lastError: errMsg,
    });

    throw err;
  }
}

export const mcpConnectionService = {
  async refreshConnectedTools(): Promise<void> {
    await Promise.allSettled([...clients].filter(([, instance]) => instance.isConnected).map(([id]) => this.refreshTools(id)));
  },
  async refreshTools(extensionId: string): Promise<void> {
    const pending = refreshing.get(extensionId);
    if (pending) return pending;
    const task = this.refreshToolsNow(extensionId).finally(() => { if (refreshing.get(extensionId) === task) refreshing.delete(extensionId); });
    refreshing.set(extensionId, task);
    return task;
  },
  async refreshToolsNow(extensionId: string): Promise<void> {
    const id = catalogId(extensionId), definition = getModuleCatalog().find(module => module.id === id);
    // The graph always uses its separate project-scoped panel channel.
    if (!definition || definition.kind !== "mcp_server" || id === "codebase-graph") return;
    const instance = clients.get(extensionId);
    if (!instance?.isConnected) return;
    let tools: MCPTool[];
    try { tools = await this.listTools(extensionId); }
    catch (error) { if (clients.get(extensionId) === instance) removeConnectionTools(extensionId); throw error; }
    if (clients.get(extensionId) !== instance) return;
    const fingerprint = createHash("sha256").update(JSON.stringify(tools)).digest("hex");
    if (toolFingerprints.get(extensionId) === fingerprint) return;
    const previous = agentCapabilityRegistry.get(id);
    const external = tools.map(tool => {
      const safe = tool.name.toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 28);
      const name = `${id}.mcp_${safe}_${createHash("sha256").update(tool.name).digest("hex").slice(0, 8)}`;
      const kind = tool.annotations?.readOnlyHint === true && tool.annotations?.destructiveHint !== true ? "read" as const : "action" as const;
      return { name, title: tool.name, description: tool.description ?? `Call ${tool.name} on ${id}`, kind, dangerous: kind === "action", permission: `${id}.${kind === "read" ? "read" : "execute"}`, inputSchema: { ...tool.inputSchema, type: "object" as const }, handler: async (input: unknown) => {
        const user = getContextUser();
        if (!user || !mcpPolicyService.canCallTool(id, tool.name, { isAdmin: user.kind === "admin", userId: String(user.userId) }) || clients.get(extensionId) !== instance || !instance.isConnected) throw new ForbiddenError("MCP access revoked or connection changed");
        const result = await this.callTool(extensionId, tool.name, input as Record<string, unknown>);
        return { ok: !result.isError, output: result.content };
      } };
    });
    agentCapabilityRegistry.register({ ...previous, moduleId: id, catalogModuleId: id, version: 1, tools: [...(previous?.tools.filter(tool => !tool.name.startsWith(`${id}.mcp_`)) ?? []), ...external] });
    toolFingerprints.set(extensionId, fingerprint);
  },
  /**
   * Initialize connection to MCP server
   */
  async connect(
    extensionId: string,
    entrypoint: string | readonly string[],
    env: Record<string, string> = {},
  ): Promise<void> {
    // Don't reconnect if already connected
    if (clients.get(extensionId)?.isConnected) {
      log.debug({ extensionId }, "Already connected, skipping");
      return;
    }
    // Single-flight: coalesce concurrent connects so we spawn ONE child.
    const inFlight = connecting.get(extensionId);
    if (inFlight) return inFlight;
    const p = doConnect(extensionId, entrypoint, env).finally(() => connecting.delete(extensionId));
    connecting.set(extensionId, p);
    return p;
  },

  /**
   * Disconnect from MCP server
   */
  async disconnect(extensionId: string): Promise<void> {
    const instance = clients.get(extensionId);
    if (!instance) return;

    try {
      // Note: Client has no explicit close; the transport handles cleanup.
      if (instance.transport) {
        instance.transport.close?.();
      }

      clients.delete(extensionId);
      refreshing.delete(extensionId);
      removeConnectionTools(extensionId);
      log.info({ extensionId }, "MCP connection closed");
    } catch (err) {
      log.error({ err, extensionId }, "Error closing MCP connection");
    }
  },

  /**
   * List available tools from MCP
   */
  async listTools(extensionId: string, timeout = 10000): Promise<MCPTool[]> {
    const instance = clients.get(extensionId);
    if (!instance || !instance.isConnected) {
      throw new Error(`MCP ${extensionId} not connected`);
    }

    try {
      // Call tools/list method
      const controller = new AbortController();
      const result = await withTimeout(
        instance.client.request({ method: "tools/list" } as any, {} as any, {
          signal: controller.signal,
        } as any),
        timeout,
        "listTools timeout",
        () => controller.abort(),
      );

      const tools = (result as any).tools || [];
      log.debug({ extensionId, toolCount: tools.length }, "Listed MCP tools");

      return tools;
    } catch (err) {
      log.error({ err, extensionId }, "Failed to list tools");
      throw err;
    }
  },

  /**
   * Call a tool on MCP server
   */
  async callTool(
    extensionId: string,
    toolName: string,
    args: Record<string, any> = {},
    timeout = 30000,
  ): Promise<{ content: any; isError?: boolean }> {
    // Shared extension processes carry provider credentials and server-wide
    // resources. They cannot safely impersonate a hosting account.
    if (getContextUser() && getContextUser()!.kind !== "admin") throw new ForbiddenError("Shared MCP extensions require administrator privileges");
    const instance = clients.get(extensionId);
    if (!instance || !instance.isConnected) {
      throw new Error(`MCP ${extensionId} not connected`);
    }

    try {
      // Call tools/call method
      const controller = new AbortController();
      const result = await withTimeout(
        instance.client.request(
          {
            method: "tools/call",
            params: {
              name: toolName,
              arguments: args,
            },
          } as any,
          {} as any,
          { signal: controller.signal } as any,
        ),
        timeout,
        "callTool timeout",
        () => controller.abort(),
      );

      log.debug({ extensionId, toolName }, "Tool execution succeeded");

      return {
        content: result,
        isError: Boolean((result as { isError?: boolean }).isError),
      };
    } catch (err) {
      log.error({ err, extensionId, toolName }, "Tool execution failed");
      throw err;
    }
  },

  /**
   * Check if MCP is connected and responsive
   */
  async healthCheck(extensionId: string, timeout = 5000): Promise<boolean> {
    const instance = clients.get(extensionId);
    if (!instance || !instance.isConnected) {
      return false;
    }

    try {
      // Simple health check: try to list tools (lightweight operation)
      const controller = new AbortController();
      await withTimeout(
        instance.client.request({ method: "tools/list" } as any, {} as any, {
          signal: controller.signal,
        } as any),
        timeout,
        "health check timeout",
        () => controller.abort(),
      );

      return true;
    } catch (err) {
      log.warn({ extensionId, err: (err as Error).message }, "Health check failed");
      instance.lastError = (err as Error).message;
      return false;
    }
  },

  /**
   * Get connection status
   */
  getStatus(extensionId: string): {
    connected: boolean;
    lastError?: string;
  } {
    const instance = clients.get(extensionId);
    return {
      connected: instance?.isConnected ?? false,
      lastError: instance?.lastError,
    };
  },
};
