// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization — the shared-secret store: active/previous roundtrip,
 * on-disk persistence (JSON, mode 0600) and the plaintext-free debug summary.
 * We pin the store to a throwaway file via SECRET_ROTATION_FILE (resolved at
 * module-eval time), so the service is imported dynamically after the env is
 * set.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const TMP = path.join(os.tmpdir(), `lxp-secret-store-${process.pid}-${Date.now()}.json`);

let store: typeof import("./secret-store.service.js");

beforeAll(async () => {
  process.env.SECRET_ROTATION_FILE = TMP;
  await fs.rm(TMP, { force: true });
  store = await import("./secret-store.service.js");
  await store.initSecretStore();
});

afterAll(async () => {
  await fs.rm(TMP, { force: true });
  delete process.env.SECRET_ROTATION_FILE;
});

describe("secret-store", () => {
  it("getActive returns null for an unknown kind", () => {
    expect(store.getActive("does_not_exist")).toBeNull();
  });

  it("setSecret then getActive returns the new active plaintext", async () => {
    await store.setSecret("luxipanel_key", "active-1", null, "2026-01-01T00:00:00.000Z", null);
    expect(store.getActive("luxipanel_key")).toBe("active-1");
  });

  it("a second setSecret replaces active and can carry a previous + grace window", async () => {
    await store.setSecret("luxipanel_key", "active-2", "active-1", "2026-02-01T00:00:00.000Z", "2026-02-02T00:00:00.000Z");
    expect(store.getActive("luxipanel_key")).toBe("active-2");
    const summary = store.getDebugSummary().find((s) => s.kind === "luxipanel_key");
    expect(summary).toMatchObject({
      kind: "luxipanel_key",
      rotatedAt: "2026-02-01T00:00:00.000Z",
      hasPrevious: true,
      previousValidUntil: "2026-02-02T00:00:00.000Z",
    });
  });

  it("getDebugSummary never leaks plaintext (only metadata)", async () => {
    await store.setSecret("admin_secret", "top-secret-value", null, "2026-03-01T00:00:00.000Z", null);
    const serialized = JSON.stringify(store.getDebugSummary());
    expect(serialized).not.toContain("top-secret-value");
    const row = store.getDebugSummary().find((s) => s.kind === "admin_secret");
    expect(row).toMatchObject({ kind: "admin_secret", hasPrevious: false, previousValidUntil: null });
  });

  it("persists the store to disk with a restrictive (0600) mode", async () => {
    await store.setSecret("luxipanel_key", "persisted", null, "2026-04-01T00:00:00.000Z", null);
    const raw = await fs.readFile(TMP, "utf8");
    const parsed = JSON.parse(raw) as Record<string, { active: string }>;
    expect(parsed.luxipanel_key.active).toBe("persisted");
    const st = await fs.stat(TMP);
    expect(st.mode & 0o777).toBe(0o600);
  });
});
