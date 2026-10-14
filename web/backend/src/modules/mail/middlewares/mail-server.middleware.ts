// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { ForbiddenError } from "../../../shared/errors/index.js";
import type { RequestHandler } from "express";
import { runWithExecutor } from "../../../shared/executor/context.js";
import { resolveMailServer } from "../services/mail-server-selection.js";

/** Only mounted on mail/account routes, after auth and module permission checks. */
export const mailServerMiddleware: RequestHandler = async (req, res, next) => {
  try {
    const targetId = req.get("X-Mail-Target-Id")?.trim();
    if (!targetId) { next(); return; }
    if (res.locals.user.hostingPolicy?.runtime && !res.locals.user.hostingPolicy.security?.mailTargetIds.includes(targetId)) throw new ForbiddenError("Mail server is outside the hosting plan");
    const executor = await resolveMailServer(req, res, targetId);
    // Explicit controller lookups and ambient sidecar/socket lookups MUST agree.
    res.locals.mailExecutor = executor;
    const user = res.locals.user;
    runWithExecutor(executor, next, user.userId, user);
  } catch (error) { next(error); }
};
