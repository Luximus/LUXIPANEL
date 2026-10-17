// SPDX-License-Identifier: AGPL-3.0-only
/** Mirror module navigation into the workspace header. The real controls stay
 * inside their controller scope, so existing listeners, permissions and tab
 * state continue to belong to the module. */
const TAB_SELECTOR = "button.tab-btn, button.mail-main-tab, button.repo-tab-btn, button.cf-tab, button.db-tab, button[role='tab'], button[data-tab], button[data-mail-main-tab]";
const ACTION_SELECTOR = [
  "button[id^='btn-new-']", "button#btn-new", "button[id^='btn-create-']",
  "button[id^='btn-add-']", "button[data-module-topbar-action]",
  "button#btn-hosting-plans", "button#btn-backup-now", "button#btn-ban-ip",
  "button#btn-cf-allow", "button#btn-start-audit", "button#btn-ai-ufw",
  "button#btn-ai-fail2ban", "button#btn-refresh-procs",
].join(", ");

function isModuleControl(button: HTMLButtonElement): boolean {
  return !button.closest("dialog, [data-view-settings-modal], [data-module-toolbar], [data-module-header-tabs-slot], [data-module-header-actions-slot]");
}

function visibleInModule(node: HTMLElement, root: HTMLElement): boolean {
  for (let element: HTMLElement | null = node; element && element !== root; element = element.parentElement) {
    if (element.hidden || element.getAttribute("aria-hidden") === "true" || element.classList.contains("hidden") || element.classList.contains("sr-only")) return false;
    if (element instanceof HTMLDialogElement && !element.open) return false;
    if (element.style.display === "none") return false;
    if (!element.hasAttribute("data-module-topbar-source") && !element.hasAttribute("data-module-topbar-source-row") && getComputedStyle(element).display === "none") return false;
  }
  return true;
}

function primaryTabs(root: HTMLElement): HTMLButtonElement[] {
  const groups = new Map<HTMLElement, HTMLButtonElement[]>();
  for (const button of root.querySelectorAll<HTMLButtonElement>(TAB_SELECTOR)) {
    if (!isModuleControl(button) || !button.parentElement || !visibleInModule(button, root)) continue;
    const group = groups.get(button.parentElement) ?? [];
    group.push(button);
    groups.set(button.parentElement, group);
  }
  return [...groups.values()].find((group) => group.length > 1) ?? [];
}

function selected(button: HTMLButtonElement): boolean {
  if (button.getAttribute("aria-selected") === "true" || button.getAttribute("aria-current") === "page") return true;
  return button.classList.contains("border-primary") || button.classList.contains("text-primary") || button.classList.contains("bg-card");
}

function proxy(button: HTMLButtonElement, kind: "tab" | "action"): HTMLButtonElement {
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = kind === "tab" ? "lxp-workspace-header-tab" : "lxp-workspace-header-action";
  copy.dataset.moduleHeaderProxy = kind;
  copy.disabled = button.disabled;
  const name = button.getAttribute("aria-label") || button.textContent?.trim() || "";
  if (name) copy.setAttribute("aria-label", name);
  if (button.title) copy.title = button.title;
  if (kind === "tab") {
    copy.setAttribute("role", "tab");
    copy.setAttribute("aria-selected", String(selected(button)));
    copy.dataset.active = String(selected(button));
  } else if (button.classList.contains("bg-primary")) copy.dataset.primary = "true";
  for (const child of button.childNodes) copy.append(child.cloneNode(true));
  for (const element of copy.querySelectorAll<HTMLElement>("[id], [aria-controls], [aria-labelledby]")) {
    element.removeAttribute("id");
    element.removeAttribute("aria-controls");
    element.removeAttribute("aria-labelledby");
  }
  copy.addEventListener("click", () => button.click());
  return copy;
}

