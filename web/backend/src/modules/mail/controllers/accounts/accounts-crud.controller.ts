import { guardHostingResourceMutation } from "../../../../shared/quota/resource-creation-lock.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Accounts controller — CRUD for mail accounts (list/domains/create/update/
 * delete). The heavy reads (usage/quota/forwards), desired-state application,
 * request schemas and the list-row shape live in sibling modules under
 * `./`; this file wires them into the HTTP handlers.
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../../shared/types/index.js";
import { getExecutor, type Executor } from "../../../../shared/executor/index.js";
import { domainsService } from "../../../nginx/services/domains.service.js";
import { dovecotService } from "../../services/index.js";
import { NotFoundError, ConflictError, ForbiddenError } from "../../../../shared/errors/index.js";
import { getContextUser } from "../../../../shared/executor/context.js";
import {
  isHostingSession,
  getTenantEnvelope,
  isTenantMailAddress,
  assertWithinEmailQuota,
} from "../../../../shared/tenant/tenant-scope.js";
import { tenantResourcesService } from "../../../../shared/tenant/tenant-resources.service.js";
import { recordActivity } from "../../../../shared/worklog/worklog-recorder.service.js";
import { eventBus, Events } from "../../../../shared/events/index.js";
import { createModuleLogger } from "../../../../shared/logger/index.js";
import { readAccountsFromServer, fnv1aId } from "../accounts.helpers.js";
import { mailboxCredentialService } from "../../services/mailbox-credential.service.js";
import { accountSidecarService } from "../../services/account-sidecar.service.js";
import { mailCryptoService } from "../../services/mail-crypto.service.js";
import { hasStoredSudoPassword } from "../../../../shared/system/index.js";
import { serveCachedDataTable } from "../../../../shared/remote-cache/serve-cached-datatable.js";
import { CACHE_KEYS } from "../../../../shared/cache/cacheable-modules.js";
import { normalize } from "./accounts.util.js";
import {
  createAccountSchema,
  updateAccountSchema,
  listAccountsQuerySchema,
  resolveAddressFromCreateBody,
} from "./accounts-schemas.js";
import { getAllMailboxUsageMap, getDiskTotalMb } from "./accounts-usage.helpers.js";
import { applyAccountState, renameMaildirIfNeeded, toSidecarSettings } from "./accounts-state.js";
import { buildAccountItemsLive, type MailAccountListItem } from "./accounts-list.js";
import { visibleMailDomains } from "../_shared/mail-access.js";

const log = createModuleLogger("accounts-ctrl");

/**
 * Tenant scoping for update/remove (audit §5): `create` gates hosting sessions
 * to their own domains, but `update`/`remove` resolved purely by `fnv1aId` and
 * the write-behind worker applies with root WITHOUT re-checking — so a hosting
 * tenant with the `mail` module could rename/reset/delete ANY mailbox on the
 * box by guessing its id. Admin/standalone sessions bypass (denylist).
 */
async function assertTenantOwnsAddress(executor: Executor, address: string): Promise<void> {
  const ctx = getContextUser();
  if (!isHostingSession(ctx)) return;
  const env = getTenantEnvelope(ctx!);
  const tenantDomains = await tenantResourcesService.tenantDomainSet(env, executor);
  if (!isTenantMailAddress(tenantDomains, address)) {
    throw new ForbiddenError("Esta cuenta de correo está fuera de tu cuenta.");
  }
}

