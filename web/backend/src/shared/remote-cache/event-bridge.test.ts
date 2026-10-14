// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — event-bridge.ts (redundant cache invalidation via event bus)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const delSpy = vi.fn();
vi.mock("../redis/index.js", () => ({
  getRedis: () => ({
    async get() { return null; },
    async set() { return "OK"; },
    async del(k: string) { delSpy(k); return 1; },
  }),
}));

import { eventBus, Events } from "../events/index.js";
import { runWithExecutor } from "../executor/context.js";
import {
  wireRemoteCacheEventBridge,
  _resetEventBridgeForTests,
} from "./event-bridge.js";
import { _resetRefreshForTests } from "./refresh.js";
import type { Executor } from "../executor/types.js";

function makeExecutor(execSpy: ReturnType<typeof vi.fn>): Executor {
  return {
    target: { id: "T-bridge", name: "T-bridge" },
    async readFile() { throw new Error("ENOENT"); },
    exec: execSpy as any,
    async writeFile() {},
    async mkdir() {},
    async readdir() { return []; },
    async stat() { return {} as any; },
    async unlink() {},
    async rename() {},
    spawn() { return null as any; },
  };
}

beforeEach(() => {
  delSpy.mockClear();
  _resetEventBridgeForTests();
  _resetRefreshForTests();
  // Reset bus listeners for each test (the bridge re-attaches on call).
  for (const name of Object.values(Events)) eventBus.removeAllListeners(name);
});

describe("wireRemoteCacheEventBridge", () => {
  it("triggers scheduleRefresh when a relevant event fires inside a request scope", async () => {
    const execSpy = vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0, durationMs: 1 }));
    wireRemoteCacheEventBridge();

    await runWithExecutor(makeExecutor(execSpy), async () => {
      eventBus.emit(Events.USER_UPDATED, { id: "u1" });
      // Give the listener a moment to settle the void scheduleRefresh chain.
      await new Promise((r) => setTimeout(r, 5));
    });

    expect(delSpy).toHaveBeenCalledWith("panel:rc:T-bridge:users:system");
  });

  it("is a silent no-op when fired outside a request scope (no context executor)", async () => {
    const execSpy = vi.fn();
    wireRemoteCacheEventBridge();
    eventBus.emit(Events.SETTINGS_UPDATED, { key: "x" });
    await new Promise((r) => setTimeout(r, 5));
    expect(delSpy).not.toHaveBeenCalled();
    expect(execSpy).not.toHaveBeenCalled();
  });

  it("idempotent: a second wire call does not duplicate listeners", async () => {
    const execSpy = vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0, durationMs: 1 }));
    wireRemoteCacheEventBridge();
    wireRemoteCacheEventBridge();
    wireRemoteCacheEventBridge();

    await runWithExecutor(makeExecutor(execSpy), async () => {
      eventBus.emit(Events.ROLE_UPDATED, { id: "admin" });
      await new Promise((r) => setTimeout(r, 5));
    });

    expect(delSpy).toHaveBeenCalledTimes(1);
  });
});
