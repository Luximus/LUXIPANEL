// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { requireGithub } from "../github/user-connection.js";
import { notifyModulesChanged, moduleStateRevision } from "../module-state/lifecycle.js";
/**
 * Agent Capability Registry — in-process catalog of every module's
 * `AgentCapability`. Populated at boot inside `runOnPanelHost` (panel-host
 * scope); read at request-time from `agent.service` to build the tool list
 * the LLM sees.
 *
 * Invariants:
 * - Tool/dataPanel names are globally unique, prefixed by `<moduleId>.`.
 * - Registration is idempotent — re-registering the same moduleId replaces
 *   the entry (useful for tests). In production, every register() call
 *   comes from a single `registerXxxModule()` callsite at boot.
 */

import { withTenantIdentityControl } from "../tenant/identity-control.js";
import { getContextExecutor, getContextUser, runWithToolIdentity, runWithPermissionAction } from "../executor/context.js";
import { actionForTool, actionRequiresAdmin } from "../auth/module-actions.js";
import { canUseModule, hasActionPermission, getRolePermissionsCatalog } from "../auth/role-permissions.js";
import { ForbiddenError } from "../errors/index.js";
import { createModuleLogger } from "../logger/index.js";
import type {
  AgentCapability,
  AgentCapabilityDescriptor,
  AgentDataPanel,
  AgentTool,
} from "./types.js";

const log = createModuleLogger("agent-capability-registry");

const TOOL_NAME_RE = /^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_-]*$/;

class AgentCapabilityRegistry {
  private byModule = new Map<string, AgentCapability>();
  private toolIndex = new Map<string, { moduleId: string; tool: AgentTool }>();
  private panelIndex = new Map<string, { moduleId: string; panel: AgentDataPanel }>();

  private originalHandlers = new WeakMap<AgentTool, AgentTool["handler"]>();
  private revisions = new Map<string, number>();
  revision(moduleId: string): number { return this.revisions.get(moduleId) ?? 0; }

