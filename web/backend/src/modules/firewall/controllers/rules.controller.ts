// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Firewall rules controller — add/delete UFW rules.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { NotFoundError, ConflictError } from "../../../shared/errors/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { ufwService } from "../services/ufw.service.js";
import { cloudflareIpsService } from "../services/cloudflare-ips.service.js";
import { serveCachedDataTable } from "../../../shared/remote-cache/serve-cached-datatable.js";
import { CACHE_KEYS } from "../../../shared/cache/cacheable-modules.js";
import type { MutationStep } from "../../../shared/remote-cache/submit-mutation.js";
import { dispatchMutation } from "../../../shared/remote-cache/dispatch-mutation.js";
import { apiErrorMessage } from "../../../shared/i18n/errors.js";

const addRuleSchema = z.object({
  action: z.enum(["allow", "deny", "limit", "reject"]),
  port: z.string().min(1).max(64).regex(/^[\w./:+-]+$/, "Invalid port/service"),
  proto: z.enum(["tcp", "udp", "any"]).default("any"),
  from: z.string().max(45).default("any"),
  comment: z.string().max(128).optional(),
});

/** Fold an explicit proto into the UFW port spec (`80` + `tcp` → `80/tcp`).
 *  Only for numeric ports/ranges that don't already carry a proto; named
 *  services (`ssh`) and `any` proto pass through unchanged. */
function portSpec(port: string, proto: "tcp" | "udp" | "any"): string {
  if (proto === "any" || port.includes("/")) return port;
  if (!/^[0-9]+(:[0-9]+)?$/.test(port)) return port;
  return `${port}/${proto}`;
}

const CF_PORTS = "80,443";
const CF_COMMENT = "cloudflare";

/**
 * Optional content signature for a delete (audit §5). UFW renumbers after every
 * delete and the rules list is served from a ~60s collector cache, so a purely
 * positional delete can hit the WRONG rule (worst case: dropping `allow 22/tcp`
 * and locking out SSH). When the client passes the rule's identifying fields we
 * re-read the LIVE `ufw status numbered` and resolve the number by content,
 * refusing the delete on a mismatch. Absent → legacy positional behaviour.
 */
const deleteSigSchema = z.object({
  to: z.string().max(128).optional(),
  from: z.string().max(128).optional(),
  action: z.string().max(64).optional(),
  comment: z.string().max(128).optional(),
});

