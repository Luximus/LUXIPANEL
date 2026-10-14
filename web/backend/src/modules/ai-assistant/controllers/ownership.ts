// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Ownership guard shared by the assistant's user-owned entities (B-22).
 *
 * `agents`, `agent-roles`, `agent-teams` and `projects` share this guard. Rows with
 * `ownerId == null` are LEGACY/global (created before ownership existed) and
 * stay editable by anyone — that pre-existing semantics is preserved here.
 */

import { getContextUserId } from "../../../shared/executor/index.js";
import { ForbiddenError } from "../../../shared/errors/index.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";

/**
 * Throw `ForbiddenError` when `ownerId` belongs to a different panel user.
 *
 * @param ownerId Row owner (`null`/`undefined` ⇒ legacy row, always editable).
 * @param locale  Request locale selected by the HTTP middleware.
 */
export function assertOwner(ownerId: number | null | undefined, locale: unknown): void {
  if (ownerId != null && ownerId !== getContextUserId()) {
    throw new ForbiddenError(apiModuleMessage(locale, "assistantOwnershipDenied"));
  }
}
