// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * MCP-related types and interfaces
 */

export interface MCPConfig {
  [key: string]: string;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, any>;
}

export interface MCPInstallRequest {
  config: MCPConfig;
  secrets?: MCPConfig; // Fields marked as sensitive
}

export interface MCPTestConnectionResponse {
  ok: boolean;
  connected: boolean;
  error?: string;
  message?: string;
}

export interface MCPInstallResponse {
  ok: boolean;
  extensionId: string;
  status: string;
  error?: string;
}

export interface MCPToolsResponse {
  ok: boolean;
  tools: MCPTool[];
  error?: string;
}
