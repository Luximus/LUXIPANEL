// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Email filter types — user-defined Sieve-like rules/actions per account.
 */

import type { MailFilterRule, MailFilterAction } from "../types/filter.types.js";

export interface MailFilter {
  id: number;
  accountId: number;
  name: string;
  enabled: boolean;
  position: number;
  rules: MailFilterRule[];
  actions: MailFilterAction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NewMailFilter {
  id?: number;
  accountId: number;
  name: string;
  enabled?: boolean;
  position?: number;
  rules?: MailFilterRule[];
  actions?: MailFilterAction[];
  createdAt?: Date;
  updatedAt?: Date;
}
