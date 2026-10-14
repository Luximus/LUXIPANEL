// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Executor test helper — managed-only model.
 *
 * Since LUXIPANEL is managed-only, every authenticated request resolves a
 * per-server executor (pinned by requireAuth via AsyncLocalStorage). In
 * integration tests there is no real SSH target, so we substitute a benign
 * in-memory fake and mock the executor factory to hand it out.
 *
 * Usage in an integration test file:
 *
 *   vi.mock("../../shared/executor/factory.js", async () =>
 *     (await import("../helpers/executor.helper.js")).executorFactoryMock());
 */

import { Duplex } from "node:stream";
import { vi } from "vitest";
import type { Executor } from "../../shared/executor/types.js";

/** Minimal Executor that never touches a real server. */
const fakeExecutor: Executor = {
  target: { id: "panel:test", name: "test" },
  exec: async () => ({ stdout: "", stderr: "", exitCode: 0, durationMs: 0 }),
  readFile: async () => "",
  writeFile: async () => undefined,
  readdir: async () => [],
  stat: async () => {
    throw new Error("ENOENT (fake executor)");
  },
  mkdir: async () => undefined,
  unlink: async () => undefined,
  rename: async () => undefined,
  batchSftp: async () => [],
  spawn: () =>
    new Duplex({
      read() {
        this.push(null);
      },
      write(_c, _e, cb) {
        cb();
      },
    }),
};

/**
 * Module mock for `shared/executor/factory.js`. All resolvers return the
 * fake executor so requireAuth pins it and controllers never throw.
 */
export function executorFactoryMock() {
  return {
    getExecutor: vi.fn(() => fakeExecutor),
    getExecutorAsync: vi.fn(async () => fakeExecutor),
    getDirectExecutorByBridgeSessionId: vi.fn(async () => fakeExecutor),
    hydrateDirectSshExecutor: vi.fn(async () => undefined),
    disposeDirectExecutor: vi.fn(async () => undefined),
  };
}
