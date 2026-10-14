import { createPagedList } from "../lib/paged-list";
import { historySearchLabel, type HistorySearchStatus } from "../lib/history-search-status";
import { invalidateAssistantReads } from "../api/client/assistant";
import { useNativeModuleVisible } from "../screens/server/module-visibility";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Settings, Terminal as TerminalIcon } from "lucide-react";
import { approvePanelFingerprint, getServerAssistantProviders, getServerMetrics, luxAssistantProxy, streamServerAssistant, type AssistantEvent } from "../api/client";
import { ProviderIcon, PROVIDER_META } from "./ProviderIcon";
import { type MarkdownLabels } from "./ServerAssistantMarkdown";
import ServerAssistantProviders, { type AssistantConfig } from "./ServerAssistantProviders";
import type { ServerMetricsState } from "../features/app/viewModels";
import { strings } from "./serverAssistant/strings";
import { getMessages } from "../i18n";
import { ConversationSidebarLegacy } from "./serverAssistant/ConversationSidebarLegacy";
import { Composer } from "./serverAssistant/Composer";
import { MessageList } from "./serverAssistant/MessageList";
import { reduceAssistantEvent } from "./serverAssistant/streamReducer";
import type { ChatMsg, Conversation, Project, TokenUsage } from "./serverAssistant/types";

// Persistencia por panel: el chat sobrevive a cambiar de slide/pestaña mientras
// la app viva (clave = panelId). Cumple "si cambia de panel, persiste el chat".
const CHAT_STORE = new Map<string, { messages: ChatMsg[]; provider: string; conversationId: string | null }>();

/**
 * Asistente IA embebido en la window del panel — réplica reducida (solo chat y
 * proveedores) del módulo Asistente IA de LUXIPANEL (`floating-assistant/`):
 * chips de proveedor, turnos con avatar de marca + meta (hora · duración ·
 * tokens), markdown con code blocks, tools expandibles, historial con búsqueda
 * server-side y vista de configuración de proveedores. Habla con
 * /portal/ssh/assistant (túnel SSH) y /api/ai/* vía proxy.
 */
