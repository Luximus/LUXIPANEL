// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Passkey device types — WebAuthn credentials for passwordless auth.
 */

export interface Passkey {
  id: string;
  userId: number;
  label: string;
  credentialId: string;
  publicKeyB64url: string;
  counter: number;
  transports: string[] | null;
  platform: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface NewPasskey {
  id: string;
  userId: number;
  label: string;
  credentialId: string;
  publicKeyB64url: string;
  counter?: number;
  transports?: string[] | null;
  platform?: string | null;
  createdAt?: Date;
  lastUsedAt?: Date | null;
  revokedAt?: Date | null;
}
