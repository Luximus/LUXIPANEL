// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Database CLI needs socket-admin privileges even for a hosting tenant.
 * The controller and AI capability validate database ownership before using
 * this executor. Arbitrary SQL remains unavailable to hosting sessions. */
import type { Executor } from "../../../shared/executor/index.js";
import { PrivilegeDropExecutor } from "../../../shared/executor/privilege-drop-executor.js";
import { getContextUser } from "../../../shared/executor/context.js";
import { ForbiddenError } from "../../../shared/errors/index.js";
import { getTenantEnvelope, isHostingSession } from "../../../shared/tenant/tenant-scope.js";

export function databaseExecutor(executor: Executor): Executor {
  const user = getContextUser();
  if (!isHostingSession(user)) return executor;
  const owner = getTenantEnvelope(user!).owner;
  const elevated = executor instanceof PrivilegeDropExecutor ? executor.trustedServiceExecutorFor(owner) : null;
  if (!elevated) throw new ForbiddenError("No se pudo verificar el servidor de la cuenta de hosting");
  return elevated;
}
