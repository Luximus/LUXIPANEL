import { historySearchLabel, type HistorySearchStatus } from "../../../lib/history-search-status";
import { invalidateServerReads } from "../../../api/serverApi";
import { useNativeModuleVisible } from "../module-visibility";
/**
 * AssistantModule (desktop) — ASISTENTE IA nativo del servidor STANDALONE (modo
 * DIRECTO).
 *
 * Reemplaza el STUB. Reutiliza la UI del asistente nativo de desktop
 * (`components/serverAssistant/*`: burbujas, markdown, tools expandibles, sidebar
 * de conversaciones/proyectos, streamReducer) pero enruta DIRECTO al box por
 * `serverApi`/DirectTarget (`api/assistantDirect`), NO por el túnel managed
 * `luxAssistantProxy` que usa `ServerAssistantPane`.
 *
 * ENFOQUE — variante directa (opción "b" del brief), NO parametrizar el pane:
 * `ServerAssistantPane` está muy acoplado al modelo managed (disponibilidad
 * gateada por métricas SSH, aprobación de huella/`approvePanelFingerprint`,
 * `getServerMetrics`, saldo MB `noData`, y la vista `ServerAssistantProviders`
 * que a su vez proxea por `panelId,token`). Nada de eso aplica en directo
 * (sin túnel SSH, sin TOFU, sin MB). Inyectarle un transporte y anular esa
 * lógica condicionalmente sería muy invasivo y arriesgaría el uso managed. Como
 * en el repo app↔desktop ya se duplica por plataforma, una variante directa que
 * reusa los SUBCOMPONENTES hoja (transporte-agnósticos) es lo más limpio.
 *
 * Streaming directo: `streamDirectAssistant` (fetch + ReadableStream contra
 * `POST /api/ai/agent`); el run se arranca con `conversationId` (DESACOPLADO,
 * persiste en el box) y, si el stream no fluye, la respuesta se recupera por
 * sondeo de `/conversations/:id/messages` (mismo patrón que el chat nativo de
 * app: `recoverInterruptedTurn`).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPagedList } from "../../../lib/paged-list";
import { Bot, Loader2, MessageSquare, Plus, Sparkles } from "lucide-react";
import {
  directAi,
  startDirectRunViaBridge,
  stopDirectRun,
  streamDirectAssistant,
  type DirectAttachment,
} from "../../../api/assistantDirect";
import { ProviderIcon, PROVIDER_META } from "../../../components/ProviderIcon";
import { type MarkdownLabels } from "../../../components/ServerAssistantMarkdown";
import { strings } from "../../../components/serverAssistant/strings";
import { ConversationSidebar } from "../../../components/serverAssistant/ConversationSidebar";
import { Composer } from "../../../components/serverAssistant/Composer";
import { MessageList } from "../../../components/serverAssistant/MessageList";
import { reduceAssistantEvent } from "../../../components/serverAssistant/streamReducer";
import type { ChatMsg, Conversation, Project, TokenUsage } from "../../../components/serverAssistant/types";
import type { ModuleProps } from "../module-host";
import { getMessages } from "../../../i18n";
import { AgentsModule } from "./agents/AgentsModule";
import { agentsApi, rolesApi, type AssistantAgent, type AgentRole } from "./agents/api";

// Persistencia por servidor: el chat sobrevive a cambiar de módulo/pestaña
// mientras la app viva (clave = serverId). Espejo del CHAT_STORE del pane.
const CHAT_STORE = new Map<string, { messages: ChatMsg[]; provider: string; conversationId: string | null }>();

type Attachment = { name: string; dataBase64: string; mime: string };

/** Config redactada del box (`GET /api/ai/config`): solo lo que necesita el chat. */
type RedactedConfig = {
  activeProvider?: string;
  defaultChatProvider?: string;
  providers?: Record<string, { active?: boolean }>;
};

/** Mensaje persistido del box (`/conversations/:id/messages`). */
type StoredMsg = {
  role?: string; content?: string; text?: string; ts?: string;
  tokens?: TokenUsage; durationMs?: number; cli?: boolean;
  textOriginal?: string; textTranslated?: string;
  attachments?: Array<{ name?: string }>;
};

