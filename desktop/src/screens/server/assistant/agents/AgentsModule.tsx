import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Loader2, Pencil, Shield, Trash2, Users, WandSparkles, X } from "lucide-react";
import { useConfirm } from "../../../../components/ConfirmDialog";
import { useToast } from "../../../../components/ToastProvider";
import { getMessages, type Messages } from "../../../../i18n";
import enMessages from "../../../../i18n/en.json";
import esMessages from "../../../../i18n/es.json";
import AgentEditor, {
  agentToDraft,
  type AgentDraft,
} from "./AgentEditor";
import ProvidersView from "./ProvidersView";
import {
  agentsApi,
  listAgents,
  listProviders,
  listRoles,
  listTeams,
  rolesApi,
  teamsApi,
  type AgentResource,
  type AgentRole,
  type AgentTeam,
  type AssistantAgent,
} from "./api";

export type AgentsSection = "agents" | "roles" | "teams" | "providers";

type Resources = Record<AgentsSection, AgentResource[]>;

const EMPTY_RESOURCES: Resources = {
  agents: [],
  roles: [],
  teams: [],
  providers: [],
};

type AgentsLocaleCopy = typeof enMessages;

function copyFor(language?: string): AgentsLocaleCopy {
  return language?.slice(0, 2) === "en" ? enMessages : esMessages;
}

