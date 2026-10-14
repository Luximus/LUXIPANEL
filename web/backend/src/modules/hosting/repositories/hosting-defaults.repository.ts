// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";

export interface HostingDefaults {
  id: string;
  plan: "basic" | "pro" | "business" | "custom";
  diskQuotaMb: number;
  bandwidthQuotaMb: number;
  maxDomains: number;
  maxEmailAccounts: number;
  maxDatabases: number;
  maxSubUsers: number;
  jailEnabled: boolean;
  allowedModules: string[];
}

export const DEFAULT_HOSTING_DEFAULTS: HostingDefaults = {
  id: "defaults", plan: "basic", diskQuotaMb: 10240, bandwidthQuotaMb: 102400,
  maxDomains: 10, maxEmailAccounts: 20, maxDatabases: 0, maxSubUsers: 0,
  jailEnabled: false, allowedModules: [],
};

const store = makeKvStore<HostingDefaults>({ module: "hosting", collection: "defaults", idStrategy: "uuid" });

export const hostingDefaultsRepository = {
  async get(executor: Executor): Promise<HostingDefaults> {
    return { ...DEFAULT_HOSTING_DEFAULTS, ...(await store(executor).get("defaults") ?? {}) };
  },
  async save(executor: Executor, defaults: HostingDefaults): Promise<HostingDefaults> {
    await store(executor).set("defaults", defaults);
    return defaults;
  },
};
