// Vitest — Files module listing (render + path helpers).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("/scripts/extracted/lib/api-client.js", async (importOriginal) => ({
  ...await importOriginal<Record<string, unknown>>(),
  api: {
    get: vi.fn(async () => ({ ok: true, data: "" })),
    put: vi.fn(async () => ({ ok: true })),
    post: vi.fn(async () => ({ ok: true })),
    delete: vi.fn(async () => ({ ok: true })),
  },
  resolvePanelApiPath: (p: string) => p,
  uploadFile: vi.fn(),
}));

import * as listing from "./listing";
import { S, selected } from "./state";
import { api } from "/scripts/extracted/lib/api-client.js";

function makeFile(name: string, isDir = false): any {
  return {
    name,
    isDir,
    isHidden: false,
    hasGit: false,
    size: 100,
    mtime: new Date("2026-07-22T12:00:00Z"),
    owner: "root",
    group: "root",
    mode: "0644",
  };
}

function ensureListViewDom() {
  document.body.innerHTML = `
    <table id="view-list">
      <thead><tr><th></th><th></th><th class="fsort" data-sort="name">Name</th><th class="fcol-type"></th><th class="fcol-size"></th><th class="fcol-owner"></th><th class="fcol-group"></th><th class="fcol-modified"></th><th class="fcol-perms"></th></tr></thead>
      <tbody id="file-tbody"></tbody>
    </table>
    <div id="view-grid" class="hidden"></div>
    <div id="view-projects" class="hidden"></div>
    <div id="view-content-search" class="hidden"></div>
    <button id="btn-view-list"></button>
    <button id="btn-view-grid"></button>
    <button id="btn-view-projects"></button>
    <div id="bulk-bar" class="hidden"><span id="bulk-count"></span></div>
    <input id="check-all" type="checkbox" />
  `;
}

beforeEach(() => {
  listing.cancelDirectoryListing();
  ensureListViewDom();
  S.currentPath = "/etc";
  S.viewMode = "list";
  S.isSearchMode = false;
  S.searchQuery = "";
  selected.clear();
  S.currentEntries = [];
  S.sortKey = "name";
  S.sortDir = 1;
  S.showHidden = false;
  S.contentResultsActive = false;
  vi.mocked(api.get).mockReset();
});

