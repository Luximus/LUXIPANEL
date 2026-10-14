// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Agent hierarchy → Mermaid `graph TD` builder. Extracted from AgentsTab so the
 * TeamTaskBoard can render a live, status-coloured org chart of a leader's
 * subtree with the same diagram mechanism (MermaidDiagram, securityLevel
 * "strict" — no HTML labels; colouring is done with classDef/class lines).
 */
import type { AssistantAgent } from "./assistant-api";

/** Stable Mermaid node id for an agent id (also used to key node avatars). */
export const mmNodeId = (id: string) => "a_" + id.replace(/[^a-zA-Z0-9]/g, "_");
const mmLabel = (s: string) => (s || "agente").replace(/["\n\r]+/g, " ").slice(0, 48);

/** Status classes the board can assign per node (colours defined below). */
export type AgentNodeClass = "running" | "done" | "failed" | "waiting";

/** classDef palette — plain style strings, safe under securityLevel "strict". */
const NODE_CLASS_DEFS: Record<AgentNodeClass, string> = {
  running: "fill:#3b82f6,stroke:#1d4ed8,color:#ffffff",
  done: "fill:#10b981,stroke:#047857,color:#ffffff",
  failed: "fill:#ef4444,stroke:#b91c1c,color:#ffffff",
  waiting: "fill:#f59e0b,stroke:#b45309,color:#111827",
};

export interface BuildAgentTreeOptions {
  /** Placeholder node label when there are no agents. */
  emptyLabel?: string;
  /** Label on dashed peer-connection links. */
  connLabel?: string;
  /** Per-agent status colouring: AGENT id (raw) → class. Emits Mermaid
   *  `classDef`/`class` lines (compatible with securityLevel "strict"). */
  nodeClasses?: Record<string, AgentNodeClass>;
}

/** Build a hierarchy tree diagram from the agents' parentAgentId edges, plus
 *  their peer `connections` as dashed links. Roots = agents with no parent. */
export function buildAgentTree(agents: AssistantAgent[], opts?: BuildAgentTreeOptions): string {
  const emptyLabel = opts?.emptyLabel ?? "Sin agentes — crea uno para verlo aquí";
  const connLabel = opts?.connLabel ?? "conexión";
  if (agents.length === 0) return `graph TD\n  empty["${emptyLabel}"]`;
  const ids = new Set(agents.map((a) => a.id));
  const lines = ["graph TD"];
  for (const a of agents) lines.push(`  ${mmNodeId(a.id)}["${mmLabel(a.name)}"]`);
  for (const a of agents) {
    if (a.parentAgentId && ids.has(a.parentAgentId)) {
      lines.push(`  ${mmNodeId(a.parentAgentId)} --> ${mmNodeId(a.id)}`);
    }
  }
  const seen = new Set<string>();
  for (const a of agents) {
    for (const c of a.connections ?? []) {
      if (!ids.has(c)) continue;
      const key = [a.id, c].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`  ${mmNodeId(a.id)} -. ${connLabel} .- ${mmNodeId(c)}`);
    }
  }
  // Status colouring: one classDef per used class + `class` assignment lines.
  const byClass = new Map<AgentNodeClass, string[]>();
  for (const [agentId, cls] of Object.entries(opts?.nodeClasses ?? {})) {
    if (!ids.has(agentId) || !NODE_CLASS_DEFS[cls]) continue;
    const arr = byClass.get(cls) ?? [];
    arr.push(mmNodeId(agentId));
    byClass.set(cls, arr);
  }
  for (const [cls, nodeIds] of byClass) {
    lines.push(`  classDef lxp_${cls} ${NODE_CLASS_DEFS[cls]}`);
    lines.push(`  class ${nodeIds.join(",")} lxp_${cls}`);
  }
  return lines.join("\n");
}
