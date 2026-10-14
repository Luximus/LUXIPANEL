// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Chat service — conversation + message logic for the internal user-to-user
 * chat. PER CONNECTED SERVER: every read/write goes through the request's
 * `Executor` (passed in explicitly), so a message persisted on server X never
 * leaks to a session bridged to server Y.
 *
 * Realtime: we emit on an in-process `chatBus` (mirrors notificationsBus). The
 * SSE layer subscribes and filters each event by BOTH the originating
 * `targetId` (per-server isolation) AND the connection's username (recipient).
 * We deliberately do NOT pin `runOnPanelHost` here — that would collapse all
 * servers into one store and break the per-server invariant.
 */

import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { Executor } from "../../../shared/executor/index.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../../shared/errors/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { panelUserRepository } from "../../auth/repositories/panel-user.repository.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { messagesRepository } from "../repositories/messages.repository.js";
import { readsRepository } from "../repositories/reads.repository.js";
import { attachmentsRepository } from "../repositories/attachments.repository.js";
import { profilesRepository } from "../repositories/profiles.repository.js";
import { directoryService } from "./directory.service.js";
import { SYSTEM_AUTHOR } from "../models/chat.model.js";
import type {
  ChatAttachmentListItem,
  ChatAttachmentRef,
  ChatConversation,
  ChatMessage,
  ChatMessageSystem,
  ChatProfile,
} from "../models/chat.model.js";

const log = createModuleLogger("chat-service");

class ChatBus extends EventEmitter {}
export const chatBus = new ChatBus();
chatBus.setMaxListeners(500);

export const CHAT_EVENTS = {
  MESSAGE: "chat:message",
  READ: "chat:read",
  CONVERSATION: "chat:conversation",
  /** F3 — audio calls. Payload: `ChatCallEvent` (shared/chat-call-types.ts). */
  CALL: "chat:call",
} as const;

// ── Presence: who currently has a live chat stream open, per server ─────────
// A username with ≥1 active SSE connection on a server is "in the chat" (they
// receive messages live + see the unread badge). Recipients with NO connection
// are AWAY → they get a device push + bell. Keyed by `${targetId}::${username}`.
const presence = new Map<string, number>();
const presenceKey = (targetId: string, username: string) => `${targetId}::${username}`;

export const chatPresence = {
  add(targetId: string, username: string): void {
    const k = presenceKey(targetId, username);
    presence.set(k, (presence.get(k) ?? 0) + 1);
  },
  remove(targetId: string, username: string): void {
    const k = presenceKey(targetId, username);
    const n = (presence.get(k) ?? 0) - 1;
    if (n <= 0) presence.delete(k);
    else presence.set(k, n);
  },
  isPresent(targetId: string, username: string): boolean {
    return (presence.get(presenceKey(targetId, username)) ?? 0) > 0;
  },
};

const PREVIEW_MAX = 120;

export interface ConversationView extends ChatConversation {
  /** Resolved display title (other user for dm, group name/title otherwise). */
  displayTitle: string;
  unread: boolean;
  /** For dm: the counterpart username + its presence. */
  otherUser?: string;
  online?: boolean;
  /**
   * `username → display name` for every member. The UI renders ONLY from here
   * (Block B: a raw Linux login is never shown); missing entries fall back to
   * the username so the map is always total over `members`.
   */
  memberNames: Record<string, string>;
  /** For dm: the counterpart's display name (already in `memberNames`). */
  otherDisplayName?: string;
}

interface NewAttachment {
  name: string;
  mimeType: string;
  dataBase64: string;
}

function dmId(a: string, b: string): string {
  return `dm_${[a, b].sort().join("__")}`;
}
function linuxGroupId(group: string): string {
  return `lg_${group.replace(/[^A-Za-z0-9._-]/g, "_")}`;
}
function previewOf(body: string, attachments: ChatAttachmentRef[]): string {
  const text = body.trim().slice(0, PREVIEW_MAX);
  if (text) return text;
  return attachments[0]?.name ?? "";
}