export function mountModuleTopbar(root: HTMLElement, drawer: HTMLElement): () => void {
  const tabsSlot = drawer.querySelector<HTMLElement>("[data-module-header-tabs-slot]");
  const actionsSlot = drawer.querySelector<HTMLElement>("[data-module-header-actions-slot]");
  if (!tabsSlot || !actionsSlot) return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  // Terminal tabs are live DOM nodes (rename/close/status listeners). Move the
  // complete row instead of cloning it. Mobile owns its existing tabs drawer.
  const desktopTerminal = root.dataset.internalModule === "terminal"
    ? window.matchMedia("(min-width: 1025px)") : null;
  let terminalRow: HTMLElement | null = null;
  let terminalHome: Comment | null = null;
  let terminalSidebarTabs: HTMLElement | null = null;
  const restoreTerminal = () => {
    if (terminalRow && terminalHome?.parentNode) terminalHome.replaceWith(terminalRow);
    terminalRow?.removeAttribute("data-terminal-header-toolbar");
    terminalRow = null;
    terminalHome = null;
  };
  const sync = () => {
    if (disposed) return;
    if (!desktopTerminal?.matches) restoreTerminal();
    else if (!terminalRow) {
      // The mobile controller restores its row on the next animation frame.
      // Wait for that hand-off before recording the desktop home position.
      terminalRow = root.querySelector<HTMLElement>("[data-terminal-toolbar]:not(.lxp-terminal-tabs-controls)");
      if (terminalRow) {
        terminalHome = document.createComment("terminal-toolbar-home");
        terminalRow.before(terminalHome);
        terminalRow.setAttribute("data-terminal-header-toolbar", "");
        tabsSlot.replaceChildren(terminalRow);
      }
    }
    const tabs = terminalRow
      ? [...root.querySelectorAll<HTMLButtonElement>("[data-terminal-sidebar-tab]")]
      : desktopTerminal ? [] : primaryTabs(root);
    const group = tabs[0]?.parentElement;
    const actions = [...root.querySelectorAll<HTMLButtonElement>(ACTION_SELECTOR)]
      .filter((button) => isModuleControl(button) && visibleInModule(button, root));
    const wanted = new Set<HTMLElement>([...actions, ...(group ? [group] : [])]);
    for (const source of root.querySelectorAll<HTMLElement>("[data-module-topbar-source]")) {
      if (!wanted.has(source)) source.removeAttribute("data-module-topbar-source");
    }
    for (const source of wanted) source.setAttribute("data-module-topbar-source", "");

    // The Users and Mail top rows contain only tabs and their action buttons.
    // Hide the now empty row as well, avoiding a blank divider in the body.
    const moduleId = root.dataset.internalModule;
    const row = group?.parentElement;
    const sourceRow = (moduleId === "users" || moduleId === "mail") ? row : null;
    for (const oldRow of root.querySelectorAll<HTMLElement>("[data-module-topbar-source-row]")) {
      if (oldRow !== sourceRow) oldRow.removeAttribute("data-module-topbar-source-row");
    }
    sourceRow?.setAttribute("data-module-topbar-source-row", "");

    const focusedTabIndex = tabsSlot.contains(document.activeElement)
      ? [...tabsSlot.querySelectorAll('[data-module-header-proxy="tab"]')].indexOf(document.activeElement as HTMLButtonElement)
      : -1;
    const tabButtons = tabs.map((button) => proxy(button, "tab"));
    if (terminalRow) {
      if (!terminalSidebarTabs) {
        terminalSidebarTabs = document.createElement("div");
        terminalSidebarTabs.className = "lxp-terminal-header-sidebar-tabs";
        terminalSidebarTabs.setAttribute("role", "tablist");
        tabsSlot.append(terminalSidebarTabs);
      }
      terminalSidebarTabs.replaceChildren(...tabButtons);
    } else {
      terminalSidebarTabs = null;
      tabsSlot.replaceChildren(...tabButtons);
    }
    if (focusedTabIndex >= 0) tabButtons[focusedTabIndex]?.focus();
    tabsSlot.setAttribute("role", !terminalRow && tabButtons.length ? "tablist" : "presentation");
    tabsSlot.onkeydown = (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const index = tabButtons.indexOf(document.activeElement as HTMLButtonElement);
      if (index < 0) return;
      event.preventDefault();
      const next = tabButtons[(index + (event.key === "ArrowRight" ? 1 : -1) + tabButtons.length) % tabButtons.length];
      next.focus();
      next.click();
    };
    actionsSlot.replaceChildren(...actions.map((button) => proxy(button, "action")));
  };
  const schedule = () => {
    if (timer || disposed) return;
    timer = setTimeout(() => { timer = undefined; sync(); }, 60);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "style", "hidden", "aria-selected", "aria-current", "disabled"] });
  desktopTerminal?.addEventListener("change", sync);
  sync();
  return () => {
    disposed = true;
    clearTimeout(timer);
    observer.disconnect();
    desktopTerminal?.removeEventListener("change", sync);
    restoreTerminal();
    tabsSlot.replaceChildren();
    actionsSlot.replaceChildren();
    tabsSlot.onkeydown = null;
    for (const source of root.querySelectorAll<HTMLElement>("[data-module-topbar-source]")) source.removeAttribute("data-module-topbar-source");
    for (const row of root.querySelectorAll<HTMLElement>("[data-module-topbar-source-row]")) row.removeAttribute("data-module-topbar-source-row");
  };
}
