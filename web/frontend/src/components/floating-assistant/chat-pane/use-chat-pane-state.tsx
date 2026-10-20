// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * ChatPane orchestrator — TRAMO 1/3 (state + refs + early derived + early
 * effects). VERBATIM slice of the original hook body (orig lines 1529-2155); the
 * flattened React-hook call order is unchanged. Handlers referenced backward
 * (send/openConversation/newConversation) + reloadList are reached via the shared
 * `actions` bag through same-named thin wrappers, so the effect bodies stay
 * byte-identical. Returns its bindings for the later tramos + the view-model.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  assistantConversationsApi,
  assistantApi,
  teamApi,
  attachmentSupport,
  type AssistantProject,
  type AssistantAgent,
  type AssistantAgentRole,
  type ChatAttachment,
  type ConversationContext,
  type ConversationMeta,
} from "../assistant-api";
import { chatEngine, type ChatTurn } from "../chat-engine";
import { useAssistantI18n } from "../i18n";
import { chatUiState } from "../chat-ui-state";
import { assistantConnectorsApi, type OfficeConnector, type TeamTaskView } from "../assistant-api";
import { uiPrefs } from "../ui-prefs";
import {
  categorizeConversation,
  scopeForCategory,
  computeExpandChain,
  LOOSE_GROUP_ID,
  accordionToggle,
} from "../conversation-grouping";
import { PROVIDER_MODELS, type AssistantProviderId } from "../assistant-api";
import { useIsMobile } from "./use-is-mobile";
import { setFabAgentsScopeActive } from "./helpers";
import { type ChatPaneProps, type ChatPaneActions } from "./vm-types";
import { useConversationOptions } from "./use-conversation-options";
import { loadServerEntryContext } from "../server-entry-context";