/** Usernames allowed to receive events for a conversation (live for groups). */
export async function participantsOf(executor: Executor, conv: ChatConversation): Promise<string[]> {
  if (conv.kind === "linux-group" && conv.linuxGroup) {
    const live = await directoryService.groupMembers(executor, conv.linuxGroup);
    return Array.from(new Set([...(conv.members ?? []), ...live]));
  }
  return conv.members ?? [];
}

/** `username → display name`, total over `members` (falls back to the login). */
function namesFor(members: string[], display: Map<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of members) out[m] = display.get(m) ?? m;
  return out;
}

/**
 * Drop the heavy half of a call system message.
 *
 * A transcript is persisted WITH the message but is worth up to 200 KB; a page
 * of 50 messages holding several finished calls would otherwise ship megabytes
 * on every thread render and on every SSE frame. The bubble only needs
 * `transcriptSegments` to offer "ver transcripción" — the body is fetched on
 * demand from `GET .../messages/:mid/transcript`.
 */
function stripTranscript(message: ChatMessage): ChatMessage {
  const system = message.system;
  if (!system || system.kind !== "call" || !system.transcript) return message;
  const { transcript, ...rest } = system;
  return {
    ...message,
    system: { ...rest, transcriptSegments: system.transcriptSegments ?? transcript.length },
  };
}

/**
 * Attach `fromDisplayName` to a message WITHOUT persisting it.
 *
 * System messages have no human author, so decorating them would print the
 * synthetic `_system` login as a name — they only get the transcript strip.
 */
function decorate(message: ChatMessage, display: Map<string, string>): ChatMessage {
  if (message.from === SYSTEM_AUTHOR) return stripTranscript(message);
  return { ...message, fromDisplayName: display.get(message.from) ?? message.from };
}

