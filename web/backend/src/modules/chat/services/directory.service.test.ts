// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — chat/services/directory.service.ts
 *
 * Focus:
 *   • the privacy gate on `listUsers` (a non-admin viewer must only see users
 *     they share an OS group with — deny-by-default);
 *   • `displayNames` (Block B): passwd-only, memoised 60 s per target, fail-open;
 *   • `listGroupsForUser` (Block C): rich members with display name, presence
 *     and status, and the per-user presence opt-out from `chat/profiles.json`.
 */

import { beforeEach, describe, it, expect, vi } from "vitest";

vi.mock("../repositories/profiles.repository.js", () => ({
  profilesRepository: { listAll: vi.fn(), get: vi.fn(), upsert: vi.fn(), hiddenPresence: vi.fn() },
}));

import { directoryService } from "./directory.service.js";
import { profilesRepository } from "../repositories/profiles.repository.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { ChatProfile } from "../models/chat.model.js";

const PASSWD = [
  "root:x:0:0:root:/root:/bin/bash",
  "alice:x:1000:1000:Alice A:/home/alice:/bin/bash",
  "bob:x:1001:1001:Bob B:/home/bob:/bin/bash",
  "carol:x:1002:1002:Carol C:/home/carol:/bin/bash",
  "nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin",
].join("\n");

// alice + bob share the `developers` supplementary group; carol does not.
const GROUP = [
  "alice:x:1000:",
  "bob:x:1001:",
  "carol:x:1002:",
  "developers:x:2000:alice,bob",
].join("\n");

const profile = (over: Partial<ChatProfile>): ChatProfile => ({
  username: "x",
  showOnline: true,
  statusMessage: null,
  updatedAt: "",
  ...over,
});

/** Fake executor that answers the getent/id/who probes by substring. */
function fakeExecutor(opts: { who?: string; targetId?: string } = {}): Executor {
  const exec = vi.fn(async (cmd: string) => {
    let stdout = "";
    if (cmd.startsWith("getent passwd")) stdout = PASSWD;
    else if (cmd.startsWith("getent group")) stdout = GROUP;
    else if (cmd.startsWith("id ")) stdout = "alice developers"; // `id -nG alice` → alice's groups
    else if (cmd.startsWith("who")) stdout = opts.who ?? "";
    return { stdout, stderr: "", exitCode: 0 };
  });
  const id = opts.targetId ?? "t1";
  return { exec, target: { id, name: id } } as unknown as Executor;
}

beforeEach(() => {
  vi.clearAllMocks();
  directoryService.invalidateDisplayNames();
  vi.mocked(profilesRepository.listAll).mockResolvedValue(new Map());
});

describe("directoryService.listUsers privacy gate", () => {
  it("restricts a non-admin viewer to users sharing a group (excludes carol)", async () => {
    const users = await directoryService.listUsers(fakeExecutor(), { username: "alice", isAdmin: false });
    const names = users.map((u) => u.username).sort();
    expect(names).toEqual(["alice", "bob"]);
    expect(names).not.toContain("carol");
  });

  it("shows every human account to an admin viewer", async () => {
    const users = await directoryService.listUsers(fakeExecutor(), { username: "alice", isAdmin: true });
    expect(users.map((u) => u.username).sort()).toEqual(["alice", "bob", "carol"]);
  });

  it("shows every human account to internal callers (no viewer)", async () => {
    const users = await directoryService.listUsers(fakeExecutor());
    expect(users.map((u) => u.username).sort()).toEqual(["alice", "bob", "carol"]);
  });

  it("always filters out system accounts and nologin shells", async () => {
    const users = await directoryService.listUsers(fakeExecutor());
    const names = users.map((u) => u.username);
    expect(names).not.toContain("root");
    expect(names).not.toContain("nobody");
  });
});

describe("directoryService.displayNames (Block B)", () => {
  it("maps every passwd row to its GECOS name", async () => {
    const names = await directoryService.displayNames(fakeExecutor());

    expect(names.get("alice")).toBe("Alice A");
    expect(names.get("bob")).toBe("Bob B");
  });

  it("only runs `getent passwd` — never `who` or group probes", async () => {
    const executor = fakeExecutor();
    await directoryService.displayNames(executor);

    const calls = vi.mocked(executor.exec).mock.calls.map((c) => String(c[0]));
    expect(calls).toEqual(["getent passwd"]);
  });

  it("memoises per target for 60 s (second call does no I/O)", async () => {
    const executor = fakeExecutor();
    await directoryService.displayNames(executor);
    await directoryService.displayNames(executor);

    expect(executor.exec).toHaveBeenCalledTimes(1);
  });

  it("keys the cache per target — another server re-reads its own passwd", async () => {
    await directoryService.displayNames(fakeExecutor({ targetId: "srvA" }));
    const other = fakeExecutor({ targetId: "srvB" });
    await directoryService.displayNames(other);

    expect(other.exec).toHaveBeenCalledTimes(1);
  });

  it("fails open to an empty map when passwd is unreadable", async () => {
    const executor = {
      exec: vi.fn().mockRejectedValue(new Error("ssh down")),
      target: { id: "t9", name: "t9" },
    } as unknown as Executor;

    await expect(directoryService.displayNames(executor)).resolves.toEqual(new Map());
  });
});

describe("directoryService.listGroupsForUser (Block C)", () => {
  it("returns members as objects with display name, presence and status", async () => {
    vi.mocked(profilesRepository.listAll).mockResolvedValue(
      new Map([["bob", profile({ username: "bob", statusMessage: "En una reunión" })]]),
    );

    const groups = await directoryService.listGroupsForUser(
      fakeExecutor({ who: "bob pts/0 2026-01-01 10:00" }),
      "alice",
    );

    expect(groups.map((g) => g.name)).toEqual(["developers"]);
    expect(groups[0]?.members).toEqual([
      { username: "alice", displayName: "Alice A", online: false, status: null },
      { username: "bob", displayName: "Bob B", online: true, status: "En una reunión" },
    ]);
  });

  it("sorts members by display name, not by username", async () => {
    const groups = await directoryService.listGroupsForUser(fakeExecutor(), "alice");
    const names = groups[0]?.members.map((m) => m.displayName) ?? [];

    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("honours the presence opt-out (showOnline:false → online:false)", async () => {
    vi.mocked(profilesRepository.listAll).mockResolvedValue(
      new Map([["bob", profile({ username: "bob", showOnline: false })]]),
    );

    const groups = await directoryService.listGroupsForUser(
      fakeExecutor({ who: "bob pts/0 2026-01-01 10:00" }),
      "alice",
    );

    expect(groups[0]?.members.find((m) => m.username === "bob")?.online).toBe(false);
  });
});

describe("directoryService.listUsers — profile decoration (Block C)", () => {
  it("attaches the status line and hides presence for opted-out users", async () => {
    vi.mocked(profilesRepository.listAll).mockResolvedValue(
      new Map([
        ["bob", profile({ username: "bob", showOnline: false, statusMessage: "De vacaciones" })],
        ["carol", profile({ username: "carol", statusMessage: "Disponible" })],
      ]),
    );

    const users = await directoryService.listUsers(
      fakeExecutor({ who: "bob pts/0\ncarol pts/1" }),
    );
    const byName = new Map(users.map((u) => [u.username, u]));

    expect(byName.get("bob")).toMatchObject({ online: false, status: "De vacaciones" });
    expect(byName.get("carol")).toMatchObject({ online: true, status: "Disponible" });
    expect(byName.get("alice")).toMatchObject({ online: false, status: null });
  });
});
