// SPDX-License-Identifier: AGPL-3.0-only
import path from "node:path";
import { AppError, type ErrorCode } from "../../../shared/errors/index.js";
import { getContextExecutor, getContextUser, getContextUserId, type Executor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { agentsRepository } from "../repositories/agents.repository.js";
import { agentRolesRepository } from "../repositories/agent-roles.repository.js";
import { projectsRepository, type AssistantProject } from "../repositories/projects.repository.js";
import { agentAssignments, type AssistantAgent, type EffectiveAssignment } from "../models/assistant-agent.types.js";
import type { AssistantRole } from "../models/assistant-role.types.js";
import { normalizeAllowedTools } from "./tool-allowlist.js";
import { projectClosure } from "./project-closure.js";
import { assertAssignmentTarget, markAssignmentAdmission, withAssignmentLock } from "./agent-assignment-lock.js";

export function assignmentError(code: ErrorCode, message: string, status = 409): AppError {
  return new AppError(message, status, code);
}
export function mayUseProject(project: { ownerId?: number | null }, user: SessionUser | null | undefined = getContextUser()): boolean {
  const uid = user?.userId ?? getContextUserId();
  return uid != null && (project.ownerId === uid || (project.ownerId == null && user?.role === "admin"));
}
export function assertProjectAccess(project: AssistantProject | null | undefined, user?: SessionUser): asserts project is AssistantProject {
  if (!project) throw assignmentError("ASSISTANT_PROJECT_NOT_FOUND", "Proyecto no encontrado.", 404);
  if (!mayUseProject(project, user ?? getContextUser())) throw assignmentError("ASSISTANT_PROJECT_FORBIDDEN", "No tienes acceso a este proyecto.", 403);
}
export function projectAncestors(all: AssistantProject[], id: string): AssistantProject[] {
  const byId = new Map(all.map(p => [p.id, p]));
  const out: AssistantProject[] = [], seen = new Set<string>();
  let current = byId.get(id);
  while (current?.id) {
    if (seen.has(current.id)) throw assignmentError("ASSISTANT_PROJECT_FORBIDDEN", "La jerarquía del proyecto no es válida.", 403);
    seen.add(current.id); out.unshift(current);
    if (current.parentId && !byId.has(current.parentId)) throw assignmentError("ASSISTANT_PROJECT_FORBIDDEN", "No se pudo verificar el proyecto padre.", 403);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return out;
}
export function assertProjectScope(all: AssistantProject[], projectId: string, user?: SessionUser): AssistantProject[] {
  assertProjectAccess(all.find(p => p.id === projectId), user);
  const ancestors = projectAncestors(all, projectId);
  for (const project of ancestors) assertProjectAccess(project, user);
  return ancestors;
}

/** A visible leaf must also have a complete, authorized ancestry. */
export function visibleProjects(all: AssistantProject[], user?: SessionUser): AssistantProject[] {
  return all.filter(project => {
    if (!project.id) return false;
    try { assertProjectScope(all, project.id, user); return true; }
    catch (error) {
      if (!(error instanceof AppError) || ![403, 404].includes(error.statusCode)) throw error;
      return false;
    }
  });
}

export function effectiveAssignment(agent: AssistantAgent, all: AssistantProject[], projectId: string): EffectiveAssignment | null {
  const assignments = agentAssignments(agent);
  for (const project of projectAncestors(all, projectId).reverse()) {
    const found = assignments.find(a => a.projectId === project.id && a.status === "active");
    if (found) return { ...found, projectId, inheritedFrom: found.projectId === projectId ? null : found.projectId };
  }
  return null;
}
export function intersectLists<T>(base: T[] | null | undefined, limit: T[] | null | undefined): T[] | null {
  if (limit == null) return base ?? null;
  return base == null ? [...limit] : base.filter(v => limit.includes(v));
}
function intersectToolLimits(...lists: (string[] | null | undefined)[]): string[] | null {
  return lists.reduce<string[] | null>((current, list) => intersectLists(current,
    normalizeAllowedTools(list, { onUnknown: "drop", context: "agent-assignment" })?.valid ?? null), null);
}
const within = (child: string, parent: string) => child === parent || child.startsWith(parent === "/" ? "/" : parent + "/");
export function intersectPaths(base: string[], limit: string[] | null | undefined): string[] {
  const roots = base.map(p => path.posix.resolve(p));
  if (limit == null) return [...new Set(roots)];
  return [...new Set(roots.flatMap(a => limit.map(p => path.posix.resolve(p)).flatMap(b =>
    within(a,b) ? [a] : within(b,a) ? [b] : [])))];
}
export interface AgentContext {
  agent: AssistantAgent | null;
  role: AssistantRole | null;
  projectId: string | null;
  assignment: EffectiveAssignment | null;
  projects: AssistantProject[];
  ancestors: AssistantProject[];
  contextProjects: AssistantProject[];
}
/** Fail closed. Fresh on every admission and protected tool dispatch. */
export async function resolveAgentContext(executor: Executor | null | undefined, agentId?: string | null, requestedProjectId?: string | null, user?: SessionUser, inferProject = true): Promise<AgentContext> {
  if (!executor) throw assignmentError("ASSISTANT_PROJECT_FORBIDDEN", "Se requiere el servidor conectado.", 403);
  assertAssignmentTarget(executor);
  const original = agentId ? await agentsRepository.get(agentId) : null;
  if (agentId && !original) throw assignmentError("ASSISTANT_AGENT_NOT_FOUND", "Agente no encontrado.", 404);
  if (original && !mayUseProject(original, user ?? getContextUser())) throw assignmentError("ASSISTANT_PROJECT_FORBIDDEN", "No tienes acceso a este agente.", 403);
  const assignments = original ? agentAssignments(original) : [];
  let projectId = requestedProjectId || null;
  if (!projectId && assignments.length) {
    if (!inferProject) throw assignmentError("ASSISTANT_CONTEXT_MISMATCH", "Abre una conversación nueva para usar la asignación del agente.");
    const active = assignments.filter(a => a.status === "active");
    if (active.length > 1) throw assignmentError("ASSISTANT_PROJECT_REQUIRED", "Selecciona un proyecto para ejecutar este agente.", 400);
    if (!active.length) throw assignmentError("ASSISTANT_ASSIGNMENT_REMOVED", "Reincorpora el agente a un proyecto antes de ejecutarlo.");
    projectId = active[0]!.projectId; // cardinality proven; never first of multiple
  }
  const all = projectId ? await projectsRepository.list(executor) : [];
  const projects = visibleProjects(all, user);
  let ancestors: AssistantProject[] = [], contextProjects: AssistantProject[] = [];
  let assignment: EffectiveAssignment | null = null;
  if (projectId) {
    ancestors = assertProjectScope(all, projectId, user);
    if (original) {
      assignment = effectiveAssignment(original, all, projectId);
      if (!assignment) {
        const removed = assignments.some(a => a.status === "removed" && ancestors.some(p => p.id === a.projectId));
        throw assignmentError(removed ? "ASSISTANT_ASSIGNMENT_REMOVED" : "ASSISTANT_PROJECT_FORBIDDEN",
          removed ? "La asignación está retirada. Reincorpora el agente antes de ejecutarlo." : "El agente no está asignado a este proyecto.", removed ? 409 : 403);
      }
    }
    // Descendants must have an entirely authorized chain, not just an owned leaf.
    const closure = projectClosure(projects, [projectId]);
    contextProjects = projects.filter(p => p.id && closure.has(p.id));
  }
  let agent = original ? { ...original } : null;
  const baseRole = original?.roleId ? await agentRolesRepository.get(original.roleId) : null;
  if (original?.roleId && !baseRole) throw assignmentError("ASSISTANT_PROJECT_FORBIDDEN", "No se pudo verificar el rol del perfil.", 403);
  let role = baseRole;
  if (agent && assignment) {
    const localRole = assignment.roleId ? await agentRolesRepository.get(assignment.roleId) : null;
    if (assignment.roleId && (!localRole || !mayUseProject(localRole, user ?? getContextUser()))) throw assignmentError("ASSISTANT_PROJECT_FORBIDDEN", "No se pudo verificar el rol de la asignación.", 403);
    if (localRole) role = { ...localRole,
      systemPrompt: [baseRole?.systemPrompt, localRole.id === baseRole?.id ? "" : localRole.systemPrompt].filter(Boolean).join("\n\n"),
      allowedTools: intersectToolLimits(baseRole?.allowedTools, localRole.allowedTools),
      canSpawnChats: Boolean(baseRole?.canSpawnChats),
    };
    const supervisor = Boolean(agent.canSpawnChats || baseRole?.canSpawnChats) && assignment.canSpawnChats !== false;
    if (role) role = { ...role, canSpawnChats: supervisor };
    agent = { ...agent, canSpawnChats: supervisor, roleId: assignment.roleId ?? agent.roleId,
      allowedTools: intersectToolLimits(agent.allowedTools, baseRole?.allowedTools, localRole?.allowedTools, assignment.allowedTools),
      systemPrompt: [agent.systemPrompt, assignment.jobTitle ? "Cargo en este proyecto: " + assignment.jobTitle : "", assignment.instructions].filter(Boolean).join("\n\n"),
      projectIds: [projectId!],
      projectPaths: intersectPaths(intersectPaths(contextProjects.map(p => p.path).filter(Boolean), agent.projectPaths?.length ? agent.projectPaths : null), assignment.projectPaths),
      graphProjectIds: contextProjects.filter(p => p.id && (assignment.graphProjectIds == null || assignment.graphProjectIds.includes(p.id)) && (!agent!.graphProjectIds?.length || agent!.graphProjectIds.includes(p.id))).map(p => p.id!),
      servers: ancestors.flatMap(p => p.servers ?? []).filter((server,index,servers) =>
        servers.findIndex(s => s.id === server.id) === index &&
        (assignment.serverIds == null || assignment.serverIds.includes(server.id)) &&
        (!original!.servers?.length || original!.servers.some(s => s.id === server.id))),
      teamId: ancestors[0]?.teamId ?? (assignment.source === "legacy" ? agent.teamId : null),
      parentAgentId: assignment.parentAgentId !== undefined ? assignment.parentAgentId :
        assignment.source === "legacy" ? agent.parentAgentId :
        ancestors[0]?.leaderAgentId === agent.id ? null : ancestors[0]?.leaderAgentId ?? null,
      connections: assignment.connections ?? agent.connections,

    };
  }
  return { agent, role, projectId, assignment, projects, ancestors, contextProjects };
}
export async function admitAgentWork(executor: Executor | null | undefined, agentId?: string | null, projectId?: string | null, user?: SessionUser) {
  const target = executor ?? getContextExecutor();
  if (!target) throw assignmentError("ASSISTANT_PROJECT_FORBIDDEN", "Se requiere el servidor conectado.", 403);
  const admit = async () => {
    const context = await resolveAgentContext(target, agentId, projectId, user);
    const release = agentId ? markAssignmentAdmission(target, agentId, context.projectId) : () => {};
    return { ...context, release };
  };
  return agentId ? withAssignmentLock(target, agentId, admit) : admit();
}
export async function scopedAgents(executor: Executor, agents: AssistantAgent[], projectId: string | null, user?: SessionUser): Promise<AssistantAgent[]> {
  const out: AssistantAgent[] = [];
  for (const agent of agents) {
    try {
      if (!projectId && agentAssignments(agent).length) continue;
      const resolved = await resolveAgentContext(executor, agent.id, projectId, user);
      if (resolved.agent) out.push(resolved.agent);
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode >= 500) throw error;
    }
  }
  return out;
}

/** A conversation cannot carry another project's transcript into a new run. */
export async function resolveConversationBinding(executor: Executor | null | undefined, input: { conversationId?: string; agentId?: string | null; projectId?: string | null }, user?: SessionUser) {
  const target = executor ?? getContextExecutor();
  if (!target) throw assignmentError("ASSISTANT_PROJECT_FORBIDDEN", "Se requiere el servidor conectado.", 403);
  assertAssignmentTarget(target);
  const meta = input.conversationId ? await conversationsRepository.getMeta(target, input.conversationId) : null;
  // null/omitted input means resume. Even an empty persisted chat keeps its identity.
  if (meta && ((input.agentId && input.agentId !== meta.agentId) ||
      (input.projectId && input.projectId !== meta.projectId))) {
    throw assignmentError("ASSISTANT_CONTEXT_MISMATCH", "Abre una conversación nueva para cambiar de agente o proyecto.");
  }
  const agentId = meta ? meta.agentId ?? null : input.agentId || null;
  const projectId = meta ? meta.projectId ?? null : input.projectId;
  const context = await resolveAgentContext(target, agentId, projectId, user, !meta);
  return { ...context, agentId };
}
