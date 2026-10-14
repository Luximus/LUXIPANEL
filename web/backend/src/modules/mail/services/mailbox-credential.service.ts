// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Mailbox credential service — stores the per-account IMAP/SMTP password,
 * encrypted at rest (AES-256-GCM via mailCryptoService / MAIL_ENCRYPTION_KEY).
 *
 * WHY this exists: accounts are canonical in Postfix/Dovecot (no DB), but
 * Dovecot only keeps a one-way password HASH — it cannot be read back to
 * authenticate IMAP/SMTP on the user's behalf. So when the panel creates an
 * account or the user changes the mailbox password, we capture the plaintext
 * once and persist it ENCRYPTED here. The ciphertext is useless without
 * MAIL_ENCRYPTION_KEY (which lives only on the panel host, not the target).
 *
 * Stored on the connected target via dataStore at
 * `${LUXIPANEL_CONFIG_DIR}/mail/credentials.json`, keyed by `fnv1aId(address)`
 * (the same id the rest of the module uses). NOT in the cache allowlist, so it
 * is never projected into Redis / DataTable views.
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import { fnv1aId } from "../controllers/accounts.helpers.js";
import { mailCryptoService } from "./mail-crypto.service.js";

interface StoredCredential {
  id: number;
  address: string;
  passwordEncrypted: string;
}

const store = makeKvStore<StoredCredential>({ module: "mail", collection: "credentials" });

export const mailboxCredentialService = {
  /** Encrypted password for an account id, or null if none was ever stored. */
  async getEncrypted(accountId: number, executor?: Executor | null): Promise<string | null> {
    const doc = await store(executor).get(accountId);
    return doc?.passwordEncrypted || null;
  },

  /** Capture (encrypt + persist) the plaintext password for an address. */
  async setPassword(address: string, plaintext: string, executor?: Executor | null): Promise<void> {
    const normalized = address.trim().toLowerCase();
    const id = fnv1aId(normalized);
    const passwordEncrypted = mailCryptoService.encrypt(plaintext);
    await store(executor).set(id, { id, address: normalized, passwordEncrypted });
  },

  /**
   * Move an existing encrypted credential to a new address (on rename). No-op
   * if there was none. Keeps the ciphertext as-is (no plaintext needed).
   */
  async rekey(oldAccountId: number, newAddress: string, executor?: Executor | null): Promise<void> {
    const doc = await store(executor).get(oldAccountId);
    if (!doc?.passwordEncrypted) return;
    const normalized = newAddress.trim().toLowerCase();
    const id = fnv1aId(normalized);
    if (id === oldAccountId) return;
    await store(executor).set(id, { id, address: normalized, passwordEncrypted: doc.passwordEncrypted });
    await this.remove(oldAccountId, executor);
  },

  /** Drop the stored credential (on account delete). Best-effort. */
  async remove(accountId: number, executor?: Executor | null): Promise<void> {
    try {
      await store(executor).delete(accountId);
    } catch {
      /* best-effort cleanup */
    }
  },
};
