// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Office connectors service — connect/browse/fetch external office-tool MCPs.
 *
 * INSTANCE-LEVEL (panel host): credentials live in the panel-host secret store
 * and the stdio MCP client lives in this process. Every storage/runtime call
 * runs inside `runOnPanelHost` so it never leaks into a per-server sidecar
 * (CLAUDE.md §Modo managed: el registro MCP es por-instalación).
 */

import { runOnPanelHost } from "../../../shared/executor/index.js";
import { mcpConnectionService } from "../../mcp/services/mcp-connection.service.js";
import { secretsRepository } from "../../mcp/repositories/secrets.repository.js";
import { getModuleEnabledMap } from "../../../shared/module-state/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { AppError } from "../../../shared/errors/index.js";
import {
  OFFICE_CONNECTORS_CATALOG,
  getCatalogEntry,
} from "./office-connectors.catalog.js";
import type {
  ConnectorFetchedFile,
  ConnectorFile,
  OfficeConnectorStatus,
} from "../models/office-connectors.types.js";

const log = createModuleLogger("office-connectors");

/** MCP client key — namespaced so it never collides with extension ids. */
const clientKey = (id: string) => `office:${id}`;

function requireEntry(id: string) {
  const entry = getCatalogEntry(id);
  if (!entry) throw new AppError(`Unknown connector: ${id}`, 404, "UNKNOWN_CONNECTOR");
  return entry;
}

/** Merge a catalog entry with its live/configured state into a UI status. */
function toStatus(
  entry: (typeof OFFICE_CONNECTORS_CATALOG)[number],
  state: { connected: boolean; configured: boolean; lastError: string | null },
): OfficeConnectorStatus {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    icon: entry.icon,
    credentialFields: entry.credentialFields,
    setup: entry.setup,
    connected: state.connected,
    configured: state.configured,
    lastError: state.lastError,
  };
}

/** Extract `[{type:"text",text}]` parts from an MCP tools/call result. */
function extractTextParts(result: unknown): string[] {
  const out: string[] = [];
  const content = (result as { content?: unknown })?.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      const p = part as { type?: string; text?: string };
      if (p?.type === "text" && typeof p.text === "string") out.push(p.text);
    }
  }
  return out;
}

/** Pull the first resource part's mimeType, if any. */
function firstResourceMime(result: unknown): string | null {
  const content = (result as { content?: unknown })?.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      const p = part as { type?: string; resource?: { mimeType?: string } };
      if (p?.type === "resource" && p.resource?.mimeType) return p.resource.mimeType;
    }
  }
  return null;
}

/** Pick a tool by preferred name, else by heuristic keyword match. */
function pickTool(tools: Array<{ name: string }>, preferred: string | undefined, keywords: string[]): string | null {
  if (preferred && tools.some((t) => t.name === preferred)) return preferred;
  for (const kw of keywords) {
    const hit = tools.find((t) => t.name.toLowerCase().includes(kw))?.name;
    if (hit) return hit;
  }
  return null;
}

/** Best-effort mapping of a connector tool result into a file list. */
function normalizeFileList(result: unknown): ConnectorFile[] {
  const texts = extractTextParts(result);
  const files: ConnectorFile[] = [];

  for (const text of texts) {
    // Preferred: the tool returns JSON (array, or {files:[…]}).
    try {
      const parsed = JSON.parse(text) as unknown;
      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { files?: unknown[] })?.files)
          ? (parsed as { files: unknown[] }).files
          : null;
      if (arr) {
        for (const raw of arr) {
          const f = raw as Record<string, unknown>;
          const id = String(f.id ?? f.fileId ?? f.path ?? f.uri ?? f.name ?? "");
          if (!id) continue;
          const mimeType = String(f.mimeType ?? f.mime_type ?? "application/octet-stream");
          files.push({
            id,
            name: String(f.name ?? f.title ?? id),
            mimeType,
            isFolder: mimeType.includes("folder") || Boolean(f.isFolder),
            ...(typeof f.size === "number" ? { size: f.size } : {}),
            ...(f.modifiedTime || f.modifiedAt ? { modifiedAt: String(f.modifiedTime ?? f.modifiedAt) } : {}),
          });
        }
        continue;
      }
    } catch {
      /* not JSON — fall through to line parsing */
    }

    // Fallback: one file per non-empty line, e.g. "Name (id) <mime>".
    for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
      const idMatch = line.match(/\(([^)]+)\)\s*$/) ?? line.match(/\(([^)]+)\)/);
      const id = idMatch?.[1] ?? line;
      const name = idMatch ? line.replace(/\s*\([^)]+\)\s*$/, "").trim() || id : line;
      files.push({ id, name, mimeType: "application/octet-stream", isFolder: false });
    }
  }

  return files;
}

async function ensureConnected(id: string): Promise<void> {
  const status = mcpConnectionService.getStatus(clientKey(id));
  if (status.connected) return;

  const entry = requireEntry(id);
  const secrets = await secretsRepository.get(clientKey(id));
  if (!secrets) throw new AppError(`${entry.name} no está conectado`, 409, "CONNECTOR_NOT_CONFIGURED");
  await mcpConnectionService.connect(clientKey(id), entry.entrypoint, secrets);
}