function mapStored(raw: StoredMsg[]): ChatMsg[] {
  return (Array.isArray(raw) ? raw : [])
    .map((m): ChatMsg => {
      const isUser = m.role === "user";
      // Variantes de traducción en background (criterio LUXIPANEL `displayText`):
      // usuario → texto original; asistente → traducido.
      const content = String((isUser ? m.textOriginal : m.textTranslated) ?? m.content ?? m.text ?? "");
      const ts = m.ts ? Date.parse(m.ts) : NaN;
      return {
        role: isUser ? "user" : "assistant",
        content,
        at: Number.isNaN(ts) ? undefined : ts,
        tokens: m.tokens,
        durationMs: m.durationMs,
        cli: m.cli,
        attachmentName: m.attachments?.[0]?.name,
      };
    })
    .filter((m) => m.content);
}

export function AssistantModule({ serverId, moduleLabel, language }: ModuleProps) {
  const visible = useNativeModuleVisible();
  const t = strings(language);
  const standaloneT = getMessages(language).serverStandalone;
  const [moduleTab, setModuleTab] = useState<"chat" | "agents">("chat");
  const mdLabels: MarkdownLabels = { copy: t.copy, copied: t.copied };
  const restored = CHAT_STORE.get(serverId);

  const [messages, setMessages] = useState<ChatMsg[]>(restored?.messages ?? []);
  const [provider, setProvider] = useState<string>(restored?.provider ?? "");
  const [providers, setProviders] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(restored?.conversationId ?? null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [historySearchStatus, setHistorySearchStatus] = useState<HistorySearchStatus | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [consumed, setConsumed] = useState<Set<string>>(new Set());
  const [stick, setStick] = useState(true);
  // Árbol "Agentes IA" de la sidebar: agentes + roles del box y el agente activo.
  const [agents, setAgents] = useState<AssistantAgent[]>([]);
  const [roles, setRoles] = useState<AgentRole[]>([]);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);

  const providersLoadedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const recoveringRef = useRef(false);
  /** Cerrojo síncrono anti doble-envío: `busy` (estado) se actualiza async. */
  const sendingRef = useRef(false);
  const streamSeqRef = useRef(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const stickRef = useRef(true);

  // Persiste estado por servidor en cada cambio relevante.
  useEffect(() => {
    CHAT_STORE.set(serverId, { messages, provider, conversationId });
  }, [serverId, messages, provider, conversationId]);

  // ── Proveedores (chips) — derivados de `GET /api/ai/config` ────────────────
  useEffect(() => {
    if (!visible || providersLoadedRef.current) return;
    providersLoadedRef.current = true;
    let cancelled = false;
    void directAi<{ config?: RedactedConfig }>(serverId, "GET", "/api/ai/config").then((res) => {
      if (cancelled) return;
      const cfg = res?.config;
      if (!cfg) { providersLoadedRef.current = false; return; }
      const active = Object.entries(cfg.providers ?? {})
        .filter(([, p]) => p?.active)
        .map(([id]) => id);
      const list = active.length > 0 ? active : (cfg.activeProvider ? [cfg.activeProvider] : []);
      setProviders(list);
      setProvider((p) => p || cfg.defaultChatProvider || cfg.activeProvider || list[0] || "");
    });
    return () => { cancelled = true; };
  }, [serverId, visible]);

  // ── Agentes + roles para el árbol "Agentes IA" de la sidebar ───────────────
  // Best-effort: si el box no los expone (404/red), el árbol muestra su estado
  // vacío sin romper el chat.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void agentsApi.list(serverId).then((list) => { if (!cancelled) setAgents(Array.isArray(list) ? list : []); }).catch(() => undefined);
    void rolesApi.list(serverId).then((list) => { if (!cancelled) setRoles(Array.isArray(list) ? list : []); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [serverId, visible]);

  const activeAgent = activeAgentId ? agents.find((a) => a.id === activeAgentId) ?? null : null;
  // Si el agente activo dejó de existir (borrado en la pestaña Agentes IA), límpialo.
  useEffect(() => {
    if (activeAgentId && agents.length > 0 && !agents.some((a) => a.id === activeAgentId)) {
      setActiveAgentId(null);
    }
  }, [agents, activeAgentId]);

  // ── Sidebar: conversaciones (búsqueda server-side ?q=) + proyectos ─────────
  const historyScope = `${serverId}:${query}`;
  const historyScopeRef = useRef(historyScope); historyScopeRef.current = historyScope;
  const projectsRef = useRef(projectList); projectsRef.current = projectList;
  const agentsRef = useRef(agents); agentsRef.current = agents;
  const history = useMemo(() => {
    const pages = new Map<string, ReturnType<typeof createPagedList<Conversation>>>();
    let current = "root";
    const get = (key: string) => {
      let pager = pages.get(key);
      if (pager) return pager;
      pager = createPagedList<Conversation>(async ({ limit, offset, cursor }) => {
        let filter = "";
        if (key !== "root") {
          const colon = key.indexOf(":"), kind = key.slice(0, colon), id = key.slice(colon + 1);
          const ids = new Set([id]); let changed = true;
          while (changed) {
            changed = false;
            const rows = kind === "project" ? projectsRef.current : agentsRef.current;
            for (const row of rows) {
              const parent = "parentId" in row ? row.parentId : "parentAgentId" in row ? row.parentAgentId : null;
              if (parent && ids.has(parent) && !ids.has(row.id)) { ids.add(row.id); changed = true; }
            }
          }
          filter = kind === "project" ? `&projectIds=${encodeURIComponent(id === "__loose__" ? "none" : [...ids].join(","))}&withAgent=0`
            : `&agentIds=${encodeURIComponent([...ids].join(","))}&withAgent=1`;
        }
        const page = await directAi<{ items: Conversation[]; total: number; hasMore?: boolean; nextCursor?: string | null; searchStatus?: HistorySearchStatus }>(serverId, "GET",
          `/api/ai/conversations?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&paged=1${filter}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
        if (!page || !Array.isArray(page.items)) throw new Error(t.error);
        if (historyScopeRef.current === historyScope && key === "root") setHistorySearchStatus(page.searchStatus ?? null);
        return page;
      }, state => {
        if (historyScopeRef.current !== historyScope) return;
        const rows = new Map<string, Conversation>();
        for (const value of pages.values()) for (const row of value.get().items) rows.set(row.id, row);
        for (const row of state.items) rows.set(row.id, row);
        setConversations([...rows.values()]); setHistoryBusy(state.loading); if (state.error) setNotice(t.error);
      });
      pages.set(key, pager); return pager;
    };
    return {
      first: (fresh = false) => { if (fresh) invalidateServerReads(); setHistorySearchStatus(null); for (const page of pages.values()) page.cancel(); pages.clear(); current = "root"; return get(current).first(); },
      next: () => get(current).next(),
      group: (kind: "project" | "agent", id: string) => {
        current = `${kind}:${id}`; const exists = pages.has(current), page = get(current);
        if (!exists) void page.first();
      },
      cancel: () => { for (const page of pages.values()) page.cancel(); },
    };
  }, [serverId, query]);
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => void history.first(), query ? 350 : 0);
    return () => { clearTimeout(timer); history.cancel(); };
  }, [history, visible]);
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    void directAi<{ projects?: Project[]; items?: Project[] } | Project[]>(serverId, "GET", "/api/ai/projects").then(res => {
      if (alive) setProjectList(Array.isArray(res) ? res : res?.projects ?? res?.items ?? []);
    });
    return () => { alive = false; };
  }, [serverId, visible]);

  const openConversation = (id: string) => {
    abortRef.current?.abort();
    streamSeqRef.current += 1;
    setConversationId(id);
    setNotice(null);
    setMessages([{ role: "assistant", content: "", pending: true, tools: [] }]);
    void directAi<{ items?: StoredMsg[]; messages?: StoredMsg[] } | StoredMsg[]>(
      serverId, "GET", `/api/ai/conversations/${encodeURIComponent(id)}/messages?limit=50&offset=0`,
    ).then((res) => {
      const raw = Array.isArray(res) ? res : (res?.items ?? res?.messages ?? []);
      setMessages(mapStored(Array.isArray(raw) ? raw : []));
      scrollToEnd(true);
    });
  };

  const deleteConversation = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    void directAi(serverId, "DELETE", `/api/ai/conversations/${encodeURIComponent(id)}`);
    if (id === conversationId) newConversation();
  };

  const newConversation = () => {
    abortRef.current?.abort();
    streamSeqRef.current += 1;
    setConversationId(null);
    setMessages([]);
    setNotice(null);
  };

  // ── Acciones de los árboles del sidebar (paridad con la web) ────────────────
  /** Header/"+" de un agente: lo activa (sale de proyecto) y abre chat nuevo. */
  const newAgentChat = (agentId: string) => {
    setActiveAgentId(agentId);
    setProjectId("");
    newConversation();
  };
  /** "+" de una carpeta de proyecto: chat nuevo en ese proyecto (sin agente). */
  const newProjectChat = (pid: string) => {
    setActiveAgentId(null);
    setProjectId(pid);
    newConversation();
  };
  /** "+" de "Chats sueltos" / botón nuevo: chat sin agente ni proyecto. */
  const newLooseChat = () => {
    setActiveAgentId(null);
    setProjectId("");
    newConversation();
  };

  /** Id de la conversación con un run en vivo (punto pulsante del árbol). */
  const liveConversationId = busy ? conversationId : null;

  // ── Auto-scroll respetando al usuario ──────────────────────────────────────
  const scrollToEnd = (force = false) => {
    if (!force && !stickRef.current) return;
    requestAnimationFrame(() => {
      const node = listRef.current;
      if (node) node.scrollTop = node.scrollHeight;
    });
  };

  const onListScroll = () => {
    const node = listRef.current;
    if (!node) return;
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
    stickRef.current = nearBottom;
    setStick(nearBottom);
  };

  const pickFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.slice(result.indexOf(",") + 1) : result;
      setAttachment({ name: file.name, dataBase64: base64, mime: file.type || "application/octet-stream" });
    };
    reader.readAsDataURL(file);
  };

  const autosize = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const stopStream = () => {
    abortRef.current?.abort();
    if (conversationId) stopDirectRun(serverId, conversationId);
  };

  /**
   * Recupera un turno cuyo STREAM no fluyó (CORS del renderer empaquetado / corte
   * de red) pero cuyo run es DESACOPLADO y sigue vivo en el box: sondea el hilo
   * (3s × 20) hasta que la respuesta quede persistida y la pinta. Un solo sondeo
   * a la vez (`recoveringRef`). Paridad con el chat nativo de app.
   */
  const recoverInterruptedTurn = async (convId: string, seq: number) => {
    if (recoveringRef.current) return;
    recoveringRef.current = true;
    try {
      for (let attempt = 0; attempt < 20; attempt++) {
        await new Promise((res) => setTimeout(res, 3000));
        if (seq !== streamSeqRef.current) return; // el usuario cambió de hilo / envió otro
        const res = await directAi<{ items?: StoredMsg[]; messages?: StoredMsg[] } | StoredMsg[]>(
          serverId, "GET", `/api/ai/conversations/${encodeURIComponent(convId)}/messages?limit=50&offset=0`,
        );
        const raw = Array.isArray(res) ? res : (res?.items ?? res?.messages ?? []);
        const mapped = mapStored(Array.isArray(raw) ? raw : []);
        const last = mapped[mapped.length - 1];
        if (last && last.role === "assistant" && last.content) {
          setMessages(mapped);
          scrollToEnd(true);
          return;
        }
      }
      // Agotado (~60s): estado terminal + aviso para no dejar el turno colgado.
      if (seq === streamSeqRef.current) setNotice(t.error);
    } finally {
      recoveringRef.current = false;
    }
  };

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if ((!text && !attachment) || busy || sendingRef.current) return;
    sendingRef.current = true;
    const seq = ++streamSeqRef.current;
    setInput("");
    requestAnimationFrame(autosize);
    setNotice(null);
    const att = attachment;
    setAttachment(null);
    const attachments: DirectAttachment[] | undefined = att
      ? [{ name: att.name, mimeType: att.mime, dataBase64: att.dataBase64 }]
      : undefined;
    const history = [
      ...messages.filter((m) => !m.pending).map(({ role, content }) => ({ role, content })),
      { role: "user" as const, content: text || (att ? att.name : "") },
    ];
    const startedAt = Date.now();
    setMessages((prev) => [
      ...prev.filter((m) => !m.pending),
      { role: "user", content: text, attachmentName: att?.name, at: startedAt },
      { role: "assistant", content: "", pending: true, tools: [] },
    ]);
    setBusy(true);
    stickRef.current = true;
    setStick(true);
    scrollToEnd(true);

    // Chat NUEVO: crea la conversación ANTES de streamear para que el run entre al
    // camino DESACOPLADO (persiste en el box y aparece en la lista) — sin ella el
    // box usa el path efímero legacy. Best-effort: si falla, se streamea suelto.
    let convId = conversationId;
    if (!convId) {
      const created = await directAi<{ conversation?: { id?: string } }>(serverId, "POST", "/api/ai/conversations", {
        provider: provider || "claude",
        firstMessage: (text || (att?.name ?? "")).slice(0, 2000) || undefined,
        ...(activeAgentId ? { agentId: activeAgentId } : {}),
        ...(projectId ? { projectId } : {}),
      });
      // El usuario cambió de hilo / envió otro durante el await → no reclames.
      if (seq !== streamSeqRef.current) { sendingRef.current = false; return; }
      const newId = created?.conversation?.id;
      if (newId) { convId = newId; setConversationId(newId); }
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const result = await streamDirectAssistant(
      serverId,
      history,
      (ev) => {
        if (seq !== streamSeqRef.current) return; // deltas de un run que ya no es el activo
        setMessages((prev) => reduceAssistantEvent(prev, ev));
        scrollToEnd();
      },
      ctrl.signal,
      { provider: provider || undefined, attachments, conversationId: convId ?? undefined, agentId: activeAgentId, projectId: projectId || null },
    );

    abortRef.current = null;
    sendingRef.current = false;
    setBusy(false);
    const stale = seq !== streamSeqRef.current;
    if (stale) return; // el hilo activo ya no es este: no toques sus mensajes
    const durationMs = Date.now() - startedAt;
    setMessages((prev) => prev.map((m) => (m.pending ? { ...m, pending: false, at: Date.now(), durationMs } : m)));

    if (!result.ok) {
      if (result.code === "ERROR" && convId) {
        // El run es DESACOPLADO: puede seguir vivo y persistiendo en el box aunque
        // el stream no fluyera. Si el `fetch` ni siquiera conectó (0 eventos —
        // típico del empaquetado Electron con CORS restrictivo), arranca el run por
        // el bridge (sin CORS) y, en ambos casos, recupera la respuesta por sondeo.
        if (result.events === 0) {
          startDirectRunViaBridge(serverId, history, {
            provider: provider || undefined, attachments, conversationId: convId, agentId: activeAgentId, projectId: projectId || null,
          });
        }
        setMessages((prev) => prev.map((m, i) => (
          i === prev.length - 1 && m.role === "assistant" && !m.content && !(m.tools?.length)
            ? { ...m, pending: true }
            : m
        )));
        void recoverInterruptedTurn(convId, seq);
        return;
      }
      setNotice(result.code === "UNAVAILABLE" ? t.unavailable : t.error);
      setMessages((prev) => prev.filter((m, i) => !(i === prev.length - 1 && m.role === "assistant" && !m.content && !(m.tools?.length))));
    }
    scrollToEnd();
  };

  const responding = busy;

  if (moduleTab === "agents") {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex items-center gap-1 border-b border-base-300 bg-base-100 px-3 py-2" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={false}
            className="btn btn-ghost btn-sm"
            onClick={() => setModuleTab("chat")}
          >
            <MessageSquare size={14} /> {t.title}
          </button>
          <button type="button" role="tab" aria-selected className="btn btn-primary btn-sm">
            <Bot size={14} /> {standaloneT.agentsTab}
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <AgentsModule panelId={serverId} language={language} />
        </div>
      </div>
    );
  }

  return (
    <div className="server-assistant server-assistant--module h-full min-h-0" data-per={1}>
      <div className="server-assistant__head">
        <Sparkles size={14} />
        <span className="server-assistant__title">{moduleLabel || t.title}</span>
        <button
          type="button"
          className="server-assistant__chip-btn"
          onClick={() => setModuleTab("agents")}
        >
          <Bot size={13} /> {standaloneT.agentsTab}
        </button>
        {responding ? (
          <span className="server-assistant__responding">
            <Loader2 size={11} className="animate-spin" /> {t.responding}
          </span>
        ) : null}
        {/* Chips de proveedor: activo = fondo card + sombra. */}
        {providers.length > 0 ? (
          <div className="server-assistant__chips" role="tablist" aria-label={t.provider}>
            {providers.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={p === provider}
                className={`server-assistant__chip-btn ${p === provider ? "is-active" : ""}`}
                onClick={() => setProvider(p)}
                title={PROVIDER_META[p]?.label ?? p}
              >
                <ProviderIcon id={p} style={{ fontSize: "0.8rem" }} />
                <span>{PROVIDER_META[p]?.label ?? p}</span>
              </button>
            ))}
          </div>
        ) : <span className="server-assistant__head-spacer" aria-hidden />}
        <button
          type="button"
          className="lp-icon-btn server-assistant__hbtn tooltip tooltip-bottom"
          onClick={newConversation}
          aria-label={t.newChat}
          data-tip={t.newChat}
        >
          <Plus size={15} />
        </button>
      </div>

      {query.trim() && historySearchStatus?.state === "indexing" && <div role="status" className="server-assistant__notice">
        {historySearchLabel(language ?? "en", historySearchStatus)} <button type="button" onClick={() => void history.first(true)}>{getMessages(language).common.refresh}</button>
      </div>}
      <div className="server-assistant__body">
        <ConversationSidebar
          onHistoryGroup={history.group}
          onScrollCapture={(event) => {
            const el = event.target as HTMLElement;
            if (el.scrollTop > 0 && el.scrollHeight - el.clientHeight - el.scrollTop < 48) void history.next();
          }}
          t={t}
          st={standaloneT}
          language={language}
          conversations={conversations}
          projects={projectList}
          agents={agents}
          roles={roles}
          activeConversationId={conversationId}
          liveConversationId={liveConversationId}
          busy={busy}
          historyBusy={historyBusy}
          query={query}
          onQueryChange={setQuery}
          onOpen={openConversation}
          onDelete={deleteConversation}
          onNew={newLooseChat}
          onNewInProject={newProjectChat}
          onPickAgent={newAgentChat}
        />
        <div className="server-assistant__main">
          <MessageList
            t={t}
            language={language}
            listRef={listRef}
            onListScroll={onListScroll}
            blocked={false}
            noData={false}
            isFingerprint={false}
            unavailableReason={null}
            notice={notice}
            approvingFp={false}
            refreshingStatus={false}
            onApproveFingerprint={() => {}}
            onRefreshStatus={() => {}}
            token=""
            messages={messages}
            provider={provider}
            emptyHint={t.examples}
            st={standaloneT}
            quickReplies={t.examples.slice(0, 6)}
            providerLabel={provider ? (PROVIDER_META[provider]?.label ?? provider) : (activeAgent?.name ?? moduleLabel ?? t.title)}
            hasActiveAgent={!!activeAgentId}
            onPickQuickReply={(text) => { if (!busy) void send(text); }}
            onFocusComposer={() => taRef.current?.focus()}
            mdLabels={mdLabels}
            consumed={consumed}
            onConsume={(k) => setConsumed((prev) => new Set(prev).add(k))}
            onActionResult={(text) => setMessages((prev) => [...prev, { role: "assistant", content: text, at: Date.now() }])}
            stick={stick}
            onJumpLatest={() => scrollToEnd(true)}
          />
          <Composer
            t={t}
            busy={busy}
            token="direct"
            blocked={false}
            input={input}
            attachment={attachment}
            unavailableReason={null}
            fileRef={fileRef}
            taRef={taRef}
            onSubmit={() => void send()}
            onInputChange={(v) => { setInput(v); autosize(); }}
            onPickFile={pickFile}
            onRemoveAttachment={() => setAttachment(null)}
            onStop={stopStream}
            onFocus={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
