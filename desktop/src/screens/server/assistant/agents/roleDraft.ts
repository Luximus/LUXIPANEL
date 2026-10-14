import type { AgentRole } from "./api";
import type { RoleDraft } from "./types";

export function emptyRoleDraft(): RoleDraft {
  return {
    name: "",
    description: "",
    systemPrompt: "",
    allowedTools: null,
    icon: "Shield",
    color: "blue",
    canSpawnChats: false,
  };
}

export function roleToDraft(role: AgentRole): RoleDraft {
  return {
    id: role.id,
    name: role.name,
    description: role.description ?? "",
    systemPrompt: role.systemPrompt ?? "",
    allowedTools: role.allowedTools,
    icon: role.icon ?? "Shield",
    color: role.color ?? "blue",
    canSpawnChats: Boolean(role.canSpawnChats),
  };
}
