// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — `chatService.listAttachments` (Block D, the media drawer).
 *
 * Contract: every attachment of every NON-deleted message, newest first, with
 * `size` joined from the attachments index and the author's display name — and
 * a hard membership gate (a non-participant gets Forbidden, never a listing).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../auth/repositories/panel-user.repository.js", () => ({
  panelUserRepository: { findAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../repositories/conversations.repository.js", () => ({
  conversationsRepository: { get: vi.fn(), listForUser: vi.fn(), update: vi.fn(), create: vi.fn() },
}));

vi.mock("../repositories/messages.repository.js", () => ({
  messagesRepository: { listAll: vi.fn(), list: vi.fn(), get: vi.fn(), update: vi.fn(), create: vi.fn() },
}));

vi.mock("../repositories/attachments.repository.js", () => ({
  attachmentsRepository: { listByConvId: vi.fn(), get: vi.fn(), read: vi.fn(), storeMany: vi.fn() },
}));

vi.mock("../repositories/reads.repository.js", () => ({
  readsRepository: { cursorsForUser: vi.fn(), markRead: vi.fn() },
}));

vi.mock("./directory.service.js", () => ({
  directoryService: { displayNames: vi.fn(), listUsers: vi.fn(), groupMembers: vi.fn() },
}));

vi.mock("../../../shared/events/index.js", () => ({
  eventBus: { emit: vi.fn(), on: vi.fn() },
  Events: { CHAT_MESSAGE_RECEIVED: "chat:message-received" },
}));

import { chatService } from "./chat.service.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { messagesRepository } from "../repositories/messages.repository.js";
import { attachmentsRepository } from "../repositories/attachments.repository.js";
import { directoryService } from "./directory.service.js";
import { ForbiddenError, NotFoundError } from "../../../shared/errors/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { ChatConversation, ChatMessage } from "../models/chat.model.js";

const executor = { target: { id: "t1", name: "t1" } } as unknown as Executor;

const CONV: ChatConversation = {
  id: "c1",
  kind: "group",
  title: "Equipo Infra",
  members: ["alice", "bob"],
  createdBy: "alice",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  lastMessageAt: null,
  lastMessagePreview: null,
  lastMessageFrom: null,
};

const msg = (over: Partial<ChatMessage>): ChatMessage => ({
  id: "m",
  convId: "c1",
  from: "alice",
  body: "",
  attachments: [],
  createdAt: "2026-01-01T10:00:00.000Z",
  ...over,
});

beforeEach(() => {
  vi.mocked(conversationsRepository.get).mockResolvedValue(CONV);
  vi.mocked(directoryService.displayNames).mockResolvedValue(
    new Map([
      ["alice", "Alice Álvarez"],
      ["bob", "Bob Bernal"],
    ]),
  );
  vi.mocked(attachmentsRepository.listByConvId).mockResolvedValue(
    new Map([
      ["a1", 1024],
      ["a2", 2048],
    ]),
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("chatService.listAttachments", () => {
  it("joins message rows with the index (size) and the directory (display name)", async () => {
    vi.mocked(messagesRepository.listAll).mockResolvedValue([
      msg({
        id: "m1",
        from: "alice",
        createdAt: "2026-01-01T10:00:00.000Z",
        attachments: [{ id: "a1", name: "plan.pdf", mimeType: "application/pdf" }],
      }),
      msg({
        id: "m2",
        from: "bob",
        createdAt: "2026-01-02T10:00:00.000Z",
        attachments: [{ id: "a2", name: "clip.mp4", mimeType: "video/mp4" }],
      }),
    ]);

    const rows = await chatService.listAttachments(executor, "alice", "c1");

    // Newest first.
    expect(rows.map((r) => r.id)).toEqual(["a2", "a1"]);
    expect(rows[0]).toEqual({
      id: "a2",
      name: "clip.mp4",
      mimeType: "video/mp4",
      size: 2048,
      createdAt: "2026-01-02T10:00:00.000Z",
      messageId: "m2",
      from: "bob",
      fromDisplayName: "Bob Bernal",
    });
    expect(rows[1]?.size).toBe(1024);
  });

  it("reports size null when the index has no record for the id", async () => {
    vi.mocked(messagesRepository.listAll).mockResolvedValue([
      msg({ id: "m1", attachments: [{ id: "ghost", name: "x.png", mimeType: "image/png" }] }),
    ]);

    const rows = await chatService.listAttachments(executor, "alice", "c1");
    expect(rows[0]?.size).toBeNull();
  });

  it("excludes attachments of soft-deleted messages", async () => {
    vi.mocked(messagesRepository.listAll).mockResolvedValue([
      msg({
        id: "m1",
        attachments: [{ id: "a1", name: "plan.pdf", mimeType: "application/pdf" }],
        deletedAt: "2026-01-03T00:00:00.000Z",
      }),
      msg({
        id: "m2",
        createdAt: "2026-01-02T10:00:00.000Z",
        attachments: [{ id: "a2", name: "clip.mp4", mimeType: "video/mp4" }],
      }),
    ]);

    const rows = await chatService.listAttachments(executor, "alice", "c1");
    expect(rows.map((r) => r.id)).toEqual(["a2"]);
  });

  it("returns [] for a conversation with no attachments", async () => {
    vi.mocked(messagesRepository.listAll).mockResolvedValue([msg({ id: "m1", body: "hola" })]);
    await expect(chatService.listAttachments(executor, "alice", "c1")).resolves.toEqual([]);
  });

  it("throws Forbidden for a non-member (no listing leaks)", async () => {
    vi.mocked(messagesRepository.listAll).mockResolvedValue([]);

    await expect(chatService.listAttachments(executor, "mallory", "c1")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(messagesRepository.listAll).not.toHaveBeenCalled();
  });

  it("throws NotFound for an unknown conversation", async () => {
    vi.mocked(conversationsRepository.get).mockResolvedValue(null);

    await expect(chatService.listAttachments(executor, "alice", "nope")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
