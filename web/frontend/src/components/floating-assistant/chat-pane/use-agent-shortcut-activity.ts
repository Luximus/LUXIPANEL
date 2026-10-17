// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useState, useSyncExternalStore } from "react";
import { resolveTargetScope, scopeHeaders } from "@/lib/api-client";
import { assistantConversationsApi, type ConversationActivity } from "../assistant-api/conversations";
import { chatEngine } from "../chat-engine";

export type AgentShortcutState = "available" | "running" | "waiting" | "failed" | "done";
export type AgentShortcutActivity = { state: AgentShortcutState; unreadCount: number };

export function summarizeAgentActivity(rows: ConversationActivity[]): Map<string, AgentShortcutActivity> {
  const summary = new Map<string, AgentShortcutActivity>();
  const priority: Record<AgentShortcutState, number> = { available: 0, done: 1, failed: 2, running: 3, waiting: 4 };
  for (const row of rows) {
    if (!row.agentId) continue;
    const previous = summary.get(row.agentId) ?? { state: "available", unreadCount: 0 };
    const unreadCount = row.unreviewed ? Math.max(0, row.unreadCount ?? 1) : 0;
    const state = row.pendingPermission ? "waiting" : row.running ? "running"
      : row.lastReplyState === "waiting" ? "waiting"
      : unreadCount > 0 ? row.lastReplyState ?? "done" : "available";
    summary.set(row.agentId, { state: priority[state] > priority[previous.state] ? state : previous.state,
      unreadCount: previous.unreadCount + unreadCount });
  }
  return summary;
}

const scopeEvents = ["luxipanel:target-changed", "luxipanel:logout", "luxipanel:session-ended", "luxipanel:session-started", "luxipanel:permissions-changed"];
const identity = () => JSON.stringify([resolveTargetScope(), scopeHeaders()]);

export function useAgentShortcutActivity(projectIds: string[], agentIds: string[], enabled: boolean) {
  const [epoch, setEpoch] = useState(0);
  const scope = identity();
  const projectsKey = JSON.stringify(projectIds.slice().sort());
  const agentsKey = JSON.stringify(agentIds.slice().sort());
  const key = JSON.stringify([scope, projectsKey, agentsKey, epoch]);
  const [snapshot, setSnapshot] = useState<{ key: string; rows: ConversationActivity[]; error: boolean }>();
  useSyncExternalStore(chatEngine.subscribe, chatEngine.getVersion, chatEngine.getVersion);
  useEffect(() => {
    const reset = () => setEpoch(value => value + 1);
    scopeEvents.forEach(event => window.addEventListener(event, reset));
    return () => scopeEvents.forEach(event => window.removeEventListener(event, reset));
  }, []);
  useEffect(() => {
    if (!enabled || !agentIds.length || !projectIds.length) return;
    let disposed = false;
    let pending = false;
    let refreshAgain = false;
    const refresh = async () => {
      if (disposed || document.visibilityState === "hidden" || identity() !== scope) return;
      if (pending) { refreshAgain = true; return; }
      pending = true;
      try {
        const rows = await assistantConversationsApi.activity(JSON.parse(projectsKey), JSON.parse(agentsKey));
        if (!disposed && identity() === scope) setSnapshot({ key, rows, error: false });
      } catch {
        if (!disposed && identity() === scope) setSnapshot({ key, rows: [], error: true });
      } finally {
        pending = false;
        if (refreshAgain && !disposed) { refreshAgain = false; void refresh(); }
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    window.addEventListener("lxp:assistant:conversations-updated", refresh);
    window.addEventListener("lxp:assistant:conversation-reviewed", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("lxp:assistant:conversations-updated", refresh);
      window.removeEventListener("lxp:assistant:conversation-reviewed", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [key, enabled]);
  const current = snapshot?.key === key ? snapshot : undefined;
  const rows = (current?.rows ?? []).map(row => ({ ...row,
    running: row.running || !!chatEngine.get(row.id)?.streaming || chatEngine.isBackgroundRunning(row.id) || chatEngine.isWorkerTaskRunning(row.id),
    pendingPermission: row.pendingPermission || chatEngine.hasPendingPermission(row.id),
  }));
  return { activity: summarizeAgentActivity(rows), loading: !current, error: current?.error ?? false };
}
