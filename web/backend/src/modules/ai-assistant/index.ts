// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { Express } from "express";
import { aiRouter } from "./routes/ai.routes.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { env } from "../../config/env.js";
import { headroomClient } from "./services/headroom-client.service.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { serversAgentCapability } from "./servers-agent-capability.js";
import { browserAgentCapability } from "./browser-agent-capability.js";
import { teamTemplatesService } from "./services/team-templates.service.js";
import { teamTasksService } from "./services/team-tasks.service.js";
import { agentMessagesService } from "./services/agent-messages.service.js";
import {
  initTeamNudgeListener,
  initTeamDispatchListener,
  initTeamVerifyRetryListener,
  initAgentMessageListener,
} from "./services/turn-queue.service.js";
import { handleAssistantConnection } from "./controllers/assistant-ws.controller.js";
import type { WsRouter } from "../../shared/websocket/ws-router.js";
import { registerLogsRepairAgent } from "./services/logs-repair-adapter.js";

const log = createModuleLogger("ai-module");

// Public surface of the module for other modules (F3 audio calls): resolve the
// provider credentials (OpenAI + ElevenLabs) configured on the target.
export {
  resolveCallProviderCredentials,
  assistantIntegrationsService,
} from "./services/integrations.service.js";

export function registerAiModule(app: Express): void {
  registerLogsRepairAgent();
  // Validate the team-templates seed at boot (cheap O(n) over 10 templates).
  // Fails loudly if the curated content is broken so we catch typos before
  // users hit the wizard.
  teamTemplatesService.validateAllAtBoot();
  // Belt-and-braces close path for team tasks whose worker run finished
  // without our spawn onComplete (e.g. CLI runs recovered after a restart).
  teamTasksService.init();
  // Leader wake-up: when a delegated batch finishes with no leader run alive,
  // enqueue+drain an automatic follow-up turn on the leader's conversation.
  initTeamNudgeListener();
  // Despacho de tareas diferidas (lease/cupo): drena el turno inicial ya
  // encolado cuando la tarea gana su hueco.
  initTeamDispatchListener();
  // Reintento de verificación: turno automático de corrección en el chat del
  // worker cuando la receta de verify falla con intentos restantes.
  initTeamVerifyRetryListener();
  // Cierre de los mensajes agente↔agente: el buzón del destinatario responde y
  // el mensaje pasa de `delivered` a `read` (AI_CHAT_FINISHED).
  agentMessagesService.init();
  // Entrega de `agents.send_message`: resuelve el buzón del par emisor→destino,
  // encola un turno automático y despierta al destinatario aunque esté apagado.
  initAgentMessageListener();
  app.use(aiRouter);
  // Cross-server execution tools (servers.exec / read_file / list_dir) — let a
  // project-scoped chat act on the OTHER server connections it's associated with.
  agentCapabilityRegistry.register(serversAgentCapability);
  // Verificación visual (Chromium headless en el target) para agentes QA.
  if (env.ASSISTANT_BROWSER_TOOLS_ENABLED) agentCapabilityRegistry.register(browserAgentCapability);
  // Warm the Headroom health cache so the FIRST tool compression of the process
  // isn't skipped while a lazy background ping resolves. Fire-and-forget,
  // fail-open (ping never throws). Loopback HTTP only — no Executor needed.
  if (env.HEADROOM_ENABLED) void headroomClient.ping();
  log.info("AI Assistant module registered");
}

/** Register /api/assistant/ws in the centralized WsRouter. Called from
 *  server.ts after `app.listen()` (matches the terminal/monitor/ui-sync pattern). */
export function attachAssistantWebSocket(router: WsRouter): void {
  router.register("/api/assistant/ws", (ws, req) => handleAssistantConnection(ws, req));
  log.info("Assistant WebSocket handler registered at /api/assistant/ws");
}
