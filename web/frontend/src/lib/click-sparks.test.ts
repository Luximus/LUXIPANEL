import {beforeEach,afterEach,expect,it,vi} from "vitest";
import {initClickSparks} from "./click-sparks";
const ctx={save:vi.fn(),restore:vi.fn(),clearRect:vi.fn(),setTransform:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),stroke:vi.fn(),globalAlpha:1};
let frames:FrameRequestCallback[]=[];
const click=()=>document.body.dispatchEvent(new MouseEvent("click",{bubbles:true,detail:1,clientX:300,clientY:240}));
beforeEach(()=>{
 vi.useFakeTimers();vi.clearAllMocks();frames=[];
 vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue(ctx as any);
 vi.stubGlobal("requestAnimationFrame",vi.fn((fn:FrameRequestCallback)=>{frames.push(fn);return frames.length;}));
 vi.stubGlobal("cancelAnimationFrame",vi.fn());
 vi.stubGlobal("matchMedia",vi.fn(()=>({matches:false})));
});
afterEach(()=>{
 document.dispatchEvent(new Event("astro:before-swap"));
 vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();document.body.innerHTML="";
});
it("clears a painted click even when no further animation frames arrive",()=>{
 initClickSparks();click();
 const canvas=document.querySelector<HTMLCanvasElement>("canvas")!;
 frames.shift()!(0);expect(ctx.stroke).toHaveBeenCalledTimes(8);expect(canvas.hidden).toBe(false);
 const clears=ctx.clearRect.mock.calls.length;
 vi.advanceTimersByTime(500);
 expect(ctx.clearRect.mock.calls.length).toBeGreaterThan(clears);expect(canvas.hidden).toBe(true);
});
it("does not multiply listeners and clears on blur and navigation",()=>{
 initClickSparks();initClickSparks();
 expect(document.querySelectorAll("canvas")).toHaveLength(1);
 click();frames.shift()!(0);expect(ctx.stroke).toHaveBeenCalledTimes(8);
 window.dispatchEvent(new Event("blur"));expect(document.querySelector<HTMLCanvasElement>("canvas")!.hidden).toBe(true);
 document.dispatchEvent(new Event("astro:before-swap"));expect(document.querySelector("canvas")).toBeNull();
 initClickSparks();click();expect(document.querySelector<HTMLCanvasElement>("canvas")!.hidden).toBe(false);
 vi.advanceTimersByTime(500);expect(document.querySelector<HTMLCanvasElement>("canvas")!.hidden).toBe(true);
});
it("resets the deadline for repeated clicks and leaves no stale overlay",()=>{
 initClickSparks();click();vi.advanceTimersByTime(300);click();vi.advanceTimersByTime(200);
 expect(document.querySelector<HTMLCanvasElement>("canvas")!.hidden).toBe(false);
 vi.advanceTimersByTime(300);expect(document.querySelector<HTMLCanvasElement>("canvas")!.hidden).toBe(true);
});
it("respects reduced motion and ignores keyboard clicks",()=>{
 vi.mocked(window.matchMedia).mockReturnValue({matches:true} as MediaQueryList);initClickSparks();
 expect(document.querySelector("canvas")).toBeNull();
 vi.mocked(window.matchMedia).mockReturnValue({matches:false} as MediaQueryList);initClickSparks();
 document.body.dispatchEvent(new MouseEvent("click",{bubbles:true,detail:0}));
 expect(document.querySelector<HTMLCanvasElement>("canvas")!.hidden).toBe(true);
});

it.each([0.5,0.75,1,1.25,2])("clears the full backing bitmap at DPR %s, then restores drawing coordinates",dpr=>{
 vi.stubGlobal("devicePixelRatio",dpr);
 let scale=1,stack:number[]=[];
 const erasings:number[][]=[];
 vi.mocked(ctx.save).mockImplementation(()=>{stack.push(scale);});
 vi.mocked(ctx.restore).mockImplementation(()=>{scale=stack.pop()!;});
 vi.mocked(ctx.setTransform).mockImplementation((...args:any[])=>{scale=args[0];});
 vi.mocked(ctx.clearRect).mockImplementation((...args:any[])=>{erasings.push([args[2]*scale,args[3]*scale]);});
 initClickSparks();click();
 const canvas=document.querySelector<HTMLCanvasElement>("canvas")!;
 const check=()=>{
   expect(erasings.at(-1)).toEqual([canvas.width,canvas.height]);
   expect(scale).toBe(dpr);
 };
 frames.shift()!(0);check();
 vi.advanceTimersByTime(500);check();
 click();frames.at(-1)!(0);check();
 expect(canvas.hidden).toBe(false);
 window.dispatchEvent(new Event("blur"));check();expect(canvas.hidden).toBe(true);
});
