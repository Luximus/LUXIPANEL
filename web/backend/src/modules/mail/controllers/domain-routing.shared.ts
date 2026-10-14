// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { Request } from "express";
import { z } from "zod";
import { getExecutor } from "../../../shared/executor/index.js";
import { settingsRepository } from "../../admin/repositories/index.js";
import { postfixService } from "../services/index.js";
import { normalizeMailDomain } from "./_shared/normalize-domain.js";
import { parseStoredJson } from "./_shared/parse-stored-json.js";

export const DOMAIN_ROUTING_KEY = "mail_domain_routing_v1";

export const routingModes = ["auto_remote", "local", "backup", "remote"] as const;
export type RoutingMode = (typeof routingModes)[number];

const parseSchema = z.record(z.enum(routingModes)).transform((parsed) => {
  const out: Record<string, RoutingMode> = {};
  for (const [domainRaw, mode] of Object.entries(parsed)) {
    const domain = normalizeMailDomain(domainRaw);
    if (!domain) continue;
    out[domain] = mode;
  }
  return out;
});

export function parseStoredRouting(raw: string | null): Record<string, RoutingMode> {
  return parseStoredJson(raw, parseSchema, {});
}

function toRoutingEntries(routing: Record<string, RoutingMode>): Array<{ domain: string; mode: RoutingMode }> {
  return Object.entries(routing)
    .map(([domain, mode]) => ({ domain, mode }))
    .sort((a, b) => a.domain.localeCompare(b.domain));
}

export async function applyDomainRoutingFromSettings(req: Request): Promise<void> {
  const raw = await settingsRepository.get(DOMAIN_ROUTING_KEY);
  const routing = parseStoredRouting(raw);
  const entries = toRoutingEntries(routing);

  const executor = getExecutor(req);
  await postfixService.regenerateRoutingMapsWithExecutor(entries, executor);
  await postfixService.reloadWithExecutor(executor);
}
