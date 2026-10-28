// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Keeps project folders, agent teams and their chats in one workspace. */
import { dataStore } from "../../../shared/data-store/index.js";
import { getContextUserId, type Executor } from "../../../shared/executor/index.js";
import { NotFoundError, ValidationError } from "../../../shared/errors/index.js";
import { agentsRepository } from "../repositories/agents.repository.js";
import { agentTeamsRepository } from "../repositories/agent-teams.repository.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { agentActivityRepository } from "../repositories/agent-activity.repository.js";
import { agentMessagesRepository } from "../repositories/agent-messages.repository.js";
import { agentQueueRepository } from "../repositories/agent-queue.repository.js";
import { teamTasksRepository } from "../repositories/team-tasks.repository.js";
import { projectsRepository, type AssistantProject } from "../repositories/projects.repository.js";
import { agentAssignments, type AssistantAgent } from "../models/assistant-agent.types.js";
import { assignmentError, effectiveAssignment, mayUseProject } from "./agent-context.service.js";
import type { AgentTeam } from "../models/assistant-team.types.js";
import { hasAssignmentAdmission } from "./agent-assignment-lock.js";
import { projectClosure, projectsOfClosure } from "./project-closure.js";

type CreateProject = Parameters<typeof projectsRepository.create>[1] & {
  teamName?: string;
  leaderName?: string;
  creationKey?: string;
};

const locks = new Map<string, Promise<unknown>>();
async function serial<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const running = previous.catch(() => undefined).then(work);
  locks.set(key, running);
  try { return await running; } finally { if (locks.get(key) === running) locks.delete(key); }
}

function own(ownerId: number | null | undefined, uid: number): boolean {
  return ownerId === uid;
}

function activeProjectIds(agent: AssistantAgent): string[] {
  return agentAssignments(agent).filter((assignment) => assignment.status === "active").map((assignment) => assignment.projectId);
}

/**
 * The project creation flow creates exactly one team and leader for a root.
 * Only that narrow, unused shape is safe to remove automatically: a custom
 * team or an agent reused elsewhere must stay untouched when a project folder
 * is deleted.
 */
function isExclusiveDefaultWorkspace(
  project: AssistantProject,
  leader: AssistantAgent | null,
  agents: AssistantAgent[],
  allProjects: AssistantProject[],
): leader is AssistantAgent {
  if (!project.id || !project.teamId || !project.leaderAgentId || !leader?.id) return false;
  if (leader.id !== project.leaderAgentId || leader.teamId !== project.teamId) return false;
  if (agents.filter((agent) => agent.teamId === project.teamId).length !== 1) return false;
  if (allProjects.some((candidate) => candidate.id !== project.id && candidate.teamId === project.teamId)) return false;
  const active = activeProjectIds(leader);
  return active.length === 1 && active[0] === project.id;
}

/**
 * Deleting an unused default leader is safe only when it has no durable
 * activity. This is deliberately narrower than `assertAssignmentIdle`: an
 * orphaned CLI job belonging to an unrelated historical profile must not stop
 * cleanup of a brand-new, otherwise isolated workspace.
 */
async function assertExclusiveWorkspaceUnused(
  executor: Executor,
  project: AssistantProject,
  leader: AssistantAgent,
  allProjects: AssistantProject[],
): Promise<void> {
  const scope = projectClosure(allProjects, [project.id!]);
  const busy = () => {
    throw assignmentError(
      "ASSISTANT_ASSIGNMENT_BUSY",
      "El espacio tiene actividad o historial asociado. Retira el líder manualmente antes de eliminar el proyecto.",
    );
  };
  if (hasAssignmentAdmission(executor, leader.id!, scope)) busy();
  const [tasks, pending, messages, activity] = await Promise.all([
    teamTasksRepository.listActive(executor),
    agentQueueRepository.listPending(executor),
    agentMessagesRepository.listPending(executor),
    agentActivityRepository.forAssignment(executor, leader.id!, scope, { includeUnattributedCliJobs: false }),
  ]);
  const touches = (projectId?: string | null) => !projectId || scope.has(projectId);
  if (tasks.some((task) => (task.leaderAgentId === leader.id || task.workerAgentId === leader.id) && touches(task.projectId))) busy();
  if (pending.some((turn) => turn.agentId === leader.id && touches(turn.projectId))) busy();
  if (messages.some((message) => (message.fromAgentId === leader.id || message.toAgentId === leader.id) && touches(message.projectId))) busy();
  // A conversation tied to the leader is preserved rather than silently
  // orphaned. A fresh workspace has no activity records, which is the case
  // eligible for automatic cleanup.
  if (activity.length > 0) busy();
}

