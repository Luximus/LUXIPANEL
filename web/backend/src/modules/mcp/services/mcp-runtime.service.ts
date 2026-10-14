// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * MCP Runtime Service — Lifecycle management for MCP connections
 *
 * - Bootstrap: connect all enabled MCPs on startup
 * - Health checks: periodic validation
 * - Auto-reconnect: handle disconnections
 * - Shutdown: graceful cleanup
 */

import { mcpConnectionService, type MCPTool } from "./mcp-connection.service.js";
import { extensionRegistryService } from "./extension-registry.service.js";
import { secretsRepository } from "../repositories/secrets.repository.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("mcp-runtime");

interface MCPInstance {
  id: string;
  isRunning: boolean;
  lastHealthCheck?: Date;
  consecutiveFailures: number;
  /** Last status written to the registry — used to skip no-op sidecar writes. */
  lastStatus?: "idle" | "connecting" | "connected" | "error";
}

const instances = new Map<string, MCPInstance>();
let healthCheckInterval: NodeJS.Timeout | null = null;
/** Reentrancy guard: a slow pass (serial 5s timeouts × N down MCPs) must not
 *  overlap the next 30s tick. */
let healthCheckRunning = false;
/** Consecutive failures before marking `error` AND attempting a reconnect. */
const HEALTH_FAILURE_THRESHOLD = 3;

/** Write the registry status ONLY when it actually changed — `setStatus` does
 *  full-JSON SFTP writes, so re-writing "connected" every 30s per MCP is pure
 *  waste. */
async function setStatusIfChanged(
  instance: MCPInstance,
  status: "idle" | "connecting" | "connected" | "error",
  detail?: string,
): Promise<void> {
  if (instance.lastStatus === status) return;
  instance.lastStatus = status;
  await extensionRegistryService.setStatus(instance.id, status, detail);
}