export function useChatPaneState(props: ChatPaneProps, actions: ChatPaneActions) {
  const {
  provider,
  mode,
  model,
  initialModel,
  uiMode = "simple",
  voice,
  approvalMode = "manual",
  onApprovalModeChange,
  openConversationId,
  openProjectId,
  openAgentId,
  openConversationAgentId,
  openNonce,
  onLaunchAgent,
  seedText,
  seedAutoSend,
  seedNewChat,
  seedNonce,
  onSeedConsumed,
  mobileBottomSlot,
  active,
  mobileProviderNav,
  onCloseDrawer,
  assistantRequestOpenRequestId,
  assistantRequestPrompt,
  assistantRequestSubmit,
  assistantRequestServerEntries,
  assistantRequestNonce,
  onAssistantRequestConsumed,
  } = props;
  const reloadList: ChatPaneActions["reloadList"] = (...args) => actions.reloadList(...args);
  const send: ChatPaneActions["send"] = (...args) => actions.send(...args);
  const openConversation: ChatPaneActions["openConversation"] = (...args) => actions.openConversation(...args);
  const newConversation: ChatPaneActions["newConversation"] = (...args) => actions.newConversation(...args);
  const isMobile = useIsMobile();
  const i18n = useAssistantI18n();
  // Extended chatTab binding — gives type-safe access to new keys not yet in
  // the AssistantMessages TS type without widening the whole type.
  const ct = i18n.chatTab as Record<string, any>;
  // Restore the pane's UI state saved when the drawer was last closed (the
  // DrawerContent unmounts on close, so these would otherwise reset). Read once
  // at mount — subsequent changes are mirrored back via the effects below.
  const savedUi = useRef(chatUiState.getPane(provider)).current;
  const [convos, setConvos] = useState<ConversationMeta[]>([]);
  const [projects, setProjects] = useState<AssistantProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(savedUi.activeId ? null : savedUi.currentProjectId); // null = chats sueltos
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(savedUi.currentAgentId); // null = sin agente
  const [agents, setAgents] = useState<AssistantAgent[]>([]);
  const [roles, setRoles] = useState<AssistantAgentRole[]>([]);
  // Root conversation-list tab: "agents" = chats bound to an agent (leaders +
  // delegated workers); "loose" = everything else (loose + project chats).
  // Starts on the user's preferred tab (settings modal → default tabs).
  const [convScope, setConvScope] = useState<"agents" | "loose">(() => uiPrefs.get().defaultConversationsTab);
  // Projects-container tab: "projects" = the project tree; "leaders" = the
  // project/team leader agents (one entry per work group).
  const [projScope, setProjScope] = useState<"projects" | "leaders">(() => uiPrefs.get().defaultAgentsTab);
  // Collapsed/expanded state of the two labelled sidebar sections, persisted in
  // `uiPrefs` (localStorage, `lxp.assistant.*` prefix) and shared across every
  // mounted ChatPane instance via its pub/sub — so collapsing in one provider
  // pane reflects in the others. Defaults: Projects CLOSED, Conversations OPEN.
  const projectsSectionOpen = useSyncExternalStore(
    uiPrefs.subscribe,
    () => uiPrefs.get().projectsSectionOpen,
    () => false,
  );
  const conversationsSectionOpen = useSyncExternalStore(
    uiPrefs.subscribe,
    () => uiPrefs.get().conversationsSectionOpen,
    () => true,
  );
  const toggleProjectsSection = useCallback(
    () => uiPrefs.set({ projectsSectionOpen: !uiPrefs.get().projectsSectionOpen }),
    [],
  );
  const toggleConversationsSection = useCallback(
    () => uiPrefs.set({ conversationsSectionOpen: !uiPrefs.get().conversationsSectionOpen }),
    [],
  );
  // Which agent threads are expanded in the "Agentes IA" list (Gmail-style
  // grouping). Empty = all collapsed; keyed by agentId.
  const [expandedConvAgents, setExpandedConvAgents] = useState<Set<string>>(() => new Set());
  // ACCORDION: opening a group closes the other groups of the SAME level
  // (`siblings` = ids sharing the row, passed by the tree renderer).
  const toggleConvAgentGroup = useCallback((agentId: string, siblings?: Iterable<string>) => {
    setExpandedConvAgents((prev) => accordionToggle(prev, agentId, siblings));
  }, []);
  // Which project folders are expanded in the "Sueltos / Proyectos" recursive
  // tree. Keyed by projectId (independent of the agent set). EVERY folder —
  // project folders AND the synthetic "Chats sueltos" folder (LOOSE_GROUP_ID) —
  // starts COLLAPSED; the branch holding the active conversation is auto-expanded
  // by the effect below (see `computeExpandChain`).
  const [expandedConvProjects, setExpandedConvProjects] = useState<Set<string>>(() => new Set());
  const toggleConvProjectGroup = useCallback((projectId: string, siblings?: Iterable<string>) => {
    setExpandedConvProjects((prev) => accordionToggle(prev, projectId, siblings));
  }, []);
  // When the active chat is a delegated worker, the leader chat that spawned it
  // (so the header can offer "back to leader"). Null otherwise.
  const [leaderConv, setLeaderConv] = useState<{ conversationId: string; leaderAgentId: string } | null>(null);
  const [modalProject, setModalProject] = useState<AssistantProject | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; label: string } | null>(null);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(savedUi.activeId);
  // Authoritative metadata of the active conversation, fetched directly by id so
  // the chat header always knows which project it belongs to — even when the
  // sidebar list is scoped to another project (or the chat was opened from the
  // Dashboard) and therefore doesn't contain this conversation. Null = none yet.
  const [activeConvMeta, setActiveConvMeta] = useState<ConversationMeta | null>(null);
  // Upstream provider session id of the active chat (shown in the top bar). Only
  // CLI providers that resume (claude/codex) have one; null otherwise.
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Context-window occupancy for the active chat (drives the meter + the
  // "Compactar" button). Null until fetched / for ephemeral (unsaved) chats.
  const [ctx, setCtx] = useState<ConversationContext | null>(null);
  const [compacting, setCompacting] = useState(false);
  const [listOpen, setListOpen] = useState(() => typeof document === "undefined" || !document.querySelector("[data-workspace-shell]"));
  // On mobile the chats/projects list is a right-side drawer overlay.
  const [mobileListOpen, setMobileListOpen] = useState(false);
  // Mobile-only "+" popover in the composer pill: groups the side-menu toggle
  // and the attach action (which on desktop are two loose left-side icons).
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  // El botón inline "Terminal" del composer (fila de selectores) reutiliza el
  // mismo drawer flotante que el FAB via `window.__lxpFloatingTerminalAPI`. Ese
  // API solo existe si el módulo terminal está habilitado y el usuario tiene
  // permiso (FloatingTerminalDrawer no se monta si no). Reflejamos su presencia
  // para no pintar un botón muerto a quien no puede abrir el terminal.
  const [terminalAvailable, setTerminalAvailable] = useState(false);
  useEffect(() => {
    const check = () => setTerminalAvailable(typeof window !== "undefined" && !!window.__lxpFloatingTerminalAPI);
    check();
    // El API lo registra FloatingTerminalDrawer en su propio useEffect de
    // montaje; re-chequeamos poco después para captar ese registro asíncrono.
    const t = window.setTimeout(check, 300);
    document.addEventListener("astro:page-load", check);
    return () => { window.clearTimeout(t); document.removeEventListener("astro:page-load", check); };
  }, []);
  // Publica al FAB flotante de terminal si el scope visible del asistente es
  // "Agentes IA": ese FAB (esquina inferior derecha) NO debe mostrarse mientras
  // el chat activo está en el tab de agentes. Solo la instancia VISIBLE (`active`)
  // manda la señal — hay una ChatPane montada por proveedor y solo una se pinta.
  // `setFabAgentsScopeActive` deduplica, así que cambiar de "sueltos" a "agentes"
  // no genera un flash del FAB. El cleanup (al dejar de ser visible, cambiar de
  // tab o desmontarse el drawer) resetea a false → el FAB reaparece. El caso de
  // la vista dedicada `/panel/assistant` ya lo cubre FloatingTerminalDrawer por
  // path; esta señal cubre el asistente FLOTANTE sobre cualquier otro módulo,
  // donde el path no cambia.
  useEffect(() => {
    if (!active) return;
    setFabAgentsScopeActive(Boolean(activeConvMeta?.agentId || currentAgentId));
    return () => setFabAgentsScopeActive(false);
  }, [active, activeConvMeta?.agentId, currentAgentId]);
  const [draft, setDraft] = useState(savedUi.draft);
  const [attachments, setAttachments] = useState<ChatAttachment[]>(savedUi.attachments);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachSourceOpen, setAttachSourceOpen] = useState(false);
  // Office connectors (Google Drive, …): connected ones unlock a browse button
  // next to the attach button. Catalog + status is instance-level (panel host).
  const [connectors, setConnectors] = useState<OfficeConnector[]>([]);
  const [connectorsManagerOpen, setConnectorsManagerOpen] = useState(false);
  const [browseConnectorId, setBrowseConnectorId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  // True while a conversation's messages are being fetched (chat switch).
  const [chatLoading, setChatLoading] = useState(false);
  // When true the next send() will pop the last 2 turns (stopped user + assistant)
  // before dispatching — used by the edit-last-message flow.
  const [editPendingTrim, setEditPendingTrim] = useState(false);
  // True while the press-and-hold voice recorder is active (recording or staged).
  // The composer textarea/attach/stop/send collapse and the live waveform takes
  // the row until the user sends the clip (→ transcribe → send) or cancels it.
  const [voiceActive, setVoiceActive] = useState(false);
  // Slash-command autocomplete (C1): open + highlighted index. The dropdown is
  // shown while the draft starts with "/" and matches catalog commands.
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  // In-chat model override (composer selector). "" = Auto (the backend
  // auto-router picks the model/effort per turn). A non-empty value forces that
  // model for the next turns. Reset whenever the provider changes, since the
  // model catalog is per-provider.
  const [verifiedModelOptions, setVerifiedModelOptions] = useState<string[] | null>(null);
  useEffect(() => {
    let live = true;
    setVerifiedModelOptions(null);
    if (!PROVIDER_MODELS[provider as AssistantProviderId]) return;
    void assistantApi.getProviderModels(provider as AssistantProviderId)
      .then((catalog) => { if (live && catalog.verified) setVerifiedModelOptions(catalog.models); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [provider]);
  const modelOptions = verifiedModelOptions ?? PROVIDER_MODELS[provider as AssistantProviderId] ?? [];
  const initialModelFor = (agentId: string | null, convId: string | null) =>
    !agentId && !convId && initialModel && modelOptions.includes(initialModel) ? initialModel : "";
  const conversationOptions = useConversationOptions({
    id: activeId, provider, active: !!active, defaultApproval: approvalMode,
    defaultEffort: props.initialEffort,
    defaultModel: initialModelFor(currentAgentId, null), onRestoreProvider: props.onRestoreProvider,
  });
  const { selectedModel, setSelectedModel, selectedEffort, setSelectedEffort } = conversationOptions;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  // Whether the view is "stuck" to the bottom. True while the user is at (or
  // near) the latest message, so any content growth re-pins them. Goes false
  // when they scroll up to read history, so we don't yank them back down.
  const stickToBottomRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Drag & drop de archivos sobre el contenedor del chat. `dragActive` pinta el
  // overlay; `dragDepthRef` cuenta enter/leave para no parpadear al pasar sobre
  // los hijos (cada hijo dispara su propio dragenter/dragleave al burbujear).
  const [dragActive, setDragActive] = useState(false);
  const dragDepthRef = useRef(0);
  // Attachment support follows the active model — the manually selected one if
  // set, else the provider's configured model. (The auto-router floors the run
  // to a vision-capable model server-side when attachments exist.)
  const support = attachmentSupport(provider, mode, selectedModel || model);

  const refreshConnectors = useCallback(async () => {
    try {
      setConnectors(await assistantConnectorsApi.list());
    } catch {
      /* connectors are optional — ignore load failures (e.g. module gated) */
    }
  }, []);
  useEffect(() => { if (active && (attachSourceOpen || plusMenuOpen || connectorsManagerOpen || browseConnectorId)) void refreshConnectors(); }, [refreshConnectors, active, attachSourceOpen, plusMenuOpen, connectorsManagerOpen, browseConnectorId]);

  const connectedConnectors = useMemo(() => connectors.filter((c) => c.connected), [connectors]);
  const browseConnector = connectors.find((c) => c.id === browseConnectorId) ?? null;
  // Voice is API-mode only in v1 (CLI keeps its raw terminal). STT records on the
  // mic button → server transcription → composer; TTS plays an assistant reply.
  const sttAvailable = voice?.capabilities?.stt === "openai";
  // TTS playback ("escuchar respuesta") is offered on any completed assistant
  // reply — CLI included — whenever voice is enabled and a TTS-capable key
  // exists (`capabilities.tts` already encodes the `voice.enabled` master
  // switch). It only synthesizes the final text, independent of the chat engine.
  const ttsAvailable = !!voice?.capabilities?.tts;
  // Auto-speak the latest reply stays API-mode only (the CLI keeps its raw
  // terminal and shouldn't start talking on its own).
  const autoSpeak = mode === "api" && ttsAvailable && !!voice?.autoSpeak;
  // Hold-to-record voice button availability. Server STT (api mode) gives the
  // best transcription; otherwise we fall back to the browser's Web Speech API
  // for the transcript — so the press-and-hold + waveform works in CLI mode too.
  // The plain dictate button is only used when getUserMedia/MediaRecorder is
  // unavailable (rare, non-secure contexts).
  const canRecordAudio = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
  const webSpeechAvailable = typeof window !== "undefined"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  // Master gate for the audio-input button: voice must be enabled in
  // Proveedores → Todos (VoiceSettings `enabled`). When off, NO audio button is
  // shown — regardless of browser Web Speech support or configured STT keys
  // (`capabilities` is key-derived and independent of this toggle).
  const voiceEnabled = !!voice?.enabled;
  const canHoldRecord = voiceEnabled && canRecordAudio;

  // Prefill the composer when a seed arrives (e.g. the mail inbox hands off a
  // depuration prompt). We only fill the draft + focus — the user reviews and
  // sends, so no tokens are spent without an explicit click.
  useEffect(() => {
    const text = (seedText ?? "").trim();
    if (!text) return;
    if (seedAutoSend) {
      // Files AI input (and similar) want the question sent immediately, in a
      // fresh chat — no extra Enter from the user.
      onSeedConsumed?.();
      // Si el seed marca `newChat`, también forzamos conversación NORMAL
      // (agentId/projectId null) — el bridge `lxp:assistant:request v1` usa
      // este flag para garantizar que el request externo NO herede el
      // currentAgentId de un pane agent-bound.
      void send(text, {
        forceNew: !!seedNewChat,
        ...(seedNewChat ? { agentIdOverride: null, projectIdOverride: null } : {}),
      });
      return;
    }
    setDraft(text);
    onSeedConsumed?.();
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedText, seedNonce]);

  // ── Bridge `lxp:assistant:request v1` ─────────────────────────────────────
  // El ChatTab entrega este flag SOLO al provider resuelto. Garantías:
  //  1) Resetear activeId/currentAgentId/currentProjectId/draft/adjuntos ANTES
  //     de cualquier efecto de restauración. El `chatUiState.patchPane` se hace
  //     primero, antes de `setActiveId(null)` local, para que el efecto de
  //     persistencia (que escribe el snapshot al store) no guarde los valores
  //     viejos tras el rerender.
  //  2) Si `submit === "auto"`, crear conversación con agentId:null y projectId:null
  //     EXPLÍCITOS y enviar. Si `submit === "prefill"`, solo rellenar composer
  //     y enfocar; NUNCA invocar send().
  //  3) Marcar el requestId como consumido (Set local) para que un rerender no
  //     duplique el envío.
  //  4) Limpiar el slot en el panel (`onAssistantRequestConsumed`).
  const assistantRequestConsumedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const requestId = assistantRequestOpenRequestId;
    const prompt = (assistantRequestPrompt ?? "").trim();
    const submit = assistantRequestSubmit;
    if (!requestId || !prompt || !submit) return;
    if (assistantRequestConsumedRef.current.has(requestId)) return;
    assistantRequestConsumedRef.current.add(requestId);

    // (1) Reset del pane state — ANTES de cualquier setState que dispare un
    // efecto de restauración. El patch del store se hace primero; después el
    // setState local rehidrata los valores vacíos.
    chatUiState.patchPane(provider, {
      activeId: null,
      currentAgentId: null,
      currentProjectId: null,
      draft: "",
      attachments: [],
    });
    setActiveId(null);
    setCurrentAgentId(null);
    setCurrentProjectId(null);
    // External prompts always start a loose conversation. Keep the sidebar on
    // the list that owns it, even if the previous chat used a custom agent.
    pendingScopeSyncRef.current = null;
    setConvScope("loose");
    setDraft("");
    setAttachments([]);
    setAttachError(null);

    if (submit === "auto") {
      // (2a) Crear conversación NORMAL con agentId/projectId null EXPLÍCITOS.
      // El backend ya acepta null (no aplica fallback a previousAgentId).
      (async () => {
        let prepared: Awaited<ReturnType<typeof loadServerEntryContext>> | null = null;
        if (assistantRequestServerEntries?.length) {
          try { prepared = await loadServerEntryContext(assistantRequestServerEntries, support.accepts); }
          catch (error) {
            if (error instanceof Error && error.message === "SERVER_SCOPE_CHANGED") {
              onAssistantRequestConsumed?.();
              return;
            }
            prepared = { context: `No se pudo preparar la selección de Archivos: ${error instanceof Error ? error.message : String(error)}`, attachments: [], errors: [] };
          }
        }
        const message = prepared ? `${prompt}\n\n${prepared.context}` : prompt;
        try {
          const meta = await assistantConversationsApi.create(provider, prompt, null, null);
          // (3) Idempotencia: una vez creado, marcamos consumido.
          setActiveId(meta.id);
          // Forzar reset del pane snapshot (activeId aún null en el state pero
          // el chat engine adoptará la nueva conv). El engine opera por key =
          // conversationId, así que sólo necesitamos apuntar activeId y enviar.
          chatUiState.patchPane(provider, { activeId: meta.id, currentAgentId: null, currentProjectId: null });
          // (4) Notificar al panel para que limpie el slot.
          onAssistantRequestConsumed?.();
          // Disparar send con agentId:null/projectId:null EXPLÍCITOS, usando
          // la conversación recién creada (evita que send cree otra).
          void send(message, {
            conversationIdOverride: meta.id,
            agentIdOverride: null,
            projectIdOverride: null,
            attachmentsOverride: prepared?.attachments,
          });
        } catch {
          // The bridge must not discard the user's question when the explicit
          // conversation create call fails. The normal send path can retry
          // creation and still display the turn/error in the chat.
          onAssistantRequestConsumed?.();
          void send(message, {
            forceNew: true,
            agentIdOverride: null,
            projectIdOverride: null,
            attachmentsOverride: prepared?.attachments,
          });
        }
      })();
    } else {
      // (2b) prefill: solo composer + foco, NUNCA send.
      if (assistantRequestServerEntries?.length) {
        void loadServerEntryContext(assistantRequestServerEntries, support.accepts).then((prepared) => {
          setDraft(`${prompt}\n\n${prepared.context}`);
          setAttachments(prepared.attachments);
        }).catch((error) => setAttachError(error instanceof Error ? error.message : String(error)));
      } else setDraft(prompt);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
      onAssistantRequestConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantRequestNonce]);

  const agentDraftHandoff = useRef(false);
  // The Dashboard requested this conversation be opened in this pane, OR the
  // Agents tab requested a fresh chat bound to a custom agent (no conversation id
  // yet → start new, remember the agent so the first send binds it).
  useEffect(() => {
    if (openConversationId) {
      // Select the chat's project (parent or child) so the list shows it in
      // context — the Dashboard passes the conversation's projectId. `undefined`
      // means "not provided" (don't touch); `null` means an explicit loose chat.
      if (openProjectId !== undefined) setCurrentProjectId(openProjectId);
      // Select the conversation-list tab the chat belongs to. When the Dashboard
      // knows the chat's owning agent, switch synchronously (agent-bound → the
      // "Agentes IA" root list; otherwise "Sueltos / Proyectos") so the sidebar
      // never lags on the async meta fetch. `pendingScopeSyncRef` stays armed as
      // a fallback for entries that don't pass the hint (the meta-driven effect
      // below refines it once the authoritative meta lands).
      if (openConversationAgentId) {
        setConvScope("agents");
      } else if (openConversationAgentId === null) {
        setConvScope("loose");
      }
      pendingScopeSyncRef.current = openConversationId;
      void openConversation(openConversationId);
    } else if (openAgentId) {
      const agentProjectId = openProjectId !== undefined ? openProjectId : currentProjectId;
      const agentDraft = props.openAgentDraft;
      agentDraftHandoff.current = true;
      // Persist the agent-bound draft state BEFORE the provider-pane restore
      // effect runs, otherwise the stale saved snapshot can immediately clobber
      // `currentAgentId` back to null on the same activation edge.
      chatUiState.patchPane(provider, {
        activeId: null,
        draft: agentDraft?.text ?? "",
        currentProjectId: agentProjectId,
        currentAgentId: openAgentId,
        attachments: agentDraft?.attachments ?? [],
      });
      newConversation({ preserveAgent: false });
      setCurrentProjectId(agentProjectId);
      setCurrentAgentId(openAgentId);
      setDraft(agentDraft?.text ?? "");
      setAttachments(agentDraft?.attachments ?? []);
      conversationOptions.resetNew("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNonce]);

  // On (re)mount with a restored open conversation — after a full page reload
  // (F5, where the engine starts empty) or reopening the drawer (engine kept the
  // chat) — re-attach to it instead of showing a frozen/empty pane. If the
  // engine already holds it, just resume any interrupted stream; otherwise
  // reload its history and adopt any still-running backend execution.
  useEffect(() => {
    if (!active) return;
    const id = savedUi.activeId;
    if (!id) return;
    if (deadIdsRef.current.has(id)) { purgeDeadConversation(id); return; }
    if (chatEngine.get(id)) {
      if (!chatEngine.isStreaming(id)) void chatEngine.resume(id);
    } else {
      void openConversation(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-grow the composer between a sane minimum and a max, then scroll
  // internally. The minimum keeps the field tall enough that the placeholder is
  // legible on mobile (where `scrollHeight` of an empty textarea can collapse).
  function autosizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 32), 160)}px`;
  }
  useEffect(() => {
    autosizeTextarea();
  }, [draft]);

  // Mirror the pane's UI state into the module-level store so it survives the
  // DrawerContent unmounting on close and is restored verbatim on reopen.
  // SKIP the write on the activation edge (inactive → active): the restore effect
  // below is about to load this pane's canonical snapshot, and our local state
  // vars still hold the STALE pre-activation values on this pass — writing them
  // would clobber a snapshot just handed to us (e.g. the provider switch carrying
  // the open chat). The next render (after restore's setState) persists the real
  // values normally.
  const wasActiveRef = useRef(active);
  useEffect(() => {
    const justActivated = active && !wasActiveRef.current;
    wasActiveRef.current = active;
    // The open-agent effect just handed a new draft to the provider. This
    // render still holds the old state; don't overwrite that handoff before
    // the provider restore effect below consumes it (including initial mount).
    if (agentDraftHandoff.current) { agentDraftHandoff.current = false; return; }
    if (!active || justActivated) return;
    chatUiState.patchPane(provider, { activeId, draft, currentProjectId, currentAgentId, attachments });
  }, [active, provider, activeId, draft, currentProjectId, currentAgentId, attachments]);

  // Restore the snapshot for THIS provider when switching tabs. Each provider
  // keeps its own active conversation/draft to avoid cross-provider bleed.
  useEffect(() => {
    if (!active) return;
    const paneState = chatUiState.getPane(provider);
    setDraft(paneState.draft);
    setAttachments(paneState.attachments);
    setCurrentProjectId(paneState.activeId ? null : paneState.currentProjectId);
    setCurrentAgentId(paneState.currentAgentId);
    if ((paneState.activeId ?? null) !== activeId) {
      setActiveId(paneState.activeId ?? null);
      setHasMore(false);
      setLoadedCount(0);
      if (paneState.activeId) {
        if (deadIdsRef.current.has(paneState.activeId)) {
          purgeDeadConversation(paneState.activeId);
        } else if (chatEngine.get(paneState.activeId)) {
          if (!chatEngine.isStreaming(paneState.activeId)) void chatEngine.resume(paneState.activeId);
        } else {
          void openConversation(paneState.activeId);
        }
      }
    }
    void reloadList(search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, provider]);

  // The engine key for the currently displayed chat in THIS pane.
  const newKeyRef = useRef<string>(`new:${provider}:${Math.random().toString(36).slice(2)}`);
  const chatKey = activeId ?? newKeyRef.current;

  // Conversation ids confirmed deleted server-side (HTTP 404). A restored/open
  // tab pointing at one of these is "dead": its meta/messages fetches 404 and,
  // because the open tab lives in sessionStorage, it gets re-restored on EVERY
  // reload — leaving the pane stuck (the "no salen conversaciones" lock). We
  // record the id here so it's purged exactly ONCE and never re-fetched (no
  // refetch loop), then drop it from the engine, the persisted pane snapshot,
  // the sidebar list and, if it's the visible tab, fall back to a blank chat.
  const deadIdsRef = useRef<Set<string>>(new Set());
  // Set to a conversation id when it's opened via a Dashboard deep-link; the
  // meta-driven effect below consumes it once to auto-select that chat's tab.
  const pendingScopeSyncRef = useRef<string | null>(null);
  // Mirror of `activeId` readable synchronously from async callbacks (the purge
  // runs from fetch `.catch`/`await` boundaries where the closed-over `activeId`
  // may be stale).
  const activeIdRef = useRef<string | null>(activeId);
  activeIdRef.current = activeId;
  function purgeDeadConversation(id: string) {
    if (!id) return;
    deadIdsRef.current.add(id);
    // Drop the engine's in-memory state for the vanished chat.
    chatEngine.clear(id);
    // Stop it being restored on the next reload / drawer reopen: clear it from
    // THIS provider's persisted pane snapshot (sessionStorage) when it's the
    // saved open tab there.
    if ((chatUiState.getPane(provider).activeId ?? null) === id) {
      chatUiState.patchPane(provider, { activeId: null, currentProjectId: null });
    }
    // Remove it from the sidebar list if it slipped in.
    setConvos((list) => list.filter((c) => c.id !== id));
    // If the dead chat is the one this pane is showing, reset to a blank new
    // chat (selecting "sin chat"); otherwise leave the current view untouched.
    if (activeIdRef.current === id) {
      setActiveId(null);
      setActiveConvMeta(null);
      setHasMore(false);
      setLoadedCount(0);
    }
  }

  // Tell the engine which chat is on screen (only the visible pane). When a run
  // settles on the chat the user is already viewing, the engine skips the red
  // "sin revisar" dot — the result was seen live. Cleared on tab switch / close.
  useEffect(() => {
    if (!active) return;
    chatEngine.setActiveView(chatKey);
    return () => chatEngine.clearActiveView(chatKey);
  }, [active, chatKey]);

  // Subscribe to the engine so streaming updates re-render this pane.
  useSyncExternalStore(chatEngine.subscribe, chatEngine.getVersion, chatEngine.getVersion);
  const live = chatEngine.get(chatKey);
  const turns: ChatTurn[] = live?.turns ?? [];
  const streaming = chatEngine.isStreaming(chatKey);
  // Team delegation board (leader chats): tasks this conversation's agent
  // assigned to subordinates — live cards under the thread.
  const teamTasks = chatEngine.teamTasksOf(chatKey);
  // Group the delegation tasks by the leader turn that spawned them, so EACH
  // delegating turn shows its OWN board inline (a long leader chat can delegate
  // in several turns at different times — each turn must render only the tasks
  // it originated, with its own "N de M" counter). A settled assistant turn's
  // `createdAt` is its COMPLETION time (see chat-engine `done` → timing), and
  // `team.assign` runs DURING the turn, so each task's delegating turn is the
  // FIRST settled assistant turn whose completion time is at/after the task's
  // creation. (Grouping by "most recent turn started before the task" is not
  // possible from this data — turns carry only a finish timestamp — and would
  // misfile the very first delegation, so we key off the finish time instead.)
  // Tasks that resolve to no turn — a LIVE run whose delegating turn hasn't
  // settled a timestamp yet, or a history thread with unusable timestamps —
  // fall into `unanchored` and trail the thread at the bottom (no regression).
  const teamBoardGroups = useMemo(() => {
    const byTurn = new Map<number, TeamTaskView[]>();
    const unanchored: TeamTaskView[] = [];
    for (const task of teamTasks) {
      const ms = Date.parse(task.createdAt);
      const idx = Number.isNaN(ms)
        ? -1
        : turns.findIndex(
            (t) =>
              t.role === "assistant" &&
              !t.compacted &&
              typeof t.createdAt === "number" &&
              t.createdAt >= ms,
          );
      if (idx < 0) {
        unanchored.push(task);
        continue;
      }
      const arr = byTurn.get(idx);
      if (arr) arr.push(task);
      else byTurn.set(idx, [task]);
    }
    return { byTurn, unanchored };
  }, [teamTasks, turns]);
  // A background run for this conversation that this client isn't streaming
  // locally (discovered after a reload) — drives the "en background" banner.
  const backgroundRunning = chatEngine.isBackgroundRunning(chatKey);

  // Fetch the upstream provider session id for the active chat (shown in the
  // top bar). Refetched when the run settles (`streaming` → false) since a fresh
  // chat only mints/persists its session id after the first turn completes.
  useEffect(() => {
    if (!active) return;
    if (!activeId) { setSessionId(null); return; }
    if (streaming) return;
    let cancelled = false;
    void assistantConversationsApi
      .session(activeId, provider)
      .then((r) => { if (!cancelled) setSessionId(r.sessionId); })
      .catch(() => { if (!cancelled) setSessionId(null); });
    return () => { cancelled = true; };
  }, [active, activeId, streaming, provider]);

  useEffect(() => {
    const meta = conversationOptions.meta;
    setActiveConvMeta(meta);
    if (meta?.id === activeId) {
      // A legacy agent mailbox has no persisted project. Its navigation scope
      // is inferred by ChatSidebar from the owning team; late metadata must
      // not erase that selection after the history row already revealed it.
      // The send path still uses meta.projectId (null), never this UI scope.
      if (meta.projectId || !meta.agentId) setCurrentProjectId(meta.projectId ?? null);
      setCurrentAgentId(meta.agentId ?? null);
    }
  }, [conversationOptions.meta, activeId]);

  // Dashboard deep-link: once the opened chat's authoritative meta lands, select
  // the conversation-list tab it belongs to — "agents" for agent-bound chats,
  // "loose" (+ its project) otherwise — so the sidebar shows the chat in the
  // right tab instead of whatever was active. Reuses the shared category
  // derivation; runs ONCE per deep-link (guarded by the ref).
  useEffect(() => {
    const pendingId = pendingScopeSyncRef.current;
    if (!pendingId || !activeConvMeta || activeConvMeta.id !== pendingId) return;
    pendingScopeSyncRef.current = null;
    const category = categorizeConversation(activeConvMeta);
    setConvScope(scopeForCategory(category));
    if (category === "projects") setProjScope("projects");
  }, [activeConvMeta]);

  // If the active chat is a delegated WORKER chat, resolve the leader chat that
  // spawned it so the header can offer a "back to leader" button. Only queried
  // for agent-bound chats (a loose/project chat is never a worker). Fail-open:
  // any error just hides the affordance.
  useEffect(() => {
    if (!active) return;
    if (!activeId) { setLeaderConv(null); return; }
    const meta = activeConvMeta?.id === activeId ? activeConvMeta : convos.find((c) => c.id === activeId) ?? null;
    if (!meta?.agentId) { setLeaderConv(null); return; }
    let cancelled = false;
    void teamApi
      .byWorker(activeId)
      .then((t) => {
        if (cancelled) return;
        setLeaderConv(
          t && t.leaderConversationId !== activeId
            ? { conversationId: t.leaderConversationId, leaderAgentId: t.leaderAgentId }
            : null,
        );
      })
      .catch(() => { if (!cancelled) setLeaderConv(null); });
    return () => { cancelled = true; };
  }, [active, activeId, activeConvMeta, convos]);

  // Context-window occupancy for the active chat. Refetched when the chat
  // changes, when a run settles (the new turns grew the context, and a send
  // past the threshold may have auto-compacted), and on the global

  return {
    conversationOptions,
    approvalMode: conversationOptions.approvalMode,
    onApprovalModeChange: conversationOptions.changeApproval,
    activeConvMeta,
    activeId,
    activeIdRef,
    agents,
    assistantRequestConsumedRef,
    attachError: attachError ?? conversationOptions.error,
    attachSourceOpen,
    attachments,
    autoSpeak,
    autosizeTextarea,
    backgroundRunning,
    browseConnector,
    browseConnectorId,
    canHoldRecord,
    canRecordAudio,
    chatKey,
    chatLoading,
    compacting,
    confirmDelete,
    connectedConnectors,
    connectors,
    connectorsManagerOpen,
    contentRef,
    convScope,
    conversationsSectionOpen,
    convos,
    ct,
    ctx,
    currentAgentId,
    currentProjectId,
    deadIdsRef,
    draft,
    dragActive,
    dragDepthRef,
    editPendingTrim,
    expandedConvAgents,
    expandedConvProjects,
    fileInputRef,
    hasMore,
    i18n,
    initialModelFor,
    isMobile,
    leaderConv,
    listOpen,
    live,
    loadedCount,
    loadingMore,
    mobileListOpen,
    modalProject,
    modelOptions,
    newKeyRef,
    pendingScopeSyncRef,
    plusMenuOpen,
    projScope,
    projects,
    projectsSectionOpen,
    purgeDeadConversation,
    refreshConnectors,
    roles,
    savedUi,
    scrollerRef,
    search,
    selectedModel,
    selectedEffort,
    sessionId,
    setActiveConvMeta,
    setActiveId,
    setAgents,
    setAttachError,
    setAttachSourceOpen,
    setAttachments,
    setBrowseConnectorId,
    setChatLoading,
    setCompacting,
    setConfirmDelete,
    setConnectors,
    setConnectorsManagerOpen,
    setConvScope,
    setConvos,
    setCtx,
    setCurrentAgentId,
    setCurrentProjectId,
    setDraft,
    setDragActive,
    setEditPendingTrim,
    setExpandedConvAgents,
    setExpandedConvProjects,
    setHasMore,
    setLeaderConv,
    setListOpen,
    setLoadedCount,
    setLoadingMore,
    setMobileListOpen,
    setModalProject,
    setPlusMenuOpen,
    setProjScope,
    setProjects,
    setRoles,
    setSearch,
    setSelectedModel,
    setSelectedEffort,
    setSessionId,
    setSlashIndex,
    setSlashOpen,
    setTerminalAvailable,
    setVoiceActive,
    slashIndex,
    slashOpen,
    stickToBottomRef,
    streaming,
    sttAvailable,
    support,
    teamBoardGroups,
    teamTasks,
    terminalAvailable,
    textareaRef,
    toggleConvAgentGroup,
    toggleConvProjectGroup,
    toggleConversationsSection,
    toggleProjectsSection,
    ttsAvailable,
    turns,
    voiceActive,
    voiceEnabled,
    wasActiveRef,
    webSpeechAvailable,
  };
}
