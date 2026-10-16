import { afterEach, expect, it, vi } from "vitest";
import { containTerminalScroll } from "./terminal-scroll";

afterEach(() => { document.body.innerHTML = ""; });

it("lets xterm handle wheel input before blocking background scroll, even at buffer boundaries", () => {
  const host = document.createElement("div");
  const xterm = document.createElement("div");
  host.append(xterm);
  document.body.append(host);
  const terminalWheel = vi.fn((event: Event) => expect(event.defaultPrevented).toBe(false));
  const backgroundWheel = vi.fn();
  xterm.addEventListener("wheel", terminalWheel);
  document.body.addEventListener("wheel", backgroundWheel);
  containTerminalScroll(host);
  for (const deltaY of [-300, 300]) {
    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY });
    xterm.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  }
  expect(terminalWheel).toHaveBeenCalledTimes(2);
  expect(backgroundWheel).not.toHaveBeenCalled();
  const zoom = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 100, ctrlKey: true });
  // happy-dom's WheelEvent does not initialise MouseEvent modifiers.
  Object.defineProperty(zoom, "ctrlKey", { value: true });
  xterm.dispatchEvent(zoom);
  expect(zoom.defaultPrevented).toBe(false);
  expect(backgroundWheel).toHaveBeenCalledOnce();
  document.body.removeEventListener("wheel", backgroundWheel);
});
