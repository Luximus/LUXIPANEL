// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization tests — webhooks discovery orchestrator + shared helpers.
 *
 * Locks: the pure grep/URL helpers in types.ts, the deterministic
 * makeDiscoveryId, and the orchestrator's fail-soft aggregation contract
 * (dedupe by id, category classification, source-priority sort). Detectors are
 * mocked so the orchestrator is exercised in isolation.
 */

import { describe, it, expect, vi } from "vitest";
import {
  clampRaw,
  firstUrl,
  parseGrepLine,
  DISCOVERY_SCAN_ROOTS,
  WEBHOOK_URL_RE,
} from "./types.js";
import { makeDiscoveryId } from "../../models/discovery.model.js";

describe("types.ts — shared discovery helpers", () => {
  it("firstUrl extracts the first http(s) URL, or null; is /g-safe (repeatable)", () => {
    expect(firstUrl("deploy && curl https://hooks.example.com/x -d @-")).toBe(
      "https://hooks.example.com/x",
    );
    expect(firstUrl("no url here")).toBeNull();
    // Repeat to prove lastIndex is reset between calls.
    expect(firstUrl("curl http://a.test/1")).toBe("http://a.test/1");
    expect(firstUrl("curl http://a.test/2")).toBe("http://a.test/2");
  });

  it("WEBHOOK_URL_RE stops at quotes/backticks/whitespace/semicolons", () => {
    WEBHOOK_URL_RE.lastIndex = 0;
    const m = WEBHOOK_URL_RE.exec('x="https://h.test/p";more');
    expect(m?.[0]).toBe("https://h.test/p");
  });

  it("parseGrepLine parses file:lineNo:content and rejects non-numeric line", () => {
    expect(parseGrepLine("/etc/crontab:42:curl https://x")).toEqual({
      file: "/etc/crontab",
      lineNo: "42",
      content: "curl https://x",
    });
    expect(parseGrepLine("no-colons")).toBeNull();
    expect(parseGrepLine("/f:notnum:content")).toBeNull();
  });

  it("clampRaw collapses whitespace and truncates with an ellipsis", () => {
    expect(clampRaw("  a   b\tc  ")).toBe("a b c");
    const long = "x".repeat(300);
    const out = clampRaw(long, 240);
    expect(out.length).toBe(241); // 240 chars + ellipsis
    expect(out.endsWith("…")).toBe(true);
  });

  it("DISCOVERY_SCAN_ROOTS is the single in-module scan-root constant", () => {
    expect([...DISCOVERY_SCAN_ROOTS]).toEqual(["/var/www", "/home", "/opt", "/srv", "/root"]);
  });
});

describe("makeDiscoveryId — deterministic + collision-resistant", () => {
  it("is stable for the same (source, location, target)", () => {
    const a = makeDiscoveryId("git-hook", "/repo/.git/hooks/post-receive", "https://x");
    const b = makeDiscoveryId("git-hook", "/repo/.git/hooks/post-receive", "https://x");
    expect(a).toBe(b);
    expect(a).toHaveLength(24);
  });

  it("differs when any component differs", () => {
    const base = makeDiscoveryId("nginx", "/etc/nginx/sites-enabled/a", "https://x");
    expect(makeDiscoveryId("cron", "/etc/nginx/sites-enabled/a", "https://x")).not.toBe(base);
    expect(makeDiscoveryId("nginx", "/etc/nginx/sites-enabled/b", "https://x")).not.toBe(base);
    expect(makeDiscoveryId("nginx", "/etc/nginx/sites-enabled/a", "https://y")).not.toBe(base);
  });
});

// ── Orchestrator: mock each detector module so we control their output ──
vi.mock("./sidecar.detector.js", () => ({
  sidecarDetector: {
    source: "sidecar",
    detect: vi.fn(async () => [
      { id: "dup", source: "sidecar", name: "S", target: "https://s", location: "l", enabled: true, managed: true },
    ]),
  },
}));
vi.mock("./git-hooks.detector.js", () => ({
  gitHooksDetector: {
    source: "git-hook",
    // returns the SAME id "dup" → must be deduped away (first-wins = sidecar)
    detect: vi.fn(async () => [
      { id: "dup", source: "git-hook", name: "G", target: "https://g", location: "l2", enabled: true, managed: false },
      { id: "gh1", source: "git-hook", name: "G1", target: "(script local)", location: "l3", enabled: true, managed: false },
    ]),
  },
}));
vi.mock("./nginx.detector.js", () => ({
  nginxDetector: {
    source: "nginx",
    detect: vi.fn(async () => [
      { id: "ng1", source: "nginx", name: "site", target: "https://site/hook", location: "l4", enabled: true, managed: false },
    ]),
  },
}));
vi.mock("./system.detector.js", () => ({
  systemDetector: {
    source: "system",
    // A detector that THROWS must not kill the whole scan (fail-soft).
    detect: vi.fn(async () => {
      throw new Error("boom");
    }),
  },
}));
vi.mock("./projects.detector.js", () => ({
  projectsDetector: {
    source: "project",
    detect: vi.fn(async () => [
      { id: "pj1", source: "project", name: "repo", target: "/api/webhooks/x", location: "l5", enabled: null, managed: false },
    ]),
  },
}));

const fakeExecutor = { target: { id: "T-1" } } as never;

describe("webhookDiscoveryService.discover — aggregation contract", () => {
  it("dedupes by id (first source wins), classifies category, sorts by source priority, survives a throwing detector", async () => {
    const { webhookDiscoveryService } = await import("./index.js");
    const out = await webhookDiscoveryService.discover(fakeExecutor);

    // Dedupe: "dup" appears once, and it is the sidecar one (first-wins).
    const dup = out.filter((w) => w.id === "dup");
    expect(dup).toHaveLength(1);
    expect(dup[0]!.source).toBe("sidecar");

    // A throwing detector (system) contributes nothing but doesn't abort.
    expect(out.some((w) => w.source === "system")).toBe(false);
    expect(out.map((w) => w.id).sort()).toEqual(["dup", "gh1", "ng1", "pj1"]);

    // Category classification: nginx → receive-data; project path-shaped → receive-data.
    expect(out.find((w) => w.id === "ng1")!.category).toBe("receive-data");
    expect(out.find((w) => w.id === "pj1")!.category).toBe("receive-data");
    expect(out.find((w) => w.id === "gh1")!.category).toBe("other");

    // Sort: source priority sidecar(0) < nginx(1) < git-hook(2) < project(6).
    const order = out.map((w) => w.source);
    expect(order).toEqual(["sidecar", "nginx", "git-hook", "project"]);
  });
});
