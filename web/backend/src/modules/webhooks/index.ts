// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
import type { Express } from "express";
import { webhooksRouter } from "./routes/webhooks.routes.js";
import { webhookDispatcher } from "./services/webhook-dispatcher.service.js";
import { eventBus, Events } from "../../shared/events/index.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { webhooksAgentCapability } from "./agent-capability.js";

const log = createModuleLogger("webhooks-module");

/** Forward internal events to registered webhook endpoints. */
function wireEvents(): void {
  eventBus.on(Events.USER_CREATED, (data) => webhookDispatcher.dispatch("user.created", data));
  eventBus.on(Events.USER_DELETED, (data) => webhookDispatcher.dispatch("user.deleted", data));
  eventBus.on(Events.ACCOUNT_CREATED, (data) => webhookDispatcher.dispatch("mail.account.created", data));
  eventBus.on(Events.ACCOUNT_DELETED, (data) => webhookDispatcher.dispatch("mail.account.deleted", data));
  eventBus.on(Events.SSL_ISSUED, (data) => webhookDispatcher.dispatch("ssl.cert.issued", data));
  eventBus.on(Events.ALERT_FIRING, (data) => webhookDispatcher.dispatch("alert.firing", data));
  eventBus.on(Events.ALERT_RESOLVED, (data) => webhookDispatcher.dispatch("alert.resolved", data));
  eventBus.on(Events.CLOUDFLARE_DNS_CHANGED, (data) => webhookDispatcher.dispatch("cloudflare.dns.changed", data));
  eventBus.on(Events.CLOUDFLARE_PURGED, (data) => webhookDispatcher.dispatch("cloudflare.cache.purged", data));
}

export function registerWebhooksModule(app: Express): void {
  wireEvents();
  app.use(webhooksRouter);
  registerModuleOperations("webhooks", webhooksRouter);
  agentCapabilityRegistry.register(webhooksAgentCapability);
  log.info("Webhooks module registered");
}
