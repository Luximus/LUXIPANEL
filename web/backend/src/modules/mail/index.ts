// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
/**
 * Mail module — self-registering modular monolith module.
 */

import type { Express } from "express";
import { mailRouter } from "./routes/mail.routes.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { errMessage } from "../../shared/utils/err-message.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { mailAgentCapability } from "./agent-capability.js";
import { eventBus, Events } from "../../shared/events/index.js";
import { mailOutboundService, type SystemMailMessage } from "./services/outbound.service.js";
import type { Executor } from "../../shared/executor/index.js";

const log = createModuleLogger("mail-module");

export function registerMailModule(app: Express): void {
  app.use(mailRouter);
  registerModuleOperations("mail", mailRouter);
  agentCapabilityRegistry.register(mailAgentCapability);

  // System emails requested by OTHER modules (cron reports, approval links…)
  // via the event bus — modules never import each other directly.
  eventBus.on(Events.SYSTEM_MAIL_SEND, (payload: SystemMailMessage & { executor?: Executor | null }) => {
    void mailOutboundService
      .sendSystemMail(payload.executor ?? null, payload)
      .catch((err) => log.warn({ err: errMessage(err), to: payload.to }, "System mail send failed"));
  });

  log.info("Mail module registered");
}
