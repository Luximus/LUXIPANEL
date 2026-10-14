// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { settingsRepository } from "../../admin/repositories/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { mailDomainSchema, normalizeMailDomain } from "./_shared/normalize-domain.js";
import { parseStoredJson } from "./_shared/parse-stored-json.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { domainsService } from "../../nginx/services/domains.service.js";
import { applyArchiveRules, inspectArchiveIntegration, listArchivedMessages, readArchivedMessage } from "../services/archive.service.js";
import { assertOwnedMailDomain, filterMailDomainRecord } from "./_shared/mail-access.js";
import { NotFoundError } from "../../../shared/errors/index.js";
import { requireOwnedMailAccount } from "./mailbox-account.helpers.js";
import { withImap } from "../services/imap/imap-connection.js";
import { mailConfig } from "../../../config/mail.js";

const ARCHIVE_KEY = "mail_archive_settings_v2";
function targetKey(targetId: string): string {
  return `${ARCHIVE_KEY}:${targetId}`;
}

const retentionOptions = [32, 93, 181, 366, 731, 1826, 3651, 0] as const;

const archiveDomainSchema = z.object({
  incoming: z.boolean().default(false),
  outgoingMailingList: z.boolean().default(false),
  outgoing: z.boolean().default(false),
  retentionDays: z.union([z.enum(["custom"]), z.number().int().min(0).max(36500)]).default(0),
  customRetentionDays: z.number().int().min(1).max(36500).nullable().default(null),
});

const archiveSettingsSchema = z.object({
  defaults: z.object({
    incoming: z.boolean().default(false),
    outgoingMailingList: z.boolean().default(false),
    outgoing: z.boolean().default(false),
  }).default({ incoming: false, outgoingMailingList: false, outgoing: false }),
  domains: z.record(z.string(), archiveDomainSchema).default({}),
});

type ArchiveSettings = z.infer<typeof archiveSettingsSchema>;

async function applySettings(req: Request, data: ArchiveSettings): Promise<void> {
  const executor = getExecutor(req);
  const domains = await domainsService.list(executor);
  const rules = domains.map(({ name }) => {
    const domain = mailDomainSchema.parse(normalizeMailDomain(name));
    const rule = data.domains[domain] ?? data.defaults;
    const domainRule = data.domains[domain];
    const retentionDays = domainRule
      ? domainRule.retentionDays === "custom" ? domainRule.customRetentionDays ?? 0 : domainRule.retentionDays
      : 0;
    return { domain, incoming: rule.incoming, outgoing: rule.outgoing || rule.outgoingMailingList, retentionDays };
  });
  await applyArchiveRules(executor, rules);
}

function normalizeRetention(retentionDays: number | "custom", customRetentionDays: number | null): { retentionDays: number | "custom"; customRetentionDays: number | null } {
  if (retentionDays === "custom") {
    const custom = Number(customRetentionDays);
    return { retentionDays: "custom", customRetentionDays: Number.isFinite(custom) && custom > 0 ? custom : 1 };
  }
  if (retentionOptions.includes(retentionDays as any)) {
    return { retentionDays, customRetentionDays: null };
  }
  return { retentionDays: "custom", customRetentionDays: Math.max(1, Math.min(36500, Number(retentionDays) || 1)) };
}

function parseSettings(raw: string | null): ArchiveSettings {
  return parseStoredJson(raw, archiveSettingsSchema, archiveSettingsSchema.parse({}));
}

const upsertDefaultsSchema = z.object({
  incoming: z.boolean(),
  outgoingMailingList: z.boolean(),
  outgoing: z.boolean(),
});

const upsertDomainSchema = z.object({
  domain: mailDomainSchema,
  incoming: z.boolean(),
  outgoingMailingList: z.boolean(),
  outgoing: z.boolean(),
  retentionDays: z.union([z.literal("custom"), z.coerce.number().int().min(0).max(36500)]),
  customRetentionDays: z.coerce.number().int().min(1).max(36500).nullable().optional(),
});

const archiveMessageParams = z.object({
  domain: mailDomainSchema,
  direction: z.enum(["incoming", "outgoing"]),
  folder: z.enum(["new", "cur"]),
  name: z.string().min(10).max(255),
});

