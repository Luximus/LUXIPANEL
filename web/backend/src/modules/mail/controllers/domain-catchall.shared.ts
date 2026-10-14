// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { Request } from "express";
import { z } from "zod";
import { getExecutor } from "../../../shared/executor/index.js";
import { settingsRepository } from "../../admin/repositories/index.js";
import { postfixService } from "../services/index.js";
import { normalizeMailDomain } from "./_shared/normalize-domain.js";

export const DOMAIN_FORWARDS_KEY = "mail_domain_forwards_v1";
export const DEFAULT_ADDRESS_KEY = "mail_default_address_v1";

export type DomainForwardEntry = {
  domain: string;
  destinations: string[];
};

type DefaultAddressMode = "fail" | "forward";
export type DefaultAddressRule = {
  mode: DefaultAddressMode;
  failureMessage?: string;
  forwardTo?: string;
};

const forwardEntrySchema = z.array(z.object({
  domain: z.string(),
  destinations: z.array(z.string()),
}));

const defaultAddressSchema = z.record(z.object({
  mode: z.union([z.literal("fail"), z.literal("forward")]),
  failureMessage: z.string().optional(),
  forwardTo: z.string().optional(),
}));

export function parseDomainForwards(raw: string | null): DomainForwardEntry[] {
  if (!raw) return [];
  try {
    const parsed = forwardEntrySchema.parse(JSON.parse(raw));
    return parsed
      .map((entry) => ({
        domain: normalizeMailDomain(entry.domain),
        destinations: entry.destinations.map((value) => value.trim().toLowerCase()).filter(Boolean),
      }))
      .filter((entry) => entry.domain && entry.destinations.length > 0);
  } catch {
    return [];
  }
}

export function parseDefaultAddress(raw: string | null): Record<string, DefaultAddressRule> {
  if (!raw) return {};
  try {
    const parsed = defaultAddressSchema.parse(JSON.parse(raw));
    const out: Record<string, DefaultAddressRule> = {};
    for (const [domainRaw, rule] of Object.entries(parsed)) {
      const domain = normalizeMailDomain(domainRaw);
      if (!domain) continue;
      if (rule.mode === "forward") {
        const forwardTo = (rule.forwardTo ?? "").trim().toLowerCase();
        if (!forwardTo) continue;
        out[domain] = { mode: "forward", forwardTo };
      } else {
        const failureMessage = (rule.failureMessage ?? "").trim() || "No Such User Here";
        out[domain] = { mode: "fail", failureMessage };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function mergedCatchallRules(
  forwards: DomainForwardEntry[],
  defaults: Record<string, DefaultAddressRule>,
): Array<{ domain: string; mode: "forward"; destinations: string[] } | { domain: string; mode: "fail"; message: string }> {
  const out = new Map<string, { mode: "forward"; destinations: string[] } | { mode: "fail"; message: string }>();

  for (const entry of forwards) {
    out.set(entry.domain, { mode: "forward", destinations: entry.destinations });
  }

  for (const [domain, rule] of Object.entries(defaults)) {
    if (rule.mode === "forward" && rule.forwardTo) {
      out.set(domain, { mode: "forward", destinations: [rule.forwardTo] });
      continue;
    }
    if (rule.mode === "fail") {
      out.set(domain, { mode: "fail", message: rule.failureMessage || "No Such User Here" });
    }
  }

  return Array.from(out.entries())
    .map(([domain, rule]) => ({ domain, ...rule }))
    .sort((a, b) => a.domain.localeCompare(b.domain));
}

export async function applyMergedCatchallFromSettings(req: Request): Promise<void> {
  const [forwardsRaw, defaultsRaw] = await Promise.all([
    settingsRepository.get(DOMAIN_FORWARDS_KEY),
    settingsRepository.get(DEFAULT_ADDRESS_KEY),
  ]);
  const forwards = parseDomainForwards(forwardsRaw);
  const defaults = parseDefaultAddress(defaultsRaw);
  const rules = mergedCatchallRules(forwards, defaults);

  const executor = getExecutor(req);
  await postfixService.regenerateCatchallMapWithExecutor(rules, executor);
  await postfixService.reloadWithExecutor(executor);
}

