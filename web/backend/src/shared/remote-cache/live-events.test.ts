import {afterEach, beforeEach, expect, it, vi} from "vitest";
const mocks=vi.hoisted(()=>({flags:vi.fn(),xread:vi.fn(),xrange:vi.fn(),xrevrange:vi.fn()}));
vi.mock("./live-config.js",()=>({cacheIdentity:(e:unknown)=>e,liveFeatures:mocks.flags}));
vi.mock("./persistent-client.js",()=>({cacheAccessAllowed:()=>true,persistentCache:async()=>mocks}));
import {subscribeData} from "./live-events.js";
const releases:(()=>void)[]=[], reads:((value:null)=>void)[]=[];
beforeEach(()=>{
 vi.useFakeTimers();vi.resetAllMocks();
 mocks.flags.mockResolvedValue({events:true});
 mocks.xrange.mockImplementation(async(_stream,start)=>start.startsWith("(")?[]:[["1-0",[]]]);
 mocks.xrevrange.mockResolvedValue([["1-0",[]]]);
 mocks.xread.mockImplementation(()=>new Promise(resolve=>reads.push(resolve)));
});
afterEach(async()=>{
 releases.splice(0).forEach(fn=>fn());
 await vi.advanceTimersByTimeAsync(5001);
 reads.splice(0).forEach(resolve=>resolve(null));await vi.advanceTimersByTimeAsync(5001);
 vi.useRealTimers();
});
it("reuses the existing blocking reader when a view resumes during shutdown",async()=>{
 const executor={} as never;
 const stop=await subscribeData(executor,["users/system"],"1-0",vi.fn());releases.push(stop);
 await vi.advanceTimersByTimeAsync(0);expect(mocks.xread).toHaveBeenCalledTimes(1);
 stop();await vi.advanceTimersByTimeAsync(5001);
 releases.push(await subscribeData(executor,["users/system"],"1-0",vi.fn()));
 await vi.advanceTimersByTimeAsync(0);expect(mocks.xread).toHaveBeenCalledTimes(1);
});
it("resumes active subscribers after live events are disabled then enabled",async()=>{
 const send=vi.fn();releases.push(await subscribeData({} as never,["users/system"],"1-0",send));
 await vi.advanceTimersByTimeAsync(0);mocks.flags.mockResolvedValue({events:false});
 reads.shift()!(null);await vi.advanceTimersByTimeAsync(0);
 expect(send.mock.calls.some(([frame])=>frame.reason==="disabled")).toBe(true);
 await vi.advanceTimersByTimeAsync(5001);
 expect(send.mock.calls.filter(([frame])=>frame.reason==="disabled")).toHaveLength(1);
 mocks.flags.mockResolvedValue({events:true});await vi.advanceTimersByTimeAsync(5001);
 expect(mocks.xread).toHaveBeenCalledTimes(2);
});
