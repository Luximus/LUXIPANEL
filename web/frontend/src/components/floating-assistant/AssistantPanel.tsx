// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getClientMessages } from "@/i18n/client";
import {
  assistantApi,
  PROVIDER_ORDER,
  type AssistantAgent,
  type AssistantConfigState,
  type AssistantProviderId,
} from "./assistant-api";
import {
  ASSISTANT_REQUEST_EVENT,
  newRequestId,
  type AssistantRequestBusEntry,
  type LxpAssistantAPI,
} from "@/lib/assistant-request";
import { ChatTab } from "./ChatTab";
import { ProviderIcon } from "./ProviderIcon";
import type { AssistantSettingsSection } from "./AssistantSettingsModal";
const AssistantSettingsModal = lazy(() => import("./AssistantSettingsModal").then(module => ({ default: module.AssistantSettingsModal })));
import {
  ScreenProviderContext,
  SCREEN_PROVIDER_ALL,
  type ScreenProviderController,
  type ScreenProviderRegistry,
} from "./screen-provider";
import { uiPrefs, type AssistantUiPrefs } from "./ui-prefs";
import { AssistantI18nProvider, assistantMessagesFallback, mergeAssistantMessages, type AssistantMessages } from "./i18n";
import type { DataTableI18n } from "@/components/ui/DataTable";
import { AssistantErrorBoundary } from "./AssistantErrorBoundary";

export type AssistantTab = "chat" | "agentes" | "providers" | "modules" | "stats" | "access";

/**
 * Solicitud que el panel entrega al ChatTab / ChatPane. Es una unión
 * DISCRIMINADA por `kind` para que el camino de cada tipo sea explícito y no
 * se mezclen agent-bound y conversaciones normales:
 *
 *   • "conversation" — abrir una conversación existente (Dashboard, sidebar).
 *     Conserva el agentId que ya tenía (lo pasa la metadata del list).
 *   • "agent" — iniciar un chat NUEVO bound a un agente custom (Agents tab).
 *   • "new-assistant" — solicitud del bridge externo (`lxp:assistant:request
 *     v1`, Monitor/Mail/Obsidian/…). Garantiza conversación NORMAL (sin agente,
 *     sin proyecto): resetea currentAgentId/currentProjectId antes de enviar y
 *     fija activeId=null. El submit "auto" crea y envía; "prefill" solo
 *     rellena el composer.
 */
export type ChatOpenRequest =
  | {
      kind: "conversation";
      provider: string;
      conversationId: string;
      projectId?: string | null;
      agentId?: string | null;
      conversationAgentId?: string | null;
      nonce: number;
    }
  | {
      kind: "agent";
      provider: string;
      agentId: string;
      projectId?: string | null;
      nonce: number;
    }
  | {
      kind: "new-assistant";
      provider: string;
      requestId: string;
      prompt: string;
      submit: "auto" | "prefill";
      serverEntries?: import("@/lib/assistant-request").AssistantServerEntry[];
      nonce: number;
    };

/**
 * Prompt handed off from another module (e.g. the mail inbox "Depurar con IA").
 * Threaded down to the active ChatPane, which prefills its composer. The
 * `nonce` bumps on every seed so the panel re-applies even with identical text.
 */
export interface AssistantSeed {
  text: string;
  autoSend: boolean;
  newChat: boolean;
  provider: string | null;
  nonce: number;
}

export interface AssistantPendingRequest {
  requestId: string;
  prompt: string;
  submit: "auto" | "prefill";
  providerId: string | null;
  serverEntries?: import("@/lib/assistant-request").AssistantServerEntry[];
}

interface AssistantPanelProps {
  locale: string;
  /**
   * `drawer` = rendered inside the floating vaul drawer (FAB). `view` = rendered
   * as the dedicated full page (`/panel/assistant`). The body of the panel is
   * identical in both modes — only the outer shell (provided by the caller) and
   * the close affordance differ, so changes stay in parity automatically.
   */
  variant: "drawer" | "view";
  /** Only used in `drawer` mode — renders the ✕ that closes the drawer. */
  onClose?: () => void;
  /** Tab requested externally (deep-link / window API). Applied when `requestNonce` changes. */
  requestedTab?: AssistantTab | null;
  requestNonce?: number;
  /** Seed handoff from another module; forwarded to the active ChatPane. */
  seed?: AssistantSeed | null;
  onSeedConsumed?: () => void;
  pendingRequest?: AssistantPendingRequest | null;
  onPendingRequestConsumed?: () => void;
  /**
   * Deep-link externo por query-string (`/panel?c=<id>&provider=<p>`), leído en
   * SSR por `pages/panel/index.astro`. Se consume UNA vez cuando hay providers
   * activos y la query se limpia con `history.replaceState`.
   */
  initialOpen?: AssistantInitialOpen | null;
}

