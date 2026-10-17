// SPDX-License-Identifier: AGPL-3.0-only
import type { AssistantAgent, AssignmentView, EffectiveAssignment } from "./assistant-agent.types.js";

/** Authorization at read time; busy work and live session/tool guards still apply. */
export interface AgentMarketCapabilities {
  canEditProfile: boolean;
  canDeleteProfile: boolean;
  canAssign: boolean;
  canUpdateAssignment: boolean;
  canRemoveAssignment: boolean;
  canExecute: boolean;
}
export interface AgentMarketExecution {
  projectId: string | null;
  error: { code: string; statusCode: number; message: string } | null;
}
export interface AgentMarketContext {
  projectId: string;
  membership: "none" | "direct" | "inherited" | "removed";
  directAssignment: AssignmentView | null;
  effectiveAssignment: EffectiveAssignment | null;
  effectiveConfig: {
    systemPrompt: string;
    roleId: string | null;
    allowedTools: string[] | null;
    canSpawnChats: boolean;
    projectPaths: string[];
    serverIds: string[];
    graphProjectIds: string[];
    teamId: string | null;
    parentAgentId: string | null;
    connections: string[];
  } | null;
}
export type AgentMarketProfile = AssistantAgent & {
  specialty: string;
  technologies: string[];
  assignments: AssignmentView[];
  projectIds: string[];
  capabilities: AgentMarketCapabilities;
  execution: AgentMarketExecution;
  context: AgentMarketContext | null;
};
