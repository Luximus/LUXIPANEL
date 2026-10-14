// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Cloudflare published IP ranges (validated IPv4 + IPv6 CIDR lists).
 */

export interface CloudflareIpRanges {
  v4: string[];
  v6: string[];
}
