// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { z } from "zod";
import type { Request } from "express";
import { randomUUID } from "node:crypto";
import { getExecutor, type Executor } from "../../../shared/executor/index.js";
import { settingsRepository } from "../../admin/repositories/index.js";
import { autoresponderRepository, filterRepository, forwardRepository } from "../repositories/index.js";
import { readAccountsFromServer, fnv1aId } from "./accounts.helpers.js";
import { sieveService } from "../services/index.js";
import {
  FILTER_ACTION_TYPES,
  FILTER_RULE_LOGIC,
  FILTER_RULE_MATCHES,
  FILTER_RULE_PARTS,
  type MailFilterDefinition,
} from "../types/filter.types.js";
import { parseStoredJson } from "./_shared/parse-stored-json.js";
import { loadAppliedSpamFilterDefinitions } from "../services/spam-settings.service.js";

export const GLOBAL_FILTERS_KEY = "mail_global_filters_v1";

const globalFilterRuleSchema = z.object({
  part: z.enum(FILTER_RULE_PARTS),
  match: z.enum(FILTER_RULE_MATCHES),
  value: z.string().max(2048).default(""),
  joinWithPrevious: z.enum(FILTER_RULE_LOGIC).optional(),
});

const globalFilterActionSchema = z.object({
  type: z.enum(FILTER_ACTION_TYPES),
  value: z.string().max(2048).optional(),
});

