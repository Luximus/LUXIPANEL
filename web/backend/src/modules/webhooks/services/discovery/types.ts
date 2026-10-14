// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Webhook discovery — detector contract.
 *
 * A detector inspects ONE class of source on the connected client server and
 * returns the webhook-shaped things it found. Detectors must be defensive: a
 * scan failure (permission denied, tool missing, timeout) must resolve to an
 * empty array, never throw — the orchestrator runs them with `allSettled` but
 * detectors should still degrade gracefully on their own.
 *
 * All filesystem / command access goes through the per-server `Executor`
 * (SSH/SFTP in managed mode). NEVER touch the panel host's filesystem.
 */

import type { Executor } from "../../../../shared/executor/index.js";
import { CODE_SCAN_ROOTS } from "../../../../shared/constants.js";
import type { DiscoveredWebhook } from "../../models/discovery.model.js";

export interface WebhookDetector {
  /** Source label, used for logging. Matches DiscoveredWebhook.source. */
  readonly source: string;
  /** Inspect the connected server and return discovered webhooks. */
  detect(executor: Executor): Promise<DiscoveredWebhook[]>;
}

/** Roots scanned by filesystem-walking detectors. Mirrors the Files module's
 *  project scan roots so "webhooks in projects" lines up with what users see
 *  in Files — single source of truth in `shared/constants.ts`. */
export const DISCOVERY_SCAN_ROOTS = CODE_SCAN_ROOTS;

/** Max directory depth for `find`-based walks (keeps scans bounded). */
export const DISCOVERY_MAX_DEPTH = 5;

/** Per-detector wall-clock budget (ms). The orchestrator also caps total time. */
export const DETECTOR_TIMEOUT_MS = 20_000;

/** Truncate a matched snippet for the `raw` field. */
export function clampRaw(s: string, max = 240): string {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}

/** URL pattern shared by grep-based detectors (http/https). */
export const WEBHOOK_URL_RE = /https?:\/\/[^\s"'`)>;]+/gi;

/** First http(s) URL found in a blob of script text, or null. */
export function firstUrl(text: string): string | null {
  // WEBHOOK_URL_RE is a shared /g regex; reset lastIndex before use.
  WEBHOOK_URL_RE.lastIndex = 0;
  const m = WEBHOOK_URL_RE.exec(text);
  WEBHOOK_URL_RE.lastIndex = 0;
  return m ? m[0] : null;
}

/**
 * Mask the secret material in a webhook URL. For Slack/Discord/etc. incoming
 * webhooks the token IS the path (`hooks.slack.com/services/T../B../XXXX`), so
 * returning the URL verbatim to any user with the `webhooks` module leaks the
 * credential. Keep scheme + host (enough to identify the provider) and redact
 * the path/query. Non-URLs pass through unchanged.
 */
export function maskSecretUrl(url: string): string {
  try {
    const u = new URL(url);
    const hasSecretTail = (u.pathname && u.pathname !== "/") || u.search.length > 0;
    return `${u.protocol}//${u.host}${hasSecretTail ? "/…" : ""}`;
  } catch {
    return url;
  }
}

/** Redact every http(s) URL inside a free-text snippet (for the `raw` field). */
export function maskSecretsInText(text: string): string {
  return (text ?? "").replace(/https?:\/\/[^\s"'`)>;]+/gi, (m) => maskSecretUrl(m));
}

/**
 * Parse a `grep -n` line of the form `file:lineNo:content`.
 * @see shared/utils/grep.ts — one parser for the whole backend.
 */
export { parseGrepLine } from "../../../../shared/utils/grep.js";
