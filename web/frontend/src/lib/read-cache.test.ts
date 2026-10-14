import { describe, expect, it, vi } from "vitest";
import { browserReadCache, createReadCache, listReadTtl } from "./read-cache";
describe("shared read cache", () => {
  it("shares 20 concurrent reads, reuses a recent result, and refreshes explicitly", async () => {
    const cache = createReadCache();
    const load = vi.fn(async () => ({ ok: true, items: [] }));
    await Promise.all(Array.from({ length: 20 }, () => cache.read("u:s:list", load)));
    await cache.read("u:s:list", load);
    expect(load).toHaveBeenCalledTimes(1);
    await cache.read("u:s:list", load, 20_000, true);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("shares live requests in flight and fetches again after settling", async () => {
    const reads = createReadCache();
    const load = vi.fn(async () => ({ ok: true }));
    await Promise.all([reads.read("live", load, 0), reads.read("live", load, 0)]);
    expect(load).toHaveBeenCalledTimes(1);
    await reads.read("live", load, 0);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("does not retain failures and rejects replies invalidated by mutation or logout", async () => {
    const cache = createReadCache();
    const failed = vi.fn(async () => ({ ok: false }));
    await cache.read("a", failed); await cache.read("a", failed);
    expect(failed).toHaveBeenCalledTimes(2);
    let resolve!: (value: { ok: boolean }) => void;
    const pending = cache.read("b", () => new Promise<{ok: boolean}>(r => { resolve = r; }));
    await Promise.resolve(); cache.clear(); resolve({ ok: true });
    await expect(pending).rejects.toThrow("READ_INVALIDATED");
  });
  it("keeps identities separate and excludes live or consumable endpoints", async () => {
    const load = vi.fn(async () => ({ ok: true }));
    const cache = createReadCache();
    await cache.read("server:alice", load); await cache.read("server:bob", load);
    expect(load).toHaveBeenCalledTimes(2);
    for (const path of ["/api/auth/challenge", "/api/ai/conversations/x/messages", "/api/jobs/1", "/api/notifications"]) expect(listReadTtl(path)).toBeNull();
    expect(listReadTtl("/api/ai/stats/cli-quota?provider=claude")).toBe(0);
    expect(listReadTtl("/api/hosting/accounts?page=1")).toBe(20_000);
  });
});

it("retains only the scoped bootstrap across a reload for the original TTL and clears it on logout", async () => {
  vi.useFakeTimers(); vi.setSystemTime(1000);
  const slot = Symbol.for("luxipanel.read-cache.v2");
  const host = window as any; delete host[slot]; window.sessionStorage.clear();
  const key = JSON.stringify(["server:alice:csrf", "/api/ai/bootstrap"]);
  const load = vi.fn(async () => ({ ok: true, data: { catalogs: {} } }));
  await browserReadCache().read(key, load);
  delete host[slot]; vi.advanceTimersByTime(19000);
  await browserReadCache().read(key, load);
  expect(load).toHaveBeenCalledTimes(1);
  delete host[slot]; vi.advanceTimersByTime(2000);
  await browserReadCache().read(key, load);
  expect(load).toHaveBeenCalledTimes(2);
  window.dispatchEvent(new Event("luxipanel:logout"));
  expect(window.sessionStorage.getItem("luxipanel.bootstrap-read.v2")).toBeNull();
  await browserReadCache().read(JSON.stringify(["server:bob:csrf", "/api/ai/bootstrap"]), load);
  expect(load).toHaveBeenCalledTimes(3);
  vi.useRealTimers();
});

it("does not restore a persisted bootstrap when its pending read finishes after logout", async () => {
  const cache = browserReadCache(); cache.clear();
  let reply!: (value: {ok: boolean}) => void;
  const pending = cache.read(JSON.stringify(["server:alice:csrf", "/api/ai/bootstrap"]), () => new Promise<{ok: boolean}>(resolve => { reply = resolve; }));
  await Promise.resolve();
  window.dispatchEvent(new Event("luxipanel:logout"));
  reply({ok: true});
  await expect(pending).rejects.toThrow("READ_INVALIDATED");
  expect(sessionStorage.getItem("luxipanel.bootstrap-read.v2")).toBeNull();
});

it("does not evict unfinished reads when the retained cache limit is reached",async()=>{
 const cache=createReadCache();const resolve:Array<()=>void>=[];
 const pending=Array.from({length:300},(_,n)=>cache.read(`view-${n}`,()=>new Promise<{ok:boolean}>(done=>resolve.push(()=>done({ok:true})))));
 await Promise.resolve();resolve.forEach(done=>done());
 expect((await Promise.all(pending)).every(value=>value.ok)).toBe(true);
});
