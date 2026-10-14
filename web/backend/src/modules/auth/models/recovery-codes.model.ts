// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Recovery code types — backup codes for account recovery.
 */

export interface RecoveryCode {
  id: string;
  userId: number;
  codeHash: string;
  createdAt: Date;
  usedAt: Date | null;
  supersededAt: Date | null;
}

export interface NewRecoveryCode {
  id: string;
  userId: number;
  codeHash: string;
  createdAt?: Date;
  usedAt?: Date | null;
  supersededAt?: Date | null;
}
