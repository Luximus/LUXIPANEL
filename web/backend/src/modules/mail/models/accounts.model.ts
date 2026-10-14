// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Mail account types — email account configurations.
 */

export interface Account {
  id: number;
  address: string;
  domain: string;
  /** Encrypted IMAP/SMTP password (AES-256-GCM). */
  passwordEncrypted: string;
  /** Dovecot-format password hash for authentication. */
  passwordHash: string;
  displayName: string | null;
  quotaMb: number;
  enabled: boolean;
  incomingMode: string;
  outgoingMode: string;
  loginMode: string;
  plusAddressingAutoFolder: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewAccount {
  id?: number;
  address: string;
  domain: string;
  /** Encrypted IMAP/SMTP password (AES-256-GCM). */
  passwordEncrypted: string;
  /** Dovecot-format password hash for authentication. */
  passwordHash: string;
  displayName?: string | null;
  quotaMb?: number;
  enabled?: boolean;
  incomingMode?: string;
  outgoingMode?: string;
  loginMode?: string;
  plusAddressingAutoFolder?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
