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
  ensureListViewDom();
  S.currentPath = "/etc";
  S.viewMode = "list";
  S.isSearchMode = false;
  S.searchQuery = "";
  selected.clear();
  S.currentEntries = [];
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
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
