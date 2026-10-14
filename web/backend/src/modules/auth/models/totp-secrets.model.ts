// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * TOTP secret types — Time-based One-Time Password (2FA) configuration.
 */

export interface TotpSecret {
  userId: number;
  secret: string;
  enabled: boolean;
  createdAt: Date;
  enabledAt: Date | null;
}

export interface NewTotpSecret {
  userId: number;
  secret: string;
  enabled?: boolean;
  createdAt?: Date;
  enabledAt?: Date | null;
}
