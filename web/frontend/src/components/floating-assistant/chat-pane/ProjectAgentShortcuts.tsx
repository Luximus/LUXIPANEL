// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AssistantAgent } from "../assistant-api";
import { AgentAvatar } from "../AgentAvatar";
import { formatAssistantMessage } from "../i18n";
import type { AgentShortcutActivity } from "./use-agent-shortcut-activity";
import "./project-agent-shortcuts.css";

export type AgentShortcutLabels = {
  heading: string; description: string; empty: string; select: string; unread: string;
  available: string; running: string; waiting: string; failed: string; done: string;
  loading: string; unavailable: string;
};

export function ProjectAgentShortcuts({ agents, selectedId, roleLabel, onSelect, activity, loading, error, labels }: {
  agents: AssistantAgent[];
  selectedId: string | null;
  roleLabel: (agent: AssistantAgent) => string;
  onSelect: (id: string) => void;
  activity: Map<string, AgentShortcutActivity>;
  loading: boolean;
  error: boolean;
  labels: AgentShortcutLabels;
}) {
  if (!agents.length) return <p className="mt-4 text-sm text-muted-foreground" role="status">{loading ? labels.loading : labels.empty}</p>;
  return <div className="lxp-project-agent-shortcuts" role="group" aria-label={labels.heading} tabIndex={0}>
    {agents.map(agent => {
      const value = activity.get(agent.id!) ?? { state: "available", unreadCount: 0 };
      const state = error ? "unavailable" : loading ? "loading" : value.state;
      const statusLabel = labels[state];
      const unread = formatAssistantMessage(labels.unread, { count: value.unreadCount });
      return <button key={agent.id} type="button" className="lxp-agent-shortcut" data-agent-shortcut={agent.id}
        aria-pressed={selectedId === agent.id}
        aria-label={`${formatAssistantMessage(labels.select, { name: agent.name })} · ${roleLabel(agent)} · ${statusLabel}${!loading && !error ? ` · ${unread}` : ""}`}
        onClick={() => onSelect(agent.id!)}>
        <span className="lxp-agent-shortcut__top">
          <AgentAvatar agent={agent} size={32} />
          {!loading && !error && value.unreadCount > 0 && <span className="lxp-agent-shortcut__unread" title={unread} aria-label={unread}>{value.unreadCount > 99 ? "99+" : value.unreadCount}</span>}
          {selectedId === agent.id && <i className="ti ti-check lxp-agent-shortcut__selected" aria-hidden />}
        </span>
        <span className="lxp-agent-shortcut__identity"><strong title={agent.name}>{agent.name}</strong><span title={roleLabel(agent)}>{roleLabel(agent)}</span></span>
        <span className="lxp-agent-shortcut__status" data-state={state} title={statusLabel}>
          {state === "available" || state === "loading" ? <span className="lxp-agent-shortcut__dot" aria-hidden />
            : <i className={`ti ${state === "running" ? "ti-loader-2" : state === "waiting" ? "ti-clock" : state === "failed" ? "ti-alert-circle" : state === "done" ? "ti-circle-check" : "ti-cloud-off"}`} aria-hidden />}
          <span className="lxp-agent-shortcut__status-label">{statusLabel}</span>
        </span>
      </button>;
    })}
  </div>;
}
