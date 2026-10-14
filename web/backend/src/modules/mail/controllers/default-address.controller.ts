// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Default address controller — unrouted/invalid recipient behavior by domain.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { emailSchema } from "../../../shared/validators/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { settingsRepository } from "../../admin/repositories/index.js";
import {
  DEFAULT_ADDRESS_KEY as SETTING_KEY,
  applyMergedCatchallFromSettings,
  parseDefaultAddress,
} from "./domain-catchall.shared.js";
import { mailDomainSchema, normalizeMailDomain } from "./_shared/normalize-domain.js";
import { assertOwnedMailDomain, filterMailDomainRecord } from "./_shared/mail-access.js";

const upsertDefaultAddressSchema = z.object({
  domain: mailDomainSchema,
  mode: z.enum(["fail", "forward"]),
  failureMessage: z.string().trim().max(255).optional(),
  forwardTo: emailSchema.optional(),
});

export const defaultAddressController = {
  /** GET /api/mail/default-address — returns map keyed by domain. */
  list: asyncHandler(async (_req: Request, res: Response) => {
    const raw = await settingsRepository.get(SETTING_KEY);
    const data = parseDefaultAddress(raw);
    res.json({ ok: true, data: await filterMailDomainRecord(data) });
  }),

  /** PUT /api/mail/default-address — set default-address behavior for one domain. */
  upsert: asyncHandler(async (req: Request, res: Response) => {
    const body = upsertDefaultAddressSchema.parse(req.body);
    const raw = await settingsRepository.get(SETTING_KEY);
    const data = parseDefaultAddress(raw);
    const domain = await assertOwnedMailDomain(normalizeMailDomain(body.domain));

    if (body.mode === "forward") {
      const forwardTo = (body.forwardTo ?? "").trim().toLowerCase();
      data[domain] = { mode: "forward", forwardTo };
    } else {
      const failureMessage = (body.failureMessage ?? "").trim() || "No Such User Here";
      data[domain] = { mode: "fail", failureMessage };
    }

    await settingsRepository.set(
      SETTING_KEY,
      JSON.stringify(data),
      "mail",
      "Default address behavior by domain",
    );

    await applyMergedCatchallFromSettings(req);
    eventBus.emit(Events.SETTINGS_UPDATED, { key: SETTING_KEY });

    res.json({ ok: true, data: await filterMailDomainRecord(data) });
  }),
};
