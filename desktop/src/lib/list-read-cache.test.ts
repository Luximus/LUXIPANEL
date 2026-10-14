import {expect,it} from "vitest";
import {createReadCache} from "./list-read-cache";

it("does not evict unfinished reads when the retained cache limit is reached",async()=>{
 const cache=createReadCache();const resolve:Array<()=>void>=[];
 const pending=Array.from({length:300},(_,n)=>cache.read(`view-${n}`,()=>new Promise<{ok:boolean}>(done=>resolve.push(()=>done({ok:true})))));
 await Promise.resolve();resolve.forEach(done=>done());
 expect((await Promise.all(pending)).every(value=>value.ok)).toBe(true);
});
