// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerCommunityModule } from "./modules/community/index.js";
import { loadCommunityModules } from "./modules/community/community-loader.service.js";
import { handleUiConnection } from "./modules/admin/services/ui-events.service.js";
/**
 * Server entry point.
 *
 * Bootstraps Redis, the modules, and starts listening.
 * Handles graceful shutdown on SIGINT / SIGTERM.
 */

import { createApp } from "./app.js";
import { serverConfig } from "./config/server.js";
import { redisConfig } from "./config/redis.js";
import { logger, createModuleLogger } from "./shared/logger/index.js";
import { connectRedis, closeRedis } from "./shared/redis/index.js";
import type { ModuleRegistrar } from "./shared/types/index.js";

// ---- Import module registrars as they are built ----
import { registerAuthModule } from "./modules/auth/index.js";
import { registerMailModule } from "./modules/mail/index.js";
import { registerUsersModule } from "./modules/users/index.js";
import { registerAdminModule } from "./modules/admin/index.js";
import { registerMonitorModule } from "./modules/monitor/index.js";
import { registerDashboardModule } from "./modules/dashboard/index.js";
import { registerFilesModule } from "./modules/files/index.js";
import { registerJobsModule } from "./modules/jobs/index.js";
import { registerModuleDevModule } from "./modules/module-dev/index.js";
import { registerSearchModule } from "./modules/search/index.js";
import { registerFirewallModule } from "./modules/firewall/index.js";
import { registerCronModule } from "./modules/cron/index.js";
import { registerWebhooksModule } from "./modules/webhooks/index.js";
import { registerServersModule } from "./modules/servers/index.js";
import { registerOpenClawModule } from "./modules/openclaw/index.js";
import { registerBackupModule } from "./modules/backup/index.js";
import { registerAiModule, attachAssistantWebSocket } from "./modules/ai-assistant/index.js";
import { agentRunRegistry } from "./modules/ai-assistant/services/agent-run-registry.js";
import { registerNginxModule } from "./modules/nginx/index.js";
import { registerDatabasesModule } from "./modules/databases/index.js";
import { registerObsidianModule } from "./modules/obsidian/index.js";
import { registerCloudflareModule } from "./modules/cloudflare/index.js";
import { registerExpoModule } from "./modules/expo/index.js";
import { registerHostingModule } from "./modules/hosting/index.js";
import { registerSystemDepsModule } from "./modules/system-deps/index.js";
import {
  registerTerminalModule,
  attachTerminalWebSocket,
  stopTerminalModule,
} from "./modules/terminal/index.js";
import { registerTerminalCliModule } from "./modules/terminal-cli/index.js";
import { attachMonitorWebSocket } from "./modules/monitor/index.js";
import { attachUiSyncWebSocket } from "./modules/users/index.js";
import { WsRouter } from "./shared/websocket/ws-router.js";
import { statsCollectorService } from "./modules/monitor/services/stats-collector.service.js";
import { wireRemoteCacheEventBridge } from "./shared/remote-cache/event-bridge.js";
import { runOnPanelHost } from "./shared/executor/index.js";
import { startDiagnostics } from "./shared/diagnostics/history.js";
import { repairJobs } from "./shared/diagnostics/repair-jobs.js";
import { diagnosticsStore } from "./shared/diagnostics/store.js";
import { env } from "./config/env.js";
import { APP_VERSION_DISPLAY } from "./config/version.js";
import { backupSchedulerService } from "./modules/backup/services/scheduler.service.js";
import { registerSecurityAuditModule } from "./modules/security-audit/middleware.js";
import { registerBitNinjaModule } from "./modules/bitninja/index.js";
import { registerCodebaseGraphModule } from "./modules/codebase-graph/index.js";
import { registerSudoModule } from "./modules/sudo/index.js";
import { registerMCPModule } from "./modules/mcp/index.js";
import { registerNotificationsModule } from "./modules/notifications/index.js";
import { registerServerAlertsModule } from "./modules/server-alerts/index.js";
import { registerChatModule } from "./modules/chat/index.js";
import { mcpRuntimeService } from "./modules/mcp/services/mcp-runtime.service.js";
import { previewSandboxRuntime } from "./shared/preview-sandbox/runtime.js";
// rolesService.seedDefaults / systemAccountsService.syncAllUsersToDatabase
// removed from boot — per-server seeding happens lazily on first SSH login.

