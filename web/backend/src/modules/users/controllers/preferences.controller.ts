// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Preferences controller — lets authenticated users manage their own profile settings.
 *
 * Editable fields: displayName, phoneE164, password (requires current), and UI preferences.
 * Admin-controlled fields (role, modules, enabled) are NOT editable here.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { parsePageQuery } from "../../../shared/http/pagination.js";
import { usersService } from "../services/users.service.js";
import {
  chatPreferencesSchema,
  toChatPreferences,
  toUiPreferences,
  type ChatPreferences,
  type ChatPreferencesPatch,
  type UserPreferencesData,
} from "../models/preferences.model.js";
import { AuthError, NotFoundError } from "../../../shared/errors/index.js";
import { displayNameSchema } from "../../../shared/validators/index.js";
import { panelUserRepository } from "../../auth/repositories/panel-user.repository.js";
import { auditRepository } from "../../auth/repositories/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("preferences-ctrl");

const updateProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  phoneE164: z
    .string()
    .regex(/^\+\d{7,15}$/, "Must be E.164 format (e.g. +34612345678)")
    .nullable()
    .optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

/**
 * UI-only preferences patch for GET/PUT /api/preferences/ui (the theme/
 * language contract shared with the frontend). `language` is a short i18n
 * code (e.g. "es", "en", "en-US"), not restricted to the two-language enum
 * above so new locales work without a backend change.
 */
const uiPreferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  language: z
    .string()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, "Must be an i18n code like 'es' or 'en-US'")
    .optional(),
});

export const preferencesController = {
  /** GET /api/preferences — return current user's editable profile + preferences. */
  get: asyncHandler(async (_req: Request, res: Response) => {
    const { userId } = res.locals.user;
    const user = await panelUserRepository.findById(userId);
    if (!user) throw new NotFoundError("User");

    const prefs = await usersService.getPreferences(userId);

    res.json({
      ok: true,
      data: {
        username: user.username,
        displayName: user.displayName,
        phoneE164: user.phoneE164,
        createdAt: user.createdAt,
        preferences: prefs,
      },
    });
  }),

  /** PUT /api/preferences — update displayName and/or phoneE164. */
  update: asyncHandler(async (req: Request, res: Response) => {
    const { userId } = res.locals.user;
    const body = updateProfileSchema.parse(req.body);

    const updates: Record<string, unknown> = {};
    if (body.displayName !== undefined) updates["displayName"] = body.displayName;
    if (body.phoneE164 !== undefined) updates["phoneE164"] = body.phoneE164;

    if (Object.keys(updates).length > 0) {
      await usersService.update(userId, updates);
      log.info({ userId }, "User profile updated");
    }

    res.json({ ok: true });
  }),

  /** PUT /api/preferences/password — change own password (requires current password). */
  changePassword: asyncHandler(async (req: Request, res: Response) => {
    const { userId } = res.locals.user;
    const body = changePasswordSchema.parse(req.body);

    try {
      await usersService.changeOwnPassword(userId, body.currentPassword, body.newPassword);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "Current password is incorrect") {
        throw new AuthError("Current password is incorrect");
      }
      throw err;
    }

    res.json({ ok: true });
  }),

  /**
   * GET /api/preferences/ui — current user's theme + language.
   * Contract shape (bare object): { theme, language }. Defaults when no
   * sidecar yet: theme "system", language null.
   */
  getUiPreferences: asyncHandler(async (_req: Request, res: Response) => {
    const { userId } = res.locals.user;
    // El store guarda un blob de preferencias; el contrato de `/ui` es solo
    // { theme, language } con sus defaults. `toUiPreferences` hace esa proyección.
    const ui = toUiPreferences(await usersService.getPreferences(userId));
    res.json(ui);
  }),

  /**
   * PUT /api/preferences/ui — partial update of theme and/or language.
   * Validates with Zod and responds the full resulting { theme, language }.
   */
  updateUiPreferences: asyncHandler(async (req: Request, res: Response) => {
    const { userId } = res.locals.user;
    const patch = uiPreferencesSchema.parse(req.body);

    const ui = toUiPreferences(await usersService.updatePreferences(userId, patch));
    res.json(ui);
  }),

  /**
   * GET /api/preferences/chat — the COMPLETE messaging settings for the current
   * user (defaults deep-merged with whatever is stored). Contract:
   * `{ ok: true, data: ChatPreferences }`.
   */
  getChatPreferences: asyncHandler(async (_req: Request, res: Response) => {
    const { userId } = res.locals.user;
    const data = toChatPreferences(await usersService.getPreferences(userId));
    res.json({ ok: true, data });
  }),

  /**
   * PUT /api/preferences/chat — partial update, merged PER SECTION.
   *
   * The client may send just `{ general: { enterSends: false } }`: we merge it
   * onto what is stored (not onto the defaults) so the other sections — and the
   * other keys of the same section — survive untouched. Responds the full
   * resulting object, same shape as GET.
   */
  updateChatPreferences: asyncHandler(async (req: Request, res: Response) => {
    const { userId } = res.locals.user;
    const patch: ChatPreferencesPatch = chatPreferencesSchema.parse(req.body);

    const current = await usersService.getPreferences(userId);
    const stored = (current?.chat ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...stored };
    for (const [section, values] of Object.entries(patch)) {
      if (!values || typeof values !== "object") continue;
      const prev = stored[section];
      const base = prev && typeof prev === "object" && !Array.isArray(prev) ? prev : {};
      merged[section] = { ...(base as object), ...(values as object) };
    }

    const next = await usersService.updatePreferences(userId, {
      chat: merged as unknown as ChatPreferences,
    } as UserPreferencesData);
    res.json({ ok: true, data: toChatPreferences(next ?? { chat: merged }) });
  }),

  /** GET /api/preferences/audit-log — recent audit log entries for the current user. */
  auditLog: asyncHandler(async (req: Request, res: Response) => {
    const { limit } = parsePageQuery(req.query, { defaultLimit: 50, maxLimit: 200 });
    const entries = await auditRepository.findRecentForUser(res.locals.user.userId, limit);
    res.json({ ok: true, data: entries });
  }),
};
