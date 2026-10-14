// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Event → device-push bridges: the wiring boilerplate, once (B-32).
 *
 * `chat-finished-push` and `chat-message-push` both carried a module-level
 * `wired` flag, an `eventBus.on(...)` with a cast of the untyped payload, and a
 * closing `log.info`. Only the payload handling differs, so that is all a
 * bridge has to supply now.
 *
 * The idempotence flag matters: `wireInternalNotifications` may run more than
 * once (module reload / re-bootstrap) and a second subscription would send
 * every push twice.
 */

import { eventBus } from "../../../shared/events/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("push-bridge");

/** Bridges already wired in this process, by name. */
const wired = new Set<string>();

export interface PushBridgeSpec<Payload> {
  /** Stable bridge name (used for the idempotence guard and the log line). */
  name: string;
  /** Event bus topic to subscribe to. */
  event: string;
  /** What to do with each payload. MUST NOT throw (it runs in a bus callback). */
  handle: (payload: Payload) => void;
  /** Message for the one-time `log.info` after subscribing. */
  wiredLog: string;
}

/**
 * Subscribe a push bridge exactly once. Payloads arrive untyped from the bus
 * and are narrowed to `Payload` (defaulting to `{}` when null/undefined), which
 * is what every bridge did by hand.
 */
export function wirePushBridge<Payload extends object>(spec: PushBridgeSpec<Payload>): void {
  if (wired.has(spec.name)) return;
  wired.add(spec.name);
  eventBus.on(spec.event, (payload: unknown) => {
    spec.handle((payload ?? {}) as Payload);
  });
  log.info(spec.wiredLog);
}
