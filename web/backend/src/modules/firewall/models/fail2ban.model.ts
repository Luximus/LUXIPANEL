// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Fail2ban domain shapes — one configured jail and its current bans.
 */

export interface JailStatus {
  name: string;
  active: boolean;
  filter: string | null;
  currentlyBanned: number;
  totalBanned: number;
  bannedIPs: string[];
}
