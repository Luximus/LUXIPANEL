// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useRef, useState } from "react";
import { assistantConversationsApi, type ConversationMeta } from "../assistant-api/conversations";
import { normalizeReasoningEffort, type ChatReasoningEffort } from "../reasoning-effort";
import { chatUiState } from "../chat-ui-state";

type Options = Required<Pick<ConversationMeta, "model" | "effort" | "approvalMode">>;
const toEffort = (value: string): Options["effort"] => ({ Auto: "", Low: "low", Medium: "medium", High: "high", Extra: "xhigh" }[value] ?? "") as Options["effort"];
const effortLabel = (value: Options["effort"]) => ({ "": "Auto", low: "Low", medium: "Medium", high: "High", xhigh: "Extra" }[value]);

/** Server metadata owns saved choices; local storage only migrates legacy model picks. */
export function useConversationOptions(input: {
  id: string | null; provider: string; active: boolean; defaultModel: string;
  defaultApproval: Options["approvalMode"];
  defaultEffort?: ChatReasoningEffort;
  onRestoreProvider?: (provider: string, id: string) => void;
}) {
  const { id, provider, active } = input;
  const defaults = (): Options => ({ model: input.defaultModel, effort: normalizeReasoningEffort(input.defaultEffort), approvalMode: input.defaultApproval });
  const [state, setState] = useState<{ id: string | null; value: Options; meta: ConversationMeta | null; ready: boolean; error: string | null }>(() => ({ id, value: defaults(), meta: null, ready: !id, error: null }));
  const stateRef = useRef(state); stateRef.current = state;
  const current = useRef(id); current.current = id;
  const callbacks = useRef(input); callbacks.current = input;
  const pending = useRef<Promise<boolean>>(Promise.resolve(true));
  const update = (next: typeof state) => { stateRef.current = next; setState(next); };
  useEffect(() => {
    let cancelled = false;
    if (!active) return;
    pending.current = Promise.resolve(true);
    if (!id) { update({ id, value: defaults(), meta: null, ready: true, error: null }); return; }
    update({ id, value: { model: "", effort: "", approvalMode: "manual" }, meta: null, ready: false, error: null });
    void assistantConversationsApi.get(id).then(meta => {
      if (cancelled || current.current !== id || !meta) return;
      if (meta.provider && meta.provider !== provider) {
        update({ ...stateRef.current, meta, error: "Cargando el proveedor guardado; si no está disponible, selecciona otro para continuar." });
        callbacks.current.onRestoreProvider?.(meta.provider, id);
        // Sending is blocked until the correct provider pane is restored.
        return;
      }
      const legacy = chatUiState.getConversationChoice(provider, id);
      update({ id, meta, ready: true, error: null, value: {
        model: meta.model ?? legacy?.model ?? "",
        effort: meta.effort ?? toEffort(legacy?.effort ?? "Auto"),
        // Legacy chats never inherit another chat's recent approval selection.
        approvalMode: meta.approvalMode ?? "manual",
      } });
    }).catch(() => {
      if (!cancelled && current.current === id) update({ ...stateRef.current, error: "No se pudieron cargar las opciones del chat. Vuelve a abrirlo para reintentar." });
    });
    return () => { cancelled = true; };
  }, [id, provider, active]);

  const persist = (patch: Partial<Options>): Promise<boolean> => {
    const target = id;
    const old = stateRef.current;
    if (current.current !== target || old.id !== target || !old.ready) return Promise.resolve(false);
    const value = { ...old.value, ...patch };
    update({ ...old, value, error: null });
    if (!target) return Promise.resolve(true);
    const write = pending.current.then(async () => {
      try {
        const meta = await assistantConversationsApi.setOptions(target, patch);
        if (current.current === target) update({ ...stateRef.current, meta });
        return true;
      } catch {
        if (current.current === target) update({ ...stateRef.current, error: "No se pudieron guardar las opciones del chat. Inténtalo de nuevo." });
        return false;
      }
    });
    pending.current = write;
    return write;
  };
  const visible = state.id === id ? state.value : { model: "", effort: "" as const, approvalMode: "manual" as const };
  return {
    meta: state.id === id ? state.meta : null,
    ready: state.id === id && state.ready,
    error: state.id === id ? state.error : null,
    selectedModel: visible.model, selectedEffort: effortLabel(visible.effort), approvalMode: visible.approvalMode,
    setSelectedModel: (model: string) => { void persist({ model }); },
    setSelectedEffort: (effort: string) => { void persist({ effort: toEffort(effort) }); },
    changeApproval: (approvalMode: Options["approvalMode"]) => persist({ approvalMode }),
    select: (target: string) => { current.current = target; },
    isCurrent: (target: string) => current.current === target,
    resetNew: (model: string) => {
      current.current = null;
      pending.current = Promise.resolve(true);
      update({ id: null, value: { ...defaults(), model }, meta: null, ready: true, error: null });
    },
    snapshot: () => ({ ...stateRef.current.value }),
    beforeSend: async () => {
      if (current.current !== id || stateRef.current.id !== id || !stateRef.current.ready) return false;
      if (!await pending.current || current.current !== id) return false;
      // Pin legacy defaults once; a later global setting cannot alter this chat.
      const ok = id ? await persist(stateRef.current.value) : true;
      return ok && current.current === id;
    },
  };
}
