// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * ChatPane orchestrator — TRAMO 3/3 (handlers: open/new/delete/rename/pin/send/
 * edit/attach/drag…). VERBATIM slice (orig lines 2713-3155). Contains NO React
 * hooks, so it does not affect the flattened hook sequence; receives all state/
 * derived via `s`/`d` and returns the real handlers.
 */
import { resolveTargetScope, scopeHeaders } from "@/lib/api-client";
import { chatInputLocked } from "../chat-engine/input-lock";
import {
  assistantConversationsApi,
  ConversationNotFoundError,
  type ChatAttachment,
} from "../assistant-api";
import { chatEngine, historyTurns } from "../chat-engine";
import { prepareImageForUpload } from "../image-compress";
import { chatUiState } from "../chat-ui-state";
import { preloadMonaco } from "../CodeBlock";
import { PAGE, MAX_ATTACH_BYTES, MAX_DECODE_BYTES, formatMb, buildAgentMessages } from "./helpers";
import { type ChatPaneProps } from "./vm-types";
import { type useChatPaneState } from "./use-chat-pane-state";
import { type useChatPaneDerived } from "./use-chat-pane-derived";

export function useChatPaneActions(props: ChatPaneProps, s: ReturnType<typeof useChatPaneState>, d: ReturnType<typeof useChatPaneDerived>) {
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
  assistantRequestNonce,
  onAssistantRequestConsumed,
  } = props;
  const {
    activeId,
    attachments,
    autosizeTextarea,
    chatKey,
    confirmDelete,
    convos,
    ct,
    currentAgentId,
    deadIdsRef,
    draft,
    dragDepthRef,
    editPendingTrim,
    fileInputRef,
    hasMore,
    initialModelFor,
    live,
    loadedCount,
    loadingMore,
    newKeyRef,
    purgeDeadConversation,
    search,
    selectedModel,
    setActiveId,
    setAttachError,
    setAttachSourceOpen,
    setAttachments,
    setChatLoading,
    setConfirmDelete,
    setConvos,
    setCurrentAgentId,
    setDraft,
    setDragActive,
    setEditPendingTrim,
    setHasMore,
    setLoadedCount,
    setLoadingMore,
    setMobileListOpen,
    setSelectedModel,
    setSelectedEffort,
    setSlashIndex,
    setSlashOpen,
    slashIndex,
    slashOpen,
    streaming,
    support,
    textareaRef,
    turns,
  } = s;
  const {
    applySlashCommand,
    currentAgent,
    effectiveProjectId,
    queued,
    reloadList,
    slashMatches,
  } = d;
  async function openConversation(id: string) {
    void preloadMonaco().catch(() => {});
    // A prior "dead" verdict can be a STALE / transient 404 (e.g. a meta fetch
    // that raced a backend restart, or a chat whose meta hadn't persisted yet) —
    // it must NOT permanently block opening. Clear the mark and re-attempt; the
    // messages() fetch below is the real authority for whether the chat exists.
    deadIdsRef.current.delete(id);
    s.conversationOptions.select(id);
    setActiveId(id);
    // Persist the open id into the pane snapshot SYNCHRONOUSLY. On the very first
    // load the "persist activeId" effect skips the activation edge (justActivated),
    // so without this the restore effect would still read the STALE snapshot and
    // reset activeId back to null — the chat would flash empty ("nuevo chat") on
    // the first open, then work on later clicks. Writing it here keeps the
    // snapshot consistent so the restore effect re-affirms (never clobbers) it.
    chatUiState.patchPane(provider, { activeId: id });
    // Restore the agent this conversation is bound to (if any) from its meta so
    // continuing the thread keeps applying the agent's prompt/tools/provider.
    setCurrentAgentId(convos.find((c) => c.id === id)?.agentId ?? null);
    setMobileListOpen(false);
    setEditPendingTrim(false);
    // The composer (draft + staged attachments) belongs to whatever chat the
    // user was just in. Switching conversations must not carry it over into the
    // newly opened thread — clear it so each chat starts with an empty composer.
    setDraft("");
    setAttachments([]);
    setAttachError(null);
    // Looking at the conversation clears its "sin revisar" flag (in-memory +
    // server). Optimistically clear the persisted flag in the local list too so
    // the red dot disappears immediately, before the next list refresh.
    chatEngine.markReviewed(id);
    setConvos((list) => list.map((c) => (c.id === id && c.unreviewed ? { ...c, unreviewed: false } : c)));
    // Keep a LIVE in-memory stream attached, but otherwise always refresh the
    // persisted conversation from the backend when opening it. This avoids
    // reusing stale pre-fix turns that may still hold a raw CLI transcript in
    // memory after closing/reopening the drawer or tab.
    const existing = chatEngine.get(id);
    if (existing?.streaming) {
      setHasMore(false);
      return;
    }
    setChatLoading(true);
    try {
      const { items, hasMore: more } = await assistantConversationsApi.messages(id, PAGE, 0);
      chatEngine.seed(id, provider, id, historyTurns(items));
      if (!s.conversationOptions.isCurrent(id)) return;
      setLoadedCount(items.length);
      setHasMore(more);
      // Rehydrate the team delegation board (leader chats) AFTER seeding: the
      // sidecar snapshot is the truth once the run's event buffer GC'd. Ordered
      // after seed so the chat entry exists when the snapshot merges — otherwise
      // the fetch could resolve before seed and bail, leaving the "Equipo
      // trabajando" container blank after a reload. Fire-and-forget; no-op for
      // chats without delegated tasks.
      void chatEngine.refreshTeamTasks(id);
      // A long run (e.g. a CLI task) the user left going may still be alive on
      // the backend even though our in-memory stream was lost to a WebView
      // reload. Re-attach so the thread shows live progress + the final answer
      // instead of freezing at the persisted user message.
      //
      // Adopt with the run's REAL mode, not this pane's `mode`: a CLI run
      // adopted as API (or vice-versa) routes the streamed text to the wrong
      // sink and the live CLI terminal stays empty. Prefer the active-runs feed
      // (authoritative for a live run), then the last persisted message's `cli`
      // flag, then the pane mode as a last resort. Refresh the feed first if we
      // don't already know this conversation is running, so a reopen right after
      // a reload picks up the run.
      if (!chatEngine.isBackgroundRunning(id)) {
        await chatEngine.refreshBackgroundRuns().catch(() => undefined);
      }
      const last = items[items.length - 1];
      const lastCli = last?.role === "assistant" ? !!last.cli : undefined;
      const runCli = chatEngine.backgroundCli(id);
      void chatEngine.adopt(id, provider, id, runCli ?? lastCli ?? mode === "cli");
    } catch (err) {
      // The conversation was deleted server-side (404) → purge the dead tab so
      // it stops being restored on every reload. Transient/5xx errors are left
      // alone (the user can retry by reopening).
      if (err instanceof ConversationNotFoundError) purgeDeadConversation(id);
    } finally {
      if (s.conversationOptions.isCurrent(id)) setChatLoading(false);
    }
  }

  function newConversation(opts?: { preserveAgent?: boolean }) {
    // Purge the previous ephemeral "new:" chat's leftover engine state before
    // minting a new key (no-op for a real conversationId / a live stream).
    chatEngine.discardEphemeral(newKeyRef.current);
    newKeyRef.current = `new:${provider}:${Math.random().toString(36).slice(2)}`;
    setActiveId(null);
    setCurrentAgentId(opts?.preserveAgent ? currentAgentId : null);
    // A new agent chat starts on its configured model. Loose/project chats
    // retain the per-server default as their initial composer choice.
    const nextModel = opts?.preserveAgent ? "" : initialModelFor(null, null);
    s.conversationOptions.resetNew(nextModel);
    chatUiState.patchConversationChoice(provider, null, { model: nextModel, effort: "Auto" });
    setHasMore(false);
    setLoadedCount(0);
    setDraft("");
    setAttachments([]);
    setAttachError(null);
    setEditPendingTrim(false);
  }

  async function loadMore() {
    if (!activeId || loadingMore) return;
    setLoadingMore(true);
    const id = activeId;
    try {
      const { items, hasMore: more } = await assistantConversationsApi.messages(id, PAGE, loadedCount);
      const current = chatEngine.get(id)?.turns ?? [];
      chatEngine.seed(id, provider, id, [...historyTurns(items, current[0]?.provider), ...current]);
      setLoadedCount((c) => c + items.length);
      setHasMore(more);
    } catch (err) {
      // Deleted mid-session → purge; transient errors are swallowed (the older
      // pages just won't load this time).
      if (err instanceof ConversationNotFoundError) purgeDeadConversation(id);
    } finally {
      setLoadingMore(false);
    }
  }

  function deleteConversation(id: string) {
    const title = convos.find((c) => c.id === id)?.title;
    const label = title ? `"${title}"` : (ct.deleteThisChat ?? "este chat");
    setConfirmDelete({ id, label });
  }

  async function confirmDeleteConversation() {
    if (!confirmDelete) return;
    const { id } = confirmDelete;
    setConfirmDelete(null);
    try {
      await assistantConversationsApi.remove(id);
      chatUiState.deleteConversationChoice(provider, id);
      if (activeId === id) newConversation();
      void reloadList(search);
    } catch {
      /* ignore */
    }
  }

  /** Inline-rename a conversation (C3). Optimistic; reverts on failure. */
  async function renameConversation(id: string, title: string) {
    const prev = convos.find((c) => c.id === id)?.title;
    setConvos((list) => list.map((c) => (c.id === id ? { ...c, title } : c)));
    try {
      await assistantConversationsApi.rename(id, title);
    } catch {
      if (prev !== undefined) setConvos((list) => list.map((c) => (c.id === id ? { ...c, title: prev } : c)));
    }
  }

  /** Pin/unpin a conversation (C3). Optimistic; the backend orders pinned first. */
  async function togglePin(id: string, pinned: boolean) {
    setConvos((list) => list.map((c) => (c.id === id ? { ...c, pinned } : c)));
    try {
      await assistantConversationsApi.setPinned(id, pinned);
    } catch {
      setConvos((list) => list.map((c) => (c.id === id ? { ...c, pinned: !pinned } : c)));
    }
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  async function send(
    explicitText?: string,
    opts?: {
      forceNew?: boolean;
      queue?: boolean;
      planDecision?: "approve";
      /** `null` explícito = fuerza reset (conversación NORMAL). El bridge del
       *  Asistente lo pasa para no contaminar el stream con un agent-bound del pane. */
      agentIdOverride?: string | null;
      /** `null` explícito = fuerza reset de proyecto (chat suelto). */
      projectIdOverride?: string | null;
      /** conversationId ya creada (evita que el send cree OTRA conversación).
       *  Lo usa el effect del bridge externo tras `assistantConversationsApi.create`. */
      conversationIdOverride?: string | null;
      attachmentsOverride?: ChatAttachment[];
      reasoningEffort?: "low" | "medium" | "high" | "xhigh" | "max";
    },
  ) {
    // All entry points (suggestions, answers, retry, composer and queue) pass
    // this guard before options, drafts or persisted history can be changed.
    // Only the explicit external "new assistant" flow may leave this binding.
    const freshAssistant = opts?.agentIdOverride === null && opts.projectIdOverride === null
      && (opts.forceNew || (!!opts.conversationIdOverride && opts.conversationIdOverride !== activeId));
    const admitted = d.agentAdmissionRef?.current;
    const canSend = () => {
      const latest = d.agentAdmissionRef?.current;
      return !(latest?.blocked ?? d.agentInputBlocked) || freshAssistant;
    };
    const stillCurrent = () => canSend() && (!admitted || (
      d.agentAdmissionRef.current.binding === admitted.binding
      && admitted.scope === JSON.stringify([resolveTargetScope(), scopeHeaders(true)])
    ));
    if (!stillCurrent()) return;
    const voiceInput = !!opts?.attachmentsOverride?.some(a => a.voice);
    if (chatInputLocked(chatKey) && !voiceInput && !opts?.planDecision) return;
    if (!await s.conversationOptions.beforeSend() || !stillCurrent()) return;
    const text = (explicitText ?? draft).trim();
    // No `streaming` guard: if a run is in flight the engine appends this as an
    // ADDENDUM to the active bubble (default) or QUEUES it as a separate turn
    // (when `opts.queue` — the "Encolar" button).
    if (!text && attachments.length === 0 && !opts?.attachmentsOverride?.length) return;
    void preloadMonaco().catch(() => {});
    // Subtle haptic confirmation on touch devices (no-op on desktop).
    try { navigator.vibrate?.(8); } catch { /* unsupported */ }

    // Replace (not combine) when the last turn was STOPPED by the user: the next
    // message redoes the stopped one, so trim the stopped user+assistant pair
    // before dispatching — same as the explicit "Editar" flow (editPendingTrim).
    const liveTurns = chatEngine.get(chatKey)?.turns ?? [];
    const lastLiveTurn = liveTurns[liveTurns.length - 1];
    const lastWasStopped = lastLiveTurn?.role === "assistant" && lastLiveTurn.stopped === true;
    // Capture and clear the edit flag before any async work so it's atomic.
    const willTrim = (editPendingTrim || lastWasStopped) && !opts?.forceNew;

    let convId: string | null;
    let key: string;
    if (opts?.conversationIdOverride) {
      // Conversation ya creada por el caller (bridge externo). NO crear otra.
      convId = opts.conversationIdOverride;
      key = opts.conversationIdOverride;
      setActiveId(opts.conversationIdOverride);
    } else if (opts?.forceNew) {
      // Start a brand-new conversation (e.g. the files AI input hands off a question).
      newKeyRef.current = `new:${provider}:${Math.random().toString(36).slice(2)}`;
      setActiveId(null);
      convId = null;
      key = newKeyRef.current;
    } else {
      convId = activeId;
      key = chatKey;
    }

    if (!convId) {
      // Create the conversation up-front so the stream persists + the list updates.
      // El create respeta los overrides EXPLÍCITOS: si el caller pasó null para
      // agentId/projectId, va null (no re-inyecta el currentAgentId del state).
      const createAgentId = opts && "agentIdOverride" in opts ? opts.agentIdOverride ?? null : currentAgentId;
      const createProjectId = opts && "projectIdOverride" in opts ? opts.projectIdOverride ?? null : effectiveProjectId;
      try {
        const meta = await assistantConversationsApi.create(provider, text || "(adjunto)", createProjectId, createAgentId, s.conversationOptions.snapshot());
        if (!stillCurrent()) return;
        convId = meta.id;
        key = meta.id;
        chatUiState.moveNewConversationChoice(provider, meta.id);
        setActiveId(meta.id);
        void reloadList(search);
      } catch {
        if (!stillCurrent()) return;
        if (freshAssistant && !voiceInput) setDraft(current => current || text);
        setAttachError("No se pudo guardar la conversación. Inténtalo de nuevo.");
        return;
      }
    }

    if (!stillCurrent()) return;
    if (!voiceInput) setDraft("");
    if (editPendingTrim) setEditPendingTrim(false);

    // Edit mode: drop the stopped user turn + assistant turn before resending.
    if (willTrim) chatEngine.popTurns(key, 2);

    const prior = chatEngine.get(key)?.turns ?? [];
    const messages = buildAgentMessages(prior, text);

    const sentAttachments = opts?.attachmentsOverride ?? attachments;
    if (!voiceInput) setAttachments([]);

    // The user is actively in this chat → it's not a pending Dashboard item.
    chatEngine.markReviewed(key);

    // Los overrides EXPLÍCITOS prevalecen sobre el state del pane: el bridge
    // externo (lxp:assistant:request v1) los fija a `null` para garantizar
    // conversación NORMAL incluso si el pane tiene currentAgentId poblado.
    const effectiveAgentId = opts && "agentIdOverride" in opts ? opts.agentIdOverride ?? null : currentAgentId;
    const effectiveProjectIdFinal = opts && "projectIdOverride" in opts ? opts.projectIdOverride ?? null : effectiveProjectId;

    // Fire-and-forget: the engine keeps streaming even if we switch tabs.
    void chatEngine.send({
      key,
      provider,
      mode,
      conversationId: convId,
      projectId: effectiveProjectIdFinal,
      agentId: effectiveAgentId,
      messages,
      // Per-turn model override from the composer selector. "" = Auto → omit so
      // the backend auto-router picks the model/effort per turn.
      model: selectedModel || undefined,
      effort: opts?.reasoningEffort,
      // Explicit "Encolar" button → queue as a separate follow-up turn; default
      // send while running → addendum to the active bubble (engine decides).
      queue: opts?.queue ?? false,
      // Rebuilds context from up-to-date turns when this send is QUEUED behind an
      // in-flight run (so it includes the answer that just finished). The
      // optional `override` lets the engine dispatch joined addenda as one turn.
      buildMessages: (prior, override) => buildAgentMessages(prior, override ?? text),
      userText: text || (sentAttachments.length ? `📎 ${sentAttachments.map((a) => a.name).join(", ")}` : ""),
      attachments: sentAttachments,
      // Respuesta afirmativa a un ask plan-approval (botón "Aprobar plan").
      ...(opts?.planDecision ? { planDecision: opts.planDecision } : {}),
      onSettled: () => void reloadList(search),
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Slash-command autocomplete keyboard handling takes priority while open:
    // arrows move the highlight, Enter/Tab picks, Esc dismisses.
    if (slashOpen && slashMatches.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSlashIndex((i) => (i + 1) % slashMatches.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSlashIndex((i) => (i - 1 + slashMatches.length) % slashMatches.length); return; }
      if (e.key === "Enter" || e.key === "Tab") {
        const m = slashMatches[slashIndex] ?? slashMatches[0]!;
        // An argless command already fully typed (e.g. "/clear") → let Enter
        // send it directly instead of re-inserting it (avoids the two-Enter wart).
        if (e.key === "Enter" && !m.args && draft.trim() === m.cmd) {
          setSlashOpen(false);
          e.preventDefault();
          void send();
          return;
        }
        e.preventDefault();
        applySlashCommand(m);
        return;
      }
      if (e.key === "Escape") { e.preventDefault(); setSlashOpen(false); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  }

  /**
   * Edit the last user message: stop the in-flight run, prefill the composer,
   * and mark that the next send should remove the stopped pair (user + assistant)
   * before dispatching — so the edited message replaces them cleanly.
   * If the user discards without sending the UI is left intact.
   */
  function editMessage(text: string) {
    chatEngine.stop(chatKey);
    setEditPendingTrim(true);
    setDraft(text);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
        autosizeTextarea();
      }
    });
  }

  /**
   * Edit a still-queued follow-up (not yet sent): pull it out of the queue and
   * load its text + attachments back into the composer. Re-sending re-queues
   * the edited turn. Works for both server-side and client-side queues.
   */
  async function editQueuedMessage(index: number) {
    const data = await chatEngine.editQueued(chatKey, index);
    if (!data) return;
    const hasAttachments = (data.attachments?.length ?? 0) > 0;
    // Attachment-only sends persist a "📎 name…" placeholder as their text —
    // don't surface that synthetic label as editable draft text.
    const draftText = hasAttachments && /^📎\s/.test(data.userText) ? "" : data.userText;
    setDraft(draftText);
    setAttachments(data.attachments ?? []);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
        autosizeTextarea();
      }
    });
  }

  async function addFiles(files: File[]) {
    if (files.length === 0) return false;
    setAttachError(null);
    const next: ChatAttachment[] = [];
    for (const f of files) {
      // Hard ceiling BEFORE decoding so a pathologically large file can't OOM
      // the tab while we try to rasterize it. Compression handles the rest.
      if (f.size > MAX_DECODE_BYTES) {
        setAttachError(`"${f.name || "archivo"}" es demasiado grande (${formatMb(f.size)}).`);
        continue;
      }
      if (!support.accepts(f.type)) {
        setAttachError(
          `"${f.name || f.type || "?"}" no soportado por ${provider}${model ? ` (${model})` : ""} en modo ${mode}.`,
        );
        continue;
      }
      // Downscale + recompress large/heavy images so vision tokens (and the
      // upload) shrink. Non-images and small images pass through untouched.
      let prepared;
      try {
        prepared = await prepareImageForUpload(f);
      } catch {
        setAttachError(`No se pudo procesar "${f.name || "archivo"}".`);
        continue;
      }
      // Enforce the per-file cap on the COMPRESSED payload — a big photo that
      // shrinks under the limit is now accepted instead of rejected outright.
      if (prepared.bytes > MAX_ATTACH_BYTES) {
        setAttachError(`"${f.name || "archivo"}" supera ${formatMb(MAX_ATTACH_BYTES)} incluso comprimido.`);
        continue;
      }
      next.push({ name: prepared.name, mimeType: prepared.mimeType, dataBase64: prepared.dataBase64 });
    }
    if (next.length) setAttachments((prev) => [...prev, ...next]);
    return next.length > 0;
  }

  async function onFilesPicked(files: FileList | null) {
    if (!files) return;
    await addFiles(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openAttachSourceModal() {
    setAttachError(null);
    setAttachSourceOpen(true);
  }

  /** Paste image clippings / screenshots from the clipboard (desktop/web). */
  async function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (!support.enabled) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    const imgs: File[] = [];
    for (const it of Array.from(items)) {
      if (it.kind === "file" && it.type.startsWith("image/")) {
        const f = it.getAsFile();
        if (f) imgs.push(f);
      }
    }
    if (imgs.length) {
      e.preventDefault(); // don't paste the binary as text
      await addFiles(imgs);
    }
  }

  // Drag & drop: adjunta archivos soltándolos sobre el chat. Mismo gate que el
  // botón adjuntar / pegado (`support.enabled`) y la MISMA validación/compresión
  // (`addFiles`). Solo reacciona a arrastres que traen ficheros (no texto/URLs).
  const dragHasFiles = (e: React.DragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");
  function onChatDragEnter(e: React.DragEvent) {
    if (!support.enabled || !dragHasFiles(e)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setDragActive(true);
  }
  function onChatDragOver(e: React.DragEvent) {
    if (!support.enabled || !dragHasFiles(e)) return;
    e.preventDefault(); // permite el drop y muestra el cursor "copiar"
    e.dataTransfer.dropEffect = "copy";
  }
  function onChatDragLeave(e: React.DragEvent) {
    if (!support.enabled) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragActive(false);
  }
  async function onChatDrop(e: React.DragEvent) {
    if (!support.enabled) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setDragActive(false);
    const files = e.dataTransfer?.files;
    if (files && files.length) await addFiles(Array.from(files));
  }

  return {
    addFiles,
    confirmDeleteConversation,
    deleteConversation,
    dragHasFiles,
    editMessage,
    editQueuedMessage,
    loadMore,
    newConversation,
    onChatDragEnter,
    onChatDragLeave,
    onChatDragOver,
    onChatDrop,
    onFilesPicked,
    onKeyDown,
    onPaste,
    openAttachSourceModal,
    openConversation,
    renameConversation,
    send,
    togglePin,
  };
}