const globalFilterSchema = z.object({
  id: z.string().min(8).max(64),
  name: z.string().min(1).max(128),
  enabled: z.boolean().default(true),
  position: z.number().int().min(0).default(0),
  rules: z.array(globalFilterRuleSchema).min(1).max(20),
  actions: z.array(globalFilterActionSchema).min(1).max(20),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const globalFiltersListSchema = z.array(globalFilterSchema).max(400);

export type GlobalMailFilter = z.infer<typeof globalFilterSchema>;

function normalizeGlobalFilter(filter: GlobalMailFilter): GlobalMailFilter {
  return {
    id: filter.id,
    name: filter.name.trim(),
    enabled: filter.enabled,
    position: filter.position,
    rules: filter.rules.map((rule, index) => ({
      ...rule,
      value: (rule.value ?? "").trim(),
      joinWithPrevious: index === 0 ? undefined : (rule.joinWithPrevious === "or" ? "or" : "and"),
    })),
    actions: filter.actions.map((action) => ({
      type: action.type,
      value: action.value?.trim() || undefined,
    })),
    createdAt: filter.createdAt,
    updatedAt: filter.updatedAt,
  };
}

const storedGlobalFiltersSchema = globalFiltersListSchema.transform((parsed) =>
  parsed
    .map(normalizeGlobalFilter)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
);

function parseStoredGlobalFilters(raw: string | null): GlobalMailFilter[] {
  return parseStoredJson(raw, storedGlobalFiltersSchema, []);
}

export async function loadGlobalFilters(): Promise<GlobalMailFilter[]> {
  const raw = await settingsRepository.get(GLOBAL_FILTERS_KEY);
  return parseStoredGlobalFilters(raw);
}

export async function saveGlobalFilters(filters: GlobalMailFilter[]): Promise<void> {
  const now = new Date().toISOString();
  const normalized = filters
    .map((filter, index) => normalizeGlobalFilter({
      ...filter,
      id: (filter.id || randomUUID()).slice(0, 64),
      position: Number.isFinite(filter.position) ? filter.position : index,
      createdAt: filter.createdAt || now,
      updatedAt: now,
    }))
    .map((filter, index) => ({ ...filter, position: index }))
    .sort((a, b) => a.position - b.position);

  await settingsRepository.set(
    GLOBAL_FILTERS_KEY,
    JSON.stringify(normalized),
    "mail",
    "Global mail filters for all accounts",
  );
}

export function toGlobalFilterDefinitions(filters: GlobalMailFilter[]): MailFilterDefinition[] {
  return filters
    .map((filter) => ({
      name: filter.name,
      enabled: filter.enabled,
      rules: filter.rules,
      actions: filter.actions,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type AccountSieveInputs = {
  forwards: Awaited<ReturnType<typeof forwardRepository.findByAccountId>>;
  filters: Awaited<ReturnType<typeof filterRepository.findByAccountId>>;
  autoresponder: Awaited<ReturnType<typeof autoresponderRepository.findByAccountId>>;
};

/**
 * PURE grouping — turn the three bulk-read collections into a per-account map,
 * reproducing EXACTLY the ordering/selection of the per-account repository
 * methods so the bulk-read path is behaviourally identical to reading each
 * account individually:
 *   - forwards: stored order (matches `forwardRepository.findByAccountId`, which
 *     preserves `query()` insertion order).
 *   - filters: sorted by `position` then `id` (matches
 *     `filterRepository.findByAccountId`).
 *   - autoresponder: the FIRST match for the account in stored order (matches
 *     `autoresponderRepository.findByAccountId`, which uses `find()`).
 * Accounts with no forwards/filters get empty arrays; no autoresponder ⇒
 * `undefined`. No I/O — trivially unit-testable.
 */
export function groupAccountSieveInputs(
  accounts: Array<{ id: number }>,
  allForwards: AccountSieveInputs["forwards"],
  allFilters: AccountSieveInputs["filters"],
  allAutoresponders: Array<NonNullable<AccountSieveInputs["autoresponder"]>>,
): Map<number, AccountSieveInputs> {
  const forwardsByAccount = new Map<number, AccountSieveInputs["forwards"]>();
  for (const f of allForwards) {
    (forwardsByAccount.get(f.accountId) ?? forwardsByAccount.set(f.accountId, []).get(f.accountId)!).push(f);
  }
  const filtersByAccount = new Map<number, AccountSieveInputs["filters"]>();
  for (const f of allFilters) {
    (filtersByAccount.get(f.accountId) ?? filtersByAccount.set(f.accountId, []).get(f.accountId)!).push(f);
  }
  for (const list of filtersByAccount.values()) {
    list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id);
  }
  const autoresponderByAccount = new Map<number, NonNullable<AccountSieveInputs["autoresponder"]>>();
  for (const a of allAutoresponders) {
    if (!autoresponderByAccount.has(a.accountId)) autoresponderByAccount.set(a.accountId, a);
  }

  const out = new Map<number, AccountSieveInputs>();
  for (const account of accounts) {
    out.set(account.id, {
      forwards: forwardsByAccount.get(account.id) ?? [],
      filters: filtersByAccount.get(account.id) ?? [],
      autoresponder: autoresponderByAccount.get(account.id),
    });
  }
  return out;
}

async function rebuildOneAccountSieve(
  account: { id: number; address: string },
  executor: Executor,
  globalFilterDefs: MailFilterDefinition[],
  { forwards, filters, autoresponder }: AccountSieveInputs,
): Promise<void> {
  const accountFilterDefs: MailFilterDefinition[] = filters.map((filter) => ({
    name: filter.name,
    enabled: filter.enabled,
    rules: filter.rules,
    actions: filter.actions,
  }));

  const effectiveFilters = [...globalFilterDefs, ...accountFilterDefs];

  const responderDef = autoresponder
    ? {
      enabled: autoresponder.enabled,
      charset: autoresponder.charset,
      intervalHours: autoresponder.intervalHours,
      localPart: autoresponder.localPart,
      domain: autoresponder.domain,
      fromName: autoresponder.fromName,
      subject: autoresponder.subject,
      body: autoresponder.body,
      isHtml: autoresponder.isHtml,
      startAt: autoresponder.startAt,
      stopAt: autoresponder.stopAt,
    }
    : null;

  await sieveService.writeAccountFiltersAndForwardsWithExecutor(
    account.address,
    forwards.map((f) => f.destination),
    forwards.some((f) => f.keepCopy),
    effectiveFilters,
    executor,
    responderDef,
  );
}

export async function rebuildAllAccountsWithGlobalFilters(req: Request): Promise<void> {
  const executor = getExecutor(req);
  const accounts = (await readAccountsFromServer(executor)).map(({ address }) => ({ id: fnv1aId(address), address }));
  if (!accounts.length) return;

  const globalDefs = [
    ...await loadAppliedSpamFilterDefinitions(),
    ...toGlobalFilterDefinitions(await loadGlobalFilters()),
  ];

  // Rebuilding touches EVERY account. Reading forwards/filters/autoresponder
  // per account meant N full-collection cache reads+parses per collection
  // (O(N × collectionSize)); hoist to ONE bulk read per collection and group
  // in memory (O(collectionSize)) via the pure `groupAccountSieveInputs`. The
  // per-account sieve writes below are inherently per-account and stay
  // sequential — behavior is unchanged, only the read amplification is removed.
  const [allForwards, allFilters, allAutoresponders] = await Promise.all([
    forwardRepository.findAll(executor),
    filterRepository.findAll(executor),
    autoresponderRepository.findAll(executor),
  ]);

  const inputsByAccount = groupAccountSieveInputs(accounts, allForwards, allFilters, allAutoresponders);

  for (const account of accounts) {
    await rebuildOneAccountSieve(
      { id: account.id, address: account.address },
      executor,
      globalDefs,
      inputsByAccount.get(account.id) ?? { forwards: [], filters: [], autoresponder: undefined },
    );
  }
}

export async function loadGlobalFilterDefinitions(): Promise<MailFilterDefinition[]> {
  const globalFilters = await loadGlobalFilters();
  return [...await loadAppliedSpamFilterDefinitions(), ...toGlobalFilterDefinitions(globalFilters)];
}
