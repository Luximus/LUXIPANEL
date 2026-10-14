// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Sudo credential controller — manages the per-target stored sudo password
 * that other modules use for privileged operations (install, freshclam,
 * systemctl toggles, etc.).
 *
 * The plaintext password is never returned to the client. Only `{ stored }`.
 */

import type { Request, Response } from "express";
import { z } from "zod";

import { asyncHandler } from "../../../shared/types/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import {
  hasStoredSudoPassword,
  storeSudoPassword,
  clearSudoPassword,
  sudoShell,
  invalidateSudoPasswordCache,
  SUDO_PASSWORD_INVALID,
} from "../../../shared/system/index.js";

const setBodySchema = z.object({
  password: z.string().min(1).max(512),
});

export const sudoController = {
  /** GET /api/sudo/status */
  status: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const stored = await hasStoredSudoPassword(executor);
    res.json({ ok: true, data: { stored } });
  }),

  /**
   * POST /api/sudo/credential
   *
   * Validates the password by running a real `sudo -nv`-equivalent
   * (`sudo … true`) and only stores it on success.
   */
  set: asyncHandler(async (req: Request, res: Response) => {
    const body = setBodySchema.parse(req.body);
    const executor = getExecutor(req);

    // Validate by running a no-op privileged command. `sudo -S true`
    // prompts for the password, reads it from stdin, runs `true` (exit 0),
    // and exits. `buildSudoPrefix` already wires the base64 + stdin pipe.
    const probe = await sudoShell(
      executor,
      (sudo) => `${sudo} true`,
      { sudoPassword: body.password },
    );

    if (!probe.ok) {
      // sudoShell already classifies the failure. Surface the right code.
      if (probe.code === SUDO_PASSWORD_INVALID) {
        throw new ValidationError("Contraseña sudo inválida.");
      }
      throw new ValidationError(probe.output || "No se pudo validar la contraseña sudo.");
    }

    // sudoShell stored the password as a side effect of success, but call
    // explicitly to make intent obvious for future readers.
    await storeSudoPassword(executor, body.password);
    invalidateSudoPasswordCache(executor.target.id);
    res.json({ ok: true, data: { stored: true } });
  }),

  /** DELETE /api/sudo/credential */
  clear: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    await clearSudoPassword(executor);
    invalidateSudoPasswordCache(executor.target.id);
    res.json({ ok: true });
  }),
};
