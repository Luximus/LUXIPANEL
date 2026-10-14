// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Firewall status controller — UFW global status + Fail2ban jails.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { ufwService } from "../services/ufw.service.js";
import { fail2banService } from "../services/fail2ban.service.js";
import { SUDO_PASSWORD_REQUIRED, SUDO_PASSWORD_INVALID } from "../../../shared/system/index.js";

// jail = fail2ban jail name (alnum + _.-); ip = IPv4/IPv6, optional CIDR suffix.
const banSchema = z.object({
  jail: z.string().min(1).max(64).regex(/^[A-Za-z0-9_.-]+$/, "Invalid jail name"),
  ip: z.string().min(2).max(45).regex(/^[0-9a-fA-F:.]+(\/\d{1,3})?$/, "Invalid IP/CIDR"),
});

// Validate the install body (audit §5): it carries a cleartext `sudoPassword`,
// so parse it explicitly rather than casting `req.body` and reject unexpected
// shapes / oversized payloads.
const installSchema = z.object({
  ufw: z.boolean().optional(),
  fail2ban: z.boolean().optional(),
  sudoPassword: z.string().max(512).optional(),
});

export const statusController = {
  /** GET /api/firewall/status — full UFW + Fail2ban overview. */
  overview: asyncHandler(async (_req: Request, res: Response) => {
    const executor = getExecutor(_req);
    const [ufwInstalled, fail2banInstalled] = await Promise.all([
      ufwService.isInstalledWithExecutor(executor),
      fail2banService.isInstalledWithExecutor(executor),
    ]);

    const [ufw, jails] = await Promise.all([
      ufwInstalled
        ? ufwService.getStatusWithExecutor(executor)
        : Promise.resolve({ active: false, logging: null, rules: [] }),
      fail2banInstalled
        ? fail2banService.getAllStatusesWithExecutor(executor)
        : Promise.resolve([]),
    ]);

    res.json({
      ok: true,
      data: {
        ufw: { ...ufw, installed: ufwInstalled },
        fail2ban: { jails, installed: fail2banInstalled },
      },
    });
  }),

  /** POST /api/firewall/install — install UFW and/or Fail2ban with defaults. */
  install: asyncHandler(async (req: Request, res: Response) => {
    const body = installSchema.parse(req.body);
    const executor = getExecutor(req);
    const installUfw = body.ufw !== false; // default true
    const installFail2ban = body.fail2ban !== false; // default true
    const sudoPassword = body.sudoPassword;

    // Install SEQUENTIALLY, never in parallel: each runs `apt-get update &&
    // apt-get install`, and two concurrent apt processes collide on
    // /var/lib/apt/lists/lock ("Could not get lock ... held by process N").
    const ufwResult = installUfw
      ? await ufwService.installWithExecutor(executor, { sudoPassword })
      : null;
    // If UFW already failed needing a sudo password, don't fire a second apt
    // run that will just fail the same way — surface the prompt first.
    const ufwNeedsSudo =
      ufwResult?.code === SUDO_PASSWORD_REQUIRED || ufwResult?.code === SUDO_PASSWORD_INVALID;
    const fail2banResult = installFail2ban && !ufwNeedsSudo
      ? await fail2banService.installWithExecutor(executor, { sudoPassword })
      : null;

    // Once UFW is installed, bring it up SECURELY: stage SSH/HTTP/HTTPS allow
    // rules + deny-in/allow-out and then enable. Skipped if UFW wasn't (or
    // couldn't be) installed, so we never enable a firewall the package
    // manager just failed to provide. Best-effort: a baseline error must not
    // mask the install result the sudo-prompt modal depends on.
    let baselineApplied = false;
    if (installUfw && ufwResult?.ok) {
      try {
        await ufwService.secureBaselineWithExecutor(executor);
        baselineApplied = true;
      } catch {
        baselineApplied = false;
      }
    }

    const ok = (!installUfw || !!ufwResult?.ok) && (!installFail2ban || !!fail2banResult?.ok);
    // Surface SUDO_PASSWORD_REQUIRED / SUDO_PASSWORD_INVALID and a combined
    // log INSIDE `data` so the shared install-modal/`withSudo` helper (which
    // reads `data.code` / `data.output`) drives the prompt and the live log.
    const code = ufwResult?.code ?? fail2banResult?.code;
    const output = [ufwResult?.output, fail2banResult?.output].filter(Boolean).join("\n\n");
    res.json({ ok, code, data: { ufw: ufwResult, fail2ban: fail2banResult, code, output, baselineApplied } });
  }),

  /**
   * POST /api/firewall/enable — enable UFW *securely*.
   *
   * Never a bare `ufw enable`: that would come up with `default deny incoming`
   * and no allow rules, black-holing the panel's 80/443 (Cloudflare 522) and
   * potentially locking out SSH. We always stage the safe baseline (deny in /
   * allow out + SSH/HTTP/HTTPS) first, then enable. Idempotent.
   */
  enable: asyncHandler(async (_req: Request, res: Response) => {
    await ufwService.secureBaselineWithExecutor(getExecutor(_req));
    res.json({ ok: true });
  }),

  /** POST /api/firewall/disable — disable UFW. */
  disable: asyncHandler(async (_req: Request, res: Response) => {
    await ufwService.disableWithExecutor(getExecutor(_req));
    res.json({ ok: true });
  }),

  logging: asyncHandler(async (req: Request, res: Response) => {
    const { level } = z.object({ level: z.enum(["off", "low", "medium", "high", "full"]) }).parse(req.body);
    await ufwService.setLoggingWithExecutor(getExecutor(req), level);
    res.json({ ok: true, data: { level } });
  }),

  /** GET /api/firewall/fail2ban/jails — list all Fail2ban jails with status. */
  jails: asyncHandler(async (_req: Request, res: Response) => {
    const jails = await fail2banService.getAllStatusesWithExecutor(getExecutor(_req));
    res.json({ ok: true, data: jails });
  }),

  /** POST /api/firewall/fail2ban/unban — unban an IP from a jail. */
  unban: asyncHandler(async (req: Request, res: Response) => {
    const { jail, ip } = banSchema.parse(req.body);
    await fail2banService.unbanWithExecutor(jail, ip, getExecutor(req));
    res.json({ ok: true });
  }),

  /** POST /api/firewall/fail2ban/ban — ban an IP in a jail. */
  ban: asyncHandler(async (req: Request, res: Response) => {
    const { jail, ip } = banSchema.parse(req.body);
    await fail2banService.banWithExecutor(jail, ip, getExecutor(req));
    res.json({ ok: true });
  }),
};
