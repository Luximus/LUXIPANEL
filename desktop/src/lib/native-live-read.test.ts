import {expect, it, vi} from "vitest";
import {createVersionedReads, resourceForPath, getFreshness, reportFreshness} from "./native-live-read";
it("restores unchanged envelopes, partitions servers/queries and leaves non-lists alone",async()=>{
 const cache=createVersionedReads(); const full={ok:true,data:{ok:true,data:[{id:1}],meta:{freshness:{version:"v1",state:"fresh"}}}};
 await cache.read("A:page1","A","/api/users",async()=>full);
 const read=vi.fn(async (_path:string)=>({ok:true,data:{ok:true,meta:{unchanged:true,freshness:{version:"v1",state:"fresh"}}}}));
 const same=await cache.read("A:page1","A","/api/users",read);
 expect((same.data as any).data).toEqual([{id:1}]); expect(read).toHaveBeenCalledWith("/api/users?knownVersion=v1");
 read.mockClear(); await cache.read("B:page1","B","/api/users",async(path)=>{expect(path).toBe("/api/users");return full;});
 expect(resourceForPath("/api/monitor/snapshot")).toBeUndefined();
});
it("discards a response from a previous session",async()=>{
 const cache=createVersionedReads();let finish!:(value:any)=>void;
 const pending=cache.read("A","A","/api/users",()=>new Promise<any>(resolve=>{finish=resolve;}));
 cache.clear();finish({ok:true,data:{data:[{id:"old"}],meta:{freshness:{version:"v1"}}}});
 const result=await pending;expect(result.ok).toBe(false);expect(result.data).toBeUndefined();
});

it("retries a read invalidated by a write without treating it as an authentication failure",async()=>{
 const cache=createVersionedReads(); let finish!:(value:any)=>void;
 const load=vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue({ok:true,data:{data:[{id:"new"}],meta:{freshness:{version:"v2"}}}});
 const pending=cache.read("A","A","/api/users",load);
 cache.invalidate(key=>key==="A");finish({ok:true,data:{data:[{id:"old"}]}});
 const value=await pending;expect(value.ok).toBe(true);expect(value.data.data).toEqual([{id:"new"}]);expect(load).toHaveBeenCalledTimes(2);
});

it("clears only the replaced server, preserving other in-flight reads and versions",async()=>{
 const cache=createVersionedReads();const reply=(id:string)=>({ok:true,data:{data:[{id}],meta:{freshness:{version:id,state:"fresh"}}}});
 await cache.read("A","A","/api/users",async()=>reply("a1"));
 await cache.read("B","B","/api/users",async()=>reply("b1"));
 let finish!:(value:any)=>void;
 const pending=cache.read("A","A","/api/users",()=>new Promise<any>(resolve=>{finish=resolve;}));
 cache.clear("B");finish(reply("a2"));expect((await pending).ok).toBe(true);
 const read=vi.fn(async()=>reply("a2"));await cache.read("A","A","/api/users",read);
 expect(read).toHaveBeenCalledWith("/api/users?knownVersion=a2");
 const reset=vi.fn(async()=>reply("b2"));await cache.read("B","B","/api/users",reset);
 expect(reset).toHaveBeenCalledWith("/api/users");
});
it("cancels the old session without retrying or clearing another server's status",async()=>{
 const cache=createVersionedReads();reportFreshness("B","users/system",{state:"fresh",version:"b1"});
 let finish!:(value:any)=>void;const load=vi.fn(()=>new Promise<any>(resolve=>{finish=resolve;}));
 const pending=cache.read("A","A","/api/users",load);cache.clear("A");
 finish({ok:true,data:{data:[{id:"old"}],meta:{freshness:{version:"old",state:"fresh"}}}});
 expect(await pending).toMatchObject({ok:false,code:"READ_INVALIDATED"});expect(load).toHaveBeenCalledTimes(1);
 expect(getFreshness("A","users/system")).toBeUndefined();expect(getFreshness("B","users/system")?.version).toBe("b1");
});
it("does not evict cancellation tracking for many simultaneous reads",async()=>{
 const cache=createVersionedReads();const finish:(()=>void)[]=[];
 const load=vi.fn(()=>new Promise<any>(resolve=>finish.push(()=>resolve({ok:true,data:{data:[],meta:{freshness:{version:"v1",state:"fresh"}}}}))));
 const pending=Array.from({length:300},(_,n)=>cache.read(String(n),"A",`/api/users?page=${n}`,load));
 finish.splice(0).forEach(resolve=>resolve());await Promise.resolve();await Promise.resolve();
 // Any accidental retries would be waiting for a second response.
 expect(load).toHaveBeenCalledTimes(300);
 expect((await Promise.all(pending)).every(row=>row.ok)).toBe(true);
});
