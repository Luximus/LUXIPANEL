// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { admitAgentWork, resolveConversationBinding, intersectPaths } from "./agent-context.service.js";
import { randomUUID } from "node:crypto";
import { assistantAuditRepository } from "../repositories/assistant-audit.repository.js";
import { redactModuleData } from "../../../shared/module-operations/redact.js";
import path from "node:path";
import { pathInFileJail } from "../../../shared/executor/context.js";
import { normalizeAllowedTools } from "./tool-allowlist.js";
import { moduleStateRevision } from "../../../shared/module-state/lifecycle.js";
import type { AgentTool } from "../../../shared/agent-capability/types.js";
import { agentCapabilityRegistry } from "../../../shared/agent-capability/registry.js";
import { getContextExecutor, getContextUser, getFileJailPaths, runWithToolIdentity } from "../../../shared/executor/context.js";
import type { Executor } from "../../../shared/executor/types.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { assistantModulesService } from "./assistant-modules.service.js";
import { agentRunRegistry } from "./agent-run-registry.js";
import { permissionBroker } from "./permission-broker.js";
import { resolveLiveAuthorization } from "../../auth/services/live-authorization.service.js";

export const MODULE_RUN_EXPIRED = {
  code: "MCP_RUN_EXPIRED", operationStatus: "not_started",
  message: "No se pudo recuperar el canal de herramientas de esta tarea. La operación solicitada no llegó a iniciarse.",
  nextStep: "Reanuda la tarea desde el chat para abrir una sesión nueva. Verifica el estado del trabajo anterior antes de repetir cambios.",
} as const;

export function moduleToolRevision(moduleId: string, executor = getContextExecutor()): string {
  return `${agentCapabilityRegistry.revision(moduleId)}:${executor ? moduleStateRevision(executor.target.id) : 0}`;
}

