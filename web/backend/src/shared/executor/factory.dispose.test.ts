// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — shared/executor/factory.ts :: disposeDirectExecutor
 *
 * SECURITY (auth/logout): logout must release the target's cached SSH
 * connection material, not just close the live socket. The credential blob is
 * put in Redis at login/target-switch (TTL = JWT TTL, up to 30d on
 * remember-me); without an explicit purge on logout it outlived the session it
 * belonged to. `disposeDirectExecutor` is the single logout chokepoint
 * (session.controller), so the purge is verified here.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const del = vi.fn(async () => undefined);

vi.mock("../../modules/auth/services/ssh-credentials-cache.service.js", () => ({
  sshCredentialsCache: {
    get: vi.fn(async () => null),
    put: vi.fn(async () => undefined),
    delete: (...args: unknown[]) => del(...args),
  },
}));

const bumpPreviewSessionEpoch = vi.fn();
vi.mock("../preview-sandbox/runtime.js", () => ({
  bumpPreviewSessionEpoch: () => bumpPreviewSessionEpoch(),
}));

import { disposeDirectExecutor } from "./factory.js";

describe("disposeDirectExecutor (logout credential release)", () => {
  beforeEach(() => {
    del.mockClear();
    bumpPreviewSessionEpoch.mockClear();
  });

  it("purges the cached SSH credential material even when no in-process executor exists", async () => {
    await disposeDirectExecutor("bridge-abc");
    // The encrypted credential blob must be deleted from Redis on logout — the
    // core of the fix: it previously survived until the JWT TTL expired.
    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith("bridge-abc");
  });

  it("bumps the preview-sandbox epoch (fail-closed) before releasing", async () => {
    await disposeDirectExecutor("bridge-xyz");
    expect(bumpPreviewSessionEpoch).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith("bridge-xyz");
  });

  it("does not throw if the credential purge fails (best-effort; blob still expires by TTL)", async () => {
    del.mockRejectedValueOnce(new Error("redis down"));
    await expect(disposeDirectExecutor("bridge-err")).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledWith("bridge-err");
  });
});
