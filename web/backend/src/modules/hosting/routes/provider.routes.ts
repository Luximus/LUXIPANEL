// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type RequestHandler, type Response } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { asyncHandler } from "../../../shared/types/index.js";
import { optionalAuth } from "../../auth/index.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireAdminOrApiKey } from "../middlewares/tenant-scope.middleware.js";
import { providerService } from "../services/provider.service.js";
import { PROVIDER_OPERATIONS, type HostingProvider } from "../models/provider.model.js";
import { DEFAULT_HOSTING_DEFAULTS } from "../repositories/hosting-defaults.repository.js";
import { validModuleSlugs } from "../../users/services/roles.service.js";
import { AuthError, ValidationError } from "../../../shared/errors/index.js";
import { providerGroupTemplateSchema, providerPermissionCatalog } from "../services/provider-group-policy.js";
import { emailSchema } from "../../../shared/validators/index.js";

import { expoProviderService, snapshotSchema, jobSchema } from "../services/expo-provider.service.js";

export const providerRouter = Router();

const ref = z.string().regex(/^[A-Za-z0-9_.:-]{1,128}$/);
const panelUrl = z.string().url().transform((raw) => {
  const u = new URL(raw);
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash || u.pathname !== "/") throw new ValidationError("La URL del panel debe ser un origen HTTPS");
  return u.origin;
});
const upstreamUrl = z.string().regex(/^http:\/\/(?:127\.0\.0\.1|\[::1\]):(?:[1-9]\d{0,4})$/, "Usa un puerto HTTP loopback fijo").refine((v) => Number(new URL(v).port) <= 65535);
const createProvider = z.object({
  name: z.string().trim().min(2).max(120),
  targetId: z.string().min(1),
  panelUrl,
  upstreamUrl,
  operations: z.array(z.enum(PROVIDER_OPERATIONS)).default(PROVIDER_OPERATIONS.filter((op) => op !== "accounts.delete" && !op.startsWith("expo."))),
  allowedModules: z.array(z.string()).max(100).default(["files", "mail", "dns", "backups", "cron"]),
  templateId: z.string().uuid().nullable().optional(),
  groupTemplate: providerGroupTemplateSchema.nullable().optional(),
  plan: z.enum(["basic", "pro", "business", "custom"]).default(DEFAULT_HOSTING_DEFAULTS.plan),
  diskQuotaMb: z.number().int().min(256).max(10_000_000).default(DEFAULT_HOSTING_DEFAULTS.diskQuotaMb),
  bandwidthQuotaMb: z.number().int().min(1024).max(100_000_000).default(DEFAULT_HOSTING_DEFAULTS.bandwidthQuotaMb),
  maxDomains: z.number().int().min(1).max(100_000).default(DEFAULT_HOSTING_DEFAULTS.maxDomains),
  maxEmailAccounts: z.number().int().min(0).max(100_000).default(DEFAULT_HOSTING_DEFAULTS.maxEmailAccounts),
  maxDatabases: z.number().int().min(0).max(100_000).default(DEFAULT_HOSTING_DEFAULTS.maxDatabases),
  maxSubUsers: z.number().int().min(0).max(100_000).default(DEFAULT_HOSTING_DEFAULTS.maxSubUsers),
  jailEnabled: z.boolean().default(false),
  enabled: z.boolean().default(true),
});
const updateProvider = createProvider.omit({ targetId: true }).partial();
const accountInput = z.object({ displayName: z.string().trim().min(1).max(128).optional(), email: emailSchema.optional() });
const accountPatch = accountInput.extend({ status: z.enum(["active", "suspended"]).optional() });
const siteInput = z.object({ domain: z.string().min(1).max(253) });

function validateModules(modules: string[]): void {
  const known = new Set(validModuleSlugs());
  if (modules.some((m) => !known.has(m))) throw new ValidationError("La lista contiene un módulo desconocido");
}

