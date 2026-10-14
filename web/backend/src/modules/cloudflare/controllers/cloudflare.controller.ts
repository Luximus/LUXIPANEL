/**
 * Cloudflare controller — REST endpoints for the /panel/cloudflare view.
 *
 * The executor is only resolved where the connected server matters (the
 * public-IP probe and the DNS listing's pointsToServer annotation). Token
 * storage resolves its own per-request executor through the settings
 * repository context (ALS), like every other settings consumer.
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import {
  accessRuleParamsSchema,
  accessRuleSchema,
  dnsCreateSchema,
  dnsRecordParamsSchema,
  dnsUpdateSchema,
  purgeSchema,
  saveConfigSchema,
  setSettingSchema,
  zoneIdParamSchema,
} from "../models/index.js";
import { cloudflareConfigService } from "../services/cloudflare-config.service.js";
import { localizeCloudflareTokenMessage } from "../../../shared/i18n/module-messages.js";
import { cloudflareService } from "../services/cloudflare.service.js";

export const cloudflareController = {
  /** GET /api/cloudflare/config — token presence + masked preview only. */
  getConfig: asyncHandler(async (_req: Request, res: Response) => {
    const config = await cloudflareConfigService.getConfig();
    res.json({ ok: true, data: config });
  }),

  /** PUT /api/cloudflare/config — store the API token. */
  saveConfig: asyncHandler(async (req: Request, res: Response) => {
    const { apiToken } = saveConfigSchema.parse(req.body);
    await cloudflareConfigService.saveToken(apiToken);
    const config = await cloudflareConfigService.getConfig();
    res.json({ ok: true, data: config });
  }),

  /** DELETE /api/cloudflare/config — remove the stored token. */
  clearConfig: asyncHandler(async (req: Request, res: Response) => {
    await cloudflareConfigService.clearToken(getExecutor(req));
    res.json({ ok: true });
  }),

  /** POST /api/cloudflare/test — verify the stored token against CF.
   *  Always ok:true — validity travels in data.valid/data.message so the
   *  frontend can surface the diagnostic (ok:false would be masked as a
   *  generic error by api-client). */
  testConnection: asyncHandler(async (_req: Request, res: Response) => {
    const result = await cloudflareService.testToken();
    res.json({ ok: true, data: { ...result, message: localizeCloudflareTokenMessage(res.locals.locale, result.message) } });
  }),

  /** GET /api/cloudflare/server-ip — public IP of the CONNECTED server. */
  serverIp: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const ip = await cloudflareService.getServerPublicIp(executor);
    res.json({ ok: true, data: { ip } });
  }),

  /** GET /api/cloudflare/zones */
  listZones: asyncHandler(async (_req: Request, res: Response) => {
    const zones = await cloudflareService.listZones();
    res.json({ ok: true, data: zones });
  }),

  /** GET /api/cloudflare/zones/:zoneId/settings */
  getZoneSettings: asyncHandler(async (req: Request, res: Response) => {
    const { zoneId } = zoneIdParamSchema.parse(req.params);
    const settings = await cloudflareService.getZoneSettings(zoneId);
    res.json({ ok: true, data: settings });
  }),

  /** PATCH /api/cloudflare/zones/:zoneId/settings */
  setZoneSetting: asyncHandler(async (req: Request, res: Response) => {
    const { zoneId } = zoneIdParamSchema.parse(req.params);
    const { setting, value } = setSettingSchema.parse(req.body);
    await cloudflareService.setZoneSetting(zoneId, setting, value);
    const settings = await cloudflareService.getZoneSettings(zoneId);
    res.json({ ok: true, data: settings });
  }),

  /** GET /api/cloudflare/zones/:zoneId/dns — records + pointsToServer. */
  listDnsRecords: asyncHandler(async (req: Request, res: Response) => {
    const { zoneId } = zoneIdParamSchema.parse(req.params);
    const executor = getExecutor(req);
    const result = await cloudflareService.listDnsRecords(executor, zoneId);
    res.json({ ok: true, data: result });
  }),

  /** POST /api/cloudflare/zones/:zoneId/dns */
  createDnsRecord: asyncHandler(async (req: Request, res: Response) => {
    const { zoneId } = zoneIdParamSchema.parse(req.params);
    const input = dnsCreateSchema.parse(req.body);
    const record = await cloudflareService.createDnsRecord(zoneId, input);
    eventBus.emit(Events.CLOUDFLARE_DNS_CHANGED, {
      zoneId,
      action: "created",
      type: record.type,
      name: record.name,
    });
    res.json({ ok: true, data: record });
  }),

  /** PATCH /api/cloudflare/zones/:zoneId/dns/:recordId */
  updateDnsRecord: asyncHandler(async (req: Request, res: Response) => {
    const { zoneId, recordId } = dnsRecordParamsSchema.parse(req.params);
    const input = dnsUpdateSchema.parse(req.body);
    const record = await cloudflareService.updateDnsRecord(zoneId, recordId, input);
    eventBus.emit(Events.CLOUDFLARE_DNS_CHANGED, {
      zoneId,
      action: "updated",
      type: record.type,
      name: record.name,
    });
    res.json({ ok: true, data: record });
  }),

  /** DELETE /api/cloudflare/zones/:zoneId/dns/:recordId */
  deleteDnsRecord: asyncHandler(async (req: Request, res: Response) => {
    const { zoneId, recordId } = dnsRecordParamsSchema.parse(req.params);
    await cloudflareService.deleteDnsRecord(zoneId, recordId);
    eventBus.emit(Events.CLOUDFLARE_DNS_CHANGED, { zoneId, action: "deleted" });
    res.json({ ok: true });
  }),

  /** POST /api/cloudflare/zones/:zoneId/purge */
  purgeCache: asyncHandler(async (req: Request, res: Response) => {
    const { zoneId } = zoneIdParamSchema.parse(req.params);
    const input = purgeSchema.parse(req.body);
    await cloudflareService.purgeCache(zoneId, input);
    eventBus.emit(Events.CLOUDFLARE_PURGED, {
      zoneId,
      everything: input.everything === true,
      files: input.files?.length ?? 0,
    });
    res.json({ ok: true });
  }),

  /** GET /api/cloudflare/zones/:zoneId/access-rules */
  listAccessRules: asyncHandler(async (req: Request, res: Response) => {
    const { zoneId } = zoneIdParamSchema.parse(req.params);
    const rules = await cloudflareService.listAccessRules(zoneId);
    res.json({ ok: true, data: rules });
  }),

  /** POST /api/cloudflare/zones/:zoneId/access-rules */
  createAccessRule: asyncHandler(async (req: Request, res: Response) => {
    const { zoneId } = zoneIdParamSchema.parse(req.params);
    const input = accessRuleSchema.parse(req.body);
    const rule = await cloudflareService.createAccessRule(zoneId, input);
    eventBus.emit(Events.CLOUDFLARE_ACCESS_RULE_ADDED, {
      zoneId,
      mode: input.mode,
      ip: input.ip,
    });
    res.json({ ok: true, data: rule });
  }),

  /** DELETE /api/cloudflare/zones/:zoneId/access-rules/:ruleId */
  deleteAccessRule: asyncHandler(async (req: Request, res: Response) => {
    const { zoneId, ruleId } = accessRuleParamsSchema.parse(req.params);
    await cloudflareService.deleteAccessRule(zoneId, ruleId);
    res.json({ ok: true });
  }),
};
