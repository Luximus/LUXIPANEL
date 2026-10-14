// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Target switch controller — standalone local twin of
 * `auth.service.establishBridgeForAuthenticatedUser`, WITHOUT LP.
 *
 * POST /api/servers/:id/switch reads the target's decrypted material from the
 * LOCAL vault (under `runOnPanelHost`, so the vault read is pinned to the panel
 * host), mints a fresh bridgeSessionId, and stashes the material in the shared
 * `sshCredentialsCache`. The existing direct-SSH path then consumes it when the
 * client sends `X-Bridge-Session-Id` — no changes to session.middleware/factory.
 *
 * The material carries `expectedHostFingerprint` (from the approved pin), so
 * DirectSshExecutor pins the host key and fails closed on mismatch.
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { AppError, ValidationError } from "../../../shared/errors/index.js";
import { ErrorCodes } from "../../../shared/errors/codes.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import { assertSafeTargetHost } from "../../../shared/net/host-policy.js";
import { runOnPanelHost } from "../../../shared/executor/index.js";
import { sshCredentialsCache } from "../../auth/services/ssh-credentials-cache.service.js";
import { targetsRepository } from "../repositories/targets.repository.js";
import { userMayUseTarget } from "../services/servers.service.js";
import { viewerOf } from "./servers.controller.js";
import { disposeDirectExecutor } from "../../../shared/executor/factory.js";
import { readBridgeHeader } from "../../../shared/session/bridge-header.js";
import { LOCAL_TARGET_ID } from "../../../shared/executor/local-executor.js";
import { bridgeTtlSeconds, resignSessionWithBridge } from "../services/target-switch.service.js";
import { randomUUID } from "node:crypto";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { isHostingSession } from "../../../shared/tenant/tenant-scope.js";

const log = createModuleLogger("target-switch");

/**
 * POST /api/servers/local/switch — EXPLICIT return to the CONNECTED (local)
 * server. The remote target lives in a per-tab `X-Bridge-Session-Id` header
 * (target-switch) AND may live in the session cookie itself (hosting/legacy
 * sessions carry `targetId`+`direct` in the JWT). Clearing the header on the
 * client alone can NOT escape the latter — the cookie is httpOnly, JS can't
 * strip it — so a session pinned in the JWT stays fail-closed on the (possibly
 * dead) remote and can't reach Settings. This action:
 *   1. Tears down the per-tab override bridge (dispose executor + purge cached
 *      SSH material from Redis) so the remote connection isn't abandoned.
 *   2. Re-signs the session cookie WITHOUT any bridge/target claim, so the JWT
 *      itself no longer pins a remote target and the middleware resolves the
 *      LOCAL executor (standalone default).
 *   3. Returns `clearBridge:true` so the client drops its stored per-tab id.
 * This is an EXPLICIT user action — it never runs as an automatic fallback, so
 * a live DIRECT session to a remote target keeps its fail-closed isolation.
 */
async function switchToLocal(req: Request, res: Response): Promise<void> {
  const user = res.locals.user;
  // Hosting sessions are bound to a single tenant target by design (the tenant's
  // data lives on that server, the panel host is off-limits to the dropped
  // owner). "Return to local" is not applicable — reject rather than silently
  // strip the only bridge such a session has.
  if (isHostingSession(user)) {
    throw new ValidationError(apiModuleMessage(res.locals.locale, "serverHostingLocalDenied"));
  }

  // 1) Dispose the per-tab OVERRIDE bridge this tab is driving (the remote target
  //    it's stuck on), if any. Best-effort: a Redis hiccup must not block the
  //    return to local (the blob still expires by its TTL).
  const overrideBridgeId = readBridgeHeader(req.headers);
  if (overrideBridgeId) {
    await disposeDirectExecutor(overrideBridgeId).catch((err) => {
      log.warn({ err, bridge: `${overrideBridgeId.slice(0, 8)}…` }, "dispose override bridge failed (non-fatal)");
    });
  }

  // 2) Re-sign the cookie stripping every bridge/target claim (→ LOCAL) and
  //    revoke the previous token. Then dispose the cookie's OWN bridge if it
  //    carried one (a JWT-pinned remote session) and it isn't the override we
  //    already tore down above.
  const { oldPayload } = await resignSessionWithBridge(req, res, null);
  if (oldPayload?.bridgeSessionId && oldPayload.bridgeSessionId !== overrideBridgeId) {
    await disposeDirectExecutor(oldPayload.bridgeSessionId).catch((err) => {
      log.warn({ err }, "dispose cookie bridge failed (non-fatal)");
    });
  }

  log.info({ userId: user?.userId }, "Session returned to LOCAL target");
  res.json({
    ok: true,
    data: {
      local: true,
      targetId: LOCAL_TARGET_ID,
      targetName: apiModuleMessage(res.locals.locale, "serverLocalShort"),
      bridgeSessionId: "",
      clearBridge: true,
    },
  });
}

