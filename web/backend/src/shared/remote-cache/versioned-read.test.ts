import {beforeEach, expect, it, vi} from "vitest";
import {gzipSync} from "node:zlib";
const mocks = vi.hoisted(() => ({eval: vi.fn(), flags: vi.fn()}));
vi.mock("./live-config.js", () => ({cacheIdentity:(executor:unknown)=>executor, liveFeatures:mocks.flags}));
vi.mock("./persistent-client.js", () => ({cacheAccessAllowed:()=>true, persistentCache:async()=>({eval:mocks.eval})}));
import {readVersioned, forgetVersioned} from "./versioned-read.js";
const reply = (version:string, rows:unknown[] = [{id:version}]) => [JSON.stringify({version,collectedAt:Date.now()/1000}),gzipSync(JSON.stringify(rows)).toString("base64")];
const settle = () => new Promise(resolve => setImmediate(resolve));
beforeEach(()=>{vi.resetAllMocks();mocks.flags.mockResolvedValue({versionedReads:true});});
it("shares concurrent reads and reuses the same payload on an unchanged version",async()=>{
 const executor={} as never;mocks.eval.mockResolvedValueOnce(reply("v1"));
 const reads=await Promise.all(Array.from({length:30},()=>readVersioned(executor,"users","system")));
 expect(mocks.eval).toHaveBeenCalledTimes(1);expect(new Set(reads.map(row=>row?.rows)).size).toBe(1);
 mocks.eval.mockResolvedValueOnce([JSON.stringify({version:"v1",collectedAt:Date.now()/1000}),""]);
 expect((await readVersioned(executor,"users","system"))?.rows).toBe(reads[0]?.rows);
});
it("discards an obsolete in-flight snapshot after a scoped refresh",async()=>{
 const executor={} as never;let finish!:(value:string[])=>void;
 mocks.eval.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const old=readVersioned(executor,"users","system");await settle();
 forgetVersioned(executor,"users","system");
 mocks.eval.mockResolvedValueOnce(reply("new"));
 expect((await readVersioned(executor,"users","system"))?.meta.version).toBe("new");
 finish(reply("old"));expect(await old).toBeNull();
 mocks.eval.mockResolvedValueOnce([JSON.stringify({version:"new",collectedAt:Date.now()/1000}),""]);
 expect((await readVersioned(executor,"users","system"))?.rows).toEqual([{id:"new"}]);
 expect(mocks.eval.mock.calls.at(-1)?.at(-1)).toBe("new");
});
it("invalidates a read still loading flags without evicting other collections",async()=>{
 const executor={} as never;mocks.eval.mockResolvedValueOnce(reply("sites"));
 const sites=await readVersioned(executor,"nginx","sites");
 let finish!:(value:{versionedReads:boolean})=>void;
 mocks.flags.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const old=readVersioned(executor,"users","system");
 forgetVersioned(executor,"users","system");finish({versionedReads:true});
 expect(await old).toBeNull();expect(mocks.eval).toHaveBeenCalledTimes(1);
 mocks.eval.mockResolvedValueOnce([JSON.stringify({version:"sites",collectedAt:Date.now()/1000}),""]);
 expect((await readVersioned(executor,"nginx","sites"))?.rows).toBe(sites?.rows);
});
it("cannot repopulate an executor snapshot after full invalidation",async()=>{
 const executor={} as never;let finish!:(value:string[])=>void;
 mocks.eval.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const old=readVersioned(executor,"users","system");await settle();
 forgetVersioned(executor);finish(reply("old"));expect(await old).toBeNull();
 mocks.eval.mockResolvedValueOnce(reply("new"));await readVersioned(executor,"users","system");
 expect(mocks.eval.mock.calls.at(-1)?.at(-1)).toBe("");
});
