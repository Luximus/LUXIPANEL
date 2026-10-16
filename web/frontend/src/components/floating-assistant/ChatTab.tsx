// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChatPane } from "./ChatPane";
import { chatUiState } from "./chat-ui-state";
import { CliUsageBars } from "./CliUsageBars";
import { useChatCliTarget } from "./use-chat-cli-target";
import { assistantConversationsApi } from "./assistant-api/conversations";
import { assistantApi, PROVIDER_META, PROVIDER_ORDER, type AssistantConfigState, type AssistantProviderId, type ApprovalMode } from "./assistant-api";
import { type MobileNavController } from "./MobileNavModal";
import { uiPrefs } from "./ui-prefs";
import { useAssistantI18n } from "./i18n";
import { useViewDirection, useViewEnterReplay } from "@/components/ui/ViewTransition";

interface ChatTabProps {
  enabled: boolean;
  config: AssistantConfigState | null;
  /** True while the config is still being fetched (drawer just opened / target changed). */
  loading?: boolean;
  onOpenProviders(): void;
  /** Propagate a config change made from within the chat (e.g. the approval-mode
   *  selector) up to the panel-level config state. */
  onConfigChange?: (config: AssistantConfigState) => void;
  /** Request from the Dashboard (open a conversation), the Agents tab (start a
   *  fresh chat bound to a custom agent) or the bridge externo (solicitud
   *  "new-assistant"). Tipado como `ChatOpenRequest` (unión discriminada) para
   *  que cada kind se enrute sin ambigüedad. */
  openReq?: import("./AssistantPanel").ChatOpenRequest | null;
  /** Launch a chat bound to a custom agent (switches to its provider sub-tab). */
  onLaunchAgent?: import("./chat-pane/vm-types").ChatPaneProps["onLaunchAgent"];
  /** Prompt to prefill into the active provider's composer (deep-link/handoff). */
  seedText?: string | null;
  seedAutoSend?: boolean;
  seedNewChat?: boolean;
  /** Provider the seed should be routed to. Falls back to the active tab. */
  seedProvider?: string | null;
  seedNonce?: number;
  onSeedConsumed?(): void;
  /** Drawer-only: closes the floating assistant. Surfaced as a ✕ in the chat
   *  header on phones, since the bottom nav (which held it) is hidden here. */
  onCloseDrawer?: () => void;
  /** True only when the Chat tab is the visible main tab. Gates each pane's
   *  `active` so the engine's "currently viewing" marker is cleared when the
   *  user is on another tab (e.g. Dashboard) — a chat that finishes there is
   *  then correctly flagged "sin revisar". */
  chatVisible?: boolean;
  // ── Bridge `lxp:assistant:request v1` ─────────────────────────────────────
  /** RequestId del bridge externo cuando el `openReq` es `kind:"new-assistant"`.
   *  Se entrega al ChatPane con openAgentId=null para garantizar conversación
   *  NORMAL. Idempotente: el pane consume el id una sola vez tras enviar. */
  assistantRequestOpenRequestId?: string | null;
  /** Texto del request externo. */
  assistantRequestPrompt?: string | null;
  /** Modo del request externo: "auto" crea+envía; "prefill" solo rellena composer. */
  assistantRequestSubmit?: "auto" | "prefill" | null;
  assistantRequestServerEntries?: import("@/lib/assistant-request").AssistantServerEntry[];
  /** Nonce para que el ChatPane re-aplique el request si llega igual. */
  assistantRequestNonce?: number;
  /** Llamado por el ChatPane tras enviar/prefill; limpia el slot en el panel. */
  onAssistantRequestConsumed?: () => void;
}

/**
 * Multi-provider chat. Each provider pane stays mounted while hidden, so
 * in-flight streams survive provider switches and multiple providers can keep
 * answering concurrently.
 */
