// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Office connectors — typed catalog of external "office tool" MCP servers
 * (Google Drive, OneDrive, Dropbox, Notion, …) that the assistant can browse.
 *
 * Connectors are **instance-level** (panel host), exactly like the rest of the
 * MCP registry: their credentials live encrypted in the panel-host secret
 * store and the stdio MCP client lives in the panel process. All access must
 * run inside `runOnPanelHost` (see office-connectors.service.ts).
 */

/** A credential/config field the user fills in to connect a connector. */
export interface ConnectorCredentialField {
  key: string;
  label: string;
  type: "text" | "password" | "textarea";
  placeholder?: string;
  required?: boolean;
  help?: string;
  /** Optional helper link shown under the field (e.g. OAuth Playground). */
  helpUrl?: string;
  /** Visible text for {@link helpUrl}. Defaults to the URL if omitted. */
  helpUrlLabel?: string;
}

/**
 * Step-by-step setup guide for a connector, surfaced behind a "?" help button.
 * Walks the user through obtaining the credentials this connector needs.
 */
export interface ConnectorSetupGuide {
  /** Ordered, human-readable steps (rendered as a numbered list). */
  steps: string[];
  /** Optional documentation/tool link (e.g. OAuth Playground). */
  docUrl?: string;
  /** Visible text for {@link docUrl}. Defaults to the URL if omitted. */
  docLabel?: string;
}

/** Static definition of one connectable office tool (MCP server). */
export interface OfficeConnectorCatalogEntry {
  id: string;
  name: string;
  description: string;
  /** Tabler icon class suffix, e.g. "ti-brand-google-drive". */
  icon: string;
  /** stdio entrypoint, e.g. "npx -y @modelcontextprotocol/server-gdrive". */
  entrypoint: string;
  /** Fields the user provides; stored encrypted and passed as env to the MCP. */
  credentialFields: ConnectorCredentialField[];
  /** Step-by-step guide shown behind the "?" help button. */
  setup?: ConnectorSetupGuide;
  /** Tool-name hints + argument keys for browsing/reading files. */
  tools: {
    /** Preferred tool name for searching/listing files. */
    search?: string;
    /** Argument key the search tool expects for the query. Default "query". */
    searchArgKey?: string;
    /** Preferred tool name for reading a single file. */
    read?: string;
    /** Argument key the read tool expects for the id. Default "fileId". */
    readArgKey?: string;
  };
}

/** Runtime status of a connector, merged with its catalog entry for the UI. */
export interface OfficeConnectorStatus {
  id: string;
  name: string;
  description: string;
  icon: string;
  credentialFields: ConnectorCredentialField[];
  /** Step-by-step guide shown behind the "?" help button. */
  setup?: ConnectorSetupGuide;
  /** Live MCP client connected in this process. */
  connected: boolean;
  /** Credentials stored (so we can auto-reconnect on demand). */
  configured: boolean;
  lastError: string | null;
}

/** A file/folder surfaced by a connector's search/list tool. */
export interface ConnectorFile {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  size?: number;
  modifiedAt?: string;
}

/** A file fetched for attaching into the chat (same shape as ChatAttachment). */
export interface ConnectorFetchedFile {
  name: string;
  mimeType: string;
  dataBase64: string;
}
