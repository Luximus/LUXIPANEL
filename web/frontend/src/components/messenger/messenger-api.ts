// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * REST client + types for the internal user-to-user chat (/panel/chat).
 *
 * Paths are resolved honoring the LP `/__luxipanel` mount, mirroring the
 * notifications/chat dropdown scripts, so the same island works on a panel
 * subdomain and on api.luxisoft.com.
 */

import { api, resolvePanelApiPath, type ApiResponse } from "@/lib/api-client";
import { normalizeTranscriptSegments, type ChatCallTranscript, type ChatMessageSystem } from "@/lib/chat-call";

export type ConversationKind = "dm" | "group" | "linux-group";

export interface AttachmentRef {
  id: string;
  name: string;
  mimeType: string;
}

export interface ChatMessage {
  id: string;
  convId: string;
  from: string;
  /** Human display name of the author (bloque B). Never render `from`. */
  fromDisplayName?: string | null;
  body: string;
  attachments: AttachmentRef[];
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  /**
   * Bloque F — set on SYSTEM messages (a finished call). `body` always carries
   * a readable sentence too, so a client that does not know this field still
   * renders something sensible.
   */
  system?: ChatMessageSystem | null;
}

export interface ConversationView {
  id: string;
  kind: ConversationKind;
  title?: string | null;
  members: string[];
  linuxGroup?: string | null;
  displayTitle: string;
  unread: boolean;
  otherUser?: string;
  /** Display name of the DM counterpart (bloque B). */
  otherDisplayName?: string | null;
  /** username → display name for every member (bloque B). */
  memberNames?: Record<string, string> | null;
  online?: boolean;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  lastMessageFrom?: string | null;
}

export interface DirectoryUser {
  username: string;
  displayName: string;
  online: boolean;
  /** Free-text presence status (≤80 chars) published by the user. */
  status?: string | null;
}

export interface DirectoryGroup {
  name: string;
  /**
   * Bloque C: the backend now returns member OBJECTS. Older backends (and the
   * cached payload of a half-deployed rollout) still return plain usernames, so
   * the type is tolerant and `normalizeGroupMembers` coerces both shapes.
   */
  members: Array<DirectoryUser | string>;
}

export interface Directory {
  users: DirectoryUser[];
  groups: DirectoryGroup[];
}

export const EMPTY_DIRECTORY: Directory = { users: [], groups: [] };

/** Coerce a `DirectoryGroup.members` entry list into `DirectoryUser[]`. */
export function normalizeGroupMembers(
  members: DirectoryGroup["members"] | undefined,
  lookup?: ReadonlyMap<string, DirectoryUser>,
): DirectoryUser[] {
  if (!Array.isArray(members)) return [];
  return members.map((m) => {
    if (typeof m === "string") {
      const known = lookup?.get(m);
      return known ?? { username: m, displayName: "", online: false };
    }
    return { username: m.username, displayName: m.displayName ?? "", online: !!m.online, status: m.status ?? null };
  });
}

/** Presence profile (`GET/PUT /api/chat/me/profile`). */
export interface ChatProfile {
  showOnline: boolean;
  statusMessage: string;
}

/** One attachment of a conversation (`GET .../attachments`). */
export interface ConversationAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  createdAt: string;
  messageId: string;
  from: string;
  fromDisplayName?: string | null;
}

export interface NewAttachment {
  name: string;
  mimeType: string;
  dataBase64: string;
}

/**
 * LP-mount aware path resolution (F-07): re-export of the canonical
 * `resolvePanelApiPath`, which is the same logic PLUS the `typeof window`
 * guard the local copy lacked (it threw during SSR).
 */
export { resolvePanelApiPath as resolveApiPath };

/**
 * Method dispatcher over the canonical `api` object (F-06). The messenger used
 * to ship its own `fetch` wrapper (own CSRF regex, no `X-Bridge-Session-Id`, no
 * target-scope guard); this keeps the local call shape while the request itself
 * goes through the single shared client.
 */
function apiCall<T = unknown>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
  switch (method) {
    case "GET":
      return api.get<T>(path);
    case "POST":
      return api.post<T>(path, body);
    case "PUT":
      return api.put<T>(path, body);
    case "PATCH":
      return api.patch<T>(path, body);
    default:
      return api.delete<T>(path);
  }
}

/** URL the browser can put in `<img src>` / a download link. */
export function attachmentUrl(id: string): string {
  return resolvePanelApiPath(`/api/chat/attachments/${encodeURIComponent(id)}`);
}

