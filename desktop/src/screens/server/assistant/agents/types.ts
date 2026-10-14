import type { AgentPayload, AgentRolePayload, AgentTeamPayload } from "./api";

export type AgentDraft = AgentPayload & { id?: string };

export type AgentEditorCopy = {
  newTitle: string;
  editTitle: string;
  readOnlyHint: string;
  tabs: {
    identity: string;
    prompt: string;
    tools: string;
    models: string;
    permissions: string;
    teams: string;
  };
  fields: {
    name: string;
    description: string;
    icon: string;
    color: string;
    systemPrompt: string;
    allowAllTools: string;
    allowedTools: string;
    allowedToolsHint: string;
    provider: string;
    model: string;
    agentMode: string;
    single: string;
    multi: string;
    copies: string;
    extraProviders: string;
    canSpawnChats: string;
    realtime: string;
    parentAgent: string;
    connections: string;
    role: string;
    team: string;
    none: string;
  };
  cancel: string;
  save: string;
  saving: string;
};

export type RoleDraft = AgentRolePayload & { id?: string };

export type RoleEditorCopy = {
  newTitle: string;
  editTitle: string;
  name: string;
  description: string;
  prompt: string;
  allowAllTools: string;
  allowedTools: string;
  allowedToolsHint: string;
  supervisor: string;
  readOnlyHint: string;
  cancel: string;
  save: string;
  saving: string;
};

export type TeamDraft = AgentTeamPayload & { id?: string };

export type TeamEditorCopy = {
  newTitle: string;
  editTitle: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  readOnlyHint: string;
  cancel: string;
  save: string;
  saving: string;
};
