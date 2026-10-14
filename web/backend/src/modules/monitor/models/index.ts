// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
export {
  ALERT_METRICS,
  ALERT_OPERATORS,
  type AlertRule,
  type NewAlertRule,
  type AlertMetric,
  type AlertOperator,
} from "./alert-rule.model.js";

export {
  ALERT_EVENT_STATES,
  type AlertEvent,
  type NewAlertEvent,
  type AlertEventState,
} from "./alert-event.model.js";

export {
  watchdogConfigSchema,
  DEFAULT_WATCHDOG_CONFIG,
  type WatchdogConfig,
  type WatchdogStatus,
} from "./watchdog.model.js";