interface Scope {
  executor?: Executor | null; user?: SessionUser; conversationId?: string;
  agentId?: string; projectId?: string; signal?: AbortSignal; trace?: boolean; revision?: string; allowlists?: readonly (readonly string[] | null | undefined)[];
}
const runScopes = new Map<string, { allowlists: Scope["allowlists"]; jail: string[] | null; owner: number; agentId?: string; signal?: AbortSignal; tokenHash?: string; alive?: () => boolean }>();
const key = (conversationId: string, executor: Executor) => JSON.stringify([executor.target.id, conversationId]);
export function bindModuleToolRun(conversationId: string, executor: Executor, user: SessionUser, allowlists: Scope["allowlists"], agentId?: string, signal?: AbortSignal): () => void {
  const id = key(conversationId, executor), scope = { allowlists, jail: getFileJailPaths(), owner: user.userId, agentId, signal };
  runScopes.set(id, scope);
  return () => { if (runScopes.get(id) === scope) runScopes.delete(id); };
}
export function moduleToolRunScope(conversationId: string, executor: Executor, user: SessionUser) {
  const scope = runScopes.get(key(conversationId, executor));
  return scope?.owner === user.userId && !scope.signal?.aborted && (!scope.alive || scope.alive()) ? scope : undefined;
}
async function currentTools(scope: Scope): Promise<AgentTool[]> {
  const executor = scope.executor ?? getContextExecutor(), user = scope.user ?? getContextUser();
  if (!executor || !user || getContextExecutor() !== executor || scope.signal?.aborted) return [];
  const currentAllowlists = [...(scope.allowlists ?? [])];
  if (scope.agentId || scope.conversationId || scope.projectId) {
    const context = await resolveConversationBinding(executor, scope, user);
    for (const list of [context.agent?.allowedTools, context.role?.allowedTools]) if (list) currentAllowlists.push(normalizeAllowedTools([...list], { onUnknown: "drop", context: "module-dispatch" })?.valid ?? []);
  }
  const live = await resolveLiveAuthorization(user, executor);
  const tools = await runWithToolIdentity(live, () => assistantModulesService.permittedTools(executor, live));
  return tools.filter(tool => currentAllowlists.every(list => !list || list.includes(tool.name)));
}
export async function executeModuleTool(name: string, input: unknown, scope: Scope = {}): Promise<{ ok: boolean; output: unknown }> {
  const snapshot = JSON.parse(JSON.stringify(input ?? {})) as unknown;
  const owner = agentCapabilityRegistry.findTool(name);
  if (!owner) return { ok: false, output: "Module tool unavailable; discover tools again" };
  const revision = scope.revision ?? moduleToolRevision(owner.moduleId, scope.executor ?? getContextExecutor());
  const valid = async () => {
    const tools = await currentTools(scope);
    return !scope.signal?.aborted && moduleToolRevision(owner.moduleId, scope.executor ?? getContextExecutor()) === revision && tools.find(tool => tool.name === name);
  };
  let tool = await valid();
  if (!tool) return { ok: false, output: "Module tool changed or access was revoked" };
  const approval = scope.conversationId ? agentRunRegistry.getApproval(scope.conversationId) : null;
  if (tool.kind === "action" && approval?.mode === "plan") return { ok: false, output: "Plan mode does not permit changes" };
  const needsConfirm = await assistantModulesService.toolNeedsConfirm(name, scope.executor);
  if (needsConfirm || (tool.kind === "action" && approval?.mode === "manual")) {
    if (!scope.conversationId) return { ok: false, output: "This operation requires approval in an active chat" };
    if (approval?.mode !== "auto" && !approval?.autoApprove.has(name)) {
      const decision = await permissionBroker.request({ conversationId: scope.conversationId, tool: name, title: tool.title, detail: JSON.stringify(redactModuleData(snapshot)).slice(0, 2000) });
      if (decision !== "allow") return { ok: false, output: "Operation denied" };
    }
  }
  const bound = scope.agentId || scope.conversationId || scope.projectId
    ? await resolveConversationBinding(scope.executor ?? getContextExecutor(), scope, scope.user ?? getContextUser() ?? undefined) : undefined;
  const admission = bound?.agentId ? await admitAgentWork(scope.executor ?? getContextExecutor(), bound.agentId, bound.projectId, scope.user ?? getContextUser() ?? undefined) : undefined;
  try {
  tool = await valid(); // revision, live identity, activation and sidecar after approval
  if (!tool) return { ok: false, output: "Module tool changed or access was revoked while awaiting approval" };
  const context = admission ?? bound;
  if (name.startsWith("servers.") && context?.projectId) {
    const serverId = (snapshot as { serverId?: string }).serverId;
    const servers = context.agent?.servers ?? context.ancestors.flatMap(p => p.servers ?? []);
    if (!serverId || !servers.some(s => s.id === serverId)) return { ok: false, output: "El servidor no pertenece al proyecto activo." };
  }
  const scopedPaths = context?.projectId ? context.agent?.projectPaths ?? context.contextProjects.map(p => p.path).filter(Boolean) : undefined;
  const checkPaths = (value: unknown, key = "") => {
    if (typeof value === "string" && /(?:paths?|directory|destination|source|root|cwd)$/i.test(key) && value.startsWith("/") && (!pathInFileJail(path.posix.resolve(value)) || (scopedPaths !== undefined && !intersectPaths([value], scopedPaths).includes(path.posix.resolve(value))))) throw new Error("Path outside the agent's project scope");
    if (Array.isArray(value)) for (const item of value) checkPaths(item, key);
    else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) checkPaths(item, key);
  };
  checkPaths(snapshot);
  const started = Date.now(), traceId = randomUUID();
  const inject = (event: Parameters<typeof agentRunRegistry.inject>[1]) => { if (scope.trace && scope.conversationId) agentRunRegistry.inject(scope.conversationId, event, (scope.executor ?? getContextExecutor())?.target.id); };
  inject({ type: "tool_use", id: traceId, name, input: redactModuleData(snapshot) as Record<string, unknown> });
  let success = false;
  try {
    const result = await tool.handler(snapshot);
    const output = redactModuleData(result.output);
    success = result.ok;
    inject({ type: "tool_result", id: traceId, success, output: (typeof output === "string" ? output : (JSON.stringify(output) ?? "")).slice(0, 8000) });
    return { ...result, output };
  } catch (error) { inject({ type: "tool_result", id: traceId, success: false, output: "Module operation failed" }); throw error; }
  finally {
    if (scope.trace && !name.startsWith("servers.")) void assistantAuditRepository.append({ ts: new Date().toISOString(), provider: "module-tools", tool: name, success, durationMs: Date.now() - started, userId: String((scope.user ?? getContextUser())?.userId ?? "") }, scope.executor);
  }
  } finally { admission?.release(); }
}
export function moduleDiscoveryTools(scope: Scope): AgentTool[] {
  const make = (name: string, description: string, properties: Record<string, unknown>, required: string[], handler: AgentTool["handler"], kind: "read" | "action" = "read"): AgentTool => ({ name: `modules.${name}`, title: name, description, inputSchema: { type: "object", properties, required, additionalProperties: false }, kind, dangerous: false, handler });
  const selector = { moduleId: { type: "string" }, tool: { type: "string" }, revision: { type: "string" }, input: { type: "object" } };
  const dispatch = (kind: "read" | "action"): AgentTool["handler"] => async value => {
    const input = value as Record<string, unknown>;
    if (!input || typeof input.tool !== "string" || typeof input.revision !== "string") return { ok: false, output: "Discover the tool first and supply its revision" };
    const tool = (await currentTools(scope)).find(tool => tool.name === input.tool);
    if (!tool || tool.kind !== kind || (input.moduleId !== undefined && input.moduleId !== agentCapabilityRegistry.findTool(tool.name)?.moduleId)) return { ok: false, output: "Tool unavailable or incorrect operation kind" };
    return executeModuleTool(tool.name, input.input ?? {}, { ...scope, revision: input.revision, trace: true });
  };
  return [
    make("list", "List modules on the connected server, their current tools and unavailability reasons. The codebase graph uses its separate project-scoped graph.* channel. Discover tools before managing a module.", {}, [], async () => {
      const tools = await currentTools(scope), ids = new Set(tools.map(tool => agentCapabilityRegistry.findTool(tool.name)!.moduleId));
      const executor = scope.executor ?? getContextExecutor(), user = scope.user ?? getContextUser();
      if (!executor || !user || getContextExecutor() !== executor) return { ok: false, output: "Authenticated server context required" };
      const live = await resolveLiveAuthorization(user, executor);
      const catalog = await assistantModulesService.discoveryCatalog(executor, live);
      for (const id of ids) if (!catalog.some(entry => entry.moduleId === id)) catalog.push({ moduleId: id, catalogModuleId: agentCapabilityRegistry.get(id)?.catalogModuleId ?? id, name: id, description: "", channel: undefined, unavailableReason: undefined });
      return { ok: true, output: catalog.map(entry => {
        const count = tools.filter(tool => agentCapabilityRegistry.findTool(tool.name)?.moduleId === entry.moduleId).length;
        return { ...entry, revision: moduleToolRevision(entry.moduleId, executor), tools: count, unavailableReason: entry.unavailableReason ?? (!count && !entry.channel ? "no-permitted-tools" : undefined) };
      }) };
    }),
    make("describe", "Describe permitted tools of a module, including their input schemas and current revision. The admin module includes the module manager: list, enable, disable, update and configuration.", { moduleId: { type: "string" } }, ["moduleId"], async value => {
      const id = (value as { moduleId: string }).moduleId, tools = await currentTools(scope);
      return { ok: true, output: tools.filter(tool => agentCapabilityRegistry.findTool(tool.name)?.moduleId === id).map(({ handler: _handler, ...tool }) => ({ ...tool, revision: moduleToolRevision(id, scope.executor ?? getContextExecutor()) })) };
    }),
    make("read", "Invoke a discovered read tool. Supply the exact tool name, revision and input from modules.describe.", selector, ["tool", "revision"], dispatch("read")),
    make("execute", "Invoke a discovered action. Live permissions and user approval apply. Supply the exact tool name, revision and input from modules.describe.", selector, ["tool", "revision"], dispatch("action"), "action"),
  ];
}
