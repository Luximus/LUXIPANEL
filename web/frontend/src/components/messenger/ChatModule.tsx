// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * /panel/chat — internal user-to-user chat screen. Reuses the AI assistant's
 * chat UI/UX (conversation list + thread + composer) but is backed by the
 * per-server chat API + an SSE stream instead of the LLM engine.
 */
import { createPortal } from "react-dom";
import { useModuleVisibility } from "@/components/workspace/module-visibility";
import { acquireChatStream } from "@/lib/chat-event-stream";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatI18nProvider, mergeChatMessages } from "./i18n";
import { ConversationList } from "./ConversationList";
import { useViewEnterReplay } from "@/components/ui/ViewTransition";
import { MessageThread } from "./MessageThread";
import { NewChatDialog } from "./NewChatDialog";
import { ChatSettingsDrawer, isChatSettingsSection, type ChatSettingsSection } from "./ChatSettingsDrawer";
import { ConversationMediaDrawer } from "./ConversationMediaDrawer";
import { chatPrefs, useChatPrefs } from "./chat-prefs";
import { setActiveConversation } from "./active-conv-bridge";
import { ChatCallHost, callsSupported } from "./call/ChatCallHost";
import { callApi } from "./call/call-api";
import { tolqiaPlanMessage } from "./call/TolqiaPlanNotice";
import { tolqiaReason } from "./call/tolqia-plan";
import { isCallLive, parseChatCallEvent, type ChatCallSession, type ChatCallView } from "@/lib/chat-call";
import { showToast } from "@/lib/toast";
import {
  EMPTY_DIRECTORY,
  messengerApi,
  normalizeGroupMembers,
  resolveApiPath,
  type ChatMessage,
  type ConversationView,
  type Directory,
  type DirectoryUser,
  type NewAttachment,
} from "./messenger-api";

/** Refresh cadence of the shared directory while the tab is visible. */
const DIRECTORY_REFRESH_MS = 60_000;

/** Mark a search-runtime CustomEvent as handled (`detail.__ack`). */
function ackEvent(event: Event): void {
  const detail = (event as CustomEvent<Record<string, unknown>>).detail;
  if (detail && typeof detail === "object") detail.__ack = true;
}

interface SseMessageEvent {
  targetId: string;
  participants: string[];
  conversation: {
    id: string;
    kind: ConversationView["kind"];
    title?: string | null;
    members: string[];
    lastMessageAt?: string | null;
    lastMessagePreview?: string | null;
    lastMessageFrom?: string | null;
  };
  message: ChatMessage;
}

