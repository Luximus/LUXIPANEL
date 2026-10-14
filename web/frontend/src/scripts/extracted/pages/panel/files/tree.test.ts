// Vitest — Files module folder tree (files-in-tree + per-extension icons,
// open-in-editor on file click, and the name-search dual filter).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn(async (..._args: any[]): Promise<any> => ({ ok: true, data: [] as any[] }));
const apiPatch = vi.fn(async (..._args: any[]): Promise<any> => ({ ok: true, data: {} }));
vi.mock("/scripts/extracted/lib/api-client.js", async (importOriginal) => ({
  ...await importOriginal<Record<string, unknown>>(),
  api: {
    get: (...args: any[]) => apiGet(...args),
    patch: (...args: any[]) => apiPatch(...args),
    put: vi.fn(async () => ({ ok: true })),
    post: vi.fn(async () => ({ ok: true })),
    delete: vi.fn(async () => ({ ok: true })),
  },
  resolvePanelApiPath: (p: string) => p,
  LOCAL_TARGET_SCOPE: "local",
  uploadFile: vi.fn(),
}));

import * as tree from "./tree";
import { openFolderPicker, pickFolder } from "./history-file-versions";
import { loadFilesPreferences } from "./preferences";
import { S } from "./state";

function entry(name: string, isDir: boolean, extra: Record<string, unknown> = {}) {
  return { name, isDir, isHidden: name.startsWith("."), ...extra };
}

beforeEach(() => {
  document.body.innerHTML = `<div id="files-tree" role="tree"></div>`;
  tree.treeChildrenCache.clear();
  apiGet.mockReset();
  apiGet.mockResolvedValue({ ok: true, data: [] });
  apiPatch.mockReset();
  apiPatch.mockResolvedValue({ ok: true, data: {} });
  S.showHidden = true; // don't let the hidden gate interfere in tests
  S.treeExpansionMode = "multiple";
});

afterEach(() => {
  document.body.innerHTML = "";
  delete (window as any).handleDblClick;
  S.activeTargetScope = "";
  S.preferencesLoadedScope = "";
});

describe("fetchTreeChildren", () => {
  it("splits entries into dirs + files, each sorted alphabetically", async () => {
    apiGet.mockResolvedValue({
      ok: true,
      data: [entry("zeta.txt", false), entry("beta", true), entry("app.js", false), entry("alpha", true)],
    });
    const { dirs, files } = await tree.fetchTreeChildren("/srv");
    expect(dirs.map((d) => d.name)).toEqual(["alpha", "beta"]);
    expect(files.map((f) => f.name)).toEqual(["app.js", "zeta.txt"]);
  });

  it("caches per node (second call does not hit the API)", async () => {
    apiGet.mockResolvedValue({ ok: true, data: [entry("a", true)] });
    await tree.fetchTreeChildren("/srv");
    await tree.fetchTreeChildren("/srv");
    expect(apiGet).toHaveBeenCalledTimes(1);
  });
});

describe("makeTreeFileNode", () => {
  it("renders a file node with no twisty and a per-extension icon", () => {
    const node = tree.makeTreeFileNode("/srv/app.js", entry("app.js", false), 1);
    expect(node.getAttribute("data-tree-file")).toBe("1");
    expect(node.getAttribute("data-tree-name")).toBe("app.js");
    // No expand chevron on file nodes.
    expect(node.querySelector("[data-tree-toggle]")).toBeNull();
    // An icon (inline SVG span from fileIcon) is present.
    expect(node.querySelector("svg")).toBeTruthy();
    expect(node.querySelector("[data-tree-label]")?.textContent).toBe("app.js");
  });
});

