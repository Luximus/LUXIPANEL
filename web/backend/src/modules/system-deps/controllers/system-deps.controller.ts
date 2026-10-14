// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * System-deps controller — generic per-module dependency status + install.
 * Mirrors firewall's status.controller.ts install handling: always responds
 * 200 with `{ ok, code, data }` and surfaces SUDO_PASSWORD_* + the combined
 * log INSIDE `data` so the shared install-modal/`withSudo` helper (which
 * reads `data.code` / `data.output`) can drive the prompt and the live log.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { ErrorCodes } from "../../../shared/errors/codes.js";
import {
  checkModuleDependencies,
  installModuleDependencies,
} from "../../../shared/system/module-deps.js";

/** Express 5 types route params as `string | string[]` on generic handlers. */
export function moduleParam(req: Request): string {
  const raw = (req.params as Record<string, string | string[] | undefined>)["module"];
  return typeof raw === "string" ? raw : "";
}

const installSchema = z.object({
  keys: z.array(z.string().min(1).max(64).regex(/^[A-Za-z0-9_.-]+$/)).optional(),
  sudoPassword: z.string().min(1).max(512).optional(),
});

export const systemDepsController = {
  /** GET /api/system-deps/:module — install state of every declared dependency. */
  status: asyncHandler(async (req: Request, res: Response) => {
    const moduleId = moduleParam(req);
    const executor = getExecutor(req);
    const data = await checkModuleDependencies(executor, moduleId);
    if (!data) {
      res.status(404).json({ ok: false, error: ErrorCodes.UNKNOWN_MODULE });
      return;
    }
    res.json({ ok: true, data });
  }),

  /** POST /api/system-deps/:module/install — install missing dependencies. */
  install: asyncHandler(async (req: Request, res: Response) => {
    const moduleId = moduleParam(req);
    const { keys, sudoPassword } = installSchema.parse(req.body ?? {});
    const executor = getExecutor(req);

    const result = await installModuleDependencies(executor, moduleId, keys, {
      ...(sudoPassword !== undefined ? { sudoPassword } : {}),
    });
    if (!result) {
      res.status(404).json({ ok: false, error: ErrorCodes.UNKNOWN_MODULE });
      return;
    }

    res.json({
      ok: result.ok,
      code: result.code,
      data: { results: result.results, output: result.output, code: result.code },
    });
  }),
};
