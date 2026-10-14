// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Notification — message surfaced in the panel bell dropdown.
 *
 * Stored as JSON sidecars on the connected server under
 * `${LUXIPANEL_CONFIG_DIR}/notifications/notifications.json` (or the
 * override path declared in `NOTIFICATIONS_DIR` in the panel .env). Each
 * row has a source so the UI can filter system vs. module vs. AI traffic.
 */

import type { NotificationTarget } from "./notification-target.js";

export type NotificationSource =
  | "system"
  | "module"
  | "ai"
  | "security"
  | "user";

export type NotificationSeverity = "info" | "success" | "warning" | "error";

export interface Notification {
  id: string;
  /** Origin bucket — used for filtering in the dropdown. */
  source: NotificationSource;
  /** Free-form sub-source identifier (e.g. "ssl", "fail2ban", "openclaw"). */
  module?: string | null;
  severity: NotificationSeverity;
  title: string;
  message: string;
  /** Optional deep-link the bell item navigates to when clicked. */
  link?: string | null;
  /**
   * Aterrizaje EXACTO (mismo shape que `SearchTarget`): además de navegar,
   * puede abrir un tab/drawer (`click`) o despachar un evento de la allowlist.
   * `link` se mantiene como fallback para clientes que no ejecutan targets.
   */
  target?: NotificationTarget | null;
  /** When the notification is targeted at a specific user; null = global. */
  userId?: number | null;
  read: boolean;
  readAt?: string | null;
  /** For global rows, read/dismiss state belongs to each viewer. */
  readBy?: number[];
  hiddenBy?: number[];
  createdAt: string;
  /** Free-form context payload — never echoed to the UI without filtering. */
  metadata?: Record<string, unknown> | null;
}

export interface NewNotification {
  source: NotificationSource;
  module?: string | null;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  link?: string | null;
  target?: NotificationTarget | null;
  userId?: number | null;
  metadata?: Record<string, unknown> | null;
}
