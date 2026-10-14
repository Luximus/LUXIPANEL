// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * resolveMonitorExecutor — fail-closed isolation.
 *
 * A DIRECT (remote-target) session whose SSH bridge no longer resolves must
 * THROW rather than fall back to the panel-host `localExecutor` (cross-tenant
 * leak). A non-direct (local) session that merely carries a stale bridge id
 * still resolves to `localExecutor` — the panel's own box, no leak.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { getDirectMock, localExecutorStub } = vi.hoisted(() => ({
  getDirectMock: vi.fn(),
  localExecutorStub: { target: { id: "local", name: "Local" } },
}));

vi.mock("../../../shared/executor/index.js", async (orig) => {
  const actual = await orig<typeof import("../../../shared/executor/index.js")>();
  return {
    ...actual,
    localExecutor: localExecutorStub,
    getDirectExecutorByBridgeSessionId: getDirectMock,
  };
});

import { resolveMonitorExecutor } from "./monitor-executor.service.js";
import { NoServerExecutorError } from "../../../shared/errors/index.js";

beforeEach(() => {
  getDirectMock.mockReset();
});

describe("resolveMonitorExecutor", () => {
  it("returns localExecutor when there is no bridge id (local session)", async () => {
    const exec = await resolveMonitorExecutor(undefined);
    expect(exec.target.id).toBe("local");
    expect(getDirectMock).not.toHaveBeenCalled();
  });

  it("returns the direct executor when the bridge resolves", async () => {
    getDirectMock.mockResolvedValue({ target: { id: "remote-42", name: "remote-42" } });
    const exec = await resolveMonitorExecutor("b1", { direct: true });
    expect(exec.target.id).toBe("remote-42");
  });

  it("THROWS (fail-closed) for a direct session whose bridge does not resolve", async () => {
    getDirectMock.mockResolvedValue(null);
    await expect(resolveMonitorExecutor("b1", { direct: true })).rejects.toBeInstanceOf(NoServerExecutorError);
  });

  it("throws (never local) even when the direct lookup itself errors", async () => {
    getDirectMock.mockRejectedValue(new Error("ssh creds expired"));
    await expect(resolveMonitorExecutor("b1", { direct: true })).rejects.toBeInstanceOf(NoServerExecutorError);
  });

  it("falls back to localExecutor for a NON-direct session with a stale bridge id", async () => {
    getDirectMock.mockResolvedValue(null);
    const exec = await resolveMonitorExecutor("b1", { direct: false });
    expect(exec.target.id).toBe("local");
  });
});
