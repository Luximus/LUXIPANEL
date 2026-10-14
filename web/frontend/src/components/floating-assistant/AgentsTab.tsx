// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Agents tab — create/manage custom AI agents (CLI-subagent style): each agent
 * has a name, description, system prompt, an allowed-tool subset, and a
 * provider/model. "Iniciar chat" launches a fresh conversation bound to the
 * agent (the parent wires it to the Chat tab). Agents are panel-host/global and
 * can also be selected from the Cron module's scheduled AI-jobs.
 *
 * Thin orchestrator: all state/effects/handlers live in `./agents-tab/
 * use-agents-tab` (moved VERBATIM so the hook order is byte-identical to the
 * old monolith); the presentational views live under `./agents-tab/*`. Public
 * props + the named `AgentsTab` export (and the re-exported `TeamsMessages`
 * type consumed by the team modals) are unchanged.
 */
import { TeamTemplatesModal } from "./TeamTemplatesModal";
import { useAgentsTab, type AgentsTabProps } from "./agents-tab/use-agents-tab";
import { AgentEditor } from "./agents-tab/AgentEditor";
import { RoleEditorView } from "./agents-tab/RoleEditorView";
import { TreeView } from "./agents-tab/TreeView";
import { RolesListView } from "./agents-tab/RolesListView";
import { AgentsListView } from "./agents-tab/AgentsListView";
import { ViewTransition } from "@/components/ui/ViewTransition";

/** i18n subtree for the agent-teams UI, shared with the team modal components. */
export type { TeamsMessages } from "./agents-tab/messages";

export function AgentsTab(props: AgentsTabProps) {
  const vm = useAgentsTab(props);
  const { draft, roleDraft, showTemplates, showTree, showRoles, setShowTemplates, reload, locale } = vm;

  // ── Roles list view ───────────────────────────────────────────────────────
  if (showTemplates) {
    return (
      <TeamTemplatesModal
        onClose={() => setShowTemplates(false)}
        onCreated={() => {
          void reload();
          window.dispatchEvent(new CustomEvent("lxp:assistant:agents-updated"));
        }}
        locale={locale}
      />
    );
  }

  // Cada vista (lista / editor de agente / editor de rol / árbol / roles) se
  // monta en exclusiva, así que el wrapper remontado por vista reproduce la
  // transición de entrada del panel (motion.css) sin coste extra.
  const view = draft ? "editor" : roleDraft ? "role-editor" : showTree ? "tree" : showRoles ? "roles" : "list";
  return (
    <ViewTransition viewKey={view}>
      {view === "editor" && <AgentEditor vm={vm} />}
      {view === "role-editor" && <RoleEditorView vm={vm} />}
      {view === "tree" && <TreeView vm={vm} />}
      {view === "roles" && <RolesListView vm={vm} />}
      {view === "list" && <AgentsListView vm={vm} />}
    </ViewTransition>
  );
}
