// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { AppError } from "../../../shared/errors/index.js";
import { ErrorCodes } from "../../../shared/errors/codes.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";

type Resource = "role" | "team" | "agent" | "project" | "provider";
const keys = {
  role: "assistantRoleNotFound",
  team: "assistantTeamNotFound",
  agent: "assistantAgentNotFound",
  project: "assistantProjectNotFound",
  provider: "assistantProviderNotFound",
} as const;

export function assistantNotFound(locale: unknown, resource: Resource): AppError {
  return new AppError(apiModuleMessage(locale, keys[resource]), 404, ErrorCodes.NOT_FOUND);
}
