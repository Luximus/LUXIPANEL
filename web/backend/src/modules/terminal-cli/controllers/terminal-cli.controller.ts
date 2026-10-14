// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { Request, Response } from "express";
import { z } from "zod";
import { ValidationError } from "../../../shared/errors/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { terminalCliService } from "../services/terminal-cli.service.js";

const setInstalledSchema = z.object({
  cliId: z.string().trim().min(1),
  installed: z.boolean(),
});

const setActiveSchema = z.object({
  cliId: z.string().trim().min(1),
});

const completeOnboardingSchema = z.object({
  installed: z.array(z.string().trim().min(1)).default([]),
  active: z.string().trim().min(1),
});

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      `${label} validation failed`,
      result.error.issues.map((issue) => ({
        field: issue.path.join(".") || label.toLowerCase(),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

export const terminalCliController = {
  async getState(req: Request, res: Response) {
    const executor = getExecutor(req);
    const data = await terminalCliService.getState(executor);
    res.json({ ok: true, data });
  },

  async probe(req: Request, res: Response) {
    const executor = getExecutor(req);
    const data = await terminalCliService.probeInstalled(executor);
    res.json({ ok: true, data });
  },

  async setInstalled(req: Request, res: Response) {
    const body = parseOrThrow(setInstalledSchema, req.body, "Installed");
    const executor = getExecutor(req);
    const data = await terminalCliService.setInstalled(body.cliId, body.installed, executor);
    res.json({ ok: true, data });
  },

  async setActive(req: Request, res: Response) {
    const body = parseOrThrow(setActiveSchema, req.body, "Active");
    const executor = getExecutor(req);
    const data = await terminalCliService.setActive(body.cliId, executor);
    res.json({ ok: true, data });
  },

  async completeOnboarding(req: Request, res: Response) {
    const body = parseOrThrow(completeOnboardingSchema, req.body, "Onboarding");
    const executor = getExecutor(req);
    const data = await terminalCliService.completeOnboarding(body.installed ?? [], body.active, executor);
    res.json({ ok: true, data });
  },

  async skipOnboarding(req: Request, res: Response) {
    const executor = getExecutor(req);
    const data = await terminalCliService.skipOnboarding(executor);
    res.json({ ok: true, data });
  },
};
