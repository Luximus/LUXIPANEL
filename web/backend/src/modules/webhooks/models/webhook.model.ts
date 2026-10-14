// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Webhook types — registered external endpoints for event delivery.
 */

export const WEBHOOK_EVENTS = [
  "user.created", "user.deleted",
  "mail.account.created", "mail.account.deleted",
  "ssl.cert.issued",
  "alert.firing", "alert.resolved",
  "backup.completed", "backup.failed",
  "cloudflare.dns.changed", "cloudflare.cache.purged",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface Webhook {
  id: number;
  name: string;
  url: string;
  /** HMAC-SHA256 signing secret for payload verification. */
  secret: string;
  /** List of subscribed event types. */
  events: WebhookEvent[];
  enabled: boolean;
  /** Consecutive delivery failures. Reset on success. */
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewWebhook {
  id?: number;
  name: string;
  url: string;
  /** HMAC-SHA256 signing secret for payload verification. */
  secret: string;
  /** List of subscribed event types. */
  events?: WebhookEvent[];
  enabled?: boolean;
  /** Consecutive delivery failures. Reset on success. */
  failureCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