export const messengerApi = {
  async listConversations(): Promise<ConversationView[]> {
    const res = await apiCall<ConversationView[]>("GET", "/api/chat/conversations");
    return res.ok && res.data ? res.data : [];
  },

  async listMessages(convId: string, opts: { before?: string; limit?: number } = {}): Promise<ChatMessage[]> {
    const qs = new URLSearchParams();
    if (opts.before) qs.set("before", opts.before);
    if (opts.limit) qs.set("limit", String(opts.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const res = await apiCall<ChatMessage[]>("GET",
      `/api/chat/conversations/${encodeURIComponent(convId)}/messages${suffix}`,
    );
    return res.ok && res.data ? res.data : [];
  },

  async directory(): Promise<Directory> {
    const res = await apiCall<Directory>("GET", "/api/chat/directory");
    if (!res.ok || !res.data) return EMPTY_DIRECTORY;
    return { users: res.data.users ?? [], groups: res.data.groups ?? [] };
  },

  /** Bloque D — every attachment of a conversation, newest last. */
  async listAttachments(convId: string): Promise<ConversationAttachment[]> {
    const res = await apiCall<ConversationAttachment[]>(
      "GET",
      `/api/chat/conversations/${encodeURIComponent(convId)}/attachments`,
    );
    return res.ok && Array.isArray(res.data) ? res.data : [];
  },

  /**
   * The per-speaker history of a finished call.
   *
   * Fetched ON DEMAND (the thread listing carries only the segment count) and
   * fail-soft: a backend that has not shipped this route yet, or a transcript
   * Tolqia has already expired, degrades to an empty panel — never a broken
   * thread.
   */
  async getCallTranscript(convId: string, messageId: string): Promise<ChatCallTranscript> {
    const res = await apiCall<ChatCallTranscript>(
      "GET",
      `/api/chat/conversations/${encodeURIComponent(convId)}/messages/${encodeURIComponent(messageId)}/transcript`,
    );
    if (!res.ok || !res.data) return { segments: [], truncated: false, participants: [] };
    return {
      segments: normalizeTranscriptSegments(res.data.segments),
      truncated: res.data.truncated === true,
      participants: Array.isArray(res.data.participants) ? res.data.participants : [],
    };
  },

  /** Bloque C/E — presence profile. */
  async getProfile(): Promise<ChatProfile | null> {
    const res = await apiCall<ChatProfile>("GET", "/api/chat/me/profile");
    return res.ok && res.data ? res.data : null;
  },
  async saveProfile(patch: Partial<ChatProfile>): Promise<boolean> {
    const res = await apiCall<ChatProfile>("PUT", "/api/chat/me/profile", patch);
    return !!res.ok;
  },

  async createDm(username: string): Promise<ConversationView | null> {
    return this.create({ kind: "dm", username });
  },
  async createGroup(title: string, members: string[]): Promise<ConversationView | null> {
    return this.create({ kind: "group", title, members });
  },
  async openLinuxGroup(group: string): Promise<ConversationView | null> {
    return this.create({ kind: "linux-group", group });
  },
  async create(payload: Record<string, unknown>): Promise<ConversationView | null> {
    const res = await apiCall<ConversationView>("POST", "/api/chat/conversations", payload);
    return res.ok && res.data ? res.data : null;
  },

  async send(convId: string, body: string, attachments: NewAttachment[]): Promise<ChatMessage | null> {
    const res = await apiCall<ChatMessage>("POST",
      `/api/chat/conversations/${encodeURIComponent(convId)}/messages`,
      { body, attachments },
    );
    return res.ok && res.data ? res.data : null;
  },

  async markRead(convId: string): Promise<void> {
    await apiCall("POST", `/api/chat/conversations/${encodeURIComponent(convId)}/read`);
  },

  async editMessage(convId: string, messageId: string, body: string): Promise<ChatMessage | null> {
    const res = await apiCall<ChatMessage>("PATCH",
      `/api/chat/conversations/${encodeURIComponent(convId)}/messages/${encodeURIComponent(messageId)}`,
      { body },
    );
    return res.ok && res.data ? res.data : null;
  },

  async deleteMessage(convId: string, messageId: string): Promise<ChatMessage | null> {
    const res = await apiCall<ChatMessage>("DELETE",
      `/api/chat/conversations/${encodeURIComponent(convId)}/messages/${encodeURIComponent(messageId)}`,
    );
    return res.ok && res.data ? res.data : null;
  },
};