async function addLeader(project: AssistantProject, team: AgentTeam, name?: string): Promise<AssistantAgent> {
  return agentsRepository.create({
    name: (name || `${project.title} · Líder`).slice(0, 120),
    description: [`Líder de ${project.title}`, (project.instructions ?? "").trim().replace(/\s+/g, " ")].filter(Boolean).join(" · ").slice(0, 500),
    // Bind the persona to the project. The runtime resolves its CURRENT
    // instructions, servers, skills, vault and children on every turn; copying
    // those here would keep obsolete instructions after a project is edited.
    systemPrompt: [
      `Eres el agente líder del proyecto ${project.title} (referencia: ${project.id}).`,
      "Coordina el trabajo del equipo y de sus subproyectos, que comparten este equipo.",
      "Antes de actuar utiliza el contexto vigente del proyecto y del subproyecto seleccionado: objetivos, instrucciones, directorio de trabajo, servidores asociados, habilidades, notas del vault y grafo de código cuando estén disponibles.",
      "Consulta los archivos de contexto del proyecto cuando necesites más detalle. No inventes datos que falten ni confundas proyectos o servidores.",
      "Delega a los agentes del equipo según sus funciones y el alcance de la tarea; conserva el contexto del chat, revisa sus resultados y comunica el resultado al usuario.",
      "Respeta los permisos y el modo de aprobación de la sesión. Los recursos asociados al proyecto no otorgan permisos adicionales.",
    ].join("\n"),
    model: "",
    providerId: project.provider,
    teamId: team.id,
    projectIds: project.id ? [project.id] : [],
    canSpawnChats: true,
  });
}

