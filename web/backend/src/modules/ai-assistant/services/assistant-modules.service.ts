// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { moduleOperationRegistry } from "../../../shared/module-operations/registry.js";
import { refreshMcpTools } from "../../../shared/module-state/mcp-tools.js";
import { moduleStateRevision } from "../../../shared/module-state/lifecycle.js";
import { actionForTool, actionRequiresAdmin } from "../../../shared/auth/module-actions.js";
/**
 * Assistant Modules Service — merges the capability registry (per-instance,
 * panel host) with the per-target access sidecar to produce the descriptor
 * the UI consumes, and the filtered tool/dataPanel set the agent loop sees.
 */

import {
  agentCapabilityRegistry,
  type AgentTool,
} from "../../../shared/agent-capability/index.js";
import { assistantModuleAccessRepository } from "../repositories/assistant-module-access.repository.js";
import { communityPreviewRegistry } from "../../../shared/community-preview/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { getContextExecutor, runWithExecutor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { canUseModule, hasViewPermission, hasActionPermission, getRolePermissionsCatalog } from "../../../shared/auth/role-permissions.js";
import { getModuleCatalog, getModuleEnabledMap } from "../../../shared/module-state/index.js";
import type {
  ModuleAccessMap,
  ModuleAccessToolEntry,
} from "../models/assistant-module-access.types.js";

function capabilityPanelId(moduleId: string): string {
  return agentCapabilityRegistry.get(moduleId)?.catalogModuleId ?? moduleId;
}

/**
 * Snapshot of module activation on the connected server, shared with
 * `GET /api/me/modules` and the sidebar. Returns:
 *  - `governed`: every core-catalog module id the enable-map covers. A capability
 *    whose panel id is here is subject to the active check; anything else bypasses
 *    (community/preview/internal caps keep their own gating, no regression).
 *  - `active`: governed modules that are ENABLED in the registry. Self-hosted
 *    has no LP entitlement gate, so "enabled" is the only condition.
 *
 * Registry errors produce unavailable tools until state can be verified.
 */
async function moduleActivation(executor?: Executor | null): Promise<{ governed: Set<string>; active: Set<string> } | null> {
  try {
    const read = async () => {
      const enabledMap = await getModuleEnabledMap();
      const governed = new Set(Object.keys(enabledMap));
      const enabledIds = [...governed].filter((id) => enabledMap[id]);
      const active = new Set(enabledIds);
      return { governed, active };
    };
    const target = executor ?? getContextExecutor();
    return await (target ? runWithExecutor(target, read) : read());
  } catch {
    return null;
  }
}

/**
 * Whether the capability `moduleId` belongs to a module that is ACTIVE right now.
 * `state === null` (could not be determined) → fail-closed `false`. Capabilities not
 * governed by the enable-map (internal/community) → `true` (own gating applies).
 */
function isCapabilityModuleActive(
  state: { governed: Set<string>; active: Set<string> } | null,
  capModuleId: string,
): boolean {
  if (state === null) return false;
  const panelId = capabilityPanelId(capModuleId);
  if (!state.governed.has(panelId)) return true;
  return state.active.has(panelId) && (getModuleCatalog().find(module => module.id === panelId)?.dependencies ?? []).every(id => !state.governed.has(id) || state.active.has(id));
}

/**
 * Visibilidad solo-dev de las previews del marketplace (Modo B): un módulo
 * registrado en communityPreviewRegistry se oculta a TODOS (admin incluido)
 * salvo a su dueño — identidad String(user.userId) (trampa kv id-string).
 * Sin usuario en contexto (llamadas internas/MCP sin sesión) → oculto,
 * fail-closed.
 */
function previewHiddenFor(user: SessionUser | undefined, moduleId: string): boolean {
  const meta = communityPreviewRegistry.get(moduleId);
  if (!meta) return false;
  return String(user?.userId ?? "") !== meta.ownerUserId;
}

/**
 * Whether a non-admin `user` may use the agent capability `moduleId`. Admins
 * (and missing user context, e.g. internal calls) get everything; non-admins
 * are limited to capability modules mapped to a sidebar item their role can
 * see. Unmapped/privileged modules (admin, security-audit) are denied.
 */
function userMayUseModule(user: SessionUser | undefined, moduleId: string): boolean {
  if (!user || user.kind === "admin") return true;
  if (moduleId === "dashboard") return hasViewPermission(user, "panel.dashboard");
  // Preserve administrative capabilities; catalog access never grants root tools.
  if (["admin", "servers", "webhooks", "module-dev", "security-audit"].includes(moduleId)) return false;
  if (moduleId === "users" && user.kind !== "hosting" && user.tenantId === undefined) return false;
  const panelId = capabilityPanelId(moduleId);
  return canUseModule(user, panelId);
}

