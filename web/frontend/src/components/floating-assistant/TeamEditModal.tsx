// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * TeamEditModal — create or rename an agent team in a single form: name,
 * description, color, and (inline) attach existing agents to the team. In
 * create mode it also surfaces a "Equipo rápido" shortcut as an alternate way
 * to spin up a whole team from a template.
 *
 * On success it calls `onSaved()`; the parent reloads and re-emits the
 * `lxp:assistant:agents-updated` event.
 */
import { useState } from "react";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useTeamAgentPicker } from "./use-team-agent-picker";
import { COLOR_DOT, COLOR_PRESETS } from "./agents-tab/constants";
import {
  assistantAgentTeamsApi,
  type AgentTeam,
  type AssistantAgent,
} from "./assistant-api";
import { AgentGroupedChecklist } from "./AgentGroupedChecklist";
import { ModalShell } from "@/components/ui/ModalShell";
import { formatAssistantMessage, useAssistantI18n } from "./i18n";
import type { TeamsMessages } from "./AgentsTab";
// AgentAvatar rows are now rendered inside AgentGroupedChecklist.

// Los presets de color y el mapa estático de clases viven en
// `agents-tab/constants` (F-23) — antes estaban duplicados aquí verbatim.

export function TeamEditModal({
  team,
  agents,
  teams,
  t,
  quickTeamLabel,
  onQuickTeam,
  onClose,
  onSaved,
}: {
  /** Existing team to edit; omit/null for create mode. */
  team?: AgentTeam | null;
  /** Full agent list; filtered internally to eligible candidates. */
  agents: AssistantAgent[];
  /** All teams, to group candidates by team (+ trailing "Sueltos" bucket). */
  teams: AgentTeam[];
  t: TeamsMessages;
  /** Label for the "Equipo rápido" alternate shortcut (create mode only). */
  quickTeamLabel?: string;
  /** Opens the team-templates wizard as an alternate creation path. */
  onQuickTeam?(): void;
  onClose(): void;
  onSaved(): void;
}) {
  const editing = Boolean(team?.id);
  const i18n = useAssistantI18n();
  const [name, setName] = useState(team?.name ?? "");
  const [description, setDescription] = useState(team?.description ?? "");
  const [color, setColor] = useState(team?.color ?? "violet");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline "attach agents": mismo picker que el modal standalone (F-11).
  const { candidates, candidateGroups, openKeys, selected, toggle, assignSelected } =
    useTeamAgentPicker(agents, teams, team?.id);

  // Escape → cerrar, salvo mientras guarda (F-14: hook compartido).
  useEscapeToClose(onClose, !saving);

  async function submit() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      };
      const saved = editing && team
        ? await assistantAgentTeamsApi.update(team.id, payload)
        : await assistantAgentTeamsApi.create(payload);

      // Attach the selected agents to the (possibly freshly-created) team.
      const targetId = saved?.id ?? team?.id;
      if (targetId && selected.size > 0) {
        const failures = await assignSelected(targetId);
        if (failures.length) {
          setError(failures.join(", "));
          setSaving(false);
          return;
        }
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  // Guard close while saving (backdrop click + Escape both route through here).
  return (
    <ModalShell
      onClose={() => !saving && onClose()}
      title={editing ? t.editTeamTitle : t.newTeamTitle}
      closeLabel={i18n.drawer.close}
      bodyClassName="pl-5 pr-4 pt-3"
      footer={
        <>
          {!editing && onQuickTeam ? (
            <button
              type="button"
              onClick={onQuickTeam}
              disabled={saving}
              title={quickTeamLabel}
              className="mr-auto inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              <i className="ti ti-wand" aria-hidden></i> {quickTeamLabel}
            </button>
          ) : null}
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
            onClick={() => void submit()}
            disabled={saving || !name.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && <i className="ti ti-loader-2 animate-spin" aria-hidden></i>}
            {editing ? t.saveBtn : t.createBtn}
          </button>
        </>
      }
    >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">{t.nameLabel}</span>
            <input
              type="text"
              value={name}
              maxLength={120}
              autoFocus
              placeholder={t.namePlaceholder}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">{t.descriptionLabel}</span>
            <textarea
              value={description}
              maxLength={500}
              rows={2}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            />
          </label>

          <div className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">{t.colorLabel}</span>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c}
                  aria-pressed={color === c}
                  title={c}
                  className={`h-6 w-6 rounded-full ${COLOR_DOT[c]} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${color === c ? "ring-2 ring-offset-1 ring-foreground/40" : ""}`}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">{t.addAgentsBtn}</span>
            {candidates.length === 0 ? (
              <p className="rounded-md bg-muted/40 px-3 py-3 text-center text-[11px] text-muted-foreground">
                {t.addAgentsEmpty}
              </p>
            ) : (
              <AgentGroupedChecklist
                className="flex max-h-44 flex-col gap-1 overflow-y-auto rounded-md border border-input p-1"
                groups={candidateGroups}
                selectedIds={selected}
                onToggle={toggle}
                ungroupedLabel={t.noTeamOption}
                countLabel={(count) => formatAssistantMessage(t.memberCount, { count: String(count) })}
                defaultOpenKeys={openKeys}
                avatarSize={20}
              />
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    </ModalShell>
  );
}