export function ChatTab({ enabled, config, loading, onOpenProviders, onConfigChange, openReq, onLaunchAgent, seedText, seedAutoSend, seedNewChat, seedProvider, seedNonce, onSeedConsumed, onCloseDrawer, chatVisible = true, assistantRequestOpenRequestId, assistantRequestPrompt, assistantRequestSubmit, assistantRequestServerEntries, assistantRequestNonce, onAssistantRequestConsumed }: ChatTabProps) {
  const t = useAssistantI18n().chatTab;
  // The composer is portaled into this slot on mobile so it sits between the
  // scroll area (order-1) and the provider sub-tabs (order-last), i.e. above
  // the provider tab bar and above the main nav.
  const mobileSlotRef = useRef<HTMLDivElement | null>(null);
  const [mobileSlotEl, setMobileSlotEl] = useState<HTMLElement | null>(null);
  useEffect(() => { setMobileSlotEl(mobileSlotRef.current); }, []);
  // Providers shown as chat tabs = strictly those toggled "Mostrar en chat"
  // (the switch in the Proveedores tab). No implicit fallback to the default
  // provider — the tabs must mirror the switches.
  const activeProviders: AssistantProviderId[] = config
    ? (Object.keys(config.providers) as AssistantProviderId[]).filter(
        (id) => config.providers[id].active,
      )
    : [];
  const selectableProviders = config
    ? PROVIDER_ORDER.filter((id) => {
        const state = config.providers[id];
        return state?.active || (state?.mode === "api" ? state.api.hasApiKey : state?.cli.installed && state.cli.loggedIn);
      })
    : [];

  // Restore the active provider sub-tab chosen before the drawer closed (the
  // tab unmounts on close). The auto-select effect below validates it against
  // the currently active providers.
  const [tab, setTab] = useState<AssistantProviderId | null>(
    () => chatUiState.getActiveProvider() as AssistantProviderId | null,
  );
  const visitedProviders = useRef(new Set<AssistantProviderId>());
  if (!config) visitedProviders.current.clear();
  if (tab) visitedProviders.current.add(tab);
  const cliHeaderTarget = useChatCliTarget();
  const [railVisible, setRailVisible] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(min-width: 1025px)").matches === true);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1025px)");
    const sync = () => setRailVisible(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  // Transición al cambiar de proveedor (sub-tabs): los ChatPane permanecen
  // montados (display) para no perder streams, así que reproducimos la
  // animación de entrada sobre el contenedor ya montado (motion.css preset).
  const paneDirection = useViewDirection(tab, activeProviders);
  const paneAreaRef = useViewEnterReplay<HTMLDivElement>(tab, paneDirection);

  // Mirror the active provider into the store so reopening lands on it.
  useEffect(() => {
    chatUiState.setActiveProvider(tab);
  }, [tab]);

  // Switch the active provider WITHOUT abandoning the open chat. Each provider
  // keeps its own pane snapshot (to avoid accidental cross-provider bleed), so a
  // naked tab switch would drop the user onto that provider's OWN (usually empty
  // or unrelated) conversation. The user wants to stay in the SAME chat/view and
  // only change who answers the next turn — valid because `provider` is a
  // per-turn attribute server-side (patched on each run) and the conversation
  // list is shared across providers. So we copy the current pane's full snapshot
  // (open conversation + draft + scope + staged attachments) onto the target pane
  // before switching; ChatPane's restore effect then re-opens that same thread.
  //
  // The newly mounted usage bar loads the selected provider itself.
  const switchProvider = useCallback(
    (target: AssistantProviderId) => {
      if (tab && target !== tab) {
        chatUiState.patchPane(target, chatUiState.getPane(tab));
      }
      setTab(target);

    },
    [tab, config],
  );
  const providerChangeSeq = useRef(0);
  const selectProvider = useCallback(async (target: AssistantProviderId) => {
    const seq = ++providerChangeSeq.current;
    if (!config?.providers[target]) return;
    try {
      if (!config.providers[target].active) {
        const next = await assistantApi.setProvider(target, { active: true });
        onConfigChange?.(next);
      }
      const id = tab ? chatUiState.getPane(tab).activeId : null;
      if (id) await assistantConversationsApi.setOptions(id, { provider: target, model: "", effort: "" });
      if (seq !== providerChangeSeq.current || (tab && chatUiState.getPane(tab).activeId !== id)) return;
      switchProvider(target);
    } catch (err) {
      console.error("Failed to switch assistant provider", err);
    }
  }, [config, onConfigChange, switchProvider]);

  // Per-server defaults for NEW chats: the provider that starts active and the
  // model preselected in its composer. Read from the config, falling back to the
  // localStorage mirror so they apply before the config response lands. `""` /
  // "auto" mean "unset" → historical behaviour (activeProvider + Auto). Agent
  // chats are unaffected — they route through `openReq` with the agent's own
  // provider. ChatPane validates the model against its provider's catalog.
  const defaultChatProvider = config?.defaultChatProvider ?? (uiPrefs.get().defaultChatProvider || undefined);
  const defaultChatModel = config?.defaultChatModel ?? (uiPrefs.get().defaultChatModel || undefined);

  useEffect(() => {
    if (activeProviders.length === 0) {
      setTab(null);
    } else if (!tab || !activeProviders.includes(tab)) {
      const wanted = defaultChatProvider as AssistantProviderId | undefined;
      const preferred =
        wanted && activeProviders.includes(wanted) ? wanted : config?.activeProvider;
      setTab(preferred && activeProviders.includes(preferred) ? preferred : activeProviders[0]!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProviders.join(","), config?.activeProvider, defaultChatProvider]);

  // The Dashboard asked to open a conversation → select its provider sub-tab.
  // The matching ChatPane opens the conversation itself (via openReq below).
  // The CLI usage refresh for the newly-activated provider is fired by the
  // `useEffect` above on `[tab]`, which picks up the `setTab(id)` below.
  useEffect(() => {
    if (!openReq) return;
    const id = openReq.provider as AssistantProviderId;
    if (activeProviders.includes(id)) setTab(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openReq?.nonce, openReq?.provider, activeProviders.join(",")]);

  // Provider resuelto para el bridge externo `lxp:assistant:request v1`:
  // siempre toma el provider del `new-assistant` request cuando está presente,
  // así garantizamos que el ChatPane destino (de ese provider) reciba el flag.
  const assistantRequestProviderId: AssistantProviderId | null =
    openReq?.kind === "new-assistant" ? (openReq.provider as AssistantProviderId) : null;

  // Which provider's pane should receive the current seed. When the seed names
  // a provider (e.g. the monitor "Optimizar con IA" picker) route to it;
  // otherwise fall back to the visible tab (mail/files handoffs).
  const seedTarget: AssistantProviderId | null =
    seedProvider && activeProviders.includes(seedProvider as AssistantProviderId)
      ? (seedProvider as AssistantProviderId)
      : tab;

  // A new seed arrived for an explicit provider → make its tab visible so the
  // user sees the new chat being created.
  useEffect(() => {
    if (!seedText) return;
    if (seedProvider && activeProviders.includes(seedProvider as AssistantProviderId)) {
      setTab(seedProvider as AssistantProviderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedNonce]);

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center text-sm text-muted-foreground">
        <i className="ti ti-loader-2 animate-spin text-4xl text-primary/70" aria-hidden></i>
        <p className="font-medium text-foreground">{t.loadingTitle}</p>
        <p className="text-xs">{t.loadingDescription}</p>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center text-sm text-muted-foreground">
        <i className="ti ti-plug-off text-4xl text-muted-foreground/40" aria-hidden></i>
        <p className="font-medium text-foreground">{t.disabledTitle}</p>
        <button type="button" onClick={onOpenProviders} className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          {t.goToProviders}
        </button>
      </div>
    );
  }

  if (activeProviders.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center text-sm text-muted-foreground">
        <i className="ti ti-plug text-4xl text-muted-foreground/40" aria-hidden></i>
        <p className="font-medium text-foreground">{t.noProvidersTitle}</p>
        <p className="text-xs">{t.noProvidersDescription}</p>
        <button type="button" onClick={onOpenProviders} className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          {t.goToProviders}
        </button>
      </div>
    );
  }

  // Provider selector controller consumed by the integrated composer select.
  const mobileProviderNav: MobileNavController = {
    options: selectableProviders.map((id) => ({
      id,
      label: PROVIDER_META[id].label.replace(/ \(.+\)$/, ""),
      mode: config?.providers[id]?.mode,
      provider: true,
    })),
    selected: tab ?? "",
    onSelect: (id) => { void selectProvider(id as AssistantProviderId); },
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* CLI usage bars — only in CLI mode. On mobile: order-first (very top). */}
      {tab && config?.providers[tab]?.mode === "cli" && (() => {
        const target = railVisible && typeof document !== "undefined" ? document.getElementById("server-cli-usage") : cliHeaderTarget;
        const usage = <div className="shrink-0 max-sm:order-first"><CliUsageBars key={tab} provider={tab} variant={railVisible && target ? "rail" : "compact"} /></div>;
        return target ? createPortal(usage, target) : usage;
      })()}

      {/* Chat scroll area — order-1 on mobile (top, below CLI bars). */}
      <div ref={paneAreaRef} className="flex-1 min-h-0 relative max-sm:order-1">
        {activeProviders.filter((id) => visitedProviders.current.has(id)).map((id) => (
          <div
            key={id}
            className="absolute inset-0"
            style={{ display: tab === id ? "block" : "none" }}
          >
            <ChatPane
              provider={id}
              mode={config?.providers[id].mode ?? "api"}
              model={
                config?.providers[id].mode === "cli"
                  ? config?.providers[id].cli?.model
                  : config?.providers[id].api?.model
              }
              initialEffort={config?.defaultChatEffort ?? ""}
              initialModel={
                defaultChatProvider === id && defaultChatModel && defaultChatModel !== "auto"
                  ? defaultChatModel
                  : undefined
              }
              uiMode={config?.uiMode ?? "simple"}
              voice={config?.voice ?? null}
              approvalMode={config?.approval?.mode ?? "manual"}
              onRestoreProvider={(target, conversationId) => {
                if (tab !== id || !config?.providers[target as AssistantProviderId]?.active) return;
                chatUiState.patchPane(target, { ...chatUiState.getPane(id), activeId: conversationId });
                setTab(target as AssistantProviderId);
              }}
              // ── Routing del `ChatOpenRequest` por kind ──────────────────
              // Cada pane recibe los campos que aplican a SU kind (no se
              // mezclan). `new-assistant` SIEMPRE viaja como openAgentId=null
              // — garantiza conversación NORMAL aunque el pane esté agent-bound.
              openConversationId={
                openReq?.provider === id && openReq.kind === "conversation"
                  ? openReq.conversationId
                  : null
              }
              openProjectId={
                openReq?.provider === id && (openReq.kind === "conversation" || openReq.kind === "agent")
                  ? (openReq.projectId ?? null)
                  : null
              }
              openAgentId={
                openReq?.provider === id && openReq.kind === "agent"
                  ? openReq.agentId
                  : null
              }
              openAgentDraft={openReq?.provider === id && openReq.kind === "agent" ? openReq.draft : undefined}
              openConversationAgentId={
                openReq?.provider === id && openReq.kind === "conversation"
                  ? (openReq.conversationAgentId ?? null)
                  : null
              }
              openNonce={openReq?.provider === id ? openReq.nonce : 0}
              onLaunchAgent={onLaunchAgent}
              seedText={seedTarget === id ? seedText : null}
              seedAutoSend={seedTarget === id ? seedAutoSend : false}
              seedNewChat={seedTarget === id ? seedNewChat : false}
              seedNonce={seedTarget === id ? seedNonce : 0}
              onSeedConsumed={onSeedConsumed}
              mobileBottomSlot={mobileSlotEl}
              active={chatVisible && tab === id}
              mobileProviderNav={mobileProviderNav}
              onCloseDrawer={onCloseDrawer}
              // ── Bridge `lxp:assistant:request v1` ───────────────────────
              // Solo el provider resuelto recibe el flag; el resto lo ignora.
              // El ChatPane lo consume una sola vez tras enviar.
              assistantRequestOpenRequestId={
                assistantRequestProviderId === id ? assistantRequestOpenRequestId ?? null : null
              }
              assistantRequestPrompt={
                assistantRequestProviderId === id ? assistantRequestPrompt ?? null : null
              }
              assistantRequestSubmit={
                assistantRequestProviderId === id ? assistantRequestSubmit ?? null : null
              }
              assistantRequestServerEntries={assistantRequestProviderId === id ? assistantRequestServerEntries : undefined}
              assistantRequestNonce={
                assistantRequestProviderId === id ? assistantRequestNonce ?? 0 : 0
              }
              onAssistantRequestConsumed={
                assistantRequestProviderId === id ? onAssistantRequestConsumed : undefined
              }
            />
          </div>
        ))}
      </div>

      {/* Mobile composer slot — order-2: portaled textarea lands here, above
          the provider sub-tabs (order-last) and above the main nav (order-2
          at DrawerContent level). Desktop: hidden (composer renders inline). */}
      <div ref={mobileSlotRef} className="sm:hidden shrink-0 max-sm:order-2 bg-card" />
    </div>
  );
}