export const accountsController = {
  /** GET /api/accounts — list accounts. Cache-first: the engine on the
   *  customer's server precomputes the full items[] (postfix vmailbox +
   *  dovecot users + forwards sidecar + maildir quota + doveadm usage) so
   *  the panel just reads a single Redis key. The live builder below is
   *  kept as the cold-miss / fallback path with the SAME output shape. */
  list: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const q = listAccountsQuerySchema.parse(req.query);
    // Explicit false is a lightweight list read. Usage/disk statistics can
    // arrive separately; other callers retain the existing default behaviour.
    const includeUsage = q.catalog !== "1" && q.includeUsage !== false;
    let liveUsage: Awaited<ReturnType<typeof getAllMailboxUsageMap>> | undefined;
    const hasListQuery = ["page", "limit", "search", "domain", "enabled", "includeUsage", "sortBy"].some((key) => req.query[key] !== undefined);

    // Cache is canonical: the engine's cached rows already carry usedMb /
    // usedPercent (collector-mail.py runs `doveadm quota get -A` + maildir
    // size walk on every tick), so `includeUsage=true` from the client no
    // longer needs to force a live SSH read. Cache hit ≈ tens of ms vs ~5 s
    // for the live builder; only cold-miss falls through to buildAccountItemsLive.
    const cached = await serveCachedDataTable<MailAccountListItem>({
      executor,
      module: CACHE_KEYS.mail.accounts.module,
      collection: CACHE_KEYS.mail.accounts.collection,
      liveLoader: () => buildAccountItemsLive(executor, includeUsage, (usage) => { liveUsage = usage; }),
    });

    // Tenant scoping (audit §5): a hosting session must only ever SEE its own
    // mailboxes; the cache holds every mailbox on the box. Admin/standalone
    // sessions bypass. Applied before search/pagination so totals are correct.
    let rows = cached.rows;
    const listCtx = getContextUser();
    if (isHostingSession(listCtx)) {
      const env = getTenantEnvelope(listCtx!);
      const tenantDomains = await tenantResourcesService.tenantDomainSet(env, executor);
      rows = rows.filter((a) => isTenantMailAddress(tenantDomains, a.address));
    }

    // Pickers request the minimal catalog only when opened, within the same tenant scope.
    if (q.catalog === "1") {
      res.json({ ok: true, data: rows.map(({ id, address, domain }) => ({ id, address, domain })) });
      return;
    }

    // Filter + paginate the items (cheap, in-memory).
    const search = q.search && q.search.length > 0 ? q.search.toLowerCase() : undefined;
    const domain = q.domain && q.domain.length > 0 ? normalize(q.domain) : undefined;
    const filtered = rows.filter((a) => {
      if (search) {
        if (!a.address.toLowerCase().includes(search) && !a.domain.toLowerCase().includes(search)) return false;
      }
      if (domain && normalize(a.domain) !== domain) return false;
      if (typeof q.enabled === "boolean" && a.enabled !== q.enabled) return false;
      return true;
    });
    if (q.sortBy) {
      const key = q.sortBy;
      const direction = q.sortDir === "desc" ? -1 : 1;
      filtered.sort((a, b) => direction * (typeof a[key] === "number" && typeof b[key] === "number"
        ? Number(a[key]) - Number(b[key]) : String(a[key] ?? "").localeCompare(String(b[key] ?? ""))) || a.address.localeCompare(b.address));
    }
    const summary = {
      total: rows.length,
      domains: [...new Set(rows.map(a => a.domain))].sort(),
      usedMb: rows.reduce((sum, a) => sum + Math.max(0, a.usedMb ?? 0), 0),
      quotaMb: rows.reduce((sum, a) => sum + Math.max(0, a.quotaMb ?? 0), 0),
      hasUnlimited: rows.some(a => !a.quotaMb),
    };
    const total = filtered.length;
    const items = hasListQuery
      ? filtered.slice((q.page - 1) * q.limit, (q.page - 1) * q.limit + q.limit)
      : filtered;

    if (!hasListQuery) {
      res.json({ ok: true, data: items });
      return;
    }

    // Pagination metadata. `diskTotalMb` backs the storage card (used / total
    // server disk); it lives OUTSIDE the cached rows, so it must be fetched
    // here even on a cache hit — otherwise the card has no denominator and
    // falls back to rendering "… / Ilimitado". It's one cheap `df` (no sudo)
    // and the client only reads it from page 1, so guard it there. The
    // per-mailbox usage probe stays cold-miss-only (on a cache hit usedMb is
    // already in each row, and the probe is the expensive ~5s call).
    let sudoRequired = false;
    let diskTotalMb: number | null = null;
    if (includeUsage && q.page === 1) {
      diskTotalMb = await getDiskTotalMb(executor);
    }
    if (includeUsage && !cached.fromCache) {
      const probe = liveUsage ?? await getAllMailboxUsageMap(executor, items.map((it) => it.address));
      sudoRequired =
        !probe.available &&
        probe.reason === "sudo_password_required" &&
        !(await hasStoredSudoPassword(executor));
    }

    res.json({
      ok: true,
      data: {
        items,
        summary,
        total,
        page: q.page,
        pageSize: q.limit,
        totalPages: Math.ceil(total / q.limit),
        sudoRequired,
        diskTotalMb,
      },
    });
  }),

  /** GET /api/accounts/domains — list selectable domains from DNS module. */
  listDomains: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const domains = await domainsService.list(executor);
    const visible = await visibleMailDomains();
    const names = [...new Set(
      domains
        .map((d) => normalize(d.name))
        .filter((name) => name.length > 0 && (!visible || visible.has(name))),
    )].sort((a, b) => a.localeCompare(b));
    res.json({ ok: true, data: names });
  }),

  /** POST /api/accounts — create a new account (server-only, no DB). */
  create: asyncHandler(guardHostingResourceMutation("emails", async (req: Request, res: Response) => {
    const body = createAccountSchema.parse(req.body);
    const executor = getExecutor(req);
    const { address, domain } = resolveAddressFromCreateBody(body);

    const availableDomains = await domainsService.list(executor);
    if (!availableDomains.some((d) => normalize(d.name) === domain)) {
      throw new ConflictError(`Domain "${domain}" is not registered in DNS module`);
    }

    const serverAccounts = await readAccountsFromServer(executor);
    if (serverAccounts.some((a) => a.address === address)) {
      throw new ConflictError(`Account ${address} already exists`);
    }

    // Fase 6 — ADITIVE tenant gate: only domains the tenant owns, and only up
    // to maxEmailAccounts mailboxes within those domains. Admin sessions skip.
    const ctx = getContextUser();
    const hosting = isHostingSession(ctx);
    if (hosting) {
      const env = getTenantEnvelope(ctx!);
      const tenantDomains = await tenantResourcesService.tenantDomainSet(env, executor);
      if (!tenantDomains.has(domain.toLowerCase())) {
        throw new ForbiddenError("No puedes crear correo en un dominio fuera de tu cuenta.");
      }
      const tenantCount = serverAccounts.filter((a) => isTenantMailAddress(tenantDomains, a.address)).length;
      assertWithinEmailQuota(env, tenantCount);
    }

    const passwordHash = await dovecotService.hashPasswordWithExecutor(body.password, executor);

    const next = [
      ...serverAccounts,
      {
        address,
        domain,
        // Keep the real hash; buildDovecotEntries encodes the disabled state.
        passwordHash,
        quotaMb: body.quotaMb,
        enabled: body.enabled,
        incomingMode: body.incomingMode,
        outgoingMode: body.outgoingMode,
        loginMode: body.loginMode,
        plusAddressingAutoFolder: body.plusAddressingAutoFolder,
        hasExplicitSettings: true,
      },
    ];
    const job = await applyAccountState(executor, next, "create", [address]);
    await accountSidecarService.update(executor, address, (current) => ({
      ...current,
      settings: toSidecarSettings(next[next.length - 1]!),
    }));

    // Capture the plaintext once (encrypted) so IMAP/SMTP (inbox, compose,
    // actions) can authenticate later — Dovecot only keeps a one-way hash.
    // Best-effort: the account already exists in Postfix/Dovecot at this point,
    // so a credential-store hiccup must not fail the request (the inbox will
    // just prompt for the password later).
    try {
      await mailboxCredentialService.setPassword(address, body.password, executor);
    } catch (err) {
      log.warn({ err, address, target: executor.target.id }, "Could not store mailbox credential (account created anyway)");
    }

    log.info({ address, target: executor.target.id }, "Account created");
    eventBus.emit(Events.ACCOUNT_CREATED, { accountId: fnv1aId(address), address });
    if (hosting) {
      const env = getTenantEnvelope(ctx!);
      void recordActivity({
        module: "mail",
        action: "create_mail_account",
        category: "mail",
        detail: `${address} (cupo ${env.maxEmailAccounts})`,
        linuxUsername: env.owner,
      });
    }
    res.status(201).json({ ok: true, data: { id: fnv1aId(address), address, job } });
  })),

  /** PUT /api/accounts/:id — update an account (server-only, no DB). */
  update: asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const body = updateAccountSchema.parse(req.body);
    const executor = getExecutor(req);

    const serverAccounts = await readAccountsFromServer(executor);
    const account = serverAccounts.find((a) => fnv1aId(a.address) === id);
    if (!account) throw new NotFoundError("Account");
    await assertTenantOwnsAddress(executor, account.address);

    let nextAddress = account.address;
    if (body.localPart !== undefined) {
      const localPart = normalize(body.localPart);
      nextAddress = `${localPart}@${account.domain}`;
      if (nextAddress !== account.address && serverAccounts.some((a) => a.address === nextAddress)) {
        throw new ConflictError(`Account ${nextAddress} already exists`);
      }
    }

    let nextPasswordHash = account.passwordHash;
    if (body.password) {
      nextPasswordHash = await dovecotService.hashPasswordWithExecutor(body.password, executor);
    }
    if (body.enabled === true && nextPasswordHash === "!" && !body.password) {
      const encrypted = await mailboxCredentialService.getEncrypted(fnv1aId(account.address), executor);
      if (!encrypted) {
        throw new ConflictError("La cuenta no tiene una contrasena recuperable. Define una nueva contrasena para volver a habilitarla.");
      }
      const plaintext = mailCryptoService.decrypt(encrypted);
      nextPasswordHash = await dovecotService.hashPasswordWithExecutor(plaintext, executor);
    }

    const nextEnabled = body.enabled ?? account.enabled;
    const nextQuota = body.quotaMb ?? account.quotaMb;
    const isPlainEnableToggle =
      body.enabled === true
      && body.incomingMode === undefined
      && body.outgoingMode === undefined
      && body.loginMode === undefined
      && body.plusAddressingAutoFolder === undefined;
    const nextIncomingMode = body.incomingMode
      ?? (isPlainEnableToggle || (body.enabled === true && !account.hasExplicitSettings) ? "allow" : account.incomingMode);
    const nextOutgoingMode = body.outgoingMode
      ?? (isPlainEnableToggle || (body.enabled === true && !account.hasExplicitSettings) ? "allow" : account.outgoingMode);
    const nextLoginMode = body.loginMode
      ?? (isPlainEnableToggle || (body.enabled === true && !account.hasExplicitSettings) ? "allow" : account.loginMode);
    const nextPlusAddressingAutoFolder = body.plusAddressingAutoFolder ?? account.plusAddressingAutoFolder;

    const next = serverAccounts.map((a) => {
      if (a.address !== account.address) return a;
      return {
        address: nextAddress,
        domain: nextAddress.split("@")[1] ?? a.domain,
        // Keep the real hash regardless of state; buildDovecotEntries encodes
        // the disabled marker. On re-enable, nextPasswordHash carries the
        // preserved hash (read back decoded), so login is restored without a
        // password reset.
        passwordHash: nextPasswordHash,
        quotaMb: nextQuota,
        enabled: nextEnabled,
        incomingMode: nextIncomingMode,
        outgoingMode: nextOutgoingMode,
        loginMode: nextLoginMode,
        plusAddressingAutoFolder: nextPlusAddressingAutoFolder,
        hasExplicitSettings: true,
      };
    });

    if (nextAddress !== account.address) {
      await renameMaildirIfNeeded(executor, account.address, nextAddress);
    }
    const job = await applyAccountState(executor, next, "update", [nextAddress]);
    await accountSidecarService.update(executor, nextAddress, (current) => ({
      ...current,
      settings: {
        incomingMode: nextIncomingMode,
        outgoingMode: nextOutgoingMode,
        loginMode: nextLoginMode,
        plusAddressingAutoFolder: nextPlusAddressingAutoFolder,
      },
    }));

    // Keep the stored IMAP/SMTP credential in sync: capture a new password,
    // and follow the account on rename so the inbox keeps authenticating.
    // Best-effort — the account state was already applied above.
    try {
      if (body.password) {
        await mailboxCredentialService.setPassword(nextAddress, body.password, executor);
      } else if (nextAddress !== account.address) {
        await mailboxCredentialService.rekey(fnv1aId(account.address), nextAddress, executor);
      }
    } catch (err) {
      log.warn({ err, address: nextAddress, target: executor.target.id }, "Could not sync mailbox credential (account updated anyway)");
    }

    eventBus.emit(Events.ACCOUNT_UPDATED, { accountId: fnv1aId(nextAddress) });
    res.json({ ok: true, job });
  }),

  /** DELETE /api/accounts/:id — delete an account (server-only, no DB). */
  remove: asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const executor = getExecutor(req);

    const serverAccounts = await readAccountsFromServer(executor);
    const account = serverAccounts.find((a) => fnv1aId(a.address) === id);
    if (!account) throw new NotFoundError("Account");
    await assertTenantOwnsAddress(executor, account.address);

    const next = serverAccounts.filter((a) => a.address !== account.address);
    const job = await applyAccountState(executor, next, "delete", []);
    await mailboxCredentialService.remove(id, executor);

    eventBus.emit(Events.ACCOUNT_DELETED, { accountId: id, address: account.address });
    log.info({ address: account.address, target: executor.target.id }, "Account deleted");
    res.json({ ok: true, job });
  }),
};

