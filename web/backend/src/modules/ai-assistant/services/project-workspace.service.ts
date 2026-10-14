// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Keeps project folders, agent teams and their chats in one workspace. */
import { dataStore } from "../../../shared/data-store/index.js";
import { getContextUserId, type Executor } from "../../../shared/executor/index.js";
import { NotFoundError, ValidationError } from "../../../shared/errors/index.js";
import { agentsRepository } from "../repositories/agents.repository.js";
import { agentTeamsRepository } from "../repositories/agent-teams.repository.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { projectsRepository, type AssistantProject } from "../repositories/projects.repository.js";
import type { AssistantAgent } from "../models/assistant-agent.types.js";
import type { AgentTeam } from "../models/assistant-team.types.js";

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

async function addLeader(project: AssistantProject, team: AgentTeam, name?: string): Promise<AssistantAgent> {
  return agentsRepository.create({
    name: (name || `${project.title} · Líder`).slice(0, 120),
    description: `Agente líder del proyecto ${project.title}`,
    systemPrompt: project.instructions || "Coordina el trabajo de este proyecto y sus subproyectos.",
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
        if (!parent || parent.ownerId !== uid) throw new NotFoundError("Proyecto padre no encontrado");
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
        if (agent.teamId && byTeam.has(agent.teamId)) continue;
        const team = await agentTeamsRepository.create({ name: agent.name, description: `Equipo de ${agent.name}` });
        byTeam.set(team.id!, team);
        await agentsRepository.update(agent.id!, { teamId: team.id });
        agent.teamId = team.id;
      }
      for (const team of byTeam.values()) {
        if (teamProject.has(team.id!)) continue;
        const members = agents.filter((a) => a.teamId === team.id);
        if (!members.length) continue; // A global team may belong to another target.
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
          const explicit = agent ? originalProjectIds.get(agent.id!)?.map((id) => byProject.get(id)).find(Boolean) : undefined;
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

  async remove(executor: Executor, project: AssistantProject): Promise<boolean> {
    const uid = getContextUserId();
    const all = await projectsRepository.list(executor);
    if (all.some((p) => p.parentId === project.id)) {
      throw new ValidationError("Mueve o elimina los subproyectos antes de borrar este proyecto");
    }
    // Preserve chats and agents. Only their project association is removed.
    const ids = await conversationsRepository.listIds(executor);
    for (const id of ids) {
      const chat = await conversationsRepository.getMeta(executor, id);
      if (chat?.projectId === project.id) await conversationsRepository.moveToLoose(executor, id);
    }
    for (const agent of (await agentsRepository.list()).filter((a) => own(a.ownerId, uid ?? -1))) {
      if (agent.projectIds?.includes(project.id!)) {
        await agentsRepository.update(agent.id!, { projectIds: agent.projectIds.filter((id) => id !== project.id) });
      }
    }
    return projectsRepository.delete(executor, project.id!);
  },
};
