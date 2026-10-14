import { describe, it, expect, vi } from "vitest";
vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: "test-only", LUXIPANEL_CONFIG_DIR: "/tmp", LOG_LEVEL: "silent", NODE_ENV: "test" } }));
const maps = vi.hoisted(() => new Map<string, Map<string, any>>());
vi.mock("../data-store/index.js", () => ({ dataStore: (executor: any, _module: string, collection: string) => {
  const key = executor.target.id + ":" + collection; const rows = maps.get(key) || new Map(); maps.set(key, rows);
  return { set: async (id: string, value: any) => rows.set(id, JSON.parse(JSON.stringify(value))), list: async () => [...rows.values()], delete: async (id: string) => rows.delete(id) };
}}));
import { runWithExecutor } from "../executor/context.js";
import { moduleEvents, persistModuleEvent, groupIncidents } from "./module-events.js";
import { assertPublishableSource } from "./publication-check.js";
import type { LogEvent } from "./types.js";
const executor = (id: string) => ({ target: { id, name: id } }) as any;
const user = (userId: number) => ({ userId, username: "test", kind: "admin" }) as any;
const event = (id: string, version = "1.0.0"): LogEvent => ({ id, scope: "untrusted", timestamp: new Date().toISOString(), severity: "error", source: "backend", module: "example-module", message: "failed", fingerprint: version, component: { kind: "module", id: "example-module", version, origin: "execution", targetId: "forged", userId: 999 } });
describe("Module diagnostics isolation", () => {
  it("pins target and user from Executor context and rejects foreign stored attribution", async () => {
    await import("../data-store/index.js");
    runWithExecutor(executor("A"), () => persistModuleEvent(event("one")), 1, user(1));
    runWithExecutor(executor("A"), () => persistModuleEvent(event("two")), 2, user(2));
    runWithExecutor(executor("B"), () => persistModuleEvent(event("three")), 1, user(1));
    const first = await moduleEvents(executor("A"), 1);
    expect(first.map((row) => row.id)).toEqual(["one"]); expect(first[0]?.scope).toBe("modules:A:1");
    expect(first[0]?.component?.targetId).toBe("A"); expect(first[0]?.component?.userId).toBe(1);
    expect((await moduleEvents(executor("A"), 2)).map((row) => row.id)).toEqual(["two"]);
    expect((await moduleEvents(executor("B"), 1)).map((row) => row.id)).toEqual(["three"]);
    maps.get("A:events-1")!.set("poison", { ...event("poison"), component: { ...event("poison").component, userId: 2, targetId: "A" } });
    expect((await moduleEvents(executor("A"), 1)).map((row) => row.id)).toEqual(["one"]);
  });
  it("cannot assign an unscoped server error to an arbitrary module user", () => expect(persistModuleEvent(event("unscoped"))).toBe(false));
  it("updates the same public report without duplicating incidents", async () => {
    runWithExecutor(executor("C"), () => persistModuleEvent(event("github-issue-1")), 3, user(3));
    await moduleEvents(executor("C"), 3);
    runWithExecutor(executor("C"), () => persistModuleEvent({ ...event("github-issue-1"), message: "updated report" }), 3, user(3));
    const rows = await moduleEvents(executor("C"), 3); expect(rows).toHaveLength(1); expect(rows[0]?.message).toBe("updated report");
  });
  it("separates installed versions and keeps first/last seen in chronological order", () => {
    const rows = groupIncidents([{ ...event("latest"), timestamp: "2026-10-13T10:00:00Z" }, { ...event("old"), timestamp: "2026-10-12T10:00:00Z" }, event("next", "1.0.1")]);
    const repeated = rows.find((row) => row.id === "1.0.0")!; expect(repeated.count).toBe(2); expect(repeated.firstSeen).toContain("2026-10-12"); expect(repeated.sample.id).toBe("latest"); expect(rows).toHaveLength(2);
  });
});
describe("Public source credential gate", () => {
  it("rejects recognized tokens, private keys, and credential-bearing URLs without printing them", () => {
    for (const text of ["ghp_" + "a".repeat(36), "github_pat_" + "a".repeat(50), "sk-proj-" + "a".repeat(35), "-----BEGIN " + "PRIVATE KEY-----", "postgres://user:" + "s".repeat(20) + "@database/db", 'apiKey="' + 's'.repeat(32) + '"']) expect(() => assertPublishableSource(text)).toThrow("credencial");
    expect(() => assertPublishableSource('const apiKey = process.env.API_KEY;')).not.toThrow();
  });
});
