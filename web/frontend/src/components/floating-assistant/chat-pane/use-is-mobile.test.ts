import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useIsMobile } from "./use-is-mobile";

let root: Root;
let width: number;
let queries: Set<{ limit: number; media: EventTarget & { matches: boolean } }>;
function Harness({ maxWidth }: { maxWidth?: number }) {
  return createElement("output", null, String(useIsMobile(maxWidth)));
}
beforeEach(() => {
  width = 1024;
  queries = new Set();
  vi.stubGlobal("matchMedia", vi.fn((query: string) => {
    const limit = Number(query.match(/\d+/)![0]);
    const media = Object.assign(new EventTarget(), { matches: width <= limit });
    queries.add({ limit, media });
    return media;
  }));
  document.body.innerHTML = '<div id="test-root"></div>';
  root = createRoot(document.getElementById("test-root")!);
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); document.body.replaceChildren(); });
async function resize(next: number) {
  await act(async () => {
    width = next;
    for (const { limit, media } of queries) {
      media.matches = width <= limit;
      media.dispatchEvent(new Event("change"));
    }
  });
}
it("switches the navigation layout at 1024/1025 and restores it after resizing", async () => {
  await act(async () => root.render(createElement(Harness, { maxWidth: 1024 })));
  expect(document.querySelector("output")?.textContent).toBe("true");
  await resize(1025);
  expect(document.querySelector("output")?.textContent).toBe("false");
  await resize(390);
  expect(document.querySelector("output")?.textContent).toBe("true");
});
it("keeps the existing phone breakpoint for callers without an override", async () => {
  await act(async () => root.render(createElement(Harness)));
  expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 639px)");
  expect(document.querySelector("output")?.textContent).toBe("false");
  await resize(639);
  expect(document.querySelector("output")?.textContent).toBe("true");
});
