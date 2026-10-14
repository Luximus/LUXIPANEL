// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Operator policy sidecar repository tests (RUNTIME-DESIGN §6.1, §11).
 * Mock fs + env BEFORE importing the repository.
 *
 * Coverage: missing file → null (default-deny); malformed JSON → null + warn;
 * reads + sanitizes grants; rejects unsafe ids; filters unknown capabilities.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

let readFileImpl: (p: string) => Promise<string> = async () => {
  throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
};

vi.mock("node:fs", () => ({
  promises: {
    readFile: (p: string) => readFileImpl(p),
  },
}));

// Include LOG_LEVEL so the shared logger (imported transitively) initializes.
vi.mock("@config/env.js", () => ({
  env: { LUXIPANEL_CONFIG_DIR: "/etc/luxipanel", LOG_LEVEL: "silent", NODE_ENV: "test" },
}));

import { loadPreviewPolicy } from "./preview-policy.repository.js";

beforeEach(() => {
  readFileImpl = async () => {
    throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
  };
});

describe("loadPreviewPolicy", () => {
  it("returns null when the sidecar is missing (default-deny)", async () => {
    const p = await loadPreviewPolicy("42", "mymod");
    expect(p).toBeNull();
  });

  it("reads the sidecar from preview-policy/<owner>:<id>.json on the panel host", async () => {
    let requestedPath = "";
    readFileImpl = async (path: string) => {
      requestedPath = path;
      return JSON.stringify({ capabilities: ["http"], http_allowlist: ["api.example.com"], readPrefix: "/srv/data" });
    };
    const p = await loadPreviewPolicy("42", "mymod");
    expect(requestedPath).toBe("/etc/luxipanel/preview-policy/42:mymod.json");
    expect(p?.capabilities).toEqual(["http"]);
    expect(p?.http_allowlist).toEqual(["api.example.com"]);
    expect(p?.readPrefix).toBe("/srv/data");
  });

  it("returns null on malformed JSON (default-deny, never throws)", async () => {
    readFileImpl = async () => "{ not json";
    const p = await loadPreviewPolicy("42", "mymod");
    expect(p).toBeNull();
  });

  it("filters out unknown capability strings (closed-set only)", async () => {
    readFileImpl = async () =>
      JSON.stringify({ capabilities: ["http", "server.god-mode", "storage"] });
    const p = await loadPreviewPolicy("42", "mymod");
    expect(p?.capabilities).toEqual(["http", "storage"]);
  });

  it("rejects an unsafe ownerUserId/moduleId (path separators / traversal) → null", async () => {
    readFileImpl = async () => JSON.stringify({ capabilities: ["http"] });
    expect(await loadPreviewPolicy("../../etc", "mymod")).toBeNull();
    expect(await loadPreviewPolicy("42", "../../../secrets")).toBeNull();
    expect(await loadPreviewPolicy("a/b", "mod")).toBeNull();
  });

  it("ignores a relative readPrefix (must be absolute)", async () => {
    readFileImpl = async () => JSON.stringify({ readPrefix: "relative/path" });
    const p = await loadPreviewPolicy("42", "mymod");
    expect(p?.readPrefix).toBeUndefined();
  });
});
