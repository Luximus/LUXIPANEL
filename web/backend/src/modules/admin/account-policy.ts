// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Mail-account policy predicates + map builders used by the admin sync/tools
 * controllers when regenerating Dovecot/Postfix maps. A suspended mode
 * (incoming/login) disables that capability even while the account itself stays
 * enabled.
 *
 * Module-local on purpose: admin owns the full-regeneration endpoints; the mail
 * module is not touched here.
 */

/** Minimal account shape the regeneration paths read. */
interface MailAccountShape {
  address: string;
  domain: string;
  enabled: boolean;
  passwordHash: string;
  quotaMb: number;
  incomingMode?: string | null;
  loginMode?: string | null;
}

function canReceiveIncoming(account: { enabled: boolean; incomingMode?: string | null }): boolean {
  return account.enabled && account.incomingMode !== "suspend";
}

function canLogin(account: { enabled: boolean; loginMode?: string | null }): boolean {
  return account.enabled && account.loginMode !== "suspend";
}

/** Dovecot users-file entries; suspended-login accounts get the `"!"` deny hash. */
export function buildDovecotEntries(accounts: MailAccountShape[]) {
  return accounts.map((acc) => ({
    address: acc.address,
    passwordHash: canLogin(acc) ? acc.passwordHash : "!",
    quotaMb: acc.quotaMb,
  }));
}

/** Postfix virtual mailbox map: only accounts that can receive incoming mail. */
export function buildMailboxMap(accounts: MailAccountShape[]) {
  return accounts
    .filter((a) => canReceiveIncoming(a))
    .map((a) => ({ address: a.address, domain: a.domain }));
}
