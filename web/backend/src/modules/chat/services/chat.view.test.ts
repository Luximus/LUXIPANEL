// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — Block B: the UI must NEVER see a raw Linux login.
 *
 * Covers the three places a name reaches the client: the conversation view
 * (`toView` → `memberNames` / `displayTitle` / `otherDisplayName`), the message
 * list (`fromDisplayName` decoration) and the device push title
 * (`notifyAwayRecipients`). Mocks follow the `chat.recipients.test.ts` pattern.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../auth/repositories/panel-user.repository.js", () => ({
  panelUserRepository: { findAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../repositories/conversations.repository.js", () => ({
  conversationsRepository: {
    get: vi.fn(),
    listForUser: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("../repositories/messages.repository.js", () => ({
  messagesRepository: { list: vi.fn(), listAll: vi.fn(), get: vi.fn(), update: vi.fn(), create: vi.fn() },
}));

vi.mock("../repositories/reads.repository.js", () => ({
  readsRepository: { cursorsForUser: vi.fn(), markRead: vi.fn() },
}));

vi.mock("./directory.service.js", () => ({
  directoryService: {
    displayNames: vi.fn(),
    listUsers: vi.fn(),
    groupMembers: vi.fn(),
  },
}));

vi.mock("../../../shared/events/index.js", () => ({
  eventBus: { emit: vi.fn(), on: vi.fn() },
  Events: { CHAT_MESSAGE_RECEIVED: "chat:message-received" },
}));

import { chatService } from "./chat.service.js";
import { conversationsRepository } from "../repositories/conversations.repository.js";
import { messagesRepository } from "../repositories/messages.repository.js";
import { directoryService } from "./directory.service.js";
import { eventBus } from "../../../shared/events/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { ChatConversation } from "../models/chat.model.js";

const executor = { target: { id: "t1", name: "t1" } } as unknown as Executor;

const NAMES = new Map([
  ["alice", "Alice Álvarez"],
  ["bob", "Bob Bernal"],
  ["carol", "Carol Cano"],
]);

const baseConv = (over: Partial<ChatConversation>): ChatConversation => ({
  id: "c1",
  kind: "dm",
  title: null,
  members: ["alice", "bob"],
  createdBy: "alice",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  lastMessageAt: null,
  lastMessagePreview: null,
  lastMessageFrom: null,
  ...over,
});

beforeEach(() => {
  vi.mocked(directoryService.displayNames).mockResolvedValue(NAMES);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("chatService.toView — display names only", () => {
  const cursors = new Map<string, string>();

  it("uses the counterpart's display name for a DM (title + otherDisplayName)", () => {
    const view = chatService.toView(baseConv({}), "alice", cursors, NAMES, new Set(["bob"]));

    expect(view.displayTitle).toBe("Bob Bernal");
    expect(view.otherUser).toBe("bob");
    expect(view.otherDisplayName).toBe("Bob Bernal");
    expect(view.online).toBe(true);
    expect(view.memberNames).toEqual({ alice: "Alice Álvarez", bob: "Bob Bernal" });
  });

  it("falls back to the username when the directory has no GECOS name", () => {
    const view = chatService.toView(
      baseConv({ members: ["alice", "dave"] }),
      "alice",
      cursors,
      NAMES,
      new Set(),
    );

    expect(view.displayTitle).toBe("dave");
    expect(view.memberNames["dave"]).toBe("dave");
  });

  it("titles an untitled ad-hoc group with the other members' display names", () => {
    const view = chatService.toView(
      baseConv({ id: "g1", kind: "group", title: null, members: ["alice", "bob", "carol"] }),
      "alice",
      cursors,
      NAMES,
      new Set(),
    );

    expect(view.displayTitle).toBe("Bob Bernal, Carol Cano");
    expect(view.displayTitle).not.toMatch(/\bbob\b/);
    expect(view.memberNames).toEqual({
      alice: "Alice Álvarez",
      bob: "Bob Bernal",
      carol: "Carol Cano",
    });
  });

  it("keeps an explicit group title and still exposes memberNames", () => {
    const view = chatService.toView(
      baseConv({ id: "g2", kind: "group", title: "Equipo Infra", members: ["alice", "bob"] }),
      "alice",
      cursors,
      NAMES,
      new Set(),
    );

    expect(view.displayTitle).toBe("Equipo Infra");
    expect(view.memberNames["bob"]).toBe("Bob Bernal");
  });
});

describe("chatService.listMessages — fromDisplayName decoration", () => {
  it("decorates every row without persisting the name", async () => {
    vi.mocked(conversationsRepository.get).mockResolvedValue(baseConv({}));
    vi.mocked(messagesRepository.list).mockResolvedValue([
      {
        id: "m1",
        convId: "c1",
        from: "bob",
        body: "hola",
        attachments: [],
        createdAt: "2026-01-01T10:00:00.000Z",
      },
      {
        id: "m2",
        convId: "c1",
        from: "zed",
        body: "eh",
        attachments: [],
        createdAt: "2026-01-01T10:01:00.000Z",
      },
    ]);

    const rows = await chatService.listMessages(executor, "alice", "c1", {});

    expect(rows.map((m) => m.fromDisplayName)).toEqual(["Bob Bernal", "zed"]);
    // The repository row itself was never mutated (nothing persisted).
    const persisted = vi.mocked(messagesRepository.list).mock.results[0]?.value;
    await expect(persisted).resolves.toEqual([
      expect.not.objectContaining({ fromDisplayName: expect.anything() }),
      expect.not.objectContaining({ fromDisplayName: expect.anything() }),
    ]);
  });
});

describe("chatService.notifyAwayRecipients — push title", () => {
  it("uses the sender's display name for a DM", async () => {
    await chatService.notifyAwayRecipients(
      executor,
      baseConv({}),
      "bob",
      ["alice", "bob"],
      "hola",
      "panel.example.com",
    );

    const payload = vi.mocked(eventBus.emit).mock.calls[0]?.[1] as { title: string };
    expect(payload.title).toBe("Bob Bernal");
  });

  it("uses `<display name> · <group title>` for a group", async () => {
    await chatService.notifyAwayRecipients(
      executor,
      baseConv({ id: "g1", kind: "group", title: "Equipo Infra", members: ["alice", "bob"] }),
      "bob",
      ["alice", "bob"],
      "hola",
    );

    const payload = vi.mocked(eventBus.emit).mock.calls[0]?.[1] as { title: string };
    expect(payload.title).toBe("Bob Bernal · Equipo Infra");
  });

  it("emits nothing when every recipient is the sender", async () => {
    await chatService.notifyAwayRecipients(executor, baseConv({}), "bob", ["bob"], "hola");
    expect(eventBus.emit).not.toHaveBeenCalled();
  });
});