const log = createModuleLogger("server");

async function bootstrap() {
  log.info("╔══════════════════════════════════════════╗");
  log.info(`║        LUXIPANEL ${APP_VERSION_DISPLAY} — Starting         ║`);
  log.info("╚══════════════════════════════════════════╝");

  // ---- 0. Warn on incoherent jail flags ----
  // HOSTING_TERMINAL_REQUIRE_JAIL is the product's fail-closed shell-isolation
  // boundary; JAIL_SHELL_ENABLED is the master switch that actually installs the
  // jailkit login shell. If they disagree the operator's intent silently does
  // not hold, so surface it once at boot.
  if (env.HOSTING_TERMINAL_REQUIRE_JAIL && !env.JAIL_SHELL_ENABLED) {
    log.warn(
      "Jail flag enabled but jail shell disabled (HOSTING_TERMINAL_REQUIRE_JAIL=true, JAIL_SHELL_ENABLED=false) — hosting terminal will not jail; set JAIL_SHELL_ENABLED=true to honor the gate",
    );
  } else if (!env.HOSTING_TERMINAL_REQUIRE_JAIL && env.JAIL_SHELL_ENABLED) {
    log.warn(
      "Jail shell enabled but require-jail is off (JAIL_SHELL_ENABLED=true, HOSTING_TERMINAL_REQUIRE_JAIL=false) — hosting terminals may open WITHOUT a chroot jail; set HOSTING_TERMINAL_REQUIRE_JAIL=true to enforce isolation",
    );
  }

  // ---- 1. Verify external dependencies ----
  await connectRedis(redisConfig.url);

  // NOTE: roles.seedDefaults() and systemAccountsService.syncAllUsersToDatabase()
  // were removed from boot. The panel no longer has its own data store on
  // the panel host — every per-server data lives at LUXIPANEL_CONFIG_DIR
  // on the CONNECTED server. Seeding happens lazily on the first SSH
  // login that hits a target without an initialized config dir.

  // Instance-level boot (license, module catalog, MCP registry, panel
  // branding) belongs to THIS LUXIPANEL installation, not to any bridged
  // server — there is no connected server at boot. Run it (and createApp,
  // whose module registration reads instance-level settings) pinned to the
  // panel host. `app.listen()` stays OUTSIDE so incoming requests are NOT
  // in this scope and resolve their own per-server executor instead.
  const app = await runOnPanelHost(async () => {
    await startDiagnostics();
    // Self-hosted: no LP-LICENSE-SERVER. No license activation/heartbeat, no
    // SSH-usage/worklog reporting to LP, and no shared-secret rotation store.

    // ---- 3. Start background services ----
    statsCollectorService.start();
    // Wire the event-bus → remote-cache bridge once. The dataStore mutators
    // already trigger targeted refresh on every write; this listener is
    // defense-in-depth for sidecars written outside dataStore (e.g.
    // settings sync, certbot timers).
    wireRemoteCacheEventBridge();

    // ---- 3b. The local module catalog is static (loaded at module-eval
    //         time); MCP definitions live in it and are already available. ----

    // ---- 3c. Bootstrap MCP runtime (external server integrations) ----
    await mcpRuntimeService.bootstrap();

    // ---- 4. Create Express app with modules ----
    const modules: ModuleRegistrar[] = [
      registerAuthModule,
      // AI assistant: ditto. Su endpoint MCP usa Bearer auth propio
      // (`/api/ai/mcp`), debe quedar antes de los routers que aplican
      // `requireAuth` a raíz, o si no el bearer ni se evalúa.
      registerAiModule,
      registerCodebaseGraphModule,
      registerMailModule,
      registerUsersModule,
      registerAdminModule,
      registerMonitorModule,
      registerDashboardModule,
      registerFilesModule,
      registerFirewallModule,
      registerCronModule,
      registerWebhooksModule,
      // Standalone multi-node SSH target vault (additive; no mode gate for now).
      registerServersModule,
      registerOpenClawModule,
      registerBackupModule,
      registerNginxModule,
      registerDatabasesModule,
      registerObsidianModule,
      registerCloudflareModule,
      registerExpoModule,
      registerHostingModule,
      registerSystemDepsModule,
      registerSecurityAuditModule,
      registerBitNinjaModule,
      registerSudoModule,
      registerTerminalModule,
      registerTerminalCliModule,
      registerMCPModule,
      registerNotificationsModule,
      registerServerAlertsModule,
      registerChatModule,
      registerJobsModule,
      registerModuleDevModule,
      registerSearchModule,
      registerCommunityModule,
    ];

    const app = createApp(modules);
    await loadCommunityModules();
    return app;
  });

  // ---- 5. Start HTTP server ----
  const server = app.listen(serverConfig.port, serverConfig.host, () => {
    log.info(
      {
        port: serverConfig.port,
        host: serverConfig.host,
        env: serverConfig.isDev ? "development" : "production",
      },
      `🚀 LUXIPANEL listening on http://${serverConfig.host}:${serverConfig.port}`,
    );
  });

  // ---- 6. Attach WebSocket servers via centralized router ----
  // WsRouter installs a single upgrade listener and dispatches by pathname.
  // To add a new WS service in the future: wsRouter.register("/api/xxx/ws", handler).
  const wsRouter = new WsRouter(server);
  wsRouter.register("/api/ui/events", handleUiConnection);
  attachTerminalWebSocket(wsRouter);
  attachMonitorWebSocket(wsRouter);
  attachUiSyncWebSocket(wsRouter);
  // Canal persistente del asistente: reenvía cambios de tareas de equipo a
  // TODAS las sesiones del usuario (cross-tab/cross-device), sobrevive al
  // cierre del run del líder y funciona aunque el drawer esté cerrado.
  attachAssistantWebSocket(wsRouter);

  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  // ---- 7. Graceful shutdown ----
  const shutdown = async (signal: string) => {
    log.info(`Received ${signal} — shutting down gracefully…`);

    server.close(async () => {
      try {
        statsCollectorService.stop();
        backupSchedulerService.stop();
        stopTerminalModule();
        // Flush in-flight assistant API runs (persist partial answers so threads
        // aren't frozen); CLI runs are left to recover from their descriptors.
        const drained = await agentRunRegistry.gracefulShutdown().catch((err) => {
          log.warn({ err: (err as Error).message }, "agent runs graceful shutdown failed");
          return { flushed: 0, cliDetached: 0 };
        });
        log.info(drained, "agent runs settled for shutdown");
        await repairJobs.shutdown();
        await diagnosticsStore.flush();
        await mcpRuntimeService.shutdown();
        // Tear down the out-of-process preview sandbox pool (cgroup.kill the
        // workers, SIGKILL the unshare trees, wipe scratch). Idempotent + inert
        // when the runtime never initialized; the `?.` guards the optional method.
        await previewSandboxRuntime.dispose?.();
        await closeRedis();
        log.info("Shutdown complete");
        process.exit(0);
      } catch (err) {
        log.error({ err }, "Error during shutdown");
        process.exit(1);
      }
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      log.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  process.on("unhandledRejection", (reason) => {
    logger.fatal({ err: reason }, "Unhandled promise rejection");
    process.exit(1);
  });

  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "Uncaught exception");
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, "Failed to start LUXIPANEL");
  process.exit(1);
});
