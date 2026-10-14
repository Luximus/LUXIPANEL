// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Webhook discovery detector — sidecar.
 *
 * These are the panel-native outbound webhooks stored in the panel's own
 * sidecar (`webhooks/webhooks.json`). They are fully managed (CRUD via the
 * webhooks controller), so `managed: true`. The `location` carries a
 * `#<id>` suffix so the action endpoint can parse the numeric id back.
 *
 * Fail-soft: any error resolves to [], never throws.
 */

import type { Executor } from "../../../../shared/executor/index.js";
import { createModuleLogger } from "../../../../shared/logger/index.js";
import {
  type DiscoveredWebhook,
  makeDiscoveryId,
} from "../../models/discovery.model.js";
import { webhookRepository } from "../../repositories/webhook.repository.js";
import { clampRaw, type WebhookDetector } from "./types.js";

const log = createModuleLogger("webhook-discovery:sidecar");

export const sidecarDetector: WebhookDetector = {
  source: "sidecar",
  async detect(executor: Executor): Promise<DiscoveredWebhook[]> {
    try {
      const webhooks = await webhookRepository.findAll(executor);
      const out: DiscoveredWebhook[] = [];
      for (const w of webhooks) {
        const target = w.url;
        const location = `webhooks/webhooks.json#${w.id}`;
        const events = Array.isArray(w.events) ? w.events : [];
        let detail = `${events.length} evento(s)`;
        if (w.failureCount > 0) detail += ` · ${w.failureCount} fallo(s)`;
        out.push({
          id: makeDiscoveryId("sidecar", location, target),
          source: "sidecar",
          name: w.name,
          target,
          location,
          detail,
          enabled: w.enabled,
          managed: true,
          raw: clampRaw(events.join(", ")),
        });
      }
      return out;
    } catch (err) {
      log.warn({ err }, "sidecar detector failed");
      return [];
    }
  },
};
