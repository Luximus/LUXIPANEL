import { FormDrawer } from "../../ui/FormDrawer";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * TeamAddAgentsModal (RN) — selector multi-selección para añadir agentes a un
 * equipo. Candidatos = agentes que NO están ya en ESTE equipo y que el usuario
 * posee (`relation !== "shared"`, evita un 403 al hacer PUT). Puerto del web,
 * pero CONTROLADO: no llama a la API — emite `onAdd(ids)` y el padre hace las N
 * `agentsApi.update(id, { teamId })`.
 */
import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Button } from "../../ui/Button";
import { LoadState } from "../parts";
import { s } from "../styles";
import type { ThemeTokens } from "../../../theme/colors";
import type { Messages } from "../../../i18n/messages";
import type { AgentTeam, AssistantAgent } from "../types";
import type { AgentsStrings } from "./agents-i18n";
import { AgentGroupedChecklist } from "./AgentGroupedChecklist";

export function TeamAddAgentsModal({
  visible,
  team,
  agents,
  teams,
  busy,
  onAdd,
  onClose,
  tokens,
  str,
  language,
  t,
}: {
  visible: boolean;
  team: AgentTeam;
  agents: AssistantAgent[];
  /** Lista completa de equipos para agrupar candidatos por `teamId`. */
  teams?: AgentTeam[];
  busy?: boolean;
  onAdd: (ids: string[]) => void;
  onClose: () => void;
  tokens: ThemeTokens;
  str: AgentsStrings;
  language?: string;
  /** Mensajes base (para el estado vacío reutilizable `LoadState`). */
  t: Messages["assistantSettings"];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Reinicia la selección cada vez que se abre.
  useEffect(() => {
    if (visible) setSelected(new Set());
  }, [visible]);

  const candidates = useMemo(
    () => agents.filter((a) => a.relation !== "shared" && a.teamId !== team.id),
    [agents, team.id],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirm() {
    if (selected.size === 0 || busy) return;
    onAdd([...selected]);
  }

  return (
    <FormDrawer
      visible={visible}
      onClose={onClose}
      title={`${str.teams.addAgentsTitle} — ${team.name}`}
      language={language}
      footer={
        <View style={[s.actionsRow, { flex: 1 }]}>
          <Button size="sm" variant="ghost" label={str.teams.cancelBtn} onPress={onClose} disabled={busy} />
          <Button
            size="sm"
            variant="primary"
            label={str.teams.addAgentsConfirm}
            onPress={confirm}
            loading={busy}
            disabled={selected.size === 0}
          />
        </View>
      }
    >
      {candidates.length === 0 ? (
        <LoadState t={t} tokens={tokens} mode="empty" emptyText={str.teams.addAgentsEmpty} />
      ) : (
        <AgentGroupedChecklist
          agents={candidates}
          selectedIds={selected}
          onToggle={toggle}
          teams={teams}
          tokens={tokens}
          str={str}
        />
      )}
    </FormDrawer>
  );
}
