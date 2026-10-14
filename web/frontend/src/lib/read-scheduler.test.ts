import {expect,it,vi} from "vitest";
import {createReadScheduler} from "./read-scheduler";
it("bounds reads and removes an aborted queued request before it reaches the server", async()=>{
 const queue=createReadScheduler(2);let active=0,max=0;const release:Array<()=>void>=[];
 const read=vi.fn(()=>new Promise<void>(resolve=>{max=Math.max(max,++active);release.push(()=>{active--;resolve();});}));
 const a=queue.run(read),b=queue.run(read);const abort=new AbortController();
 const c=queue.run(read,abort.signal);const rejected=expect(c).rejects.toThrow();
 const d=queue.run(read);await Promise.resolve();expect(read).toHaveBeenCalledTimes(2);
 abort.abort();await rejected;release.shift()!();await a;await vi.waitFor(()=>expect(read).toHaveBeenCalledTimes(3));
 release.splice(0).forEach(fn=>fn());await Promise.all([b,d]);expect(max).toBe(2);
});
it("discards queued work on a session or target change",async()=>{
 const queue=createReadScheduler(1);let release!:()=>void;
 const first=queue.run(()=>new Promise<void>(resolve=>{release=resolve}));
 const read=vi.fn(async()=>1);const queued=queue.run(read);const rejected=expect(queued).rejects.toThrow("Session changed");
 queue.clear();await rejected;expect(read).not.toHaveBeenCalled();await Promise.resolve();release();await first;
});