// Administrative configuration lives in HOSTING. Browser session and CSRF are mandatory.
providerRouter.use("/api/hosting/providers", optionalAuth, requireAdminOrApiKey);
providerRouter.get("/api/hosting/providers/permission-catalog", asyncHandler(async (_req, res) => {
  res.json({ ok: true, data: providerPermissionCatalog() });
}));
providerRouter.get("/api/hosting/providers/templates", asyncHandler(async (req, res) => {
  res.json({ ok: true, data: await providerService.listTemplatesForTarget(z.string().min(1).parse(req.query.targetId)) });
}));
providerRouter.get("/api/hosting/providers", asyncHandler(async (_req, res) => {
  res.json({ ok: true, data: await providerService.listProviders() });
}));
providerRouter.post("/api/hosting/providers", csrfProtection, asyncHandler(async (req, res) => {
  const input = createProvider.parse(req.body);
  validateModules(input.allowedModules);
  const result = await providerService.createProvider(input as HostingProvider);
  res.set("cache-control", "no-store");
  res.status(201).json({ ok: true, data: result });
}));
providerRouter.patch("/api/hosting/providers/:id", csrfProtection, asyncHandler(async (req, res) => {
  const patch = updateProvider.parse(req.body);
  if (patch.allowedModules) validateModules(patch.allowedModules);
  const result = await providerService.updateProvider(String(req.params.id), patch);
  res.json({ ok: true, data: result });
}));
providerRouter.post("/api/hosting/providers/:id/rotate", csrfProtection, asyncHandler(async (req, res) => {
  res.set("cache-control", "no-store");
  res.json({ ok: true, data: await providerService.rotateKey(String(req.params.id)) });
}));

// Bearer-only API. Cookies never grant access to these routes.
const providerAuth: RequestHandler = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer lhp_")) throw new AuthError("Credencial de proveedor requerida");
  const provider = await providerService.authenticate(header.slice(7));
  (res.locals as unknown as { hostingProvider: HostingProvider }).hostingProvider = provider;
  next();
});
providerRouter.use("/api/hosting/v1", providerAuth);
const current = (res: Response) => (res.locals as unknown as { hostingProvider: HostingProvider }).hostingProvider;
const allowed = (res: Response, op: (typeof PROVIDER_OPERATIONS)[number]) => providerService.assertOperation(current(res), op);
providerRouter.get("/api/hosting/v1/capabilities", asyncHandler(async (_req, res) => {
  const p = current(res);
  res.json({ ok: true, data: { version: 1, executionMeteringVersion: 1, operations: p.operations, allowedModules: p.allowedModules, targetId: p.targetId } });
}));
providerRouter.put("/api/hosting/v1/accounts/:externalId", asyncHandler(async (req, res) => {
  allowed(res, "accounts.write");
  const externalId = ref.parse(req.params.externalId);
  const body = accountInput.parse(req.body);
  const data = await providerService.ensureAccount(current(res), externalId, body);
  res.json({ ok: true, data, requestId: randomUUID() });
}));
providerRouter.get("/api/hosting/v1/accounts/:externalId", asyncHandler(async (req, res) => {
  allowed(res, "accounts.read");
  res.json({ ok: true, data: await providerService.getAccount(current(res), ref.parse(req.params.externalId)) });
}));
providerRouter.patch("/api/hosting/v1/accounts/:externalId", asyncHandler(async (req, res) => {
  allowed(res, "accounts.status");
  res.json({ ok: true, data: await providerService.updateAccount(current(res), ref.parse(req.params.externalId), accountPatch.parse(req.body)) });
}));
providerRouter.delete("/api/hosting/v1/accounts/:externalId", asyncHandler(async (req, res) => {
  allowed(res, "accounts.delete");
  await providerService.terminateAccount(current(res), ref.parse(req.params.externalId));
  res.json({ ok: true });
}));
providerRouter.get("/api/hosting/v1/accounts/:externalId/usage", asyncHandler(async (req, res) => {
  allowed(res, "usage.read");
  res.json({ ok: true, data: await providerService.usage(current(res), ref.parse(req.params.externalId)) });
}));
providerRouter.put("/api/hosting/v1/accounts/:externalId/sites/:siteId", asyncHandler(async (req, res) => {
  allowed(res, "sites.write");
  const body = siteInput.parse(req.body);
  res.json({ ok: true, data: await providerService.bindSite(current(res), ref.parse(req.params.externalId), ref.parse(req.params.siteId), body.domain) });
}));
providerRouter.delete("/api/hosting/v1/accounts/:externalId/sites/:siteId", asyncHandler(async (req, res) => {
  allowed(res, "sites.write");
  await providerService.unbindSite(current(res), ref.parse(req.params.externalId), ref.parse(req.params.siteId));
  res.json({ ok: true });
}));
providerRouter.post("/api/hosting/v1/accounts/:externalId/access-ticket", asyncHandler(async (req, res) => {
  allowed(res, "access.issue");
  res.set("cache-control", "no-store");
  res.json({ ok: true, data: await providerService.issueHandoff(current(res), ref.parse(req.params.externalId)) });
}));