export const projectWorkspaceService = {
  async create(executor: Executor, data: CreateProject): Promise<{ project: AssistantProject; created: boolean }> {
    const uid = getContextUserId();
    return serial(`${executor.target.id}:${uid}:create:${data.creationKey || "new"}`, async () => {
      if (data.creationKey && uid != null) {
        const existing = (await projectsRepository.list(executor)).find((p) => p.creationKey === data.creationKey && own(p.ownerId, uid));
        if (existing) return { project: existing, created: false };
      }
      if (data.parentId) {
        const parent = await projectsRepository.get(executor, data.parentId);
        if (!parent || !mayUseProject(parent)) throw new NotFoundError("Proyecto padre no encontrado");
        return { project: await projectsRepository.create(executor, { ...data, teamId: null, leaderAgentId: null }), created: true };
      }
      const project = await projectsRepository.create(executor, data);
      let team: AgentTeam | null = null;
      let leader: AssistantAgent | null = null;
      try {
        team = await agentTeamsRepository.create({ name: (data.teamName || data.title).trim(), description: `Equipo de ${data.title}` });
        leader = await addLeader(project, team, data.leaderName?.trim());
        const linked = await projectsRepository.update(executor, project.id!, { teamId: team.id, leaderAgentId: leader.id });
        if (!linked) throw new Error("No se pudo vincular el equipo al proyecto");
        return { project: linked, created: true };
      } catch (error) {
        if (leader?.id) await agentsRepository.delete(leader.id).catch(() => undefined);
        if (team?.id) await agentTeamsRepository.delete(team.id).catch(() => undefined);
        if (project.id) await projectsRepository.delete(executor, project.id).catch(() => undefined);
        throw error;
      }
    });
  },

  /** Explicit, one-time repair per user and target. A marker prevents a later
   * voluntary deletion from regenerating the folder on every page load. */
  async repair(executor: Executor): Promise<{ repaired: boolean; projects: number; chats: number }> {
    const uid = getContextUserId();
    if (uid == null) return { repaired: false, projects: 0, chats: 0 };
    return serial(`${executor.target.id}:${uid}:repair`, async () => {
      const marker = dataStore<{ version: number; completedAt: string }>(executor, "assistant", "project-workspace-repair", { idStrategy: "uuid" });
      const markerId = `v1-user-${uid}`;
      if (await marker.get(markerId)) return { repaired: false, projects: 0, chats: 0 };
      const allProjects = await projectsRepository.list(executor);
      const projects = allProjects.filter((p) => own(p.ownerId, uid));
      const agents = (await agentsRepository.list()).filter((a) => own(a.ownerId, uid));
      // Market links and multiproject profiles require an explicit user choice.
      // The legacy repair must never create/merge teams or rewrite these chats.
      const explicitAgentIds = new Set(agents.filter(agent => !!agent.assignments?.length || (agent.projectIds?.length ?? 0) > 1).map(agent => agent.id));
      const explicitScope = (agent: AssistantAgent) => explicitAgentIds.has(agent.id);
      const originalProjectIds = new Map(agents.map((a) => [a.id!, [...(a.projectIds ?? [])]]));
      const teams = (await agentTeamsRepository.list()).filter((t) => own(t.ownerId, uid) || t.ownerId == null);
      const byProject = new Map(projects.map((p) => [p.id!, p]));
      const validProjectIds = new Set(allProjects.map((p) => p.id));
      const byTeam = new Map(teams.map((t) => [t.id!, t]));
      // null means multiple roots claim the same team; orphan chats then stay
      // loose rather than being assigned to an arbitrary project.
      const teamProject = new Map<string, AssistantProject | null>();
      const belongsToRoot = (projectId: string, rootId: string): boolean => {
        const seen = new Set<string>();
        let current = byProject.get(projectId);
        while (current?.id && !seen.has(current.id)) {
          if (current.id === rootId) return true;
          seen.add(current.id);
          current = current.parentId ? byProject.get(current.parentId) : undefined;
        }
        return false;
      };
      let created = 0;
      let moved = 0;

      // Existing root folders take precedence. An agent's explicit project
      // association is reused when it uniquely identifies a root for its team.
      for (const project of projects.filter((p) => !p.parentId)) {
        if (agents.some(agent => explicitScope(agent) &&
          (agent.id === project.leaderAgentId || agent.teamId === project.teamId && !!project.teamId ||
            agentAssignments(agent).some(link => link.projectId === project.id)))) {
          if (project.teamId) teamProject.set(project.teamId, teamProject.has(project.teamId) ? null : project);
          continue;
        }
        let team = project.teamId ? byTeam.get(project.teamId) : undefined;
        if (!team) {
          const matching = teams.filter((t) => agents.some((a) => a.teamId === t.id && a.projectIds?.some((id) => belongsToRoot(id, project.id!))));
          team = matching.length === 1 ? matching[0] : undefined;
        }
        if (!team) {
          team = await agentTeamsRepository.create({ name: project.title, description: `Equipo de ${project.title}` });
          byTeam.set(team.id!, team);
          await projectsRepository.update(executor, project.id!, { teamId: team.id });
          project.teamId = team.id;
          for (const agent of agents.filter((a) => !a.teamId && a.projectIds?.some((id) => belongsToRoot(id, project.id!)))) {
            await agentsRepository.update(agent.id!, { teamId: team.id });
            agent.teamId = team.id;
          }
        }
        const members = agents.filter((a) => a.teamId === team!.id);
        let leader = members.find((a) => a.id === project.leaderAgentId)
          ?? members.find((a) => !a.parentAgentId)
          ?? members[0];
        if (!leader) {
          leader = await addLeader(project, team);
          agents.push(leader);
        } else if (!leader.projectIds?.includes(project.id!)) {
          await agentsRepository.update(leader.id!, { projectIds: [...(leader.projectIds ?? []), project.id!] });
          leader.projectIds = [...(leader.projectIds ?? []), project.id!];
        }
        if (project.teamId !== team.id || project.leaderAgentId !== leader.id) {
          await projectsRepository.update(executor, project.id!, { teamId: team.id, leaderAgentId: leader.id });
        }
        project.teamId = team.id;
        project.leaderAgentId = leader.id;
        teamProject.set(team.id!, teamProject.has(team.id!) ? null : project);
      }

      // A team without a root receives one; an ungrouped agent receives its own
      // team and root. Existing projectIds are respected, never rewritten.
      for (const agent of agents) {
        if (explicitScope(agent)) continue;
        if (agent.teamId && byTeam.has(agent.teamId)) continue;
        const team = await agentTeamsRepository.create({ name: agent.name, description: `Equipo de ${agent.name}` });
        byTeam.set(team.id!, team);
        await agentsRepository.update(agent.id!, { teamId: team.id });
        agent.teamId = team.id;
      }
      for (const team of byTeam.values()) {
        if (teamProject.has(team.id!)) continue;
        const members = agents.filter((a) => a.teamId === team.id);
        if (!members.length || members.some(explicitScope)) continue; // Never convert Market or multiproject profiles.
        const leader = members.find((a) => !a.parentAgentId) ?? members[0]!;
        const candidateIds = new Set(members.flatMap((a) => a.projectIds ?? []));
        let project = projects.find((p) => !p.parentId && candidateIds.has(p.id!) && !p.teamId);
        if (!project) {
          project = await projectsRepository.create(executor, {
            title: team.name, icon: "folder", path: "", instructions: "",
            provider: leader.providerId === "codex" || leader.providerId === "gemini" ? leader.providerId : "claude",
            teamId: team.id,
            leaderAgentId: leader.id,
          });
          projects.push(project);
          byProject.set(project.id!, project);
          validProjectIds.add(project.id);
          created++;
        }
        await projectsRepository.update(executor, project.id!, { teamId: team.id, leaderAgentId: leader.id });
        project.teamId = team.id;
        project.leaderAgentId = leader.id;
        teamProject.set(team.id!, project);
        if (!leader.projectIds?.includes(project.id!)) {
          await agentsRepository.update(leader.id!, { projectIds: [...(leader.projectIds ?? []), project.id!] });
          leader.projectIds = [...(leader.projectIds ?? []), project.id!];
        }
      }

      const byAgent = new Map(agents.map((a) => [a.id!, a]));
      for (let offset = 0;; offset += 200) {
        const page = await conversationsRepository.list(executor, { limit: 200, offset });
        for (const chat of page.items) {
          if (chat.projectId && validProjectIds.has(chat.projectId)) continue;
          const agent = chat.agentId ? byAgent.get(chat.agentId) : undefined;
          if (agent && explicitScope(agent)) continue;
          const candidates = agent ? (originalProjectIds.get(agent.id!) ?? []).map(id => byProject.get(id)).filter((p): p is AssistantProject => !!p) : [];
          const explicit = candidates.length === 1 ? candidates[0] : undefined;
          const project = explicit ?? (agent?.teamId ? teamProject.get(agent.teamId) : undefined);
          if (project?.id) {
            await conversationsRepository.patchRuntime(executor, chat.id!, { projectId: project.id });
            moved++;
          } else if (chat.projectId) {
            await conversationsRepository.moveToLoose(executor, chat.id!);
            moved++;
          }
        }
        if (offset + page.items.length >= page.total || !page.items.length) break;
      }
      await marker.set(markerId, { version: 1, completedAt: new Date().toISOString() });
      return { repaired: true, projects: created, chats: moved };
    });
  },

  /**
   * Make a root workspace available to every panel administrator. Ownership is
   * transferred as one bounded unit (root/descendants, default leader and its
   * exclusive team), never via a generic client patch. This lets a portal
   * credential and the local panel operate the same RealityOS workspace.
   */
  async shareWithAdministrators(executor: Executor, project: AssistantProject): Promise<AssistantProject> {
    if (!project.id) throw new ValidationError("El proyecto no tiene una identidad válida.");
    return serial(`${executor.target.id}:project:${project.id}:share`, async () => {
      const current = await projectsRepository.get(executor, project.id!);
      if (!current) throw new NotFoundError("Proyecto no encontrado");
      if (current.parentId) throw new ValidationError("Solo un proyecto raíz puede compartirse con administradores.");
      if (!current.teamId || !current.leaderAgentId) {
        throw new ValidationError("El proyecto no tiene un espacio de trabajo completo para compartir.");
      }

      const [allProjects, allAgents, team, leader] = await Promise.all([
        projectsRepository.list(executor),
        agentsRepository.list(),
        agentTeamsRepository.get(current.teamId),
        agentsRepository.get(current.leaderAgentId),
      ]);
      if (!team || !leader || !isExclusiveDefaultWorkspace(current, leader, allAgents, allProjects)) {
        throw new ValidationError("El equipo o líder del proyecto no es exclusivo. Sepáralo antes de compartir este espacio.");
      }

      const workspaceIds = projectClosure(allProjects, [current.id!]);
      const workspaceProjects = projectsOfClosure(allProjects, workspaceIds);
      const compatibleOwner = (ownerId: number | null | undefined) => ownerId == null || ownerId === current.ownerId;
      if (!compatibleOwner(team.ownerId) || !compatibleOwner(leader.ownerId) || workspaceProjects.some((item) => !compatibleOwner(item.ownerId))) {
        throw new ValidationError("El espacio contiene recursos de otro propietario y no puede compartirse de forma segura.");
      }

      // Update private support records first and expose the root last: no caller
      // can observe a global project whose leader/team remain private. On a
      // storage failure, restore each record best-effort before propagating it.
      const restore: Array<() => Promise<unknown>> = [];
      try {
        if (team.ownerId != null) {
          const saved = await agentTeamsRepository.setOwner(team.id!, null);
          if (!saved) throw new Error("No se pudo compartir el equipo del proyecto.");
          restore.unshift(() => agentTeamsRepository.setOwner(team.id!, team.ownerId ?? null));
        }
        if (leader.ownerId != null) {
          const saved = await agentsRepository.setOwner(leader.id!, null);
          if (!saved) throw new Error("No se pudo compartir el líder del proyecto.");
          restore.unshift(() => agentsRepository.setOwner(leader.id!, leader.ownerId ?? null));
        }
        const ordered = [...workspaceProjects].sort((a, b) => Number(a.id === current.id) - Number(b.id === current.id));
        let sharedRoot: AssistantProject | null = null;
        for (const item of ordered) {
          if (item.ownerId == null) {
            if (item.id === current.id) sharedRoot = item;
            continue;
          }
          const saved = await projectsRepository.setOwner(executor, item.id!, null);
          if (!saved) throw new Error("No se pudo compartir el proyecto.");
          restore.unshift(() => projectsRepository.setOwner(executor, item.id!, item.ownerId ?? null));
          if (item.id === current.id) sharedRoot = saved;
        }
        return sharedRoot ?? current;
      } catch (error) {
        for (const undo of restore) await undo().catch(() => undefined);
        throw error;
      }
    });
  },

  async remove(executor: Executor, project: AssistantProject): Promise<boolean> {
    if (!project.id) return false;
    return serial(`${executor.target.id}:project:${project.id}:remove`, async () => {
      const uid = getContextUserId();
      const all = await projectsRepository.list(executor);
      if (all.some((p) => p.parentId === project.id)) {
        throw new ValidationError("Mueve o elimina los subproyectos antes de borrar este proyecto");
      }
      const agents = await agentsRepository.list();
      const leader = project.leaderAgentId ? await agentsRepository.get(project.leaderAgentId) : null;
      const removableDefault = isExclusiveDefaultWorkspace(project, leader, agents, all);
      const assigned = agents.filter((agent) => effectiveAssignment(agent, all, project.id!));
      if (assigned.some((agent) => !removableDefault || agent.id !== leader?.id)) {
        throw assignmentError("ASSISTANT_ASSIGNMENT_BUSY", "Retira las asignaciones de agentes (incluidas las heredadas) antes de eliminar el proyecto.");
      }
      if (removableDefault) await assertExclusiveWorkspaceUnused(executor, project, leader, all);

      // Preserve loose-chat history by detaching it; any leader activity would
      // have blocked the automatic cleanup above, so no bound history is lost.
      const ids = await conversationsRepository.listIds(executor);
      for (const id of ids) {
        const chat = await conversationsRepository.getMeta(executor, id);
        if (chat && chat.projectId === project.id && !chat.agentId) await conversationsRepository.moveToLoose(executor, id);
      }
      for (const agent of agents.filter((a) => own(a.ownerId, uid ?? -1))) {
        if (agent.id !== leader?.id && agent.projectIds?.includes(project.id!)) {
          await agentsRepository.update(agent.id!, { projectIds: agent.projectIds.filter((id) => id !== project.id) });
        }
      }
      if (removableDefault) {
        // This branch is only reached for a factory-created, unreferenced
        // workspace. Deliberately keep context/vault files for recovery.
        await agentsRepository.delete(leader.id!);
        await agentTeamsRepository.delete(project.teamId!);
      }
      return projectsRepository.delete(executor, project.id!);
    });
  },
};
