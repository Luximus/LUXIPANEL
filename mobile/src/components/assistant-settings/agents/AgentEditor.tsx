// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AgentEditor (RN) — editor completo de un agente IA, réplica nativa del editor
 * de WEB/floating-assistant/AgentsTab.tsx. El formulario se reparte en 6
 * sub-pestañas (general | model | hierarchy | tools | resources | access) via
 * `SegmentedControl`. El `draft` lo POSEE el padre (AgentsModule) — este
 * componente solo pinta y emite `onChangeDraft`; el guardado/cancelado y la
 * creación inline de equipo también viven en el padre (`onSave`/`onCancel`/
 * `onCreateTeam`).
 *
 * Los cuerpos de las pestañas viven en `./AgentEditorTabs`; el draft/payload
 * (portados 1:1 del web) en `./agent-editor-draft` y se RE-EXPORTAN aquí
 * (`DraftAgent`, `emptyDraft`, `toDraft`, `toPayload`, `SnippetFilterOptions`)
 * para no tocar importadores. Los payloads CALCAN el schema del backend
 * (credential: objeto=reemplazar, null=quitar, ausente=conservar;
 * snippetCategory/snippetTags siempre presentes).
 */
import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { Cpu, Folder, Key, Share2, User, Wrench } from "lucide-react-native";
import type { ThemeTokens } from "../../../theme/colors";
import type {
  AssistantAgent,
  AgentRole,
  AgentSuggestion,
  AgentTeam,
  AgentResolvedModule,
  AssistantProviderId,
  AssistantProject,
  AssistantSkill,
  RegisteredServerView,
} from "../types";
import { Button } from "../../ui/Button";
import { SegmentedControl } from "../../ui/SegmentedControl";
import { s } from "../styles";
import { type AgentsStrings } from "./agents-i18n";
import type { DraftAgent, SnippetFilterOptions } from "./agent-editor-draft";
import { AccessTab, GeneralTab, HierarchyTab, ModelTab, ResourcesTab, ToolsTab } from "./AgentEditorTabs";

export { emptyDraft, toDraft, toPayload } from "./agent-editor-draft";
export type { DraftAgent, SnippetFilterOptions } from "./agent-editor-draft";

type EditorTab = "general" | "model" | "hierarchy" | "tools" | "resources" | "access";

export function AgentEditor({
  draft,
  onChangeDraft,
  agents,
  roles,
  teams,
  modules,
  projects,
  skills,
  servers,
  snippetOptions,
  busy,
  onSave,
  onCancel,
  onCreateTeam,
  onSuggest,
  tokens,
  str,
  language,
  privateProject = false,
}: {
  draft: DraftAgent;
  onChangeDraft: (next: DraftAgent) => void;
  agents: AssistantAgent[];
  roles: AgentRole[];
  teams: AgentTeam[];
  modules: AgentResolvedModule[];
  projects: AssistantProject[];
  skills: AssistantSkill[];
  servers: RegisteredServerView[];
  snippetOptions: SnippetFilterOptions | null;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
  /** Abre el flujo de creación de equipo en el padre (auto-selecciona el nuevo). */
  onCreateTeam: () => void;
  /** Ayuda-IA opcional: redacta el agente desde un brief. Sin ella se oculta el bloque. */
  onSuggest?: (brief: string, providerId: AssistantProviderId) => Promise<AgentSuggestion | null>;
  tokens: ThemeTokens;
  str: AgentsStrings;
  language: string;
  privateProject?: boolean;
}) {
  const [tab, setTab] = useState<EditorTab>("general");
  const [suggesting, setSuggesting] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const set = (patch: Partial<DraftAgent>) => onChangeDraft({ ...draft, ...patch });

  const teamsById = useMemo(() => new Map(teams.map((tm) => [tm.id, tm])), [teams]);

  const runSuggest = async (brief: string) => {
    if (!onSuggest || !brief || suggesting) return;
    setSuggesting(true);
    try {
      const sug = await onSuggest(brief, draft.providerId);
      if (sug) {
        const hasTools = Array.isArray(sug.allowedTools) && sug.allowedTools.length > 0;
        onChangeDraft({
          ...draft,
          name: sug.name || draft.name,
          description: sug.description || draft.description,
          systemPrompt: sug.systemPrompt || draft.systemPrompt,
          providerId: sug.providerId ?? draft.providerId,
          allowAllTools: hasTools ? false : draft.allowAllTools,
          allowedTools: hasTools ? new Set(sug.allowedTools as string[]) : draft.allowedTools,
        });
      }
    } finally {
      setSuggesting(false);
    }
  };

  const tabs = [
    { key: "general", label: str.editor.tabGeneral, icon: <User size={14} /> },
    { key: "model", label: str.editor.tabModel, icon: <Cpu size={14} /> },
    { key: "hierarchy", label: str.editor.tabHierarchy, icon: <Share2 size={14} /> },
    { key: "tools", label: str.editor.tabTools, icon: <Wrench size={14} /> },
    { key: "resources", label: str.editor.tabResources, icon: <Folder size={14} /> },
    { key: "access", label: str.editor.tabAccess, icon: <Key size={14} /> },
  ];

  return (
    <View style={{ gap: 14 }}>
      <SegmentedControl items={tabs} value={tab} onChange={(k) => setTab(k as EditorTab)} scroll />

      {tab === "general" ? (
        <GeneralTab
          draft={draft}
          set={set}
          onChangeDraft={onChangeDraft}
          tokens={tokens}
          str={str}
          onSuggest={onSuggest}
          suggesting={suggesting}
          aiOpen={aiOpen}
          setAiOpen={setAiOpen}
          runSuggest={runSuggest}
          language={language}
        />
      ) : null}

      {tab === "model" ? <ModelTab draft={draft} set={set} tokens={tokens} str={str} /> : null}

      {tab === "hierarchy" ? (
        <HierarchyTab
          draft={draft}
          set={set}
          agents={agents}
          roles={roles}
          teams={teams}
          teamsById={teamsById}
          tokens={tokens}
          str={str}
          onCreateTeam={onCreateTeam}
        />
      ) : null}

      {tab === "tools" ? <ToolsTab draft={draft} set={set} modules={modules} tokens={tokens} str={str} /> : null}

      {tab === "resources" ? (
        <ResourcesTab
          draft={draft}
          set={set}
          onChangeDraft={onChangeDraft}
          projects={projects}
          skills={skills}
          snippetOptions={snippetOptions}
          privateProject={privateProject}
          tokens={tokens}
          str={str}
        />
      ) : null}

      {tab === "access" ? (
        <AccessTab draft={draft} set={set} servers={servers} tokens={tokens} str={str} />
      ) : null}

      <View style={s.actionsRow}>
        <Button size="sm" variant="ghost" label={str.cancel} onPress={onCancel} disabled={busy} />
        <Button
          size="sm"
          variant="primary"
          label={busy ? str.saving : draft.id ? str.saveChanges : str.editor.createAgent}
          loading={busy}
          disabled={busy || !draft.name.trim() || (!privateProject && !draft.teamId)}
          onPress={onSave}
        />
      </View>
    </View>
  );
}
