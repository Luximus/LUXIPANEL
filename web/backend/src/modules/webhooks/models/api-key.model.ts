// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * API key types — long-lived tokens for programmatic access.
 */

export interface ApiKey {
  id: number;
  name: string;
  /** SHA-256 hash of the raw key — never store plaintext. */
  keyHash: string;
  /** First 8 chars of the raw key shown in the UI as a hint. */
  keyPrefix: string;
  /** Permitted modules/scopes, null = full access. */
  scopes: string[] | null;
  enabled: boolean;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export interface NewApiKey {
  id?: number;
  name: string;
  /** SHA-256 hash of the raw key — never store plaintext. */
  keyHash: string;
  /** First 8 chars of the raw key shown in the UI as a hint. */
  keyPrefix: string;
  /** Permitted modules/scopes, null = full access. */
  scopes?: string[] | null;
  enabled?: boolean;
  expiresAt?: Date | null;
  lastUsedAt?: Date | null;
  createdAt?: Date;
}
