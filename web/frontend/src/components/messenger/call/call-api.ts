// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * REST client for the audio-call endpoints (F3).
 *
 * Same shape as `messenger-api.ts`: it goes through the canonical `api` client
 * (CSRF, `X-Bridge-Session-Id`, target-scope guard) and never builds a URL by
 * hand. Every call resolves to `null`/`false` on failure rather than throwing —
 * a call that cannot start must degrade to a toast, never to a broken thread.
 */
import { api } from "@/lib/api-client";
import type { ChatCallSession, ChatCallView } from "@/lib/chat-call";

const conv = (id: string) => `/api/chat/conversations/${encodeURIComponent(id)}/call`;
const call = (id: string) => `/api/chat/calls/${encodeURIComponent(id)}`;

/**
 * What `start` reports back. The session is `null` on failure, and `code`
 * carries the backend's typed reason when there is one — `TOLQIA_PLAN_INACTIVE`
 * / `TOLQIA_PLAN_REQUIRED` / `TOLQIA_TOKEN_INVALID` are actionable by a human
 * and must not collapse into the generic "no se pudo iniciar la llamada".
 */
export interface CallStartResult {
  session: ChatCallSession | null;
  code?: string;
}

export const callApi = {
  /**
   * Start the call of a conversation — or join the one already running (the
   * backend turns Tolqia's 409 into `joined: true`, so the button and the
   * "Unirse" affordance hit the same endpoint).
   */
  async start(convId: string): Promise<CallStartResult> {
    const res = await api.post<ChatCallSession>(conv(convId), {});
    if (res.ok && res.data) return { session: res.data };
    return { session: null, ...(res.code ? { code: res.code } : {}) };
  },

  /** The live call of a conversation, or `null`. Cached 2 s server-side. */
  async active(convId: string): Promise<ChatCallView | null> {
    const res = await api.get<ChatCallView | null>(conv(convId));
    return res.ok && res.data ? res.data : null;
  },

  /** Snapshot of one call (used by the `?call=` deep link). */
  async get(callId: string): Promise<ChatCallView | null> {
    const res = await api.get<ChatCallView>(call(callId));
    return res.ok && res.data ? res.data : null;
  },

  /** Accept a ringing call: mints THIS user's participant token. */
  async accept(callId: string): Promise<ChatCallSession | null> {
    const res = await api.post<ChatCallSession>(`${call(callId)}/accept`, {});
    return res.ok && res.data ? res.data : null;
  },

  /** Decline. In a DM this ends the room for both sides. */
  async reject(callId: string): Promise<boolean> {
    const res = await api.post<ChatCallView>(`${call(callId)}/reject`, {});
    return !!res.ok;
  },

  /** Hang up for everyone. Idempotent. */
  async end(callId: string): Promise<boolean> {
    const res = await api.post<ChatCallView>(`${call(callId)}/end`, {});
    return !!res.ok;
  },
};
