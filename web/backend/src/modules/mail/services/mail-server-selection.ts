// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Resolve a mail-only server override without changing the session's target. */
import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import { AppError, ValidationError } from "../../../shared/errors/index.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import { apiLocaleFromRequest } from "../../../shared/i18n/errors.js";
import { assertSafeTargetHost } from "../../../shared/net/host-policy.js";
import { runOnPanelHost } from "../../../shared/executor/context.js";
import { getDirectExecutorByBridgeSessionId, getExecutor } from "../../../shared/executor/factory.js";
import { sshCredentialsCache } from "../../auth/services/ssh-credentials-cache.service.js";
import { targetsRepository } from "../../servers/repositories/targets.repository.js";
import { userMayUseTarget } from "../../servers/services/servers.service.js";
import { viewerOf } from "../../servers/controllers/servers.controller.js";
import { isHostingSession } from "../../../shared/tenant/tenant-scope.js";

export async function resolveMailServer(req: Request, res: Response, targetId: string) {
  const current = getExecutor(req);
  if (!targetId || targetId === current.target.id) return current;
  const message = (key: Parameters<typeof apiModuleMessage>[1]) => apiModuleMessage(res.locals.locale ?? apiLocaleFromRequest(req), key);
  if (isHostingSession(res.locals.user)) {
    throw new ValidationError(message("serverHostingSwitchDenied"));
  }
  // Authorize before decrypting SSH material or revealing server status.
  const target = await runOnPanelHost(() => targetsRepository.get(targetId));
  if (!target || !userMayUseTarget(target, viewerOf(res))) {
    throw new AppError(message("serverNotFound"), 404, "NOT_FOUND");
  }
  if (!target.enabled) throw new ValidationError(message("serverTargetDisabled"));
  if (!target.hostFingerprint) throw new ValidationError(message("serverFingerprintRequired"));
  const { pinnedAddress } = await assertSafeTargetHost(target.host);
  const found = await runOnPanelHost(() => targetsRepository.getMaterial(targetId));
  // Re-check the actual decrypted revision in case the record changed during DNS resolution.
  if (!found || !userMayUseTarget(found.target, viewerOf(res))) {
    throw new AppError(message("serverNotFound"), 404, "NOT_FOUND");
  }
  if (!found.target.enabled) throw new ValidationError(message("serverTargetDisabled"));
  if (!found.target.hostFingerprint) throw new ValidationError(message("serverFingerprintRequired"));
  if (found.target.host !== target.host || found.target.updatedAt !== target.updatedAt
    || found.target.secretEnc !== target.secretEnc || found.target.hostFingerprint !== target.hostFingerprint) {
    throw new ValidationError(message("serverNotFound"));
  }
  // Separate from the panel bridge; never expose or replace its session id.
  // Revision + ciphertext bind cached connections to current vault credentials.
  const bridgeId = "mail:" + createHash("sha256").update(JSON.stringify({
    userId: res.locals.user.userId,
    session: res.locals.bridgedSession?.bridgeSessionId ?? current.target.id,
    targetId, host: pinnedAddress ?? target.host, revision: target.updatedAt,
    secret: target.secretEnc, pin: target.hostFingerprint,
  })).digest("hex");
  await sshCredentialsCache.put(bridgeId, {
    ...found.material, host: pinnedAddress ?? found.material.host,
    userId: res.locals.user.userId, targetId, targetName: target.name,
  }, 300);
  const executor = await getDirectExecutorByBridgeSessionId(bridgeId, targetId, target.name);
  if (!executor) throw new AppError(message("serverNotFound"), 404, "NOT_FOUND");
  return executor;
}