  register(capability: AgentCapability): void {
    if (capability.version !== 1) {
      throw new Error(
        `AgentCapability(${capability.moduleId}): unsupported version ${capability.version}`,
      );
    }

    const toolNames = new Set<string>(), panelNames = new Set<string>();

    for (const tool of capability.tools) {
      if (!tool.name.startsWith(`${capability.moduleId}.`)) {
        throw new Error(
          `AgentCapability(${capability.moduleId}): tool "${tool.name}" must be prefixed by "${capability.moduleId}."`,
        );
      }
      if (!TOOL_NAME_RE.test(tool.name)) {
        throw new Error(
          `AgentCapability(${capability.moduleId}): tool name "${tool.name}" is invalid (expected /${TOOL_NAME_RE.source}/)`,
        );
      }
      const toolOwner = this.toolIndex.get(tool.name);
      if (toolNames.has(tool.name) || (toolOwner && toolOwner.moduleId !== capability.moduleId)) {
        throw new Error(
          `AgentCapability(${capability.moduleId}): tool "${tool.name}" already registered by "${toolOwner?.moduleId ?? capability.moduleId}"`,
        );
      }
      toolNames.add(tool.name);
      if (tool.inputSchema.type !== "object") {
        throw new Error(
          `AgentCapability(${capability.moduleId}): tool "${tool.name}" inputSchema.type must be "object"`,
        );
      }
    }

    for (const panel of capability.dataPanels ?? []) {
      if (!panel.name.startsWith(`${capability.moduleId}.`)) {
        throw new Error(
          `AgentCapability(${capability.moduleId}): dataPanel "${panel.name}" must be prefixed by "${capability.moduleId}."`,
        );
      }
      if (!TOOL_NAME_RE.test(panel.name)) {
        throw new Error(
          `AgentCapability(${capability.moduleId}): dataPanel name "${panel.name}" is invalid`,
        );
      }
      if (panelNames.has(panel.name)) throw new Error("Duplicate panel name");
      panelNames.add(panel.name);
      const panelOwner = this.panelIndex.get(panel.name);
      if (panelOwner && panelOwner.moduleId !== capability.moduleId) {
        throw new Error(
          `AgentCapability(${capability.moduleId}): dataPanel "${panel.name}" already registered by "${panelOwner?.moduleId ?? capability.moduleId}"`,
        );
      }
    }

    // Validate completely before replacing the current generation.
    const previous = this.byModule.get(capability.moduleId);
    for (const tool of previous?.tools ?? []) this.toolIndex.delete(tool.name);
    for (const panel of previous?.dataPanels ?? []) this.panelIndex.delete(panel.name);
    const revision = this.revision(capability.moduleId) + 1;
    this.revisions.set(capability.moduleId, revision);
    const catalogId = capability.catalogModuleId ?? capability.moduleId;
    const current = () => this.revision(capability.moduleId) === revision && this.byModule.has(capability.moduleId);
    capability = { ...capability, tools: capability.tools.map(tool => {
      const handler = this.originalHandlers.get(tool) ?? tool.handler;
      const wrapped: AgentTool = { ...tool, handler: async (input: unknown) => {
        if (!current()) throw new ForbiddenError("Module tools changed; discover the module again");
        const user = getContextUser(), executor = getContextExecutor();
        if (!user) return handler(input); // explicitly trusted internal boot/task
        if (!executor) throw new ForbiddenError("Tool execution requires an authenticated server");
        await requireGithub(user);
        const stateRevision = moduleStateRevision(executor.target.id);
        const { resolveLiveAuthorization } = await import("../../modules/auth/services/live-authorization.service.js");
        const live = await resolveLiveAuthorization(user, executor);
        if (!current() || moduleStateRevision(executor.target.id) !== stateRevision) throw new ForbiddenError("Module tools changed; discover the module again");
        const action = actionForTool(catalogId, tool.name, tool.kind, tool.permission);
        if (capability.moduleId === "users" && live.kind !== "admin" && live.tenantId === undefined && live.kind !== "hosting") throw new ForbiddenError("User administration requires a hosting account or administrator");
        if (live.kind !== "admin" && (!canUseModule(live, catalogId) || actionRequiresAdmin(action) || getRolePermissionsCatalog().actionMetadata[action]?.adminOnly || !hasActionPermission(live, action) || live.hostingPolicy?.state === "pending")) throw new ForbiddenError("Tool permission revoked or unavailable");
        return runWithToolIdentity(live, () => runWithPermissionAction(action, () => capability.moduleId === "users" ? withTenantIdentityControl(() => handler(input)) : handler(input)));
      } };
      this.originalHandlers.set(wrapped, handler);
      return wrapped;
    }) };
    this.byModule.set(capability.moduleId, capability);
    for (const tool of capability.tools) {
      this.toolIndex.set(tool.name, { moduleId: capability.moduleId, tool });
    }
    for (const panel of capability.dataPanels ?? []) {
      this.panelIndex.set(panel.name, { moduleId: capability.moduleId, panel });
    }

    notifyModulesChanged(capability.moduleId, null);
    log.info(
      {
        moduleId: capability.moduleId,
        tools: capability.tools.length,
        dataPanels: capability.dataPanels?.length ?? 0,
      },
      "Agent capability registered",
    );
  }

  unregister(moduleId: string): void {
    const prev = this.byModule.get(moduleId);
    if (!prev) return;
    this.revisions.set(moduleId, this.revision(moduleId) + 1);
    this.byModule.delete(moduleId);
    for (const tool of prev.tools) this.toolIndex.delete(tool.name);
    for (const panel of prev.dataPanels ?? []) this.panelIndex.delete(panel.name);
    notifyModulesChanged(moduleId, null);
  }

  list(): AgentCapability[] {
    return [...this.byModule.values()].sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  }

  get(moduleId: string): AgentCapability | undefined {
    return this.byModule.get(moduleId);
  }

  findTool(name: string): { moduleId: string; tool: AgentTool } | undefined {
    return this.toolIndex.get(name);
  }

  findDataPanel(name: string): { moduleId: string; panel: AgentDataPanel } | undefined {
    return this.panelIndex.get(name);
  }

  describe(): AgentCapabilityDescriptor[] {
    return this.list().map((cap) => ({
      moduleId: cap.moduleId,
      tools: cap.tools.map((t) => ({
        name: t.name,
        title: t.title,
        description: t.description,
        kind: t.kind,
        dangerous: t.dangerous ?? t.kind === "action",
        permission: t.permission,
      })),
      dataPanels: (cap.dataPanels ?? []).map((p) => ({
        name: p.name,
        title: p.title,
        description: p.description,
        ttlSeconds: p.ttlSeconds,
      })),
      suggestedPrompts: cap.suggestedPrompts ?? [],
    }));
  }

  /** Test helper — wipes the registry. Not exported beyond tests. */
  _resetForTest(): void {
    this.byModule.clear();
    this.toolIndex.clear();
    this.panelIndex.clear();
  }
}

export const agentCapabilityRegistry = new AgentCapabilityRegistry();