export const targetSwitchController = {
  /** POST /api/servers/local/switch — the LITERAL route (no `:id` param), so it
   *  must NOT read `req.params.id` (undefined → "undefined" → vault 404, which is
   *  exactly the bug that trapped users on a remote target). */
  switchLocal: asyncHandler(async (req: Request, res: Response) => {
    await switchToLocal(req, res);
  }),

  /** POST /api/servers/:id/switch — establish a direct bridge to a local target,
   *  or (id="local") return the session to the CONNECTED server. */
  switch: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);

    // id="local" (the synthetic entry served by GET /api/servers) is not a vault
    // target — it means "return to the connected server". Handle it explicitly
    // BEFORE the vault lookup (which would 404).
    if (id === LOCAL_TARGET_ID) {
      await switchToLocal(req, res);
      return;
    }

    // Hosting sessions are bound to a single tenant target by design — they may
    // not switch to another server. Reject before touching the vault (symmetric
    // to switchToLocal's guard).
    if (isHostingSession(res.locals.user)) {
      throw new ValidationError(apiModuleMessage(res.locals.locale, "serverHostingSwitchDenied"));
    }

    const userId = res.locals.user?.userId;

    const found = await runOnPanelHost(() => targetsRepository.getMaterial(id));
    if (!found) throw new AppError(apiModuleMessage(res.locals.locale, "serverNotFound"), 404, ErrorCodes.NOT_FOUND);
    const { target, material } = found;

    // Authorize FIRST — before touching state — so a non-owner probing an id
    // can't distinguish "not found" from "disabled"/"unapproved" (info leak),
    // and we don't act on a decrypted secret they may not use. Same visibility
    // rule as the list/agent channels: global targets honor the allowlist;
    // private targets are owner-only; admins may use anything. Match the 404
    // shape of the list/get paths so existence isn't revealed.
    if (!userMayUseTarget(target, viewerOf(res))) {
      throw new AppError(apiModuleMessage(res.locals.locale, "serverNotFound"), 404, ErrorCodes.NOT_FOUND);
    }

    if (target.enabled === false) {
      throw new ValidationError(apiModuleMessage(res.locals.locale, "serverTargetDisabled"));
    }
    // Require an approved host fingerprint before any traffic flows (TOFU).
    if (!target.hostFingerprint) {
      throw new ValidationError(
        apiModuleMessage(res.locals.locale, "serverFingerprintRequired"),
      );
    }

    // Re-screen the target host against the SSRF/host policy at connect time and
    // pin the resolved IP so DirectSshExecutor doesn't re-resolve DNS (rebinding
    // defense). The host-key fingerprint pin still fails closed on mismatch.
    const { pinnedAddress } = await assertSafeTargetHost(target.host);
    const ownedMaterial = {
      ...material,
      host: pinnedAddress ?? material.host,
      // Seal the owning panel user id so `resolveOverrideBridge` can validate
      // ownership fail-closed (a bare bridgeSessionId no longer authorizes the
      // executor for a different user).
      userId: typeof userId === "number" ? userId : undefined,
    };

    const bridgeSessionId = randomUUID();
    await sshCredentialsCache.put(bridgeSessionId, ownedMaterial, bridgeTtlSeconds());
    // Do NOT log the full bridgeSessionId: it is the single secret that authorizes
    // the per-tab bridge override. Log a short prefix for correlation only.
    log.info(
      { bridge: `${bridgeSessionId.slice(0, 8)}…`, targetId: id, host: target.host, userId },
      "Local target bridge established",
    );

    // Native clients keep the base bearer and send the resulting bridge on every context request.
    // The same ownership, host policy and fingerprint checks above apply to this path.
    if (req.body?.sessionMode === "context") {
      res.json({ ok: true, data: { bridgeSessionId, targetId: id, targetName: target.name, sessionMode: "context" } });
      return;
    }

    // Re-sign the session cookie so a request that arrives WITHOUT the per-tab
    // `X-Bridge-Session-Id` header still resolves to THIS target instead of
    // silently falling through to LOCAL (a cross-server isolation leak). The
    // response STILL returns bridgeSessionId in the body (the client seeds it in
    // sessionStorage as the per-tab override) — the cookie is the fail-safe.
    const overrideBridgeId = readBridgeHeader(req.headers);
    const { oldPayload } = await resignSessionWithBridge(req, res, {
      bridgeSessionId,
      targetId: id,
      targetName: target.name,
    });

    // Dispose the PREVIOUS bridge(s) so a remote→remote switch doesn't abandon the
    // prior SSH connection (both the per-tab header target and the cookie's own
    // bridge, deduped, if they differ from the freshly minted one). Best-effort.
    const previousBridges = new Set<string>();
    if (overrideBridgeId && overrideBridgeId !== bridgeSessionId) previousBridges.add(overrideBridgeId);
    if (oldPayload?.bridgeSessionId && oldPayload.bridgeSessionId !== bridgeSessionId) {
      previousBridges.add(oldPayload.bridgeSessionId);
    }
    for (const prev of previousBridges) {
      await disposeDirectExecutor(prev).catch((err) => {
        log.warn({ err }, "dispose previous bridge failed (non-fatal)");
      });
    }

    res.json({
      ok: true,
      data: { bridgeSessionId, targetId: id, targetName: target.name },
    });
  }),
};