function toolVisibleTo(user: SessionUser | undefined, moduleId: string, tool: AgentTool): boolean {
  if (!user || user.kind === "admin") return true;
  const action = actionForTool(capabilityPanelId(moduleId), tool.name, tool.kind, tool.permission);
  return user.hostingPolicy?.state !== "pending" && !actionRequiresAdmin(action) && !getRolePermissionsCatalog().actionMetadata[action]?.adminOnly && hasActionPermission(user, action);
}

export interface ResolvedTool {
  name: string;
  title: string;
  description: string;
  kind: "read" | "action";
  dangerous: boolean;
  permission?: string;
  enabled: boolean;
  requireConfirm: boolean;
}

export interface ResolvedDataPanel {
  name: string;
  title: string;
  description: string;
  ttlSeconds?: number;
}

export interface ResolvedModule {
  moduleId: string;
  catalogModuleId: string;
  revision: string;
  coverage: { operations: number; tools: number };
  enabled: boolean;
  tools: ResolvedTool[];
  dataPanels: ResolvedDataPanel[];
  suggestedPrompts: string[];
}

/** Default: module is on unless the sidecar says otherwise. */
function moduleDefaultEnabled(access: ModuleAccessMap, moduleId: string): boolean {
  const entry = access[moduleId];
  return entry?.enabled ?? true;
}

/** Default: tool enabled; requireConfirm on actions/dangerous tools. */
function toolDefaults(
  access: ModuleAccessMap,
  moduleId: string,
  tool: AgentTool,
): { enabled: boolean; requireConfirm: boolean } {
  const fromSidecar: ModuleAccessToolEntry | undefined =
    access[moduleId]?.tools?.[tool.name];
  const dangerous = tool.dangerous ?? tool.kind === "action";
  return {
    enabled: fromSidecar?.enabled ?? true,
    requireConfirm: fromSidecar?.requireConfirm ?? dangerous,
  };
}

