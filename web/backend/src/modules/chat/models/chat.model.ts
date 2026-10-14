// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Internal user-to-user chat — data model.
 *
 * Everything here is PER CONNECTED SERVER: "users" are the Linux accounts of
 * the bridged server (`getent passwd`), "linux-group" conversations are backed
 * by real OS groups (`getent group`), and all rows live in JSON sidecars under
 * `${LUXIPANEL_CONFIG_DIR}/chat/*` on that server. There is no global store.
 */

import type { ChatMessageSystem } from "../../../shared/chat-call-types.js";

export type { ChatMessageSystem };

/**
 * Author of a system message. Not a real Linux account (`_` is not a valid
 * leading char for a login on any distro we support), so it can never collide
 * with a person and `displayNames` will never resolve it.
 */
export const SYSTEM_AUTHOR = "_system";

/** How a conversation is addressed. */
export type ChatConversationKind = "dm" | "group" | "linux-group";

/** A persisted attachment reference (the bytes live on the target FS). */
export interface ChatAttachmentRef {
  id: string;
  name: string;
  mimeType: string;
}

export interface ChatConversation {
  id: string;
  kind: ChatConversationKind;
  /** Free-form title for ad-hoc groups; null for DMs (derived from members). */
  title?: string | null;
  /** Participant Linux usernames. For `linux-group` this is a cached snapshot
   *  of the OS group membership at the last write; the live membership is
   *  re-resolved on send so newly-added group members start receiving. */
  members: string[];
  /** OS group name when `kind === "linux-group"`. */
  linuxGroup?: string | null;
  /** Username that created the conversation. */
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  lastMessageFrom?: string | null;
}

export interface ChatMessage {
  id: string;
  convId: string;
  /** Author Linux username. */
  from: string;
  /**
   * Author's human name (GECOS). DECORATED on read/emit from
   * `directoryService.displayNames`, never persisted — the sidecar keeps only
   * `from` so a rename in `/etc/passwd` is reflected immediately everywhere.
   */
  fromDisplayName?: string;
  body: string;
  attachments: ChatAttachmentRef[];
  createdAt: string;
  editedAt?: string | null;
  /** Soft delete: body/attachments are cleared, the row stays for ordering. */
  deletedAt?: string | null;
  /**
   * Non-null on SYSTEM messages (`from === SYSTEM_AUTHOR`): a structured
   * payload the UI renders as a chip instead of a bubble. `body` still carries
   * a human sentence so every non-updated client degrades to plain text.
   */
  system?: ChatMessageSystem | null;
}

/** Per (conversation, user) read cursor. id = `${convId}__${username}`. */
export interface ChatReadState {
  id: string;
  convId: string;
  username: string;
  lastReadAt: string;
}

/** A directory entry the "new conversation" picker can start a DM with. */
export interface ChatDirectoryUser {
  username: string;
  displayName: string;
  online: boolean;
  /** Free-form status line from the user's chat profile (≤80 chars). */
  status?: string | null;
}

/** One human member of a Linux group, with presence + profile status. */
export interface ChatDirectoryMember {
  username: string;
  displayName: string;
  online: boolean;
  status?: string | null;
}

/** A Linux group the current user belongs to, offered as a group chat. */
export interface ChatDirectoryGroup {
  name: string;
  members: ChatDirectoryMember[];
}

/**
 * Per-user chat profile (per connected server, sidecar `chat/profiles.json`,
 * id = Linux username). Presence opt-out + a short status line.
 */
export interface ChatProfile {
  /** Linux username — also the doc id. */
  username: string;
  /** When false the user is reported as offline to everybody. */
  showOnline: boolean;
  statusMessage: string | null;
  updatedAt: string;
}

/** One row of `GET /api/chat/conversations/:id/attachments`. */
export interface ChatAttachmentListItem {
  id: string;
  name: string;
  mimeType: string;
  /** Bytes from the attachments index; null when the index has no record. */
  size: number | null;
  createdAt: string;
  messageId: string;
  from: string;
  fromDisplayName: string;
}

/** Shape emitted on the in-process bus and pushed over SSE. */
export interface ChatMessageEvent {
  /** Server scope — only clients whose session targets this id receive it. */
  targetId: string;
  /** Usernames allowed to receive this event (sender + recipients). */
  participants: string[];
  conversation: {
    id: string;
    kind: ChatConversationKind;
    title?: string | null;
    members: string[];
    /** username → display name for `members` (decorated, not persisted). */
    memberNames?: Record<string, string>;
    lastMessageAt?: string | null;
    lastMessagePreview?: string | null;
    lastMessageFrom?: string | null;
  };
  message: ChatMessage;
}
