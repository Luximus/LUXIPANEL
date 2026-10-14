// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Webhook discovery — model for webhooks *detected* on the client server,
 * regardless of whether the panel created them.
 *
 * Unlike the panel-native `webhooks` table (outbound HMAC endpoints stored in
 * the panel's own sidecar), a "discovered" webhook is any webhook-shaped
 * configuration found by scanning the connected server: Git hooks, nginx
 * receiver endpoints, cron/systemd jobs that POST to a URL, app config files,
 * and webhook references inside the projects tracked by the Files module.
 *
 * Discovery is read-only by nature; only `source === "sidecar"` items are
 * panel-managed (`managed: true`) and support full CRUD via the existing
 * webhooks controller. Everything else is surfaced for visibility and, where
 * the source is a discrete file we own (e.g. a Git hook), best-effort
 * enable/disable/delete at the source.
 */

import { sha256 } from "../../../shared/utils/crypto.js";
import type { WebhookCategory } from "./gateway-webhook.model.js";

/** Category a discovered item is scanned into. The three product categories
 *  plus an `other` bucket for webhook-shaped things that don't (yet) match any
 *  category criterion (outbound senders, legacy event webhooks, …). Only
 *  `receive-data` has a scanning criterion implemented today; `mailhook` and
 *  `response` are reserved for later phases. */
export type DiscoveryCategory = WebhookCategory | "other";

export const WEBHOOK_DISCOVERY_SOURCES = [
  "sidecar", // panel-native outbound webhook (full CRUD)
  "git-hook", // executable script under <repo>/.git/hooks
  "nginx", // incoming receiver endpoint in an nginx site (location/proxy_pass)
  "cron", // crontab line that curls/wgets a webhook URL
  "systemd", // systemd unit ExecStart hitting a webhook URL
  "config", // webhook URL found in an app/system config file
  "project", // webhook reference inside a Files-module Git project
] as const;

export type WebhookDiscoverySource = (typeof WEBHOOK_DISCOVERY_SOURCES)[number];

export interface DiscoveredWebhook {
  /** Stable id: sha256(source:location:target), truncated. Safe for the UI
   *  and for addressing an item in the action endpoint. */
  id: string;
  source: WebhookDiscoverySource;
  /** Which of the three product categories this item is scanned into (or
   *  `other`). Assigned centrally by the discovery orchestrator. */
  category?: DiscoveryCategory;
  /** Human label (repo name, site name, unit name, etc.). */
  name: string;
  /** The URL or endpoint the webhook points to / is served at. */
  target: string;
  /** Absolute file path on the client server where it was found (may carry a
   *  `:line` suffix for grep-based matches). */
  location: string;
  /** Extra context: hook type, event, cron schedule, http method, etc. */
  detail?: string;
  /** Tri-state: true/false when knowable (hook +x, site enabled, …),
   *  null when the source has no meaningful enabled flag. */
  enabled: boolean | null;
  /** Only panel-native sidecar items are fully managed (CRUD). */
  managed: boolean;
  /** Short snippet of the matched config/line (truncated), for the detail view. */
  raw?: string;
}

/** Deterministic id for a discovered item so the UI and the action endpoint
 *  agree without persisting anything. */
export function makeDiscoveryId(
  source: WebhookDiscoverySource,
  location: string,
  target: string,
): string {
  return sha256(`${source}:${location}:${target}`).slice(0, 24);
}
