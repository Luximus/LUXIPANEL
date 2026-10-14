// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Admin module — catalog domain models.
 *
 * These types describe the panel's preinstalled-module catalog (the SSOT lives
 * in `services/module-registry.service.ts`). They are kept in `models/` so the
 * catalog shape is a stable contract that services, the community loader and
 * the MCP extension registry can import without pulling in service logic.
 */

/** One configurable field a module exposes in its setup dialog. */
export interface ConfigField {
  key: string;
  label: string;
  type: "text" | "email" | "password" | "select" | "textarea";
  placeholder?: string;
  required: boolean;
  hint?: string;
  /** Optional helper link rendered under the field (e.g. OAuth playground). */
  helpUrl?: string;
  /** Visible text for {@link helpUrl}; defaults to the URL. */
  helpUrlLabel?: string;
  optionsSource?: "dns-domains";
  options?: Array<{ label: string; value: string }>;
}

/** A fully-resolved catalog entry as served to the frontend / consumed by
 *  permission + MCP layers. */
export interface ModuleDefinition {
  id: string;
  name: string;
  description: string;
  tag: "free" | "premium";
  icon: string;
  color: string;
  category: "communication" | "infrastructure" | "security" | "developer";
  features: string[];
  configFields?: ConfigField[];
  /** Defaults to "module"; "mcp_server" is for local MCP integrations. */
  kind?: "module" | "mcp_server";
  /** Other modules that must be enabled first. */
  dependencies?: string[];
  /**
   * Modules that should be co-enabled WHEN THIS ONE is enabled (the reverse of
   * `dependencies`). Unlike a dependency it is not required for this module to
   * run — it is a "turning X on also turns Y on" companion link. Enabling Y on
   * its own never pulls in X. Used so the Assistant brings the Obsidian
   * context-vaults module with it.
   */
  implies?: string[];
  /** Permission surface this module exposes in the group/roles dialog. When
   *  omitted, the catalog derives a default from the id (sidebar=[id],
   *  view=panel.<id>). Lets dynamic modules own their assignable permissions. */
  permissions?: {
    sidebar?: string[];
    views?: string[];
    actions?: string[];
  };
  /**
   * True if the module can appear as a top-level entry in the left sidebar.
   * Defaults to true at runtime — only modules that opt OUT (none today)
   * would set this to false. Listed explicitly so the controller can echo
   * the capability to the frontend (the client uses it to decide whether
   * to draw a "Show in sidebar" toggle).
   */
  supportsSidebar?: boolean;
  /**
   * True if the module ships a floating button (FAB) overlay. When true, the
   * `/panel/modules` page shows a "Show floating button" toggle alongside the
   * "Show in sidebar" one. Defaults to false (most modules aren't FABs).
   */
  supportsFloatingButton?: boolean;
}

/** A raw catalog row: {@link ModuleDefinition} minus the `id` (which is the
 *  record key in the static catalog map). */
export interface CatalogEntry {
  name: string;
  description: string;
  tag: "free" | "premium";
  icon: string;
  color: string;
  category: ModuleDefinition["category"];
  features: string[];
  configFields?: ConfigField[];
  dependencies?: string[];
  implies?: string[];
  kind?: ModuleDefinition["kind"];
  permissions?: ModuleDefinition["permissions"];
  supportsSidebar?: boolean;
  supportsFloatingButton?: boolean;
}
