// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";
import type { SessionUser } from "../../shared/types/index.js";
import { localExecutor } from "../../shared/executor/index.js";
import { runWithExecutor } from "../../shared/executor/context.js";

const { findAll } = vi.hoisted(() => ({ findAll: vi.fn(async () => [{ id: 1, url: "https://hooks.example.com/x", events: ["user.created"], enabled: true, secret: "private" }]) }));
vi.mock("./repositories/webhook.repository.js", () => ({ webhookRepository: { findAll } }));
import { webhooksAgentCapability } from "./agent-capability.js";

describe("webhooks AI capability", () => {
  const handler = webhooksAgentCapability.tools[0]!.handler;
  it("rejects a non-admin assistant session", async () => {
    const user = { kind: "user", userId: 2 } as SessionUser;
    await expect(runWithExecutor(localExecutor, () => handler({}), 2, user)).rejects.toThrow();
    expect(findAll).not.toHaveBeenCalled();
  });
  it("returns destinations without signing secrets to an admin", async () => {
    const user = { kind: "admin", userId: 1 } as SessionUser;
    const result = await runWithExecutor(localExecutor, () => handler({}), 1, user);
    expect(result).toMatchObject({ ok: true, output: [{ url: "https://hooks.example.com/x", active: true }] });
    expect(JSON.stringify(result)).not.toContain("private");
  });
});
