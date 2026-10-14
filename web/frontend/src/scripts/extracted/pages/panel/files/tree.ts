// Files page — tree submodule (code-move from index-script1.ts; no behavior change).
import { pickFolder } from "./history-file-versions";
import { fileIcon, gitStatusColor } from "./icons";
import { fmt, t } from "./i18n";
import { setShowHidden } from "./listing";
import { getActiveFilesManager, persistFilesManagers, renderFilesManagerTabs } from "./manager-tabs";
import { escapeAttr, escapeHtml, getBaseName } from "./paths";
import { canReadPathClient, ensureFileAccessPolicy, filesCan } from "./perm-gating";
import { FILES_FAV_ROOTS_KEY, S, selected } from "./state";
import { fetchFilesList } from "./list-request";
import { resolveCurrentTargetScope } from "./target-scope";
import { showToast } from "./toast";
import { patchFilesPreferences } from "./preferences";
import { LOCAL_TARGET_SCOPE, api } from "/scripts/extracted/lib/api-client.js?v=20260506a";


  // ── Tree (folder navigator, left pane) ────────────────────
  // Left-side folder tree: lists the server's folders from the root (or the
  // caller's allowed base) and lets you drill down lazily. Clicking a folder
  // loads its contents in the right-side listing via the same `navigate()` used
  // everywhere else — the tree only *links* to that view (single source of truth
  // for the listing). Stays in sync with the listing via the
  // `luxipanel:files-path-changed` event (auto-expands + highlights).
  export const treeExpanded = new Set<string>();
  export const treeChildrenCache = new Map<string, { dirs: any[]; files: any[] }>();
  export let treeRootPath = "/";
  export let filesTreePathListenerBound = false;
  const branchFoldAnimations = new WeakMap<HTMLElement, Animation>();
  const BRANCH_STEP = 18;
  let highlightedTreePath = "";
  let singleOpenSequence = 0;

  function branchX(depth: number): string { return `${depth * BRANCH_STEP - 6}px`; }

  function reducedTreeMotion(): boolean {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }

  /** Measure direct siblings, not grandchildren, for each continuous rail. */
  export function syncTreeBranchGeometry(): void {
    const treeEl = document.getElementById("files-tree");
    if (!treeEl) return;
    treeEl.querySelectorAll<HTMLElement>("[data-tree-children]").forEach((childrenEl) => {
      if (childrenEl.classList.contains("hidden")) return;
      const visible = Array.from(childrenEl.children).filter((child): child is HTMLElement =>
        child instanceof HTMLElement && child.hasAttribute("data-tree-path") && !child.classList.contains("hidden"));
      const rowCenter = (node: HTMLElement) => {
        const row = node.querySelector<HTMLElement>(":scope > [data-tree-row]");
        return node.offsetTop + (row?.offsetHeight ?? 32) / 2;
      };
      const last = visible.at(-1);
      const active = visible.find((child) => child.hasAttribute("data-branch-active"));
      childrenEl.style.setProperty("--files-branch-end", `${last ? rowCenter(last) : 0}px`);
      childrenEl.style.setProperty("--files-branch-reach", `${active ? rowCenter(active) : 0}px`);
    });
  }

  /** Reuse Branched Menu's brief fold motion while keeping lazy DOM nodes. */
  function setTreeChildrenVisible(childrenEl: HTMLElement, open: boolean, instant = false): void {
    branchFoldAnimations.get(childrenEl)?.cancel();
    branchFoldAnimations.delete(childrenEl);
    childrenEl.toggleAttribute("inert", !open);
    if (open) {
      const wasHidden = childrenEl.classList.contains("hidden");
      childrenEl.classList.remove("hidden");
      if (wasHidden && !instant && !reducedTreeMotion() && typeof childrenEl.animate === "function") {
        const animation = childrenEl.animate(
          [{ height: "0px", opacity: 0 }, { height: `${childrenEl.scrollHeight}px`, opacity: 1 }],
          { duration: 300, easing: "cubic-bezier(.23, 1, .32, 1)" },
        );
        branchFoldAnimations.set(childrenEl, animation);
      }
    } else if (!childrenEl.classList.contains("hidden")) {
      if (!instant && !reducedTreeMotion() && typeof childrenEl.animate === "function") {
        const animation = childrenEl.animate(
          [{ height: `${childrenEl.scrollHeight}px`, opacity: 1 }, { height: "0px", opacity: 0 }],
          { duration: 240, easing: "cubic-bezier(.23, 1, .32, 1)" },
        );
        branchFoldAnimations.set(childrenEl, animation);
        animation.onfinish = () => {
          if (!childrenEl.parentElement?.hasAttribute("data-expanded")) childrenEl.classList.add("hidden");
          branchFoldAnimations.delete(childrenEl);
          syncTreeBranchGeometry();
        };
      } else childrenEl.classList.add("hidden");
    }
  }

  // The tree root is PER TAB and fully independent: each tab owns the folder it
  // starts from. There is NO shared/per-server default — a new tab always opens
  // at root ("/", or the allowed base for path-restricted users), and changing
  // one tab's root never affects another tab or future new tabs.
  /** Effective tree root for a tab: its own root if still readable under the
   *  current policy, else the allowed base ("/" when unrestricted). */
  export function effectiveTreeRoot(manager: { treeRoot?: string } | null): string {
    const base = S.filesAllowAll ? "/" : treeNormalize(S.filesDefaultBase || "/");
    const own = (manager?.treeRoot || "").trim();
    if (own && own !== "/" && canReadPathClient(own)) return treeNormalize(own);
    return base;
  }
  /** Effective tree root of the currently active tab. */
  export function resolveTreeRoot(): string {
    return effectiveTreeRoot(getActiveFilesManager());
  }

  export function treeNormalize(p: string): string {
    const s = (p || "/").replace(/\/+$/g, "");
    return s || "/";
  }
  export function treeJoin(parent: string, name: string): string {
    return parent === "/" ? `/${name}` : `${parent}/${name}`;
  }
  export function treeFindNode(path: string): HTMLElement | null {
    return document.querySelector(`#files-tree [data-tree-path="${CSS.escape(treeNormalize(path))}"]`);
  }

  /** True when dotfiles should be visible in the tree — mirrors the listing's
   *  gate (`files.hidden` permission AND the "show hidden" toggle on). */
  export function treeHiddenVisible(): boolean {
    return filesCan("files.hidden") && S.showHidden;
  }
  /** Whether an entry is a dotfile / marked hidden by the backend. */
  export function isHiddenEntry(e: any): boolean {
    return Boolean(e?.isHidden ?? String(e?.name ?? "").startsWith("."));
  }

  /** Fetch + cache the children under a path, split into folders and files
   *  (each sorted alphabetically), tolerating the list endpoint's
   *  array-or-{data} envelope. The RAW (unfiltered) split is cached; the
   *  hidden-files filter is applied at render time so toggling it re-reflects. */
  export async function fetchTreeChildren(path: string): Promise<{ dirs: any[]; files: any[] }> {
    const key = treeNormalize(path);
    const cached = treeChildrenCache.get(key);
    if (cached) return cached;
    let res: any;
    try { res = await fetchFilesList(key); }
    catch { return { dirs: [], files: [] }; }
    if (!res || !res.ok) return { dirs: [], files: [] };
    const payload = res.data as any;
    const entries = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
    const byName = (a: any, b: any) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: "base" });
    const valid = entries.filter((e: any) => e && typeof e.name === "string");
    const dirs = valid.filter((e: any) => e.isDir).sort(byName);
    const files = valid.filter((e: any) => !e.isDir).sort(byName);
    const result = { dirs, files };
    treeChildrenCache.set(key, result);
    return result;
  }

  /** Folder / server-root node (has a twisty + lazy children). */
  export function makeTreeNode(path: string, name: string, depth: number, isRoot = false): HTMLElement {
    const node = document.createElement("div");
    node.className = "tree-node";
    node.setAttribute("data-tree-path", treeNormalize(path));
    node.setAttribute("data-tree-name", name);
    node.dataset.depth = String(depth);
    const row = document.createElement("div");
    row.setAttribute("data-tree-row", "");
    row.setAttribute("role", "treeitem");
    row.setAttribute("tabindex", depth === 0 ? "0" : "-1");
    row.setAttribute("aria-level", String(depth + 1));
    row.setAttribute("aria-expanded", "false");
    row.className = "tree-row flex items-center gap-1 rounded-md py-1 pr-2 cursor-pointer text-sm text-foreground hover:bg-accent";
    row.style.paddingLeft = `${depth * BRANCH_STEP + 4}px`;
    row.style.setProperty("--files-branch-x", branchX(depth));
    const icon = isRoot ? "ti-server" : "ti-folder";
    const iconColor = isRoot ? "text-primary" : "text-amber-500";
    row.innerHTML =
      `<span class="tree-twisty flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground" data-tree-toggle>` +
        `<i class="ti ti-chevron-right text-xs" style="transition:transform .12s"></i>` +
      `</span>` +
      `<i class="ti ${icon} text-sm shrink-0 ${iconColor}"></i>` +
      `<span data-tree-label class="truncate">${escapeHtml(name)}</span>`;
    node.appendChild(row);
    const children = document.createElement("div");
    children.setAttribute("data-tree-children", "");
    children.setAttribute("role", "group");
    children.className = "tree-children hidden";
    children.style.setProperty("--files-branch-x", branchX(depth + 1));
    node.appendChild(children);
    return node;
  }

  /** File node: no twisty, per-extension icon (same `fileIcon()` as the right
   *  table). Clicking it opens the file in the workspace editor (see onTreeClick). */
  export function makeTreeFileNode(path: string, entry: any, depth: number): HTMLElement {
    const name = String(entry?.name ?? "");
    const node = document.createElement("div");
    node.className = "tree-node";
    node.setAttribute("data-tree-path", treeNormalize(path));
    node.setAttribute("data-tree-name", name);
    node.setAttribute("data-tree-file", "1");
    node.dataset.depth = String(depth);
    const row = document.createElement("div");
    row.setAttribute("data-tree-row", "");
    row.setAttribute("role", "treeitem");
    row.setAttribute("tabindex", "-1");
    row.setAttribute("aria-level", String(depth + 1));
    row.className = "tree-row flex items-center gap-1 rounded-md py-1 pr-2 cursor-pointer text-sm text-foreground hover:bg-accent";
    row.style.paddingLeft = `${depth * BRANCH_STEP + 4}px`;
    row.style.setProperty("--files-branch-x", branchX(depth));
    const hidden = isHiddenEntry(entry);
    const nameColor = gitStatusColor(entry?.gitStatus ?? null);
    row.innerHTML =
      `<span class="flex h-4 w-4 shrink-0" aria-hidden="true"></span>` +
      `<span class="flex h-4 w-4 shrink-0 items-center justify-center text-sm">${fileIcon(name, false, hidden, Boolean(entry?.hasGit), entry?.gitStatus ?? null)}</span>` +
      `<span data-tree-label class="truncate ${nameColor} ${hidden ? "opacity-40" : ""}">${escapeHtml(name)}</span>`;
    node.appendChild(row);
    return node;
  }

  export function treeTwistyEl(node: HTMLElement): HTMLElement | null {
    return node.querySelector(":scope > [data-tree-row] [data-tree-toggle] i");
  }
  export function treeChildrenEl(node: HTMLElement): HTMLElement | null {
    return node.querySelector(":scope > [data-tree-children]");
  }

  /** Single-branch mode keeps the opened folder and its ancestors only. */
  function closeOtherTreeBranches(node: HTMLElement): void {
    const treeEl = document.getElementById("files-tree");
    if (!treeEl) return;
    const path = treeNormalize(node.getAttribute("data-tree-path") || "/");
    const row = node.querySelector<HTMLElement>(":scope > [data-tree-row]");
    const topBefore = row?.getBoundingClientRect().top;
    let closed = false;
    Array.from(treeEl.querySelectorAll<HTMLElement>("[data-tree-path][data-expanded='1']"))
      .reverse().forEach((other) => {
        const otherPath = treeNormalize(other.getAttribute("data-tree-path") || "/");
        if (path === otherPath || path.startsWith(otherPath === "/" ? "/" : `${otherPath}/`)) return;
        collapseTreeNode(other, true, false);
        closed = true;
      });
    if (!closed) return;
    // Closing an earlier branch changes document height. Keep the clicked row
    // in the same spot rather than letting the browser jump in the tree.
    if (row && topBefore !== undefined) treeEl.scrollTop += row.getBoundingClientRect().top - topBefore;
    if (highlightedTreePath) highlightTreeCurrent(highlightedTreePath);
    else syncTreeBranchGeometry();
  }

  export async function expandTreeNode(node: HTMLElement): Promise<void> {
    const path = node.getAttribute("data-tree-path") || "/";
    const childrenEl = treeChildrenEl(node);
    if (!childrenEl) return;
    const singleIntent = S.treeExpansionMode === "single" && node.getAttribute("data-expanded") !== "1"
      ? ++singleOpenSequence : 0;
    if (singleIntent) closeOtherTreeBranches(node);
    const depth = Number(node.dataset.depth || "0") + 1;
    const pad = depth * BRANCH_STEP + 22;
    if (childrenEl.dataset.loaded !== "1") {
      childrenEl.innerHTML = `<div class="py-1 text-xs text-muted-foreground" style="padding-left:${pad}px">${escapeHtml(t("tree.loading", "Cargando…"))}</div>`;
      childrenEl.classList.remove("hidden");
      const { dirs, files } = await fetchTreeChildren(path);
      const showHidden = treeHiddenVisible();
      const visDirs = showHidden ? dirs : dirs.filter((d: any) => !isHiddenEntry(d));
      const visFiles = showHidden ? files : files.filter((f: any) => !isHiddenEntry(f));
      childrenEl.innerHTML = "";
      if (!visDirs.length && !visFiles.length) {
        childrenEl.innerHTML = `<div class="py-1 text-xs text-muted-foreground" style="padding-left:${pad}px">${escapeHtml(t("tree.empty", "Vacío"))}</div>`;
      } else {
        // Folders first, then files (both already alphabetical from the fetch).
        for (const d of visDirs) {
          childrenEl.appendChild(makeTreeNode(treeJoin(path, d.name), String(d.name), depth));
        }
        for (const f of visFiles) {
          childrenEl.appendChild(makeTreeFileNode(treeJoin(path, f.name), f, depth));
        }
      }
      childrenEl.dataset.loaded = "1";
    }
    if (singleIntent && S.treeExpansionMode === "single" && singleIntent !== singleOpenSequence) {
      childrenEl.classList.add("hidden");
      childrenEl.setAttribute("inert", "");
      return;
    }
    setTreeChildrenVisible(childrenEl, true);
    const tw = treeTwistyEl(node);
    if (tw) tw.style.transform = "rotate(90deg)";
    node.setAttribute("data-expanded", "1");
    node.querySelector(":scope > [data-tree-row]")?.setAttribute("aria-expanded", "true");
    treeExpanded.add(treeNormalize(path));
    if (highlightedTreePath) highlightTreeCurrent(highlightedTreePath);
    else syncTreeBranchGeometry();
  }

  export function collapseTreeNode(node: HTMLElement, instant = false, updateBranch = true): void {
    const childrenEl = treeChildrenEl(node);
    if (childrenEl) setTreeChildrenVisible(childrenEl, false, instant);
    const tw = treeTwistyEl(node);
    if (tw) tw.style.transform = "";
    node.removeAttribute("data-expanded");
    node.querySelector(":scope > [data-tree-row]")?.setAttribute("aria-expanded", "false");
    treeExpanded.delete(treeNormalize(node.getAttribute("data-tree-path") || "/"));
    if (updateBranch) {
      if (highlightedTreePath) highlightTreeCurrent(highlightedTreePath);
      else syncTreeBranchGeometry();
    }
  }

  export function highlightTreeCurrent(path: string): void {
    const treeEl = document.getElementById("files-tree");
    if (!treeEl) return;
    const current = treeNormalize(path);
    highlightedTreePath = current;
    treeEl.querySelectorAll<HTMLElement>("[data-tree-path]").forEach((node) => {
      const nodePath = node.getAttribute("data-tree-path") || "/";
      const onBranch = current === nodePath || current.startsWith(nodePath === "/" ? "/" : `${nodePath}/`);
      node.toggleAttribute("data-branch-active", onBranch);
      const item = node.querySelector<HTMLElement>(":scope > [data-tree-row]");
      if (item) {
        item.setAttribute("aria-selected", String(current === nodePath));
        item.setAttribute("tabindex", "-1");
      }
    });
    const visibleNode = Array.from(treeEl.querySelectorAll<HTMLElement>("[data-tree-path][data-branch-active]"))
      .reverse().find((node) => !node.closest(".hidden, [inert]"))
      || treeEl.querySelector<HTMLElement>(":scope > [data-tree-path]:not(.hidden)");
    const row = visibleNode?.querySelector<HTMLElement>(":scope > [data-tree-row]") || null;
    if (row) {
      row.tabIndex = 0;
      const rowRect = row.getBoundingClientRect();
      const treeRect = treeEl.getBoundingClientRect();
      treeEl.style.setProperty("--files-branch-marker-top", `${rowRect.top - treeRect.top + treeEl.scrollTop + (rowRect.height - 18) / 2}px`);
      treeEl.setAttribute("data-marker-on", "");
    } else treeEl.removeAttribute("data-marker-on");
    syncTreeBranchGeometry();
  }

  /** Ancestor chain [root … target] within the tree root, or [root] if the
   *  target is outside it (e.g. a path-bar jump to a sibling of the base). */
  export function treeAncestors(targetPath: string): string[] {
    const root = treeNormalize(treeRootPath);
    const target = treeNormalize(targetPath);
    if (target === root) return [root];
    const prefix = root === "/" ? "/" : `${root}/`;
    if (!target.startsWith(prefix)) return [root];
    const rest = root === "/" ? target.slice(1) : target.slice(root.length + 1);
    const parts = rest.split("/").filter(Boolean);
    const chain = [root];
    let acc = root === "/" ? "" : root;
    for (const p of parts) {
      acc = `${acc}/${p}`;
      chain.push(treeNormalize(acc));
    }
    return chain;
  }

  /** Expand ancestors so the current folder's node exists, then highlight it. */
  export async function revealTreePath(path: string): Promise<void> {
    if (!document.getElementById("files-tree")) return;
    const chain = treeAncestors(path);
    for (let i = 0; i < chain.length - 1; i++) {
      const node = treeFindNode(chain[i]!);
      if (!node) break; // chain not materialised yet — stop, highlight what we have
      await expandTreeNode(node);
    }
    highlightTreeCurrent(path);
  }

  // Single- vs double-click discrimination for FILE nodes (VS Code semantics):
  // a lone click opens a PREVIEW tab (italic, replaced by the next preview);
  // a double click (two clicks within the window on the same node) opens/pins a
  // PERMANENT tab. Folders are unaffected — they navigate/expand immediately.
  const TREE_FILE_DBLCLICK_MS = 250;
  let treeFileClickTimer: ReturnType<typeof setTimeout> | null = null;
  let treeFileClickPath = "";
  function cancelTreeFileClickTimer(): void {
    if (treeFileClickTimer) { clearTimeout(treeFileClickTimer); treeFileClickTimer = null; }
    treeFileClickPath = "";
  }

  export function onTreeClick(ev: Event): void {
    const target = ev.target as HTMLElement;
    const node = target.closest("[data-tree-path]") as HTMLElement | null;
    if (!node) return;
    const path = node.getAttribute("data-tree-path") || "/";
    // File node → open in the workspace editor via the same entry the table uses
    // (handleDblClick: read-gate + media modal or Monaco tab). Single click =
    // preview; a second click within the window = permanent (pins the tab).
    if (node.getAttribute("data-tree-file") === "1") {
      highlightTreeCurrent(path);
      if (treeFileClickTimer && treeFileClickPath === path) {
        // Second click on the same file → treat the pair as a double click.
        cancelTreeFileClickTimer();
        (window as any).handleDblClick?.(path, false, { preview: false });
        return;
      }
      cancelTreeFileClickTimer();
      treeFileClickPath = path;
      treeFileClickTimer = setTimeout(() => {
        treeFileClickTimer = null;
        treeFileClickPath = "";
        (window as any).handleDblClick?.(path, false, { preview: true });
      }, TREE_FILE_DBLCLICK_MS);
      return;
    }
    // Chevron toggles expansion only; clicking the row navigates (and opens it).
    if (target.closest("[data-tree-toggle]")) {
      ev.stopPropagation();
      if (node.getAttribute("data-expanded") === "1") collapseTreeNode(node);
      else void expandTreeNode(node);
      return;
    }
    // Row click changes the right-hand listing. The chevron alone changes the
    // left tree, so its scroll position and surrounding folders stay put.
    (window as any).navigate(path);
  }

  function focusTreeRow(treeEl: HTMLElement, row: HTMLElement): void {
    treeEl.querySelectorAll<HTMLElement>("[data-tree-row]").forEach((item) => item.tabIndex = -1);
    row.tabIndex = 0;
    row.focus();
  }

  /** Arrow-key traversal follows only rendered, expanded nodes. */
  export function onTreeKeydown(ev: KeyboardEvent): void {
    const treeEl = document.getElementById("files-tree");
    const row = (ev.target as HTMLElement)?.closest<HTMLElement>("[data-tree-row]");
    if (!treeEl || !row || !treeEl.contains(row)) return;
    const node = row.closest<HTMLElement>("[data-tree-path]");
    if (!node) return;
    const visibleRows = () => Array.from(treeEl.querySelectorAll<HTMLElement>("[data-tree-row]"))
      .filter((item) => !item.closest(".hidden, [inert]"));
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp" || ev.key === "Home" || ev.key === "End") {
      ev.preventDefault();
      const rows = visibleRows();
      const current = rows.indexOf(row);
      const next = ev.key === "Home" ? rows[0] : ev.key === "End" ? rows.at(-1)
        : rows[Math.max(0, Math.min(rows.length - 1, current + (ev.key === "ArrowDown" ? 1 : -1)))];
      if (next) focusTreeRow(treeEl, next);
      return;
    }
    if (ev.key === "ArrowRight" && node.getAttribute("data-tree-file") !== "1") {
      ev.preventDefault();
      if (node.getAttribute("data-expanded") !== "1") {
        void expandTreeNode(node).then(() => {
          const first = treeChildrenEl(node)?.querySelector<HTMLElement>(":scope > [data-tree-path] > [data-tree-row]");
          if (first) focusTreeRow(treeEl, first);
        });
      } else {
        const first = treeChildrenEl(node)?.querySelector<HTMLElement>(":scope > [data-tree-path] > [data-tree-row]");
        if (first) focusTreeRow(treeEl, first);
      }
      return;
    }
    if (ev.key === "ArrowLeft") {
      ev.preventDefault();
      if (node.getAttribute("data-expanded") === "1") collapseTreeNode(node);
      else {
        const parent = node.parentElement?.closest<HTMLElement>("[data-tree-path]");
        const parentRow = parent?.querySelector<HTMLElement>(":scope > [data-tree-row]");
        if (parentRow) focusTreeRow(treeEl, parentRow);
      }
      return;
    }
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      onTreeClick(ev);
    }
  }

  // Right-click on a tree node (folder or file) opens the SAME context menu the
  // right-side table uses — reusing `window.showFileContextMenu` (built in
  // context-menu.ts), which parameterises everything by (path, name, isDir) and
  // does not depend on the table's selection. Folders get the folder actions,
  // files the file actions (same conditional logic as the table). The opener
  // already calls preventDefault + stopPropagation, so no native menu shows and
  // the click/navigation handlers never fire (contextmenu ≠ click).
  export function onTreeContextMenu(ev: MouseEvent): void {
    const target = ev.target as HTMLElement;
    const node = target.closest("[data-tree-path]") as HTMLElement | null;
    if (!node) return;
    const path = node.getAttribute("data-tree-path") || "/";
    const isFile = node.getAttribute("data-tree-file") === "1";
    const name = node.getAttribute("data-tree-name") || getBaseName(path) || t("tree.root", "Raíz");
    // Lazy lookup at click time: the opener is defined at module load by
    // context-menu.ts. If it's genuinely missing we DON'T preventDefault, so the
    // browser's native menu shows as a visible fallback instead of a dead
    // right-click (no silent swallow). `showFileContextMenu` itself calls
    // preventDefault + stopPropagation, so no native menu on the happy path.
    const opener = (window as any).showFileContextMenu;
    if (typeof opener !== "function") return;
    opener(ev, path, name, !isFile);
  }

  // ── Post-mutation refresh (keep the tree in sync with the table) ──
  /** Invalidate + re-render a directory's direct children in the left tree,
   *  preserving its expansion state. No-op when the dir isn't materialised in
   *  the tree or hasn't been loaded yet (a later lazy expand fetches fresh).
   *  Used after mutations (rename/delete/compress/paste/…) so the tree mirrors
   *  the table even when the affected item lives in another expanded folder. */
  export async function refreshTreeDir(dirPath: string): Promise<void> {
    if (!document.getElementById("files-tree")) return;
    const key = treeNormalize(dirPath);
    treeChildrenCache.delete(key);
    const node = treeFindNode(key);
    if (!node || node.getAttribute("data-tree-file") === "1") return;
    const childrenEl = treeChildrenEl(node);
    if (!childrenEl || childrenEl.dataset.loaded !== "1") return;
    childrenEl.dataset.loaded = "0";
    if (node.getAttribute("data-expanded") === "1") {
      await expandTreeNode(node); // re-fetch + re-render, twisty stays open
    } else {
      childrenEl.innerHTML = ""; // collapsed: drop stale nodes, next expand refetches
      syncTreeBranchGeometry();
    }
  }

  /** Refresh a set of parent directories in the tree (deduped). Exposed on
   *  `window.__lxpFilesTreeRefresh` so mutation handlers across submodules can
   *  request a tree refresh without importing this module (avoids cycles). */
  export function requestTreeRefresh(dirs: string[]): void {
    const seen = new Set<string>();
    for (const d of dirs) {
      if (typeof d !== "string" || !d) continue;
      const key = treeNormalize(d);
      if (seen.has(key)) continue;
      seen.add(key);
      void refreshTreeDir(key);
    }
  }

  // ── Name-search tree filter (dual filter, name mode) ───────
  /** Toggle the "match" highlight on a node's label span. */
  function markTreeMatch(node: HTMLElement, on: boolean): void {
    const label = node.querySelector<HTMLElement>(":scope > [data-tree-row] [data-tree-label]");
    if (!label) return;
    label.classList.toggle("text-primary", on);
    label.classList.toggle("font-medium", on);
  }

  /** Recursively show/hide a node by name query over the ALREADY-LOADED tree.
   *  A node stays visible if it matches or has a visible (matching) descendant;
   *  loaded branches with a match are revealed. Returns whether it's visible. */
  function filterTreeNode(node: HTMLElement, q: string): boolean {
    const name = (node.getAttribute("data-tree-name") || "").toLowerCase();
    const selfMatch = name.includes(q);
    let childMatch = false;
    const childrenEl = node.querySelector<HTMLElement>(":scope > [data-tree-children]");
    if (childrenEl) {
      childrenEl.querySelectorAll<HTMLElement>(":scope > [data-tree-path]").forEach((child) => {
        if (filterTreeNode(child, q)) childMatch = true;
      });
      // Reveal a loaded branch that contains a match so the hit is visible.
      if (childMatch && childrenEl.dataset.loaded === "1") {
        childrenEl.classList.remove("hidden");
        childrenEl.removeAttribute("inert");
        node.setAttribute("data-expanded", "1");
        node.querySelector(":scope > [data-tree-row]")?.setAttribute("aria-expanded", "true");
        treeExpanded.add(treeNormalize(node.getAttribute("data-tree-path") || "/"));
        const tw = treeTwistyEl(node);
        if (tw) tw.style.transform = "rotate(90deg)";
      }
    }
    const visible = selfMatch || childMatch;
    node.classList.toggle("hidden", !visible);
    markTreeMatch(node, selfMatch);
    return visible;
  }

  /** Live-filter the folder tree by name over the loaded/expanded nodes only
   *  (no recursive fetch). Empty query restores the full tree. */
  export function filterTreeByName(query: string): void {
    const treeEl = document.getElementById("files-tree");
    if (!treeEl) return;
    const q = (query || "").trim().toLowerCase();
    if (!q) { clearTreeFilter(); return; }
    treeEl.querySelectorAll<HTMLElement>(":scope > [data-tree-path]").forEach((n) => filterTreeNode(n, q));
    if (highlightedTreePath) highlightTreeCurrent(highlightedTreePath);
    else syncTreeBranchGeometry();
  }

  /** Undo filterTreeByName: unhide every node and drop match highlights. */
  export function clearTreeFilter(): void {
    const treeEl = document.getElementById("files-tree");
    if (!treeEl) return;
    treeEl.querySelectorAll<HTMLElement>("[data-tree-path]").forEach((n) => {
      n.classList.remove("hidden");
      markTreeMatch(n, false);
    });
    if (highlightedTreePath) highlightTreeCurrent(highlightedTreePath);
    else syncTreeBranchGeometry();
  }

  // ── Recursive name search over the WHOLE subtree (server-side) ─────
  // `filterTreeByName` only sees nodes already materialised in the DOM, so a hit
  // inside a folder the user never expanded was invisible. The backend endpoint
  // `GET /api/files/search?base=&q=&limit=` (flat payload
  // `{items:[{path,name,type}],truncated,base}` — NOT the `{ok,data}` envelope of
  // the rest of the module) walks the subtree on the connected server, so we
  // render its hits as a flat result list that REPLACES the tree while there's a
  // query. The legacy `?path=&q=` search (right-hand listing, search-replace.ts)
  // is untouched: the backend discriminates by the `base` parameter.
  export const TREE_SEARCH_MIN_CHARS = 2;
  export const TREE_SEARCH_LIMIT = 200;
  const TREE_SEARCH_DEBOUNCE_MS = 300;
  let treeSearchToken = 0;
  let treeSearchDebounce: ReturnType<typeof setTimeout> | null = null;

  function treeResultsEl(): HTMLElement | null {
    return document.getElementById("files-tree-results");
  }

  /** Show either the tree or the search results (never both). */
  function showTreeResults(on: boolean): void {
    const results = treeResultsEl();
    const treeEl = document.getElementById("files-tree");
    if (!results || !treeEl) return;
    results.classList.toggle("hidden", !on);
    treeEl.classList.toggle("hidden", on);
  }

  /** `name` escaped for HTML with the matched substring wrapped in a mark. */
  function highlightMatch(name: string, q: string): string {
    const i = name.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0 || !q) return escapeHtml(name);
    return (
      escapeHtml(name.slice(0, i)) +
      `<mark class="rounded bg-primary/20 px-0.5 text-primary">${escapeHtml(name.slice(i, i + q.length))}</mark>` +
      escapeHtml(name.slice(i + q.length))
    );
  }

  /** Parent folder of a hit, relative to the search base ("." at the base). */
  function resultRelativeDir(path: string, base: string): string {
    const dir = treeNormalize(path).replace(/\/[^/]*$/, "") || "/";
    const root = treeNormalize(base);
    if (dir === root) return ".";
    const prefix = root === "/" ? "/" : `${root}/`;
    return dir.startsWith(prefix) ? dir.slice(prefix.length) : dir;
  }

  /** One result row — same affordances as a tree node (`data-tree-*`), so the
   *  shared context menu works and clicks resolve path/name/kind identically. */
  function makeTreeResultNode(item: { path: string; name: string; type: string }, q: string, base: string): HTMLElement {
    const isFile = item.type !== "dir";
    const node = document.createElement("div");
    node.className = "tree-node";
    node.setAttribute("data-tree-path", treeNormalize(item.path));
    node.setAttribute("data-tree-name", item.name);
    if (isFile) node.setAttribute("data-tree-file", "1");
    const row = document.createElement("div");
    row.setAttribute("data-tree-row", "");
    row.className = "tree-row flex items-center gap-1.5 rounded-md py-1 pl-1.5 pr-2 cursor-pointer text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
    row.setAttribute("role", "option");
    row.setAttribute("tabindex", "0");
    row.setAttribute("title", item.path);
    const icon = isFile
      ? `<span class="flex h-4 w-4 shrink-0 items-center justify-center text-sm">${fileIcon(item.name, false, isHiddenEntry(item), false, null)}</span>`
      : `<i class="ti ti-folder text-sm shrink-0 text-amber-500"></i>`;
    row.innerHTML =
      icon +
      `<span class="min-w-0 flex-1">` +
        `<span data-tree-label class="block truncate">${highlightMatch(item.name, q)}</span>` +
        `<span class="block truncate text-[11px] leading-tight text-muted-foreground">${escapeHtml(resultRelativeDir(item.path, base))}</span>` +
      `</span>`;
    node.appendChild(row);
    return node;
  }

  /** Non-row message inside the results pane (loading / empty / error). */
  function renderTreeResultsMessage(html: string): void {
    const results = treeResultsEl();
    if (!results) return;
    results.innerHTML = `<div class="px-2 py-4 text-center text-xs text-muted-foreground">${html}</div>`;
    showTreeResults(true);
  }

  /** Paint the hits: folders first, then files, each alphabetical. */
  function renderTreeResults(items: Array<{ path: string; name: string; type: string }>, q: string, base: string, truncated: boolean): void {
    const results = treeResultsEl();
    if (!results) return;
    results.innerHTML = "";
    if (!items.length) {
      renderTreeResultsMessage(escapeHtml(t("tree.searchEmpty", "Sin coincidencias")));
      return;
    }
    const header = document.createElement("div");
    header.className = "mb-1 px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground";
    header.textContent = fmt(
      items.length === 1 ? t("tree.searchCountOne", "{n} coincidencia") : t("tree.searchCountMany", "{n} coincidencias"),
      { n: items.length },
    );
    results.appendChild(header);
    for (const item of items) results.appendChild(makeTreeResultNode(item, q, base));
    if (truncated) {
      const warn = document.createElement("div");
      warn.className = "mt-1 rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] leading-tight text-amber-600 dark:text-amber-400";
      warn.textContent = fmt(t("tree.searchTruncated", "Resultados recortados: se muestran los primeros {n}."), { n: items.length });
      results.appendChild(warn);
    }
    showTreeResults(true);
  }

  /** Run the recursive search from the tree root and render its results.
   *  Stale responses (the user kept typing) are dropped via a token. */
  export async function searchTreeRemote(query: string): Promise<void> {
    const q = (query || "").trim();
    if (!treeResultsEl()) return;
    if (q.length < TREE_SEARCH_MIN_CHARS) { clearTreeSearch(); return; }
    const base = treeNormalize(treeRootPath || resolveTreeRoot());
    const token = ++treeSearchToken;
    renderTreeResultsMessage(escapeHtml(t("tree.searching", "Buscando…")));
    let res: any;
    try {
      res = await api.get<any>("/api/files/search", { params: { base, q, limit: TREE_SEARCH_LIMIT } });
    } catch {
      res = null;
    }
    if (token !== treeSearchToken) return; // superseded by a newer keystroke
    if (!res || !res.ok) {
      // A TRANSPORT failure (api-client reports `status: 0` — offline, dropped
      // SSH bridge, aborted request) degrades SILENTLY to the instant local DOM
      // filter: the user keeps a usable search over what is already loaded
      // instead of an error where a list used to be. A server that answered and
      // REFUSED (400/403/504…) is a real condition worth naming, so that one
      // still surfaces the message.
      if (!res || !res.status) {
        showTreeResults(false);
        filterTreeByName(q);
        return;
      }
      renderTreeResultsMessage(escapeHtml(t("tree.searchError", "No se pudo completar la búsqueda")));
      return;
    }
    const payload = res.data as any;
    const raw = Array.isArray(payload?.items) ? payload.items : [];
    const showHidden = treeHiddenVisible();
    const items = raw
      .filter((it: any) => it && typeof it.path === "string" && typeof it.name === "string")
      .filter((it: any) => showHidden || !isHiddenEntry(it))
      .filter((it: any) => canReadPathClient(it.path))
      .sort((a: any, b: any) => {
        const ad = a.type === "dir" ? 0 : 1;
        const bd = b.type === "dir" ? 0 : 1;
        if (ad !== bd) return ad - bd;
        return String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: "base" });
      });
    renderTreeResults(items, q, typeof payload?.base === "string" ? payload.base : base, Boolean(payload?.truncated));
  }

  /** Debounced entry point for the search box (one request per pause, not per
   *  keystroke — each hop is an SSH walk on the connected server). Below the
   *  backend's 2-char minimum it falls back to the instant local DOM filter. */
  export function scheduleTreeSearch(query: string): void {
    const q = (query || "").trim();
    if (treeSearchDebounce) { clearTimeout(treeSearchDebounce); treeSearchDebounce = null; }
    if (q.length < TREE_SEARCH_MIN_CHARS) {
      treeSearchToken++; // invalidate any in-flight response
      showTreeResults(false);
      if (q) filterTreeByName(q); else clearTreeFilter();
      return;
    }
    treeSearchDebounce = setTimeout(() => { treeSearchDebounce = null; void searchTreeRemote(q); }, TREE_SEARCH_DEBOUNCE_MS);
  }

  /** Leave search mode: drop pending/in-flight requests, restore the full tree. */
  export function clearTreeSearch(): void {
    if (treeSearchDebounce) { clearTimeout(treeSearchDebounce); treeSearchDebounce = null; }
    treeSearchToken++;
    const results = treeResultsEl();
    if (results) results.innerHTML = "";
    showTreeResults(false);
    clearTreeFilter();
  }

  /** Click on a result row: folders navigate the listing, files open in the
   *  editor (preview on a single click, pinned on a double click — same as the
   *  tree). The results stay visible so the user can open several hits. */
  export function onTreeResultClick(ev: Event): void {
    const node = (ev.target as HTMLElement).closest("[data-tree-path]") as HTMLElement | null;
    if (!node) return;
    const path = node.getAttribute("data-tree-path") || "";
    if (!path) return;
    if (node.getAttribute("data-tree-file") === "1") {
      const preview = (ev as MouseEvent).detail < 2;
      (window as any).handleDblClick?.(path, false, { preview });
      return;
    }
    (window as any).navigate?.(path);
  }

  export function onTreePathChanged(ev: Event): void {
    const p = (ev as CustomEvent<{ path?: string }>).detail?.path;
    if (typeof p !== "string" || !p) return;
    // A path change updates the right pane; keep the user's left-tree expansion
    // and scroll untouched. Only a different tab root requires a new tree.
    if (treeNormalize(resolveTreeRoot()) !== treeNormalize(treeRootPath)) void buildFilesTree();
    else highlightTreeCurrent(p);
  }

  /** Clear + render the tree from its root (root = "/" for allowAll, else the
   *  caller's default base). Used on init and by the refresh button. */
  export async function buildFilesTree(): Promise<void> {
    const treeEl = document.getElementById("files-tree");
    if (!treeEl) return;
    await ensureFileAccessPolicy();
    treeRootPath = resolveTreeRoot();
    treeExpanded.clear();
    treeChildrenCache.clear();
    treeEl.innerHTML = "";
    treeEl.removeAttribute("data-marker-on");
    highlightedTreePath = "";
    const rootName = treeRootPath === "/" ? t("tree.root", "Raíz") : getBaseName(treeRootPath);
    const rootNode = makeTreeNode(treeRootPath, rootName, 0, true);
    treeEl.appendChild(rootNode);
    await expandTreeNode(rootNode);
    if (S.currentPath) await revealTreePath(S.currentPath);
    // A live search is anchored to the root: re-run it against the new base so
    // the results never belong to a tree that no longer exists.
    const liveQuery = ((document.getElementById("files-search") as HTMLInputElement | null)?.value || "").trim();
    if (S.searchMode !== "content" && liveQuery.length >= TREE_SEARCH_MIN_CHARS) void searchTreeRemote(liveQuery);
  }

  /** Set `chosen` as the ACTIVE tab's tree root and reflect it on both panes.
   *  Ties the root to that tab ONLY (fully independent — does not touch any other
   *  tab or the root new tabs open at). Used by the picker and the favorites list. */
  export function applyTreeRootToActiveTab(chosen: string): void {
    const root = treeNormalize(chosen);
    const activeManager = getActiveFilesManager();
    if (activeManager) {
      activeManager.treeRoot = root === "/" ? undefined : root;
      persistFilesManagers();
      renderFilesManagerTabs();
    }
    showToast(fmt(t("tree.rootChanged", "Carpeta raíz del árbol: {path}"), { path: root }), true);
    void (async () => {
      await buildFilesTree();
      (window as any).navigate(root);
    })();
  }

  /** Let the user pick (and persist) the folder the tree starts from. Opens the
   *  folder picker seeded at the current root; on confirm, applies it to the tab. */
  export function setTreeRootInteractive(): void {
    renderTreeExpansionModeOptions();
    pickFolder(treeRootPath || "/", (chosen) => applyTreeRootToActiveTab(chosen), true);
  }
  export function renderTreeExpansionModeOptions(): void {
    document.querySelectorAll<HTMLInputElement>('input[name="folder-picker-tree-mode"]')
      .forEach((input) => { input.checked = input.value === S.treeExpansionMode; });
  }
  export function favRootsStorageKey(): string {
    const scope = (S.activeTargetScope || resolveCurrentTargetScope() || LOCAL_TARGET_SCOPE).trim();
    return `${FILES_FAV_ROOTS_KEY}::${scope}`;
  }
  export function loadFavRoots(): string[] {
    return Array.from(new Set(S.favoriteRoots.map((p) => treeNormalize(p)).filter((p) => p && p !== "/")));
  }
  export function saveFavRoots(list: string[]): void {
    const uniq = Array.from(new Set(list.map((p) => treeNormalize(p)).filter((p) => p && p !== "/"))).slice(0, 50);
    S.favoriteRoots = uniq;
    void patchFilesPreferences({ favoriteRoots: uniq }).then((res) => {
      if (!res.ok) showToast(res.error || t("toasts.saveError2", "No se pudo guardar"), false);
    });
  }

  /** (Re)render the favorites <select>: "/" (root) first, then the active tab's
   *  current root (so it shows as selected even if not saved), then favorites. */
  export function renderFavRootSelect(): void {
    const sel = document.getElementById("files-fav-root-select") as HTMLSelectElement | null;
    if (!sel) return;
    const activeRoot = treeNormalize(resolveTreeRoot());
    const favs = loadFavRoots();
    const ordered = ["/", ...favs.filter((p) => p !== "/")];
    if (!ordered.includes(activeRoot)) ordered.splice(1, 0, activeRoot); // show current even if unsaved
    sel.innerHTML = ordered.map((p) => {
      const label = p === "/" ? `${t("tree.root", "Raíz")} (/)` : p;
      const sel2 = p === activeRoot ? " selected" : "";
      return `<option value="${escapeAttr(p)}"${sel2}>${escapeHtml(label)}</option>`;
    }).join("");
  }

  /** Bind the modal's settings tabs + the favorites controls. DOM listeners
   *  re-bind per fresh DOM via a dataset guard (SPA swaps the modal markup). */
  export function initFilesSettingsRoots(): void {
    const treeOptions = document.getElementById("folder-picker-tree-options");
    if (treeOptions && treeOptions.dataset.lxpBound !== "1") {
      treeOptions.dataset.lxpBound = "1";
      treeOptions.addEventListener("change", (event) => {
        const input = event.target as HTMLInputElement;
        if (input.name !== "folder-picker-tree-mode") return;
        const next = input.value === "single" ? "single" : "multiple";
        if (next === S.treeExpansionMode) return;
        const previous = S.treeExpansionMode;
        S.treeExpansionMode = next;
        const radios = Array.from(treeOptions.querySelectorAll<HTMLInputElement>('input[name="folder-picker-tree-mode"]'));
        radios.forEach((radio) => { radio.disabled = true; });
        void patchFilesPreferences({ treeExpansionMode: next }).then((result) => {
          if (!result.ok) {
            S.treeExpansionMode = previous;
            renderTreeExpansionModeOptions();
            showToast(result.error || t("toasts.saveError2", "No se pudo guardar"), false);
          }
        }).catch(() => {
          S.treeExpansionMode = previous;
          renderTreeExpansionModeOptions();
          showToast(t("toasts.saveError2", "No se pudo guardar"), false);
        }).finally(() => {
          radios.forEach((radio) => { radio.disabled = false; });
        });
      });
    }
    renderTreeExpansionModeOptions();
    // "Show hidden files (dotfiles)" switch — mirrors the toolbar eye toggle and
    // shares its state + localStorage key. Bound once per fresh DOM (SPA guard).
    const hiddenToggle = document.getElementById("files-show-hidden-toggle") as HTMLInputElement | null;
    if (hiddenToggle && hiddenToggle.dataset.lxpBound !== "1") {
      hiddenToggle.dataset.lxpBound = "1";
      hiddenToggle.checked = S.showHidden;
      hiddenToggle.addEventListener("change", () => setShowHidden(hiddenToggle.checked));
    }

    // Settings sub-tabs (General / Root folders) inside the File settings modal.
    document.querySelectorAll<HTMLButtonElement>("[data-files-settings-tab]").forEach((btn) => {
      if (btn.dataset.lxpBound === "1") return;
      btn.dataset.lxpBound = "1";
      btn.addEventListener("click", () => {
        const tab = btn.dataset.filesSettingsTab || "general";
        document.querySelectorAll<HTMLElement>("[data-files-settings-panel]").forEach((panel) => {
          panel.classList.toggle("hidden", panel.dataset.filesSettingsPanel !== tab);
        });
        document.querySelectorAll<HTMLButtonElement>("[data-files-settings-tab]").forEach((b) => {
          const active = b.dataset.filesSettingsTab === tab;
          const railBase = "flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 ease-out @xl:justify-start";
          b.className = active
            ? `${railBase} bg-primary/10 text-primary`
            : `${railBase} text-muted-foreground hover:bg-accent hover:text-foreground`;
        });
        if (tab === "roots") renderFavRootSelect();
      });
    });

    // Nested shortcut category tabs (Files / Navigation / View & tools) inside
    // the General panel — pure DOM toggling, per-element dataset guard for SPA.
    document.querySelectorAll<HTMLButtonElement>("[data-files-shortcut-cat]").forEach((btn) => {
      if (btn.dataset.lxpBound === "1") return;
      btn.dataset.lxpBound = "1";
      btn.addEventListener("click", () => {
        const cat = btn.dataset.filesShortcutCat || "files";
        document.querySelectorAll<HTMLElement>("[data-files-shortcut-catpanel]").forEach((panel) => {
          panel.classList.toggle("hidden", panel.dataset.filesShortcutCatpanel !== cat);
        });
        document.querySelectorAll<HTMLButtonElement>("[data-files-shortcut-cat]").forEach((b) => {
          const active = b.dataset.filesShortcutCat === cat;
          b.className = active
            ? "files-shortcut-cat rounded-md px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground shadow-sm"
            : "files-shortcut-cat rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground";
        });
      });
    });

    // This tab is a MANAGER for the favorites list only — selecting an entry
    // here does NOT change any tab's root. The list is surfaced as predefined
    // routes inside the root selector (folder picker), where the root is set.
    const addBtn = document.getElementById("files-fav-root-add");
    if (addBtn && addBtn.dataset.lxpBound !== "1") {
      addBtn.dataset.lxpBound = "1";
      addBtn.addEventListener("click", () => {
        pickFolder(treeRootPath || "/", (chosen) => {
          const norm = treeNormalize(chosen);
          if (norm === "/") return; // "/" is always available, not a saved favorite
          saveFavRoots([...loadFavRoots(), norm]);
          renderFavRootSelect();
          showToast(fmt(t("tree.favAdded", "Añadido a favoritos: {path}"), { path: norm }), true);
        });
      });
    }
    const rmBtn = document.getElementById("files-fav-root-remove");
    if (rmBtn && rmBtn.dataset.lxpBound !== "1") {
      rmBtn.dataset.lxpBound = "1";
      rmBtn.addEventListener("click", () => {
        const s = document.getElementById("files-fav-root-select") as HTMLSelectElement | null;
        const path = treeNormalize(s?.value || "/");
        if (path === "/") return; // "/" is not a removable favorite
        saveFavRoots(loadFavRoots().filter((p) => p !== path));
        renderFavRootSelect();
        showToast(fmt(t("tree.favRemoved", "Quitado de favoritos: {path}"), { path }), true);
      });
    }

    // Refresh the list each time the settings modal opens.
    const trigger = document.getElementById("files-settings-modal-trigger");
    if (trigger && trigger.dataset.lxpFavBound !== "1") {
      trigger.dataset.lxpFavBound = "1";
      trigger.addEventListener("click", () => renderFavRootSelect());
    }
    renderFavRootSelect();
  }

  /** Bind tree listeners (DOM ones re-bind per fresh DOM via a dataset guard;
   *  the window path-changed listener binds once) and build it. */
  export function initFilesTree(): void {
    const treeEl = document.getElementById("files-tree");
    if (!treeEl) return;
    // Expose the tree-refresh hook so mutation handlers in other submodules can
    // resync the affected folder(s) without importing this module.
    (window as any).__lxpFilesTreeRefresh = requestTreeRefresh;
    if (treeEl.dataset.lxpTreeBound !== "1") {
      treeEl.dataset.lxpTreeBound = "1";
      treeEl.addEventListener("click", onTreeClick);
      treeEl.addEventListener("keydown", onTreeKeydown);
      treeEl.addEventListener("contextmenu", onTreeContextMenu);
      const results = treeResultsEl();
      if (results) {
        results.addEventListener("click", onTreeResultClick);
        // Same context menu as the tree/table (rows carry the same data-tree-*).
        results.addEventListener("contextmenu", onTreeContextMenu);
        // Rows are focusable options: Enter/Space activate them like a click.
        results.addEventListener("keydown", (ev: KeyboardEvent) => {
          if (ev.key !== "Enter" && ev.key !== " ") return;
          ev.preventDefault();
          onTreeResultClick(ev);
        });
      }
      document.getElementById("files-tree-refresh")?.addEventListener("click", () => { void buildFilesTree(); });
      document.getElementById("files-tree-set-root")?.addEventListener("click", setTreeRootInteractive);
    }
    if (!filesTreePathListenerBound) {
      filesTreePathListenerBound = true;
      window.addEventListener("luxipanel:files-path-changed", onTreePathChanged);
    }
    void buildFilesTree();
  }
