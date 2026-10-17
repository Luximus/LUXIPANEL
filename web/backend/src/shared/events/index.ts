// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Internal event bus for inter-module communication.
 *
 * Modules emit events (e.g. "account:created") and other modules
 * can subscribe without creating direct dependencies.
 *
 * In a future microservices split, this can be swapped for Redis pub/sub.
 */

import { EventEmitter } from "node:events";
import { createModuleLogger } from "../logger/index.js";

const log = createModuleLogger("events");

class TypedEventBus extends EventEmitter {
  /**
   * Dispatch an event to its listeners, ISOLATING each listener:
   *
   *   - A synchronous throw in one listener does NOT skip the rest (default
   *     EventEmitter aborts the loop on the first throw).
   *   - A rejected promise from an async listener is caught here, so it never
   *     becomes an `unhandledRejection` — which, with server.ts's
   *     `process.exit(1)` handler, would tear down the whole multi-tenant
   *     process (every live SSH session) over one faulty subscriber.
   *
   * Errors are logged and swallowed; the public `on`/`emit` API is unchanged.
   * Returns true if there was at least one listener (matching EventEmitter).
   */
  emit(event: string, ...args: unknown[]): boolean {
    log.debug({ event }, `Event emitted: ${event}`);
    // rawListeners (not listeners): preserves the `once` wrapper so one-shot
    // listeners still auto-remove when invoked directly.
    const listeners = this.rawListeners(event) as Array<(...a: unknown[]) => unknown>;
    for (const listener of listeners) {
      try {
        const result = listener.apply(this, args);
        if (result instanceof Promise) {
          result.catch((err) => {
            log.error({ err, event }, "Async event listener rejected (isolated)");
          });
        }
      } catch (err) {
        log.error({ err, event }, "Event listener threw (isolated)");
      }
    }
    return listeners.length > 0;
  }
}

export const eventBus = new TypedEventBus();
eventBus.setMaxListeners(50);

