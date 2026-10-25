// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { assistantAdmissionSchema } from "../models/assistant-admission.model.js";
import { assistantAdmissionRepository } from "../repositories/assistant-admission.repository.js";

export const assistantAdmissionController = {
  get: asyncHandler(async (req: Request, res: Response) => {
    const config = await assistantAdmissionRepository.load(getExecutor(req));
    res.json({ ok: true, data: { config } });
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    const config = assistantAdmissionSchema.parse(req.body);
    await assistantAdmissionRepository.save(getExecutor(req), config);
    res.json({ ok: true, data: { config } });
  }),
};
