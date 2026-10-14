import { expect,it,vi } from "vitest";
import { cacheScheduleEntry,invalidateCacheSchedule } from "./schedule.js";
it("coalesces settings reads and applies interval/disable changes after invalidation",async()=>{
 const readFile=vi.fn(async()=>JSON.stringify({"admin/settings":{enabled:false,intervalSeconds:270}}));
 const executor={target:{id:"schedule-test"},readFile} as never;
 const rows=await Promise.all(Array.from({length:8},()=>cacheScheduleEntry(executor,"admin","settings")));
 expect(readFile).toHaveBeenCalledTimes(1);expect(rows[0]).toEqual({enabled:false,intervalSeconds:270});
 readFile.mockResolvedValue(JSON.stringify({"admin/settings":{enabled:true,intervalSeconds:120}}));invalidateCacheSchedule("schedule-test");
 expect(await cacheScheduleEntry(executor,"admin","settings")).toEqual({enabled:true,intervalSeconds:120});
});
