// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Domain forwards controller — global catch-all redirects by domain.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { emailSchema } from "../../../shared/validators/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { settingsRepository } from "../../admin/repositories/index.js";
import {
  DOMAIN_FORWARDS_KEY as SETTING_KEY,
  applyMergedCatchallFromSettings,
  parseDomainForwards,
  type DomainForwardEntry,
} from "./domain-catchall.shared.js";
import { mailDomainSchema, normalizeMailDomain } from "./_shared/normalize-domain.js";
import { assertOwnedMailDomain, visibleMailDomains } from "./_shared/mail-access.js";

const replaceDomainForwardsSchema = z.object({
  entries: z.array(z.object({
    domain: mailDomainSchema,
    destinations: z.array(emailSchema).min(1).max(20),
  })).max(300),
});
const domainDestinationsSchema = z.object({
  destinations: z.array(emailSchema).min(1).max(20),
});

function normalizeEntries(entries: DomainForwardEntry[]): DomainForwardEntry[] {
  const grouped = new Map<string, Set<string>>();

  for (const entry of entries) {
    const domain = normalizeMailDomain(entry.domain);
    if (!domain) continue;
    if (!grouped.has(domain)) grouped.set(domain, new Set<string>());
    const destinationSet = grouped.get(domain)!;
    for (const destination of entry.destinations) {
      const normalizedDestination = destination.trim().toLowerCase();
      if (!normalizedDestination) continue;
      destinationSet.add(normalizedDestination);
    }
  }

  return Array.from(grouped.entries())
    .map(([domain, destinationSet]) => ({
      domain,
      destinations: Array.from(destinationSet),
    }))
    .filter((entry) => entry.destinations.length > 0)
    .sort((a, b) => a.domain.localeCompare(b.domain));
}

async function persistAndApply(req: Request, entries: DomainForwardEntry[]): Promise<void> {
  await settingsRepository.set(
    SETTING_KEY,
    JSON.stringify(entries),
    "mail",
    "Global domain catch-all redirects",
  );
  await applyMergedCatchallFromSettings(req);

  eventBus.emit(Events.SETTINGS_UPDATED, { key: SETTING_KEY });
}

export const domainForwardsController = {
  /** GET /api/mail/domain-forwards — list all global domain redirect rules. */
  list: asyncHandler(async (_req: Request, res: Response) => {
    const raw = await settingsRepository.get(SETTING_KEY);
    const entries = parseDomainForwards(raw);
    const visible = await visibleMailDomains();
    res.json({ ok: true, data: visible ? entries.filter((entry) => visible.has(entry.domain)) : entries });
  }),

  /** PUT /api/mail/domain-forwards — replace all global domain redirect rules. */
  replace: asyncHandler(async (req: Request, res: Response) => {
    const body = replaceDomainForwardsSchema.parse(req.body);
    const entries = normalizeEntries(body.entries);
    await persistAndApply(req, entries);
    res.json({ ok: true, data: entries });
  }),

  upsert: asyncHandler(async (req: Request, res: Response) => {
    const domain = await assertOwnedMailDomain(mailDomainSchema.parse(req.params.domain));
    const { destinations } = domainDestinationsSchema.parse(req.body);
    const current = parseDomainForwards(await settingsRepository.get(SETTING_KEY));
    const entries = normalizeEntries([
      ...current.filter((entry) => entry.domain !== domain),
      { domain, destinations },
    ]);
    await persistAndApply(req, entries);
    const visible = await visibleMailDomains();
    res.json({ ok: true, data: visible ? entries.filter((entry) => visible.has(entry.domain)) : entries });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const domain = await assertOwnedMailDomain(mailDomainSchema.parse(req.params.domain));
    const current = parseDomainForwards(await settingsRepository.get(SETTING_KEY));
    const entries = current.filter((entry) => entry.domain !== domain);
    await persistAndApply(req, entries);
    const visible = await visibleMailDomains();
    res.json({ ok: true, data: visible ? entries.filter((entry) => visible.has(entry.domain)) : entries });
  }),
};
