// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — chat away-notification plumbing.
 *
 * `resolveRecipients` is the per-server username→recipient mapping split out of
 * `notifyAwayRecipients` (SOC): it attaches a numeric `userId` when the panel
 * user is known, degrades to `{ username }` on a miss/failure, and never throws.
 * `chatPresence` is the primitive that decides who counts as "away".
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../auth/repositories/panel-user.repository.js", () => ({
  panelUserRepository: { findAll: vi.fn() },
}));

import { chatService, chatPresence } from "./chat.service.js";
import { panelUserRepository } from "../../auth/repositories/panel-user.repository.js";
import type { Executor } from "../../../shared/executor/index.js";

const repo = vi.mocked(panelUserRepository);
const executor = { target: { id: "t1", name: "t1" } } as unknown as Executor;

afterEach(() => {
  vi.clearAllMocks();
});

describe("chatService.resolveRecipients", () => {
  it("attaches userId when the panel user is found", async () => {
    repo.findAll.mockResolvedValue([{ username: "alice", id: 42 }] as never);

    const out = await chatService.resolveRecipients(executor, ["alice", "bob"]);

    expect(out).toEqual([{ username: "alice", userId: 42 }, { username: "bob" }]);
  });

  it("degrades to { username } when the lookup rejects (never throws)", async () => {
    repo.findAll.mockRejectedValue(new Error("sidecar unreadable"));

    const out = await chatService.resolveRecipients(executor, ["carol"]);

    expect(out).toEqual([{ username: "carol" }]);
  });

  it("omits userId when the found record has no numeric id", async () => {
    repo.findAll.mockResolvedValue([{ username: "dave", id: undefined }] as never);

    const out = await chatService.resolveRecipients(executor, ["dave"]);

    expect(out).toEqual([{ username: "dave" }]);
  });
});

describe("chatPresence — away detection primitive", () => {
  it("is not present until added, and present while ≥1 connection is open", () => {
    expect(chatPresence.isPresent("s1", "eve")).toBe(false);
    chatPresence.add("s1", "eve");
    expect(chatPresence.isPresent("s1", "eve")).toBe(true);
  });

  it("stays present until the last connection is removed (ref-counted)", () => {
    chatPresence.add("s2", "frank");
    chatPresence.add("s2", "frank");
    chatPresence.remove("s2", "frank");
    expect(chatPresence.isPresent("s2", "frank")).toBe(true);
    chatPresence.remove("s2", "frank");
    expect(chatPresence.isPresent("s2", "frank")).toBe(false);
  });

  it("keys presence per server (targetId), not globally", () => {
    chatPresence.add("srvA", "grace");
    expect(chatPresence.isPresent("srvA", "grace")).toBe(true);
    expect(chatPresence.isPresent("srvB", "grace")).toBe(false);
  });
});
