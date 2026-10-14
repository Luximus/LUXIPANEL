// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Provider credentials and ownership mappings belong to the panel host. */
import { dataStore } from "../../../shared/data-store/index.js";
import { localExecutor } from "../../../shared/executor/index.js";
import type { HostingProvider, ProviderAccountLink, ProviderSiteLink } from "../models/provider.model.js";

const providers = () => dataStore<HostingProvider>(localExecutor, "hosting", "providers", { idStrategy: "uuid" });
const accounts = () => dataStore<ProviderAccountLink>(localExecutor, "hosting", "provider-accounts", { idStrategy: "uuid" });
const sites = () => dataStore<ProviderSiteLink>(localExecutor, "hosting", "provider-sites", { idStrategy: "uuid" });

export const providerRepository = {
  list: () => providers().list(),
  get: (id: string) => providers().get(id),
  create: (data: HostingProvider) => providers().create(data),
  update: (id: string, patch: Partial<HostingProvider>) => providers().update(id, patch),
  findAccount: (providerId: string, externalAccountId: string) =>
    accounts().find((a) => a.providerId === providerId && a.externalAccountId === externalAccountId),
  createAccount: (data: ProviderAccountLink) => accounts().create(data),
  deleteAccount: (id: string) => accounts().delete(id),
  findSite: (providerId: string, externalSiteId: string) =>
    sites().find((s) => s.providerId === providerId && s.externalSiteId === externalSiteId),
  findDomain: (targetId: string, domain: string) =>
    sites().find((s) => s.targetId === targetId && s.domain === domain),
  createSite: (data: ProviderSiteLink) => sites().create(data),
  deleteSite: (id: string) => sites().delete(id),
  listSitesForAccount: (providerId: string, externalAccountId: string) =>
    sites().query((s) => s.providerId === providerId && s.externalAccountId === externalAccountId),
};
