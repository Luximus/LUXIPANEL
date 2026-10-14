import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ entries: new Map<string, string>(), lost: false }));
vi.mock("../../../shared/redis/index.js", () => ({ getRedis: () => ({
  set: async (key: string, value: string) => { if (state.entries.has(key)) return null; state.entries.set(key, value); return "OK"; },
  eval: async (script: string, _count: number, key: string, value: string) => { if (state.lost || state.entries.get(key) !== value) return 0; if (script.includes("'DEL'")) state.entries.delete(key); return 1; },
}) }));
import { assertHostingPolicyLease, withHostingPolicyLock } from "./hosting-policy-lock.js";
const executor = { target: { id: "fixture-target" } } as never;
beforeEach(() => { state.entries.clear(); state.lost = false; });
describe("account policy write serialization", () => {
  it("shares the lease across nested plan/group reconciliation", async () => {
    await withHostingPolicyLock(executor, () => withHostingPolicyLock(executor, async () => { expect(state.entries.size).toBe(1); await assertHostingPolicyLease(); }));
    expect(state.entries.size).toBe(0);
  });
  it("rejects a concurrent request while the previous policy applies", async () => {
    let release!: () => void, acquired!: () => void;
    const ready = new Promise<void>(r => { acquired = r; });
    const hold = withHostingPolicyLock(executor, async () => { acquired(); await new Promise<void>(r => { release = r; }); });
    await ready;
    try { await expect(withHostingPolicyLock(executor, async () => "older policy")).rejects.toThrow("in progress"); }
    finally { release(); await hold; }
  });
  it("does not authorize native activation after losing the lease", async () => {
    await expect(withHostingPolicyLock(executor, async () => { state.lost = true; await assertHostingPolicyLease(); })).rejects.toThrow("expired");
  });
});
