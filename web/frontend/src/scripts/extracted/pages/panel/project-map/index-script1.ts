import { resolvePanelApiPath, scopeHeaders } from "/scripts/extracted/lib/api-client.js?v=20260506a";

type Entry = { name: string; path: string; kind: "directory" | "file" };
type Listing = { path: string; entries: Entry[]; truncated: boolean };
type ProjectFile = { path: string; name: string; size: number; content: string | null; truncated: boolean; language: string; binary: boolean };
type SearchResult = { query: string; results: Entry[]; truncated: boolean };
type Envelope<T> = { ok: boolean; data?: T; error?: string | { message?: string } };

let controller: AbortController | null = null;
let activeRoot: HTMLElement | null = null;
let selectedPath = "";
let selectionToken = 0;
let searchToken = 0;
let searchTimer: ReturnType<typeof setTimeout> | null = null;
const listingCache = new Map<string, Listing>();

const byId = (id: string) => document.getElementById(id);
const searchInput = () => byId("pe-search") as HTMLInputElement | null;
type ProjectMapMessage = "emptyFolder" | "folder" | "truncatedListing" | "binaryNoPreview" | "truncatedFile" | "loadingFolder" | "loadingCode" | "itemsCount" | "openFailed" | "pathUnavailable" | "noSearchMatches" | "resultsCount" | "minTwoChars" | "searchHint" | "searching" | "searchFailed" | "loadFailed" | "refreshFailed";
function tr(key: ProjectMapMessage, params: Record<string, string | number> = {}): string {
  const messages = activeRoot?.dataset.messages ? JSON.parse(activeRoot.dataset.messages) as Record<ProjectMapMessage, string> : null;
  return (messages?.[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

async function request<T>(path: string, signal: AbortSignal, method = "GET"): Promise<T> {
  const response = await fetch(resolvePanelApiPath(path), {
    method, credentials: "include", headers: scopeHeaders(method !== "GET"), signal,
  });
  const result = await response.json() as Envelope<T>;
  if (!response.ok || !result.ok || result.data === undefined) {
    const reason = typeof result.error === "string" ? result.error : result.error?.message;
    throw new Error(reason || `Error HTTP ${response.status}`);
  }
  return result.data;
}

function endpoint(action: string, params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params).toString();
  return `/api/module-dev/project/${action}${query ? `?${query}` : ""}`;
}

async function getListing(path: string, signal: AbortSignal): Promise<Listing> {
  const cached = listingCache.get(path);
  if (cached) return cached;
  const listing = await request<Listing>(endpoint("tree", { path }), signal);
  listingCache.set(path, listing);
  return listing;
}

function setMessage(message: string): void {
  const element = byId("pe-message");
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("hidden", !message);
}

function showPane(kind: "directory" | "file" | "empty"): void {
  byId("pe-folder")?.classList.toggle("hidden", kind !== "directory");
  byId("pe-code-wrap")?.classList.toggle("hidden", kind !== "file");
}

function makeIcon(kind: Entry["kind"], name: string): HTMLElement {
  const icon = document.createElement("i");
  const code = /\.(?:ts|tsx|js|jsx|astro|py|css|html|sh|mjs|vue|svelte)$/i.test(name);
  icon.className = `ti ${kind === "directory" ? "ti-folder text-primary" : code ? "ti-file-code text-sky-500" : "ti-file-text text-muted-foreground"} shrink-0 text-base`;
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function rowButton(entry: Entry, className: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.pePath = entry.path;
  button.dataset.peKind = entry.kind;
  button.className = className;
  const name = document.createElement("span");
  name.className = "min-w-0 truncate";
  name.textContent = entry.name;
  button.append(makeIcon(entry.kind, entry.name), name);
  return button;
}

function renderBreadcrumb(path: string): void {
  const nav = byId("pe-breadcrumb");
  if (!nav) return;
  nav.replaceChildren();
  const paths = ["", ...path.split("/").filter(Boolean).map((_, i, parts) => parts.slice(0, i + 1).join("/"))];
  for (const item of paths) {
    if (nav.childNodes.length) {
      const divider = document.createElement("span");
      divider.textContent = "/";
      divider.setAttribute("aria-hidden", "true");
      nav.append(divider);
    }
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.peBreadcrumb = item;
    button.className = "max-w-[12rem] truncate rounded px-1 py-0.5 hover:bg-accent hover:text-foreground";
    button.textContent = item ? item.split("/").at(-1)! : "LUXIPANEL";
    nav.append(button);
  }
}

function markSelected(): void {
  document.querySelectorAll<HTMLButtonElement>("#pe-tree [data-pe-tree-path]").forEach((button) => {
    const active = button.dataset.peTreePath === selectedPath;
    button.classList.toggle("bg-primary/10", active);
    button.classList.toggle("text-primary", active);
    button.setAttribute("aria-selected", String(active));
  });
}

function createTreeNode(entry: Entry): HTMLElement {
  const node = document.createElement("div");
  node.dataset.peNode = entry.path;
  const button = rowButton(entry, "flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary");
  button.dataset.peTreePath = entry.path;
  button.setAttribute("role", "treeitem");
  button.title = entry.path || "LUXIPANEL";
  if (entry.kind === "directory") {
    button.setAttribute("aria-expanded", "false");
    const chevron = document.createElement("i");
    chevron.className = "ti ti-chevron-right ml-auto text-[11px] text-muted-foreground";
    chevron.setAttribute("aria-hidden", "true");
    button.append(chevron);
  }
  node.append(button);
  if (entry.kind === "directory") {
    const children = document.createElement("div");
    children.dataset.peChildren = "";
    children.className = "ml-3 hidden border-l border-border pl-1.5";
    children.setAttribute("role", "group");
    node.append(children);
  }
  return node;
}

async function expandNode(node: HTMLElement, signal: AbortSignal, forceOpen = false): Promise<void> {
  const button = node.querySelector<HTMLButtonElement>(":scope > button[data-pe-tree-path]");
  const children = node.querySelector<HTMLElement>(":scope > [data-pe-children]");
  if (!button || !children) return;
  const expanded = button.getAttribute("aria-expanded") === "true";
  if (expanded && !forceOpen) {
    children.classList.add("hidden");
    button.setAttribute("aria-expanded", "false");
    button.querySelector(".ti-chevron-down")?.classList.replace("ti-chevron-down", "ti-chevron-right");
    return;
  }
  if (!children.dataset.loaded) {
    const listing = await getListing(button.dataset.peTreePath || "", signal);
    children.replaceChildren(...listing.entries.map(createTreeNode));
    children.dataset.loaded = "true";
  }
  children.classList.remove("hidden");
  button.setAttribute("aria-expanded", "true");
  button.querySelector(".ti-chevron-right")?.classList.replace("ti-chevron-right", "ti-chevron-down");
  markSelected();
}

function renderDirectory(listing: Listing): void {
  const folder = byId("pe-folder");
  if (!folder) return;
  folder.replaceChildren();
  if (!listing.entries.length) {
    const empty = document.createElement("p");
    empty.className = "px-2 py-10 text-center text-sm text-muted-foreground";
    empty.textContent = tr("emptyFolder");
    folder.append(empty);
  }
  for (const entry of listing.entries) {
    const row = rowButton(entry, "flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary");
    const path = document.createElement("span");
    path.className = "ml-auto max-w-[45%] truncate font-mono text-[10px] text-muted-foreground";
    path.textContent = entry.kind === "directory" ? tr("folder") : entry.path;
    row.append(path);
    folder.append(row);
  }
  if (listing.truncated) setMessage(tr("truncatedListing"));
}

function renderFile(file: ProjectFile): void {
  const code = byId("pe-code");
  const lines = byId("pe-line-numbers");
  if (!code || !lines) return;
  if (file.binary || file.content === null) {
    showPane("empty");
    setMessage(tr("binaryNoPreview"));
    return;
  }
  code.textContent = file.content;
  const count = file.content.split("\n").length;
  lines.textContent = Array.from({ length: count }, (_, i) => String(i + 1)).join("\n");
  showPane("file");
  if (file.truncated) setMessage(tr("truncatedFile"));
}

async function selectEntry(entry: Entry, signal: AbortSignal): Promise<void> {
  selectedPath = entry.path;
  const token = ++selectionToken;
  markSelected();
  renderBreadcrumb(entry.path);
  const title = byId("pe-title");
  const meta = byId("pe-meta");
  if (title) title.textContent = entry.name || "LUXIPANEL";
  if (meta) meta.textContent = entry.kind === "directory" ? tr("loadingFolder") : tr("loadingCode");
  setMessage("");
  showPane("empty");
  try {
    if (entry.kind === "directory") {
      const listing = await getListing(entry.path, signal);
      if (token !== selectionToken || signal.aborted) return;
      renderDirectory(listing);
      showPane("directory");
      if (meta) meta.textContent = tr("itemsCount", { count: `${listing.entries.length}${listing.truncated ? "+" : ""}` });
    } else {
      const file = await request<ProjectFile>(endpoint("file", { path: entry.path }), signal);
      if (token !== selectionToken || signal.aborted) return;
      renderFile(file);
      if (meta) meta.textContent = `${file.language} · ${new Intl.NumberFormat(activeRoot?.dataset.locale || "en").format(file.size)} bytes`;
    }
  } catch (error) {
    if (token !== selectionToken || signal.aborted) return;
    setMessage(error instanceof Error ? error.message : tr("openFailed"));
    if (meta) meta.textContent = "";
  }
}

async function revealPath(path: string, signal: AbortSignal): Promise<void> {
  if (searchInput()?.value) {
    searchInput()!.value = "";
    ++searchToken;
    byId("pe-tree")?.classList.remove("hidden");
    byId("pe-results")?.classList.add("hidden");
    const status = byId("pe-search-status");
    if (status) status.textContent = tr("searchHint");
  }
  const root = byId("pe-tree")?.querySelector<HTMLElement>("[data-pe-node]");
  if (!root) return;
  let node = root;
  await expandNode(node, signal, true);
  let cumulative = "";
  for (const part of path.split("/").filter(Boolean)) {
    cumulative = cumulative ? `${cumulative}/${part}` : part;
    const children = node.querySelector<HTMLElement>(":scope > [data-pe-children]");
    const next = Array.from(children?.children ?? []).find((child) => (child as HTMLElement).dataset.peNode === cumulative) as HTMLElement | undefined;
    if (!next) { setMessage(tr("pathUnavailable")); return; }
    node = next;
    if (node.querySelector(":scope > [data-pe-children]")) await expandNode(node, signal, true);
  }
  const button = node.querySelector<HTMLButtonElement>(":scope > button[data-pe-tree-path]");
  if (button) await selectEntry({ name: path.split("/").at(-1) || "LUXIPANEL", path, kind: button.dataset.peKind as Entry["kind"] }, signal);
  button?.scrollIntoView({ block: "nearest" });
}

function showSearchResults(result: SearchResult): void {
  const results = byId("pe-results");
  const tree = byId("pe-tree");
  if (!results || !tree) return;
  tree.classList.add("hidden");
  results.classList.remove("hidden");
  results.replaceChildren();
  for (const entry of result.results) {
    const row = document.createElement("button");
    row.type = "button";
    row.dataset.pePath = entry.path;
    row.dataset.peKind = entry.kind;
    row.className = "flex w-full min-w-0 flex-col gap-0.5 rounded-lg px-2 py-2 text-left text-xs hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary";
    row.setAttribute("role", "option");
    const heading = document.createElement("span");
    heading.className = "flex min-w-0 max-w-full items-center gap-2";
    const name = document.createElement("span");
    name.className = "truncate font-medium";
    name.textContent = entry.name;
    heading.append(makeIcon(entry.kind, entry.name), name);
    const detail = document.createElement("span");
    detail.className = "max-w-full truncate pl-6 font-mono text-[10px] text-muted-foreground";
    detail.textContent = entry.path;
    row.append(heading, detail);
    results.append(row);
  }
  if (!result.results.length) {
    const empty = document.createElement("p");
    empty.className = "px-2 py-8 text-sm text-muted-foreground";
    empty.textContent = tr("noSearchMatches");
    results.append(empty);
  }
  const status = byId("pe-search-status");
  if (status) status.textContent = tr("resultsCount", { count: `${result.results.length}${result.truncated ? "+" : ""}` });
}

async function runSearch(signal: AbortSignal): Promise<void> {
  const query = searchInput()?.value.trim() || "";
  const token = ++searchToken;
  if (query.length < 2) {
    byId("pe-tree")?.classList.remove("hidden");
    byId("pe-results")?.classList.add("hidden");
    const status = byId("pe-search-status");
    if (status) status.textContent = query ? tr("minTwoChars") : tr("searchHint");
    return;
  }
  const status = byId("pe-search-status");
  if (status) status.textContent = tr("searching");
  try {
    const result = await request<SearchResult>(endpoint("search", { q: query }), signal);
    if (token === searchToken && !signal.aborted) showSearchResults(result);
  } catch (error) {
    if (token === searchToken && !signal.aborted && status) status.textContent = error instanceof Error ? error.message : tr("searchFailed");
  }
}

async function loadRoot(signal: AbortSignal): Promise<void> {
  const tree = byId("pe-tree");
  if (!tree) return;
  tree.replaceChildren(createTreeNode({ name: "LUXIPANEL", path: "", kind: "directory" }));
  await revealPath("", signal);
}

function init(): void {
  const root = byId("project-explorer-root");
  if (root && root === activeRoot && controller && !controller.signal.aborted) return;
  controller?.abort();
  if (searchTimer) clearTimeout(searchTimer);
  activeRoot = root;
  if (!root) { controller = null; return; }
  controller = new AbortController();
  const signal = controller.signal;
  void loadRoot(signal).catch((error) => { if (!signal.aborted) setMessage(error instanceof Error ? error.message : tr("loadFailed")); });

  byId("pe-tree")?.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-pe-tree-path]");
    if (!button) return;
    const node = button.parentElement;
    const path = button.dataset.peTreePath || "";
    const kind = button.dataset.peKind as Entry["kind"];
    if (kind === "directory" && node) void expandNode(node, signal).catch((error) => { if (!signal.aborted) setMessage(String(error)); });
    void selectEntry({ name: path.split("/").at(-1) || "LUXIPANEL", path, kind }, signal);
  }, { signal });
  byId("pe-folder")?.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-pe-path]");
    if (button?.dataset.pePath) void revealPath(button.dataset.pePath, signal);
  }, { signal });
  byId("pe-results")?.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-pe-path]");
    if (button?.dataset.pePath) void revealPath(button.dataset.pePath, signal);
  }, { signal });
  byId("pe-breadcrumb")?.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-pe-breadcrumb]");
    if (button) void revealPath(button.dataset.peBreadcrumb || "", signal);
  }, { signal });
  byId("project-explorer-root")?.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-project-jump]");
    if (button?.dataset.projectJump) void revealPath(button.dataset.projectJump, signal);
  }, { signal });
  searchInput()?.addEventListener("input", () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { void runSearch(signal); }, 260);
  }, { signal });
  byId("pe-refresh")?.addEventListener("click", () => {
    void (async () => {
      const button = byId("pe-refresh") as HTMLButtonElement | null;
      if (button) button.disabled = true;
      try {
        await request<{ refreshed: boolean }>(endpoint("refresh"), signal, "POST");
        listingCache.clear();
        await loadRoot(signal);
        if (searchInput()?.value.trim()) await runSearch(signal);
      } catch (error) { if (!signal.aborted) setMessage(error instanceof Error ? error.message : tr("refreshFailed")); }
      finally { if (button) button.disabled = false; }
    })();
  }, { signal });
}

document.addEventListener("astro:page-load", init);
document.addEventListener("astro:after-swap", init);
init();
