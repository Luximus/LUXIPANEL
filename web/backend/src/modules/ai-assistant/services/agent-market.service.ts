// SPDX-License-Identifier: AGPL-3.0-only
import { agentMessagesRepository } from "../repositories/agent-messages.repository.js";
import type { Executor } from "../../../shared/executor/index.js";
import { AppError } from "../../../shared/errors/index.js";
import type { AgentMarketProfile, AgentMarketContext, AgentMarketExecution } from "../models/agent-market.types.js";
import { getContextUser } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { agentsRepository } from "../repositories/agents.repository.js";
import { projectsRepository, type AssistantProject } from "../repositories/projects.repository.js";
import { agentActivityRepository } from "../repositories/agent-activity.repository.js";
import { agentQueueRepository } from "../repositories/agent-queue.repository.js";
import { teamTasksRepository } from "../repositories/team-tasks.repository.js";
import { agentRolesRepository } from "../repositories/agent-roles.repository.js";
import { agentAssignments, type AssistantAgent, type AssignmentPatch, type AgentProjectAssignment } from "../models/assistant-agent.types.js";
import { agentRunRegistry } from "./agent-run-registry.js";
import { permissionBroker } from "./permission-broker.js";
import { assignmentError, assertProjectScope, effectiveAssignment, mayUseProject, resolveAgentContext, visibleProjects, intersectLists } from "./agent-context.service.js";
import { assertAssignmentTarget, withAssignmentLock, hasAssignmentAdmission } from "./agent-assignment-lock.js";
import { projectClosure } from "./project-closure.js";
import { normalizeAllowedTools } from "./tool-allowlist.js";

