// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Alert rule model — defines threshold conditions for monitoring alerts.
 *
 * Each rule watches one metric and fires when the value crosses a threshold
 * for a sustained number of consecutive samples.
 */

/** Metrics that can be monitored. */
export const ALERT_METRICS = [
  "cpu_usage_percent",
  "memory_usage_percent",
  "disk_usage_percent",
  "load_avg_1m",
  "load_avg_5m",
  "rx_bytes_per_sec",
  "tx_bytes_per_sec",
] as const;

export type AlertMetric = (typeof ALERT_METRICS)[number];

/** Comparison operators. */
export const ALERT_OPERATORS = ["gt", "gte", "lt", "lte"] as const;
export type AlertOperator = (typeof ALERT_OPERATORS)[number];

export interface AlertRule {
  id: number;
  /** Human-readable rule name, e.g. "High CPU". */
  name: string;
  metric: AlertMetric;
  operator: AlertOperator;
  /** Threshold value to compare against. */
  threshold: number;
  /**
   * How many consecutive samples must breach the threshold before firing.
   * Prevents false positives from transient spikes. Default: 1 (fire immediately).
   */
  sustainedSamples: number;
  enabled: boolean;
  /** Suppress notification delivery until this instant; evaluation continues. */
  mutedUntil: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewAlertRule {
  id?: number;
  /** Human-readable rule name, e.g. "High CPU". */
  name: string;
  metric: AlertMetric;
  operator: AlertOperator;
  /** Threshold value to compare against. */
  threshold: number;
  /**
   * How many consecutive samples must breach the threshold before firing.
   * Prevents false positives from transient spikes. Default: 1 (fire immediately).
   */
  sustainedSamples?: number;
  enabled?: boolean;
  mutedUntil?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}
