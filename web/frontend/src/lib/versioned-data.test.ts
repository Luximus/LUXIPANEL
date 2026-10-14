import {describe, expect, it, vi} from "vitest";
import {createVersionedData, resourceForPath} from "./versioned-data";
describe("versioned module data", () => {
  const full = {ok:true, data:[{id:1}], meta:{freshness:{version:"v1"}}};
  it("reuses data on unchanged replies and coalesces concurrent reads", async () => {
    const cache = createVersionedData(), load = vi.fn(async () => full);
    const responses = await Promise.all(Array.from({length:30}, () => cache.read("server-A:user-A:page-1",load)));
    expect(load).toHaveBeenCalledTimes(1); expect(responses.every(row => row.data === full.data)).toBe(true);
    const unchanged = vi.fn(async () => ({ok:true,meta:{unchanged:true,freshness:{version:"v1"}}}));
    expect((await cache.read("server-A:user-A:page-1",unchanged) as {data?: unknown}).data).toBe(full.data);
    expect(unchanged).toHaveBeenCalledWith("v1");
  });
  it("never reuses a version across server/user/query keys", async () => {
    const cache = createVersionedData(); await cache.read("A:alice:page1",async()=>full);
    const load = vi.fn(async(_knownVersion?: string)=>full);
    for (const key of ["B:alice:page1","A:bob:page1","A:alice:page2"]) await cache.read(key,load);
    expect(load.mock.calls.every(call=>call[0]===undefined)).toBe(true);
  });
  it("discards pending responses after a session reset", async () => {
    let resolve!: (value: typeof full)=>void;
    const cache = createVersionedData(), task = cache.read("A",()=>new Promise<typeof full>(r=>{resolve=r;}));
    const assertion = expect(task).rejects.toThrow("READ_INVALIDATED");
    cache.clear(); resolve(full); await assertion;
  });
  it("keeps files, credentials, SQL and realtime statistics outside the protocol", () => {
    for (const path of ["/api/files/list", "/api/auth/ws-token", "/api/monitor/stats", "/api/databases/query"])
      expect(resourceForPath(path)).toBeUndefined();
    expect(resourceForPath("/api/accounts?page=2")).toBe("mail/accounts");
  });
});
