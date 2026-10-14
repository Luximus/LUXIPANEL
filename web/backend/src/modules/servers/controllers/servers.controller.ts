// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Servers controller — CRUD + TOFU test/approve for the local SSH target vault.
 * Any authenticated control-plane user may manage their OWN (private) targets;
 * admins manage the shared (global) registry. Per-record authorization lives in
 * the service (see `userMayUseTarget`/`assertMayManage`). Never returns secrets.
 */

import os from "node:os";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { serversService, type TargetViewer } from "../services/servers.service.js";
import { createTargetSchema, updateTargetSchema, type TargetView } from "../models/index.js";
import { LOCAL_TARGET_ID } from "../../../shared/executor/local-executor.js";
import { ErrorCodes } from "../../../shared/errors/index.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";

/** A listed target with the two presentation flags the selector needs:
 *  `isLocal` (the synthetic connected/origin server) and `active` (the target
 *  the CURRENT request is resolving against). Additive to {@link TargetView}. */
type ListedTarget = TargetView & { isLocal: boolean; active: boolean };

/** Build the authorization identity from the pinned session user. */
export function viewerOf(res: Response): TargetViewer {
  const u = res.locals.user;
  return {
    userId: typeof u?.userId === "number" ? u.userId : null,
    isAdmin: u?.kind === "admin",
  };
}

/**
 * Synthetic entry for the panel's OWN (connected/origin) server, so the server
 * selector can ALWAYS offer a way back to local. This is NOT a vault record and
 * carries no secret: switching to it means the tab drops its per-tab
 * `X-Bridge-Session-Id` header and the session falls back to its local bridge
 * (see session.middleware default). Instance-level and visible to every
 * authenticated user. `POST /api/servers/local/*` (switch/test/update/delete)
 * intentionally 404s — there is no vault material for it and it must never be
 * mutated as if it were a real target.
 */
function localConnectedTarget(locale: unknown): TargetView {
  const host = os.hostname() || "localhost";
  return {
    id: LOCAL_TARGET_ID,
    name: apiModuleMessage(locale, "serverLocalName").replace("{host}", () => host),
    host,
    port: 0,
    username: "",
    authType: "key",
    hasPassphrase: false,
    hostFingerprint: null,
    hostFingerprintPending: null,
    enabled: true,
    lastStatus: "ok",
    lastError: null,
    lastSeenAt: null,
    allowedUserIds: [],
    ownerId: null,
    visibility: "global",
    hasLuxipanel: false,
    luxipanelBaseUrl: null,
    hasPeerCredential: false,
  };
}

export const serversController = {
  /**
   * GET /api/servers — list targets the caller may see (no secrets).
   *
   * ALWAYS prepends the synthetic local/connected server so the selector can
   * offer a path back to the origin box, and marks the `active` target (the one
   * the current request resolves against, i.e. `res.locals.user.targetId` after
   * session.middleware reflected any per-tab override). Without the local entry
   * a session that switched to a remote target had no way back and stayed pinned
   * to it (Settings et al. kept resolving against the remote box).
   */
  list: asyncHandler(async (_req: Request, res: Response) => {
    const targets = await serversService.list(viewerOf(res));
    const activeId = res.locals.user?.targetId ?? LOCAL_TARGET_ID;
    const data: ListedTarget[] = [localConnectedTarget(res.locals.locale), ...targets].map((t) => ({
      ...t,
      isLocal: t.id === LOCAL_TARGET_ID,
      active: t.id === activeId,
    }));
    res.json({ ok: true, data });
  }),

  /** POST /api/servers — register a target (runs the SSRF host policy). */
  create: asyncHandler(async (req: Request, res: Response) => {
    const body = createTargetSchema.parse(req.body);
    const data = await serversService.create(body, viewerOf(res));
    res.status(201).json({ ok: true, data });
  }),

  /** PUT /api/servers/:id — update a target. */
  update: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const body = updateTargetSchema.parse(req.body);
    const data = await serversService.update(id, body, viewerOf(res));
    res.json({ ok: true, data });
  }),

  /** DELETE /api/servers/:id — remove a target. */
  remove: asyncHandler(async (req: Request, res: Response) => {
    await serversService.remove(String(req.params.id), viewerOf(res));
    res.json({ ok: true });
  }),

  /**
   * POST /api/servers/:id/test — first-contact / connectivity probe.
   * First contact (or a changed host key) answers 409
   * HOST_FINGERPRINT_PENDING_APPROVAL with the captured fingerprint.
   */
  test: asyncHandler(async (req: Request, res: Response) => {
    const result = await serversService.test(String(req.params.id), viewerOf(res));
    if (result.outcome === "pending") {
      res.status(409).json({
        ok: false,
        code: ErrorCodes.HOST_FINGERPRINT_PENDING_APPROVAL,
        error: result.changed
          ? "La clave del host cambió — aprueba el nuevo fingerprint para continuar."
          : "Primer contacto — aprueba el fingerprint del host para continuar.",
        data: { fingerprint: result.fingerprint, changed: result.changed, target: result.target },
      });
      return;
    }
    if (result.outcome === "error") {
      res.status(502).json({
        ok: false,
        code: ErrorCodes.SSH_CONNECT_FAILED,
        error: result.error,
        data: { target: result.target },
      });
      return;
    }
    res.json({ ok: true, data: { fingerprint: result.fingerprint, target: result.target } });
  }),

  /** POST /api/servers/:id/fingerprint/approve — pin the pending fingerprint. */
  approveFingerprint: asyncHandler(async (req: Request, res: Response) => {
    const data = await serversService.approveFingerprint(String(req.params.id), viewerOf(res));
    res.json({ ok: true, data });
  }),
};
