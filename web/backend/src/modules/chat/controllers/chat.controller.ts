// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Chat controller — HTTP surface for the bell dropdown + the /panel/chat
 * screen. The SSE endpoint (`stream`) keeps a long-lived response open and
 * pushes `chat:message` / `chat:read` events from the in-process chatBus,
 * filtered to the connection's server (targetId) and username.
 */

import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler, type SessionUser } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { openSse } from "../../../shared/http/sse.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../../shared/errors/index.js";
import { NO_CACHE_HEADER, SSE_CONTENT_TYPE } from "../../../shared/constants.js";
import { chatService, chatBus, chatPresence, CHAT_EVENTS } from "../services/chat.service.js";
import { directoryService } from "../services/directory.service.js";
import { attachmentsRepository } from "../repositories/attachments.repository.js";
import { resolveInlinePolicy } from "./attachment-headers.js";
import { tolqiaBridge } from "../services/tolqia-bridge.service.js";
import { env } from "../../../config/env.js";
import type { ChatCallEvent } from "../../../shared/chat-call-types.js";
import type { Executor } from "../../../shared/executor/index.js";

function sessionUser(res: Response): SessionUser {
  const user = res.locals.user as SessionUser | undefined;
  if (!user) throw new ForbiddenError("Autenticación requerida");
  return user;
}

function requireExecutor(req: Request): Executor {
  const executor = getExecutor(req);
  if (!executor) throw new NotFoundError("Ningún servidor conectado");
  return executor;
}

// ── Attachment byte cache (tiny LRU) ────────────────────────────────────────
// Media players issue MANY `Range` requests for the same file; `readBlob` pulls
// the whole blob over SSH each time, so without this a single video scrub would
// mean dozens of full remote reads. Keyed per TARGET so bytes never cross
// servers, capped at 8 entries × 60 s (bounded memory, never authoritative).
const BLOB_CACHE_MAX = 8;
const BLOB_CACHE_TTL_MS = 60_000;
const blobCache = new Map<string, { at: number; buf: Buffer }>();

function cachedBlob(key: string): Buffer | null {
  const hit = blobCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > BLOB_CACHE_TTL_MS) {
    blobCache.delete(key);
    return null;
  }
  // Refresh recency (Map preserves insertion order → re-insert = most recent).
  blobCache.delete(key);
  blobCache.set(key, hit);
  return hit.buf;
}

function storeBlob(key: string, buf: Buffer): void {
  blobCache.delete(key);
  blobCache.set(key, { at: Date.now(), buf });
  while (blobCache.size > BLOB_CACHE_MAX) {
    const oldest = blobCache.keys().next().value;
    if (oldest === undefined) break;
    blobCache.delete(oldest);
  }
}

const profileSchema = z.object({
  showOnline: z.boolean().optional(),
  statusMessage: z.string().trim().max(80).nullable().optional(),
});

const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(256),
  mimeType: z.string().trim().min(1).max(128),
  dataBase64: z.string().max(20_000_000),
});

const sendSchema = z.object({
  body: z.string().max(8_000).optional(),
  attachments: z.array(attachmentSchema).max(10).optional(),
});

const createSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("dm"), username: z.string().trim().min(1).max(64) }),
  z.object({
    kind: z.literal("group"),
    title: z.string().trim().min(1).max(80),
    members: z.array(z.string().trim().min(1).max(64)).max(64).default([]),
  }),
  z.object({ kind: z.literal("linux-group"), group: z.string().trim().min(1).max(64) }),
]);

