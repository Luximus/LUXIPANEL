// Floating terminal — tab strip rendering + tab management (switch/rename/close).
import { S, sessions, escapeHtml } from "./state";
import { I18N, tI18n } from "./i18n";
import { openPrompt } from "@/lib/confirm";
import { FILES_CURRENT_PATH_KEY } from "../../pages/panel/files/state";
import { createTerminal, getModeInitialCommand, syncLoadingOverlay } from "./terminal";
import { refreshStartupCli } from "./startup";
import { setStatus, emitTerminalCwd } from "./terminal-io";

  const tabAccentClasses = [
    "text-emerald-400",
    "text-sky-400",
    "text-amber-400",
    "text-rose-400",
    "text-violet-400",
    "text-cyan-400",
    "text-lime-400",
    "text-fuchsia-400",
    "text-orange-400",
  ];

  function getTabAccentClass(tabId: number): string {
    return tabAccentClasses[(tabId - 1) % tabAccentClasses.length] ?? "text-emerald-400";
  }

  function getTabLabel(tabId: number): string {
    return sessions.get(tabId)?.label ?? tI18n(I18N.tabLabel, { n: tabId });
  }

  function renderTabClass(tabId: number): string {
    return tabId === S.activeTabId
      ? "group relative flex max-w-56 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
      : "group flex max-w-56 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-border hover:bg-accent/70 hover:text-foreground";
  }

  function renderTab(tabId: number): HTMLDivElement {
    const session = sessions.get(tabId);
    const tabEl = document.createElement("div");
    tabEl.id = `tab-${tabId}`;
    tabEl.setAttribute("role", "tab");
    tabEl.tabIndex = tabId === S.activeTabId ? 0 : -1;
    tabEl.title = getTabLabel(tabId);
    tabEl.className = renderTabClass(tabId);
    tabEl.innerHTML = `
      <i class="ti ti-terminal-2 text-sm ${session?.accentClass ?? getTabAccentClass(tabId)}"></i>
      <span class="terminal-tab-label min-w-0 max-w-28 truncate">${escapeHtml(getTabLabel(tabId))}</span>
      <button class="ml-1 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-background hover:text-primary" data-action="rename" title="${escapeHtml(I18N.renameTabTitle)}" aria-label="${escapeHtml(I18N.renameTabTitle)}">
        <i class="ti ti-pencil text-xs"></i>
      </button>
      <button class="ml-0.5 rounded p-0.5 text-muted-foreground hover:text-destructive" data-action="close" title="${escapeHtml(I18N.closeTabTitle)}" aria-label="${escapeHtml(I18N.closeTabTitle)}">
        <i class="ti ti-x text-xs"></i>
      </button>`;
    tabEl.addEventListener("click", (event) => {
      const action = (event.target as HTMLElement | null)?.closest("[data-action]")?.getAttribute("data-action");
      if (action === "close" || action === "rename") return;
      switchTab(tabId);
    });
    tabEl.querySelector<HTMLElement>('[data-action="close"]')?.addEventListener("click", (event) => {
      event.stopPropagation();
      closeTab(tabId);
    });
    tabEl.querySelector<HTMLElement>('[data-action="rename"]')?.addEventListener("click", (event) => {
      event.stopPropagation();
      renameTab(tabId);
    });
    tabEl.addEventListener("dblclick", () => renameTab(tabId));
    tabEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); switchTab(tabId); }
    });
    return tabEl;
  }

  // ── Tab management ─────────────────────────────────────────
function switchTab(tabId: number) {
    S.activeTabId = tabId;
    sessions.forEach((s, id) => {
      s.container.style.display = id === tabId ? "block" : "none";
    });
    document.querySelectorAll<HTMLElement>("#tabs-container > [id^='tab-']").forEach((t) => {
      const id = Number(t.id.replace("tab-", ""));
      t.className = renderTabClass(id);
      t.setAttribute("aria-selected", String(id === tabId));
      t.tabIndex = id === tabId ? 0 : -1;
    });
  const session = sessions.get(tabId);
  if (session) {
    emitTerminalCwd(session.cwd || "/");
      session.fitAddon.fit();
      if (session.ws?.readyState === WebSocket.OPEN) setStatus(I18N.status.connected, true);
      else setStatus(I18N.status.disconnected, false);
    }
    syncLoadingOverlay();
  }

  async function renameTab(tabId: number) {
    const session = sessions.get(tabId);
    if (!session) return;
    const nextLabel = (
      await openPrompt(I18N.rename.promptLabel, {
        title: I18N.rename.promptTitle,
        defaultValue: session.label,
      })
    )?.trim();
    if (!nextLabel) return;
    session.label = nextLabel;
    const tabEl = document.getElementById(`tab-${tabId}`);
    const labelEl = tabEl?.querySelector(".terminal-tab-label");
    if (labelEl) labelEl.textContent = nextLabel;
    if (tabEl) tabEl.title = nextLabel;
  }

  async function closeTab(tabId: number) {
    const session = sessions.get(tabId);
    if (session) {
      if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
      session.ws?.close();
      session.term.dispose();
      session.container.remove();
      sessions.delete(tabId);
    }
    // Cierre EXPLÍCITO: olvidar el sessionId persistido para que esta pestaña no
    // se re-adjunte tras una recarga (la sesión tmux huérfana la limpia el reaper).
    try { if (session?.sessionStorageKey) localStorage.removeItem(session.sessionStorageKey); } catch { /* ignore */ }
    document.getElementById(`tab-${tabId}`)?.remove();
    if (sessions.size > 0) {
      if (S.activeTabId === tabId) {
        const nextId = [...sessions.keys()].sort((a, b) => a - b).find((id) => id > tabId)
          ?? [...sessions.keys()].sort((a, b) => b - a).find((id) => id < tabId)!;
        switchTab(nextId);
      }
    } else {
      // Era la última pestaña: abrimos una nueva para no dejar la consola vacía
      // (en la vista de página/drawer siempre debe haber al menos un terminal).
      if (!await refreshStartupCli() || sessions.size > 0) return;
      S.tabCount++;
      const newId = S.tabCount;
      const filesPath = (window as any).__filesCurrentPath || sessionStorage.getItem(FILES_CURRENT_PATH_KEY) || "/";
      createTerminal(newId, { cdOnConnect: filesPath, initialCommand: getModeInitialCommand() });
      document.getElementById("tabs-container")?.appendChild(renderTab(newId));
      switchTab(newId);
    }
  }

  (window as any).closeTab = closeTab;

  (window as any).renameTab = renameTab;

export { renderTab, switchTab, closeTab, renameTab, getTabAccentClass };
