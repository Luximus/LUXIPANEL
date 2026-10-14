// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { ReactNode } from "react";
import { ProviderIcon } from "./ProviderIcon";
import { formatAssistantMessage, useAssistantI18n } from "./i18n";
import {
  PROVIDER_META,
  PROVIDER_ORDER,
  type AssistantAgent,
  type AssistantAgentRole,
  type AssistantProviderId,
} from "./assistant-api";

const PROVIDER_ID_SET = new Set<string>(PROVIDER_ORDER);
function isProviderId(p: string | null | undefined): p is AssistantProviderId {
  return !!p && PROVIDER_ID_SET.has(p);
}

/** i18n slice used by the agent info chips (role / provider+model). All keys
 *  degrade to an inline Spanish fallback so the chips never render an empty
 *  tooltip even before the locale bundle merges in. */
function useAgentInfoI18n() {
  const i18n = useAssistantI18n() as ReturnType<typeof useAssistantI18n> & {
    agentInfo?: Partial<{
      roleLabel: string;
      roleTooltip: string;
      providerLabel: string;
      providerModelTooltip: string;
      projectLabel: string;
      projectTooltip: string;
    }>;
  };
  const a = i18n.agentInfo ?? {};
  return {
    roleLabel: a.roleLabel ?? "Rol",
    roleTooltip: a.roleTooltip ?? "Rol del agente: {role}",
    providerLabel: a.providerLabel ?? "Proveedor",
    providerModelTooltip: a.providerModelTooltip ?? "Proveedor {provider} · Modelo {model}",
    projectLabel: a.projectLabel ?? "Proyecto",
    projectTooltip: a.projectTooltip ?? "Proyecto: {project}",
  };
}

/**
 * RoleChip — compact violet pill showing an agent's assigned role. Renders
 * nothing when the agent has no role (so a role-less agent shows no empty chip).
 * The `title` tooltip carries the role description (or a generic label) so the
 * pill stays terse while the full meaning is one hover away.
 */
export function RoleChip({
  role,
  className,
}: {
  role: AssistantAgentRole | null | undefined;
  className?: string;
}) {
  const t = useAgentInfoI18n();
  if (!role) return null;
  const tooltip = role.description?.trim()
    ? `${formatAssistantMessage(t.roleTooltip, { role: role.name })} — ${role.description.trim()}`
    : formatAssistantMessage(t.roleTooltip, { role: role.name });
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-medium text-violet-600 dark:text-violet-400 ${className ?? ""}`}
      title={tooltip}
    >
      <i className="ti ti-user-star text-[9px]" aria-hidden></i>
      <span className="truncate">{role.name}</span>
    </span>
  );
}

/**
 * ProviderModelChip — provider brand icon + label with the active model name.
 * Reuses the shared `ProviderIcon` / `PROVIDER_META` (never invents a new icon
 * set) and degrades gracefully: an unknown provider falls back to a generic
 * robot glyph, and a missing model simply drops the model segment. Renders
 * nothing when there is neither a known provider nor a model.
 */
export function ProviderModelChip({
  provider,
  model,
  className,
}: {
  provider: string | null | undefined;
  model: string | null | undefined;
  className?: string;
}) {
  const t = useAgentInfoI18n();
  const known = isProviderId(provider);
  const meta = known ? PROVIDER_META[provider] : null;
  const trimmedModel = model?.trim() || "";
  if (!known && !trimmedModel) return null;
  const providerLabel = meta?.label ?? provider ?? t.providerLabel;
  const tooltip = formatAssistantMessage(t.providerModelTooltip, {
    provider: providerLabel,
    model: trimmedModel || "—",
  });
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1 rounded-full bg-muted/60 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground ${className ?? ""}`}
      title={tooltip}
    >
      <span className="shrink-0 text-[9px] leading-none">
        {known ? (
          <ProviderIcon id={provider} className="text-[10px]" />
        ) : (
          <i className="ti ti-robot text-[10px]" aria-hidden></i>
        )}
      </span>
      <span className="truncate">
        {providerLabel}
        {trimmedModel && (
          <span className="text-muted-foreground/70"> · {trimmedModel}</span>
        )}
      </span>
    </span>
  );
}

/**
 * ProjectChip — discreet folder badge naming the project an agent belongs to.
 * Meant ONLY for a team/project leader (the additive `agent.project` contract is
 * populated server-side just for leaders). Consumed defensively: renders nothing
 * when there is no project name yet, so it never breaks if the backend hasn't
 * started emitting the field. Mirrors the terse pill chrome of `RoleChip` /
 * `ProviderModelChip` so it sits cleanly on the agent's name row.
 */
export function ProjectChip({
  project,
  className,
}: {
  project?: { id: string; name: string } | null;
  className?: string;
}) {
  const t = useAgentInfoI18n();
  const name = project?.name?.trim();
  if (!name) return null;
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-medium text-sky-700 dark:text-sky-300 ${className ?? ""}`}
      title={formatAssistantMessage(t.projectTooltip, { project: name })}
    >
      <i className="ti ti-folder text-[9px]" aria-hidden></i>
      <span className="truncate">{name}</span>
    </span>
  );
}

/**
 * AgentInfoChips — reusable cluster that renders an agent's role pill and its
 * provider+model pill side by side. Used by the assistant Dashboard rows and
 * the chat top bar so both surfaces expose the same agent metadata identically.
 * The role is resolved from `rolesById` via the agent's `roleId`. Individual
 * chips are also exported (`RoleChip` / `ProviderModelChip`) for callers that
 * need to place them apart (e.g. role on the header line, provider on the meta
 * line).
 */
export function AgentInfoChips({
  agent,
  rolesById,
  className,
  showRole = true,
  showProviderModel = true,
}: {
  agent: AssistantAgent;
  rolesById?: Map<string, AssistantAgentRole> | null;
  className?: string;
  showRole?: boolean;
  showProviderModel?: boolean;
}): ReactNode {
  const role = agent.roleId ? rolesById?.get(agent.roleId) ?? null : null;
  return (
    <span className={`inline-flex min-w-0 items-center gap-1 ${className ?? ""}`}>
      {showRole && <RoleChip role={role} />}
      {showProviderModel && (
        <ProviderModelChip provider={agent.providerId} model={agent.model} />
      )}
    </span>
  );
}
