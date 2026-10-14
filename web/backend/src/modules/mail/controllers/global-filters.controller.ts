// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Global filters controller — filters that apply to all mail accounts.
 */

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { ConflictError, NotFoundError } from "../../../shared/errors/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import {
  FILTER_ACTION_TYPES,
  FILTER_RULE_LOGIC,
  FILTER_RULE_MATCHES,
  FILTER_RULE_PARTS,
  type FilterRuleMatch,
  type FilterRulePart,
  type MailFilterAction,
  type MailFilterRule,
} from "../types/filter.types.js";
import {
  GLOBAL_FILTERS_KEY,
  loadGlobalFilters,
  saveGlobalFilters,
  rebuildAllAccountsWithGlobalFilters,
  type GlobalMailFilter,
} from "./global-filters.shared.js";

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

const createSchema = z.object({
  name: z.string().trim().min(1).max(128),
  enabled: z.boolean().default(true),
  position: z.number().int().min(0).optional(),
  rules: z.array(ruleSchema).min(1).max(20),
  actions: z.array(actionSchema).min(1).max(20),
});

const updateSchema = createSchema.partial().refine((body) => Object.keys(body).length > 0, "No fields to update");

const testSchema = z.object({
  message: z.string().min(1).max(100000),
});

function parseEmailMessage(message: string): {
  headers: Record<string, string[]>;
  body: string;
} {
  const normalized = message.replace(/\r\n/g, "\n");
  const splitIndex = normalized.indexOf("\n\n");
  const headerBlock = splitIndex >= 0 ? normalized.slice(0, splitIndex) : normalized;
  const body = splitIndex >= 0 ? normalized.slice(splitIndex + 2) : "";

  const headers: Record<string, string[]> = {};
  let currentName = "";
  let currentValue = "";

  const flushCurrent = () => {
    if (!currentName) return;
    const key = currentName.toLowerCase();
    if (!headers[key]) headers[key] = [];
    headers[key]!.push(currentValue.trim());
    currentName = "";
    currentValue = "";
  };

  for (const line of headerBlock.split("\n")) {
    if (/^[\t ]+/.test(line) && currentName) {
      currentValue += ` ${line.trim()}`;
      continue;
    }

    flushCurrent();
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    currentName = line.slice(0, idx).trim();
    currentValue = line.slice(idx + 1).trim();
  }
  flushCurrent();

  return { headers, body };
}

function collectHeaderValues(headers: Record<string, string[]>, names: string[]): string[] {
  const values: string[] = [];
  for (const name of names) {
    const found = headers[name.toLowerCase()] ?? [];
    for (const item of found) values.push(item);
  }
  return values;
}

function applyStringMatch(value: string, candidateRaw: string, match: FilterRuleMatch): boolean {
  const candidate = candidateRaw.toLowerCase();
  const needle = value.toLowerCase();

  switch (match) {
    case "contains":
      return candidate.includes(needle);
    case "does_not_contain":
      return !candidate.includes(needle);
    case "is":
      return candidate === needle;
    case "begins":
      return candidate.startsWith(needle);
    case "does_not_begin":
      return !candidate.startsWith(needle);
    case "ends":
      return candidate.endsWith(needle);
    case "does_not_end":
      return !candidate.endsWith(needle);
    case "matches": {
      try {
        return new RegExp(value, "i").test(candidateRaw);
      } catch {
        return false;
      }
    }
    case "does_not_match": {
      try {
        return !new RegExp(value, "i").test(candidateRaw);
      } catch {
        return false;
      }
    }
    case "is_above":
    case "is_not_above":
    case "is_below":
    case "is_not_below": {
      const ruleValue = Number(value);
      const candidateValue = Number(candidateRaw);
      if (!Number.isFinite(ruleValue) || !Number.isFinite(candidateValue)) return false;
      if (match === "is_above") return candidateValue > ruleValue;
      if (match === "is_not_above") return candidateValue <= ruleValue;
      if (match === "is_below") return candidateValue < ruleValue;
      return candidateValue >= ruleValue;
    }
    default:
      return false;
  }
}

function getRuleCandidates(
  rule: MailFilterRule,
  headers: Record<string, string[]>,
  body: string,
): string[] {
  const part: FilterRulePart = rule.part;
  if (part === "body") return [body];
  if (part === "from") return collectHeaderValues(headers, ["from"]);
  if (part === "subject") return collectHeaderValues(headers, ["subject"]);
  if (part === "to") return collectHeaderValues(headers, ["to"]);
  if (part === "any_recipient") return collectHeaderValues(headers, ["to", "cc"]);
  if (part === "reply") return collectHeaderValues(headers, ["reply-to"]);
  if (part === "list_id") return collectHeaderValues(headers, ["list-id"]);
  if (part === "spam_status") return collectHeaderValues(headers, ["x-spam-status"]);
  if (part === "spam_bar") return collectHeaderValues(headers, ["x-spam-bar"]);
  if (part === "spam_score") return collectHeaderValues(headers, ["x-spam-score"]);
  if (part === "any_header") {
    return collectHeaderValues(headers, ["from", "to", "cc", "subject", "reply-to", "list-id", "x-spam-status", "x-spam-bar", "x-spam-score"]);
  }
  return [];
}

function evaluateSingleRule(rule: MailFilterRule, headers: Record<string, string[]>, body: string): boolean {
  if (rule.part === "not_delivered") {
    const deliveredTo = collectHeaderValues(headers, ["delivered-to"]);
    return deliveredTo.length === 0;
  }
  if (rule.part === "error_message") {
    const autoSubmitted = collectHeaderValues(headers, ["auto-submitted"]).join(" ").toLowerCase();
    const failedRecipients = collectHeaderValues(headers, ["x-failed-recipients"]);
    return autoSubmitted.includes("auto") || failedRecipients.length > 0;
  }

  const candidates = getRuleCandidates(rule, headers, body);
  if (!candidates.length) return false;
  return candidates.some((candidate) => applyStringMatch(rule.value ?? "", candidate ?? "", rule.match));
}

