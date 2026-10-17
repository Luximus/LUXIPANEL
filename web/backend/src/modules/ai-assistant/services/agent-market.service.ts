// SPDX-License-Identifier: AGPL-3.0-only
import type { Executor } from "../../../shared/executor/index.js";
import { getContextUser, getContextUserId } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { agentsRepository } from "../repositories/agents.repository.js";
import { projectsRepository } from "../repositories/projects.repository.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { agentQueueRepository } from "../repositories/agent-queue.repository.js";
import { cliJobsRepository } from "../repositories/cli-jobs.repository.js";
import { teamTasksRepository } from "../repositories/team-tasks.repository.js";
import { agentRolesRepository } from "../repositories/agent-roles.repository.js";
import { agentAssignments, type AssistantAgent, type AssignmentPatch, type AgentProjectAssignment } from "../models/assistant-agent.types.js";
import { agentRunRegistry } from "./agent-run-registry.js";
import { permissionBroker } from "./permission-broker.js";
import { assignmentError, assertProjectAccess, effectiveAssignment, mayUseProject } from "./agent-context.service.js";
import { withAssignmentLock, hasAssignmentAdmission } from "./agent-assignment-lock.js";
import { projectClosure } from "./project-closure.js";
import { normalizeAllowedTools } from "./tool-allowlist.js";

