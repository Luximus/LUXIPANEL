import { useState, type ReactElement } from "react";
import { Bot, Cpu, KeyRound, ShieldCheck, Sparkles, Users, Wrench } from "lucide-react";
import type {
  AgentDraft as AgentDraftShape,
  AgentEditorCopy,
} from "./types";
import type {
  AgentPayload,
  AgentRole,
  AgentTeam,
  AssistantAgent,
  AssistantProviderId,
} from "./api";

// Re-exportar tipos para los consumidores externos.
export type { AgentDraft, AgentEditorCopy } from "./types";

const PROVIDERS: AssistantProviderId[] = ["claude", "codex", "gemini", "deepseek", "grok", "minimax"];

export function emptyAgentDraft(): AgentDraftShape {
  return {
    name: "",
    description: "",
    systemPrompt: "",
    providerId: "claude",
    providerIds: [],
    model: "",
    agentMode: "single",
    multiAgentCount: 3,
    allowedTools: null,
    icon: "Bot",
    color: "violet",
    roleId: null,
    teamId: null,
    parentAgentId: null,
    connections: [],
    canSpawnChats: false,
    realtime: false,
  };
}

export function agentToDraft(agent: AssistantAgent): AgentDraftShape {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description ?? "",
    systemPrompt: agent.systemPrompt ?? "",
    providerId: agent.providerId,
    providerIds: agent.providerIds ?? [],
    model: agent.model ?? "",
    agentMode: agent.agentMode ?? "single",
    multiAgentCount: agent.multiAgentCount ?? 3,
    allowedTools: agent.allowedTools,
    icon: agent.icon ?? "Bot",
    color: agent.color ?? "violet",
    roleId: agent.roleId ?? null,
    teamId: agent.teamId ?? null,
    parentAgentId: agent.parentAgentId ?? null,
    connections: agent.connections ?? [],
    canSpawnChats: Boolean(agent.canSpawnChats),
    realtime: Boolean(agent.realtime),
  };
}

function splitTools(value: string): string[] {
  return [...new Set(value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))];
}

type EditorTab = keyof AgentEditorCopy["tabs"];

