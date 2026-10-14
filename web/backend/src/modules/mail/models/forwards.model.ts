// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Email forward types — N forwarding destinations per account.
 */

export interface Forward {
  id: number;
  accountId: number;
  destination: string;
  keepCopy: boolean;
  enabled: boolean;
  createdAt: Date;
}

export interface NewForward {
  id?: number;
  accountId: number;
  destination: string;
  keepCopy?: boolean;
  enabled?: boolean;
  createdAt?: Date;
}
