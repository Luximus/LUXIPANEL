import { useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { luxAssistantProxy } from "../../api/client";
import { chatStore } from "./chat-store";
import type { Conversation } from "./types";

type Run = { id: string; pendingPermission?: boolean };
type Status = { running: boolean; approval: boolean; unreviewed?: boolean };
type Snapshot = { scope: string; statuses: Map<string, Status>; loaded?: boolean };

/** Live indicators are independent of paginated history and its 20s cache. */
export function useConversationActivity(panelId: string, token: string, activeId: string | null, visible: boolean) {
  const scope = JSON.stringify([panelId, token]);
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({ scope, statuses: new Map() }));
  const active = useRef(activeId);
  active.current = activeId;
  useEffect(() => {
    if (!visible || !token) return;
    let disposed = false, inFlight = false, revision = 0, loaded = false;
    let foreground = !AppState?.currentState || AppState.currentState === "active";
    let timer: ReturnType<typeof setTimeout> | undefined;
    let remote = new Map<string, Status>();
    const local = new Map<string, Status>();
    const unread = new Set<string>();
    let lastLocal = "";
    let localId: string | null = null;
    const publish = () => {
      if (disposed) return;
      const statuses = new Map(remote);
      for (const [id, state] of local) statuses.set(id, state);
      for (const id of unread) if (!statuses.get(id)?.running) statuses.set(id, { running: false, approval: false, unreviewed: true });
      unread.delete(active.current ?? "");
      setSnapshot({ scope, statuses, loaded });
    };
    const observeLocal = () => {
      const id = chatStore.getSession(panelId).conversationId;
      const running = chatStore.getComposer(panelId).busy;
      const last = chatStore.getChat(panelId).messages.at(-1);
      const approval = running && !!last?.permission;
      const signature = JSON.stringify([id, running, approval]);
      if (signature === lastLocal) return;
      lastLocal = signature;
      revision++;
      // Switching threads detaches the old local stream. Its server snapshot
      // must be allowed to settle it instead of retaining a local spinner.
      if (localId && localId !== id) {
        const previous = local.get(localId);
        if (previous) remote.set(localId, previous);
        local.delete(localId);
      }
      localId = id;
      if (id && (running || local.has(id))) {
        local.set(id, { running, approval, unreviewed: false });
        unread.delete(id);
      }
      publish();
    };
    const poll = async () => {
      if (disposed || !foreground || inFlight) return;
      inFlight = true;
      const startedRevision = revision;
      try {
        const response = await luxAssistantProxy<{ runs?: Run[] }>(panelId, token, "GET", "/api/ai/agent/active");
        if (disposed || !foreground || !Array.isArray(response?.runs)) return;
        loaded = true;
        const next = new Map<string, Status>(response.runs.map(run => [run.id, { running: true, approval: !!run.pendingPermission }]));
        for (const [id, previous] of remote) {
          if (previous.running && !next.has(id) && id !== active.current) unread.add(id);
          if (!next.has(id)) next.set(id, { running: false, approval: false });
        }
        for (const run of response.runs) unread.delete(run.id);
        remote = next;
        // Only a read started after the local change can supersede it.
        if (startedRevision === revision) {
          for (const [id, state] of local) if (!state.running) local.delete(id);
        }
        publish();
      } catch { /* Preserve the last successful status on transport failure. */ }
      finally {
        inFlight = false;
        if (!disposed && foreground) timer = setTimeout(() => { void poll(); }, 5000);
      }
    };
    const unsubscribers = [chatStore.subscribeSession(panelId, observeLocal), chatStore.subscribeComposer(panelId, observeLocal), chatStore.subscribeChat(panelId, observeLocal)];
    observeLocal();
    void poll();
    const appState = AppState?.addEventListener("change", state => {
      foreground = state === "active";
      clearTimeout(timer);
      if (foreground) void poll();
    });
    return () => { disposed = true; clearTimeout(timer); appState?.remove(); unsubscribers.forEach(unsubscribe => unsubscribe()); };
  }, [panelId, token, visible]);

  return useMemo(() => {
  const statuses = snapshot.scope === scope ? snapshot.statuses : new Map<string, Status>();
  const liveIds = new Set([...statuses].filter(([, state]) => state.running).map(([id]) => id));
  const decorate = (conversation: Conversation): Conversation => {
    const status = statuses.get(conversation.id);
    const needsApproval = status?.approval ?? (snapshot.scope === scope && snapshot.loaded ? false : conversation.needsApproval);
    const unreviewed = conversation.id === activeId ? false : status?.running ? false : status?.unreviewed ?? conversation.unreviewed;
    return needsApproval === conversation.needsApproval && unreviewed === conversation.unreviewed
      ? conversation : { ...conversation, needsApproval, unreviewed };
  };
  return { liveIds, decorate };
  }, [snapshot, scope, activeId]);
}
