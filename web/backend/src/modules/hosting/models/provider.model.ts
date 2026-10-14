// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

import type { ProviderGroupTemplate } from "../services/provider-group-policy.js";

export const PROVIDER_OPERATIONS = [
  "accounts.read", "accounts.write", "accounts.status", "accounts.delete",
  "usage.read", "sites.write", "access.issue",
  "expo.read", "expo.write", "expo.build", "expo.submit",
  "deployments.read", "deployments.write", "deployments.build", "deployments.publish",
] as const;

export type ProviderOperation = (typeof PROVIDER_OPERATIONS)[number];

export interface HostingProvider {
  id: string;
  name: string;
  /** `local` is explicit; other IDs refer to a pinned SSH vault target. */
  targetId: string;
  panelUrl: string;
  /** Only this fixed loopback upstream may be used for managed proxy sites. */
  upstreamUrl: string;
  operations: ProviderOperation[];
  allowedModules: string[];
  /** Initial permissions copied to each new account's dedicated group. */
  templateId?: string | null;
  groupTemplate?: ProviderGroupTemplate | null;
  plan: "basic" | "pro" | "business" | "custom";
  diskQuotaMb: number;
  bandwidthQuotaMb: number;
  maxDomains: number;
  maxEmailAccounts: number;
  maxDatabases: number;
  maxSubUsers: number;
  jailEnabled: boolean;
  enabled: boolean;
  keyHash: string;
  keyPrefix: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderAccountLink {
  id: string;
  providerId: string;
  externalAccountId: string;
  accountId: number;
  targetId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderSiteLink {
  id: string;
  providerId: string;
  externalAccountId: string;
  externalSiteId: string;
  domain: string;
  targetId: string;
  createdAt: string;
  updatedAt: string;
}
