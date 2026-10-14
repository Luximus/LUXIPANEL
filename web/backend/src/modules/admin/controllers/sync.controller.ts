// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Sync controller — full regeneration of service configuration files.
 *
 * These endpoints rebuild Dovecot/Postfix config from the database and
 * reload the respective services. Useful after bulk imports or manual DB edits.
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { dovecotService } from "../../mail/services/dovecot.service.js";
import { postfixService } from "../../mail/services/postfix.service.js";
import { sieveService } from "../../mail/services/sieve.service.js";
import { accountRepository } from "../../mail/repositories/account.repository.js";
import { forwardRepository } from "../../mail/repositories/forward.repository.js";
import { getExecutor, type Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { buildDovecotEntries, buildMailboxMap } from "../account-policy.js";

const log = createModuleLogger("sync-ctrl");

type MailAccount = Awaited<ReturnType<typeof accountRepository.findAll>>[number];

/** Rebuild every account's Sieve forward script from its active forwards. */
async function rebuildSieve(accounts: MailAccount[], executor: Executor): Promise<number> {
  // Read ALL forwards once and group by account in memory, instead of a full
  // sidecar read per account (`findByAccountId` in a loop = O(accounts) reads).
  const allForwards = await forwardRepository.findAll(executor);
  const destinationsByAccount = new Map<number, string[]>();
  for (const f of allForwards) {
    if (!f.enabled) continue;
    const list = destinationsByAccount.get(f.accountId);
    if (list) list.push(f.destination);
    else destinationsByAccount.set(f.accountId, [f.destination]);
  }

  let rebuilt = 0;
  for (const acc of accounts) {
    const activeDestinations = destinationsByAccount.get(acc.id) ?? [];
    await sieveService.writeAccountFiltersAndForwardsWithExecutor(
      acc.address,
      activeDestinations,
      false,
      [],
      executor,
    );
    rebuilt++;
  }
  return rebuilt;
}

export const syncController = {
  /**
   * POST /api/admin/sync/dovecot
   * Rebuild /etc/dovecot/users from all active mail accounts + reload Dovecot.
   */
  syncDovecot: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const accounts = await accountRepository.findAll();

    const entries = buildDovecotEntries(accounts);

    await dovecotService.regenerateUsersFileWithExecutor(entries, executor);
    await dovecotService.reloadWithExecutor(executor);

    log.info({ count: entries.length, target: executor.target.id }, "Dovecot sync completed");
    res.json({ ok: true, synced: entries.length });
  }),

  /**
   * POST /api/admin/sync/postfix
   * Rebuild Postfix virtual_mailbox_maps and virtual_domains + reload.
   */
  syncPostfix: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const accounts = await accountRepository.findAll();
    const domains = await accountRepository.getDomains();

    await postfixService.regenerateMailboxMapWithExecutor(buildMailboxMap(accounts), executor);
    await postfixService.regenerateDomainMapWithExecutor(domains, executor);
    await postfixService.reloadWithExecutor(executor);

    log.info({ accounts: accounts.length, domains: domains.length, target: executor.target.id }, "Postfix sync completed");
    res.json({ ok: true, accounts: accounts.length, domains: domains.length });
  }),

  /**
   * POST /api/admin/sync/sieve
   * Rebuild Sieve forward scripts for all accounts that have active forwards.
   */
  syncSieve: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const accounts = await accountRepository.findAll();
    const rebuilt = await rebuildSieve(accounts, executor);

    log.info({ rebuilt, target: executor.target.id }, "Sieve sync completed");
    res.json({ ok: true, rebuilt });
  }),

  /**
   * POST /api/admin/sync/all
   * Run all sync operations in sequence: Dovecot → Postfix → Sieve.
   */
  syncAll: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const accounts = await accountRepository.findAll();
    const domains = await accountRepository.getDomains();

    // Dovecot
    const dovecotEntries = buildDovecotEntries(accounts);
    await dovecotService.regenerateUsersFileWithExecutor(dovecotEntries, executor);
    await dovecotService.reloadWithExecutor(executor);

    // Postfix
    await postfixService.regenerateMailboxMapWithExecutor(buildMailboxMap(accounts), executor);
    await postfixService.regenerateDomainMapWithExecutor(domains, executor);
    await postfixService.reloadWithExecutor(executor);

    // Sieve
    const sieveRebuilt = await rebuildSieve(accounts, executor);

    log.info(
      { accounts: accounts.length, domains: domains.length, sieveRebuilt, target: executor.target.id },
      "Full sync completed",
    );

    res.json({
      ok: true,
      data: {
        dovecot: { synced: dovecotEntries.length },
        postfix: { accounts: accounts.length, domains: domains.length },
        sieve: { rebuilt: sieveRebuilt },
      },
    });
  }),
};
