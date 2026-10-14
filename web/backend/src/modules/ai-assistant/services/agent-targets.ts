// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Related-agent graph — the single definition of "which agents may this agent
 * reach directly", shared by every inter-agent channel:
 *
 *   - `agents.delegate`     (system-prompt-builder) — synchronous sub-run.
 *   - `agents.send_message` (agent-messages.service) — async persistent handoff.
 *
 * Extracted verbatim from `buildDelegateTool` so the two channels can't drift
 * apart (a target valid for one must be valid for the other). Lives in its own
 * module — importing it from system-prompt-builder would create a cycle
 * (system-prompt-builder → agent-messages.service → system-prompt-builder).
 */

import type { AssistantAgent } from "../models/assistant-agent.types.js";

/** Max inter-agent delegation/message depth. Beyond this the delegate tool is
 *  withheld and a message is refused, so a superior↔subordinate (or connected)
 *  pair can't recurse without bound. */
export const MAX_DELEGATION_DEPTH = 3;

interface AgentTargetsOptions {
  /**
   * Include the agent's PARENT (the superior it reports to). The async message
   * channel allows a subordinate to report BACK up the chain without a live
   * leader turn; `agents.delegate` does NOT (a subordinate running a delegate
   * sub-run must not re-enter its own leader), so it stays false there — the
   * delegate targets and its prompt block are byte-identical to before.
   */
  includeParent?: boolean;
}

/**
 * Agents `agent` may address directly: its SUBORDINATES (whose `parentAgentId`
 * is this agent), its CONNECTIONS (bidirectional: its own list + anyone listing
 * it) and, optionally, its PARENT. Self is always excluded.
 */
export function computeAgentTargets(
  agent: AssistantAgent,
  allAgents: AssistantAgent[],
  opts: AgentTargetsOptions = {},
): AssistantAgent[] {
  const byId = new Map(allAgents.map((a) => [a.id ?? "", a] as const));
  const targetIds = new Set<string>();
  // Subordinates: agents that report to this one.
  for (const a of allAgents) if (a.id && a.parentAgentId === agent.id) targetIds.add(a.id);
  // Connections: bidirectional peers (this agent's list + anyone listing it).
  for (const id of agent.connections ?? []) targetIds.add(id);
  for (const a of allAgents) if (a.id && (a.connections ?? []).includes(agent.id ?? "")) targetIds.add(a.id);
  // Parent (message channel only): report back up without going through a turn.
  if (opts.includeParent && agent.parentAgentId) targetIds.add(agent.parentAgentId);
  targetIds.delete(agent.id ?? "");
  return [...targetIds].map((id) => byId.get(id)).filter((a): a is AssistantAgent => !!a);
}

/** How `agent` relates to `target` — used to label the roster in the prompt. */
export function relationLabel(agent: AssistantAgent, target: AssistantAgent): string {
  if (target.parentAgentId === agent.id) return "subordinado";
  if (agent.parentAgentId && agent.parentAgentId === target.id) return "superior";
  return "conexión";
}
