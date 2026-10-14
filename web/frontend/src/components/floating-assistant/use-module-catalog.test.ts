// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ target: "A", list: vi.fn() }));
vi.mock("./assistant-api", () => ({ assistantModulesApi: { list: state.list } }));
vi.mock("@/lib/api-client", () => ({ scopeHeaders: () => ({ target: state.target }) }));
import { useModuleCatalog } from "./use-module-catalog";
let root: Root;
beforeEach(() => { vi.useFakeTimers(); state.target = "A"; state.list.mockReset(); (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; root = createRoot(document.createElement("div")); });
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers(); });
it("discards an old server response and refreshes on module changes", async () => {
  const rows = vi.fn(); let oldReply!: (rows: unknown[]) => void;
  state.list.mockImplementationOnce(() => new Promise(resolve => { oldReply = resolve; })).mockResolvedValue([{ moduleId: "server-B" }]);
  const Catalog = () => { useModuleCatalog(rows); return null; };
  await act(async () => root.render(createElement(Catalog)));
  state.target = "B";
  await act(async () => window.dispatchEvent(new Event("luxipanel:target-changed")));
  expect(rows).toHaveBeenLastCalledWith([]);
  await act(async () => { oldReply([{ moduleId: "server-A" }]); await Promise.resolve(); });
  expect(rows).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTimeAsync(100));
  expect(rows).toHaveBeenLastCalledWith([{ moduleId: "server-B" }]);
  state.list.mockResolvedValue([{ moduleId: "new-module" }]);
  await act(async () => { window.dispatchEvent(new Event("luxipanel:modules-changed")); window.dispatchEvent(new Event("luxipanel:modules-changed")); });
  await act(async () => vi.advanceTimersByTimeAsync(100));
  expect(state.list).toHaveBeenCalledTimes(3);
  expect(rows).toHaveBeenLastCalledWith([{ moduleId: "new-module" }]);
});
it("clears permissions immediately and cannot deliver an in-flight result after unmount", async () => {
  const rows = vi.fn(); let reply!: (rows: unknown[]) => void;
  state.list.mockImplementation(() => new Promise(resolve => { reply = resolve; }));
  const Catalog = () => { useModuleCatalog(rows); return null; };
  await act(async () => root.render(createElement(Catalog)));
  await act(async () => window.dispatchEvent(new Event("luxipanel:permissions-changed")));
  expect(rows).toHaveBeenLastCalledWith([]);
  await act(async () => root.unmount());
  await act(async () => { reply([{ moduleId: "forbidden" }]); await Promise.resolve(); await vi.advanceTimersByTimeAsync(200); });
  expect(rows).toHaveBeenCalledTimes(1);
});
