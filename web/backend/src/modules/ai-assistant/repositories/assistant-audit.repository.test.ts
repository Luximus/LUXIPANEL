// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";

const { store } = vi.hoisted(() => ({
  store: {
    create: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("../../../shared/data-store/make-kv-store.js", () => ({ makeKvStore: () => () => store }));

import { assistantAuditRepository } from "./assistant-audit.repository.js";

const legacy = {
  id: "entry-1",
  ts: "2026-09-29T00:00:00.000Z",
  provider: "servers:cross",
  tool: "servers.exec",
  success: true,
  durationMs: 10,
  kind: "cross-server" as const,
  targetServerId: "server-1",
  password: "ssh-password",
  passphrase: "key-passphrase",
  privateKey: "private-key-pem",
  command: "echo secret-token",
  outputPreview: "secret-output",
};

describe("assistant audit secret handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.list.mockResolvedValue([]);
  });

  it("never persists credentials, commands or output from a new entry", async () => {
    await assistantAuditRepository.append(legacy);
    const saved = store.create.mock.calls[0]?.[0];
    expect(saved).toMatchObject({ tool: "servers.exec", targetServerId: "server-1" });
    for (const field of ["password", "passphrase", "privateKey", "command", "outputPreview"]) {
      expect(saved).not.toHaveProperty(field);
    }
  });

  it("hides and purges secrets left by an older version", async () => {
    store.list.mockResolvedValue([legacy]);
    let persisted: Record<string, unknown> | undefined;
    store.transaction.mockImplementation(async (fn) => {
      const result = await fn({ [legacy.id]: legacy });
      persisted = result.next[legacy.id];
      return result.result;
    });

    const entries = await assistantAuditRepository.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ tool: "servers.exec", targetServerId: "server-1" });
    for (const field of ["password", "passphrase", "privateKey", "command", "outputPreview"]) {
      expect(entries[0]).not.toHaveProperty(field);
      expect(persisted).not.toHaveProperty(field);
    }
  });
});
