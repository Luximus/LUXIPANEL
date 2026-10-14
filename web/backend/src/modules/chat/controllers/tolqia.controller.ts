// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tolqia account link — HTTP surface.
 *
 * Follows the canonical "module token" contract that Ajustes → Credenciales
 * speaks (`GET/PUT/DELETE /config` returning `{tokenSet, tokenPreview}` plus
 * `POST /test`), so the generic card in
 * `frontend/src/scripts/extracted/pages/panel/settings/cred-token-cards.ts`
 * drives it with zero per-module code.
 *
 *   GET    /api/chat/tolqia/config  → {tokenSet, tokenPreview, account?, accountSummary?}
 *   PUT    /api/chat/tolqia/config  → save + validate a `tq_live_…` token
 *   DELETE /api/chat/tolqia/config  → unlink this server
 *   POST   /api/chat/tolqia/test    → {valid, plan, limits, message} (always 200)
 *   GET    /api/chat/tolqia/plan    → {configured, plan, limits, translationAvailable}
 *
 * The first four are ADMIN-ONLY (the token is a billing credential of the whole
 * server). `plan` is readable by every authenticated user: the messenger badges
 * the plan and warns when translation is unavailable, and it carries no token,
 * no preview and no account-holder name.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler, type SessionUser } from "../../../shared/types/index.js";
import { getExecutor, type Executor } from "../../../shared/executor/index.js";
import { AppError, ErrorCodes, ValidationError } from "../../../shared/errors/index.js";
import { apiErrorMessage, apiLocaleFromRequest } from "../../../shared/i18n/errors.js";
import { zodIssues } from "../../../shared/validators/index.js";
import { tolqiaAccountService } from "../services/tolqia-account.service.js";
import { localizeTolqiaMessage } from "../services/tolqia-i18n.js";

const putSchema = z.object({ token: z.string().trim().min(1).max(256) }).strict();
const testSchema = z.object({ token: z.string().trim().max(256).optional() }).strict();

function requireExecutor(req: Request): Executor {
  const executor = getExecutor(req);
  if (!executor) throw new AppError(apiErrorMessage(apiLocaleFromRequest(req), "noExecutor"), 404, ErrorCodes.NOT_FOUND);
  return executor;
}

export const tolqiaController = {
  /** GET /api/chat/tolqia/config */
  getConfig: asyncHandler(async (req: Request, res: Response) => {
    const data = await tolqiaAccountService.getConfig(requireExecutor(req), res.locals.locale);
    res.json({ ok: true, data });
  }),

  /** PUT /api/chat/tolqia/config — 400 when the format or the probe fails. */
  setConfig: asyncHandler(async (req: Request, res: Response) => {
    const parsed = putSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    }
    const user = res.locals.user as SessionUser | undefined;
    let data;
    try {
      data = await tolqiaAccountService.setToken(
        requireExecutor(req),
        parsed.data.token,
        user?.username,
        res.locals.locale,
      );
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error;
      throw new ValidationError(localizeTolqiaMessage(res.locals.locale, error.message),
        error.details.map((issue) => ({ ...issue, message: localizeTolqiaMessage(res.locals.locale, issue.message) })));
    }
    res.json({ ok: true, data });
  }),

  /** DELETE /api/chat/tolqia/config */
  clearConfig: asyncHandler(async (req: Request, res: Response) => {
    const data = await tolqiaAccountService.clearToken(requireExecutor(req));
    res.json({ ok: true, data });
  }),

  /**
   * POST /api/chat/tolqia/test — ALWAYS 200: a bad token or an unreachable
   * Tolqia is `valid:false` with a human message, never a 5xx (the card only
   * shows a toast).
   */
  test: asyncHandler(async (req: Request, res: Response) => {
    const parsed = testSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    }
    const data = await tolqiaAccountService.test(requireExecutor(req), parsed.data.token, res.locals.locale);
    res.json({ ok: true, data });
  }),

  /** GET /api/chat/tolqia/plan — every authenticated user. */
  plan: asyncHandler(async (req: Request, res: Response) => {
    const data = await tolqiaAccountService.plan(requireExecutor(req));
    res.json({ ok: true, data });
  }),
};
