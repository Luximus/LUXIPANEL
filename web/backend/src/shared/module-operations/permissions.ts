// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { RequestHandler } from "express";
const permissions = new WeakMap<RequestHandler, string>();
export function bindOperationPermission(action: string, handler: RequestHandler): RequestHandler {
  permissions.set(handler, action); return handler;
}
export function operationPermission(handlers: Array<{ handle: RequestHandler }>): string | undefined {
  return handlers.map(layer => permissions.get(layer.handle)).filter(Boolean).at(-1);
}