async function ownedAgent(id: string, user?: SessionUser) {
  const agent = await agentsRepository.get(id);
  if (!agent) throw assignmentError("ASSISTANT_AGENT_NOT_FOUND", "Agente no encontrado.", 404);
  if (!mayUseProject(agent, user ?? getContextUser())) throw assignmentError("ASSISTANT_PROJECT_FORBIDDEN", "No puedes modificar este perfil.", 403);
  return agent;
}
export async function assertAssignmentIdle(executor: Executor, agent: AssistantAgent, projectIds: string[]): Promise<void> {
  const all = await projectsRepository.list(executor);
  const affected = projectClosure(all, projectIds);
  const busy = () => { throw assignmentError("ASSISTANT_ASSIGNMENT_BUSY", "Hay trabajo, preguntas o aprobaciones pendientes. Finalízalos antes de retirar o cambiar la asignación."); };
  if (hasAssignmentAdmission(executor, agent.id!, affected)) busy();
  const [tasks, pending, activity, messages] = await Promise.all([
    teamTasksRepository.listActive(executor), agentQueueRepository.listPending(executor),
    agentActivityRepository.forAssignment(executor, agent.id!, affected), agentMessagesRepository.listPending(executor),
  ]);
  const touches = (id?: string | null) => !id || affected.has(id);
  if (tasks.some(t => (t.workerAgentId === agent.id || t.leaderAgentId === agent.id) && touches(t.projectId))) busy();
  if (messages.some(m => (m.toAgentId === agent.id || m.fromAgentId === agent.id) && touches(m.projectId))) busy();
  if (pending.some(q => q.agentId === agent.id && touches(q.projectId))) busy();
  for (const item of activity) {
    if (item.pendingQuestion || item.pendingCliJob ||
        agentRunRegistry.isActive(item.conversationId, executor.target.id) || permissionBroker.pendingCount(item.conversationId) ||
        pending.some(q => q.conversationId === item.conversationId)) busy();
  }
}
async function validatePatch(executor: Executor, agentId: string, projectId: string, patch: AssignmentPatch, user?: SessionUser): Promise<AssignmentPatch> {
  const clean = { ...patch };
  const scope = await resolveAgentContext(executor, null, projectId, user);
  if (clean.graphProjectIds?.some(id => !scope.contextProjects.some(p => p.id === id)) ||
      clean.serverIds?.some(id => !scope.ancestors.some(p => p.servers?.some(server => server.id === id)))) {
    throw assignmentError("ASSISTANT_PROJECT_FORBIDDEN", "El acceso contextual debe pertenecer a este proyecto.", 403);
  }
  if (clean.allowedTools) clean.allowedTools = normalizeAllowedTools(clean.allowedTools, { onUnknown: "reject", context: "agent-assignment" })!.valid;
  if (clean.roleId) {
    const role = await agentRolesRepository.get(clean.roleId);
    if (!role || !mayUseProject(role, user ?? getContextUser())) throw assignmentError("ASSISTANT_PROJECT_FORBIDDEN", "Rol no disponible.", 403);
  }
  const relationError = () => assignmentError("ASSISTANT_PROJECT_FORBIDDEN", "La relación de equipo debe pertenecer a este proyecto y no formar ciclos.", 403);
  for (const id of new Set([clean.parentAgentId, ...(clean.connections ?? [])].filter((id): id is string => !!id))) {
    if (id === agentId) throw relationError();
    await resolveAgentContext(executor, id, projectId, user);
  }
  if (clean.parentAgentId) {
    const seen = new Set([agentId]);
    let parent: string | null | undefined = clean.parentAgentId;
    while (parent) {
      if (seen.has(parent)) throw relationError();
      seen.add(parent);
      parent = (await resolveAgentContext(executor, parent, projectId, user)).agent?.parentAgentId;
    }
  }
  return clean;
}
function rows(agent: AssistantAgent): AgentProjectAssignment[] {
  return agentAssignments(agent).map(({ source: _source, ...a }) => a);
}
async function persist(id: string, assignments: AgentProjectAssignment[]) {
  const prior = await agentsRepository.get(id);
  const explicit = assignments.filter(a => a.updatedAt || a.createdAt || a.status === "removed" || prior?.assignments?.some(p => p.projectId === a.projectId));
  const saved = await agentsRepository.setAssignments(id, explicit, assignments.filter(a => a.status === "active").map(a => a.projectId));
  if (!saved) throw assignmentError("ASSISTANT_AGENT_NOT_FOUND", "Agente no encontrado.", 404);
  return saved;
}
export const agentMarketService = {
  async present(executor: Executor, agent: AssistantAgent, user?: SessionUser,
    options: { contextProjectId?: string; projects?: AssistantProject[] } = {}): Promise<AgentMarketProfile> {
    assertAssignmentTarget(executor);
    const all = options.projects ?? await projectsRepository.list(executor);
    const visible = new Set(visibleProjects(all, user).map(p => p.id));
    const assignments = agentAssignments(agent).filter(a => visible.has(a.projectId));
    const projectId = options.contextProjectId;
    const ancestors = projectId ? assertProjectScope(all, projectId, user) : [];
    const direct = assignments.find(a => a.projectId === projectId) ?? null;
    const effective = projectId ? effectiveAssignment(agent, all, projectId) : null;
    const canModify = mayUseProject(agent, user ?? getContextUser());
    let execution: AgentMarketExecution = { projectId: projectId ?? null, error: null };
    let effectiveConfig: AgentMarketContext["effectiveConfig"] = null;
    try {
      if (!agent.id) throw assignmentError("ASSISTANT_AGENT_NOT_FOUND", "Agente no encontrado.", 404);
      const resolved = await resolveAgentContext(executor, agent.id, projectId, user);
      const active = resolved.agent;
      execution.projectId = resolved.projectId;
      if (active && projectId) effectiveConfig = {
        systemPrompt: [resolved.role?.systemPrompt, active.systemPrompt].filter(Boolean).join("\n\n"),
        roleId: active.roleId ?? null,
        allowedTools: intersectLists(active.allowedTools, resolved.role?.allowedTools),
        canSpawnChats: Boolean(active.canSpawnChats || resolved.role?.canSpawnChats),
        projectPaths: active.projectPaths ?? [], serverIds: (active.servers ?? []).map(s => s.id),
        graphProjectIds: active.graphProjectIds ?? [], teamId: active.teamId ?? null,
        parentAgentId: active.parentAgentId ?? null, connections: active.connections ?? [],
      };
    } catch (error) {
      if (!(error instanceof AppError) || ![400, 403, 404, 409].includes(error.statusCode)) throw error;
      execution = { projectId: projectId ?? null, error: { code: error.code, statusCode: error.statusCode, message: error.message } };
    }
    const inheritedFallback = projectId && direct?.status === "active" && ancestors.slice(0, -1)
      .some(p => assignments.some(a => a.projectId === p.id && a.status === "active"));
    return { ...agent, specialty: agent.specialty ?? "", technologies: agent.technologies ?? [],
      assignments, graphProjectIds: (agent.graphProjectIds ?? []).filter(id => visible.has(id)),
      projectIds: assignments.filter(a => a.status === "active").map(a => a.projectId),
      capabilities: {
        canEditProfile: canModify, canDeleteProfile: canModify,
        canAssign: canModify && !!projectId && direct?.status !== "active",
        canUpdateAssignment: canModify && direct?.status === "active",
        canRemoveAssignment: canModify && direct?.status === "active" && !inheritedFallback,
        canExecute: execution.error === null,
      },
      execution,
      context: projectId ? { projectId, directAssignment: direct, effectiveAssignment: effective, effectiveConfig,
        membership: effective ? effective.inheritedFrom ? "inherited" : "direct" :
          assignments.some(a => a.status === "removed" && ancestors.some(p => p.id === a.projectId)) ? "removed" : "none",
      } : null,
    };
  },
  async assignments(executor: Executor, id: string, projectId?: string, user?: SessionUser) {
    assertAssignmentTarget(executor);
    const agent = await agentsRepository.get(id);
    if (!agent) throw assignmentError("ASSISTANT_AGENT_NOT_FOUND", "Agente no encontrado.", 404);
    const all = await projectsRepository.list(executor);
    if (projectId) assertProjectScope(all, projectId, user);
    const presented = await this.present(executor, agent, user);
    return { assignments: presented.assignments, effective: projectId ? effectiveAssignment(agent, all, projectId) : null };
  },
  async put(executor: Executor, id: string, projectId: string, patch: AssignmentPatch, user?: SessionUser) {
    return withAssignmentLock(executor, id, async () => {
      const agent = await ownedAgent(id, user);
      const clean = await validatePatch(executor, id, projectId, patch, user);
      const assignments = rows(agent);
      const index = assignments.findIndex(a => a.projectId === projectId);
      const prior = assignments[index];
      const same = prior?.status === "active" && Object.entries(clean).every(([k,v]) => JSON.stringify(prior[k as keyof AgentProjectAssignment]) === JSON.stringify(v));
      if (same) return { ...prior, source: agent.assignments?.some(a => a.projectId === projectId) ? "explicit" : "legacy" };
      // Also guard first explicit override of an inherited assignment.
      await assertAssignmentIdle(executor, agent, [projectId]);
      const now = new Date().toISOString();
      const legacyParent = prior && !agent.assignments?.some(a => a.projectId === projectId) ? { parentAgentId: agent.parentAgentId ?? null } : {};
      const assignment: AgentProjectAssignment = { ...legacyParent, ...prior, ...clean, projectId, status: "active", createdAt: prior?.createdAt ?? now, updatedAt: now };
      delete assignment.removedAt;
      if (index < 0) assignments.push(assignment); else assignments[index] = assignment;
      await persist(id, assignments);
      return { ...assignment, source: "explicit" as const };
    });
  },
  async remove(executor: Executor, id: string, projectId: string, user?: SessionUser) {
    return withAssignmentLock(executor, id, async () => {
      const agent = await ownedAgent(id, user), all = await projectsRepository.list(executor);
      assertProjectScope(all, projectId, user);
      const assignments = rows(agent);
      const current = assignments.find(a => a.projectId === projectId);
      const after = { ...agent, assignments: assignments.filter(a => a.projectId !== projectId), projectIds: (agent.projectIds ?? []).filter(p => p !== projectId) };
      if (effectiveAssignment(after, all, projectId)) throw assignmentError("ASSISTANT_ASSIGNMENT_INHERITED", "Esta asignación se hereda. Retira el vínculo desde el proyecto de origen.");
      if (!current || current.status === "removed") return;
      await assertAssignmentIdle(executor, agent, [projectId]);
      if (!agent.assignments?.some(a => a.projectId === projectId)) current.parentAgentId = agent.parentAgentId ?? null;
      current.status = "removed"; current.removedAt = current.updatedAt = new Date().toISOString();
      await persist(id, assignments);
    });
  },
  /** Compatibility write is atomic: authorize every addition/removal before persisting any. */
  async updateProfile(executor: Executor, id: string, patch: Parameters<typeof agentsRepository.update>[1], user?: SessionUser) {
    return withAssignmentLock(executor, id, async () => {
      const agent = await ownedAgent(id, user);
      if (patch.projectIds === undefined) return agentsRepository.update(id, patch);
      const wanted = [...new Set(patch.projectIds)];
      const all = await projectsRepository.list(executor);
      for (const pid of wanted) assertProjectScope(all, pid, user);
      const assignments = rows(agent), old = assignments.filter(a => a.status === "active").map(a => a.projectId);
      const removed = old.filter(p => !wanted.includes(p)), added = wanted.filter(p => !old.includes(p));
      for (const pid of removed) assertProjectScope(all, pid, user);
      if (removed.length || added.length) await assertAssignmentIdle(executor, agent, [...removed, ...added]);
      const now = new Date().toISOString();
      for (const a of assignments) if (removed.includes(a.projectId)) { if (!agent.assignments?.some(p => p.projectId === a.projectId)) a.parentAgentId = agent.parentAgentId ?? null; a.status = "removed"; a.removedAt = a.updatedAt = now; }
      for (const pid of added) {
        const a = assignments.find(a => a.projectId === pid);
        if (a) { a.status = "active"; a.updatedAt = now; delete a.removedAt; }
        else assignments.push({ projectId: pid, status: "active", createdAt: now, updatedAt: now });
      }
      const next = { ...agent, assignments, projectIds: wanted };
      for (const pid of removed) if (effectiveAssignment(next, all, pid)) throw assignmentError("ASSISTANT_ASSIGNMENT_INHERITED", "El proyecto conserva una asignación heredada.");
      // Store fields and links together so a failed profile write cannot partially withdraw.
      return agentsRepository.updateWithAssignments(id, patch, assignments.filter(a => a.updatedAt || a.createdAt || a.status === "removed" || agent.assignments?.some(p => p.projectId === a.projectId)), wanted);
    });
  },
};
