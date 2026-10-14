// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Credentials tab — shared module-level state hub.
// LEAF module: imports NOTHING, so every submodule can import it without cycles.
// Only the cross-module reassignable caches live here (an importer reads a live
// `S.foo`; the owner writes `S.foo = …`). Both caches are populated by their
// domain module (cred-provider-cards) AND reset per-load by the orchestrator
// (cred-gating.loadAll), hence they are shared here.
export const S = {
  // Storage provider creds (Cloudflare R2 / S3), fetched from
  // /api/backups/provider-creds. Reset to null at the start of each loadAll.
  providerCredsCache: null as ProviderCred[] | null,
  // Office connector statuses (Google Drive / OneDrive / Dropbox / Notion),
  // fetched from /api/ai/connectors. Reset to null at the start of each loadAll.
  connectorsCache: null as ConnectorStatus[] | null,
};

// Shapes shared between the caches and their domain module.
export interface ProviderCred {
  provider: string;
  configured: boolean;
  accountId: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  hasSecret: boolean;
}
export interface ConnectorField { key: string; label: string; type: string; placeholder?: string; help?: string; helpUrl?: string; helpUrlLabel?: string }
export interface ConnectorStatus {
  id: string; name: string; icon: string;
  credentialFields: ConnectorField[];
  setup?: { steps?: string[]; docUrl?: string; docLabel?: string };
  connected: boolean; configured: boolean; lastError: string | null;
}