/** Conversación a abrir en el primer render (deep-link `?c=`). */
export interface AssistantInitialOpen {
  conversationId: string;
  provider?: string | null;
}

/**
 * Mobile keyboard handling: on phones the on-screen keyboard does NOT shrink the
 * layout viewport inside a WebView, so a bottom-anchored composer gets covered.
 * We mirror the *visual* viewport height into `--lxp-vvh` and apply it to the
 * drawer, so the whole panel (and its bottom composer) sits above the keyboard.
 * Only active on small screens — desktop keeps the plain 100dvh.
 */
function useVisualViewportHeight(active: boolean): void {
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    const root = typeof document !== "undefined" ? document.documentElement : null;
    if (!vv || !root) return;
    const isMobile = () => window.matchMedia("(max-width: 639px)").matches;
    const apply = () => {
      if (!active || !isMobile()) {
        root.style.removeProperty("--lxp-vvh");
        return;
      }
      root.style.setProperty("--lxp-vvh", `${Math.round(vv.height)}px`);
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      root.style.removeProperty("--lxp-vvh");
    };
  }, [active]);
}

function isSettingsSection(
  tab: AssistantTab | null | undefined,
): tab is Extract<AssistantTab, "agentes" | "providers" | "modules" | "stats" | "access"> {
  return tab === "agentes" || tab === "providers" || tab === "modules" || tab === "stats" || tab === "access";
}

/**
 * Contenido compartido del Asistente IA — único componente para los dos modos
 * (drawer flotante y vista de página). El wrapper exterior (DrawerContent vaul
 * o el contenedor de la página) lo aporta quien renderiza este panel.
 */
