import { expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ scope: "a", streams: [] as Array<EventTarget & { close: ReturnType<typeof vi.fn> }> }));
vi.mock("../../../lib/api-client", () => ({
  resolveTargetScope: () => h.scope,
  scopeHeaders: (mutating = false) => ({ "X-Bridge-Session-Id": `bridge-${h.scope}`, ...(mutating ? { "X-CSRF-Token": "csrf" } : {}) }),
}));
vi.mock("../../../lib/notification-event-stream", () => ({
  createNotificationStream: () => {
    const stream = Object.assign(new EventTarget(), { close: vi.fn() });
    h.streams.push(stream); return stream;
  },
}));

it("isolates the bell, delayed HTTP replies and stream events when the selected server changes", async () => {
  document.body.innerHTML = `<button id="notifications-btn"></button><span id="notifications-badge"></span>
    <dialog id="notifications-drawer"><ul id="notifications-list"></ul><button id="notifications-mark-all"></button></dialog>`;
  const dialog = document.getElementById("notifications-drawer") as HTMLDialogElement;
  dialog.showModal = () => { dialog.setAttribute("open", ""); };
  let resolveCountA!: (response: unknown) => void, resolveListA!: (response: unknown) => void;
  const countA = new Promise(resolve => { resolveCountA = resolve; });
  const listA = new Promise(resolve => { resolveListA = resolve; });
  const jsonResponse = (json: unknown) => ({ ok: true, status: 200, json: async () => json });
  const row = (id: string) => ({ id, title: id, message: id, source: "ai", severity: "info", read: false });
  const fetchMock = vi.fn((url: string, options: RequestInit) => {
    const bridge = (options.headers as Record<string, string>)["X-Bridge-Session-Id"];
    if (bridge === "bridge-a") return url.includes("unread-count") ? countA : listA;
    return Promise.resolve(jsonResponse(url.includes("unread-count") ? { count: 1 } : { data: [row("b")], unread: 1 }));
  });
  vi.stubGlobal("fetch", fetchMock);
  try {
    const module = await import("./notifications.js");
    module.initNotifications();
    document.getElementById("notifications-btn")!.click();
    const first = h.streams[0]!;
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ headers: { "X-Bridge-Session-Id": "bridge-a" } });
    h.scope = "b";
    window.dispatchEvent(new CustomEvent("luxipanel:target-changed"));
    await vi.waitFor(() => expect(document.getElementById("notifications-list")!.textContent).toContain("b"));
    expect(first.close).toHaveBeenCalledOnce();
    resolveCountA(jsonResponse({ count: 99 }));
    resolveListA(jsonResponse({ data: [row("old-server-row")], unread: 99 }));
    first.dispatchEvent(new MessageEvent("notification:created", { data: JSON.stringify(row("stale-event")) }));
    first.dispatchEvent(new MessageEvent("notification:cleared", { data: '{"all":true}' }));
    await Promise.resolve(); await Promise.resolve();
    const state = (window as any).__lxpNotifications;
    expect(state.items.map((item: { id: string }) => item.id)).toEqual(["b"]);
    expect(state.unread).toBe(1);
    const second = h.streams[1]!;
    second.dispatchEvent(new MessageEvent("notification:created", { data: JSON.stringify(row("b-live")) }));
    expect(state.items.map((item: { id: string }) => item.id)).toEqual(["b-live", "b"]);
    document.getElementById("notifications-mark-all")!.click();
    expect(fetchMock.mock.calls.at(-1)?.[1]).toMatchObject({ method: "POST", headers: { "X-Bridge-Session-Id": "bridge-b", "X-CSRF-Token": "csrf" } });
  } finally {
    document.dispatchEvent(new Event("astro:before-swap"));
    vi.unstubAllGlobals();
  }
});
