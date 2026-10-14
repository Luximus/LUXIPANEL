// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Lógica PURA del nivel superior del árbol "Agentes IA" (`AgentThreadedConvos`):
 * qué agentes YA están representados en el árbol y, por descarte, qué líderes
 * hay que añadir como tarjeta vacía ("Sin conversaciones").
 *
 * Un subordinado que además es líder de su propio equipo aparece ANIDADO bajo su
 * líder (`entry.subs`), así que ya está representado: si no se cuentan los subs,
 * ese agente salía DOS veces — dentro de su líder con sus chats y además como
 * tarjeta de primer nivel con contador 0. Aquí se registran los tres orígenes:
 * líderes de primer nivel, sus subordinados y las filas threaded.
 */
import type { AgentTopEntry, ConversationLike } from "../../assistant-settings/agents/conversation-grouping";

/** Ids de agente ya representados en el nivel superior del árbol (líderes,
 *  subordinados anidados y filas threaded simples/grupo). */
export function collectRepresentedAgentIds<T extends ConversationLike>(entries: AgentTopEntry<T>[]): Set<string> {
  const represented = new Set<string>();
  for (const e of entries) {
    if (e.kind === "leader") {
      represented.add(e.agentId);
      // Los subordinados anidados TAMBIÉN están representados (aunque sean
      // líderes de su propio equipo o no tengan chats: la sub-colapsable existe).
      for (const s of e.subs) represented.add(s.agentId);
      continue;
    }
    const r = e.row;
    const aid = r.kind === "single" ? r.item.agentId : r.agentId;
    if (aid) represented.add(aid);
  }
  return represented;
}

/** Líderes que NO salen del árbol de conversaciones: se pintan como tarjeta de
 *  primer nivel vacía. Excluye a los ya representados (incluidos los anidados). */
export function pickEmptyLeaderAgents<A extends { id: string }, T extends ConversationLike>(
  entries: AgentTopEntry<T>[],
  leaderAgents: A[],
): A[] {
  const represented = collectRepresentedAgentIds(entries);
  return leaderAgents.filter((a) => !!a.id && !represented.has(a.id));
}
