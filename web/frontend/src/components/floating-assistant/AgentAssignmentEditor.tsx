// SPDX-License-Identifier: AGPL-3.0-only
import { useState } from "react";
import type { AgentAssignmentPayload, AssistantAgent, AssistantAgentRole, AssistantProject, ResolvedModule } from "./assistant-api";
import { useAssistantI18n } from "./i18n";
import { useModuleCatalog } from "./use-module-catalog";
import { assignedInProject } from "./agent-market-state";

const control = "min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
export function AgentAssignmentEditor({ agent, agents, projects, roles, pending, blocked = false, onSave }: {
  agent: AssistantAgent; agents: AssistantAgent[]; projects: AssistantProject[]; roles: AssistantAgentRole[];
  pending: boolean; blocked?: boolean; onSave(data: AgentAssignmentPayload): void;
}) {
  const i18n = useAssistantI18n(), t = i18n.agentMarket, e = i18n.agentsTab.editor;
  const [patch, setPatch] = useState<AgentAssignmentPayload>({});
  const [modules, setModules] = useState<ResolvedModule[]>([]);
  useModuleCatalog(setModules);
  // PUT preserves a direct row (even removed), never copies its ancestor.
  // Show those actual defaults when creating a local override of inheritance.
  const direct = agent.context?.directAssignment;
  const original: AgentAssignmentPayload = direct ?? {};
  const values: AgentAssignmentPayload = { ...original, ...patch };
  const projectId = agent.context?.projectId;
  const peers = agents.filter(a => a.id !== agent.id && assignedInProject(a, projectId));
  const byId = new Map(projects.map(p => [p.id, p]));
  const ancestors: AssistantProject[] = [];
  const visited = new Set<string>();
  let node = projectId ? byId.get(projectId) : undefined;
  while (node && !visited.has(node.id)) { ancestors.push(node); visited.add(node.id); node = node.parentId ? byId.get(node.parentId) : undefined; }
  const rootLeader = ancestors.at(-1)?.leaderAgentId;
  const defaultParent = direct?.source === "legacy" ? agent.parentAgentId : rootLeader === agent.id ? null : rootLeader;
  const subtree = new Set(projectId ? [projectId] : []);
  for (let i = 0; i < projects.length; i++) for (const project of projects) if (project.parentId && subtree.has(project.parentId)) subtree.add(project.id);
  const servers = [...new Map(ancestors.flatMap(project => project.servers ?? []).map(server => [server.id, server])).values()];
  const arrays = [
    { key: "connections" as const, label: e.connectionsLabel, options: peers.map(a => ({ id: a.id, name: a.name })) },
    { key: "allowedTools" as const, label: e.tabTools, options: modules.flatMap(module => module.tools.map(tool => ({ id: tool.name, name: tool.title || tool.name }))) },
    { key: "serverIds" as const, label: e.associatedServers, options: servers },
    { key: "graphProjectIds" as const, label: e.graphIndexesTitle, options: projects.filter(p => subtree.has(p.id) && p.graphIndex?.status === "ready").map(p => ({ id: p.id, name: p.title })) },
  ];
  return <form className="grid gap-4 p-4" onSubmit={event => { event.preventDefault(); if (!pending && !blocked) onSave({ ...patch, ...(patch.projectPaths ? { projectPaths: patch.projectPaths.map(path => path.trim()).filter(Boolean) } : {}) }); }}>
    <p className="text-sm text-muted-foreground">{t.assignmentHint}</p>
    {agent.context?.membership === "inherited" && <p className="text-sm text-muted-foreground">{t.overrideHint}</p>}
    <fieldset disabled={pending || blocked} className="grid gap-4">
      <label className="grid gap-1 text-sm">{t.jobTitle}<input className={control} maxLength={200} value={values.jobTitle ?? ""} onChange={event => setPatch({ ...patch, jobTitle: event.target.value })} /></label>
      <label className="grid gap-1 text-sm">{t.instructions}<textarea className={control} rows={4} maxLength={20000} value={values.instructions ?? ""} onChange={event => setPatch({ ...patch, instructions: event.target.value })} /></label>
      <label className="grid gap-1 text-sm">{i18n.agentInfo.roleLabel}<select className={control} value={values.roleId ?? ""} onChange={event => setPatch({ ...patch, roleId: event.target.value || null })}>
        <option value="">{t.inherit}</option>{roles.filter(role => role.relation !== "shared" || role.id === values.roleId).map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
      </select></label>
      <label className="grid gap-1 text-sm">{e.parentAgent}<select className={control} value={(values.parentAgentId === undefined ? defaultParent : values.parentAgentId) ?? ""} onChange={event => setPatch({ ...patch, parentAgentId: event.target.value || null })}>
        <option value="">{t.none}</option>{peers.map(peer => <option key={peer.id} value={peer.id}>{peer.name}</option>)}
      </select></label>
      {arrays.map(({ key, label, options }) => <fieldset key={key} className="rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">{label}</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={values[key] == null} onChange={event => setPatch({ ...patch, [key]: event.target.checked ? null : [] })} />{t.inherit}</label>
        {values[key] != null && <div className="max-h-52 overflow-y-auto">
          {options.map(option => <label key={option.id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={values[key]?.includes(option.id) ?? false} onChange={event => setPatch({ ...patch, [key]: event.target.checked ? [...(values[key] ?? []), option.id] : values[key]?.filter(id => id !== option.id) })} /><span>{option.name}</span></label>)}
          {!values[key]?.length && <p className="text-sm text-muted-foreground">{t.none}</p>}
        </div>}
      </fieldset>)}
      <fieldset className="rounded-md border border-border p-3"><legend className="px-1 text-sm font-medium">{e.tabResources}</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={values.projectPaths == null} onChange={event => setPatch({ ...patch, projectPaths: event.target.checked ? null : [] })} />{t.inherit}</label>
        {values.projectPaths != null && <textarea aria-label={e.tabResources} className={`${control} w-full`} rows={3} value={values.projectPaths.join("\n")} onChange={event => setPatch({ ...patch, projectPaths: event.target.value.split("\n") })} />}
      </fieldset>
      <label className="grid gap-1 text-sm">{e.supervisorLabel}<select className={control} value={values.canSpawnChats == null ? "inherit" : String(values.canSpawnChats)} onChange={event => setPatch({ ...patch, canSpawnChats: event.target.value === "inherit" ? null : event.target.value === "true" })}>
        <option value="inherit">{t.inherit}</option><option value="false">{t.none}</option>
        <option value="true">{e.supervisorLabel}</option>
      </select></label>
      <p className="text-sm text-muted-foreground">{t.limitsHint}</p>
      <button className={`${control} justify-self-end`} type="submit" disabled={!Object.keys(patch).length}>{pending ? t.pending : i18n.agentsTab.saveChanges}</button>
    </fieldset>
  </form>;
}
