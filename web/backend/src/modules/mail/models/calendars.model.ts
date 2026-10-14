// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Calendar types — calendar containers per email account.
 */

export interface Calendar {
  id: number;
  accountId: number;
  name: string;
  description: string | null;
  color: string;
  timezone: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewCalendar {
  id?: number;
  accountId: number;
  name: string;
  description?: string | null;
  color?: string;
  timezone?: string;
  enabled?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
