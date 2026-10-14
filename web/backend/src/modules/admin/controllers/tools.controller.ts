// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tools controller — server administration tools.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Request, Response } from "express";

const execFileAsync = promisify(execFile);
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor, quoteCmd } from "../../../shared/executor/index.js";
import { accountRepository } from "../../mail/repositories/index.js";
import { forwardRepository } from "../../mail/repositories/index.js";
import { dovecotService, postfixService, sieveService } from "../../mail/services/index.js";
import { auditRepository } from "../../auth/repositories/index.js";
import { authService } from "../../auth/services/auth.service.js";
import { extractIp } from "../../../shared/utils/ip.js";
import { ValidationError, AppError } from "../../../shared/errors/index.js";
import { domainSchema } from "../../../shared/validators/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { buildDovecotEntries, buildMailboxMap } from "../account-policy.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";

const log = createModuleLogger("tools-ctrl");

/**
 * `GET /dns-check/:domain` accepts a strict FQDN: the canonical `domainSchema`
 * label grammar plus an alphabetic TLD (so at least two labels). Keeping the
 * grammar shared means this endpoint and nginx/mail agree on what a domain is.
 */
const dnsCheckDomainSchema = domainSchema.refine(
  (value) => /\.[a-z]{2,63}$/.test(value),
  "Invalid domain",
);

export const toolsController = {
  /** POST /api/admin/tools/rebuild-maps — regenerate Postfix/Dovecot maps. */
  rebuildMaps: asyncHandler(async (req: Request, res: Response) => {
    const user = res.locals.user;
    const executor = getExecutor(req);

    const allAccounts = await accountRepository.findAll();

    await dovecotService.regenerateUsersFileWithExecutor(buildDovecotEntries(allAccounts), executor);
    await postfixService.regenerateMailboxMapWithExecutor(buildMailboxMap(allAccounts), executor);
    const domains = await accountRepository.getDomains();
    await postfixService.regenerateDomainMapWithExecutor(domains, executor);
    await dovecotService.reloadWithExecutor(executor);
    await postfixService.reloadWithExecutor(executor);

    // Rebuild sieve scripts
    const allForwards = await forwardRepository.findAll();
    const accountForwards = allAccounts.map((a) => {
      const fwds = allForwards.filter((f) => f.accountId === a.id && f.enabled);
      return {
        address: a.address,
        destinations: fwds.map((f) => f.destination),
        keepCopy: fwds.some((f) => f.keepCopy),
      };
    });
    for (const item of accountForwards) {
      await sieveService.writeAccountFiltersAndForwardsWithExecutor(
        item.address,
        item.destinations,
        item.keepCopy,
        [],
        executor,
      );
    }

    await authService.logAudit(
      "admin_rebuild_maps",
      user?.userId ?? null,
      "info",
      {
        ip: extractIp(req),
        userAgent: req.headers["user-agent"] || "",
      },
      { accountCount: allAccounts.length },
    );

    log.info({ user: user?.username }, "Mail maps rebuilt");
    res.json({ ok: true, message: apiModuleMessage(res.locals.locale, "mailMapsRebuilt").replace("{count}", String(allAccounts.length)) });
  }),

  /** POST /api/admin/tools/restart-service — restart a system service. */
  restartService: asyncHandler(async (req: Request, res: Response) => {
    const user = res.locals.user;
    const serviceName = String(req.body?.service || "");
    const executor = getExecutor(req);

    const allowed = ["postfix", "dovecot", "opendkim", "redis-server", "postgresql"];
    if (!allowed.includes(serviceName)) {
      throw new ValidationError(apiModuleMessage(res.locals.locale, "serviceNotAllowed").replace("{service}", () => serviceName));
    }

    try {
      // Always run on the connected server via the executor — no module runs
      // commands on the panel host (CLAUDE.md hard rule).
      await executor.exec(quoteCmd("sudo", ["systemctl", "restart", serviceName]));
    } catch {
      throw new AppError(apiModuleMessage(res.locals.locale, "serviceRestartFailed").replace("{service}", () => serviceName), 500, "SERVICE_RESTART_FAILED");
    }

    await authService.logAudit(
      "admin_restart_service",
      user?.userId ?? null,
      "medium",
      {
        ip: extractIp(req),
        userAgent: req.headers["user-agent"] || "",
      },
      { service: serviceName },
    );

    log.info({ user: user?.username, service: serviceName }, "Service restarted");
    res.json({ ok: true, message: apiModuleMessage(res.locals.locale, "serviceRestarted").replace("{service}", () => serviceName) });
  }),

  /** GET /api/admin/tools/audit-log — recent audit log. */
  auditLog: asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(String(req.query.limit || "50"), 10);
    const entries = await auditRepository.findRecent(Math.min(limit, 200));
    res.json({ ok: true, data: entries });
  }),

  /** GET /api/admin/tools/dns-check/:domain — check DNS records. */
  dnsCheck: asyncHandler(async (req: Request, res: Response) => {
    const domain = String(req.params.domain);
    // Strict hostname allowlist: labels of [A-Za-z0-9-], dot-separated, no
    // leading/trailing hyphen. Rejects shell metacharacters outright — combined
    // with execFile/argv below there is no shell to inject into.
    // T-04: the label grammar is the canonical `domainSchema`; the extra FQDN
    // refinement (alphabetic TLD, at least two labels) stays local because only
    // this endpoint needs it.
    if (!dnsCheckDomainSchema.safeParse(domain).success) {
      throw new ValidationError("Invalid domain");
    }

    // Resolve DNS FROM the connected server, not the panel host — the result is
    // per-server (split-horizon/local resolvers differ) and the hard rule is
    // that no module runs commands on the panel host. Only the `local` target
    // keeps the in-process execFile path.
    const executor = getExecutor(req);
    const isLocal = executor.target.id === "local";

    const dig = async (args: string[]): Promise<string> => {
      if (isLocal) {
        // Async execFile (no shell, no event-loop block) — the sync variant
        // froze the backend for up to 10 s × 7 records per request.
        const { stdout } = await execFileAsync("dig", ["+short", ...args], {
          encoding: "utf-8",
          timeout: 10000,
        });
        return stdout.trim();
      }
      // argv-quoted (no shell); domain already passed the strict allowlist and
      // the record types come from the fixed list below.
      const r = await executor.exec(quoteCmd("dig", ["+short", ...args]), { timeoutMs: 10000 });
      return r.stdout.trim();
    };

    const recordTypes = ["MX", "A", "AAAA", "TXT", "SPF", "DKIM", "DMARC"] as const;

    const resolveOne = async (type: (typeof recordTypes)[number]): Promise<string | null> => {
      try {
        if (type === "SPF") {
          // Was `dig +short TXT <domain> | grep -i spf` — filter in JS.
          const out = await dig(["TXT", domain]);
          return out.split("\n").filter((l) => /spf/i.test(l)).join("\n").trim() || null;
        }
        if (type === "DKIM") return (await dig(["TXT", `default._domainkey.${domain}`])) || null;
        if (type === "DMARC") return (await dig(["TXT", `_dmarc.${domain}`])) || null;
        return (await dig([type, domain])) || null;
      } catch {
        return null;
      }
    };

    // Run all record lookups concurrently — worst case is now ~1 timeout, not
    // the sum of 7 sequential round-trips.
    const results = await Promise.all(recordTypes.map(resolveOne));
    const checks: Record<string, string | null> = {};
    recordTypes.forEach((type, i) => {
      checks[type] = results[i] ?? null;
    });

    res.json({ ok: true, domain, data: checks });
  }),
};
