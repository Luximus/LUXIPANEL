import { expect, it, vi } from "vitest";
import { createThemeTransition, revealGeometry } from "./theme-transition";
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
function setup(capture = async () => "image") {
  const effects = { capture: vi.fn(capture), present: vi.fn(async () => {}), animate: vi.fn(async () => {}), hide: vi.fn(), dispose: vi.fn() };
  return { effects, transition: createThemeTransition(effects), apply: vi.fn() };
}
it("covers every corner when the control is near an edge", () => {
  const g = revealGeometry(390, 844, { x: 328, y: 44 });
  for (const [x, y] of [[0, 0], [390, 0], [0, 844], [390, 844]]) expect(Math.hypot(x-g.x, y-g.y)).toBeLessThanOrEqual(g.radius);
  expect(revealGeometry(320, 640, {x:NaN,y:Infinity})).toEqual(revealGeometry(320,640));
});
it("presents the old image before applying the live theme exactly once", async () => {
  const s = setup(); const order: string[] = [];
  s.effects.present.mockImplementation(async () => { order.push("present"); });
  s.apply.mockImplementation(() => order.push("apply"));
  s.effects.animate.mockImplementation(async () => { order.push("animate"); });
  await s.transition.run(s.apply);
  expect(order).toEqual(["present", "apply", "animate"]);
  expect(s.effects.dispose).toHaveBeenCalledWith("image"); expect(s.effects.hide).toHaveBeenCalledOnce();
});
it("drops repeated presses during capture rather than applying two themes", async () => {
  const capture = deferred<string>(), s = setup(() => capture.promise);
  const first = s.transition.run(s.apply); await s.transition.run(s.apply);
  capture.resolve("image"); await first;
  expect(s.effects.capture).toHaveBeenCalledOnce(); expect(s.apply).toHaveBeenCalledOnce();
});
it("discards late captures after navigating or changing profile", async () => {
  const capture = deferred<string>(), s = setup(() => capture.promise);
  const request = s.transition.run(s.apply); s.transition.cancel(); capture.resolve("old"); await request;
  expect(s.apply).not.toHaveBeenCalled(); expect(s.effects.present).not.toHaveBeenCalled(); expect(s.effects.dispose).toHaveBeenCalledWith("old");
});
it("does not commit after cancellation while the overlay is being mounted", async () => {
  const ready = deferred<void>(), s = setup(); s.effects.present.mockImplementation(() => ready.promise);
  const request = s.transition.run(s.apply); await Promise.resolve(); s.transition.cancel(); ready.resolve(); await request;
  expect(s.apply).not.toHaveBeenCalled(); expect(s.effects.animate).not.toHaveBeenCalled();
});
it("applies the theme if the capture fails", async () => {
  const s = setup(async () => { throw new Error("Unavailable native surface"); });
  await s.transition.run(s.apply); expect(s.apply).toHaveBeenCalledOnce(); expect(s.effects.dispose).not.toHaveBeenCalled();
});
it("never applies a canceled failed capture to a new context", async () => {
  let reject!: (error: unknown) => void; const promise = new Promise<string>((_, r) => {reject = r;}); const s = setup(() => promise);
  const request = s.transition.run(s.apply); s.transition.cancel(); reject(new Error("gone")); await request;
  expect(s.apply).not.toHaveBeenCalled();
});
it("does not apply twice when animation fails after the theme was committed", async () => {
  const s = setup(); s.effects.animate.mockRejectedValueOnce(new Error("surface gone"));
  await s.transition.run(s.apply); expect(s.apply).toHaveBeenCalledOnce(); expect(s.effects.dispose).toHaveBeenCalledOnce();
});
it("a late canceled job never hides the image of the next transition", async () => {
  const a = deferred<string>(), b = deferred<string>(), s = setup(() => a.promise);
  const first = s.transition.run(s.apply); s.transition.cancel();
  s.effects.capture.mockImplementation(() => b.promise); const second = s.transition.run(s.apply);
  a.resolve("old"); await first; expect(s.effects.hide).toHaveBeenCalledTimes(1);
  b.resolve("new"); await second; expect(s.effects.hide).toHaveBeenCalledTimes(2); expect(s.apply).toHaveBeenCalledOnce();
});
