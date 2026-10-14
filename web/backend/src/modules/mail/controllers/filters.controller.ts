// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Filters controller — manage custom mail filters per account.
 * Server-only: state lives in the account sidecar JSON on the remote
 * target; sieve regenerated from sidecar on every change.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor, type Executor } from "../../../shared/executor/index.js";
import { sieveService } from "../services/index.js";
import { accountSidecarService } from "../services/account-sidecar.service.js";
import { NotFoundError, ConflictError } from "../../../shared/errors/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import {
  FILTER_ACTION_TYPES,
  FILTER_RULE_LOGIC,
  FILTER_RULE_MATCHES,
  FILTER_RULE_PARTS,
  type MailFilterDefinition,
  type MailFilterRule,
  type MailFilterAction,
} from "../types/filter.types.js";
import { loadGlobalFilterDefinitions } from "./global-filters.shared.js";
import { fnv1aId } from "./accounts.helpers.js";
import { resolveOwnedAccountAddress as resolveAddress } from "./mailbox-account.helpers.js";

const ruleSchema = z.object({
  part: z.enum(FILTER_RULE_PARTS),
  match: z.enum(FILTER_RULE_MATCHES),
  value: z.string().max(2048).default(""),
  joinWithPrevious: z.enum(FILTER_RULE_LOGIC).optional(),
});

const actionSchema = z.object({
  type: z.enum(FILTER_ACTION_TYPES),
  value: z.string().max(2048).optional(),
});

const createFilterSchema = z.object({
  name: z.string().min(1).max(128),
  enabled: z.boolean().default(true),
  position: z.number().int().min(0).optional(),
  rules: z.array(ruleSchema).min(1).max(20),
  actions: z.array(actionSchema).min(1).max(20),
});

const updateFilterSchema = createFilterSchema.partial().refine(
  (body) => Object.keys(body).length > 0,
  "No fields to update",
);

export async function applySidecarToSieve(executor: Executor, address: string): Promise<void> {
  const sidecar = await accountSidecarService.read(executor, address);
  const globalFilterDefs = await loadGlobalFilterDefinitions();
  const accountFilterDefs: MailFilterDefinition[] = sidecar.filters.map((filter) => ({
    name: filter.name,
    enabled: filter.enabled,
    rules: filter.rules as MailFilterRule[],
    actions: filter.actions as MailFilterAction[],
  }));
  const filterDefs = [...globalFilterDefs, ...accountFilterDefs];
  const destinations = sidecar.forwards.map((f) => f.destination);
  const keepCopy = sidecar.forwards.some((f) => f.keepCopy);
  const ar = sidecar.autoresponder
    ? {
      enabled: sidecar.autoresponder.enabled,
      charset: sidecar.autoresponder.charset,
      intervalHours: sidecar.autoresponder.intervalHours,
      localPart: sidecar.autoresponder.localPart,
      domain: sidecar.autoresponder.domain,
      fromName: sidecar.autoresponder.fromName,
      subject: sidecar.autoresponder.subject,
      body: sidecar.autoresponder.body,
      isHtml: sidecar.autoresponder.isHtml,
      startAt: sidecar.autoresponder.startAt ? new Date(sidecar.autoresponder.startAt) : null,
      stopAt: sidecar.autoresponder.stopAt ? new Date(sidecar.autoresponder.stopAt) : null,
    }
    : null;

  await sieveService.writeAccountFiltersAndForwardsWithExecutor(address, destinations, keepCopy, filterDefs, executor, ar);
}

export const filtersController = {
  /** GET /api/accounts/:accountId/filters */
  list: asyncHandler(async (req: Request, res: Response) => {
    const address = await resolveAddress(req);
    const executor = getExecutor(req);
    const sidecar = await accountSidecarService.read(executor, address);
    res.json({ ok: true, data: sidecar.filters });
  }),

  /** POST /api/accounts/:accountId/filters */
  create: asyncHandler(async (req: Request, res: Response) => {
    const address = await resolveAddress(req);
    const body = createFilterSchema.parse(req.body);
    const executor = getExecutor(req);

    const sidecar = await accountSidecarService.read(executor, address);
    const name = body.name.trim();
    if (sidecar.filters.some((f) => f.name === name)) {
      throw new ConflictError(`Filter "${name}" already exists`);
    }

    const newFilter = {
      id: fnv1aId(`${address}:${name}:${Date.now()}`),
      name,
      enabled: body.enabled,
      rules: body.rules,
      actions: body.actions,
    };

    await accountSidecarService.update(executor, address, (current) => {
      const next = [...current.filters];
      const insertAt = body.position ?? next.length;
      next.splice(insertAt, 0, newFilter);
      return { ...current, filters: next };
    });

    await applySidecarToSieve(executor, address);
    eventBus.emit(Events.ACCOUNT_UPDATED, { accountId: fnv1aId(address) });
    res.status(201).json({ ok: true, data: newFilter });
  }),

  /** PUT /api/accounts/:accountId/filters/:filterId */
  update: asyncHandler(async (req: Request, res: Response) => {
    const address = await resolveAddress(req);
    const filterId = Number.parseInt(String(req.params["filterId"]), 10);
    const body = updateFilterSchema.parse(req.body);
    const executor = getExecutor(req);

    const sidecar = await accountSidecarService.read(executor, address);
    const existing = sidecar.filters.find((f) => f.id === filterId);
    if (!existing) throw new NotFoundError("Filter");

    if (body.name !== undefined) {
      const nextName = body.name.trim();
      if (sidecar.filters.some((f) => f.name === nextName && f.id !== filterId)) {
        throw new ConflictError(`Filter "${nextName}" already exists`);
      }
    }

    const updated = {
      ...existing,
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      ...(body.rules !== undefined ? { rules: body.rules } : {}),
      ...(body.actions !== undefined ? { actions: body.actions } : {}),
    };

    await accountSidecarService.update(executor, address, (current) => ({
      ...current,
      filters: current.filters.map((f) => (f.id === filterId ? updated : f)),
    }));

    await applySidecarToSieve(executor, address);
    eventBus.emit(Events.ACCOUNT_UPDATED, { accountId: fnv1aId(address) });
    res.json({ ok: true, data: updated });
  }),

  /** DELETE /api/accounts/:accountId/filters/:filterId */
  remove: asyncHandler(async (req: Request, res: Response) => {
    const address = await resolveAddress(req);
    const filterId = Number.parseInt(String(req.params["filterId"]), 10);
    const executor = getExecutor(req);

    const sidecar = await accountSidecarService.read(executor, address);
    if (!sidecar.filters.some((f) => f.id === filterId)) throw new NotFoundError("Filter");

    await accountSidecarService.update(executor, address, (current) => ({
      ...current,
      filters: current.filters.filter((f) => f.id !== filterId),
    }));

    await applySidecarToSieve(executor, address);
    eventBus.emit(Events.ACCOUNT_UPDATED, { accountId: fnv1aId(address) });
    res.json({ ok: true });
  }),
};