function modalShell(
  title: string,
  closeLabel: string,
  onClose: () => void,
  children: React.ReactNode,
) {
  return (
    <div
      className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="lp-modal-card flex max-h-full w-full max-w-3xl flex-col">
        <div className="lp-modal-header">
          <h2 className="lp-modal-title">{title}</h2>
          <button
            type="button"
            className="lp-modal-close"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="lp-modal-body flex flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}

export function AgentsModule({
  panelId,
  language,
}: {
  panelId: string;
  language?: string;
}) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const copy = copyFor(language);
  const standaloneCopy: Messages["serverStandalone"] = getMessages(language).serverStandalone;

  const [section, setSection] = useState<AgentsSection>("agents");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Datos tipados por sección.
  const [agents, setAgents] = useState<AssistantAgent[]>([]);
  const [roles, setRoles] = useState<AgentRole[]>([]);
  const [teams, setTeams] = useState<AgentTeam[]>([]);

  // Resumen ligero para mostrar contadores en la cabecera.
  const [counts, setCounts] = useState<Resources>(EMPTY_RESOURCES);

  // Borrador del editor de agentes (null = cerrado).
  const [agentDraft, setAgentDraft] = useState<AgentDraft | null>(null);
  const [busy, setBusy] = useState(false);

  // Modo directo: el servidor viene fijado por `panelId` (serverId directo).
  // No hay selector de paneles ni rol admin del portal que consultar; el box
  // valida permisos server-side.
  const readOnly = false;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agentRows, roleRows, teamRows, resourceRows] = await Promise.all([
        agentsApi.list(panelId).catch(() => [] as AssistantAgent[]),
        rolesApi.list(panelId).catch(() => [] as AgentRole[]),
        teamsApi.list(panelId).catch(() => [] as AgentTeam[]),
        Promise.all([
          listAgents(panelId),
          listRoles(panelId),
          listTeams(panelId),
          listProviders(panelId),
        ]),
      ]);
      const [agentResources, roleResources, teamResources, providerResources] = resourceRows;
      setAgents(agentRows);
      setRoles(roleRows);
      setTeams(teamRows);
      setCounts({
        agents: agentResources,
        roles: roleResources,
        teams: teamResources,
        providers: providerResources,
      });
    } catch {
      setError(copy.agentsActions.loadError);
    } finally {
      setLoading(false);
    }
  }, [panelId, copy.agentsActions.loadError]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const tabs = useMemo(() => [
    { id: "agents" as const, label: copy.agentsTab.agents, icon: Bot },
    { id: "roles" as const, label: copy.agentsTab.roles, icon: Shield },
    { id: "teams" as const, label: copy.agentsTab.teams, icon: Users },
    { id: "providers" as const, label: copy.agentsTab.providers, icon: WandSparkles },
  ], [copy.agentsTab]);

  // ----- Guardado -----
  const saveAgent = useCallback(async () => {
    if (!agentDraft?.id || readOnly || busy) return;
    setBusy(true);
    try {
      const { id, ...payload } = agentDraft;
      await agentsApi.update(panelId, id, payload);
      setAgentDraft(null);
      toast.success(copy.agentsActions.saved);
      await loadData();
    } catch {
      toast.error(copy.agentsActions.loadError);
    } finally {
      setBusy(false);
    }
  }, [agentDraft, readOnly, busy, panelId, copy.agentsActions.saved, copy.agentsActions.loadError, loadData, toast]);

  const removeAgent = useCallback(
    async (agent: AssistantAgent) => {
      if (readOnly || busy) return;
      const accepted = await confirm({
        title: copy.agentsActions.delete,
        message: `${copy.agentsActions.deleteAgent} (${agent.name})`,
        confirmLabel: copy.agentsActions.deleteConfirm,
        cancelLabel: copy.agentsActions.deleteCancel,
        danger: true,
      });
      if (!accepted) return;
      setBusy(true);
      try {
        await agentsApi.remove(panelId, agent.id);
        toast.success(copy.agentsActions.saved);
        await loadData();
      } catch {
        toast.error(copy.agentsActions.loadError);
      } finally {
        setBusy(false);
      }
    },
    [busy, confirm, copy.agentsActions, loadData, readOnly, panelId, toast],
  );

  // ----- Render -----
  const editLabel = copy.agentsActions.edit;
  const deleteLabel = copy.agentsActions.delete;

  return (
    <div className="flex h-full min-h-0 flex-col bg-base-100 text-base-content">
      <div className="flex flex-wrap items-center gap-3 border-b border-base-300 px-4 py-3">
        <h2 className="mr-auto text-sm font-semibold">
          {copy.agentsActions.sectionTitle}
        </h2>
      </div>

      <div
        className="flex gap-1 overflow-x-auto border-b border-base-300 bg-base-200/30 px-4 pt-2"
        role="tablist"
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={section === id}
            className={`flex items-center gap-2 rounded-t-lg border-b-2 px-3 py-2 text-xs font-medium ${section === id ? "border-primary bg-base-100 text-primary" : "border-transparent text-base-content/60 hover:text-base-content"}`}
            onClick={() => setSection(id)}
          >
            <Icon size={14} /> {label}
            <span className="badge badge-ghost badge-sm">{counts[id].length}</span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error ? (
          <div className="alert alert-error mb-4 py-2 text-sm">
            <span>{error}</span>
          </div>
        ) : null}
        {loading ? (
          <div className="flex min-h-52 items-center justify-center">
            <Loader2 className="animate-spin" size={22} />
          </div>
        ) : section === "agents" ? (
          <AgentsList
            items={agents}
            readOnly={readOnly}
            busy={busy}
            emptyLabel={copy.agentsActions.noAgents}
            editLabel={editLabel}
            deleteLabel={deleteLabel}
            onEdit={(agent) => setAgentDraft(agentToDraft(agent))}
            onRemove={(agent) => void removeAgent(agent)}
          />
        ) : section === "roles" ? (
          <RolesList
            items={roles}
            emptyLabel={copy.agentsActions.noRoles}
          />
        ) : section === "teams" ? (
          <TeamsList
            items={teams}
            agents={agents}
            emptyLabel={copy.agentsActions.noTeams}
            membersLabel={copy.agentsActions.members}
          />
        ) : (
          <ProvidersView serverId={panelId} copy={standaloneCopy} readOnly={readOnly} />
        )}
      </div>

      {agentDraft
        ? modalShell(
            agentDraft.id ? copy.agentEditor.editTitle : copy.agentEditor.newTitle,
            copy.agentEditor.cancel,
            () => setAgentDraft(null),
            <AgentEditor
              draft={agentDraft}
              agents={agents}
              roles={roles}
              teams={teams}
              copy={copy.agentEditor}
              readOnly={readOnly}
              busy={busy}
              onChange={setAgentDraft}
              onCancel={() => setAgentDraft(null)}
              onSave={() => void saveAgent()}
            />,
          )
        : null}

      {dialog}
    </div>
  );
}

