// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Monitor executor selection.
 */

import {
  localExecutor,
  getDirectExecutorByBridgeSessionId,
  type Executor,
} from "../../../shared/executor/index.js";
import { NoServerExecutorError } from "../../../shared/errors/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("monitor-executor");

/**
 * Resolve the executor a monitor endpoint should sample.
 *
 * - No bridge id (a `local` session — the panel manages the box it runs on):
 *   the panel-host `localExecutor`.
 * - A bridge id that resolves to live direct-SSH credentials (a target switched
 *   from the `servers` vault): that node's DirectSshExecutor.
 * - A bridge id from a DIRECT (remote-target) session with NO live credentials
 *   (the SSH session expired/was revoked): **fail-closed** — throw. Falling back
 *   to `localExecutor` here would sample the PANEL HOST and report it under the
 *   remote target's session = cross-tenant leak (CLAUDE.md fail-closed
 *   invariant; mirrors `getExecutorAsync`).
 * - A bridge id from a NON-direct (local) session that merely carries a stale
 *   bridge id: `localExecutor` — this is the panel's own box, not another
 *   tenant, so a degraded local read is correct (no leak).
 *
 * `opts.direct` is the authoritative signal (set from the resolved
 * `bridgedSession.direct` / token `payload.direct`) that the session targets a
 * REMOTE server; without it a bare bridge id cannot be told apart from a local
 * session's, so callers MUST pass it.
 */
export async function resolveMonitorExecutor(
  bridgeSessionId?: string,
  opts: { direct?: boolean } = {},
): Promise<Executor> {
  if (!bridgeSessionId) {
    return localExecutor;
  }
  const directExec = await getDirectExecutorByBridgeSessionId(bridgeSessionId).catch((err) => {
    log.warn({ err, bridgeSessionId }, "Direct executor lookup failed in monitor executor");
    return null;
  });
  if (directExec) return directExec;
  if (opts.direct) {
    // Remote-target session with no live SSH material → never sample the host.
    throw new NoServerExecutorError(
      "El servidor remoto no está disponible (sesión SSH expirada). Vuelve a seleccionar el servidor.",
    );
  }
  return localExecutor;
}
