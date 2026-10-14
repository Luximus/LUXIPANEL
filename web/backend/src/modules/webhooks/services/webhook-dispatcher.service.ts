// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Webhook dispatcher — delivers event payloads to registered endpoints.
 *
 * Signs each payload with HMAC-SHA256 using the webhook's secret.
 * Retries up to 3 times with exponential back-off.
 * Disables a webhook after 10 consecutive failures.
 */

import crypto from "node:crypto";
import http from "node:http";
import https from "node:https";
import { webhookRepository } from "../repositories/webhook.repository.js";
import { type WebhookEvent } from "../models/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { runOnPanelHost } from "../../../shared/executor/index.js";
import { assertPublicUrlPinned } from "../../../shared/net/ssrf-guard.js";
import { deliveryRepository } from "../repositories/delivery.repository.js";
import { NotFoundError } from "../../../shared/errors/index.js";

const log = createModuleLogger("webhook-dispatcher");

const MAX_FAILURES = 10;
const RETRY_DELAYS_MS = [1_000, 5_000, 15_000]; // 3 attempts

function sign(payload: string, secret: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

type PinnedUrl = Awaited<ReturnType<typeof assertPublicUrlPinned>>;

async function deliver(target: PinnedUrl, payload: string, signature: string, event: string): Promise<{ ok: boolean; status: number | null }> {
  const { url, pinnedAddress } = target;
  return new Promise((resolve) => {
    const transport = url.protocol === "https:" ? https : http;
    // Connect to the vetted IP, retaining the original host for HTTP routing,
    // TLS SNI and certificate verification. No second DNS lookup can rebind it.
    const req = transport.request({
      hostname: pinnedAddress,
      port: url.port ? Number(url.port) : undefined,
      path: `${url.pathname}${url.search}`,
      method: "POST",
      ...(url.protocol === "https:" ? { servername: url.hostname } : {}),
      headers: {
        Host: url.host,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "X-Luxipanel-Signature": signature,
        "X-Luxipanel-Event": event,
        "User-Agent": "LUXIPANEL-Webhook/2.0",
      },
    }, (res) => {
      res.resume();
      const status = res.statusCode ?? 0;
      // Node's http(s).request does not follow redirects.
      resolve({ ok: status >= 200 && status < 300, status });
    });
    req.setTimeout(10_000, () => req.destroy(new Error("Webhook timeout")));
    req.on("error", () => resolve({ ok: false, status: null }));
    req.end(payload);
  });
}

export const webhookDispatcher = {
  async test(id: number): Promise<{ delivered: boolean; status: number | null }> {
    const hook = await webhookRepository.findById(id);
    if (!hook) throw new NotFoundError("Webhook");
    const event = "webhook.test";
    const payload = JSON.stringify({ event, data: { test: true }, ts: Date.now() });
    const target = await assertPublicUrlPinned(hook.url);
    const result = await deliver(target, payload, sign(payload, hook.secret), event);
    await deliveryRepository.record({ webhookId: id, event, delivered: result.ok, status: result.status, attempts: 1, at: new Date().toISOString() });
    return { delivered: result.ok, status: result.status };
  },
  /**
   * Dispatch an event to all subscribed webhooks.
   * Fire-and-forget — does not await delivery.
   */
  dispatch(event: WebhookEvent, data: unknown): void {
    // Runs from the event bus with NO request in scope → no AsyncLocalStorage
    // executor. Webhook config is instance state (panel host), so pin the
    // panel-host executor; otherwise dataStore(undefined) fail-closes and the
    // try/catch swallows it → outgoing webhooks would silently never deliver.
    // .catch() is REQUIRED: any rejection here would surface as an unhandled
    // rejection and the top-level handler in server.ts terminates the process.
    runOnPanelHost(() => this._dispatchAsync(event, data)).catch((err) => {
      log.error({ err, event }, "Unhandled rejection in webhook dispatch");
    });
  },

  async _dispatchAsync(event: WebhookEvent, data: unknown): Promise<void> {
    try {
      let hooks;
      try {
        hooks = await webhookRepository.findByEvent(event);
      } catch (err) {
        log.warn({ err, event }, "Failed to look up webhook subscribers; skipping dispatch");
        return;
      }

      let payload: string;
      try {
        payload = JSON.stringify({ event, data, ts: Date.now() });
      } catch (err) {
        log.error({ err, event }, "Failed to serialize webhook payload; skipping dispatch");
        return;
      }

      for (const hook of hooks) {
        const signature = sign(payload, hook.secret);
        let delivered = false;
        let status: number | null = null;
        let attempts = 0;

        // SSRF pre-flight: refuse to dial a URL whose scheme is not http(s) or
        // that resolves to a private/loopback/link-local address. A blocked
        // hook is treated as a delivery failure (falls through to the failure
        // path below) so a hostile/misconfigured endpoint eventually disables.
        let target: PinnedUrl | null = null;
        try {
          target = await assertPublicUrlPinned(hook.url);
        } catch (err) {
          log.warn({ err, hookId: hook.id, event }, "Webhook URL blocked by SSRF guard; skipping delivery");
        }

        for (let attempt = 0; target && attempt < RETRY_DELAYS_MS.length; attempt++) {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]!));
          }
          attempts++;
          const outcome = await deliver(target, payload, signature, event);
          delivered = outcome.ok;
          status = outcome.status;
          if (delivered) break;
        }

        await deliveryRepository.record({ webhookId: hook.id, event, delivered, status, attempts, at: new Date().toISOString() })
          .catch((err) => log.warn({ err, hookId: hook.id }, "Could not save webhook delivery history"));

        try {
          if (delivered) {
            await webhookRepository.resetFailure(hook.id);
            log.debug({ hookId: hook.id, event }, "Webhook delivered");
          } else {
            await webhookRepository.incrementFailure(hook.id);
            log.warn({ hookId: hook.id, event, failures: hook.failureCount + 1 }, "Webhook delivery failed");

            if (hook.failureCount + 1 >= MAX_FAILURES) {
              await webhookRepository.update(hook.id, { enabled: false });
              log.warn({ hookId: hook.id }, "Webhook disabled after max failures");
            }
          }
        } catch (err) {
          // A failing repository write must never propagate; it would crash
          // the backend via the unhandled-rejection handler.
          log.error({ err, hookId: hook.id, event }, "Failed to update webhook delivery state");
        }
      }
    } catch (err) {
      // Last-resort guard so _dispatchAsync can never reject and bubble up
      // to the top-level unhandledRejection handler.
      log.error({ err, event }, "Unexpected error in webhook dispatch");
    }
  },
};