export const rulesController = {
  /** GET /api/firewall/rules — cache-first via collector-firewall.py. */
  list: asyncHandler(async (_req: Request, res: Response) => {
    const executor = getExecutor(_req);
    const cached = await serveCachedDataTable<Record<string, unknown>>({
      executor, module: CACHE_KEYS.firewall.rules.module, collection: CACHE_KEYS.firewall.rules.collection,
      liveLoader: async () => {
        const { rules } = await ufwService.getStatusWithExecutor(executor);
        return rules as unknown as Record<string, unknown>[];
      },
    });
    res.json({ ok: true, data: cached.rows });
  }),

  /** POST /api/firewall/rules — add a new UFW rule (write-behind queue). */
  add: asyncHandler(async (req: Request, res: Response) => {
    const body = addRuleSchema.parse(req.body);
    const port = portSpec(body.port, body.proto);
    const executor = getExecutor(req);
    const out = await dispatchMutation<void>({
      executor,
      local: async () => {
        await ufwService.addRuleWithExecutor(executor, body.action, port, body.from, body.comment);
      },
      remote: async () => {
        const steps: MutationStep[] = [
          { type: "sh", argv: ufwService._addRuleArgv(body.action, port, body.from, body.comment), sudo: true },
        ];
        return {
          data: undefined,
          submit: {
            module: CACHE_KEYS.firewall.rules.module, collection: CACHE_KEYS.firewall.rules.collection, op: "create" as const, steps,
            refresh: [["firewall", "rules"]] as Array<[string, string]>,
          },
        };
      },
    });
    eventBus.emit(Events.FIREWALL_RULE_ADDED, {
      action: body.action, port: body.port, from: body.from, target: executor.target.id,
    });
    res.status(201).json({ ok: true, ...(out.job ? { job: out.job } : {}) });
  }),

  /**
   * POST /api/firewall/cloudflare-allow — preset: allow Cloudflare's published
   * IP ranges (fetched from cloudflare.com/ips-v4|v6, public endpoints — no
   * cloudflare-module token involved) on TCP 80,443.
   *
   * One UFW rule per range, all applied as ONE write-behind job on remote
   * targets (same path as `add`); synchronous ufwService on the local target.
   * Idempotent: re-running makes UFW print "Skipping adding existing rule"
   * without failing, so no dedupe is needed.
   */
  cloudflareAllow: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const { v4, v6 } = await cloudflareIpsService.fetchRanges();
    const cidrs = [...v4, ...v6];

    const out = await dispatchMutation({
      executor,
      local: async () => {
        for (const cidr of cidrs) {
          await ufwService.allowTcpPortsFromCidrWithExecutor(executor, cidr, CF_PORTS, CF_COMMENT);
        }
        return { applied: cidrs.length };
      },
      remote: async () => {
        const steps: MutationStep[] = cidrs.map((cidr) => ({
          type: "sh", argv: ufwService._allowTcpArgv(cidr, CF_PORTS, CF_COMMENT), sudo: true,
        }));
        return {
          data: { applied: cidrs.length },
          submit: {
            module: CACHE_KEYS.firewall.rules.module, collection: CACHE_KEYS.firewall.rules.collection, op: "create" as const, steps,
            refresh: [["firewall", "rules"]] as Array<[string, string]>,
          },
        };
      },
    });
    eventBus.emit(Events.FIREWALL_RULE_ADDED, {
      action: "allow", from: "cloudflare", port: CF_PORTS, target: executor.target.id,
    });
    // NOTE: the job MUST be nested inside `data`. The frontend api-client maps
    // `data: json.data ?? json`, so when `data` exists a top-level `job`
    // sibling is dropped and awaitJob() (res.data.job ?? res.job) would no-op,
    // reloading the table before the write-behind worker applied the rules.
    res.status(201).json({
      ok: true,
      data: { ...out.data, ...(out.job ? { job: out.job } : {}) },
    });
  }),

  /** DELETE /api/firewall/rules/:number — delete rule by position (queue). */
  remove: asyncHandler(async (req: Request, res: Response) => {
    const ruleNumber = parseInt(String(req.params.number), 10);
    if (isNaN(ruleNumber) || ruleNumber < 1) {
      res.status(400).json({ ok: false, error: apiErrorMessage(res.locals.locale, "invalid") });
      return;
    }
    const executor = getExecutor(req);

    // Resolve the number by CONTENT against the LIVE numbered status when the
    // client supplies a signature — never trust the cached position alone.
    const sig = deleteSigSchema.parse(req.query);
    let targetNumber = ruleNumber;
    if (sig.to || sig.from || sig.action || sig.comment !== undefined) {
      const { rules } = await ufwService.getStatusWithExecutor(executor);
      const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();
      const matches = rules.filter((r) =>
        (!sig.to || norm(r.to) === norm(sig.to)) &&
        (!sig.from || norm(r.from) === norm(sig.from)) &&
        (!sig.action || norm(r.action) === norm(sig.action)) &&
        (sig.comment === undefined || norm(r.comment) === norm(sig.comment)),
      );
      if (matches.length === 0) throw new NotFoundError("Firewall rule");
      const atPos = matches.find((r) => r.number === ruleNumber);
      if (atPos) targetNumber = atPos.number;
      else if (matches.length === 1) targetNumber = matches[0]!.number;
      else throw new ConflictError("La regla cambió de posición; recarga la lista e inténtalo de nuevo.");
    }

    const out = await dispatchMutation<void>({
      executor,
      local: async () => {
        await ufwService.deleteRuleWithExecutor(executor, targetNumber);
      },
      remote: async () => {
        // `--force` is REQUIRED (built into `_deleteRuleArgv`): the write-behind
        // worker runs without a TTY, so a bare `ufw delete N` blocks on the
        // "Proceed (y|n)?" prompt, reads EOF and aborts → the rule is never removed.
        const steps: MutationStep[] = [
          { type: "sh", argv: ufwService._deleteRuleArgv(targetNumber), sudo: true },
        ];
        return {
          data: undefined,
          submit: {
            module: CACHE_KEYS.firewall.rules.module, collection: CACHE_KEYS.firewall.rules.collection, op: "delete" as const, steps,
            refresh: [["firewall", "rules"]] as Array<[string, string]>,
          },
        };
      },
    });
    eventBus.emit(Events.FIREWALL_RULE_DELETED, {
      ruleNumber: targetNumber, target: executor.target.id,
    });
    res.json({ ok: true, ...(out.job ? { job: out.job } : {}) });
  }),
};
