import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import pino from "pino";

const config = vi.hoisted(() => ({ LUXIPANEL_CONFIG_DIR: "/tmp" }));
vi.mock("../../config/env.js", () => ({ env: config }));
const { DiagnosticsStore, diagnosticsStore, scopeDir } = await import("./store.js");
const { sanitize, sanitizeText } = await import("./sanitize.js");
const { observeLogger } = await import("./runtime.js");
const { DEFAULT_LOGS_CONFIG } = await import("./types.js");
const { diagnosticContext } = await import("./context.js");
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "lxp-logs-tests-"));
let sequence = 0;
beforeEach(() => { config.LUXIPANEL_CONFIG_DIR = path.join(temp, String(++sequence)); });
afterAll(async () => { await diagnosticsStore.flush(); await fs.rm(temp, { recursive: true, force: true }); });

describe("LUXIPANEL diagnostics store", () => {
  it("accepts browser telemetry without a URL while excluding errors of the sink itself", async () => {
    const store = new DiagnosticsStore();
    diagnosticContext.run(() => ({ url: "/api/telemetry/errors", requestId: "sink-request" }), () => {
      store.capture({ severity: "warn", source: "frontend", message: "Browser warning without URL" });
      store.capture({ severity: "error", source: "frontend", message: "Another event in the same browser batch" });
      store.capture({ severity: "error", source: "api", message: "Sink error must not loop" });
    });
    const incidents = await store.incidents("instance");
    expect(incidents).toHaveLength(2); expect(incidents.every(i => i.sample.url === "" && i.sample.requestId === undefined)).toBe(true);
  });
  it("classifies API failures by route when no logger module is bound", async () => {
    const store = new DiagnosticsStore();
    diagnosticContext.run(() => ({ url: "/api/hosting/access?token=private-query", requestId: "hosting-failure", user: { targetHost: "remote.test" } as never }), () => store.capture({ severity: "error", source: "api", message: "Hosting failed" }));
    const incidents = await store.incidents("instance");
    expect(incidents[0]?.module).toBe("hosting");
    expect(JSON.stringify(incidents)).not.toContain("private-query");
  });
  it("captures disabled Pino warning levels and preserves logger child metadata", async () => {
    const output = vi.fn(); const logger = observeLogger(pino({ level: "fatal" }, { write: output }));
    diagnosticContext.run(() => ({ requestId: "req-warning", user: { targetHost: "alpha.test" } as never }), () => {
      logger.child({ module: "nginx" }).warn({ err: new Error("upstream timed out"), token: "never-store-me" }, "upstream timed out");
    });
    expect(output).not.toHaveBeenCalled();
    // A bridged/hosting session still reports failures of THIS installation.
    const incidents = await diagnosticsStore.incidents("instance");
    expect(incidents).toHaveLength(1); expect(incidents[0]?.module).toBe("nginx");
    expect(JSON.stringify(incidents)).not.toContain("never-store-me");
  });
  it("groups repetitions, deduplicates request failures, and isolates panel scopes", async () => {
    const store = new DiagnosticsStore();
    store.capture({ scope: "alpha", severity: "error", source: "api", message: "failed item 123", requestId: "request-1" });
    store.capture({ scope: "alpha", severity: "error", source: "api", message: "response failed", requestId: "request-1" });
    store.capture({ scope: "alpha", severity: "error", source: "api", message: "failed item 456", requestId: "request-2" });
    store.capture({ scope: "beta", severity: "warn", message: "another panel" });
    const incidents = await store.incidents("alpha");
    expect(incidents).toHaveLength(1); expect(incidents[0]?.count).toBe(2);
    expect((await store.detail("alpha", incidents[0]!.id)).total).toBe(2);
    expect((await store.incidents("beta"))[0]?.message).toBe("another panel");
    expect(await store.detail("beta", incidents[0]!.id)).toEqual({ incident: undefined, events: [], total: 0 });
    const file = path.join(scopeDir("alpha"), `${new Date().toISOString().slice(0, 10)}.ndjson`);
    expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
  });
  it("redacts nested fields, text credentials, circular objects and private keys", () => {
    const object: Record<string, unknown> = { headers: { authorization: "Bearer secretvalue", cookie: "session=private" }, nested: { password: "pw-value" }, url: "https://user:password@github.com/repo?token=secret-query", text: '{"password": "plain-password"}' };
    object.self = object;
    const result = JSON.stringify(sanitize(object));
    for (const secret of ["secretvalue", "session=private", "pw-value", "user:password", "secret-query", "plain-password"]) expect(result).not.toContain(secret);
    expect(sanitizeText("-----BEGIN PRIVATE KEY-----\nprivate\n-----END PRIVATE KEY-----")).toBe("[redacted]");
  });
  it("writes fatal errors synchronously before process exit", async () => {
    const store = new DiagnosticsStore(); store.capture({ scope: "fatal", severity: "fatal", message: "uncaught crash" });
    const file = path.join(scopeDir("fatal"), `${new Date().toISOString().slice(0, 10)}.ndjson`);
    expect(await fs.readFile(file, "utf8")).toContain("uncaught crash");
  });
  it("honors persisted capture settings after restart and prunes expired logs", async () => {
    const store = new DiagnosticsStore();
    store.capture({ scope: "retention", severity: "warn", message: "old", timestamp: "2000-01-01T00:00:00.000Z" });
    store.capture({ scope: "retention", severity: "warn", message: "new" }); await store.flush();
    await store.saveConfig("retention", { ...DEFAULT_LOGS_CONFIG, retentionDays: 1 });
    expect((await store.incidents("retention")).map((i) => i.message)).toEqual(["new"]);
    await store.saveConfig("paused", { ...DEFAULT_LOGS_CONFIG, enabled: false });
    const restarted = new DiagnosticsStore(); await restarted.warmConfigs(); restarted.capture({ scope: "paused", severity: "warn", message: "must not persist" });
    expect(await restarted.incidents("paused")).toEqual([]);
    expect(Object.keys(await restarted.config("paused"))).not.toContain("scope");
  });
  it("keeps an imported duplicate event id from inflating occurrences after a restart", async () => {
    const original = new DiagnosticsStore(); original.capture({ id: "event-id", scope: "dedupe", severity: "error", message: "same event" }); await original.flush();
    const restarted = new DiagnosticsStore(); restarted.capture({ id: "event-id", scope: "dedupe", severity: "error", message: "same event", historical: true });
    expect((await restarted.incidents("dedupe"))[0]?.count).toBe(1);
  });
});