// ---- Tarjetas de cada sección ----

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-base-300 py-12 text-base-content/60">
      <Bot size={22} />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
  );
}

function Card({
  title,
  subtitle,
  badges,
  actions,
}: {
  title: string;
  subtitle?: string;
  badges?: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4 shadow-sm">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-bold">{title}</h3>
        {subtitle ? <p className="text-xs text-base-content/60">{subtitle}</p> : null}
      </div>
      {badges ? <div className="flex flex-wrap items-center gap-1.5">{badges}</div> : null}
      <div className="flex flex-wrap items-center justify-end gap-1.5">{actions}</div>
    </article>
  );
}

function SmallIconButton({
  label,
  icon,
  onClick,
  danger = false,
  disabled = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`btn btn-xs gap-1 ${danger ? "btn-error" : "btn-ghost"}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      {label}
    </button>
  );
}

function AgentsList({
  items,
  readOnly,
  busy,
  emptyLabel,
  editLabel,
  deleteLabel,
  onEdit,
  onRemove,
}: {
  items: AssistantAgent[];
  readOnly: boolean;
  busy: boolean;
  emptyLabel: string;
  editLabel: string;
  deleteLabel: string;
  onEdit: (agent: AssistantAgent) => void;
  onRemove: (agent: AssistantAgent) => void;
}) {
  if (items.length === 0) return <EmptyState message={emptyLabel} />;
  return (
    <CardGrid>
      {items.map((agent) => (
        <Card
          key={agent.id}
          title={agent.name}
          subtitle={agent.description || emptyLabel}
          badges={
            <>
              <span className="badge badge-outline badge-sm">{agent.providerId}</span>
              {agent.model ? (
                <span className="badge badge-ghost badge-sm">{agent.model}</span>
              ) : null}
              <span className="badge badge-ghost badge-sm">
                {agent.allowedTools === null ? "∞" : `${agent.allowedTools.length}`}
              </span>
            </>
          }
          actions={
            <>
              <SmallIconButton
                label={editLabel}
                icon={<Pencil size={12} />}
                onClick={() => onEdit(agent)}
              />
              {!readOnly && agent.relation !== "shared" ? (
                <SmallIconButton
                  label={deleteLabel}
                  icon={<Trash2 size={12} />}
                  onClick={() => onRemove(agent)}
                  disabled={busy}
                  danger
                />
              ) : null}
            </>
          }
        />
      ))}
    </CardGrid>
  );
}

function RolesList({
  items,
  emptyLabel,
}: {
  items: AgentRole[];
  emptyLabel: string;
}) {
  if (items.length === 0) return <EmptyState message={emptyLabel} />;
  return (
    <CardGrid>
      {items.map((role) => (
        <Card
          key={role.id}
          title={role.name}
          subtitle={role.description || emptyLabel}
          badges={
            <span className="badge badge-ghost badge-sm">
              {role.allowedTools === null ? "∞" : `${role.allowedTools.length}`}
            </span>
          }
          actions={null}
        />
      ))}
    </CardGrid>
  );
}

function TeamsList({
  items,
  agents,
  emptyLabel,
  membersLabel,
}: {
  items: AgentTeam[];
  agents: AssistantAgent[];
  emptyLabel: string;
  membersLabel: string;
}) {
  if (items.length === 0) return <EmptyState message={emptyLabel} />;
  return (
    <CardGrid>
      {items.map((team) => {
        const count = team.memberCount ?? agents.filter((a) => a.teamId === team.id).length;
        return (
          <Card
            key={team.id}
            title={team.name}
            subtitle={team.description || emptyLabel}
            badges={
              <span className="badge badge-ghost badge-sm">
                {membersLabel.replace("{count}", String(count))}
              </span>
            }
            actions={null}
          />
        );
      })}
    </CardGrid>
  );
}

