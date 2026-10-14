// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * TeamAddAgentsModal — multi-select picker to add agents to a team. Candidates
 * are agents NOT already in this team; agents shared from other users are
 * pre-filtered out (the backend would reject a PUT on them with 403). Confirming
 * fires N `assistantAgentsApi.update(id, { teamId })` calls, then `onSaved()`.
 */
import { useState } from "react";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useTeamAgentPicker } from "./use-team-agent-picker";
import { type AgentTeam, type AssistantAgent } from "./assistant-api";
import { AgentGroupedChecklist } from "./AgentGroupedChecklist";
import { ModalShell } from "@/components/ui/ModalShell";
import { formatAssistantMessage, useAssistantI18n } from "./i18n";
import type { TeamsMessages } from "./AgentsTab";

export function TeamAddAgentsModal({
  team,
  agents,
  teams,
  t,
  onClose,
  onSaved,
}: {
  team: AgentTeam;
  /** Full agent list; filtered internally to eligible candidates. */
  agents: AssistantAgent[];
  /** All teams, to group candidates by team (+ trailing "Sueltos" bucket). */
  teams: AgentTeam[];
  t: TeamsMessages;
  onClose(): void;
  onSaved(): void;
}) {
  // Candidatos + selección + asignación: hook compartido con TeamEditModal (F-11).
  const { candidates, candidateGroups, openKeys, selected, toggle, assignSelected } =
    useTeamAgentPicker(agents, teams, team.id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const i18n = useAssistantI18n();

  // Escape → cerrar, salvo mientras guarda (F-14: hook compartido).
  useEscapeToClose(onClose, !saving);

  async function confirm() {
    if (selected.size === 0 || saving) return;
    setSaving(true);
    setError(null);
    const failures = await assignSelected(team.id);
    setSaving(false);
    if (failures.length) {
      setError(failures.join(", "));
      return;
    }
    onSaved();
  }

  // Guard close while saving (backdrop click + Escape both route through here).
  return (
    <ModalShell
      onClose={() => !saving && onClose()}
      title={`${t.addAgentsTitle} — ${team.name}`}
      closeLabel={i18n.drawer.close}
      bodyClassName="pl-5 pr-4 pt-3"
      footer={
        <>
          {error && <p className="mr-auto text-xs text-red-500">{error}</p>}
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
          >
            {t.cancelBtn}
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={saving || selected.size === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && <i className="ti ti-loader-2 animate-spin" aria-hidden></i>}
            {t.addAgentsConfirm}
          </button>
        </>
      }
    >
        {candidates.length === 0 ? (
          <p className="rounded-md bg-muted/40 px-3 py-6 text-center text-xs text-muted-foreground">
            {t.addAgentsEmpty}
          </p>
        ) : (
          <AgentGroupedChecklist
            groups={candidateGroups}
            selectedIds={selected}
            onToggle={toggle}
            ungroupedLabel={t.noTeamOption}
            countLabel={(count) => formatAssistantMessage(t.memberCount, { count: String(count) })}
            defaultOpenKeys={openKeys}
            avatarSize={20}
          />
        )}
    </ModalShell>
  );
}
