import { shareAssistantReads } from "./load-coordinator";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { api, unwrap } from "@/lib/api-client";

// ── Office connectors (external MCP tools: Google Drive, …) ───────────────

export interface ConnectorCredentialField {
  key: string;
  label: string;
  type: "text" | "password" | "textarea";
  placeholder?: string;
  required?: boolean;
  help?: string;
  helpUrl?: string;
  helpUrlLabel?: string;
}

export interface ConnectorSetupGuide {
  steps: string[];
  docUrl?: string;
  docLabel?: string;
}

export interface OfficeConnector {
  id: string;
  name: string;
  description: string;
  icon: string;
  credentialFields: ConnectorCredentialField[];
  setup?: ConnectorSetupGuide;
  connected: boolean;
  configured: boolean;
  lastError: string | null;
}

export interface ConnectorFile {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  size?: number;
  modifiedAt?: string;
}

export interface ConnectorFetchedFile {
  name: string;
  mimeType: string;
  dataBase64: string;
}

/** Assistant notification preferences (instance-level). v1: a single toggle for
 *  "notify my devices (web/app/desktop) when a chat finishes". */
export const notifyPrefsApi = {
  async get(): Promise<boolean> {
    const res = await api.get<{ ok: boolean; chatFinished: boolean }>("/api/ai/notify-prefs");
    return res.data?.chatFinished ?? true;
  },
  async set(chatFinished: boolean): Promise<boolean> {
    const res = await api.put<{ ok: boolean; chatFinished: boolean }>("/api/ai/notify-prefs", { chatFinished });
    return res.data?.chatFinished ?? chatFinished;
  },
};

export const assistantConnectorsApi = {
  async list(): Promise<OfficeConnector[]> {
    const res = await api.catalog<{ connectors: OfficeConnector[] }>("/api/ai/connectors");
    return unwrap(res, "Failed to load connectors").connectors;
  },
  async connect(id: string, secrets: Record<string, string>): Promise<OfficeConnector> {
    const res = await api.post<{ connector: OfficeConnector }>(`/api/ai/connectors/${encodeURIComponent(id)}/connect`, { secrets });
    return unwrap(res, "Failed to connect").connector;
  },
  async disconnect(id: string): Promise<void> {
    const res = await api.post(`/api/ai/connectors/${encodeURIComponent(id)}/disconnect`, {});
    if (!res.ok) throw new Error(res.error ?? "Failed to disconnect");
  },
  /** Enable/disable from the Modules tab — keeps credentials (unlike disconnect). */
  async setActive(id: string, active: boolean): Promise<OfficeConnector> {
    const res = await api.put<{ connector: OfficeConnector }>(`/api/ai/connectors/${encodeURIComponent(id)}/active`, { active });
    return unwrap(res, "Failed to update connector").connector;
  },
  async browse(id: string, query: string): Promise<ConnectorFile[]> {
    const res = await api.get<{ files: ConnectorFile[] }>(`/api/ai/connectors/${encodeURIComponent(id)}/files?query=${encodeURIComponent(query)}`);
    return unwrap(res, "Failed to browse files").files;
  },
  async fetchFile(id: string, fileId: string, name?: string): Promise<ConnectorFetchedFile> {
    const res = await api.post<{ file: ConnectorFetchedFile }>(`/api/ai/connectors/${encodeURIComponent(id)}/files/fetch`, { fileId, name });
    return unwrap(res, "Failed to fetch file").file;
  },
};

shareAssistantReads(assistantConnectorsApi, "assistantConnectorsApi");