// ---- Event name constants ----
export const Events = {
  MODULES_CHANGED: "modules:changed",
  // Auth
  AUTH_LOGIN_SUCCESS: "auth:login:success",
  AUTH_LOGIN_FAILED: "auth:login:failed",
  AUTH_LOGOUT: "auth:logout",
  AUTH_PASSKEY_REGISTERED: "auth:passkey:registered",
  AUTH_PASSKEY_REVOKED: "auth:passkey:revoked",

  // Mail
  ACCOUNT_CREATED: "mail:account:created",
  ACCOUNT_UPDATED: "mail:account:updated",
  ACCOUNT_DELETED: "mail:account:deleted",
  MAIL_SENT: "mail:sent",
  /** Ask the mail module to send a SYSTEM email with the panel outbound identity. */
  SYSTEM_MAIL_SEND: "mail:system-send",
  // Heavy mailbox clone runs in the background (avoids the 524 timeout); these
  // drive the start/done/fail notifications.
  MAIL_CLONE_STARTED: "mail:clone:started",
  MAIL_CLONE_COMPLETED: "mail:clone:completed",
  MAIL_CLONE_FAILED: "mail:clone:failed",

  // Users
  USER_CREATED: "users:user:created",
  USER_UPDATED: "users:user:updated",
  USER_DELETED: "users:user:deleted",
  ROLE_CREATED: "users:role:created",
  ROLE_UPDATED: "users:role:updated",
  ROLE_DELETED: "users:role:deleted",

  // Monitor — values are the BARE literals actually emitted by
  // alert-evaluator and subscribed by monitor/webhooks/worklog. (Previously
  // these were "monitor:alert:*", which never matched the wired literals, so
  // notifications never fired on resolve — see SSOT M3.)
  /** An alert rule crossed its threshold (started firing). Payload: { rule, value, scope }. */
  ALERT_FIRING: "alert:firing",
  /**
   * Back-compat alias for ALERT_FIRING (same logical event, same value).
   * `notifications`/`worklog` reference ALERT_TRIGGERED; keep them matching the
   * one "firing" wire rather than introducing a second value.
   */
  ALERT_TRIGGERED: "alert:firing",
  /** A firing alert cleared. Payload: { rule, value, scope }. */
  ALERT_RESOLVED: "alert:resolved",

  // Admin / Settings
  SETTINGS_UPDATED: "admin:settings:updated",

  // Backup
  BACKUP_STARTED: "backup:started",
  BACKUP_COMPLETED: "backup:completed",
  BACKUP_FAILED: "backup:failed",

  // SSL
  SSL_ISSUED: "ssl:cert:issued",
  SSL_RENEWED: "ssl:cert:renewed",
  SSL_REVOKED: "ssl:cert:revoked",
  SSL_EXPIRING: "ssl:cert:expiring",

  // DNS
  DNS_ZONE_CREATED: "dns:zone:created",
  DNS_ZONE_DELETED: "dns:zone:deleted",
  DNS_RECORD_CHANGED: "dns:record:changed",

  // Firewall
  FIREWALL_RULE_ADDED: "firewall:rule:added",
  FIREWALL_RULE_DELETED: "firewall:rule:deleted",

  // Cloudflare
  /** A DNS record was created/updated/deleted in a Cloudflare zone. */
  CLOUDFLARE_DNS_CHANGED: "cloudflare:dns:changed",
  /** Zone cache purged (everything or a list of files). */
  CLOUDFLARE_PURGED: "cloudflare:cache:purged",
  /** An IP access rule (block/whitelist/challenge) was created. */
  CLOUDFLARE_ACCESS_RULE_ADDED: "cloudflare:access-rule:added",
  /** A cert was issued for a domain whose CF zone runs ssl=flexible/off. */
  CLOUDFLARE_SSL_MODE_SUGGESTED: "cloudflare:ssl-mode:suggested",

  // Cron
  CRON_JOB_ADDED: "cron:job:added",
  CRON_JOB_REMOVED: "cron:job:removed",
  CRON_JOB_EXECUTED: "cron:job:executed",

  // Webhooks / API keys
  WEBHOOK_DELIVERED: "webhook:delivered",
  WEBHOOK_FAILED: "webhook:failed",

  // Write-behind queue (per-server) — drive failure notifications
  /** A mutation could not be enqueued (Redis down / not provisioned) and fell
   *  back to the legacy synchronous SSH path. */
  WRITE_QUEUE_DEGRADED: "write-queue:degraded",
  /** A queued job ended in `failed` state on the client server. */
  WRITE_QUEUE_JOB_FAILED: "write-queue:job:failed",
  /** A job stayed queued past WRITE_QUEUE_STUCK_MS — the worker is likely
   *  dead on that server. */
  WRITE_QUEUE_STUCK: "write-queue:stuck",
  /** The READ-path circuit breaker opened for a target (repeated query
   *  failures against the per-server cache). */
  REMOTE_CACHE_BREAKER_OPEN: "remote-cache:breaker:open",

  // Preview sandbox (PIPS) — out-of-process module-preview runtime health.
  // Emitted by `shared/preview-sandbox/runtime.ts` (instance-level, panel host);
  // listened by notifications/wireInternalNotifications. The runtime ships
  // INERT (PREVIEW_SANDBOX_ENABLED=false) so these never fire until F5.
  /** The sandbox is enabled but ran in a DEGRADED tier (e.g. Tier 2 was
   *  rejected as a silent no-op and it fell back to the confining Tier 1). */
  PREVIEW_SANDBOX_DEGRADED: "preview-sandbox:degraded",
  /** The sandbox is enabled but its boot self-test did not pass (no confining
   *  substrate / canary readable / network not cut) ⇒ previews stay fail-closed. */
  PREVIEW_SANDBOX_UNAVAILABLE: "preview-sandbox:unavailable",

  // AI assistant — CLI background jobs
  /** A CLI agent job finished successfully in background (user had closed the drawer). */
  CLI_JOB_COMPLETED: "ai:cli:job:completed",
  /** A CLI agent job finished with a non-zero exit code in background. */
  CLI_JOB_FAILED: "ai:cli:job:failed",
  /** A chat/agent run (API or attached-CLI) FINISHED in the run registry —
   *  drives the "chat finished" notification: the in-app bell always, plus an
   *  owner push (web/app/desktop) when no client was attached (user is away).
   *  NOT emitted for user-aborted runs. Payload: { conversationId, userId?,
   *  provider?, cli, errored, preview, hadSubscribers }. */
  AI_CHAT_FINISHED: "ai:chat:finished",
  /** Provider turn settled; may still await team results or human input. */
  AI_TURN_SETTLED: "ai:turn:settled",
  /** The CLI agent paused mid-run asking the user to APPROVE a mutating tool —
   *  a permission prompt is now pending. Drives the in-app "approval required"
   *  notification (the chat list + Dashboard yellow dot come from the active-runs
   *  feed's `pendingPermission` flag). Payload: { conversationId, requestId,
   *  tool, title, detail? }. */
  AI_PERMISSION_REQUESTED: "ai:permission:requested",
  /** A pending permission prompt was settled (user click / timeout / cancel).
   *  Lets the team task board clear the amber "waiting for approval" state on
   *  the leader's card. Payload: { conversationId, requestId, decision }. */
  AI_PERMISSION_RESOLVED: "ai:permission:resolved",

  /** A user-to-user CHAT message was delivered to recipients who were AWAY
   *  (no active chat stream). Drives the recipient's in-app bell + a device
   *  push (web/app/desktop), each scoped to that recipient only. Payload:
   *  { host, targetId, convId, title, body, recipients: Array<{ username, userId? }> }. */
  CHAT_MESSAGE_RECEIVED: "chat:message:received",

  // AI assistant — projects & loose chats lifecycle.
  // Drive the Obsidian module's per-project / per-chat context containers
  // WITHOUT a cross-module import (ai-assistant emits; obsidian listens).
  // Payload: { executor, userId?, project } / { executor, userId?, conversation }.
  AI_PROJECT_CREATED: "ai:project:created",
  AI_CONVERSATION_CREATED: "ai:conversation:created",
  /**
   * A project-scoped assistant turn finished OK. Drives the Obsidian module's
   * opt-in auto-capture (append a concise note to the project's context vault).
   * ai-assistant emits; obsidian listens (one-way dependency). Payload:
   * { executor, conversationId, projectId, assistantText (trimmed), ts }.
   */
  AI_CONVERSATION_COMPLETED: "ai:conversation:completed",

  // AI assistant — team delegation (leader → subordinate agents).
  /**
   * Every background task a LEADER agent delegated (team.assign) reached a
   * terminal state while the leader had NO live run and NO team.collect
   * waiting — the leader must be woken up to synthesize and deliver. Emitted
   * by team-tasks.service; agent.controller listens and enqueues an automatic
   * follow-up turn on the leader's conversation (services must not import
   * controllers). Payload: { executor, leaderConversationId, leaderAgentId,
   * userId?, user?, taskIds }.
   */
  AI_TEAM_LEADER_NUDGE: "ai:team:leader-nudge",
  /**
   * Every step of a team plan (team.plan) reached a terminal state. Drives the
   * "your team finished plan X" notification. Payload: { executor,
   * leaderConversationId, planId, title, status ("completed"|"failed"),
   * userId? }.
   */
  AI_TEAM_PLAN_COMPLETED: "ai:team:plan-completed",
  /**
   * La verificación de una tarea de equipo falló y quedan reintentos: hay que
   * encolar un turno AUTOMÁTICO de corrección en el chat del WORKER con el log.
   * Emisor: team-tasks.service (gate de finalizeTask); listener:
   * turn-queue.service (enqueue + drain — team-tasks no puede importarlo sin
   * ciclo). Payload: { executor, taskId, workerConversationId, workerAgentId,
   * projectId?, forcedCwd?, userId?, user?, failedCommand?, exitCode?, logTail,
   * attempt, maxAttempts }.
   */
  AI_TEAM_TASK_VERIFY_RETRY: "ai:team:task-verify-retry",
  /**
   * Una tarea de equipo DIFERIDA (lease ocupado / cupo de workers lleno) quedó
   * elegible: su turno inicial ya está en agent-queue y hay que drenarlo.
   * Emisor: team-tasks.service (dispatchNext); listener: turn-queue.service.
   * Payload: { executor, taskId, workerConversationId }.
   */
  AI_TEAM_TASK_DISPATCH: "ai:team:task-dispatch",
  /**
   * El estado de una tarea de equipo cambió (assigned / dispatched / verify /
   * terminal). Emitido por team-tasks.service INDEPENDIENTEMENTE del run del
   * líder (no depende de agentRunRegistry.inject, que muere cuando el stream
   * SSE del líder cierra). Permite al canal WS dedicado del asistente
   * (/api/assistant/ws) reenviar el update a TODAS las sesiones del usuario
   * aunque el run del líder ya haya terminado. El frontend deduplica con su
   * `correlationId` para no pintar dos veces si también llegó por SSE.
   * Payload: { task: TeamTaskView, phase: "assigned" | "dispatched" |
   * "verify" | "closed", correlationId, userId, leaderConversationId,
   * workerConversationId }.
   */
  AI_TEAM_TASK_UPDATE: "ai:team:task-update",

  /**
   * Un agente envió un mensaje directo a otro agente.
   * Emisor: agent-messages.service; listener: turn-queue.service (resuelve el
   * buzón, encola el turno y lo drena — hacerlo desde el emisor crearía un
   * ciclo de imports).
   * Payload: { executor, messageId, fromAgentId, toAgentId, userId?, user? }.
   */
  AI_AGENT_MESSAGE: "ai:agent:message",

  // Hosting (jail / chroot) — emitido por hosting, escuchado por notifications
  // SIN cross-import del servicio (patrón canónico del resto de módulos).
  /** El jail de una cuenta hosting no pudo aprovisionarse (jailkit ausente). */
  HOSTING_JAIL_DEGRADED: "hosting:jail:degraded",

  // Community modules (marketplace) — hot load/unload sin cross-imports.
  // Emisor: module-dev (preview Modo B). Listener: modules/community
  // (reloadModule/unloadModule). Payload: { moduleId: string }.
  COMMUNITY_RELOAD: "community:module:reload",
  COMMUNITY_UNLOAD: "community:module:unload",
} as const;
