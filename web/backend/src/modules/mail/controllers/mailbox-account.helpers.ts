// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Resolve a mail account for IMAP/SMTP-facing controllers.
 *
 * Accounts are canonical in Postfix/Dovecot (read via readAccountsFromServer),
 * NOT in a `mail/accounts.json` dataStore (which is never written in the
 * server-file model). The previous code resolved via `accountRepository.findById`,
 * which always missed → every mailbox/contacts/calendars/compose call 404'd.
 * Here we match the server account by `fnv1aId(address)` and pair it with the
 * stored encrypted password (captured at create / password-change).
 */

import type { Request } from "express";
import { ForbiddenError, NotFoundError } from "../../../shared/errors/index.js";
import { emailSchema } from "../../../shared/validators/index.js";
import { getContextExecutor, requireExecutor, type Executor } from "../../../shared/executor/index.js";
import { getContextUser } from "../../../shared/executor/context.js";
import {
  isHostingSession,
  getTenantEnvelope,
  isTenantMailAddress,
} from "../../../shared/tenant/tenant-scope.js";
import { tenantResourcesService } from "../../../shared/tenant/tenant-resources.service.js";
import { mailboxCredentialService } from "../services/mailbox-credential.service.js";
import { fnv1aId, readAccountsFromServer } from "./accounts.helpers.js";

export interface ResolvedMailAccount {
  id: number;
  address: string;
  domain: string;
  displayName: string | null;
  enabled: boolean;
  incomingMode: "allow" | "suspend";
  outgoingMode: "allow" | "suspend" | "hold";
  loginMode: "allow" | "suspend";
  quotaMb: number;
  /** Encrypted IMAP/SMTP password, or null when none was ever captured. */
  passwordEncrypted: string | null;
}

/** Resolve by id (fnv1aId of the address) from the server's account state. */
export async function resolveMailAccount(
  executor: Executor,
  accountId: number,
): Promise<ResolvedMailAccount | undefined> {
  const serverAccounts = await readAccountsFromServer(executor);
  const match = serverAccounts.find((a) => fnv1aId(a.address) === accountId);
  if (!match) return undefined;

  const passwordEncrypted = await mailboxCredentialService.getEncrypted(accountId, executor);
  return {
    id: accountId,
    address: match.address,
    domain: match.domain,
    displayName: null,
    enabled: match.enabled,
    incomingMode: match.incomingMode,
    outgoingMode: match.outgoingMode,
    loginMode: match.loginMode,
    quotaMb: match.quotaMb,
    passwordEncrypted,
  };
}

/**
 * Convenience for request handlers: resolve via the per-request context
 * executor (set by requireAuth, same source dataStore uses) and 404 if the
 * account isn't on the server. Replaces the old `accountRepository.findById`.
 */
export async function requireMailAccount(accountId: number): Promise<ResolvedMailAccount> {
  // Keeps ForbiddenError (403) on purpose — the canonical
  // `NoServerExecutorError` would turn this endpoint into a 503.
  const executor = requireExecutor(null, () => {
    throw new ForbiddenError("No active server connection");
  });
  const account = await resolveMailAccount(executor, accountId);
  if (!account) throw new NotFoundError("Account");
  return account;
}

/**
 * Tenant-aware variant used by mailbox/compose/actions/contacts/calendars
 * controllers. A hosting user MUST NOT read or mutate mailboxes outside their
 * tenant's domain set — even if they know the integer `fnv1aId(address)`. The
 * `isHostingSession` branch is a denylist: anything else (admin / standalone)
 * bypasses the check. Closes the audited cross-tenant leak.
 */
export async function requireOwnedMailAccount(
  accountId: number,
): Promise<ResolvedMailAccount> {
  const account = await requireMailAccount(accountId);
  const ctx = getContextUser();
  if (isHostingSession(ctx)) {
    const executor = getContextExecutor()!;
    const env = getTenantEnvelope(ctx!);
    const tenantDomains = await tenantResourcesService.tenantDomainSet(env, executor);
    if (!isTenantMailAddress(tenantDomains, account.address)) {
      throw new ForbiddenError(
        "Mailbox is outside your tenant's domain allowlist",
      );
    }
  }
  return account;
}

/**
 * Resolve the account named by the `:accountId` route param, ENFORCING tenant
 * ownership and returning the canonical, server-sourced address.
 *
 * SECURITY (audit §5): the forwards/filters/autoresponder/signatures
 * controllers used to return `req.params.accountId` verbatim when it contained
 * "@". That raw value flowed into `path.join(vmail.base, domain, local)` and
 * `postfix/virtual` lines, enabling path traversal to arbitrary root-owned
 * writes and alias injection. Validating with `emailSchema` here rejects `/`,
 * control chars and `\r\n`; resolving through `requireOwnedMailAccount` adds
 * the same tenant scoping the mailbox/compose/actions paths already enforce and
 * guarantees the returned address is the one Postfix/Dovecot actually stores.
 */
export async function requireOwnedMailAccountFromParam(req: Request): Promise<ResolvedMailAccount> {
  const raw = String(req.params["accountId"] ?? "").trim();
  let accountId: number;
  if (raw.includes("@")) {
    // Throws ValidationError (400) on any non-conforming address.
    const address = emailSchema.parse(raw);
    accountId = fnv1aId(address);
  } else {
    accountId = Number.parseInt(raw, 10);
    if (!Number.isFinite(accountId)) throw new NotFoundError("Account");
  }
  return requireOwnedMailAccount(accountId);
}

/**
 * Shared by the forwards/filters/signatures/autoresponder controllers:
 * resolve the `:accountId` route param (int OR "@"-address) to its canonical,
 * tenant-owned mailbox address. Validates the address (emailSchema rejects `/`,
 * `\r\n`, `\t` and control chars) AND enforces tenant ownership before any
 * sidecar/sieve/postfix path is built from it. See requireOwnedMailAccountFromParam.
 */
export async function resolveOwnedAccountAddress(req: Request): Promise<string> {
  return (await requireOwnedMailAccountFromParam(req)).address;
}

/**
 * Shared by the calendars/contacts controllers: parse the integer `:accountId`
 * route param and resolve the tenant-owned account object.
 */
export async function resolveOwnedAccountByParamId(req: Request): Promise<ResolvedMailAccount> {
  const accountId = parseInt(String(req.params["accountId"]), 10);
  return requireOwnedMailAccount(accountId);
}

/**
 * Stored encrypted mailbox password, or `null` when none was ever captured.
 *
 * It used to throw 409 `MAIL_PASSWORD_NOT_SET` here; that decision now lives in
 * the transports (`withImap` / `smtpService.send`), which first try the panel's
 * Dovecot MASTER user (`mail-master.service`) and only need this password as a
 * fallback. They raise the same 409 (code + "mailbox password" wording the
 * inbox UI keys on) when neither login is available.
 */
export function requireStoredCredential(account: ResolvedMailAccount): string | null {
  return account.passwordEncrypted || null;
}
