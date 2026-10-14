import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ request: vi.fn(), open: vi.fn() }));
vi.mock("./logs-api", () => ({ logsRequest: mocks.request, openLogsSettings: mocks.open }));
import LogsPanel from "./LogsPanel";
const labels = new Proxy({}, { get: (_target, key) => String(key) }) as Record<string, string>;
const fixture = (message: string) => ({ items: [{ id: "a".repeat(24), severity: "error", source: "backend", module: "example-module", message, firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(), count: 1 }], total: 1, modules: ["example-module"], sources: ["backend"], summary: { error: 1, warn: 0, fatal: 0 } });
it("discards late logs and setup replies when the selected server changes", async () => {
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
 let oldReply!: (value: any) => void; let oldSetup!: (value: any) => void; let server = "old";
 mocks.request.mockImplementation((_method: string, path: string) => {
   if (path === "/config") return server === "old" ? new Promise((resolve) => oldSetup = resolve) : Promise.resolve({ ready: false });
   if (path === "/status") return Promise.resolve({ history: {} });
   if (path.startsWith("?")) return server === "old" ? new Promise((resolve) => oldReply = resolve) : Promise.resolve(fixture("current server error"));
   throw new Error("Unexpected request");
 });
 const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
 try {
  await act(async () => root.render(createElement(LogsPanel, { labels, active: true, view: "modules" })));
  server = "new"; await act(async () => window.dispatchEvent(new Event("luxipanel:target-changed")));
  expect(host.textContent).toContain("current server error");
  await act(async () => { oldReply(fixture("private old server error")); oldSetup({ ready: true }); });
  expect(host.textContent).not.toContain("private old server error"); expect(host.textContent).toContain("current server error");
  expect(mocks.request.mock.calls.filter(([, path]) => path.startsWith("?")).every(([, path]) => path.includes("view=modules"))).toBe(true);
 } finally { await act(async () => root.unmount()); host.remove(); }
});
it("clears module logs before rendering the core tab and renders messages as plain text", async () => {
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
 let coreReply!: (value: any) => void;
 mocks.request.mockImplementation((_method: string, path: string) => path === "/config" ? Promise.resolve({ ready: false }) : path === "/status" ? Promise.resolve({ history: {} }) : path.includes("view=luxipanel") ? new Promise((resolve) => coreReply = resolve) : Promise.resolve(fixture('<img src=x onerror=alert(1)>')));
 const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
 try {
  await act(async () => root.render(createElement(LogsPanel, { labels, active: true, view: "modules" })));
  expect(host.textContent).toContain("<img"); expect(host.querySelector("img")).toBeNull();
  await act(async () => root.render(createElement(LogsPanel, { labels, active: true, view: "luxipanel" })));
  expect(host.textContent).not.toContain("<img");
  await act(async () => coreReply(fixture("core error"))); expect(host.textContent).toContain("core error");
 } finally { await act(async () => root.unmount()); host.remove(); }
});