export const chatService = {
  /** Conversations the user participates in, newest-first, with unread + presence. */
  async listConversations(executor: Executor, username: string): Promise<ConversationView[]> {
    const [convs, cursors, users] = await Promise.all([
      conversationsRepository.listForUser(executor, username),
      readsRepository.cursorsForUser(executor, username),
      directoryService.listUsers(executor).catch(() => []),
    ]);
    const display = new Map(users.map((u) => [u.username, u.displayName]));
    const online = new Set(users.filter((u) => u.online).map((u) => u.username));

    const views = convs.map((c) => this.toView(c, username, cursors, display, online));
    return views.sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
  },

  toView(
    c: ChatConversation,
    username: string,
    cursors: Map<string, string>,
    display: Map<string, string>,
    online: Set<string>,
  ): ConversationView {
    const memberNames = namesFor(c.members ?? [], display);
    let displayTitle: string;
    let otherUser: string | undefined;
    let otherDisplayName: string | undefined;
    let isOnline: boolean | undefined;
    if (c.kind === "dm") {
      otherUser = c.members.find((m) => m !== username) ?? username;
      // Never fall back to the raw login when the directory knows the person.
      otherDisplayName = memberNames[otherUser] ?? otherUser;
      displayTitle = otherDisplayName;
      isOnline = online.has(otherUser);
    } else if (c.kind === "linux-group") {
      displayTitle = c.title || c.linuxGroup || "grupo";
    } else {
      // Untitled ad-hoc group → the DISPLAY NAMES of the other members.
      displayTitle =
        c.title ||
        (c.members ?? [])
          .filter((m) => m !== username)
          .map((m) => memberNames[m] ?? m)
          .join(", ") ||
        "grupo";
    }
    const cursor = cursors.get(c.id);
    const unread =
      !!c.lastMessageAt &&
      c.lastMessageFrom !== username &&
      (!cursor || cursor < c.lastMessageAt);
    return {
      ...c,
      displayTitle,
      unread,
      memberNames,
      ...(otherUser ? { otherUser } : {}),
      ...(otherDisplayName ? { otherDisplayName } : {}),
      ...(isOnline !== undefined ? { online: isOnline } : {}),
    };
  },

  async getConversation(
    executor: Executor,
    username: string,
    convId: string,
  ): Promise<ChatConversation> {
    const conv = await conversationsRepository.get(executor, convId);
    if (!conv) throw new NotFoundError("Conversación no encontrada");
    const participants = await participantsOf(executor, conv);
    if (!participants.includes(username)) throw new ForbiddenError("No participas en esta conversación");
    return conv;
  },

  /** Idempotent: returns the existing DM or creates it. */
  async createOrGetDm(
    executor: Executor,
    me: string,
    other: string,
    viewer?: { username: string; isAdmin: boolean },
  ): Promise<ChatConversation> {
    if (!other || other === me) throw new ValidationError("Destinatario inválido");
    // Same privacy gate as the directory: a non-admin can only DM someone
    // visible to them (shares a group). Prevents bypassing the listing gate by
    // POSTing an arbitrary known username.
    const users = await directoryService.listUsers(executor, viewer);
    if (!users.some((u) => u.username === other)) {
      throw new NotFoundError("El usuario no existe en este servidor");
    }
    const id = dmId(me, other);
    const existing = await conversationsRepository.get(executor, id);
    if (existing) return existing;
    const now = new Date().toISOString();
    return conversationsRepository.create(executor, {
      id,
      kind: "dm",
      title: null,
      members: [me, other].sort(),
      createdBy: me,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: null,
      lastMessagePreview: null,
      lastMessageFrom: null,
    });
  },

  /** Create an ad-hoc group chat with hand-picked members. */
  async createGroup(
    executor: Executor,
    me: string,
    input: { title: string; members: string[] },
    viewer?: { username: string; isAdmin: boolean },
  ): Promise<ChatConversation> {
    const title = (input.title ?? "").trim();
    if (!title) throw new ValidationError("El grupo necesita un nombre");
    // Non-admins may only add members visible to them (same group), coherent
    // with the directory privacy gate.
    const users = await directoryService.listUsers(executor, viewer);
    const valid = new Set(users.map((u) => u.username));
    const members = Array.from(new Set([me, ...input.members.filter((m) => valid.has(m))]));
    if (members.length < 2) throw new ValidationError("Elige al menos un miembro");
    const now = new Date().toISOString();
    return conversationsRepository.create(executor, {
      id: randomUUID(),
      kind: "group",
      title,
      members,
      createdBy: me,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: null,
      lastMessagePreview: null,
      lastMessageFrom: null,
    });
  },

  /** Open (or lazily create) the chat for a real OS group the user belongs to. */
  async openLinuxGroup(executor: Executor, me: string, groupName: string): Promise<ChatConversation> {
    const live = await directoryService.groupMembers(executor, groupName);
    if (!live.includes(me)) throw new ForbiddenError("No perteneces a ese grupo");
    const id = linuxGroupId(groupName);
    const existing = await conversationsRepository.get(executor, id);
    const now = new Date().toISOString();
    if (existing) {
      // Refresh the cached membership snapshot.
      return (
        (await conversationsRepository.update(executor, id, { members: live, updatedAt: now })) ??
        existing
      );
    }
    return conversationsRepository.create(executor, {
      id,
      kind: "linux-group",
      title: groupName,
      members: live,
      linuxGroup: groupName,
      createdBy: me,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: null,
      lastMessagePreview: null,
      lastMessageFrom: null,
    });
  },

  async listMessages(
    executor: Executor,
    username: string,
    convId: string,
    opts: { before?: string; limit?: number },
  ): Promise<ChatMessage[]> {
    await this.getConversation(executor, username, convId); // auth gate
    const [rows, display] = await Promise.all([
      messagesRepository.list(executor, convId, opts),
      directoryService.displayNames(executor),
    ]);
    return rows.map((m) => decorate(m, display));
  },

  async sendMessage(
    executor: Executor,
    from: string,
    convId: string,
    body: string,
    rawAttachments: NewAttachment[] = [],
    host?: string,
  ): Promise<ChatMessage> {
    // Resolve conversation + participants ONCE (auth gate) and reuse the same
    // participant list for the event fan-out below, instead of re-running
    // `participantsOf` (2 remote `getent` calls for linux-group) a second time.
    const conv = await conversationsRepository.get(executor, convId);
    if (!conv) throw new NotFoundError("Conversación no encontrada");
    const participants = await participantsOf(executor, conv);
    if (!participants.includes(from)) throw new ForbiddenError("No participas en esta conversación");
    const text = (body ?? "").trim();
    if (!text && rawAttachments.length === 0) throw new ValidationError("Mensaje vacío");

    let attachments: ChatAttachmentRef[] = [];
    if (rawAttachments.length) {
      attachments = await attachmentsRepository.storeMany(executor, convId, rawAttachments);
    }

    const now = new Date().toISOString();
    const message = await messagesRepository.create(executor, convId, {
      id: randomUUID(),
      convId,
      from,
      body: text,
      attachments,
      createdAt: now,
    });

    const display = await directoryService.displayNames(executor);
    const decorated = decorate(message, display);

    const preview = previewOf(text, attachments);
    await conversationsRepository.update(executor, convId, {
      lastMessageAt: now,
      lastMessagePreview: preview,
      lastMessageFrom: from,
      updatedAt: now,
    });
    // Author has implicitly read their own message.
    await readsRepository.markRead(executor, convId, from, now).catch(() => undefined);

    chatBus.emit(CHAT_EVENTS.MESSAGE, {
      targetId: executor.target.id,
      participants,
      conversation: {
        id: conv.id,
        kind: conv.kind,
        title: conv.title ?? null,
        members: conv.members,
        memberNames: namesFor(conv.members ?? [], display),
        lastMessageAt: now,
        lastMessagePreview: preview,
        lastMessageFrom: from,
      },
      message: decorated,
    });
    // Bell + device push for participants who are NOT actively in the chat.
    void this.notifyAwayRecipients(executor, conv, from, participants, preview, host);
    return decorated;
  },

  /**
   * Persist a SYSTEM message in a conversation and fan it out exactly like a
   * human one (F3: "Llamada de voz · 04:12 · 3 participantes").
   *
   * Differences from `sendMessage`: no membership gate (the caller is the
   * server itself, reacting to a signed Tolqia webhook), no attachments, no
   * away-push (a finished call already rang), and the author is the synthetic
   * `SYSTEM_AUTHOR` so no display name is ever resolved for it. The
   * conversation preview IS updated — the row should show the call outcome.
   */
  async postSystemMessage(
    executor: Executor,
    convId: string,
    body: string,
    system: ChatMessageSystem,
  ): Promise<ChatMessage | null> {
    const conv = await conversationsRepository.get(executor, convId);
    if (!conv) return null;
    const now = new Date().toISOString();
    const message = await messagesRepository.create(executor, convId, {
      id: randomUUID(),
      convId,
      from: SYSTEM_AUTHOR,
      body,
      attachments: [],
      createdAt: now,
      system,
    });
    // What travels (SSE + return value) is the LIGHT copy: the transcript stays
    // in the sidecar and is fetched on demand.
    const light = stripTranscript(message);

    const [participants, display] = await Promise.all([
      participantsOf(executor, conv),
      directoryService.displayNames(executor).catch(() => new Map<string, string>()),
    ]);
    const preview = body.slice(0, PREVIEW_MAX);
    await conversationsRepository.update(executor, convId, {
      lastMessageAt: now,
      lastMessagePreview: preview,
      lastMessageFrom: SYSTEM_AUTHOR,
      updatedAt: now,
    });

    chatBus.emit(CHAT_EVENTS.MESSAGE, {
      targetId: executor.target.id,
      participants,
      conversation: {
        id: conv.id,
        kind: conv.kind,
        title: conv.title ?? null,
        members: conv.members,
        memberNames: namesFor(conv.members ?? [], display),
        lastMessageAt: now,
        lastMessagePreview: preview,
        lastMessageFrom: SYSTEM_AUTHOR,
      },
      message: light,
    });
    return light;
  },

  /**
   * Map away usernames to LP-resolvable recipients (`{ username, userId? }`).
   * Pure per-server data mapping — split out from the cross-module emit in
   * `notifyAwayRecipients` so the mapping and the fan-out are separate concerns
   * (and the mapping is testable in isolation). A per-user lookup failure
   * degrades to `{ username }` only (no `userId`), never throws.
   */
  async resolveRecipients(
    executor: Executor,
    usernames: string[],
  ): Promise<Array<{ username: string; userId?: number }>> {
    // Single read of the users sidecar + in-memory map, instead of one full
    // collection read+parse per username (N+1 over SSH on every message).
    const all = await panelUserRepository.findAll(executor).catch(() => []);
    const byUsername = new Map<string, number>();
    for (const u of all) {
      if (typeof u.id === "number") byUsername.set(u.username.toLowerCase(), u.id);
    }
    return usernames.map((username) => {
      const userId = byUsername.get(username.toLowerCase());
      return typeof userId === "number" ? { username, userId } : { username };
    });
  },

  /**
   * Fire a per-recipient bell + device push for participants who have no live
   * chat stream open (they're away — app closed / not on the panel). Recipients
   * actively connected see the message live + the unread badge, so they're
   * skipped here. Emits ONE `CHAT_MESSAGE_RECEIVED` event the notifications and
   * server-alerts modules subscribe to (no cross-module logic coupling).
   */
  async notifyAwayRecipients(
    executor: Executor,
    conv: ChatConversation,
    from: string,
    participants: string[],
    preview: string,
    host?: string,
  ): Promise<void> {
    try {
      const targetId = executor.target.id;
      const away = participants.filter((u) => u !== from && !chatPresence.isPresent(targetId, u));
      if (!away.length) return;
      const recipients = await this.resolveRecipients(executor, away);
      // Push titles show the HUMAN name, never the Linux login (Block B).
      const display = await directoryService.displayNames(executor);
      const fromName = display.get(from) ?? from;
      const title =
        conv.kind === "dm" ? fromName : `${fromName} · ${conv.title || conv.linuxGroup || "grupo"}`;
      eventBus.emit(Events.CHAT_MESSAGE_RECEIVED, {
        host: host ?? null,
        targetId,
        convId: conv.id,
        title,
        body: preview || "Nuevo mensaje",
        recipients,
      });
    } catch (err) {
      log.warn({ err: (err as Error).message }, "notifyAwayRecipients failed");
    }
  },

  async markRead(executor: Executor, username: string, convId: string): Promise<void> {
    await this.getConversation(executor, username, convId);
    const now = new Date().toISOString();
    await readsRepository.markRead(executor, convId, username, now);
    chatBus.emit(CHAT_EVENTS.READ, {
      targetId: executor.target.id,
      participants: [username],
      convId,
      username,
      at: now,
    });
  },

  async editMessage(
    executor: Executor,
    username: string,
    convId: string,
    messageId: string,
    body: string,
  ): Promise<ChatMessage> {
    const conv = await this.getConversation(executor, username, convId);
    const msg = await messagesRepository.get(executor, convId, messageId);
    if (!msg) throw new NotFoundError("Mensaje no encontrado");
    if (msg.from !== username) throw new ForbiddenError("Solo puedes editar tus mensajes");
    const text = (body ?? "").trim();
    if (!text) throw new ValidationError("Mensaje vacío");
    const updated = await messagesRepository.update(executor, convId, messageId, {
      body: text,
      editedAt: new Date().toISOString(),
    });
    if (updated) await this.emitMessageUpdate(executor, conv, updated);
    return updated!;
  },

  async deleteMessage(
    executor: Executor,
    username: string,
    convId: string,
    messageId: string,
  ): Promise<ChatMessage> {
    const conv = await this.getConversation(executor, username, convId);
    const msg = await messagesRepository.get(executor, convId, messageId);
    if (!msg) throw new NotFoundError("Mensaje no encontrado");
    if (msg.from !== username) throw new ForbiddenError("Solo puedes borrar tus mensajes");
    const updated = await messagesRepository.update(executor, convId, messageId, {
      body: "",
      attachments: [],
      deletedAt: new Date().toISOString(),
    });
    if (updated) await this.emitMessageUpdate(executor, conv, updated);
    return updated!;
  },

  async emitMessageUpdate(
    executor: Executor,
    conv: ChatConversation,
    message: ChatMessage,
  ): Promise<void> {
    const [participants, display] = await Promise.all([
      participantsOf(executor, conv),
      directoryService.displayNames(executor),
    ]);
    chatBus.emit(CHAT_EVENTS.MESSAGE, {
      targetId: executor.target.id,
      participants,
      conversation: {
        id: conv.id,
        kind: conv.kind,
        title: conv.title ?? null,
        members: conv.members,
        memberNames: namesFor(conv.members ?? [], display),
        lastMessageAt: conv.lastMessageAt ?? null,
        lastMessagePreview: conv.lastMessagePreview ?? null,
        lastMessageFrom: conv.lastMessageFrom ?? null,
      },
      message: decorate(message, display),
    });
  },

  // ── Profile (Block C: presence opt-out + status line) ────────────────────

  /** The caller's own chat profile (defaults when never saved). */
  async getMyProfile(executor: Executor, username: string): Promise<ChatProfile> {
    return profilesRepository.get(executor, username);
  },

  /** Partial update of the caller's OWN profile — never someone else's. */
  async updateMyProfile(
    executor: Executor,
    username: string,
    patch: { showOnline?: boolean; statusMessage?: string | null },
  ): Promise<ChatProfile> {
    return profilesRepository.upsert(executor, username, patch);
  },

  // ── Attachments (Block D: the "Multimedia" drawer) ───────────────────────

  /**
   * Every attachment of a conversation, newest first, joined with the
   * attachments index for `size`. Soft-deleted messages contribute nothing
   * (their `attachments` array is cleared on delete, but we also skip them
   * explicitly so a legacy row can never resurrect a deleted file).
   *
   * `getConversation` is the membership gate — a non-participant gets 403/404
   * exactly like every other read in this service.
   */
  async listAttachments(
    executor: Executor,
    username: string,
    convId: string,
  ): Promise<ChatAttachmentListItem[]> {
    await this.getConversation(executor, username, convId); // auth gate
    const [messages, sizes, display] = await Promise.all([
      messagesRepository.listAll(executor, convId),
      attachmentsRepository.listByConvId(executor, convId),
      directoryService.displayNames(executor),
    ]);

    const items: ChatAttachmentListItem[] = [];
    for (const msg of messages) {
      if (msg.deletedAt) continue;
      for (const att of msg.attachments ?? []) {
        if (!att?.id) continue;
        items.push({
          id: att.id,
          name: att.name,
          mimeType: att.mimeType,
          size: sizes.get(att.id) ?? null,
          createdAt: msg.createdAt,
          messageId: msg.id,
          from: msg.from,
          fromDisplayName: display.get(msg.from) ?? msg.from,
        });
      }
    }
    return items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  },

  /** Count of conversations with unread activity (cheap badge source). */
  async unreadCount(executor: Executor, username: string): Promise<number> {
    const [convs, cursors] = await Promise.all([
      conversationsRepository.listForUser(executor, username),
      readsRepository.cursorsForUser(executor, username),
    ]);
    let count = 0;
    for (const c of convs) {
      if (!c.lastMessageAt || c.lastMessageFrom === username) continue;
      const cursor = cursors.get(c.id);
      if (!cursor || cursor < c.lastMessageAt) count++;
    }
    return count;
  },
};