function Toggle({
  checked,
  label,
  disabled,
  onChange,
}: {
  checked: boolean;
  label: string;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="checkbox checkbox-sm"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export default function AgentEditor({
  draft,
  agents,
  roles,
  teams,
  copy,
  readOnly,
  busy,
  onChange,
  onCancel,
  onSave,
}: {
  draft: AgentDraftShape;
  agents: AssistantAgent[];
  roles: AgentRole[];
  teams: AgentTeam[];
  copy: AgentEditorCopy;
  readOnly: boolean;
  busy: boolean;
  onChange: (draft: AgentDraftShape) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const [tab, setTab] = useState<EditorTab>("identity");
  const set = (patch: Partial<AgentDraftShape>) => onChange({ ...draft, ...patch });
  const otherAgents = agents.filter((agent) => agent.id !== draft.id);
  const icons: Record<EditorTab, ReactElement> = {
    identity: <Bot size={14} />,
    prompt: <Sparkles size={14} />,
    tools: <Wrench size={14} />,
    models: <Cpu size={14} />,
    permissions: <KeyRound size={14} />,
    teams: <Users size={14} />,
  };

  return (
    <div className="flex flex-col gap-3">
      {readOnly ? (
        <div role="status" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          {copy.readOnlyHint}
        </div>
      ) : null}

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label={draft.id ? copy.editTitle : copy.newTitle}>
        {(Object.keys(copy.tabs) as EditorTab[]).map((key) => {
          const Icon = icons[key];
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`flex items-center gap-2 rounded-t-md border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                active
                  ? "border-primary bg-base-100 text-primary"
                  : "border-transparent text-base-content/60 hover:text-base-content"
              }`}
              onClick={() => setTab(key)}
            >
              {Icon}
              <span>{copy.tabs[key]}</span>
            </button>
          );
        })}
      </div>

      {tab === "identity" ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{copy.fields.name}</span>
            <input
              className="input input-bordered w-full"
              value={draft.name}
              maxLength={120}
              disabled={readOnly}
              onChange={(event) => set({ name: event.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{copy.fields.description}</span>
            <textarea
              className="textarea textarea-bordered w-full"
              value={draft.description}
              maxLength={500}
              disabled={readOnly}
              onChange={(event) => set({ description: event.target.value })}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{copy.fields.icon}</span>
              <input
                className="input input-bordered w-full"
                value={draft.icon ?? ""}
                maxLength={60}
                disabled={readOnly}
                onChange={(event) => set({ icon: event.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{copy.fields.color}</span>
              <input
                className="input input-bordered w-full"
                value={draft.color ?? ""}
                maxLength={30}
                disabled={readOnly}
                onChange={(event) => set({ color: event.target.value })}
              />
            </label>
          </div>
        </div>
      ) : null}

      {tab === "prompt" ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{copy.fields.systemPrompt}</span>
          <textarea
            className="textarea textarea-bordered w-full font-mono"
            style={{ minHeight: "18rem" }}
            value={draft.systemPrompt}
            maxLength={20_000}
            disabled={readOnly}
            onChange={(event) => set({ systemPrompt: event.target.value })}
          />
        </label>
      ) : null}

      {tab === "tools" ? (
        <div className="flex flex-col gap-3">
          <Toggle
            checked={draft.allowedTools === null}
            disabled={readOnly}
            label={copy.fields.allowAllTools}
            onChange={(checked) => set({ allowedTools: checked ? null : [] })}
          />
          {draft.allowedTools !== null ? (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{copy.fields.allowedTools}</span>
              <textarea
                className="textarea textarea-bordered w-full"
                value={draft.allowedTools.join("\n")}
                disabled={readOnly}
                onChange={(event) => set({ allowedTools: splitTools(event.target.value) })}
              />
              <small className="text-base-content/60">{copy.fields.allowedToolsHint}</small>
            </label>
          ) : null}
        </div>
      ) : null}

      {tab === "models" ? (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{copy.fields.provider}</span>
              <select
                className="select select-bordered w-full"
                value={draft.providerId}
                disabled={readOnly}
                onChange={(event) => set({ providerId: event.target.value as AssistantProviderId })}
              >
                {PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{copy.fields.model}</span>
              <input
                className="input input-bordered w-full"
                value={draft.model}
                maxLength={128}
                disabled={readOnly}
                onChange={(event) => set({ model: event.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{copy.fields.agentMode}</span>
              <select
                className="select select-bordered w-full"
                value={draft.agentMode}
                disabled={readOnly}
                onChange={(event) => set({ agentMode: event.target.value as "single" | "multi" })}
              >
                <option value="single">{copy.fields.single}</option>
                <option value="multi">{copy.fields.multi}</option>
              </select>
            </label>
            {draft.agentMode === "multi" ? (
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">{copy.fields.copies}</span>
                <input
                  className="input input-bordered w-full"
                  type="number"
                  min={2}
                  max={8}
                  value={draft.multiAgentCount ?? 3}
                  disabled={readOnly}
                  onChange={(event) =>
                    set({ multiAgentCount: Math.max(2, Math.min(8, Number(event.target.value) || 3)) })
                  }
                />
              </label>
            ) : null}
          </div>
          {draft.agentMode === "multi" ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">{copy.fields.extraProviders}</legend>
              <div className="flex flex-wrap gap-3">
                {PROVIDERS.filter((provider) => provider !== draft.providerId).map((provider) => (
                  <Toggle
                    key={provider}
                    checked={(draft.providerIds ?? []).includes(provider)}
                    disabled={readOnly}
                    label={provider}
                    onChange={(checked) =>
                      set({
                        providerIds: checked
                          ? [...(draft.providerIds ?? []), provider]
                          : (draft.providerIds ?? []).filter((item) => item !== provider),
                      })
                    }
                  />
                ))}
              </div>
            </fieldset>
          ) : null}
        </div>
      ) : null}

      {tab === "permissions" ? (
        <div className="flex flex-col gap-3">
          <Toggle
            checked={Boolean(draft.canSpawnChats)}
            disabled={readOnly}
            label={copy.fields.canSpawnChats}
            onChange={(checked) => set({ canSpawnChats: checked })}
          />
          <Toggle
            checked={Boolean(draft.realtime)}
            disabled={readOnly}
            label={copy.fields.realtime}
            onChange={(checked) => set({ realtime: checked })}
          />
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{copy.fields.parentAgent}</span>
            <select
              className="select select-bordered w-full"
              value={draft.parentAgentId ?? ""}
              disabled={readOnly}
              onChange={(event) => set({ parentAgentId: event.target.value || null })}
            >
              <option value="">{copy.fields.none}</option>
              {otherAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{copy.fields.connections}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {otherAgents.map((agent) => (
                <Toggle
                  key={agent.id}
                  checked={(draft.connections ?? []).includes(agent.id)}
                  disabled={readOnly}
                  label={agent.name}
                  onChange={(checked) =>
                    set({
                      connections: checked
                        ? [...(draft.connections ?? []), agent.id]
                        : (draft.connections ?? []).filter((id) => id !== agent.id),
                    })
                  }
                />
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}

      {tab === "teams" ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{copy.fields.role}</span>
            <select
              className="select select-bordered w-full"
              value={draft.roleId ?? ""}
              disabled={readOnly}
              onChange={(event) => set({ roleId: event.target.value || null })}
            >
              <option value="">{copy.fields.none}</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{copy.fields.team}</span>
            <select
              className="select select-bordered w-full"
              value={draft.teamId ?? ""}
              disabled={readOnly}
              onChange={(event) => set({ teamId: event.target.value || null })}
            >
              <option value="">{copy.fields.none}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div className="lp-modal-footer">
        <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onCancel}>
          {copy.cancel}
        </button>
        {!readOnly ? (
          <button
            type="button"
            className="lp-modal-btn lp-modal-btn--primary"
            disabled={busy || !draft.name.trim()}
            onClick={onSave}
          >
            <ShieldCheck size={14} />
            {busy ? copy.saving : copy.save}
          </button>
        ) : null}
      </div>
    </div>
  );
}

// AgentPayload ya está exportado vía "./api"; este import es solo para evitar
// el aviso de "no usado" si la versión de TS detecta que AgentPayload no se
// referencia aquí directamente (la firma `agentToDraft` lo usa implícitamente).
export type { AgentPayload };
