// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * UFW domain shapes — the structured form of `ufw status numbered` output.
 */

export interface UfwRule {
  number: number;
  action: string; // ALLOW | DENY | LIMIT | REJECT
  direction: string; // IN | OUT | FWD
  from: string;
  to: string;
  protocol: string | null;
  comment: string | null;
}

export interface UfwStatus {
  active: boolean;
  logging: string | null;
  rules: UfwRule[];
}
