// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Webhooks — AI agent capability.
 *
 * Read-only: list configured webhooks via the panel's own data-store.
 */

import type { AgentCapability } from "../../shared/agent-capability/index.js";
import { getContextUser } from "../../shared/executor/context.js";
import { runOnPanelHost } from "../../shared/executor/index.js";
import { ForbiddenError } from "../../shared/errors/index.js";
import { webhookRepository } from "./repositories/webhook.repository.js";

export const webhooksAgentCapability: AgentCapability = {
  moduleId: "webhooks",
  version: 1,
  tools: [
    {
      name: "webhooks.list",
      title: "Listar webhooks configurados",
      description:
        "Returns the panel's outbound webhooks with url, subscribed events, " +
        "and active flag. No secrets returned.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        if (getContextUser()?.kind !== "admin") throw new ForbiddenError("Webhooks requiere administración del panel");
        const all = await runOnPanelHost(() => webhookRepository.findAll());
        const compact = all.map((w) => ({
          id: w.id,
          url: w.url,
          events: w.events ?? [],
          active: w.enabled ?? false,
        }));
        return { ok: true, output: compact };
      },
    },
  ],
  suggestedPrompts: ["¿Qué webhooks tengo configurados?"],
};