export const archiveController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const raw = await settingsRepository.get(targetKey(getExecutor(req).target.id));
    const data = parseSettings(raw);
    data.domains = await filterMailDomainRecord(data.domains);
    const integration = await inspectArchiveIntegration(getExecutor(req));
    res.json({ ok: true, data: { ...data, active: Boolean(raw) && integration.available, integration, legacyConfigured: !raw && Boolean(await settingsRepository.get("mail_archive_settings_v1")) } });
  }),

  updateDefaults: asyncHandler(async (req: Request, res: Response) => {
    const body = upsertDefaultsSchema.parse(req.body);
    const key = targetKey(getExecutor(req).target.id);
    const raw = await settingsRepository.get(key);
    const data = parseSettings(raw);
    data.defaults = body;
    await applySettings(req, data);
    await settingsRepository.set(key, JSON.stringify(data), "mail", "Applied mail archive settings by target");
    eventBus.emit(Events.SETTINGS_UPDATED, { key });
    res.json({ ok: true, data });
  }),

  upsertDomain: asyncHandler(async (req: Request, res: Response) => {
    const body = upsertDomainSchema.parse(req.body);
    const key = targetKey(getExecutor(req).target.id);
    const raw = await settingsRepository.get(key);
    const data = parseSettings(raw);
    const domain = await assertOwnedMailDomain(body.domain);
    const available = await domainsService.list(getExecutor(req));
    if (!available.some((item) => normalizeMailDomain(item.name) === domain)) throw new NotFoundError("Dominio de correo");
    const retention = normalizeRetention(body.retentionDays as any, body.customRetentionDays ?? null);

    data.domains[domain] = {
      incoming: body.incoming,
      outgoingMailingList: body.outgoingMailingList,
      outgoing: body.outgoing,
      retentionDays: retention.retentionDays,
      customRetentionDays: retention.customRetentionDays,
    };

    await applySettings(req, data);
    await settingsRepository.set(key, JSON.stringify(data), "mail", "Applied mail archive settings by target");
    eventBus.emit(Events.SETTINGS_UPDATED, { key });
    data.domains = await filterMailDomainRecord(data.domains);
    res.json({ ok: true, data });
  }),

  messages: asyncHandler(async (req: Request, res: Response) => {
    const domain = await assertOwnedMailDomain(mailDomainSchema.parse(req.params.domain));
    const direction = z.enum(["incoming", "outgoing"]).parse(req.query.direction ?? "incoming");
    const limit = z.coerce.number().int().min(1).max(100).parse(req.query.limit ?? 50);
    const data = await listArchivedMessages(getExecutor(req), domain, direction, limit);
    res.json({ ok: true, data });
  }),

  rawMessage: asyncHandler(async (req: Request, res: Response) => {
    const params = archiveMessageParams.parse(req.params);
    const domain = await assertOwnedMailDomain(params.domain);
    const raw = await readArchivedMessage(getExecutor(req), domain, params.direction, params.folder, params.name);
    res.setHeader("Content-Type", "message/rfc822");
    res.setHeader("Content-Disposition", "attachment; filename=archived-message.eml");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    res.send(raw);
  }),

  restoreMessage: asyncHandler(async (req: Request, res: Response) => {
    const params = archiveMessageParams.parse(req.params);
    const domain = await assertOwnedMailDomain(params.domain);
    const { accountId } = z.object({ accountId: z.number().int().positive() }).parse(req.body);
    const account = await requireOwnedMailAccount(accountId);
    if (account.address.split("@")[1]?.toLowerCase() !== domain) throw new NotFoundError("Buzón del dominio");
    const raw = await readArchivedMessage(getExecutor(req), domain, params.direction, params.folder, params.name);
    const result = await withImap(account.address, account.passwordEncrypted, mailConfig.imap.host, mailConfig.imap.port, async (client) => {
      const folder = "Archive Restored";
      const existing = await client.list();
      if (!existing.some((item) => item.path === folder)) await client.mailboxCreate(folder);
      return client.append(folder, raw);
    });
    if (!result) throw new Error("No se pudo restaurar el mensaje en IMAP");
    res.json({ ok: true, data: { folder: "Archive Restored", uid: result.uid ?? null } });
  }),
};
