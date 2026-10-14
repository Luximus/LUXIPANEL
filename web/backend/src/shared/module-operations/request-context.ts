// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { Request } from "express";
import type { Executor } from "../executor/types.js";
import type { SessionUser } from "../types/index.js";
import { getContextExecutor, getContextUser } from "../executor/context.js";

// This authority is an object identity, never a header/cookie a client can send.
const requests = new WeakMap<object, { executor: Executor; user: SessionUser }>();

export function bindToolRequest(req: Request): void {
  const executor = getContextExecutor(), user = getContextUser();
  if (!executor || !user || user.kind === "mfa_pending") throw new Error("Authenticated tool context required");
  requests.set(req, { executor, user });
}

export function toolRequestContext(req: Request | undefined): { executor: Executor; user: SessionUser } | undefined {
  const bound = req && requests.get(req);
  return bound && bound.executor === getContextExecutor() && bound.user === getContextUser() ? bound : undefined;
}