export const mcpRuntimeService = {
  /**
   * Bootstrap: Connect all enabled MCPs on startup
   */
  async bootstrap(): Promise<void> {
    try {
      log.info("Bootstrapping MCP runtime");

      const enabledMap = await extensionRegistryService.getEnabledMap();
      const mcps = extensionRegistryService.getMCPs();

      for (const mcp of mcps) {
        if (!enabledMap[mcp.id]) continue;

        try {
          await this.start(mcp.id);
        } catch (err) {
          log.warn({ mcpId: mcp.id, err: (err as Error).message }, "Failed to start MCP during bootstrap");
        }
      }

      // Start health check loop (every 30 seconds)
      this.startHealthCheckLoop();

      log.info({ count: instances.size }, "MCP runtime bootstrapped");
    } catch (err) {
      log.error({ err }, "Failed to bootstrap MCP runtime");
      // Don't throw — let server continue even if MCPs fail
    }
  },

  /**
   * Start a single MCP
   */
  async start(extensionId: string): Promise<void> {
    try {
      const ext = extensionRegistryService.getById(extensionId);
      if (!ext || ext.kind !== "mcp_server") {
        throw new Error(`Extension ${extensionId} not found or not MCP`);
      }

      const secrets = await secretsRepository.get(extensionId);
      let entrypoint: string | readonly string[] | undefined = ext.entrypoint;
      let childEnv = secrets || {};
      if (extensionId === "filesystem-mcp" && !entrypoint) {
        const root = secrets?.rootPath;
        if (!root || !root.startsWith("/") || /[\0\r\n]/.test(root)) throw new Error("Filesystem MCP requires an absolute rootPath");
        entrypoint = ["npx", "-y", "@modelcontextprotocol/server-filesystem", root];
        childEnv = {};
      }
      if (extensionId === "github-mcp" && !entrypoint) {
        if (!secrets?.githubToken) throw new Error("GitHub MCP requires githubToken");
        entrypoint = ["npx", "-y", "@modelcontextprotocol/server-github"];
        childEnv = { GITHUB_PERSONAL_ACCESS_TOKEN: secrets.githubToken };
      }
      if (!entrypoint) throw new Error(`No entrypoint defined for ${extensionId}`);
      await mcpConnectionService.connect(extensionId, entrypoint, childEnv);

      // Update status
      await extensionRegistryService.setStatus(extensionId, "connected");

      // Track instance
      instances.set(extensionId, {
        id: extensionId,
        isRunning: true,
        consecutiveFailures: 0,
      });

      log.info({ extensionId }, "MCP started");
    } catch (err) {
      await extensionRegistryService.setStatus(extensionId, "error", (err as Error).message);
      log.error({ extensionId, err }, "Failed to start MCP");
      throw err;
    }
  },

  /**
   * Stop a single MCP
   */
  async stop(extensionId: string): Promise<void> {
    try {
      await mcpConnectionService.disconnect(extensionId);
      instances.delete(extensionId);
      await extensionRegistryService.setStatus(extensionId, "idle");
      log.info({ extensionId }, "MCP stopped");
    } catch (err) {
      log.error({ extensionId, err }, "Error stopping MCP");
    }
  },

  /**
   * List tools from an MCP. Errors are already logged by the connection
   * service, so this just forwards.
   */
  async getTools(extensionId: string): Promise<MCPTool[]> {
    return mcpConnectionService.listTools(extensionId);
  },

  /**
   * Execute a tool
   */
  async callTool(
    extensionId: string,
    toolName: string,
    args: Record<string, any>,
  ): Promise<any> {
    return (await mcpConnectionService.callTool(extensionId, toolName, args)).content;
  },

  /**
   * Health check: validate all MCPs
   */
  async healthCheckLoop(): Promise<void> {
    // Reentrancy guard: skip if the previous pass is still running (several down
    // MCPs make a pass take longer than the 30s interval, so ticks would pile up).
    if (healthCheckRunning) return;
    healthCheckRunning = true;
    try {
      const toReconnect: string[] = [];
      for (const instance of instances.values()) {
        try {
          const isHealthy = await mcpConnectionService.healthCheck(instance.id);

          if (isHealthy) {
            instance.consecutiveFailures = 0;
            instance.lastHealthCheck = new Date();
            await setStatusIfChanged(instance, "connected");
          } else {
            instance.consecutiveFailures++;

            if (instance.consecutiveFailures >= HEALTH_FAILURE_THRESHOLD) {
              await setStatusIfChanged(instance, "error", "Health check failed");
              log.warn(
                { mcpId: instance.id, failures: instance.consecutiveFailures },
                "MCP marked as error after health check failures",
              );
              // Backoff: attempt an actual reconnect on the threshold crossing
              // and then every Nth failure (3, 6, 9…), not on every 30s tick.
              if (instance.consecutiveFailures % HEALTH_FAILURE_THRESHOLD === 0) {
                toReconnect.push(instance.id);
              }
            }
          }
        } catch (err) {
          instance.consecutiveFailures++;
          log.warn({ mcpId: instance.id, err }, "Health check error");
        }
      }

      // Reconnect OUTSIDE the iteration — `stop()`/`start()` mutate `instances`.
      // This is the "Auto-reconnect" the header promised but never did.
      for (const id of toReconnect) {
        try {
          log.info({ mcpId: id }, "Attempting MCP auto-reconnect");
          await this.stop(id);
          await this.start(id);
        } catch (err) {
          log.warn({ mcpId: id, err: (err as Error).message }, "MCP auto-reconnect failed");
        }
      }
    } finally {
      healthCheckRunning = false;
    }
  },

  /**
   * Start periodic health checks
   */
  startHealthCheckLoop(): void {
    if (healthCheckInterval) return; // Already running

    healthCheckInterval = setInterval(
      () => {
        this.healthCheckLoop().catch((err) => {
          log.error({ err }, "Health check loop error");
        });
      },
      30 * 1000, // Every 30 seconds
    );

    log.info("Health check loop started (every 30s)");
  },

  /**
   * Shutdown: cleanup all MCPs
   */
  async shutdown(): Promise<void> {
    log.info("Shutting down MCP runtime");

    // Stop health checks
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
    }

    // Disconnect all MCPs
    for (const instance of instances.values()) {
      try {
        await this.stop(instance.id);
      } catch (err) {
        log.error({ mcpId: instance.id, err }, "Error during shutdown");
      }
    }

    instances.clear();
    log.info("MCP runtime shutdown complete");
  },
};