export const officeConnectorsService = {
  /**
   * Status of the connectors whose panel module (same id, e.g. `google-drive`)
   * is ENABLED in /panel/modules — i.e. "activos en módulos". A connector whose
   * module is disabled (or blocked by entitlement) is omitted entirely, so the
   * chat only offers tools the admin actually turned on. Fail-open: if the
   * module state can't be read, all catalog connectors are returned (never hide
   * the feature on a transient read error).
   */
  async list(): Promise<OfficeConnectorStatus[]> {
    return runOnPanelHost(async () => {
      const enabledMap = await getModuleEnabledMap()
        .catch(() => null as Record<string, boolean> | null);
      // Only when we actually got the map do we filter; null = read failed → keep all.
      let activeIds: Set<string> | null = null;
      if (enabledMap) {
        // Self-hosted: no LP entitlement gate — "enabled" is the only condition.
        const enabledIds = OFFICE_CONNECTORS_CATALOG.map((e) => e.id).filter((id) => enabledMap[id]);
        activeIds = new Set(enabledIds);
      }

      const out: OfficeConnectorStatus[] = [];
      for (const entry of OFFICE_CONNECTORS_CATALOG) {
        if (activeIds && !activeIds.has(entry.id)) continue;
        const live = mcpConnectionService.getStatus(clientKey(entry.id));
        const configured = await secretsRepository.exists(clientKey(entry.id)).catch(() => false);
        out.push(
          toStatus(entry, {
            connected: live.connected,
            configured,
            lastError: live.lastError ?? null,
          }),
        );
      }
      return out;
    });
  },

  /** Store credentials (encrypted) and bring up the MCP client. */
  async connect(id: string, secrets: Record<string, string>): Promise<OfficeConnectorStatus> {
    return runOnPanelHost(async () => {
      const entry = requireEntry(id);
      // Keep only known credential keys; require the mandatory ones.
      const clean: Record<string, string> = {};
      for (const field of entry.credentialFields) {
        const v = secrets[field.key];
        if (v != null && String(v).length > 0) clean[field.key] = String(v);
        else if (field.required) throw new AppError(`Falta el campo: ${field.label}`, 400, "MISSING_CREDENTIAL");
      }

      await secretsRepository.save(clientKey(id), clean);
      try {
        // Reconnect fresh in case credentials changed.
        await mcpConnectionService.disconnect(clientKey(id));
        await mcpConnectionService.connect(clientKey(id), entry.entrypoint, clean);
      } catch (err) {
        log.error({ id, err: (err as Error).message }, "Connector connect failed");
        throw new AppError((err as Error).message, 502, "CONNECTOR_CONNECT_FAILED");
      }

      const live = mcpConnectionService.getStatus(clientKey(id));
      return toStatus(entry, { connected: live.connected, configured: true, lastError: live.lastError ?? null });
    });
  },

  /** Tear down the client and forget credentials. */
  async disconnect(id: string): Promise<void> {
    return runOnPanelHost(async () => {
      requireEntry(id);
      await mcpConnectionService.disconnect(clientKey(id));
      await secretsRepository.delete(clientKey(id)).catch(() => undefined);
    });
  },

  /**
   * Enable/disable a connector from the Modules tab. Unlike `disconnect`, this
   * KEEPS the stored credentials: disabling only stops the live MCP client, and
   * enabling reconnects from the saved secrets (no re-entry needed). Enabling a
   * connector with no stored credentials throws `CONNECTOR_NOT_CONFIGURED`.
   */
  async setActive(id: string, active: boolean): Promise<OfficeConnectorStatus> {
    return runOnPanelHost(async () => {
      const entry = requireEntry(id);
      if (active) {
        await ensureConnected(id);
      } else {
        await mcpConnectionService.disconnect(clientKey(id));
      }
      const live = mcpConnectionService.getStatus(clientKey(id));
      const configured = await secretsRepository.exists(clientKey(id)).catch(() => false);
      return toStatus(entry, { connected: live.connected, configured, lastError: live.lastError ?? null });
    });
  },

  /** Browse/search files exposed by the connector. */
  async browse(id: string, query: string): Promise<ConnectorFile[]> {
    return runOnPanelHost(async () => {
      const entry = requireEntry(id);
      await ensureConnected(id);

      const tools = await mcpConnectionService.listTools(clientKey(id));
      const toolName = pickTool(tools, entry.tools.search, ["search", "list", "find", "query"]);
      if (!toolName) throw new AppError(`${entry.name} no expone una herramienta de búsqueda`, 502, "NO_SEARCH_TOOL");

      const argKey = entry.tools.searchArgKey ?? "query";
      const res = await mcpConnectionService.callTool(clientKey(id), toolName, { [argKey]: query ?? "" });
      return normalizeFileList(res.content);
    });
  },

  /** Fetch one file and return it ready to attach into the chat. */
  async fetchFile(id: string, fileId: string, name?: string): Promise<ConnectorFetchedFile> {
    return runOnPanelHost(async () => {
      const entry = requireEntry(id);
      await ensureConnected(id);

      const tools = await mcpConnectionService.listTools(clientKey(id));
      const toolName = pickTool(tools, entry.tools.read, ["read", "get", "fetch", "download", "export"]);
      if (!toolName) throw new AppError(`${entry.name} no expone una herramienta de lectura`, 502, "NO_READ_TOOL");

      const argKey = entry.tools.readArgKey ?? "fileId";
      const res = await mcpConnectionService.callTool(clientKey(id), toolName, { [argKey]: fileId });

      const texts = extractTextParts(res.content);
      const body = texts.join("\n");
      const mimeType = firstResourceMime(res.content) ?? "text/plain";
      return {
        name: name && name.length > 0 ? name : `${entry.id}-${fileId}.txt`,
        mimeType,
        dataBase64: Buffer.from(body, "utf8").toString("base64"),
      };
    });
  },
};
