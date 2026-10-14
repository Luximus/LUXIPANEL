import { act, createElement, createRef } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { ChatScrollReveal } from "./ChatScrollReveal";
import { MessageContent } from "../../MessageContent";

let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); cleanup = undefined; vi.unstubAllGlobals(); });
it("reveals against the conversation viewport and cleans up without layout reads", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  let callback: IntersectionObserverCallback | undefined;
  const observe = vi.fn(), unobserve = vi.fn(), disconnect = vi.fn();
  const scroller = document.createElement("div");
  const geometry = vi.spyOn(scroller, "getBoundingClientRect");
  vi.stubGlobal("IntersectionObserver", class {
    constructor(cb: IntersectionObserverCallback, opts: IntersectionObserverInit) { callback = cb; expect(opts.root).toBe(scroller); }
    observe = observe; unobserve = unobserve; disconnect = disconnect;
  });
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host), ref = { current: scroller };
  cleanup = () => { act(() => root.unmount()); host.remove(); geometry.mockRestore(); };
  await act(async () => root.render(createElement(ChatScrollReveal, { scrollContainerRef: ref, children: createElement("p", { "data-scroll-reveal-block": "" }, "Readable before and after reveal") })));
  const block = host.querySelector("p")!;
  expect(block.textContent).toContain("Readable");
  expect(observe).toHaveBeenCalledWith(block);
  act(() => callback!([{ target: block, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
  expect(block.classList.contains("lxp-reveal-entered")).toBe(true);
  expect(unobserve).toHaveBeenCalledWith(block);
  expect(geometry).not.toHaveBeenCalled();
  cleanup(); cleanup = undefined;
  expect(disconnect).toHaveBeenCalledOnce();
});
it("keeps long answers formatted without a DOM span for every word", () => {
  const text = "**Long answer**\n\n" + "word ".repeat(4000);
  const html = renderToStaticMarkup(createElement(MessageContent, { text, scrollContainerRef: createRef<HTMLDivElement>() }));
  expect(html).toContain("<strong>Long answer</strong>");
  expect(html).toContain('data-scroll-reveal-block=""');
  expect(html).not.toContain("data-scroll-reveal-word");
  expect(html.match(/<span/g)?.length ?? 0).toBeLessThan(10);
});