afterEach(() => {
  window.dispatchEvent(new Event("lxp:module:dispose"));
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("continuous file scrolling", () => {
  function scrollDom(mode: "list" | "grid" = "list") {
    document.getElementById("view-list")!.outerHTML = '<div id="view-list"><table data-infinite-files><tbody id="file-tbody"></tbody></table><div data-files-more></div></div>';
    document.getElementById("view-grid")!.innerHTML = '<div id="file-grid"></div><div data-files-more></div>';
    S.viewMode = mode;
    document.getElementById("view-list")!.classList.toggle("hidden", mode !== "list");
    document.getElementById("view-grid")!.classList.toggle("hidden", mode !== "grid");
    const view = document.getElementById(`view-${mode}`)!;
    Object.defineProperties(view, { clientHeight: { value: 500 }, scrollHeight: { get: () => Math.max(50, S.currentEntries.length) * 60, configurable: true } });
    listing.bindFileScroll();
    return view;
  }
  function page(offset: number, count = 50, total = 120) {
    return { ok: true, data: Array.from({ length: count }, (_, i) => makeFile(`file${offset + i}.txt`)), meta: { filesList: { total, nextOffset: offset + count, hasMore: offset + count < total } } } as any;
  }
  it.each(["list", "grid"] as const)("appends in %s mode at the bottom without replacing selected nodes", async (mode) => {
    const view = scrollDom(mode);
    vi.mocked(api.get).mockImplementation(async (_url, options: any) => page(Number(options.params.offset)));
    await listing.loadDirectoryListing();
    const selector = mode === "list" ? "#file-tbody tr" : ".grid-card";
    expect(document.querySelectorAll(selector)).toHaveLength(50);
    const first = document.querySelector<HTMLElement>(selector)!;
    listing.toggleSelect("/etc/file0.txt", true);
    view.scrollTop = 2440;
    view.dispatchEvent(new Event("scroll"));
    await vi.waitFor(() => expect(document.querySelectorAll(selector)).toHaveLength(100));
    expect(document.querySelector(selector)).toBe(first);
    expect(selected.has("/etc/file0.txt")).toBe(true);
    expect(view.scrollTop).toBe(2440);
    expect(vi.mocked(api.get).mock.calls.map(call => (call[1] as any).params.offset)).toEqual(["0", "50"]);
  });
  it("does not repeatedly retry a failed append and keeps the existing rows usable", async () => {
    const view = scrollDom();
    vi.mocked(api.get).mockResolvedValueOnce(page(0)).mockResolvedValueOnce({ ok: false, error: "offline" } as any).mockResolvedValueOnce(page(50, 10, 60));
    await listing.loadDirectoryListing();
    view.scrollTop = 2440;
    view.dispatchEvent(new Event("scroll"));
    await vi.waitFor(() => expect(view.querySelector("[data-files-more] button")).not.toBeNull());
    view.dispatchEvent(new Event("scroll"));
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll("#file-tbody tr")).toHaveLength(50);
    view.querySelector<HTMLButtonElement>("[data-files-more] button")!.click();
    await vi.waitFor(() => expect(document.querySelectorAll("#file-tbody tr")).toHaveLength(60));
    expect(view.querySelector("[data-files-more]")!.classList.contains("hidden")).toBe(true);
  });
  it("fills a viewport that is taller than the first batch without requiring a scroll event", async () => {
    const view = scrollDom();
    Object.defineProperty(view, "scrollHeight", { value: 400 });
    vi.mocked(api.get).mockResolvedValueOnce(page(0)).mockResolvedValueOnce(page(50, 10, 60));
    await listing.loadDirectoryListing();
    await vi.waitFor(() => expect(document.querySelectorAll("#file-tbody tr")).toHaveLength(60));
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});

describe("renderListView markup", () => {
  it("keeps the grid in place between the two clicks that open a file", () => {
    vi.useFakeTimers();
    document.getElementById("view-grid")!.innerHTML = '<div id="file-grid"></div>';
    S.viewMode = "grid";
    listing.renderGridView([makeFile("a.txt")]);
    const card = document.querySelector<HTMLElement>(".grid-card")!;
    card.setAttribute("data-lxp-handler-dblclick", card.getAttribute("ondblclick")!);
    card.removeAttribute("ondblclick");
    (window as any).toggleGridCard(new MouseEvent("click", { detail: 1 }), "/etc/a.txt");
    expect(card.getAttribute("aria-selected")).toBe("true");
    expect(document.getElementById("bulk-bar")!.classList.contains("hidden")).toBe(true);
    (window as any).toggleGridCard(new MouseEvent("click", { detail: 2 }), "/etc/a.txt");
    expect([...selected]).toEqual(["/etc/a.txt"]);
    expect(document.getElementById("bulk-bar")!.classList.contains("hidden")).toBe(false);
    vi.runAllTimers();
  });
  it("renders a row with a dblclick handleDblClick handler", () => {
    listing.renderListView([makeFile("a.txt", false)]);
    const row = document.querySelector<HTMLTableRowElement>("#file-tbody tr");
    expect(row).toBeTruthy();
    const nameCell = row!.querySelector("[ondblclick]");
    expect(nameCell?.getAttribute("ondblclick") ?? "").toContain("handleDblClick");
  });

  it("grid cards render for each entry", () => {
    document.body.innerHTML = `
      <table id="view-list" class="hidden">
        <thead><tr><th></th><th></th><th class="fsort" data-sort="name"></th><th></th><th></th><th></th><th></th><th></th><th></th></tr></thead>
        <tbody id="file-tbody"></tbody>
      </table>
      <div id="view-grid">
        <div id="file-grid"></div>
      </div>
      <div id="view-projects" class="hidden"></div>
      <div id="view-content-search" class="hidden"></div>
      <button id="btn-view-list"></button>
      <button id="btn-view-grid"></button>
      <button id="btn-view-projects"></button>
    `;
    S.viewMode = "grid";
    listing.renderGridView([makeFile("a.txt", false), makeFile("conf.d", true)]);
    const cards = document.querySelectorAll<HTMLElement>("#file-grid .grid-card");
    expect(cards).toHaveLength(2);
  });
});

describe("rowPathFor", () => {
  it("joins currentPath and entry name with a single slash", () => {
    S.currentPath = "/etc";
    expect(listing.rowPathFor(makeFile("a.txt"))).toBe("/etc/a.txt");
  });

  it("uses entry.path when in search mode", () => {
    S.isSearchMode = true;
    expect(listing.rowPathFor({ name: "a.txt", path: "/var/log/a.txt" })).toBe("/var/log/a.txt");
  });
});