export default function ServerAssistantPane({
  panelId,
  token,
  language,
  serverUser,
  providers,
  activeProvider,
  metricsState,
  onMetricsRefresh,
  noData,
  panelName,
  logoUrl,
  perSlide = 1,
}: {
  panelId: string;
  token: string;
  language?: string;
  /** Nombre del panel/servidor: se muestra como título del asistente (antes era
   *  una tarjeta "Panel" en la barra del window). */
  panelName?: string;
  /** Logo de marca del panel (si lo hay): icono del título del asistente. */
  logoUrl?: string;
  /** Usuario Linux del servidor (con el que se hace SSH) para el nombre del turno. */
  serverUser?: string;
  /** Proveedores habilitados en el módulo del servidor (si se conocen). */
  providers?: string[];
  activeProvider?: string;
  /** Estado de métricas del panel: si el SSH no conecta, el asistente tampoco
   *  y se bloquea el input mostrando la razón. */
  metricsState?: ServerMetricsState;
  /** Fuerza al contenedor a refrescar las métricas del panel (CPU/RAM/Disco). */
  onMetricsRefresh?: (panelId: string) => Promise<void> | void;
  /** Cuenta sin datos (saldo MB <= 0): el asistente usa el túnel SSH, así que se
   *  bloquea igual que las conexiones (con su propio motivo). */
  noData?: boolean;
  /** Paneles por slide del carousel (1·2·3): ajusta el ancho del sidebar. */
  perSlide?: number;
}) {
  const visible = useNativeModuleVisible();
  const t = strings(language);
  const st = getMessages(language).serverStandalone;
  const mdLabels: MarkdownLabels = { copy: t.copy, copied: t.copied };
  const restored = CHAT_STORE.get(panelId);
  const [messages, setMessages] = useState<ChatMsg[]>(restored?.messages ?? []);
  const [provider, setProvider] = useState<string>(restored?.provider ?? activeProvider ?? providers?.[0] ?? "");
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<{ name: string; dataBase64: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fetchedProviders, setFetchedProviders] = useState<string[]>(providers ?? []);
  const [conversationId, setConversationId] = useState<string | null>(restored?.conversationId ?? null);
  const [logoBroken, setLogoBroken] = useState(false);
  const [view, setView] = useState<"chat" | "providers">("chat");
  const [collapsed, setCollapsed] = useState(false);
  // Solo se usa el setter (cierra el drawer); el valor no se lee.
  const [, setDrawerOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState<HistorySearchStatus | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [approvingFp, setApprovingFp] = useState(false);
  const [fpApproved, setFpApproved] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [metricsOverride, setMetricsOverride] = useState<ServerMetricsState | null>(null);
  const [stick, setStick] = useState(true);
  const [consumed, setConsumed] = useState<Set<string>>(new Set());
  const providersLoadedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  /** Cerrojo síncrono anti doble-envío: `busy` (estado) se actualiza async y dos
   *  Enter/clics seguidos colarían dos consultas antes del re-render. */
  const sendingRef = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const stickRef = useRef(true);

  const historyScope = JSON.stringify([panelId, token, query, projectId]);
  const historyScopeRef = useRef(historyScope); historyScopeRef.current = historyScope;
  const history = useMemo(() => createPagedList<Conversation>(async ({ limit, offset, cursor }) => {
    const page = await luxAssistantProxy<{ items: Conversation[]; total: number; nextCursor?: string | null; hasMore?: boolean; searchStatus?: HistorySearchStatus }>(panelId, token, "GET",
      `/api/ai/conversations?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&paged=1&projectId=${encodeURIComponent(projectId || "none")}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    if (!page || !Array.isArray(page.items)) throw new Error(t.error);
    if (historyScopeRef.current === historyScope) setSearchStatus(page.searchStatus ?? null);
    return page;
  }, state => {
    if (historyScopeRef.current !== historyScope) return;
    setConversations(state.items); setHistoryBusy(state.loading); if (state.error) setNotice(t.error);
  }), [historyScope]);
  useEffect(() => {
    if (!visible || !token) return;
    setSearchStatus(null);
    const timer = setTimeout(() => void history.first(), query.trim() ? 350 : 0);
    return () => { clearTimeout(timer); history.cancel(); };
  }, [history, visible, token]);
  useEffect(() => {
    if (!visible || !token) return;
    let current = true;
    void luxAssistantProxy<{ projects?: Project[] } | Project[]>(panelId, token, "GET", "/api/ai/projects").then(result => {
      if (!current || !result) return;
      setProjects(Array.isArray(result) ? result : result.projects ?? []);
    });
    return () => { current = false; };
  }, [panelId, token, visible]);

  const openConversation = (id: string) => {
    if (!token) return;
    setConversationId(id);
    setDrawerOpen(false);
    setView("chat");
    setMessages([{ role: "assistant", content: "", pending: true, tools: [] }]);
    type StoredMsg = {
      role?: string; content?: string; text?: string; ts?: string;
      tokens?: TokenUsage; durationMs?: number; cli?: boolean;
      textOriginal?: string; textTranslated?: string;
      attachments?: Array<{ name?: string }>;
    };
    void luxAssistantProxy<{ items?: StoredMsg[]; messages?: StoredMsg[] } | StoredMsg[]>(
      panelId, token, "GET", `/api/ai/conversations/${encodeURIComponent(id)}/messages?limit=50&offset=0`,
    ).then((res) => {
      const raw = Array.isArray(res) ? res : (res?.items ?? res?.messages ?? []);
      const mapped: ChatMsg[] = (Array.isArray(raw) ? raw : [])
        .map((m): ChatMsg => {
          const isUser = m.role === "user";
          // Variantes de traducción en background (mismo criterio que LUXIPANEL
          // `displayText`): usuario → texto original; asistente → traducido.
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
      setMessages(mapped);
      scrollToEnd(true);
    });
  };

  const deleteConversation = (id: string) => {
    if (!token) return;
    setConversations((prev) => prev.filter((c) => c.id !== id));
    void luxAssistantProxy(panelId, token, "DELETE", `/api/ai/conversations/${encodeURIComponent(id)}`);
    if (id === conversationId) newConversation();
  };

  const newConversation = () => {
    abortRef.current?.abort();
    setConversationId(null);
    setMessages([]);
    setNotice(null);
    setDrawerOpen(false);
    setView("chat");
  };

  // Carga perezosa de proveedores (al enfocar): evita N handshakes SSH al cargar
  // el dashboard. Solo si no llegaron por props.
  const loadProviders = () => {
    if (providersLoadedRef.current || !token || (providers && providers.length)) return;
    providersLoadedRef.current = true;
    void getServerAssistantProviders(panelId, token).then((r) => {
      if (!r) return;
      setFetchedProviders(r.providers);
      setProvider((p) => p || r.activeProvider || r.providers[0] || "");
    });
  };

  // Tras guardar en la vista Proveedores → refresca los chips al instante.
  const onConfigChanged = (config: AssistantConfig) => {
    const active = Object.entries(config.providers ?? {})
      .filter(([, st]) => st?.active)
      .map(([id]) => id);
    if (active.length > 0) {
      setFetchedProviders(active);
      setProvider((p) => (active.includes(p) ? p : (config.activeProvider && active.includes(config.activeProvider) ? config.activeProvider : active[0])));
    }
  };

  // Persiste estado por panel en cada cambio relevante.
  useEffect(() => {
    CHAT_STORE.set(panelId, { messages, provider, conversationId });
  }, [panelId, messages, provider, conversationId]);

  const enabledProviders = providers && providers.length > 0
    ? providers
    : fetchedProviders.length > 0
      ? fetchedProviders
      : (provider ? [provider] : []);

  // Disponibilidad: el asistente usa la misma conexión SSH que las métricas, así
  // que si éstas no conectan, el asistente tampoco. Bloqueamos el input y
  // mostramos la razón. Mientras carga o no se sabe, dejamos escribir (optimista).
  // El override local permite reflejar al instante un "Refrescar estado" sin
  // esperar al sondeo del contenedor (30s). Se descarta cuando llega un sondeo nuevo.
  const effectiveMetrics = metricsOverride ?? metricsState;
  useEffect(() => { setMetricsOverride(null); }, [metricsState]);

  // Carga proactiva de proveedores cuando el panel está expandido y el SSH ya
  // conecta (métricas en estado "ok"). El contenedor sondea SOLO el slide
  // visible, así que `effectiveMetrics.status === "ok"` solo es cierto para ese
  // panel → no provoca N handshakes al cargar el dashboard.
  useEffect(() => {
    if (effectiveMetrics?.status !== "ok") return;
    if (effectiveMetrics.metrics.liveStatus !== "ok") return;
    loadProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveMetrics]);

  const reasonKind: "creds" | "fingerprint" | "unreachable" | "generic" | null = (() => {
    if (!effectiveMetrics || effectiveMetrics.status === "loading") return null;
    if (effectiveMetrics.status === "error") return "generic";
    const ls = effectiveMetrics.metrics.liveStatus;
    if (ls === "ok") return null;
    if (ls === "no_credentials") return "creds";
    if (ls === "fingerprint_pending") return "fingerprint";
    if (ls === "unreachable") return "unreachable";
    return "generic";
  })();
  const isFingerprint = reasonKind === "fingerprint";
  const unavailableReason = noData ? t.noData
    : reasonKind === "creds" ? t.unavailCreds
    : reasonKind === "fingerprint" ? t.unavailFingerprint
      : reasonKind === "unreachable" ? t.unavailUnreachable
        : reasonKind === "generic" ? t.unavailGeneric
          : null;
  const blocked = !!noData || (reasonKind !== null && !(fpApproved && isFingerprint));

  const approveFingerprint = async () => {
    if (!token || approvingFp) return;
    setApprovingFp(true);
    setNotice(null);
    const r = await approvePanelFingerprint(panelId, token);
    setApprovingFp(false);
    if (r.ok) {
      setFpApproved(true);
      void onMetricsRefresh?.(panelId); // refresca CPU/RAM/Disco al instante
    } else {
      setNotice(r.error || t.unavailGeneric);
    }
  };

  const refreshStatus = async () => {
    if (!token || refreshingStatus) return;
    setRefreshingStatus(true);
    setNotice(null);
    const r = await getServerMetrics(panelId, token);
    setRefreshingStatus(false);
    setMetricsOverride(r.ok ? { status: "ok", metrics: r.metrics } : { status: "error" });
    void onMetricsRefresh?.(panelId); // sincroniza también las tarjetas del contenedor
  };

  // Auto-scroll respetando al usuario: si subió a leer, no lo arrastramos al
  // fondo; aparece el botón flotante "↓" para volver al final.
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
      setAttachment({ name: file.name, dataBase64: base64 });
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
  };

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if ((!text && !attachment) || busy || sendingRef.current || !token) return;
    sendingRef.current = true;
    setInput("");
    requestAnimationFrame(autosize);
    setNotice(null);
    const att = attachment;
    setAttachment(null);
    const history = [
      ...messages.filter((m) => !m.pending).map(({ role, content }) => ({ role, content })),
      { role: "user" as const, content: text || (att ? att.name : "") },
    ];
    // eslint-disable-next-line react-hooks/purity -- handler de envío, no render
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

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const result = await streamServerAssistant(
      panelId,
      history,
      token,
      (ev: AssistantEvent) => {
        setMessages((prev) => reduceAssistantEvent(prev, ev));
        scrollToEnd();
      },
      ctrl.signal,
      { provider: provider || undefined, attachment: att ?? undefined, conversationId: conversationId ?? undefined },
    );

    abortRef.current = null;
    sendingRef.current = false;
    setBusy(false);
    // eslint-disable-next-line react-hooks/purity -- handler de envío, no render
    const durationMs = Date.now() - startedAt;
    setMessages((prev) => prev.map((m) => (m.pending ? { ...m, pending: false, at: Date.now(), durationMs } : m)));
    if (!result.ok) {
      setNotice(result.code === "ERROR" ? t.error : t.unavailable);
      setMessages((prev) => prev.filter((m, i) => !(i === prev.length - 1 && m.role === "assistant" && !m.content && !(m.tools?.length))));
    }
    scrollToEnd();
  };

  const showProviders = view === "providers";

  return (
    <div className={`server-assistant ${collapsed ? "is-collapsed" : ""}`} data-per={perSlide}>
      <div className="server-assistant__head">
        {logoUrl && !logoBroken ? (
          <img src={logoUrl} alt="" className="server-assistant__logo" onError={() => setLogoBroken(true)} />
        ) : (
          <TerminalIcon size={14} />
        )}
        <span className="server-assistant__title">{panelName || t.title}</span>
        {busy ? (
          <span className="server-assistant__responding">
            <Loader2 size={11} className="animate-spin" /> {t.responding}
          </span>
        ) : null}
        {/* Chips de proveedor (reemplazan al <select>): activo = fondo card + sombra. */}
        {!collapsed && enabledProviders.length > 0 ? (
          <div className="server-assistant__chips" role="tablist" aria-label={t.provider}>
            {enabledProviders.map((p) => (
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
          className={`lp-icon-btn server-assistant__hbtn tooltip tooltip-bottom ${showProviders ? "is-active" : ""}`}
          onClick={() => { setView((v) => (v === "providers" ? "chat" : "providers")); setDrawerOpen(false); setCollapsed(false); }}
          aria-label={showProviders ? t.backToChat : t.providersView}
          data-tip={showProviders ? t.backToChat : t.providersView}
        >
          <Settings size={15} />
        </button>
      </div>

      {!collapsed ? (
        <>
        {query.trim() && searchStatus?.state === "indexing" && <div role="status" className="server-assistant__notice">{historySearchLabel(language ?? "en", searchStatus)} <button type="button" onClick={() => { invalidateAssistantReads(); void history.first(); }}>{getMessages(language).common.refresh}</button></div>}
        <div className="server-assistant__body">
          <ConversationSidebarLegacy
            onScrollCapture={event => { const el = event.target as HTMLElement; if (el.scrollTop > 0 && el.scrollHeight - el.clientHeight - el.scrollTop < 48) void history.next(); }}
            t={t}
            language={language}
            conversations={conversations}
            projects={projects}
            projectId={projectId}
            onSelectProject={setProjectId}
            conversationId={conversationId}
            busy={busy}
            historyBusy={historyBusy}
            query={query}
            onQueryChange={setQuery}
            onOpen={openConversation}
            onDelete={deleteConversation}
            onNew={newConversation}
          />
          <div className="server-assistant__main">
          {showProviders ? (
            <ServerAssistantProviders panelId={panelId} token={token} language={language} onConfigChanged={onConfigChanged} />
          ) : null}

          {!showProviders ? (
        <>
          <MessageList
            t={t}
            language={language}
            listRef={listRef}
            onListScroll={onListScroll}
            blocked={blocked}
            noData={noData}
            isFingerprint={isFingerprint}
            unavailableReason={unavailableReason}
            notice={notice}
            approvingFp={approvingFp}
            refreshingStatus={refreshingStatus}
            onApproveFingerprint={approveFingerprint}
            onRefreshStatus={refreshStatus}
            token={token}
            messages={messages}
            provider={provider}
            emptyHint={t.examples}
            st={st}
            quickReplies={t.examples.slice(0, 6)}
            providerLabel={provider ? (PROVIDER_META[provider]?.label ?? provider) : (panelName || t.title)}
            hasActiveAgent={false}
            onPickQuickReply={(text) => { if (!busy && !blocked && token) void send(text); }}
            onFocusComposer={() => taRef.current?.focus()}
            mdLabels={mdLabels}
            serverUser={serverUser}
            consumed={consumed}
            onConsume={(k) => setConsumed((prev) => new Set(prev).add(k))}
            onActionResult={(text) => setMessages((prev) => [...prev, { role: "assistant", content: text, at: Date.now() }])}
            stick={stick}
            onJumpLatest={() => scrollToEnd(true)}
          />

          <Composer
            t={t}
            busy={busy}
            token={token}
            blocked={blocked}
            input={input}
            attachment={attachment}
            unavailableReason={unavailableReason}
            fileRef={fileRef}
            taRef={taRef}
            onSubmit={() => void send()}
            onInputChange={(v) => { setInput(v); autosize(); }}
            onPickFile={pickFile}
            onRemoveAttachment={() => setAttachment(null)}
            onStop={stopStream}
            onFocus={loadProviders}
          />
        </>
          ) : null}
          </div>
        </div>
        </>
      ) : null}
    </div>
  );
}
