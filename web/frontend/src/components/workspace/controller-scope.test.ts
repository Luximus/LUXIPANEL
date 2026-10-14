import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createControllerScope } from "./controller-scope";
beforeEach(() =>
  vi.stubGlobal(
    "EventSource",
    class {
      close() {}
    },
  ),
);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = "";
});
describe("internal module lifecycle", () => {
  it("can reload through browser Location's read-only methods", () => {
    const reload = vi.fn();
    const browserLocation = Object.defineProperty({}, "reload", { value: reload, writable: false, configurable: false });
    vi.stubGlobal("location", browserLocation);
    const root = document.createElement("div");
    document.body.append(root);
    const scope = createControllerScope(root, new URL("https://panel.example/panel/mail"));
    expect(scope.window.location.pathname).toBe("/panel/mail");
    expect(() => scope.window.location.reload()).not.toThrow();
    expect(reload).toHaveBeenCalledTimes(1);
    scope.dispose();
  });
  it("shares server/session identity while keeping module DOM isolated", () => {
    document.body.innerHTML = '<select id="sidebar-server-switcher" data-current-target-id="remote-a"></select><a id="messenger-link" data-me="admin"></a><script id="lxp-ui-bootstrap" type="application/json">{}</script><input id="private-field">';
    const root = document.createElement("div");
    document.body.append(root);
    const scope = createControllerScope(root, new URL("https://panel.example/panel/mail"));
    expect(scope.document.getElementById("sidebar-server-switcher")?.getAttribute("data-current-target-id")).toBe("remote-a");
    expect(scope.document.getElementById("messenger-link")?.getAttribute("data-me")).toBe("admin");
    expect(scope.document.getElementById("lxp-ui-bootstrap")).not.toBeNull();
    expect(scope.document.getElementById("private-field")).toBeNull();
    const ready = vi.fn();
    scope.window.addEventListener("lxp:data-table:ready", ready);
    root.innerHTML = '<div data-table-id="mail-accounts-table"></div>';
    window.dispatchEvent(new CustomEvent("lxp:data-table:ready", { detail: { tableId: "mail-accounts-table" } }));
    window.dispatchEvent(new CustomEvent("lxp:data-table:ready", { detail: { tableId: "other-table" } }));
    expect(ready).toHaveBeenCalledTimes(1);
    scope.dispose();
  });
  it("opens files on repeated double clicks only in the visible module", () => {
    const root = document.createElement("div");
    root.innerHTML = `<button ondblclick="handleDblClick('/tmp/example.txt', false)"><span>example.txt</span></button>`;
    document.body.append(root);
    const scope = createControllerScope(root, new URL("https://panel.example/panel/files"));
    const open = vi.fn();
    (scope.window as any).handleDblClick = open;
    const label = root.querySelector("span")!;
    label.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(open).not.toHaveBeenCalled();
    for (let i = 0; i < 2; i++) label.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenLastCalledWith("/tmp/example.txt", false);
    scope.setVisible(false);
    label.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(open).toHaveBeenCalledTimes(2);
    scope.setVisible(true);
    label.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(open).toHaveBeenCalledTimes(3);
    scope.dispose();
    label.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(open).toHaveBeenCalledTimes(3);
  });
  it("isolates DOM/actions, closes locally, aborts reads while allowing an operation to finish", async () => {
    const first = document.createElement("div"),
      second = document.createElement("div");
    first.innerHTML =
      '<input id="draft" value="unsaved"><button data-lxp-handler-click="save(7)">Save</button>';
    second.innerHTML = '<input id="draft" value="other">';
    document.body.append(first, second);
    const scope = createControllerScope(
      first,
      new URL("https://panel.example/panel/users"),
    );
    const action = vi.fn();
    (scope.window as any).save = action;
    first.querySelector("button")!.click();
    expect(action).toHaveBeenCalledWith(7);
    expect(
      (scope.document.getElementById("draft") as HTMLInputElement).value,
    ).toBe("unsaved");
    let signal: AbortSignal | undefined;
    const mutation = Promise.resolve(new Response("{}"));
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: unknown, init: RequestInit) => {
        if (init.method === "PUT") return mutation;
        signal = init.signal!;
        return new Promise((_resolve, reject) =>
          signal!.addEventListener("abort", () =>
            reject(new DOMException("Abort", "AbortError")),
          ),
        );
      }),
    );
    const read = scope.fetch("/api/users");
    const write = scope.fetch("/api/users", { method: "PUT" });
    scope.setVisible(false);
    await expect(read).rejects.toMatchObject({ name: "AbortError" });
    expect(await write).toBeInstanceOf(Response);
    expect(signal!.aborted).toBe(true);
    await expect(scope.fetch("/api/users")).rejects.toMatchObject({
      name: "AbortError",
    });
    expect((first.querySelector("input") as HTMLInputElement).value).toBe(
      "unsaved",
    );
    scope.dispose();
  });
  it("pauses polling and informs controllers of reopening without leaking listeners", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    document.body.append(root);
    const scope = createControllerScope(
      root,
      new URL("https://panel.example/panel/monitor"),
    );
    const tick = vi.fn(),
      visibility = vi.fn();
    scope.document.addEventListener("lxp:module:visibility", visibility);
    scope.setInterval(tick, 1000);
    vi.advanceTimersByTime(1000);
    expect(tick).toHaveBeenCalledTimes(1);
    scope.setVisible(false);
    vi.advanceTimersByTime(5000);
    expect(tick).toHaveBeenCalledTimes(1);
    scope.setVisible(true);
    vi.advanceTimersByTime(1000);
    expect(tick).toHaveBeenCalledTimes(2);
    expect(visibility).toHaveBeenCalledTimes(2);
    scope.dispose();
    vi.advanceTimersByTime(1000);
    expect(tick).toHaveBeenCalledTimes(2);
  });
});

it("observes only the module DOM when a library passes the scoped document", async () => {
  const root = document.createElement("div");
  const other = document.createElement("div");
  document.body.append(root, other);
  const scope = createControllerScope(root, new URL("https://panel.example/panel/monitor"));
  const changes = vi.fn();
  const observer = new scope.MutationObserver(changes);
  expect(() => observer.observe(scope.document, { childList: true, subtree: true })).not.toThrow();
  other.append(document.createElement("canvas"));
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(changes).not.toHaveBeenCalled();
  root.append(document.createElement("canvas"));
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(changes).toHaveBeenCalledOnce();
  scope.dispose();
  root.append(document.createElement("canvas"));
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(changes).toHaveBeenCalledOnce();
});