export const assistantModulesService = {
  async discoveryCatalog(executor?: Executor | null, user?: SessionUser) {
    const activation = await moduleActivation(executor);
    const access = await assistantModuleAccessRepository.load(executor);
    return getModuleCatalog().filter(module => {
      const cap = agentCapabilityRegistry.list().find(cap => capabilityPanelId(cap.moduleId) === module.id);
      return !previewHiddenFor(user, cap?.moduleId ?? module.id) && userMayUseModule(user, cap?.moduleId ?? module.id);
    }).map(module => {
      const cap = agentCapabilityRegistry.list().find(cap => capabilityPanelId(cap.moduleId) === module.id);
      const channel = module.id === "codebase-graph" ? "project-scoped-graph" : undefined;
      const active = activation && (!activation.governed.has(module.id) || activation.active.has(module.id));
      const dependenciesReady = (module.dependencies ?? []).every(id => !activation?.governed.has(id) || activation.active.has(id));
      const unavailableReason = !activation ? "module-state-unavailable" : !active ? "module-disabled" : !dependenciesReady ? "dependency-disabled" : !moduleDefaultEnabled(access, cap?.moduleId ?? module.id) ? "chat-access-disabled" : !cap && !channel ? "tools-not-registered" : undefined;
      return { moduleId: cap?.moduleId ?? module.id, catalogModuleId: module.id, name: module.name, description: module.description, channel, unavailableReason };
    });
  },
  /**
   * UI-friendly snapshot of all modules + per-tool toggles. Las previews del
   * marketplace solo aparecen para su dueño (pasa `user` cuando haya sesión).
   */
  async describe(executor?: Executor | null, user?: SessionUser): Promise<ResolvedModule[]> {
    await refreshMcpTools();
    const access = await assistantModuleAccessRepository.load(executor);
    const activation = await moduleActivation(executor);
    return agentCapabilityRegistry
      .list()
      .filter((cap) => !previewHiddenFor(user, cap.moduleId) && userMayUseModule(user, cap.moduleId))
      // Solo módulos ACTIVOS (habilitados ∩ con entitlement). Un módulo del
      // catálogo deshabilitado o sin suscripción no aparece en la pestaña.
      .filter((cap) => isCapabilityModuleActive(activation, cap.moduleId))
      .map((cap) => ({
      moduleId: cap.moduleId,
      catalogModuleId: capabilityPanelId(cap.moduleId),
      revision: `${agentCapabilityRegistry.revision(cap.moduleId)}:${(executor ?? getContextExecutor()) ? moduleStateRevision((executor ?? getContextExecutor())!.target.id) : 0}`,
      coverage: { operations: moduleOperationRegistry.list(capabilityPanelId(cap.moduleId)).length, tools: cap.tools.length },
      enabled: moduleDefaultEnabled(access, cap.moduleId),
      tools: cap.tools.filter(tool => toolVisibleTo(user, cap.moduleId, tool)).map((t) => {
        const d = toolDefaults(access, cap.moduleId, t);
        return {
          name: t.name,
          title: t.title,
          description: t.description,
          kind: t.kind,
          dangerous: t.dangerous ?? t.kind === "action",
          permission: t.permission,
          enabled: d.enabled,
          requireConfirm: d.requireConfirm,
        };
      }),
      dataPanels: (cap.dataPanels ?? []).map((p) => ({
        name: p.name,
        title: p.title,
        description: p.description,
        ttlSeconds: p.ttlSeconds,
      })),
      suggestedPrompts: cap.suggestedPrompts ?? [],
    }));
  },

  /**
   * Subset of tools the agent loop is allowed to call right now.
   *
   * Gating layers (all must pass):
   *  1. Per-target sidecar module/tool enable flags.
   *  2. Role-based access (when `user` is a non-admin): the tool's module must
   *     map to a sidebar item the user can see, AND any `permission` the tool
   *     declares must be one the user's groups actually grant. Admins get
   *     everything.
   *
   * A tool's `permission` is checked with `hasActionPermission` (which honours
   * group UNION + `<module>.*` wildcards), so a non-admin gets exactly the
   * file/user actions their Linux groups carry — not all-or-nothing. Tools
   * whose `permission` is NOT a real action id (e.g. `mail`, `admin`) never
   * match a group's action list, so they stay admin-only as before — no
   * regression for those modules.
   */
  async permittedTools(executor?: Executor | null, user?: SessionUser): Promise<AgentTool[]> {
    await refreshMcpTools();
    const access = await assistantModuleAccessRepository.load(executor);
    const activation = await moduleActivation(executor);
    const result: AgentTool[] = [];
    for (const cap of agentCapabilityRegistry.list()) {
      if (!moduleDefaultEnabled(access, cap.moduleId)) continue;
      // Módulo ACTIVO en el panel (habilitado ∩ con entitlement): un módulo
      // deshabilitado o sin suscripción no expone NINGUNA de sus tools al agente.
      if (!isCapabilityModuleActive(activation, cap.moduleId)) continue;
      // Preview del marketplace → solo su dueño (también aplica a admins).
      if (previewHiddenFor(user, cap.moduleId)) continue;
      if (!userMayUseModule(user, cap.moduleId)) continue;
      for (const tool of cap.tools) {
        const d = toolDefaults(access, cap.moduleId, tool);
        if (!d.enabled) continue;
        // A permissioned tool is only exposed to a non-admin whose groups
        // actually grant that action (e.g. files.write). Non-action permission
        // slugs (mail/admin) never match → still admin-only.
        if (!toolVisibleTo(user, cap.moduleId, tool)) continue;
        result.push(tool);
      }
    }
    return result;
  },

  /** Captured names remain callable only while their generation and access are current. */
  async allowedTools(executor?: Executor | null, user?: SessionUser): Promise<AgentTool[]> {
    const tools = await this.permittedTools(executor, user);
    return tools.map(tool => {
      const owner = agentCapabilityRegistry.findTool(tool.name)!;
      const target = executor ?? getContextExecutor();
      const revision = `${agentCapabilityRegistry.revision(owner.moduleId)}:${target ? moduleStateRevision(target.target.id) : 0}`;
      return { ...tool, handler: async input => {
        const { executeModuleTool } = await import("./module-tools.service.js");
        return executeModuleTool(tool.name, input, { executor, user, revision });
      } };
    });
  },

  // NOTA: aquí vivió `allowedDataPanels` (subset de dataPanels para el system
  // prompt) — nunca llegó a tener consumidores en el camino del run y se
  // eliminó; los dataPanels se sirven por el registry/SDK, no por el prompt.

  /** Used by the chat controller to honor the per-tool requireConfirm flag. */
  async toolNeedsConfirm(
    toolName: string,
    executor?: Executor | null,
  ): Promise<boolean> {
    const found = agentCapabilityRegistry.findTool(toolName);
    if (!found) return false;
    const access = await assistantModuleAccessRepository.load(executor);
    const d = toolDefaults(access, found.moduleId, found.tool);
    return d.requireConfirm;
  },
};