async function ownedAgent(id: string) {
  const agent = await agentsRepository.get(id);
  if (!agent) throw assignmentError("ASSISTANT_AGENT_NOT_FOUND", "Agente no encontrado.", 404);
  if (agent.ownerId != null && agent.ownerId !== getContextUserId()) throw assignmentError("ASSISTANT_PROJECT_FORBIDDEN", "No puedes modificar este perfil.", 403);
  return agent;
}
export async function assertAssignmentIdle(executor: Executor, agent: AssistantAgent, projectIds: string[]): Promise<void> {
  const all = await projectsRepository.list(executor);
  const affected = projectClosure(all, projectIds);
  const busy = () => { throw assignmentError("ASSISTANT_ASSIGNMENT_BUSY", "Hay trabajo, preguntas o aprobaciones pendientes. Finalízalos antes de retirar o cambiar la asignación."); };
  if (hasAssignmentAdmission(executor, agent.id!, affected)) busy();
  const [tasks, pending, jobs, metas] = await Promise.all([
    teamTasksRepository.listActive(executor), agentQueueRepository.listPending(executor),
    cliJobsRepository.list(executor), conversationsRepository.listActivity(executor),
  ]);
  const touches = (id?: string | null) => !id || affected.has(id);
  if (tasks.some(t => (t.workerAgentId === agent.id || t.leaderAgentId === agent.id) && touches(t.projectId))) busy();
  if (pending.some(q => q.agentId === agent.id && touches(q.projectId))) busy();
  for (const meta of metas.filter(c => c.agentId === agent.id && touches(c.projectId))) {
    if (!meta.id) continue;
    if (agentRunRegistry.isActive(meta.id, executor.target.id) || permissionBroker.pendingCount(meta.id) ||
        pending.some(q => q.conversationId === meta.id) || jobs.some(j => j.conversationId === meta.id)) busy();
    const messages = await conversationsRepository.messages(executor, meta.id, { limit: 1 });
    const last = messages.items.at(-1);
    if (last?.role === "assistant" && last.ask?.length) busy();
  }
}
async function validatePatch(patch: AssignmentPatch, user?: SessionUser): Promise<AssignmentPatch> {
  const clean = { ...patch };
  if (clean.allowedTools) clean.allowedTools = normalizeAllowedTools(clean.allowedTools, { onUnknown: "reject", context: "agent-assignment" })!.valid;
  if (clean.roleId) {
    const role = await agentRolesRepository.get(clean.roleId);
    if (!role || !mayUseProject(role, user ?? getContextUser())) throw assignmentError("ASSISTANT_PROJECT_FORBIDDEN", "Rol no disponible.", 403);
  }
  return clean;
}
function rows(agent: AssistantAgent): AgentProjectAssignment[] {
  return agentAssignments(agent).map(({ source: _source, ...a }) => a);
}
async function persist(id: string, assignments: AgentProjectAssignment[]) {
  const saved = await agentsRepository.setAssignments(id, assignments, assignments.filter(a => a.status === "active").map(a => a.projectId));
  if (!saved) throw assignmentError("ASSISTANT_AGENT_NOT_FOUND", "Agente no encontrado.", 404);
  return saved;
}
export const agentMarketService = {
  async present(executor: Executor, agent: AssistantAgent, user?: SessionUser) {
    const all = await projectsRepository.list(executor);
    const visible = new Set(all.filter(p => mayUseProject(p, user ?? getContextUser())).map(p => p.id));
    const assignments = agentAssignments(agent).filter(a => visible.has(a.projectId));
    return { ...agent, specialty: agent.specialty ?? "", technologies: agent.technologies ?? [],
      assignments, projectIds: assignments.filter(a => a.status === "active").map(a => a.projectId) };
  },
  async assignments(executor: Executor, id: string, projectId?: string, user?: SessionUser) {
    const agent = await agentsRepository.get(id);
    if (!agent) throw assignmentError("ASSISTANT_AGENT_NOT_FOUND", "Agente no encontrado.", 404);
    const all = await projectsRepository.list(executor);
    if (projectId) assertProjectAccess(all.find(p => p.id === projectId), user);
    const presented = await this.present(executor, agent, user);
    return { assignments: presented.assignments, effective: projectId ? effectiveAssignment(agent, all, projectId) : null };
  },
  async put(executor: Executor, id: string, projectId: string, patch: AssignmentPatch, user?: SessionUser) {
    return withAssignmentLock(executor, id, async () => {
      const agent = await ownedAgent(id);
      assertProjectAccess(await projectsRepository.get(executor, projectId), user);
      const clean = await validatePatch(patch, user);
      const assignments = rows(agent);
      const index = assignments.findIndex(a => a.projectId === projectId);
      const prior = assignments[index];
      const same = prior?.status === "active" && Object.entries(clean).every(([k,v]) => JSON.stringify(prior[k as keyof AgentProjectAssignment]) === JSON.stringify(v));
      if (same) return { ...prior, source: agent.assignments?.some(a => a.projectId === projectId) ? "explicit" : "legacy" };
      // Also guard first explicit override of an inherited assignment.
      await assertAssignmentIdle(executor, agent, [projectId]);
      const now = new Date().toISOString();
      const assignment: AgentProjectAssignment = { ...prior, ...clean, projectId, status: "active", createdAt: prior?.createdAt ?? now, updatedAt: now };
      delete assignment.removedAt;
      if (index < 0) assignments.push(assignment); else assignments[index] = assignment;
      await persist(id, assignments);
      return { ...assignment, source: "explicit" as const };
    });
  },
  async remove(executor: Executor, id: string, projectId: string, user?: SessionUser) {
    return withAssignmentLock(executor, id, async () => {
      const agent = await ownedAgent(id), all = await projectsRepository.list(executor);
      assertProjectAccess(all.find(p => p.id === projectId), user);
      const assignments = rows(agent);
      const current = assignments.find(a => a.projectId === projectId);
      const after = { ...agent, assignments: assignments.filter(a => a.projectId !== projectId), projectIds: (agent.projectIds ?? []).filter(p => p !== projectId) };
      if (effectiveAssignment(after, all, projectId)) throw assignmentError("ASSISTANT_ASSIGNMENT_INHERITED", "Esta asignación se hereda. Retira el vínculo desde el proyecto de origen.");
      if (!current || current.status === "removed") return;
      await assertAssignmentIdle(executor, agent, [projectId]);
      current.status = "removed"; current.removedAt = current.updatedAt = new Date().toISOString();
      await persist(id, assignments);
    });
  },
  /** Compatibility write is atomic: authorize every addition/removal before persisting any. */
  async updateProfile(executor: Executor, id: string, patch: Parameters<typeof agentsRepository.update>[1], user?: SessionUser) {
    return withAssignmentLock(executor, id, async () => {
      const agent = await ownedAgent(id);
      if (patch.projectIds === undefined) return agentsRepository.update(id, patch);
      const wanted = [...new Set(patch.projectIds)];
      const all = await projectsRepository.list(executor);
      for (const pid of wanted) assertProjectAccess(all.find(p => p.id === pid), user);
      const assignments = rows(agent), old = assignments.filter(a => a.status === "active").map(a => a.projectId);
      const removed = old.filter(p => !wanted.includes(p)), added = wanted.filter(p => !old.includes(p));
      for (const pid of removed) assertProjectAccess(all.find(p => p.id === pid), user);
      if (removed.length || added.length) await assertAssignmentIdle(executor, agent, [...removed, ...added]);
      const now = new Date().toISOString();
      for (const a of assignments) if (removed.includes(a.projectId)) { a.status = "removed"; a.removedAt = a.updatedAt = now; }
      for (const pid of added) {
        const a = assignments.find(a => a.projectId === pid);
        if (a) { a.status = "active"; a.updatedAt = now; delete a.removedAt; }
        else assignments.push({ projectId: pid, status: "active", createdAt: now, updatedAt: now });
      }
      const next = { ...agent, assignments, projectIds: wanted };
      for (const pid of removed) if (effectiveAssignment(next, all, pid)) throw assignmentError("ASSISTANT_ASSIGNMENT_INHERITED", "El proyecto conserva una asignación heredada.");
      // Store fields and links together so a failed profile write cannot partially withdraw.
      return agentsRepository.updateWithAssignments(id, patch, assignments, wanted);
    });
  },
};