describe("branched folder tree", () => {
  it("shows root guidance only when the picker sets the tree root", () => {
    document.body.innerHTML = `<dialog id="dialog-folder-picker">
      <h3 id="folder-picker-title"></h3>
      <section id="folder-picker-tree-options" class="hidden"></section>
      <div id="folder-picker-current"></div><ul id="folder-picker-list"></ul>
    </dialog>`;
    pickFolder("/", () => {}, true);
    expect(document.getElementById("folder-picker-tree-options")?.classList.contains("hidden")).toBe(false);
    expect(document.getElementById("folder-picker-title")?.textContent).toContain("carpeta raíz");
    openFolderPicker("compare-from");
    expect(document.getElementById("folder-picker-tree-options")?.classList.contains("hidden")).toBe(true);
  });

  it("closes other branches in single mode and retains them in multiple mode", async () => {
    const treeEl = document.getElementById("files-tree")!;
    const root = tree.makeTreeNode("/", "Raíz", 0, true);
    treeEl.appendChild(root);
    apiGet.mockImplementation(async (_url, options) => ({
      ok: true,
      data: options?.params?.path === "/" ? [entry("alpha", true), entry("beta", true)]
        : options?.params?.path === "/alpha" ? [entry("one", true)] : [],
    }));
    S.treeExpansionMode = "single";
    await tree.expandTreeNode(root);
    const alpha = tree.treeFindNode("/alpha")!;
    const beta = tree.treeFindNode("/beta")!;
    await tree.expandTreeNode(alpha);
    const one = tree.treeFindNode("/alpha/one")!;
    await tree.expandTreeNode(one);
    await tree.expandTreeNode(beta);
    expect(root.getAttribute("data-expanded")).toBe("1");
    expect(beta.getAttribute("data-expanded")).toBe("1");
    expect(alpha.getAttribute("data-expanded")).toBeNull();
    expect(one.getAttribute("data-expanded")).toBeNull();
    S.treeExpansionMode = "multiple";
    await tree.expandTreeNode(alpha);
    expect(alpha.getAttribute("data-expanded")).toBe("1");
    expect(beta.getAttribute("data-expanded")).toBe("1");
  });

  it("does not reopen an older branch when its slow response arrives last", async () => {
    const treeEl = document.getElementById("files-tree")!;
    const root = tree.makeTreeNode("/", "Raíz", 0, true);
    treeEl.appendChild(root);
    let finishAlpha!: (value: any) => void;
    apiGet.mockImplementation((_url, options) => {
      const path = options?.params?.path;
      if (path === "/") return Promise.resolve({ ok: true, data: [entry("alpha", true), entry("beta", true)] });
      if (path === "/alpha") return new Promise((resolve) => { finishAlpha = resolve; });
      return Promise.resolve({ ok: true, data: [] });
    });
    S.treeExpansionMode = "single";
    await tree.expandTreeNode(root);
    const alpha = tree.treeFindNode("/alpha")!;
    const beta = tree.treeFindNode("/beta")!;
    const first = tree.expandTreeNode(alpha);
    await tree.expandTreeNode(beta);
    finishAlpha({ ok: true, data: [entry("stale.txt", false)] });
    await first;
    expect(alpha.getAttribute("data-expanded")).toBeNull();
    expect(tree.treeChildrenEl(alpha)?.classList.contains("hidden")).toBe(true);
    expect(beta.getAttribute("data-expanded")).toBe("1");
  });

  it("saves the folder-opening mode when changed in the root picker", async () => {
    document.body.insertAdjacentHTML("beforeend", `<section id="folder-picker-tree-options">
      <input type="radio" name="folder-picker-tree-mode" value="multiple" checked>
      <input type="radio" name="folder-picker-tree-mode" value="single">
    </section>`);
    tree.initFilesSettingsRoots();
    const single = document.querySelector<HTMLInputElement>('input[value="single"]')!;
    single.checked = true;
    single.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => expect(apiPatch).toHaveBeenCalledWith("/api/files/preferences", { treeExpansionMode: "single" }));
    expect(S.treeExpansionMode).toBe("single");
  });

  it("restores the saved opening mode for the active server", async () => {
    S.activeTargetScope = "tree-mode-test";
    S.preferencesLoadedScope = "";
    apiGet.mockResolvedValue({ ok: true, data: { mode: "developer", showHidden: false, favoriteRoots: [], treeExpansionMode: "single" } });
    await loadFilesPreferences();
    expect(S.treeExpansionMode).toBe("single");
    expect(S.preferencesLoadedScope).toBe("tree-mode-test");
  });

  it("keeps the tree scroll position when expanding below the current selection", async () => {
    const treeEl = document.getElementById("files-tree")!;
    const root = tree.makeTreeNode("/srv", "srv", 0, true);
    treeEl.appendChild(root);
    apiGet.mockImplementation(async (_url, options) => ({
      ok: true,
      data: options?.params?.path === "/srv" ? [entry("deep", true)] : [],
    }));
    await tree.expandTreeNode(root);
    tree.highlightTreeCurrent("/srv");
    const rootRow = root.querySelector<HTMLElement>("[data-tree-row]")!;
    const scrollIntoView = vi.fn();
    rootRow.scrollIntoView = scrollIntoView;
    treeEl.scrollTop = 180;
    await tree.expandTreeNode(tree.treeFindNode("/srv/deep")!);
    expect(treeEl.scrollTop).toBe(180);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("opens a folder on the right without expanding or scrolling the left tree", async () => {
    const treeEl = document.getElementById("files-tree")!;
    const root = tree.makeTreeNode("/", "Raíz", 0, true);
    treeEl.appendChild(root);
    S.filesAllowAll = true;
    apiGet.mockImplementation(async (_url, options) => ({
      ok: true,
      data: options?.params?.path === "/" ? [entry("srv", true)] : [entry("app.js", false)],
    }));
    await tree.expandTreeNode(root);
    const srv = tree.treeFindNode("/srv")!;
    const navigate = vi.fn((path: string) => {
      tree.onTreePathChanged(new CustomEvent("luxipanel:files-path-changed", { detail: { path } }));
    });
    (window as any).navigate = navigate;
    treeEl.addEventListener("click", tree.onTreeClick);
    treeEl.scrollTop = 180;
    srv.querySelector<HTMLElement>("[data-tree-label]")!.click();
    expect(navigate).toHaveBeenCalledWith("/srv");
    expect(treeEl.scrollTop).toBe(180);
    expect(tree.treeChildrenEl(srv)?.classList.contains("hidden")).toBe(true);
    expect(apiGet).toHaveBeenCalledTimes(1);
    srv.querySelector<HTMLElement>("[data-tree-toggle]")!.click();
    await vi.waitFor(() => expect(tree.treeChildrenEl(srv)?.dataset.loaded).toBe("1"));
    expect(treeEl.scrollTop).toBe(180);
    delete (window as any).navigate;
  });

  it("marks the selected path and its ancestors after lazy expansion", async () => {
    const treeEl = document.getElementById("files-tree")!;
    const root = tree.makeTreeNode("/srv", "srv", 0, true);
    treeEl.appendChild(root);
    apiGet.mockImplementation(async (_url, options) => ({
      ok: true,
      data: options?.params?.path === "/srv" ? [entry("app", true)] : [entry("config.json", false)],
    }));
    await tree.expandTreeNode(root);
    const app = tree.treeFindNode("/srv/app")!;
    await tree.expandTreeNode(app);
    tree.highlightTreeCurrent("/srv/app/config.json");
    expect(root.hasAttribute("data-branch-active")).toBe(true);
    expect(app.hasAttribute("data-branch-active")).toBe(true);
    expect(tree.treeFindNode("/srv/app/config.json")?.querySelector("[data-tree-row]")?.getAttribute("aria-selected")).toBe("true");
    expect(treeEl.hasAttribute("data-marker-on")).toBe(true);
    tree.collapseTreeNode(app);
    expect(app.querySelector("[data-tree-row]")?.getAttribute("aria-expanded")).toBe("false");
    expect(tree.treeChildrenEl(app)?.hasAttribute("inert")).toBe(true);
    expect(app.querySelector("[data-tree-row]")?.getAttribute("tabindex")).toBe("0");
    expect(tree.treeFindNode("/srv/app/config.json")?.querySelector("[data-tree-row]")?.getAttribute("tabindex")).toBe("-1");
  });

  it("moves by visible rows and expands a folder with arrow keys", async () => {
    const treeEl = document.getElementById("files-tree")!;
    const root = tree.makeTreeNode("/srv", "srv", 0, true);
    treeEl.appendChild(root);
    apiGet.mockResolvedValue({ ok: true, data: [entry("app", true), entry("readme.md", false)] });
    treeEl.addEventListener("keydown", tree.onTreeKeydown);
    await tree.expandTreeNode(root);
    const rootRow = root.querySelector<HTMLElement>("[data-tree-row]")!;
    const childRow = tree.treeFindNode("/srv/app")?.querySelector<HTMLElement>("[data-tree-row]")!;
    rootRow.focus();
    rootRow.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.activeElement).toBe(childRow);
    childRow.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(document.activeElement).toBe(rootRow);
    rootRow.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(root.getAttribute("data-expanded")).toBeNull();
    rootRow.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await vi.waitFor(() => expect(document.activeElement).toBe(childRow));
  });
});

