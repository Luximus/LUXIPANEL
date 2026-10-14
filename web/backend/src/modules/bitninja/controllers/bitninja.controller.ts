// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * BitNinja controller — REST endpoints for the /panel/bitninja view.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { bitninjaService } from "../services/index.js";
import { bitninjaConfigService } from "../services/bitninja-config.service.js";
import { ValidationError } from "../../../shared/errors/index.js";

const LICENSE_RE = /^[A-Za-z0-9_-]+$/;

// licenseKey is OPTIONAL on install/update: if omitted, the stored key from
// Settings → Credentials is used. When provided, it is persisted there too.
const licenseSchema = z.object({
  licenseKey: z.string().trim().max(128).optional(),
});

const configSchema = z.object({
  licenseKey: z
    .string()
    .trim()
    .min(1, "Clave de licencia requerida")
    .max(128)
    .regex(LICENSE_RE, "Clave de licencia inválida"),
});

/** Resolve the license key from the request body, else the stored one. */
async function resolveLicenseKey(req: Request, executor: Parameters<typeof bitninjaConfigService.saveKey>[1]): Promise<string> {
  const fromBody = (licenseSchema.parse(req.body).licenseKey ?? "").trim();
  if (fromBody) {
    if (!LICENSE_RE.test(fromBody)) throw new ValidationError("Clave de licencia inválida");
    return fromBody;
  }
  const stored = await bitninjaConfigService.getKey(executor);
  if (!stored) throw new ValidationError("Clave de licencia requerida (configúrala en Ajustes → Credenciales)");
  return stored;
}

const serviceSchema = z.object({
  action: z.enum(["start", "stop", "restart"]),
});

const componentSchema = z.object({
  component: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, "Componente inválido"),
  enabled: z.boolean(),
});

function sudoPasswordOf(req: Request): string | undefined {
  return typeof req.body?.sudoPassword === "string" ? req.body.sudoPassword : undefined;
}

export const bitninjaController = {
  /** GET /api/bitninja/status */
  getStatus: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const data = await bitninjaService.getStatus(executor);
    res.json({ ok: true, data });
  }),

  getLogs: asyncHandler(async (req: Request, res: Response) => {
    const lines = z.coerce.number().int().min(20).max(200).default(50).parse(req.query.lines);
    const output = await bitninjaService.getRecentLogs(getExecutor(req), lines);
    res.json({ ok: true, data: { output } });
  }),

  /** GET /api/bitninja/config — masked license key status (for Credentials). */
  getConfig: asyncHandler(async (req: Request, res: Response) => {
    const data = await bitninjaConfigService.getConfig(getExecutor(req));
    res.json({ ok: true, data });
  }),

  /** PUT /api/bitninja/config — store the BitNinja license key. */
  saveConfig: asyncHandler(async (req: Request, res: Response) => {
    const { licenseKey } = configSchema.parse(req.body);
    const executor = getExecutor(req);
    await bitninjaConfigService.saveKey(licenseKey, executor);
    const data = await bitninjaConfigService.getConfig(executor);
    res.json({ ok: true, data });
  }),

  /** DELETE /api/bitninja/config — clear the stored license key. */
  clearConfig: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    await bitninjaConfigService.clearKey(executor);
    res.json({ ok: true });
  }),

  /** POST /api/bitninja/packages — install with the client's license key. */
  install: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const licenseKey = await resolveLicenseKey(req, executor);
    const data = await bitninjaService.install(executor, { licenseKey, sudoPassword: sudoPasswordOf(req) });
    if (data.ok && req.body?.licenseKey) await bitninjaConfigService.saveKey(licenseKey, executor);
    res.json({ ok: data.ok, code: data.code, data });
  }),

  /** POST /api/bitninja/license — set/update license on an installed agent. */
  setLicense: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const licenseKey = await resolveLicenseKey(req, executor);
    const data = await bitninjaService.setLicense(executor, { licenseKey, sudoPassword: sudoPasswordOf(req) });
    if (data.ok && req.body?.licenseKey) await bitninjaConfigService.saveKey(licenseKey, executor);
    res.json({ ok: data.ok, code: data.code, data });
  }),

  /** POST /api/bitninja/service — start/stop/restart the agent. */
  setService: asyncHandler(async (req: Request, res: Response) => {
    const { action } = serviceSchema.parse(req.body);
    const executor = getExecutor(req);
    const data = await bitninjaService.setService(executor, action, { sudoPassword: sudoPasswordOf(req) });
    res.json({ ok: data.ok, code: data.code, data });
  }),

  /** POST /api/bitninja/components — enable/disable a component. */
  setComponent: asyncHandler(async (req: Request, res: Response) => {
    const { component, enabled } = componentSchema.parse(req.body);
    const executor = getExecutor(req);
    const data = await bitninjaService.setComponent(executor, component, enabled, { sudoPassword: sudoPasswordOf(req) });
    res.json({ ok: data.ok, code: data.code, data });
  }),
};
