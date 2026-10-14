// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Alert event model — records when an alert rule fired or resolved.
 */

export const ALERT_EVENT_STATES = ["firing", "resolved"] as const;
export type AlertEventState = (typeof ALERT_EVENT_STATES)[number];

export interface AlertEvent {
  id: number;
  ruleId: number;
  state: AlertEventState;
  /** The metric value that triggered the event. */
  triggerValue: number;
  firedAt: Date;
  /** Set when the condition clears. */
  resolvedAt: Date | null;
}

export interface NewAlertEvent {
  id?: number;
  ruleId: number;
  state: AlertEventState;
  /** The metric value that triggered the event. */
  triggerValue: number;
  firedAt?: Date;
  /** Set when the condition clears. */
  resolvedAt?: Date | null;
}
