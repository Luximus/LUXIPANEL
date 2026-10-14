// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AgentAvatar — the canonical avatar for an assistant agent: an Avataaars
 * generated locally from the agent's `avatarConfig` (or deterministically from
 * its id/name when unset). Factored out of the several inline copies of this
 * pattern (chat header badge, conversation rows, dashboard/project-leader
 * pills) so they render identically.
 */
import { useMemo } from "react";
import type { AssistantAgent } from "./assistant-api";
import { agentAvatarUri } from "./agent-avataaars";

export function AgentAvatar({
  agent,
  size = 20,
  className = "",
}: {
  agent: Pick<AssistantAgent, "avatarConfig" | "name"> & { id?: string };
  /** Rendered square size in px. */
  size?: number;
  className?: string;
}) {
  const src = useMemo(
    () => agentAvatarUri(agent.avatarConfig, agent.id || agent.name || "agent"),
    [agent.avatarConfig, agent.id, agent.name],
  );
  return (
    <img
      src={src}
      alt={agent.name ?? ""}
      className={`shrink-0 rounded-full bg-muted/40 object-cover ${className}`}
      style={{ width: size, height: size }}
      loading="lazy"
    />
  );
}