const expoBase = "/api/hosting/v1/accounts/:externalId/apps/:appId";
const expoRefs = (req: { params: Record<string, unknown> }) => [String(req.params.externalId), String(req.params.appId)] as const;
providerRouter.put(expoBase, asyncHandler(async (req,res) => { allowed(res,"expo.write");res.json({ok:true,data:await expoProviderService.register(current(res),...expoRefs(req))}); }));
providerRouter.get(expoBase, asyncHandler(async (req,res) => { allowed(res,"expo.read");res.json({ok:true,data:await expoProviderService.status(current(res),...expoRefs(req))}); }));
providerRouter.put(expoBase+"/versions/:versionId", asyncHandler(async(req,res)=>{allowed(res,"expo.write");res.json({ok:true,data:await expoProviderService.snapshot(current(res),...expoRefs(req),String(req.params.versionId),snapshotSchema.parse(req.body))});}));
providerRouter.put(expoBase+"/connections/:store", asyncHandler(async(req,res)=>{allowed(res,"expo.write");const store=z.enum(["google","apple"]).parse(req.params.store);res.set("cache-control","no-store");res.json({ok:true,data:await expoProviderService.credentials(current(res),...expoRefs(req),store,z.object({config:z.record(z.string(),z.unknown())}).parse(req.body).config)});}));
providerRouter.post(expoBase+"/jobs", asyncHandler(async(req,res)=>{const body=jobSchema.parse(req.body);allowed(res,body.kind==="build"?"expo.build":body.kind==="submit"?"expo.submit":"expo.write");res.status(202).json({ok:true,data:await expoProviderService.enqueue(current(res),...expoRefs(req),body)});}));
providerRouter.get(expoBase+"/jobs/:jobId", asyncHandler(async(req,res)=>{allowed(res,"expo.read");res.json({ok:true,data:await expoProviderService.job(current(res),...expoRefs(req),String(req.params.jobId))});}));
providerRouter.get(expoBase+"/jobs/:jobId/preview", asyncHandler(async(req,res)=>{allowed(res,"expo.read");res.json({ok:true,data:await expoProviderService.job(current(res),...expoRefs(req),String(req.params.jobId),true)});}));
providerRouter.get(expoBase+"/builds/:buildId", asyncHandler(async(req,res)=>{allowed(res,"expo.read");res.json({ok:true,data:await expoProviderService.buildStatus(current(res),...expoRefs(req),String(req.params.buildId))});}));

providerRouter.post(expoBase+"/jobs/:jobId/cancel", asyncHandler(async(req,res)=>{allowed(res,"expo.write");res.status(202).json({ok:true,data:await expoProviderService.cancelValidation(current(res),...expoRefs(req),String(req.params.jobId))});}));