export default function ChatModule({
  locale = "es",
  me,
  messages,
  initialConvId = null,
  initialTo = null,
  openNew = false,
  initialSettingsSection = null,
  initialCallId = null,
  isAdmin = false,
}: {
  locale?: string;
  me: string;
  /**
   * Si el usuario es admin del panel (`Astro.locals.user.kind === "admin"`).
   * Solo cambia el enlace a Ajustes → Credenciales del badge de plan Tolqia; el
   * gate REAL vive en el backend (`/api/chat/tolqia/config` es admin-only).
   */
  isAdmin?: boolean;
  messages?: unknown;
  initialConvId?: string | null;
  initialTo?: string | null;
  openNew?: boolean;
  /** Deep-link `?settings=<section>` resolved by the Astro page. */
  initialSettingsSection?: string | null;
  /**
   * Bloque F — deep-link `?call=<callId>`: the topbar banner's "Aceptar"
   * navigates here, so the island joins that call as soon as it mounts.
   */
  initialCallId?: string | null;
}) {
  const i18n = useMemo(() => mergeChatMessages(messages), [messages]);
  // Stable handle for the (non-React) event listeners registered once on mount.
  const i18nRef = useRef(i18n);
  i18nRef.current = i18n;
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [activeId, setActiveId] = useState<string | null>(initialConvId);
  // Al cambiar de conversación (y en móvil al pasar lista → hilo) el hilo entra
  // con la transición de vista del panel; el hilo permanece montado.
  const threadViewRef = useViewEnterReplay<HTMLDivElement>(activeId);
  const [msgByConv, setMsgByConv] = useState<Record<string, ChatMessage[]>>({});
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [showNew, setShowNew] = useState(openNew);
  const [directory, setDirectory] = useState<Directory>(EMPTY_DIRECTORY);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const initialToConsumed = useRef(false);
  const [settingsSection, setSettingsSection] = useState<ChatSettingsSection | null>(
    isChatSettingsSection(initialSettingsSection) ? initialSettingsSection : null,
  );
  const [showMedia, setShowMedia] = useState(false);
  const [mediaRefreshKey, setMediaRefreshKey] = useState(0);
  const prefs = useChatPrefs();
  const activeRef = useRef<string | null>(initialConvId);
  activeRef.current = activeId;

  // ── Bloque F — audiollamadas ─────────────────────────────────────────────
  // Live calls indexed by conversation, so the sidebar row and the thread
  // header read the same source. `session` is the ONE call this user is in.
  const [callsByConv, setCallsByConv] = useState<Record<string, ChatCallView>>({});
  const [session, setSession] = useState<ChatCallSession | null>(null);
  const moduleVisible = useModuleVisibility();
  const visibleRef = useRef(moduleVisible);visibleRef.current=moduleVisible;
  const [incoming, setIncoming] = useState<ChatCallView | null>(null);
  const [callBusy, setCallBusy] = useState(false);
  // Read inside the SSE handler, which is registered once for the tab's life.
  const sessionRef = useRef<ChatCallSession | null>(null);
  sessionRef.current = session;
  const callSupport = useMemo(() => callsSupported(), []);
  const callConvIds = useMemo(() => new Set(Object.keys(callsByConv)), [callsByConv]);
  const activeCall = activeId ? (callsByConv[activeId] ?? null) : null;

  // Bloque B — username → display name, shared by every list/thread.
  const displayNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of directory.users) if (u.displayName) map.set(u.username, u.displayName);
    for (const g of directory.groups) {
      for (const m of normalizeGroupMembers(g.members)) if (m.displayName) map.set(m.username, m.displayName);
    }
    for (const c of conversations) {
      for (const [username, name] of Object.entries(c.memberNames ?? {})) if (name) map.set(username, name);
    }
    return map;
  }, [directory, conversations]);

  const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId]);

  const refreshConversations = useCallback(async () => {
    const list = await messengerApi.listConversations();
    setConversations(list);
    setLoadingConvs(false);
    return list;
  }, []);

  const openConversation = useCallback(async (id: string) => {
    setActiveId(id);
    setActiveConversation(visibleRef.current ? id : null);
    setLoadingMsgs(true);
    const msgs = await messengerApi.listMessages(id, { limit: 100 });
    setMsgByConv((prev) => ({ ...prev, [id]: msgs }));
    setLoadingMsgs(false);
    await messengerApi.markRead(id);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: false } : c)));
  }, []);

  const refreshDirectory = useCallback(async () => {
    const d = await messengerApi.directory();
    setDirectory(d);
    setDirectoryLoading(false);
  }, []);

  // Initial load: conversations + directory + the server-side preferences
  // mirror (the topbar script reads the same localStorage blob).
  useEffect(() => {
    void (async () => {
      await refreshConversations();
      if (initialConvId) void openConversation(initialConvId);
    })();
    void refreshDirectory();
    void chatPrefs.syncFromServer();
    setActiveConversation(initialConvId);
    return () => setActiveConversation(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialTo || initialToConsumed.current || directoryLoading || loadingConvs) return;
    initialToConsumed.current = true;
    const target = directory.users.find((user) => user.username === initialTo);
    if (!target) {
      showToast("El usuario no está disponible para mensajes.", false);
      return;
    }
    void (async () => {
      try {
        const existing = conversations.find((conv) => conv.kind === "dm" && conv.otherUser === target.username);
        const conv = existing ?? await messengerApi.createDm(target.username);
        if (!conv) throw new Error("No se pudo abrir la conversación.");
        if (!existing) await refreshConversations();
        await openConversation(conv.id);
        const url = new URL(window.location.href);
        url.searchParams.delete("to");
        history.replaceState(history.state, "", url.pathname + url.search + url.hash);
      } catch {
        showToast("No se pudo abrir la conversación.", false);
      }
    })();
  }, [initialTo, directoryLoading, loadingConvs, directory.users, conversations, refreshConversations, openConversation]);

  useEffect(() => {
    setActiveConversation(moduleVisible ? activeId : null);
    if (moduleVisible && activeId) void messengerApi.markRead(activeId);
    return () => setActiveConversation(null);
  }, [moduleVisible, activeId]);

  // Directory refresh while the module is visible (presence goes stale fast).
  useEffect(() => {
    if (!moduleVisible) return;
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void refreshDirectory();
    }, DIRECTORY_REFRESH_MS);
    return () => clearInterval(timer);
  }, [refreshDirectory, moduleVisible]);

  // Super-search / notification runtime entry points (ack so the dispatcher
  // does not retry a handled event).
  useEffect(() => {
    const onSettings = (event: Event) => {
      const detail = (event as CustomEvent<{ section?: string }>).detail;
      setSettingsSection(isChatSettingsSection(detail?.section) ? detail!.section as ChatSettingsSection : "general");
      ackEvent(event);
    };
    const onMedia = (event: Event) => {
      if (activeRef.current) setShowMedia(true);
      else showToast(i18nRef.current.media.selectFirst, false);
      ackEvent(event);
    };
    window.addEventListener("luxipanel:chat-settings-open", onSettings as EventListener);
    window.addEventListener("luxipanel:chat-media-open", onMedia as EventListener);
    return () => {
      window.removeEventListener("luxipanel:chat-settings-open", onSettings as EventListener);
      window.removeEventListener("luxipanel:chat-media-open", onMedia as EventListener);
    };
  }, []);

  // SSE stream.
  useEffect(() => {
    let es: EventSource | null = null;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const mergeMessage = (convId: string, msg: ChatMessage) => {
      setMsgByConv((prev) => {
        const cur = prev[convId];
        if (!cur) return prev; // not loaded yet — opening it will fetch fresh
        const idx = cur.findIndex((m) => m.id === msg.id);
        const next = idx >= 0 ? cur.map((m) => (m.id === msg.id ? msg : m)) : [...cur, msg];
        return { ...prev, [convId]: next };
      });
    };

    const onMessage = (raw: MessageEvent) => {
      let payload: SseMessageEvent;
      try {
        payload = JSON.parse(raw.data);
      } catch {
        return;
      }
      const { conversation: conv, message: msg } = payload;
      if (!conv || !msg) return;
      mergeMessage(conv.id, msg);
      // Bloque D: a new attachment in the open conversation invalidates the
      // media drawer's list.
      if (activeRef.current === conv.id && msg.attachments?.length) setMediaRefreshKey((n) => n + 1);

      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === conv.id);
        if (idx < 0) {
          void refreshConversations(); // brand-new conversation
          return prev;
        }
        const existing = prev[idx]!;
        const isActive = visibleRef.current && activeRef.current === conv.id;
        const updated: ConversationView = {
          ...existing,
          lastMessageAt: conv.lastMessageAt ?? existing.lastMessageAt,
          lastMessagePreview: conv.lastMessagePreview ?? existing.lastMessagePreview,
          lastMessageFrom: msg.from,
          unread: msg.from !== me && !isActive ? true : existing.unread && !isActive,
        };
        const rest = prev.filter((_, i) => i !== idx);
        return [updated, ...rest];
      });

      // If the message landed in the open conversation, clear the unread cursor.
      if (visibleRef.current && activeRef.current === conv.id && msg.from !== me) void messengerApi.markRead(conv.id);
    };

    const connect = () => {
      if (closed) return;
      try {
        es = acquireChatStream();
      } catch {
        return;
      }
      es.addEventListener("open", () => {
        retry = 0;
      });
      es.addEventListener("chat:message", onMessage as EventListener);
      es.addEventListener("chat:read", (raw) => {
        try {
          const data = JSON.parse((raw as MessageEvent).data);
          if (data?.username === me && data?.convId) {
            setConversations((prev) => prev.map((c) => (c.id === data.convId ? { ...c, unread: false } : c)));
          }
        } catch {
          /* ignore */
        }
      });
      // Bloque F — one bus event, three SSE names, one reducer.
      const onCallFrame = (raw: Event) => {
        const payload = parseChatCallEvent((raw as MessageEvent).data);
        if (!payload) return;
        const { call, event } = payload;
        setCallsByConv((prev) => {
          if (event === "end" || !isCallLive(call)) {
            if (!(call.convId in prev)) return prev;
            const next = { ...prev };
            delete next[call.convId];
            return next;
          }
          return { ...prev, [call.convId]: call };
        });
        if (event === "end") {
          setIncoming((cur) => (cur?.id === call.id ? null : cur));
          setSession((cur) => (cur?.call.id === call.id ? null : cur));
          return;
        }
        // Only ring for a call somebody ELSE started, and never on top of a
        // call we are already in — the overlay owns the screen at that point.
        if (
          event === "ring" &&
          call.startedBy !== me &&
          !sessionRef.current &&
          call.participants.some((p) => p.id === me && p.state === "ringing")
        ) {
          setIncoming(call);
        }
      };
      es.addEventListener("chat:call:ring", onCallFrame);
      es.addEventListener("chat:call:state", onCallFrame);
      es.addEventListener("chat:call:end", onCallFrame);

      es.addEventListener("error", () => {
        try {
          es?.close();
        } catch {
          /* noop */
        }
        es = null;
        if (closed) return;
        const delay = Math.min(30_000, 1000 * 2 ** retry++);
        timer = setTimeout(connect, delay);
      });
    };
    connect();

    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      try {
        es?.close();
      } catch {
        /* noop */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  // ── Bloque F — acciones de llamada ───────────────────────────────────────

  /**
   * Tell the topbar script that this island owns the call UI, so it does NOT
   * also draw a global banner. Cleared on unmount (an SPA navigation away from
   * /panel/chat must hand the banner back).
   */
  useEffect(() => {
    document.documentElement.dataset.lxpCallUi = "react";
    return () => {
      delete document.documentElement.dataset.lxpCallUi;
    };
  }, []);

  /** Start the call of the open conversation — or join the one running. */
  const handleCall = useCallback(async () => {
    const convId = activeRef.current;
    if (!convId || callBusy) return;
    setCallBusy(true);
    try {
      const { session: started, code } = await callApi.start(convId);
      if (!started) {
        // Un 402/403/401 de Tolqia es ACCIONABLE (pagar, subir de plan, renovar
        // el token): merece su propio texto, no el genérico "no se pudo".
        const planText = tolqiaPlanMessage(i18nRef.current, tolqiaReason(code));
        showToast(planText ?? i18nRef.current.call.startError, false);
        return;
      }
      setSession(started);
      setIncoming(null);
      setCallsByConv((prev) => ({ ...prev, [convId]: started.call }));
    } finally {
      setCallBusy(false);
    }
  }, [callBusy]);

  const handleAccept = useCallback(async (call: ChatCallView) => {
    setIncoming(null);
    setCallBusy(true);
    try {
      const accepted = await callApi.accept(call.id);
      if (!accepted) {
        showToast(i18nRef.current.call.startError, false);
        return;
      }
      setSession(accepted);
      // Bring the thread the call belongs to into view.
      if (activeRef.current !== call.convId) void openConversation(call.convId);
    } finally {
      setCallBusy(false);
    }
  }, [openConversation]);

  const handleReject = useCallback((call: ChatCallView) => {
    setIncoming(null);
    void callApi.reject(call.id);
  }, []);

  /** The local client left (hang up, or the room ended under us). */
  const handleLeave = useCallback(() => {
    setSession(null);
  }, []);

  /**
   * Deep link `?call=<id>` (the topbar banner's "Aceptar"): join straight away.
   * Runs once — the query string is consumed by the navigation itself.
   */
  useEffect(() => {
    if (!initialCallId) return;
    void (async () => {
      const call = await callApi.get(initialCallId);
      if (call && isCallLive(call)) await handleAccept(call);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = useCallback(
    async (body: string, attachments: NewAttachment[]) => {
      if (!activeId) return;
      const msg = await messengerApi.send(activeId, body, attachments);
      if (msg) {
        setMsgByConv((prev) => {
          const cur = prev[activeId] ?? [];
          if (cur.some((m) => m.id === msg.id)) return prev;
          return { ...prev, [activeId]: [...cur, msg] };
        });
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === activeId);
          if (idx < 0) return prev;
          const existing = prev[idx]!;
          const updated: ConversationView = {
            ...existing,
            lastMessageAt: msg.createdAt,
            lastMessagePreview: msg.body || (msg.attachments[0]?.name ?? ""),
            lastMessageFrom: me,
          };
          return [updated, ...prev.filter((_, i) => i !== idx)];
        });
      }
    },
    [activeId, me],
  );

  const handleEdit = useCallback(
    async (id: string, body: string) => {
      if (!activeId) return;
      const updated = await messengerApi.editMessage(activeId, id, body);
      if (updated) {
        setMsgByConv((prev) => ({
          ...prev,
          [activeId]: (prev[activeId] ?? []).map((m) => (m.id === id ? updated : m)),
        }));
      }
    },
    [activeId],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!activeId) return;
      const updated = await messengerApi.deleteMessage(activeId, id);
      if (updated) {
        setMsgByConv((prev) => ({
          ...prev,
          [activeId]: (prev[activeId] ?? []).map((m) => (m.id === id ? updated : m)),
        }));
      }
    },
    [activeId],
  );

  const handleCreate = useCallback(
    async (payload: Parameters<typeof messengerApi.create>[0]) => {
      const conv = await messengerApi.create(payload);
      setShowNew(false);
      if (conv) {
        // The create endpoint returns the raw conversation (no resolved
        // displayTitle/presence) — refetch the list so the row + header show
        // proper initials/title instead of a "?" placeholder.
        await refreshConversations();
        void openConversation(conv.id);
      }
    },
    [refreshConversations, openConversation],
  );

  /** Bloque C — open (or create) the Linux group conversation. */
  const handleOpenGroup = useCallback(
    async (group: string) => {
      const conv = await messengerApi.openLinuxGroup(group);
      if (!conv) return;
      await refreshConversations();
      void openConversation(conv.id);
    },
    [refreshConversations, openConversation],
  );

  /** Bloque C — click on a group member: reuse the DM or create it. */
  const handleOpenMember = useCallback(
    async (member: DirectoryUser) => {
      const existing = conversations.find((c) => c.kind === "dm" && c.otherUser === member.username);
      if (existing) {
        void openConversation(existing.id);
        return;
      }
      const conv = await messengerApi.createDm(member.username);
      if (!conv) return;
      await refreshConversations();
      void openConversation(conv.id);
    },
    [conversations, refreshConversations, openConversation],
  );

  return (
    <ChatI18nProvider value={i18n}>
      {/* Bloque E — apariencia: las utilidades `[[data-density=…]_&]` y
          `[[data-fontsize=…]_&]` de los hijos cuelgan de estos atributos. */}
      <div
        className="flex h-full min-h-0 min-w-0 w-full [[data-fontsize=lg]_&]:text-base [[data-fontsize=sm]_&]:text-[13px]"
        data-density={prefs.appearance.density}
        data-fontsize={prefs.appearance.fontSize}
      >
        <div className={`h-full min-w-0 w-full lg:w-auto ${activeId ? "hidden lg:flex" : "flex"} lg:shrink-0`}>
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            me={me}
            locale={locale}
            loading={loadingConvs}
            directory={directory}
            directoryLoading={directoryLoading}
            displayNames={displayNames}
            latestPageSize={prefs.groups.latestPageSize}
            groupsCollapsedByDefault={prefs.groups.collapsedByDefault}
            callConvIds={callConvIds}
            onSelect={(id) => void openConversation(id)}
            onNew={() => setShowNew(true)}
            onOpenSettings={() => setSettingsSection("general")}
            onOpenGroup={(g) => void handleOpenGroup(g)}
            onOpenMember={(m) => void handleOpenMember(m)}
          />
        </div>
        <div ref={threadViewRef} className={`h-full min-h-0 min-w-0 flex-1 ${activeId ? "flex" : "hidden lg:flex"}`}>
          {active ? (
            <MessageThread
              conversation={active}
              messages={msgByConv[active.id] ?? []}
              me={me}
              locale={locale}
              loading={loadingMsgs && !(msgByConv[active.id]?.length)}
              directory={displayNames}
              enterSends={prefs.general.enterSends}
              onSend={handleSend}
              onEdit={(id, body) => void handleEdit(id, body)}
              onDelete={(id) => void handleDelete(id)}
              onBack={() => {
                setActiveId(null);
                setActiveConversation(null);
              }}
              onOpenMedia={() => setShowMedia(true)}
              onCall={() => void handleCall()}
              activeCall={activeCall}
              callEnabled={callSupport.ok}
              callBusy={callBusy}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
              <i className="ti ti-messages text-5xl opacity-40" />
              <p className="text-sm">{i18n.selectConversation}</p>
              <button
                type="button"
                onClick={() => setShowNew(true)}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <i className="ti ti-pencil-plus" /> {i18n.newConversation}
              </button>
            </div>
          )}
        </div>
      </div>
      {showNew && (
        <NewChatDialog
          onClose={() => setShowNew(false)}
          onCreate={handleCreate}
          directory={directoryLoading ? undefined : directory}
        />
      )}
      {settingsSection && (
        <ChatSettingsDrawer
          section={settingsSection}
          onSectionChange={setSettingsSection}
          onClose={() => setSettingsSection(null)}
          isAdmin={isAdmin}
        />
      )}
      {/* Bloque F — banner de llamada entrante + overlay/píldora del SDK. */}
      {createPortal(<div data-call-service className="pointer-events-none fixed inset-0 z-[10020] [&>*]:pointer-events-auto"><ChatCallHost
        session={session}
        incoming={incoming}
        displayNames={displayNames}
        onAccept={(call) => void handleAccept(call)}
        onReject={handleReject}
        onLeave={handleLeave}
      /></div>, document.body)}
      {showMedia && active && (
        <ConversationMediaDrawer
          conversation={active}
          locale={locale}
          directory={displayNames}
          refreshKey={mediaRefreshKey}
          onClose={() => setShowMedia(false)}
        />
      )}
    </ChatI18nProvider>
  );
}
