// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { SessionUser } from "../../../shared/types/index.js";
import type { RequestHandler } from "express";
import { ForbiddenError } from "../../../shared/errors/index.js";
import { getExecutorAsync } from "../../../shared/executor/factory.js";
import { resolveTerminalIdentity } from "../services/terminal-access.service.js";
import { readBridgeHeader, resolveOverrideBridge } from "../../../shared/session/bridge-header.js";

export const requireTerminalAccess: RequestHandler = (req, res, next) => {
  void (async () => {
    const user = res.locals.user as SessionUser | undefined;
    if (!user || (user.kind !== "admin" && !(user.hostingPolicy?.runtime && user.hostingPolicy.state === "ready" && user.hostingPolicy.security?.shell === "jailed"))) throw new ForbiddenError("Terminal requires an administrator account");
    const explicitBridge = readBridgeHeader(req.headers);
    if (explicitBridge && explicitBridge !== user.bridgeSessionId) {
      const override = await resolveOverrideBridge(explicitBridge, user);
      if (!override) throw new ForbiddenError("Terminal server session expired or belongs to another user");
    }
    const identity = await resolveTerminalIdentity(await getExecutorAsync(req), user);
    if (!identity) throw new ForbiddenError("Terminal requires a live sudo-group account on this server");
    res.locals.terminalIdentity = identity;
    next();
  })().catch(next);
};

/** File-backed CLI/history services use SFTP as the connection account. Until
 * they can switch SFTP identity, they must never read another account's HOME. */
export const requireTerminalOwnerIdentity: RequestHandler = (_req, res, next) => {
  if (res.locals.terminalIdentity?.switchUser) {
    next(new ForbiddenError("This operation requires connecting as your own Linux account"));
    return;
  }
  next();
};
