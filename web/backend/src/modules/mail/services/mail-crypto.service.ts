// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Mail crypto service — AES-256-GCM encryption/decryption
 * for IMAP/SMTP passwords stored in the database.
 */

import { encrypt, decrypt } from "../../../shared/utils/crypto.js";
import { mailConfig } from "../../../config/mail.js";
import { AppError } from "../../../shared/errors/errors.js";

const HEX_64_RE = /^[a-fA-F0-9]{64}$/;
const ENCRYPTED_TOKEN_RE = /^[a-fA-F0-9]+:[a-fA-F0-9]+:[a-fA-F0-9]+$/;

/** Return the configured encryption key, throwing if missing or malformed. */
function requireValidKey(): string {
  if (!mailConfig.encryptionKey) {
    throw new AppError(
      "MAIL_ENCRYPTION_KEY is not configured. Configure it in backend environment variables.",
      503,
      "MAIL_ENCRYPTION_KEY_MISSING",
    );
  }
  if (!HEX_64_RE.test(mailConfig.encryptionKey)) {
    throw new AppError(
      "MAIL_ENCRYPTION_KEY has invalid format. Expected 64 hex characters.",
      500,
      "MAIL_ENCRYPTION_KEY_INVALID",
    );
  }
  return mailConfig.encryptionKey;
}

export const mailCryptoService = {
  encrypt(plainPassword: string): string {
    const key = requireValidKey();
    return encrypt(plainPassword, key);
  },

  decrypt(encryptedPassword: string): string {
    const key = requireValidKey();
    if (!ENCRYPTED_TOKEN_RE.test(encryptedPassword)) {
      throw new AppError(
        "Stored mail credential is not recoverable. Set a new mailbox password from panel/mail.",
        409,
        "MAIL_CREDENTIAL_UNRECOVERABLE",
      );
    }
    try {
      return decrypt(encryptedPassword, key);
    } catch {
      throw new AppError(
        "Stored mail credential could not be decrypted with current MAIL_ENCRYPTION_KEY. Set a new mailbox password from panel/mail.",
        409,
        "MAIL_CREDENTIAL_DECRYPT_FAILED",
      );
    }
  },
};