describe("onTreeClick", () => {
  it("opens a file node as a PREVIEW tab on a single click (after the dbl-click window)", () => {
    vi.useFakeTimers();
    const handleDblClick = vi.fn();
    (window as any).handleDblClick = handleDblClick;
    const treeEl = document.getElementById("files-tree")!;
    treeEl.appendChild(tree.makeTreeFileNode("/srv/app.js", entry("app.js", false), 1));
    const label = treeEl.querySelector("[data-tree-label]") as HTMLElement;
    tree.onTreeClick({ target: label } as unknown as Event);
    // Nothing yet — a lone click waits to see if a second one arrives.
    expect(handleDblClick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(260);
    expect(handleDblClick).toHaveBeenCalledWith("/srv/app.js", false, { preview: true });
    vi.useRealTimers();
  });

  it("opens a file node as a PERMANENT tab on a double click (two clicks within the window)", () => {
    vi.useFakeTimers();
    const handleDblClick = vi.fn();
    (window as any).handleDblClick = handleDblClick;
    const treeEl = document.getElementById("files-tree")!;
    treeEl.appendChild(tree.makeTreeFileNode("/srv/app.js", entry("app.js", false), 1));
    const label = treeEl.querySelector("[data-tree-label]") as HTMLElement;
    tree.onTreeClick({ target: label } as unknown as Event);
    tree.onTreeClick({ target: label } as unknown as Event);
    // The second click fires immediately as a permanent open; no preview leaks.
    expect(handleDblClick).toHaveBeenCalledTimes(1);
    expect(handleDblClick).toHaveBeenCalledWith("/srv/app.js", false, { preview: false });
    vi.advanceTimersByTime(300);
    expect(handleDblClick).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("navigates (not edit) when a folder row is clicked", () => {
    const navigate = vi.fn();
    (window as any).navigate = navigate;
    (window as any).handleDblClick = vi.fn();
    const treeEl = document.getElementById("files-tree")!;
    treeEl.appendChild(tree.makeTreeNode("/srv/sub", "sub", 1));
    const label = treeEl.querySelector("[data-tree-label]") as HTMLElement;
    tree.onTreeClick({ target: label } as unknown as Event);
    expect(navigate).toHaveBeenCalledWith("/srv/sub");
    expect((window as any).handleDblClick).not.toHaveBeenCalled();
  });
});

describe("onTreeContextMenu", () => {
  afterEach(() => {
    delete (window as any).showFileContextMenu;
    delete (window as any).navigate;
  });

  it("opens the shared file context menu for a FILE node (isDir=false)", () => {
    const opener = vi.fn();
    (window as any).showFileContextMenu = opener;
    const treeEl = document.getElementById("files-tree")!;
    treeEl.appendChild(tree.makeTreeFileNode("/srv/app.js", entry("app.js", false), 1));
    const label = treeEl.querySelector("[data-tree-label]") as HTMLElement;
    const ev = { target: label, preventDefault: vi.fn() } as unknown as MouseEvent;
    tree.onTreeContextMenu(ev);
    expect(opener).toHaveBeenCalledWith(ev, "/srv/app.js", "app.js", false);
  });

  it("opens the shared context menu for a FOLDER node (isDir=true) and never navigates", () => {
    const opener = vi.fn();
    const navigate = vi.fn();
    (window as any).showFileContextMenu = opener;
    (window as any).navigate = navigate;
    const treeEl = document.getElementById("files-tree")!;
    treeEl.appendChild(tree.makeTreeNode("/srv/sub", "sub", 1));
    const label = treeEl.querySelector("[data-tree-label]") as HTMLElement;
    const ev = { target: label, preventDefault: vi.fn() } as unknown as MouseEvent;
    tree.onTreeContextMenu(ev);
    expect(opener).toHaveBeenCalledWith(ev, "/srv/sub", "sub", true);
    // Right-click must not trigger folder navigation.
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does NOT swallow the event when the shared opener isn't available (visible native fallback)", () => {
    // De-silenced: if the opener is genuinely missing we leave preventDefault
    // untouched so the browser's native menu shows, instead of a dead right-click
    // (the opener itself calls preventDefault on the happy path).
    const treeEl = document.getElementById("files-tree")!;
    treeEl.appendChild(tree.makeTreeFileNode("/srv/app.js", entry("app.js", false), 1));
    const label = treeEl.querySelector("[data-tree-label]") as HTMLElement;
    const preventDefault = vi.fn();
    tree.onTreeContextMenu({ target: label, preventDefault } as unknown as MouseEvent);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("looks up the opener LAZILY at click-time, so a node added after binding still opens it", () => {
    // Reproduces the load-order concern: the tree listener is bound before
    // context-menu.ts defines window.showFileContextMenu. A lazy lookup means a
    // right-click resolves the opener that exists at click-time, on any node —
    // including ones re-rendered after an expand/refresh.
    const treeEl = document.getElementById("files-tree")!;
    const opener = vi.fn();
    (window as any).showFileContextMenu = opener; // defined AFTER init would have run
    treeEl.appendChild(tree.makeTreeFileNode("/srv/late.js", entry("late.js", false), 1));
    const label = treeEl.querySelector("[data-tree-label]") as HTMLElement;
    const ev = { target: label, preventDefault: vi.fn() } as unknown as MouseEvent;
    tree.onTreeContextMenu(ev);
    expect(opener).toHaveBeenCalledWith(ev, "/srv/late.js", "late.js", false);
  });
});

describe("refreshTreeDir", () => {
  it("invalidates the cache and re-fetches an expanded folder's children", async () => {
    const treeEl = document.getElementById("files-tree")!;
    const root = tree.makeTreeNode("/srv", "srv", 0, true);
    const childrenEl = root.querySelector("[data-tree-children]") as HTMLElement;
    childrenEl.classList.remove("hidden");
    childrenEl.dataset.loaded = "1";
    root.setAttribute("data-expanded", "1");
    treeEl.appendChild(root);
    tree.treeChildrenCache.set("/srv", { dirs: [], files: [] });
    apiGet.mockResolvedValue({ ok: true, data: [entry("new.txt", false)] });
    await tree.refreshTreeDir("/srv");
    // Cache was dropped and the folder refetched, rendering the new child.
    expect(apiGet).toHaveBeenCalled();
    expect(treeEl.querySelector('[data-tree-path="/srv/new.txt"]')).toBeTruthy();
  });

  it("is a no-op for a folder that was never loaded", async () => {
    const treeEl = document.getElementById("files-tree")!;
    treeEl.appendChild(tree.makeTreeNode("/srv", "srv", 0, true));
    apiGet.mockClear();
    await tree.refreshTreeDir("/srv");
    expect(apiGet).not.toHaveBeenCalled();
  });
});

describe("name-search dual filter", () => {
  function buildTree() {
    const treeEl = document.getElementById("files-tree")!;
    const root = tree.makeTreeNode("/srv", "srv", 0, true);
    const childrenEl = root.querySelector("[data-tree-children]") as HTMLElement;
    childrenEl.classList.remove("hidden");
    childrenEl.dataset.loaded = "1";
    childrenEl.appendChild(tree.makeTreeNode("/srv/config", "config", 1));
    childrenEl.appendChild(tree.makeTreeFileNode("/srv/app.js", entry("app.js", false), 1));
    childrenEl.appendChild(tree.makeTreeFileNode("/srv/readme.md", entry("readme.md", false), 1));
    treeEl.appendChild(root);
    return treeEl;
  }

  it("hides non-matching nodes and highlights matches", () => {
    const treeEl = buildTree();
    tree.filterTreeByName("app");
    const appNode = treeEl.querySelector('[data-tree-path="/srv/app.js"]') as HTMLElement;
    const readmeNode = treeEl.querySelector('[data-tree-path="/srv/readme.md"]') as HTMLElement;
    const configNode = treeEl.querySelector('[data-tree-path="/srv/config"]') as HTMLElement;
    expect(appNode.classList.contains("hidden")).toBe(false);
    expect(readmeNode.classList.contains("hidden")).toBe(true);
    expect(configNode.classList.contains("hidden")).toBe(true);
    // The match keeps its ancestor (root) visible.
    expect((treeEl.querySelector('[data-tree-path="/srv"]') as HTMLElement).classList.contains("hidden")).toBe(false);
    // Match is highlighted.
    expect(appNode.querySelector("[data-tree-label]")?.classList.contains("text-primary")).toBe(true);
  });

  it("restores the full tree when cleared", () => {
    const treeEl = buildTree();
    tree.filterTreeByName("app");
    tree.clearTreeFilter();
    treeEl.querySelectorAll("[data-tree-path]").forEach((n) => {
      expect((n as HTMLElement).classList.contains("hidden")).toBe(false);
    });
    expect(treeEl.querySelector('[data-tree-path="/srv/app.js"] [data-tree-label]')?.classList.contains("text-primary")).toBe(false);
  });
});

describe("recursive tree search (GET /api/files/search?base=)", () => {
  beforeEach(() => {
    document.body.innerHTML =
      `<input id="files-search" />` +
      `<div id="files-tree" role="tree"></div>` +
      `<div id="files-tree-results" class="hidden"></div>`;
    S.filesAllowAll = true;
  });

  function results() {
    return document.getElementById("files-tree-results") as HTMLElement;
  }

  it("queries the new endpoint with base/q/limit and renders the flat hits", async () => {
    apiGet.mockResolvedValue({
      ok: true,
      data: {
        base: "/",
        truncated: false,
        items: [
          { path: "/srv/app.js", name: "app.js", type: "file" },
          { path: "/srv/apps", name: "apps", type: "dir" },
        ],
      },
    });
    await tree.searchTreeRemote("app");
    expect(apiGet).toHaveBeenCalledWith("/api/files/search", {
      params: { base: "/", q: "app", limit: tree.TREE_SEARCH_LIMIT },
    });
    // Results replace the tree while a query is active.
    expect(results().classList.contains("hidden")).toBe(false);
    expect(document.getElementById("files-tree")!.classList.contains("hidden")).toBe(true);
    // Folders first, then files.
    const rows = results().querySelectorAll("[data-tree-path]");
    expect(Array.from(rows).map((r) => r.getAttribute("data-tree-path"))).toEqual(["/srv/apps", "/srv/app.js"]);
    // Only file rows carry the file marker (drives click → open in editor).
    expect(rows[0]!.getAttribute("data-tree-file")).toBeNull();
    expect(rows[1]!.getAttribute("data-tree-file")).toBe("1");
    // The matched substring is highlighted.
    expect(results().querySelector("mark")?.textContent).toBe("app");
  });

  it("shows the trimmed-results notice when the backend truncates", async () => {
    apiGet.mockResolvedValue({
      ok: true,
      data: { base: "/", truncated: true, items: [{ path: "/srv/app.js", name: "app.js", type: "file" }] },
    });
    await tree.searchTreeRemote("app");
    expect(results().textContent).toContain("recortados");
  });

  it("renders an empty state when there are no hits", async () => {
    apiGet.mockResolvedValue({ ok: true, data: { base: "/", truncated: false, items: [] } });
    await tree.searchTreeRemote("zzz");
    expect(results().textContent).toContain("Sin coincidencias");
    expect(results().querySelector("[data-tree-path]")).toBeNull();
  });

  it("surfaces a message instead of results when the request fails (403/500)", async () => {
    apiGet.mockResolvedValue({ ok: false, status: 403, error: "FORBIDDEN" });
    await tree.searchTreeRemote("app");
    expect(results().textContent).toContain("No se pudo completar");
  });

  it("degrades SILENTLY to the local filter on a transport failure (status 0)", async () => {
    document.getElementById("files-tree")!.innerHTML =
      `<div class="tree-node" data-tree-path="/srv/app.js" data-tree-name="app.js" data-tree-file="1"><div data-tree-row><span data-tree-label>app.js</span></div></div>` +
      `<div class="tree-node" data-tree-path="/srv/other.js" data-tree-name="other.js" data-tree-file="1"><div data-tree-row><span data-tree-label>other.js</span></div></div>`;
    apiGet.mockResolvedValue({ ok: false, status: 0, error: "Network error" });
    await tree.searchTreeRemote("app");
    // No error surfaced, the tree is back, and the local filter did its job.
    expect(results().classList.contains("hidden")).toBe(true);
    expect(document.getElementById("files-tree")!.classList.contains("hidden")).toBe(false);
    const visible = Array.from(document.querySelectorAll<HTMLElement>("#files-tree .tree-node"))
      .filter((n) => !n.classList.contains("hidden"))
      .map((n) => n.getAttribute("data-tree-path"));
    expect(visible).toEqual(["/srv/app.js"]);
  });

  it("hides dotfiles unless hidden files are visible", async () => {
    S.showHidden = false;
    apiGet.mockResolvedValue({
      ok: true,
      data: {
        base: "/",
        truncated: false,
        items: [
          { path: "/srv/.approc", name: ".approc", type: "file" },
          { path: "/srv/app.js", name: "app.js", type: "file" },
        ],
      },
    });
    await tree.searchTreeRemote("app");
    const paths = Array.from(results().querySelectorAll("[data-tree-path]")).map((r) => r.getAttribute("data-tree-path"));
    expect(paths).toEqual(["/srv/app.js"]);
    S.showHidden = true;
  });

  it("does not hit the endpoint below the 2-char minimum and keeps the tree visible", () => {
    tree.scheduleTreeSearch("a");
    expect(apiGet).not.toHaveBeenCalled();
    expect(results().classList.contains("hidden")).toBe(true);
    expect(document.getElementById("files-tree")!.classList.contains("hidden")).toBe(false);
  });

  it("clearTreeSearch restores the tree and empties the results", async () => {
    apiGet.mockResolvedValue({
      ok: true,
      data: { base: "/", truncated: false, items: [{ path: "/srv/app.js", name: "app.js", type: "file" }] },
    });
    await tree.searchTreeRemote("app");
    tree.clearTreeSearch();
    expect(results().innerHTML).toBe("");
    expect(results().classList.contains("hidden")).toBe(true);
    expect(document.getElementById("files-tree")!.classList.contains("hidden")).toBe(false);
  });

  it("drops a stale response when a newer search superseded it", async () => {
    let release: (v: any) => void = () => {};
    apiGet.mockImplementationOnce(() => new Promise((r) => { release = r; }));
    const stale = tree.searchTreeRemote("old");
    apiGet.mockResolvedValue({
      ok: true,
      data: { base: "/", truncated: false, items: [{ path: "/srv/new.js", name: "new.js", type: "file" }] },
    });
    await tree.searchTreeRemote("new");
    release({ ok: true, data: { base: "/", truncated: false, items: [{ path: "/srv/old.js", name: "old.js", type: "file" }] } });
    await stale;
    const paths = Array.from(results().querySelectorAll("[data-tree-path]")).map((r) => r.getAttribute("data-tree-path"));
    expect(paths).toEqual(["/srv/new.js"]);
  });

  it("opens a file hit in the editor and navigates on a folder hit", async () => {
    const handleDblClick = vi.fn();
    const navigate = vi.fn();
    (window as any).handleDblClick = handleDblClick;
    (window as any).navigate = navigate;
    apiGet.mockResolvedValue({
      ok: true,
      data: {
        base: "/",
        truncated: false,
        items: [
          { path: "/srv/apps", name: "apps", type: "dir" },
          { path: "/srv/app.js", name: "app.js", type: "file" },
        ],
      },
    });
    await tree.searchTreeRemote("app");
    const rows = results().querySelectorAll("[data-tree-row]");
    rows[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    rows[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    // The results pane isn't bound in this unit context — call the handler the
    // binding uses, mirroring initFilesTree().
    expect(navigate).not.toHaveBeenCalled();
    results().addEventListener("click", tree.onTreeResultClick);
    rows[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    rows[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    expect(navigate).toHaveBeenCalledWith("/srv/apps");
    expect(handleDblClick).toHaveBeenCalledWith("/srv/app.js", false, { preview: true });
    delete (window as any).navigate;
  });
});
