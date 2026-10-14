import type { AgentTeam } from "./api";
import type { TeamDraft } from "./types";

export function emptyTeamDraft(): TeamDraft {
  return { name: "", description: "", icon: "Users", color: "violet" };
}

export function teamToDraft(team: AgentTeam): TeamDraft {
  return {
    id: team.id,
    name: team.name,
    description: team.description ?? "",
    icon: team.icon ?? "Users",
    color: team.color ?? "violet",
  };
}
