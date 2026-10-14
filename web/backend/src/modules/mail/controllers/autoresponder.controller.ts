// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Autoresponder controller — manage autoresponder per account.
 * Server-only: state lives in the account sidecar JSON on the remote
 * target; sieve is regenerated from the sidecar on every change.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor, type Executor } from "../../../shared/executor/index.js";
import { accountSidecarService } from "../services/account-sidecar.service.js";
import { domainsService } from "../../nginx/services/domains.service.js";
import { ConflictError } from "../../../shared/errors/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { applySidecarToSieve } from "./filters.controller.js";
import { fnv1aId } from "./accounts.helpers.js";
import { resolveOwnedAccountAddress as resolveAddress } from "./mailbox-account.helpers.js";
import { LOCAL_PART_REGEX } from "./accounts/accounts.util.js";

const upsertSchema = z.object({
  enabled: z.boolean().default(true),
  charset: z.string().min(1).max(128).default("utf-8"),
  intervalHours: z.number().int().min(0).max(24 * 365).default(24),
  localPart: z.string().min(1).max(128),
  domain: z.string().min(1).max(253),
  fromName: z.string().max(320).optional().nullable(),
  subject: z.string().min(1).max(255),
  body: z.string().min(1).max(20000),
  isHtml: z.boolean().default(false),
  startAt: z.string().datetime().optional().nullable(),
  stopAt: z.string().datetime().optional().nullable(),
});

/** Charset catalog per target — `iconv -l` output is static per server. */
const charsetsByTarget = new Map<string, string[]>();

/**
 * List the charsets supported by the CONNECTED server (the autoresponder's
 * MIME body is generated for that server's sievec/iconv). Constant argv, no
 * user input — but still runs via the executor: no module may exec on the
 * panel host (CLAUDE.md hard rule).
 */
async function parseCharsetsFromIconv(executor: Executor): Promise<string[]> {
  const cached = charsetsByTarget.get(executor.target.id);
  if (cached) return cached;
  try {
    const res = await executor.exec("iconv -l");
    if (res.exitCode !== 0) return [];
    const values = res.stdout
      .split(/\s+/)
      .map((item) => item.trim().toLowerCase().replace(/\/+$/, ""))
      .filter((item) => item.length > 0);
    const list = [...new Set(values)].sort((a, b) => a.localeCompare(b));
    if (list.length) charsetsByTarget.set(executor.target.id, list);
    return list;
  } catch {
    return [];
  }
}

export const autoresponderController = {
  /** GET /api/accounts/autoresponder/charsets */
  charsets: asyncHandler(async (req: Request, res: Response) => {
    const dynamicList = await parseCharsetsFromIconv(getExecutor(req));
    const fallback = ["utf-8", "iso-8859-1", "windows-1252", "us-ascii"];
    const list = dynamicList.length ? dynamicList : fallback;
    res.json({ ok: true, data: list });
  }),

  /** GET /api/accounts/:accountId/autoresponder */
  get: asyncHandler(async (req: Request, res: Response) => {
    const address = await resolveAddress(req);
    const executor = getExecutor(req);
    const sidecar = await accountSidecarService.read(executor, address);
    res.json({ ok: true, data: sidecar.autoresponder ?? null });
  }),

  /** PUT /api/accounts/:accountId/autoresponder */
  upsert: asyncHandler(async (req: Request, res: Response) => {
    const address = await resolveAddress(req);
    const body = upsertSchema.parse(req.body);

    const localPart = body.localPart.trim().toLowerCase();
    const domain = body.domain.trim().toLowerCase();
    if (!LOCAL_PART_REGEX.test(localPart)) {
      throw new ConflictError("Local part format is invalid");
    }

    const executor = getExecutor(req);
    const availableDomains = await domainsService.list(executor);
    const hasDomain = availableDomains.some((item) => item.name.trim().toLowerCase() === domain);
    if (!hasDomain) {
      throw new ConflictError(`Domain "${domain}" is not registered in DNS module`);
    }

    const startAt = body.startAt ? body.startAt : null;
    const stopAt = body.stopAt ? body.stopAt : null;
    if (startAt && stopAt && new Date(startAt) > new Date(stopAt)) {
      throw new ConflictError("Start date must be earlier than stop date");
    }

    const saved = await accountSidecarService.update(executor, address, (current) => ({
      ...current,
      autoresponder: {
        enabled: body.enabled,
        charset: body.charset.trim().toLowerCase(),
        intervalHours: body.intervalHours,
        localPart,
        domain,
        fromName: body.fromName?.trim() || null,
        subject: body.subject.trim(),
        body: body.body,
        isHtml: body.isHtml,
        startAt,
        stopAt,
      },
    }));

    await applySidecarToSieve(executor, address);
    eventBus.emit(Events.ACCOUNT_UPDATED, { accountId: fnv1aId(address) });
    res.json({ ok: true, data: saved.autoresponder });
  }),

  /** DELETE /api/accounts/:accountId/autoresponder */
  remove: asyncHandler(async (req: Request, res: Response) => {
    const address = await resolveAddress(req);
    const executor = getExecutor(req);
    await accountSidecarService.update(executor, address, (current) => ({ ...current, autoresponder: null }));
    await applySidecarToSieve(executor, address);
    eventBus.emit(Events.ACCOUNT_UPDATED, { accountId: fnv1aId(address) });
    res.json({ ok: true });
  }),
};
