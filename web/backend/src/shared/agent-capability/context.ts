// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Helpers for capability handlers — they always run inside a request scope
 * (the chat controller has already established `runWithExecutor`), so the
 * executor lookup is non-null in practice. This wrapper turns the
 * "shouldn't happen" case into a typed error instead of `as Executor`.
 *
 * The guard itself is the shared one (`shared/executor/require-executor.ts`);
 * only the message is capability-specific.
 */

import { noServerExecutor, requireExecutor as requireContextExecutor } from "../executor/index.js";
import type { Executor } from "../executor/index.js";

const NO_EXECUTOR = noServerExecutor(
  "Agent capability handler called outside a request scope (no executor in AsyncLocalStorage). " +
    "Handlers must run via the assistant chat/agent pipeline.",
);

export function requireExecutor(): Executor {
  return requireContextExecutor(null, NO_EXECUTOR);
}