const messagesQuerySchema = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export const chatController = {
  /** GET /api/chat/conversations */
  listConversations: asyncHandler(async (req: Request, res: Response) => {
    const user = sessionUser(res);
    const executor = requireExecutor(req);
    const data = await chatService.listConversations(executor, user.username);
    res.json({ ok: true, data });
  }),

  /** GET /api/chat/unread-count */
  unreadCount: asyncHandler(async (req: Request, res: Response) => {
    const user = sessionUser(res);
    const executor = requireExecutor(req);
    const count = await chatService.unreadCount(executor, user.username);
    res.json({ ok: true, count });
  }),

  /** GET /api/chat/directory — users + groups for the "new chat" picker. */
  directory: asyncHandler(async (req: Request, res: Response) => {
    const user = sessionUser(res);
    const executor = requireExecutor(req);
    const [users, groups] = await Promise.all([
      directoryService.listUsers(executor, { username: user.username, isAdmin: user.kind === "admin" }),
      directoryService.listGroupsForUser(executor, user.username),
    ]);
    res.json({ ok: true, data: { users: users.filter((u) => u.username !== user.username), groups } });
  }),

  /** GET /api/chat/conversations/:id/messages */
  listMessages: asyncHandler(async (req: Request, res: Response) => {
    const user = sessionUser(res);
    const executor = requireExecutor(req);
    const parsed = messagesQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError(parsed.error.message);
    const convId = String(req.params.id ?? "");
    const data = await chatService.listMessages(executor, user.username, convId, parsed.data);
    res.json({ ok: true, data });
  }),

  /** POST /api/chat/conversations */
  createConversation: asyncHandler(async (req: Request, res: Response) => {
    const user = sessionUser(res);
    const executor = requireExecutor(req);
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);
    const input = parsed.data;
    const viewer = { username: user.username, isAdmin: user.kind === "admin" };
    let conv;
    if (input.kind === "dm") {
      conv = await chatService.createOrGetDm(executor, user.username, input.username, viewer);
    } else if (input.kind === "group") {
      conv = await chatService.createGroup(executor, user.username, {
        title: input.title,
        members: input.members,
      }, viewer);
    } else {
      conv = await chatService.openLinuxGroup(executor, user.username, input.group);
    }
    res.status(201).json({ ok: true, data: conv });
  }),

  /** POST /api/chat/conversations/:id/messages */
  sendMessage: asyncHandler(async (req: Request, res: Response) => {
    const user = sessionUser(res);
    const executor = requireExecutor(req);
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);
    const convId = String(req.params.id ?? "");
    const message = await chatService.sendMessage(
      executor,
      user.username,
      convId,
      parsed.data.body ?? "",
      parsed.data.attachments ?? [],
      user.targetHost,
    );
    res.status(201).json({ ok: true, data: message });
  }),

  /** POST /api/chat/conversations/:id/read */
  markRead: asyncHandler(async (req: Request, res: Response) => {
    const user = sessionUser(res);
    const executor = requireExecutor(req);
    const convId = String(req.params.id ?? "");
    await chatService.markRead(executor, user.username, convId);
    res.json({ ok: true });
  }),

  /** PATCH /api/chat/conversations/:id/messages/:messageId */
  editMessage: asyncHandler(async (req: Request, res: Response) => {
    const user = sessionUser(res);
    const executor = requireExecutor(req);
    const convId = String(req.params.id ?? "");
    const messageId = String(req.params.messageId ?? "");
    const body = z.object({ body: z.string().max(8_000) }).safeParse(req.body);
    if (!body.success) throw new ValidationError(body.error.message);
    const message = await chatService.editMessage(executor, user.username, convId, messageId, body.data.body);
    res.json({ ok: true, data: message });
  }),

  /** DELETE /api/chat/conversations/:id/messages/:messageId */
  deleteMessage: asyncHandler(async (req: Request, res: Response) => {
    const user = sessionUser(res);
    const executor = requireExecutor(req);
    const convId = String(req.params.id ?? "");
    const messageId = String(req.params.messageId ?? "");
    const message = await chatService.deleteMessage(executor, user.username, convId, messageId);
    res.json({ ok: true, data: message });
  }),

  /**
   * GET /api/chat/conversations/:id/messages/:messageId/transcript
   *
   * The per-speaker history of a finished call: what each participant said in
   * their own language plus the translations produced for it. The gate is
   * conversation membership; every segment carries a DISPLAY NAME (bloque B).
   */
  callTranscript: asyncHandler(async (req: Request, res: Response) => {
    const user = sessionUser(res);
    const executor = requireExecutor(req);
    const convId = String(req.params.id ?? "");
    const messageId = String(req.params.messageId ?? "");
    const data = await tolqiaBridge.getCallTranscript(executor, user.username, convId, messageId);
    res.json({ ok: true, data });
  }),

  /** GET /api/chat/conversations/:id/attachments — media drawer listing. */
  listAttachments: asyncHandler(async (req: Request, res: Response) => {
    const user = sessionUser(res);
    const executor = requireExecutor(req);
    const convId = String(req.params.id ?? "");
    const data = await chatService.listAttachments(executor, user.username, convId);
    res.json({ ok: true, data });
  }),

  /** GET /api/chat/me/profile — own presence opt-out + status line. */
  getMyProfile: asyncHandler(async (req: Request, res: Response) => {
    const user = sessionUser(res);
    const executor = requireExecutor(req);
    const data = await chatService.getMyProfile(executor, user.username);
    res.json({ ok: true, data });
  }),

  /** PUT /api/chat/me/profile — partial update of the caller's OWN profile. */
  updateMyProfile: asyncHandler(async (req: Request, res: Response) => {
    const user = sessionUser(res);
    const executor = requireExecutor(req);
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);
    const data = await chatService.updateMyProfile(executor, user.username, parsed.data);
    res.json({ ok: true, data });
  }),

  /**
   * GET /api/chat/attachments/:id — serve stored bytes.
   *
   * The whole security decision (inline vs download, signature check, CSP,
   * Range) lives in the pure `resolveInlinePolicy`; this handler only does the
   * IDOR gate, the (cached) blob read and the write-out.
   */
  serveAttachment: asyncHandler(async (req: Request, res: Response) => {
    const user = sessionUser(res);
    const executor = requireExecutor(req);
    const id = String(req.params.id ?? "");
    const rec = await attachmentsRepository.get(executor, id);
    if (!rec || !rec.path) throw new NotFoundError("Adjunto no encontrado");
    // IDOR gate: the requester must participate in the attachment's conversation
    // (throws Forbidden/NotFound otherwise). Without this, any known attachment
    // id downloads files from other users' conversations.
    await chatService.getConversation(executor, user.username, rec.convId);

    const cacheKey = `${executor.target?.id ?? "local"}:${id}`;
    let buf = cachedBlob(cacheKey);
    if (!buf) {
      buf = await attachmentsRepository.read(executor, rec);
      storeBlob(cacheKey, buf);
    }

    const policy = resolveInlinePolicy({
      mimeType: rec.mimeType,
      name: rec.name,
      buf,
      rangeHeader: req.headers.range,
    });
    res.status(policy.status);
    res.setHeader("Content-Type", policy.contentType);
    for (const [key, value] of Object.entries(policy.headers)) res.setHeader(key, value);
    res.end(policy.body);
  }),

  /**
   * GET /api/chat/stream — Server-Sent Events feed.
   *
   * Delivers a chatBus event to this connection only when BOTH hold:
   *   1. event.targetId === this session's server (per-server isolation), AND
   *   2. this username is a participant (sender or recipient).
   */
  stream: (req: Request, res: Response) => {
    const user = res.locals.user as SessionUser | undefined;
    if (!user) {
      res.status(401).end();
      return;
    }
    const myUsername = user.username;
    const myTarget = getExecutor(req)?.target.id ?? user.targetId ?? "local";
    chatPresence.add(myTarget, myUsername);

    res.status(200);
    const sse = openSse(res, {
      contentType: SSE_CONTENT_TYPE,
      cacheControl: NO_CACHE_HEADER,
      greeting: () => `connected ${new Date().toISOString()}`,
      heartbeatComment: () => `heartbeat ${Date.now()}`,
    });

    const sendEvent = (event: string, data: unknown) => sse.send(data, { event });

    const scoped = (row: { targetId?: string; participants?: string[] }): boolean => {
      if (!row) return false;
      if (row.targetId !== myTarget) return false;
      return Array.isArray(row.participants) && row.participants.includes(myUsername);
    };

    const onMessage = (row: { targetId?: string; participants?: string[] }) => {
      if (scoped(row)) sendEvent("chat:message", row);
    };
    const onRead = (row: { targetId?: string; participants?: string[] }) => {
      if (scoped(row)) sendEvent("chat:read", row);
    };
    /**
     * F3 — calls. The bus carries ONE event kind; the SSE name is specialized
     * (`chat:call:ring|state|end`) so the browser can attach a listener per
     * concern instead of switching inside one handler.
     */
    const onCall = (row: ChatCallEvent) => {
      if (!scoped(row)) return;
      const name = row.event === "ring" ? "ring" : row.event === "end" ? "end" : "state";
      sendEvent(`chat:call:${name}`, row);
    };

    chatBus.on(CHAT_EVENTS.MESSAGE, onMessage);
    chatBus.on(CHAT_EVENTS.READ, onRead);
    chatBus.on(CHAT_EVENTS.CALL, onCall);

    /**
     * Greeting catch-up: a client that reloads mid-call (or opens the panel
     * while their phone is ringing) has missed the `ring` frame, so replay the
     * live call of every conversation they participate in as `chat:call:state`.
     * Best-effort — a Tolqia hiccup must never break the stream.
     */
    void (async () => {
      try {
        const executor = getExecutor(req);
        if (!executor || !env.CALL_ENABLED) return;
        const ids = tolqiaBridge.activeConversationIds(myTarget, myUsername);
        for (const id of ids) {
          const call = await tolqiaBridge.getActiveCall(executor, myUsername, id).catch(() => null);
          if (call) sendEvent("chat:call:state", { targetId: myTarget, participants: [myUsername], event: "state", call });
        }
      } catch {
        /* no catch-up is better than a broken stream */
      }
    })();

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      sse.close();
      chatBus.off(CHAT_EVENTS.MESSAGE, onMessage);
      chatBus.off(CHAT_EVENTS.READ, onRead);
      chatBus.off(CHAT_EVENTS.CALL, onCall);
      chatPresence.remove(myTarget, myUsername);
    };
    req.on("close", cleanup);
    req.on("aborted", cleanup);
    res.on("close", cleanup);
  },
};
