// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Ownership guard shared by the assistant's user-owned entities (B-22).
 *
 * `agents`, `agent-roles`, `agent-teams` and `projects` share this guard.
 * Rows with `ownerId == null` are global workspaces. They are deliberately
 * available to panel administrators, but never become writable by a regular
 * panel user merely because they have no individual owner.
 */

import { getContextUser, getContextUserId } from "../../../shared/executor/index.js";
import { ForbiddenError } from "../../../shared/errors/index.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import type { SessionUser } from "../../../shared/types/index.js";

/** A global assistant workspace is shared between panel administrators only. */
export function isAssistantAdministrator(user: SessionUser | null | undefined = getContextUser()): boolean {
  // `kind` is the authoritative value on a normal session. The role fallback
  // keeps locally-issued legacy/internal sessions compatible; it is still
  // derived by the server, never accepted from a request body.
  return user?.kind === "admin" || user?.role === "admin";
}

/**
 * Throw `ForbiddenError` when `ownerId` belongs to a different panel user, or
 * an ownerless/global row is requested by a non-administrator.
 *
 * @param ownerId Row owner (`null`/`undefined` ⇒ global administrator row).
 * @param locale  Request locale selected by the HTTP middleware.
 */
export function assertOwner(
  ownerId: number | null | undefined,
  locale: unknown,
  user: SessionUser | null | undefined = getContextUser(),
): void {
  const userId = user?.userId ?? getContextUserId();
  if (ownerId != null ? ownerId === userId : isAssistantAdministrator(user)) return;
  throw new ForbiddenError(apiModuleMessage(locale, "assistantOwnershipDenied"));
}
