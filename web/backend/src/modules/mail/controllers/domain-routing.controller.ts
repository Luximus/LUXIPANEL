// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Domain routing controller — stores mail routing mode per domain.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { settingsRepository } from "../../admin/repositories/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import {
  DOMAIN_ROUTING_KEY as SETTING_KEY,
  parseStoredRouting,
  routingModes,
  type RoutingMode,
  applyDomainRoutingFromSettings,
} from "./domain-routing.shared.js";
import { mailDomainSchema, normalizeMailDomain } from "./_shared/normalize-domain.js";
import { assertOwnedMailDomain, filterMailDomainRecord } from "./_shared/mail-access.js";

const setDomainRoutingSchema = z.object({
  domain: mailDomainSchema,
  mode: z.enum(routingModes),
});

export const domainRoutingController = {
  /** GET /api/mail/domain-routing — routing map keyed by domain. */
  list: asyncHandler(async (_req: Request, res: Response) => {
    const raw = await settingsRepository.get(SETTING_KEY);
    const routing = parseStoredRouting(raw);
    res.json({ ok: true, data: await filterMailDomainRecord(routing) });
  }),

  /** PUT /api/mail/domain-routing — set routing mode for one domain. */
  upsert: asyncHandler(async (req: Request, res: Response) => {
    const body = setDomainRoutingSchema.parse(req.body);
    const domain = await assertOwnedMailDomain(normalizeMailDomain(body.domain));
    const raw = await settingsRepository.get(SETTING_KEY);
    const routing = parseStoredRouting(raw);
    routing[domain] = body.mode as RoutingMode;

    await settingsRepository.set(
      SETTING_KEY,
      JSON.stringify(routing),
      "mail",
      "Mail routing mode by domain",
    );

    await applyDomainRoutingFromSettings(req);
    eventBus.emit(Events.SETTINGS_UPDATED, { key: SETTING_KEY });
    res.json({ ok: true, data: await filterMailDomainRecord(routing) });
  }),
};