function evaluateRules(rules: MailFilterRule[], headers: Record<string, string[]>, body: string): boolean {
  if (!rules.length) return false;

  let andGroup = evaluateSingleRule(rules[0]!, headers, body);
  let total = false;

  for (let i = 1; i < rules.length; i++) {
    const rule = rules[i]!;
    if (rule.joinWithPrevious === "or") {
      total = total || andGroup;
      andGroup = evaluateSingleRule(rule, headers, body);
      continue;
    }
    andGroup = andGroup && evaluateSingleRule(rule, headers, body);
  }

  return total || andGroup;
}

function describeActions(actions: MailFilterAction[]): string[] {
  return actions.map((action) => {
    switch (action.type) {
      case "discard":
        return "Discard Message";
      case "redirect":
        return `Redirect to ${action.value || "(missing target)"}`;
      case "fail":
        return `Fail with message: ${action.value || "Rejected by filter"}`;
      case "stop":
        return "Stop Processing Rules";
      case "deliver_to_folder":
        return `Deliver to folder: ${action.value || "INBOX"}`;
      case "pipe":
        return `Pipe to program: ${action.value || "(missing path)"}`;
      default:
        return action.type;
    }
  });
}

export const globalFiltersController = {
  /** GET /api/mail/global-filters */
  list: asyncHandler(async (_req: Request, res: Response) => {
    const data = await loadGlobalFilters();
    res.json({ ok: true, data });
  }),

  /** POST /api/mail/global-filters */
  create: asyncHandler(async (req: Request, res: Response) => {
    const body = createSchema.parse(req.body);
    const current = await loadGlobalFilters();

    const conflict = current.find((item) => item.name.trim().toLowerCase() === body.name.trim().toLowerCase());
    if (conflict) throw new ConflictError(`Filter "${body.name}" already exists`);

    const position = body.position ?? current.length;
    const now = new Date().toISOString();
    const next: GlobalMailFilter[] = [...current, {
      id: randomUUID(),
      name: body.name.trim(),
      enabled: body.enabled,
      position,
      rules: body.rules,
      actions: body.actions,
      createdAt: now,
      updatedAt: now,
    }]
      .sort((a, b) => a.position - b.position)
      .map((item, index) => ({ ...item, position: index }));

    await saveGlobalFilters(next);
    await rebuildAllAccountsWithGlobalFilters(req);
    eventBus.emit(Events.SETTINGS_UPDATED, { key: GLOBAL_FILTERS_KEY });

    res.status(201).json({ ok: true, data: next });
  }),

  /** PUT /api/mail/global-filters/:filterId */
  update: asyncHandler(async (req: Request, res: Response) => {
    const filterId = String(req.params["filterId"] || "").trim();
    if (!filterId) throw new NotFoundError("Global filter");

    const body = updateSchema.parse(req.body);
    const current = await loadGlobalFilters();
    const index = current.findIndex((item) => item.id === filterId);
    if (index < 0) throw new NotFoundError("Global filter");

    const existing = current[index]!;
    const nextName = body.name?.trim() ?? existing.name;
    const conflict = current.find((item) => item.id !== filterId && item.name.trim().toLowerCase() === nextName.toLowerCase());
    if (conflict) throw new ConflictError(`Filter "${nextName}" already exists`);

    const next = [...current];
    next[index] = {
      ...existing,
      name: nextName,
      enabled: body.enabled ?? existing.enabled,
      position: body.position ?? existing.position,
      rules: body.rules ?? existing.rules,
      actions: body.actions ?? existing.actions,
      updatedAt: new Date().toISOString(),
    };

    const ordered = next
      .sort((a, b) => a.position - b.position)
      .map((item, idx) => ({ ...item, position: idx }));

    await saveGlobalFilters(ordered);
    await rebuildAllAccountsWithGlobalFilters(req);
    eventBus.emit(Events.SETTINGS_UPDATED, { key: GLOBAL_FILTERS_KEY });

    res.json({ ok: true, data: ordered });
  }),

  /** DELETE /api/mail/global-filters/:filterId */
  remove: asyncHandler(async (req: Request, res: Response) => {
    const filterId = String(req.params["filterId"] || "").trim();
    const current = await loadGlobalFilters();
    const next = current.filter((item) => item.id !== filterId).map((item, index) => ({ ...item, position: index }));
    if (next.length === current.length) throw new NotFoundError("Global filter");

    await saveGlobalFilters(next);
    await rebuildAllAccountsWithGlobalFilters(req);
    eventBus.emit(Events.SETTINGS_UPDATED, { key: GLOBAL_FILTERS_KEY });
    res.json({ ok: true, data: next });
  }),

  /** POST /api/mail/global-filters/test */
  test: asyncHandler(async (req: Request, res: Response) => {
    const body = testSchema.parse(req.body);
    const { headers, body: messageBody } = parseEmailMessage(body.message);
    const filters = await loadGlobalFilters();

    const matches = filters
      .sort((a, b) => a.position - b.position)
      .map((filter) => {
        const matched = filter.enabled && evaluateRules(filter.rules, headers, messageBody);
        return {
          id: filter.id,
          name: filter.name,
          enabled: filter.enabled,
          matched,
          actions: matched ? describeActions(filter.actions) : [],
        };
      });

    res.json({
      ok: true,
      data: {
        total: matches.length,
        matched: matches.filter((item) => item.matched).length,
        items: matches,
      },
    });
  }),
};
