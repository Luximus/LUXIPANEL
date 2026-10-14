// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Contact types — address book with usage-based ordering.
 */

export interface Contact {
  id: number;
  accountId: number;
  email: string;
  displayName: string | null;
  /** Incremented each time this contact is used in compose. */
  useCount: number;
  lastUsedAt: Date;
  createdAt: Date;
}

export interface NewContact {
  id?: number;
  accountId: number;
  email: string;
  displayName?: string | null;
  /** Incremented each time this contact is used in compose. */
  useCount?: number;
  lastUsedAt?: Date;
  createdAt?: Date;
}