export default function AssistantPanel({
  locale,
  variant,
  onClose,
  requestedTab,
  requestNonce,
  seed,
  onSeedConsumed,
  pendingRequest,
  onPendingRequestConsumed,
  initialOpen,
}: AssistantPanelProps) {
  // El deep-link `?c=` se aplica UNA sola vez por montaje (ref, no estado: no
  // debe provocar re-render ni re-disparar el efecto).
  const initialOpenConsumed = useRef(false);
  const [messages, setMessages] = useState<AssistantMessages>(assistantMessagesFallback);
  const [dataTableI18n, setDataTableI18n] = useState<DataTableI18n | null>(null);
  // Keep the panel above the on-screen keyboard on phones while it's open.
  useVisualViewportHeight(variant === "drawer");
  // El módulo asistente ya NO tiene Dashboard: tanto en móvil como en escritorio
  // el panel entra directo al chat / lista de conversaciones.
  const [tab, setTab] = useState<AssistantTab>("chat");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsVisited, setSettingsVisited] = useState(false);
  useEffect(() => { if (settingsOpen) setSettingsVisited(true); }, [settingsOpen]);
  const [settingsSection, setSettingsSection] = useState<AssistantSettingsSection | null>(null);
  // Deep-link into the Agents section's editor (chat header agent chip).
  const [settingsAgentId, setSettingsAgentId] = useState<string | null>(null);
  // Active screen's provider selector (mobile): the in-screen top strip is
  // hidden on phones and registers here so the shared bottom strip drives it.
  const [screenProvider, setScreenProvider] = useState<ScreenProviderController | null>(null);
  const screenProviderRegistry = useMemo<ScreenProviderRegistry>(
    () => ({ setController: setScreenProvider }),
    [],
  );
  const [config, setConfig] = useState<AssistantConfigState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Lista de providers con toggle "Mostrar en chat" activo. Necesaria por
  // `openAssistantRequest` (resuelve provider) y `onboarding` (decide si
  // abrir Proveedores). Declarada ANTES del callback que la consume para que
  // TS no proteste por uso antes de declaración.
  const activeProviders = useMemo<AssistantProviderId[]>(() => {
    if (!config) return [];
    return (PROVIDER_ORDER as AssistantProviderId[]).filter((id) => config.providers[id]?.active);
  }, [config]);
  // Request from the Dashboard / Agents tab / bridge externo to drive the chat
  // tab. Un único slot tipado: el union `ChatOpenRequest` (kind:"conversation" |
  // "agent" | "new-assistant") reemplaza al anterior objeto ambiguo de 5
  // propiedades para que cada consumidor reciba EXACTAMENTE los campos que
  // espera (no más `openAgentId` siendo deducido del currentAgentId del pane).
  const [openReq, setOpenReq] = useState<ChatOpenRequest | null>(null);

  /**
   * Solicitud externa del bridge `lxp:assistant:request v1`. Garantiza una
   * conversación NORMAL (no agent-bound): NO pasa por `launchAgent`. Resuelve
   * primero el provider (de `activeProviders` o del `providerId` explícito) y
   * deja que `ChatTab`/`ChatPane` enruten a `openAgentId=null` con el flag
   * `assistantRequestOpenRequestId` para idempotencia. Si el módulo está
   * deshabilitado o el permiso falla, no-op (fail-closed).
   */
  const openAssistantRequest = useCallback(
    (params: { providerId?: string | null; requestId: string; prompt: string; submit: "auto" | "prefill"; serverEntries?: import("@/lib/assistant-request").AssistantServerEntry[] }) => {
      // Gate fail-closed: módulo deshabilitado NO consume el request.
      if (config?.enabled === false) return;
      // Resolver provider: explícito si viene, si no el primer provider activo.
      const provider = params.providerId && activeProviders.includes(params.providerId as AssistantProviderId)
        ? params.providerId as AssistantProviderId : activeProviders[0];
      if (!provider) return;
      setTab("chat");
      setOpenReq({
        kind: "new-assistant",
        provider,
        requestId: params.requestId,
        prompt: params.prompt,
        submit: params.submit,
        serverEntries: params.serverEntries,
        nonce: Date.now(),
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config?.enabled, activeProviders.join(",")],
  );

  // A closed drawer has no mounted AssistantPanel when the request event fires.
  // The drawer holds the request until config/providers are ready, then uses
  // the same conversation path as the dedicated assistant view.
  useEffect(() => {
    if (variant !== "drawer" || !pendingRequest || !config?.enabled || !activeProviders.length) return;
    openAssistantRequest(pendingRequest);
    onPendingRequestConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, pendingRequest?.requestId, config?.enabled, activeProviders.join(","), openAssistantRequest]);

  // Launch a chat bound to a custom agent: switch to its provider sub-tab and
  // start a fresh agent-bound conversation. Shared by the Agents tab, the
  // Dashboard's agents section, and the Chat sidebar's agents section.
  const launchAgent = useCallback((agent: AssistantAgent) => {
    setOpenReq({ kind: "agent", provider: agent.providerId, agentId: agent.id, projectId: agent.projectIds?.[0] ?? null, nonce: Date.now() });
    setTab("chat");
  }, []);

  const openSettings = useCallback((section?: AssistantSettingsSection | null, agentId?: string | null) => {
    setSettingsSection(section ?? null);
    setSettingsAgentId(agentId ?? null);
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    setSettingsSection(null);
    setSettingsAgentId(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getClientMessages(locale, ["assistant", "components"]).then((payload) => {
      if (cancelled) return;
      const next = (payload.assistant as Partial<AssistantMessages>) ?? {};
      setMessages(mergeAssistantMessages(next));
      const compDataTable = (payload.components as { dataTable?: unknown })?.dataTable;
      if (compDataTable && typeof compDataTable === "object") {
        setDataTableI18n(compDataTable as DataTableI18n);
      }
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [locale]);

  // "Configurado" = al menos un proveedor con el toggle "Mostrar en chat"
  // activo (lo único que hace usable el asistente). En el primer arranque
  // nada está activo → el flujo de onboarding aterriza en Proveedores.
  const hasActiveProvider = activeProviders.length > 0;

  const reload = useCallback(async () => {
    try {
      const cfg = await assistantApi.getConfig();
      setConfig(cfg);
      // Default-tab prefs are per-server (config sidecar). Mirror them into the
      // local `uiPrefs` so the dashboard / chat sidebar — which read them at
      // mount — reflect this server's value. Only overwrite fields the backend
      // actually returned so a not-yet-migrated backend can't wipe the mirror.
      const mirror: Partial<AssistantUiPrefs> = {};
      if (cfg.defaultAgentsTab) mirror.defaultAgentsTab = cfg.defaultAgentsTab;
      if (cfg.defaultConversationsTab) mirror.defaultConversationsTab = cfg.defaultConversationsTab;
      if (cfg.defaultChatProvider !== undefined) mirror.defaultChatProvider = cfg.defaultChatProvider;
      if (cfg.defaultChatModel !== undefined) mirror.defaultChatModel = cfg.defaultChatModel;
      if (Object.keys(mirror).length > 0) uiPrefs.set(mirror);
      setLoadError(null);
    } catch (err) {
      setLoadError((err as Error).message);
    }
  }, []);

  // Onboarding de primer arranque: cuando la config ya cargó y no hay ningún
  // proveedor configurado, abrir directamente en Proveedores — no hay nada que
  // mostrar en Dashboard/Chat y la primera tarea del usuario es configurar uno.
  useEffect(() => {
    if (!config) return;
    if (hasActiveProvider) return;
    setTab("chat");
    openSettings("providers");
  }, [config, hasActiveProvider, openSettings]);

  // Switch tab on external request (deep-link from /panel/assistant, window API,
  // or a seed event routed by the drawer wrapper).
  useEffect(() => {
    if (!requestedTab) return;
    if (isSettingsSection(requestedTab)) {
      openSettings(requestedTab);
      return;
    }
    setTab(requestedTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestNonce, requestedTab, openSettings]);

  useEffect(() => {
    const handleOpenSettings = (ev: Event) => {
      const detail = (ev as CustomEvent<{ section?: AssistantTab; agentId?: string; __ack?: boolean }>).detail;
      if (detail && typeof detail === "object") detail.__ack = true; // tell deep-link dispatchers we're hydrated
      openSettings(
        isSettingsSection(detail?.section) ? detail.section : null,
        typeof detail?.agentId === "string" ? detail.agentId : null,
      );
    };
    window.addEventListener("luxipanel:assistant-settings-open", handleOpenSettings);
    return () => window.removeEventListener("luxipanel:assistant-settings-open", handleOpenSettings);
  }, [openSettings]);

  /**
   * Deep-link a una conversación IA existente (notificación "Chat IA
   * finalizado", super buscador). El dispatcher REINTENTA hasta que alguien
   * marque `detail.__ack = true`, así que solo confirmamos cuando REALMENTE
   * podemos abrirla: si la config aún no cargó o no hay ningún provider activo
   * NO hacemos ack y el reintento nos alcanza ya hidratados.
   *
   * Excepción: módulo deshabilitado (`config.enabled === false`) → ack SIN
   * abrir (fail-closed); reintentar 16 veces no lo va a habilitar.
   */
  useEffect(() => {
    const onOpenConversation = (ev: Event) => {
      const detail = (ev as CustomEvent<{
        conversationId?: string;
        provider?: string;
        agentId?: string;
        __ack?: boolean;
      }>).detail;
      const ack = () => { if (detail && typeof detail === "object") detail.__ack = true; };
      if (config?.enabled === false) { ack(); return; }
      const conversationId = typeof detail?.conversationId === "string" ? detail.conversationId : "";
      if (!conversationId) { ack(); return; }
      if (activeProviders.length === 0) return; // sin hidratar / sin providers → que reintente
      const requested = typeof detail?.provider === "string" ? (detail.provider as AssistantProviderId) : null;
      const provider = requested && activeProviders.includes(requested) ? requested : activeProviders[0]!;
      ack();
      setTab("chat");
      setOpenReq({
        kind: "conversation",
        provider,
        conversationId,
        agentId: typeof detail?.agentId === "string" ? detail.agentId : null,
        nonce: Date.now(),
      });
    };
    window.addEventListener("luxipanel:assistant-open-conversation", onOpenConversation);
    return () => window.removeEventListener("luxipanel:assistant-open-conversation", onOpenConversation);
  }, [config?.enabled, activeProviders]);

  /**
   * Deep-link EXTERNO por query-string (`/panel?c=<id>&provider=<p>`): la home
   * lo lee en el SSR y lo pasa como `initialOpen`. Se consume UNA sola vez, en
   * cuanto hay providers activos, y se limpia la query con `replaceState` para
   * que un refresco no reabra la conversación.
   */
  useEffect(() => {
    if (!initialOpen?.conversationId) return;
    if (initialOpenConsumed.current) return;
    if (activeProviders.length === 0) return;
    initialOpenConsumed.current = true;
    const requested = initialOpen.provider as AssistantProviderId | undefined;
    const provider = requested && activeProviders.includes(requested) ? requested : activeProviders[0]!;
    setTab("chat");
    setOpenReq({ kind: "conversation", provider, conversationId: initialOpen.conversationId, agentId: null, nonce: Date.now() });
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("c");
      url.searchParams.delete("provider");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    } catch { /* ignore */ }
  }, [initialOpen?.conversationId, initialOpen?.provider, activeProviders]);

  // Bridge externo `lxp:assistant:request v1`. Recibe solicitudes de otros
  // módulos (Monitor, Mail, Obsidian, …) y las traduce a un `openReq` con
  // kind:"new-assistant". Solo solicitudes `kind:"prompt"` llegan aquí; las
  // `kind:"navigate"` las maneja el drawer wrapper (puede ser tab settings).
  // Dedupe / FIFO están centralizados en `lib/assistant-request.ts`; aquí
  // aplicamos la política de arbitraje (gate fail-closed + selección de tab).
  useEffect(() => {
    if (variant === "drawer") return;
    const onRequest = (ev: Event) => {
      const detail = (ev as CustomEvent<AssistantRequestBusEntry>).detail;
      if (!detail || detail.version !== 1) return;
      const req = detail.request;
      if (req.kind !== "prompt") return; // "navigate" lo gestiona el drawer
      openAssistantRequest({
        requestId: detail.requestId,
        prompt: req.prompt,
        submit: req.submit,
        serverEntries: req.serverEntries,
        ...(req.providerId ? { providerId: req.providerId } : {}),
      });
    };
    window.addEventListener(ASSISTANT_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(ASSISTANT_REQUEST_EVENT, onRequest);
  }, [openAssistantRequest, variant]);

  // Exponer API global para page scripts que hablan window en lugar de CustomEvent.
  // El shape es el de `LxpAssistantAPI` (lib/assistant-request.ts): los
  // productores pasan un `AssistantRequestInput` normalizado por el helper.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // NO sobreescribimos si ya existe: el bridge del layout podría haber
    // registrado su propia implementación antes que nosotros.
    if (window.__lxpAssistantAPI) return;
    const api: LxpAssistantAPI = {
      request: (input) => {
        if (input.kind !== "prompt") return ""; // "navigate" lo gestiona el drawer
        openAssistantRequest({
          prompt: input.prompt ?? "",
          submit: input.submit,
          serverEntries: input.serverEntries,
          requestId: newRequestId(),
          ...(input.providerId ? { providerId: input.providerId } : {}),
        });
        // Devolvemos el requestId real generado por el helper sería más
        // preciso, pero aquí sólo necesitamos correlación lógica: el panel
        // consume el request a través del openReq con su propio nonce.
        return "";
      },
    };
    window.__lxpAssistantAPI = api;
    return () => {
      if (window.__lxpAssistantAPI === api) {
        delete window.__lxpAssistantAPI;
      }
    };
  }, [openAssistantRequest]);

  // Becoming visible loads config; usage bars load on their own mount. The drawer
  // unmounts this panel on close (vaul) and remounts on open, so mount is the
  // right hook for both modes; the view mounts once with the page.
  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onTargetChanged = () => {
      setConfig(null);
      void reload();
    };
    const refreshCredentials = () => { void reload(); };
    window.addEventListener("luxipanel:target-changed", onTargetChanged);
    window.addEventListener("luxipanel:credentials-changed", refreshCredentials);
    window.addEventListener("luxipanel:credentials-open", closeSettings);
    return () => {
      window.removeEventListener("luxipanel:target-changed", onTargetChanged);
      window.removeEventListener("luxipanel:credentials-changed", refreshCredentials);
      window.removeEventListener("luxipanel:credentials-open", closeSettings);
    };
  }, [reload, closeSettings]);

  return (
    <AssistantI18nProvider value={messages}>
      <ScreenProviderContext.Provider value={screenProviderRegistry}>
        <div className="flex flex-1 min-h-0 flex-col">
          {variant === "drawer" && onClose && (
            <div className="flex shrink-0 justify-end border-b border-border bg-muted/30 px-2 py-2">
              <button
                type="button"
                onClick={onClose}
                aria-label={messages.drawer.close}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <i className="ti ti-x text-base" aria-hidden></i>
              </button>
            </div>
          )}

          <div className="flex-1 min-h-0 flex flex-col max-sm:order-1">
            <AssistantErrorBoundary onReset={() => void reload()}>
              {loadError && (
                <div className="m-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-600 shrink-0">
                  {messages.drawer.loadErrorPrefix} {loadError}
                </div>
              )}

              {/* Chat stays mounted across tab switches so in-flight streams and
                  the open conversation are never lost. */}
              <div className="flex-1 min-h-0 flex flex-col" style={{ display: tab === "chat" ? "flex" : "none" }}>
                <ChatTab
                  enabled={Boolean(config?.enabled)}
                  config={config}
                  loading={config === null && !loadError}
                  onOpenProviders={() => openSettings("providers")}
                  onConfigChange={setConfig}
                  openReq={openReq}
                  chatVisible={tab === "chat"}
                  onLaunchAgent={launchAgent}
                  seedText={seed?.text ?? null}
                  seedAutoSend={seed?.autoSend ?? false}
                  seedNewChat={seed?.newChat ?? false}
                  seedProvider={seed?.provider ?? null}
                  seedNonce={seed?.nonce ?? 0}
                  onSeedConsumed={() => onSeedConsumed?.()}
                  onCloseDrawer={variant === "drawer" ? onClose : undefined}
                  // Request del bridge externo (kind "new-assistant"): se entrega
                  // al ChatPane destino con openAgentId=null para garantizar
                  // conversación NORMAL (no agent-bound). Solo se propagan los
                  // campos cuando el request activo es de este kind; el resto
                  // cae a null/0 como antes.
                  assistantRequestOpenRequestId={
                    openReq?.kind === "new-assistant" ? openReq.requestId : null
                  }
                  assistantRequestPrompt={
                    openReq?.kind === "new-assistant" ? openReq.prompt : null
                  }
                  assistantRequestSubmit={
                    openReq?.kind === "new-assistant" ? openReq.submit : null
                  }
                  assistantRequestServerEntries={openReq?.kind === "new-assistant" ? openReq.serverEntries : undefined}
                  assistantRequestNonce={openReq?.kind === "new-assistant" ? openReq.nonce : 0}
                  onAssistantRequestConsumed={() => {
                    // Tras consumir el request, limpia el slot para que un
                    // segundo render del mismo requestId no re-envíe. El slot
                    // también se vacía cuando el provider cambia.
                    setOpenReq(null);
                  }}
                />
              </div>
            </AssistantErrorBoundary>
          </div>

          {/* Provider sub-tabs — mobile only (sm:hidden), order-2. Driven by the
              active screen's registered selector (Dashboard / Providers / Stats):
              on phones the in-screen top strip is hidden and this controls it
              PER SCREEN — it never navigates to the chat tab. */}
          {screenProvider && screenProvider.options.length > 0 && (
            <div className="sm:hidden flex shrink-0 items-center gap-1 border-t border-border bg-muted/20 px-2 py-2 overflow-x-auto max-sm:order-2">
              {screenProvider.options.map((opt) => {
                const isAll = opt.id === SCREEN_PROVIDER_ALL;
                const active = screenProvider.selected === opt.id;
                const isKnown = (PROVIDER_ORDER as string[]).includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => screenProvider.onSelect(opt.id)}
                    className={`inline-flex min-h-11 flex-col items-center gap-0.5 rounded-md px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                      active ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                    }`}
                  >
                    {isAll ? (
                      <i className="ti ti-layout-grid text-base" aria-hidden></i>
                    ) : isKnown ? (
                      <ProviderIcon id={opt.id as AssistantProviderId} className="text-base" />
                    ) : (
                      <i className="ti ti-plug text-base" aria-hidden></i>
                    )}
                    <span className="inline-flex items-center gap-1 text-[10px]">
                      <span className="capitalize">{isAll ? ((messages.drawer as Record<string, unknown>).allProviders as string | undefined) ?? "All" : opt.id}</span>
                      {opt.mode && <span className="text-[9px] opacity-60 uppercase">{opt.mode}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {(settingsOpen || settingsVisited) && <Suspense fallback={null}><AssistantSettingsModal
          open={settingsOpen}
          section={settingsSection}
          locale={locale}
          config={config}
          dataTableI18n={dataTableI18n}
          editAgentId={settingsAgentId}
          onClose={closeSettings}
          onSectionChange={(s) => {
            setSettingsSection(s);
            // Navigating inside the modal consumes the agent deep-link so
            // re-entering the Agents section shows the list, not the editor.
            setSettingsAgentId(null);
          }}
          onConfigChange={setConfig}
          onLaunchAgent={launchAgent}
        /></Suspense>}
      </ScreenProviderContext.Provider>
    </AssistantI18nProvider>
  );
}
