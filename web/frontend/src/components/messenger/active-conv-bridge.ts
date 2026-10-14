// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Bridge between the `/panel/chat` React island and the topbar script
 * (`scripts/extracted/layouts/chat.ts`), which runs OUTSIDE React and has no
 * way to know which conversation is on screen.
 *
 * The topbar reads `window.__lxpChatActive?.convId` before beeping / raising a
 * desktop notification, so a message that lands in the conversation the user is
 * already reading stays silent.
 */

export interface ChatActiveBridge {
  convId: string | null;
}

declare global {
  interface Window {
    __lxpChatActive?: ChatActiveBridge;
  }
}

export function setActiveConversation(convId: string | null): void {
  if (typeof window === "undefined") return;
  const bridge = (window.__lxpChatActive ??= { convId: null });
  bridge.convId = convId;
}

export function getActiveConversation(): string | null {
  if (typeof window === "undefined") return null;
  return window.__lxpChatActive?.convId ?? null;
}
