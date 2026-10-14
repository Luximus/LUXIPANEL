// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Hooks reactivos sobre el `chat-store` module-level del asistente (fase A5).
 *
 * Antes vivían en `components/assistant-bridge.ts` (adapter muerto con el
 * pane): son la única superficie React sobre el store; toda mutación va por
 * `chat-controller` (operaciones) o `chat-store` (estado).
 */
import { useSyncExternalStore } from "react";
import { chatStore, type ChatPanelState } from "./chat-store";
import type { AssistantHeader, AssistantSession, ComposerState } from "./types";

/** Suscripción reactiva a la sesión del asistente de un panel. */
export function useAssistantSession(panelId: string): AssistantSession {
  return useSyncExternalStore(
    (cb) => chatStore.subscribeSession(panelId, cb),
    () => chatStore.getSession(panelId),
  );
}

/** Suscripción reactiva al composer de un panel. */
export function useAssistantComposer(panelId: string): ComposerState {
  return useSyncExternalStore(
    (cb) => chatStore.subscribeComposer(panelId, cb),
    () => chatStore.getComposer(panelId),
  );
}

/** Suscripción reactiva a los indicadores del header del chat de un panel. */
export function useAssistantHeader(panelId: string): AssistantHeader {
  return useSyncExternalStore(
    (cb) => chatStore.subscribeHeader(panelId, cb),
    () => chatStore.getHeader(panelId),
  );
}

/** Suscripción reactiva al estado del CHAT (mensajes/adjuntos/meta) de un panel. */
export function useAssistantChat(panelId: string): ChatPanelState {
  return useSyncExternalStore(
    (cb) => chatStore.subscribeChat(panelId, cb),
    () => chatStore.getChat(panelId),
  );
}
