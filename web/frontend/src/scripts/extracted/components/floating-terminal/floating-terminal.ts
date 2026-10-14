// Floating terminal — ENTRY. Wires the submodules (importing them registers
// their window.* globals + top-level bindings as a side effect) and owns the
// lazy-init lifecycle, pocket persistence, global listeners, DOM listeners,
// tmux preflight and the public drawer events.
import { refreshStartupCli, terminalTargetScope } from "./startup";
import { S, sessions, escapeHtml } from "./state";
import { I18N, tI18n } from "./i18n";
import { api, TARGET_SCOPE_SESSION_KEY } from "@/lib/api-client";
import { openConfirm, openAlert } from "@/lib/confirm";
import { TerminalWsMsg } from "@/lib/terminal-ws-protocol";
import { FILES_CURRENT_PATH_KEY } from "../../pages/panel/files/state";
import { applyShellHighlight } from "./editor";
import { syncTerminalTheme, ensureTerminalThemeSync } from "./theme";
import { createTerminal, getModeInitialCommand, syncLoadingOverlay, connectWs, ro } from "./terminal";
import { closeTab, renderTab, switchTab } from "./tabs";
import {
  setStatus,
  normalizePath,
  processTerminalInput,
  setMobileKeyPressed,
  clearMobileKeyModifiers,
  resolveMobileKeySequence,
} from "./terminal-io";
import {
  loadTerminalPreferences,
  renderHistoryFilters,
  renderHistoryPanel,
  ensureDefaultTerminalTab,
  handleDrawerTabChanged,
  getHistory,
  loadConversationIntoNewTerminal,
  copyTextToClipboard,
  loadConversationHistory,
  getConversationPageState,
  setHistoryMode,
  scheduleHistoryOrderSave,
  syncHistoryOrderControl,
  bindHistoryPreferencesControls,
  selectedConversationIds,
  historyMode,
  conversationHistory,
  historyKey,
  type HistoryMode,
} from "./history";
import {
  loadSnippetState,
  renderSnippetUI,
  setCategoryForm,
  setTagForm,
  bindSnippetsDataTableEvents,
  saveSnippetState,
  mutateSnippet,
  openSnippetDialog,
  resetCategoryForm,
  resetTagForm,
  snippetStateRefs,
  renderSnippetList,
  renderSnippetDialogTags,
  sendToTerminal,
} from "./snippets";

  // ─────────────────────────────────────────────────────────────────────────────
  // Lifecycle: el script se carga una sola vez (vive en PanelLayout). Las
  // terminales se crean perezosamente cuando el usuario abre el drawer flotante
  // por primera vez. Sobreviven a cierres de drawer y a navegaciones de página
  // (los containers xterm se mueven a un pocket DOM persistente). Se destruyen
  // sólo en logout o al cerrar todas las pestañas.
  // ─────────────────────────────────────────────────────────────────────────────

  const POCKET_ID = "lxp-terminal-pocket";
  let oneTimeInitDone = false;
  let lastBoundTermContainer: HTMLElement | null = null;
  let oneTimeInitPromise: Promise<void> | null = null;
  let globalListenersBound = false;

  function getPocket(): HTMLElement | null {
    return document.getElementById(POCKET_ID);
  }

  function moveSessionsToPocket(): void {
    if (sessions.size === 0) return;
    const pocket = getPocket();
    if (!pocket) return;
    if (lastBoundTermContainer) {
      try { ro.unobserve(lastBoundTermContainer); } catch { /* ignore */ }
    }
    sessions.forEach((s) => {
      if (s.container.parentElement !== pocket) {
        pocket.appendChild(s.container);
      }
    });
  }

  function disposeAllSessions(): void {
    sessions.forEach((s) => {
      if (s.reconnectTimer) clearTimeout(s.reconnectTimer);
      try { s.ws?.close(); } catch { /* ignore */ }
      try { s.term.dispose(); } catch { /* ignore */ }
      s.container.remove();
    });
    sessions.clear();
    S.tabCount = 0;
    S.activeTabId = 1;
    lastBoundTermContainer = null;
  }

  // Wrap closeTab para notificar al React drawer cuando se cierran todas las
  // pestañas (resetea el flag interno y permite re-inicializar al volver a abrir).
  const __originalCloseTab = closeTab;
  function closeTabAndNotify(tabId: number) {
    __originalCloseTab(tabId);
    if (sessions.size === 0) {
      lastBoundTermContainer = null;
      window.dispatchEvent(new CustomEvent("lxp-terminal:all-sessions-closed"));
    }
  }
  (window as any).closeTab = closeTabAndNotify;

  function bindGlobalListeners(): void {
    if (globalListenersBound) return;
    globalListenersBound = true;

    window.addEventListener("luxipanel:files-path-changed", ((event: CustomEvent<{ path?: string; source?: string }>) => {
      const detail = event.detail || {};
      if (detail.source === "terminal") return;
      const path = typeof detail.path === "string" ? detail.path : "";
      if (!path) return;
      const session = sessions.get(S.activeTabId);
      if (!session?.ws || session.ws.readyState !== WebSocket.OPEN) return;
      const normalized = normalizePath(path);
      if (session.cwd === normalized) return;
      session.cwd = normalized;
      session.ws.send(JSON.stringify({ type: TerminalWsMsg.INPUT, data: `cd ${JSON.stringify(normalized)}\r` }));
    }) as EventListener);

    window.addEventListener("lxp-terminal:dispose-all", () => {
      disposeAllSessions();
      window.dispatchEvent(new CustomEvent("lxp-terminal:all-sessions-closed"));
    });
    window.addEventListener("luxipanel:logout", () => {
      disposeAllSessions();
      window.dispatchEvent(new CustomEvent("lxp-terminal:all-sessions-closed"));
    });

    document.addEventListener("astro:before-swap", () => {
      moveSessionsToPocket();
    });

    window.addEventListener("lxp-terminal:tab-changed", ((event: CustomEvent<{ tab?: string }>) => {
      const tab = event.detail?.tab;
      if (tab) handleDrawerTabChanged(tab);
    }) as EventListener);
    window.addEventListener("luxipanel:target-changed", () => {
      if (!oneTimeInitDone) return;
      void loadTerminalPreferences();
      renderHistoryPanel();
    });

    bindSnippetsDataTableEvents();

    // Reload snippets when another module imports them (e.g. the Files module's
    // "Generate terminal snippets from folder" action) so they appear at once.
    window.addEventListener("lxp-terminal:reload-snippets", () => {
      void (async () => {
        try {
          await loadSnippetState();
          renderSnippetUI();
          applyShellHighlight(document.getElementById("snippet-list") ?? document);
        } catch (err) {
          console.error("[floating-terminal] reload-snippets", err);
        }
      })();
    });

    window.addEventListener("lxp-terminal:inject-command", ((event: CustomEvent<{ command?: string; run?: boolean }>) => {
      const cmd = event.detail?.command;
      if (typeof cmd !== "string" || cmd.length === 0) return;
      let attempts = 0;
      const trySend = () => {
        // Snippets, historial y reanudar conversaciones SIEMPRE corren en la
        // terminal por defecto (shell). `ensureDefaultTerminalTab` la activa
        // (o la crea) y deja `activeTabId` apuntando a ella, así
        // `sendToTerminal` escribe en la terminal correcta.
        const tabId = ensureDefaultTerminalTab();
        const active = sessions.get(tabId);
        if (active?.ws && active.ws.readyState === WebSocket.OPEN) {
          sendToTerminal(cmd);
          return;
        }
        if (attempts++ < 25) {
          window.setTimeout(trySend, 200);
        }
      };
      trySend();
    }) as EventListener);

    window.addEventListener("lxp-terminal:closed", () => {
      moveSessionsToPocket();
    });

    // Acciones del historial (React → vanilla). El DataTable de React emite
    // este evento al pulsar cualquier botón de fila. Casos soportados:
    //   - { action: "run-command", rawIndex }
    //   - { action: "open", mode, sessionId }
    //   - { action: "copy", mode, copyCommand }
    //   - { action: "delete", mode, sessionId, title }
    //   - { action: "load-more", mode }
    // Va aquí (bindGlobalListeners, una sola vez) y NO en bindDomListeners:
    // este último se re-ejecuta cada vez que el drawer remonta con un
    // terminal-container nuevo, y al ser un listener de `window` se iría
    // acumulando → cada acción del historial se dispararía 2×, 3×… ("se abre
    // dos veces").
    window.addEventListener("lxp-terminal:history-action", (async (event: Event) => {
      const detail = (event as CustomEvent<{
        action: string;
        mode?: string;
        sessionId?: string;
        rawIndex?: number;
        copyCommand?: string;
        title?: string;
        pageSize?: number;
      }>).detail;
      if (!detail) return;

      if (detail.action === "run-command" && typeof detail.rawIndex === "number") {
        const cmd = getHistory()[detail.rawIndex];
        if (!cmd) return;
        window.dispatchEvent(
          new CustomEvent("lxp-terminal:inject-command", {
            detail: { command: cmd, run: true },
          }),
        );
        return;
      }

      if (detail.action === "open") {
        const mode = detail.mode as Exclude<HistoryMode, "commands"> | undefined;
        if ((mode !== "codex" && mode !== "claude") || !detail.sessionId) return;
        loadConversationIntoNewTerminal(mode, detail.sessionId);
        return;
      }

      if (detail.action === "copy") {
        const cmd = detail.copyCommand ?? "";
        const copied = cmd ? await copyTextToClipboard(cmd) : false;
        if (copied) setStatus(I18N.status.codexCommandCopied, true);
        else void openAlert(I18N.errors.copyCommand, { variant: "danger" });
        return;
      }

      if (detail.action === "delete") {
        const mode = detail.mode as Exclude<HistoryMode, "commands"> | undefined;
        if ((mode !== "codex" && mode !== "claude") || !detail.sessionId) return;
        const title = detail.title || detail.sessionId;
        if (!await openConfirm(tI18n(I18N.confirm.deleteConversationMsg, { title }), { title: I18N.confirm.deleteConversationTitle, variant: "danger" })) return;
        const res = await api.delete<{ deleted: number }>("/api/terminal/conversations", {
          source: mode,
          sessionIds: [detail.sessionId],
        });
        if (!res.ok) {
          void openAlert(res.error || I18N.errors.deleteConversation, { variant: "danger" });
          return;
        }
        await loadConversationHistory(mode, true);
        return;
      }

      if (detail.action === "load-more") {
        const mode = detail.mode as HistoryMode | undefined;
        if (!mode) return;
        if (mode === "commands") {
          S.commandHistoryVisibleCount += Math.max(1, detail.pageSize ?? 10) * 2;
          renderHistoryPanel();
          return;
        }
        if (!getConversationPageState(mode).hasMore) return;
        await loadConversationHistory(mode, false, detail.pageSize ?? 10);
      }
    }) as EventListener);
  }

  async function runOneTimeInit(): Promise<void> {
    if (oneTimeInitDone) return;
    if (oneTimeInitPromise) return oneTimeInitPromise;
    oneTimeInitPromise = (async () => {
      ensureTerminalThemeSync();
      bindGlobalListeners();
      try {
        await loadTerminalPreferences();
      } catch (err) {
        console.error("[floating-terminal] loadTerminalPreferences", err);
      }
      try {
        await loadSnippetState();
        renderSnippetUI();
        applyShellHighlight(document.getElementById("snippet-list") ?? document);
      } catch (err) {
        console.error("[floating-terminal] loadSnippetState", err);
        S.snippetState = { categories: [], tags: [], snippets: [] };
        renderSnippetUI();
        applyShellHighlight(document.getElementById("snippet-list") ?? document);
      }
      renderHistoryFilters();
      renderHistoryPanel();
      setCategoryForm();
      setTagForm();
      oneTimeInitDone = true;
    })();
    return oneTimeInitPromise;
  }

  function bindDomListeners(termContainer: HTMLElement): void {
    if (lastBoundTermContainer === termContainer) return;
    lastBoundTermContainer = termContainer;

    document.getElementById("btn-new-tab")?.addEventListener("click", async () => {
      if (!await refreshStartupCli() || !terminalVisible()) return;
      S.tabCount++;
      const tabId = S.tabCount;
      const tabs = document.getElementById("tabs-container");
      if (tabs) tabs.appendChild(renderTab(tabId));
      const filesPath = (window as any).__filesCurrentPath || sessionStorage.getItem(FILES_CURRENT_PATH_KEY) || "/";
      createTerminal(tabId, { cdOnConnect: filesPath, initialCommand: getModeInitialCommand() });
      switchTab(tabId);
    });

    const mobileKeys = document.getElementById("lxp-terminal-mobilekeys");
    if (mobileKeys && !mobileKeys.dataset.bound) {
      mobileKeys.dataset.bound = "1";
      // Usamos pointerdown + preventDefault para no robar el foco al xterm: el
      // teclado virtual nativo se mantiene abierto al tocar las flechas.
      mobileKeys.addEventListener("pointerdown", (event) => {
        const target = (event.target as HTMLElement | null)?.closest("[data-tk]") as HTMLElement | null;
        if (!target) return;
        const key = target.dataset.tk ?? "";
        event.preventDefault();

        // CTRL/ALT son sticky: arman/desarman el modificador. No envían nada.
        if (key === "ctrl") {
          S.mobileKeyPendingCtrl = !S.mobileKeyPendingCtrl;
          setMobileKeyPressed(target, S.mobileKeyPendingCtrl);
          return;
        }
        if (key === "alt") {
          S.mobileKeyPendingAlt = !S.mobileKeyPendingAlt;
          setMobileKeyPressed(target, S.mobileKeyPendingAlt);
          return;
        }

        const seq = resolveMobileKeySequence(key);
        if (!seq) return;
        processTerminalInput(S.activeTabId, seq);
        clearMobileKeyModifiers();
        try { sessions.get(S.activeTabId)?.term.focus(); } catch { /* ignore */ }
      });
    }

    document.getElementById("btn-reconnect")?.addEventListener("click", () => {
      const session = sessions.get(S.activeTabId);
      if (session) {
        if (session.reconnectTimer) { clearTimeout(session.reconnectTimer); session.reconnectTimer = null; }
        session.reconnectAttempts = 0;
        session.cdOnConnect = session.cwd || (window as any).__filesCurrentPath || sessionStorage.getItem(FILES_CURRENT_PATH_KEY) || "/";
        session.initialCommand = session.startupCommand;
        session.ws?.close();
        session.term.write(`\r\n\x1b[33m${I18N.banner.reconnecting}\x1b[0m\r\n`);
        connectWs(S.activeTabId);
      }
    });

    // ── Reconexión al volver a primer plano (cambio de app en móvil) ──────────
    // Equivalente web del `AppState`-"active" de la app LP-LS. Al suspender el
    // WebView (el usuario abre otra app), el SO corta el socket; muchas veces
    // `onclose` NO dispara y el WS queda "zombi" (readyState OPEN pero muerto), o
    // el backoff de reconexión quedó congelado en segundo plano. Al reactivarse,
    // sondeamos cada sesión y forzamos una reconexión inmediata de las caídas: el
    // backend re-adjunta la MISMA sesión tmux (mismo `persistentSessionId`), así
    // que el shell/TUI sobrevive intacto.
    function reconnectNow(tabId: number): void {
      const s = sessions.get(tabId);
      if (!s) return;
      if (s.reconnectTimer) { clearTimeout(s.reconnectTimer); s.reconnectTimer = null; }
      s.reconnectAttempts = 0;
      s.endedNormally = false;
      s.awaitingPong = false;
      // Desconectar los handlers del socket viejo antes de cerrarlo para que su
      // `onclose` (code 1000) no pise el estado de la nueva conexión.
      const old = s.ws;
      if (old) {
        try { old.onopen = null; old.onmessage = null; old.onerror = null; old.onclose = null; } catch { /* ignore */ }
        try { old.close(); } catch { /* ignore */ }
        s.ws = null;
      }
      // tmux re-adjunta y re-pinta el scrollback; en modo legacy (sin tmux) se
      // restablece el cwd como hace el botón de reconectar manual.
      s.cdOnConnect = s.cwd || (window as any).__filesCurrentPath || sessionStorage.getItem(FILES_CURRENT_PATH_KEY) || "/";
      s.initialCommand = s.startupCommand;
      void connectWs(tabId);
    }

    function handleWake(): void {
      if (document.visibilityState === "hidden") return;
      for (const [tabId, s] of sessions) {
        if (s.endedNormally) continue; // salida intencional → no revivir
        const ws = s.ws;
        if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          reconnectNow(tabId);
          continue;
        }
        if (ws.readyState !== WebSocket.OPEN) continue; // CONNECTING → dejar que termine
        // Socket aparentemente vivo: puede ser un zombi. Mandamos un ping y, si no
        // llega `pong` (ni ningún otro mensaje) a tiempo, forzamos reconexión.
        s.awaitingPong = true;
        try {
          ws.send(JSON.stringify({ type: TerminalWsMsg.PING }));
        } catch {
          reconnectNow(tabId);
          continue;
        }
        setTimeout(() => {
          const cur = sessions.get(tabId);
          if (!cur || cur.endedNormally) return;
          if (cur.ws === ws && ws.readyState === WebSocket.OPEN && cur.awaitingPong) {
            reconnectNow(tabId);
          }
        }, 2500);
      }
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") handleWake();
    });
    window.addEventListener("pageshow", handleWake);
    window.addEventListener("focus", handleWake);
    window.addEventListener("online", handleWake);

    document.getElementById("btn-new-snippet")?.addEventListener("click", () => {
      openSnippetDialog();
    });

    document.getElementById("snippet-dialog-close")?.addEventListener("click", () =>
      (document.getElementById("dialog-snippet") as HTMLDialogElement).close()
    );
    document.getElementById("snippet-cancel")?.addEventListener("click", () =>
      (document.getElementById("dialog-snippet") as HTMLDialogElement).close()
    );

    document.getElementById("form-snippet")?.addEventListener("submit", (e) => {
      e.preventDefault();
      void (async () => {
        try {
          const editId = (document.getElementById("snippet-edit-id") as HTMLInputElement).value;
          const name = (document.getElementById("snippet-name") as HTMLInputElement).value.trim();
          const categoryId = Number((snippetStateRefs.categorySelect()?.value ?? "") || 0);
          const command = window.__lxpTerminalCommandEditor?.getValue().trim() ?? (document.getElementById("snippet-cmd") as HTMLTextAreaElement).value.trim();
          if (!categoryId) return;

          const payload = { name, categoryId, command, tagIds: S.snippetDialogTagIds.slice() };
          const result = editId
            ? await api.patch(`/api/terminal/snippets/${editId}`, payload)
            : await api.post("/api/terminal/snippets", payload);
          if (!result.ok) throw new Error(result.error || I18N.errors.saveSnippet);
          (document.getElementById("dialog-snippet") as HTMLDialogElement).close();
          await saveSnippetState();
        } catch (error) {
          console.error("[terminal snippets] save snippet failed", error);
          void openAlert(error instanceof Error ? error.message : I18N.errors.saveSnippet, { variant: "danger" });
        }
      })();
    });

    document.getElementById("category-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      void (async () => {
        try {
          const editId = (document.getElementById("category-edit-id") as HTMLInputElement).value;
          const name = (document.getElementById("category-name") as HTMLInputElement).value.trim();
          if (!name) return;

          if (editId) {
            await mutateSnippet(() => api.patch(`/api/terminal/snippets/categories/${editId}`, { name }));
          } else {
            await mutateSnippet(() => api.post("/api/terminal/snippets/categories", { name }));
          }
          resetCategoryForm();
        } catch (error) {
          console.error("[terminal snippets] save category failed", error);
          void openAlert(error instanceof Error ? error.message : I18N.errors.saveCategory, { variant: "danger" });
        }
      })();
    });

    document.getElementById("category-cancel")?.addEventListener("click", () => {
      resetCategoryForm();
    });

    document.getElementById("tag-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      void (async () => {
        try {
          const editId = (document.getElementById("tag-edit-id") as HTMLInputElement).value;
          const categoryId = Number(snippetStateRefs.settingsTagCategory()?.value ?? 0);
          const name = (document.getElementById("tag-name") as HTMLInputElement).value.trim();
          if (!categoryId || !name) return;

          if (editId) {
            await mutateSnippet(() => api.patch(`/api/terminal/snippets/tags/${editId}`, { categoryId, name }));
          } else {
            await mutateSnippet(() => api.post("/api/terminal/snippets/tags", { categoryId, name }));
          }
          resetTagForm();
        } catch (error) {
          console.error("[terminal snippets] save tag failed", error);
          void openAlert(error instanceof Error ? error.message : I18N.errors.saveTag, { variant: "danger" });
        }
      })();
    });

    document.getElementById("tag-cancel")?.addEventListener("click", () => {
      resetTagForm();
    });

    document.getElementById("snippet-search")?.addEventListener("input", () => {
      S.snippetPage = 0; // al cambiar el filtro, volver a la primera página
      renderSnippetList();
    });
    document.getElementById("snippet-cat")?.addEventListener("change", () => {
      S.snippetFilterTagIds = [];
      S.snippetPage = 0;
      renderSnippetUI();
    });
    snippetStateRefs.categorySelect()?.addEventListener("change", () => {
      S.snippetDialogTagIds = [];
      renderSnippetDialogTags();
    });

    document.getElementById("btn-clear-history")?.addEventListener("click", async () => {
      if (historyMode === "commands") {
        if (!await openConfirm(I18N.confirm.clearHistoryMsg, { title: I18N.confirm.clearHistoryTitle, variant: "danger" })) return;
        localStorage.removeItem(historyKey());
      } else {
        const selectedSessionIds = Array.from(selectedConversationIds[historyMode]);
        if (selectedSessionIds.length === 0) return;
        const countLabel = selectedSessionIds.length === 1
          ? I18N.confirm.deleteOneConversation
          : tI18n(I18N.confirm.deleteManyConversations, { count: selectedSessionIds.length });
        if (!await openConfirm(tI18n(I18N.confirm.deleteConversationsMsg, { label: countLabel }), { title: I18N.confirm.deleteConversationsTitle, variant: "danger" })) return;

        const res = await api.delete<{ deleted: number }>("/api/terminal/conversations", {
          source: historyMode,
          sessionIds: selectedSessionIds,
        });
        if (!res.ok) {
          void openAlert(res.error || I18N.errors.deleteConversations, { variant: "danger" });
          return;
        }
        selectedConversationIds[historyMode].clear();
        await loadConversationHistory(historyMode, true);
      }
      renderHistoryPanel();
    });

    document.getElementById("history-filters")?.addEventListener("click", async (event) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-history-mode]");
      const mode = target?.dataset.historyMode;
      if (mode !== "commands" && mode !== "codex" && mode !== "claude") return;

      setHistoryMode(mode);
      if (mode !== "commands") {
        if (!conversationHistory[mode].length && !getConversationPageState(mode).loading) await loadConversationHistory(mode, false);
      }
    });

    syncHistoryOrderControl();
    bindHistoryPreferencesControls();
    document.getElementById("s-terminal-font-size")?.addEventListener("change", (event) => {
      const value = Number((event.currentTarget as HTMLSelectElement).value);
      if (!Number.isInteger(value) || value < 11 || value > 20) return;
      S.fontSize = value;
      const scope = sessionStorage.getItem(TARGET_SCOPE_SESSION_KEY) || "local";
      sessions.forEach((session) => {
        if (session.targetScope !== scope) return;
        session.term.options.fontSize = value;
        try { session.fitAddon.fit(); } catch { /* hidden terminal */ }
        if (session.ws?.readyState === WebSocket.OPEN) {
          session.ws.send(JSON.stringify({ type: TerminalWsMsg.RESIZE, cols: session.term.cols, rows: session.term.rows }));
        }
      });
      void api.patch("/api/terminal/preferences", { fontSize: value });
    });

  }

  // ── Preflight de tmux ──────────────────────────────────────────────────────
  // El terminal usa tmux EN EL SERVIDOR OBJETIVO para persistir/re-adjuntar la
  // sesión tras un corte del WS (p. ej. el SO suspende el WebView al cambiar de
  // app). Si tmux no está, cada reconexión abre una shell nueva. Antes de crear
  // el primer terminal consultamos el estado; si falta, mostramos una tarjeta con
  // botón "Instalar tmux" (y opción de abrir sin persistencia) en vez de abrir en
  // silencio una sesión no persistente.
  interface TmuxStatus { installed: boolean; canInstall: boolean; packageManager: string | null; reason?: string }
  interface TmuxInstallResult { installed: boolean; output?: string; error?: string }
  let tmuxKnownInstalled = false;
  // Evita doble-montaje del terminal inicial: el preflight hace la creación
  // ASÍNCRONA (espera /tmux-status), así que dos llamadas a attachOrCreateTerminals
  // (eventos `lxp-terminal:init` + `:opened`) podían ver sessions.size===0 y crear
  // DOS terminales (dos WS con el mismo sessionId → churn y "Reintento N/8"). Este
  // flag serializa la creación inicial mientras el gate está en vuelo.
  let initialTerminalGateRunning = false;

  function createInitialTerminal(): void {
    if (sessions.has(1)) return; // idempotente: el terminal inicial ya existe
    S.tabCount = 1;
    S.activeTabId = 1;
    createTerminal(1, { initialCommand: getModeInitialCommand() });
    const initialTab = document.getElementById("tab-1");
    const tabs = document.getElementById("tabs-container");
    if (initialTab) initialTab.replaceWith(renderTab(1));
    else if (tabs) tabs.appendChild(renderTab(1));
    switchTab(1);
    syncLoadingOverlay();
    syncTerminalTheme();
  }

  function renderTmuxInstallCard(termContainer: HTMLElement, status: TmuxStatus): void {
    document.getElementById("lxp-tmux-gate")?.remove();
    const card = document.createElement("div");
    card.id = "lxp-tmux-gate";
    card.className =
      "absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background/95 px-6 text-center";
    card.innerHTML = `
      <div class="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
        <i class="ti ti-alert-triangle text-2xl"></i>
      </div>
      <div class="space-y-1">
        <p class="text-base font-semibold text-foreground">${escapeHtml(I18N.tmux.notInstalledTitle)}</p>
        <p class="max-w-md text-sm text-muted-foreground">
          ${I18N.tmux.explanation}
        </p>
      </div>
      <div class="flex flex-col items-center gap-2">
        ${status.canInstall
          ? `<button id="lxp-tmux-install" type="button" class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
               <i class="ti ti-download"></i> ${escapeHtml(I18N.tmux.install)}
             </button>`
          : `<p class="max-w-md text-xs font-medium text-amber-500">${escapeHtml(I18N.tmux.cannotInstall)}</p>`}
        <button id="lxp-tmux-skip" type="button" class="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">${escapeHtml(I18N.tmux.openWithoutPersistence)}</button>
      </div>
      <p id="lxp-tmux-gate-msg" class="min-h-[1rem] max-w-md text-xs text-destructive"></p>`;
    if (getComputedStyle(termContainer).position === "static") termContainer.style.position = "relative";
    termContainer.appendChild(card);

    const proceed = () => { card.remove(); createInitialTerminal(); };
    card.querySelector<HTMLElement>("#lxp-tmux-skip")?.addEventListener("click", proceed);

    const installBtn = card.querySelector<HTMLButtonElement>("#lxp-tmux-install");
    installBtn?.addEventListener("click", async () => {
      const msg = card.querySelector<HTMLElement>("#lxp-tmux-gate-msg");
      const original = installBtn.innerHTML;
      installBtn.disabled = true;
      installBtn.innerHTML = `<i class="ti ti-loader animate-spin"></i> ${escapeHtml(I18N.tmux.installing)}`;
      if (msg) msg.textContent = "";
      try {
        const res = await api.post<TmuxInstallResult>("/api/terminal/tmux-install", {});
        if (res.ok && res.data?.installed) {
          tmuxKnownInstalled = true;
          proceed();
          return;
        }
        if (msg) msg.textContent = res.data?.error || res.error || I18N.tmux.installFailed;
      } catch {
        if (msg) msg.textContent = I18N.tmux.networkError;
      }
      installBtn.disabled = false;
      installBtn.innerHTML = original;
    });
  }

  async function gateInitialTerminalOnTmux(termContainer: HTMLElement): Promise<void> {
    // Guardas anti doble-montaje: si ya hay sesión, o si otro gate está en vuelo
    // (esperando /tmux-status), NO crear un segundo terminal.
    if (sessions.size > 0 || initialTerminalGateRunning) return;
    initialTerminalGateRunning = true;
    try {
      document.getElementById("lxp-tmux-gate")?.remove();
      if (tmuxKnownInstalled) { createInitialTerminal(); return; }
      let status: TmuxStatus | null = null;
      try {
        const res = await api.get<TmuxStatus>("/api/terminal/tmux-status");
        if (res.ok && res.data) status = res.data;
      } catch { /* endpoint ausente / red: no bloquear */ }
      // Sin dato o ya instalado → abrir normal. (Backward-compatible: backend viejo
      // sin el endpoint → status null → abre igual.)
      if (!status || status.installed) {
        if (status?.installed) tmuxKnownInstalled = true;
        createInitialTerminal();
        return;
      }
      renderTmuxInstallCard(termContainer, status);
    } finally {
      initialTerminalGateRunning = false;
    }
  }

  async function attachOrCreateTerminals(): Promise<void> {
    const termContainer = document.getElementById("terminal-container");
    if (!termContainer) {
      requestAnimationFrame(() => { void attachOrCreateTerminals(); });
      return;
    }

    bindDomListeners(termContainer);

    if (sessions.size > 0) {
      const tabs = document.getElementById("tabs-container");
      if (tabs) tabs.innerHTML = "";
      sessions.forEach((s, tabId) => {
        s.container.style.display = tabId === S.activeTabId ? "block" : "none";
        if (s.container.parentElement !== termContainer) {
          termContainer.appendChild(s.container);
        }
        if (tabs) tabs.appendChild(renderTab(tabId));
        try { s.fitAddon.fit(); } catch { /* ignore */ }
      });
      const active = sessions.get(S.activeTabId);
      if (active?.ws?.readyState === WebSocket.OPEN) setStatus(I18N.status.connected, true);
      else setStatus(I18N.status.disconnected, false);
    } else {
      // Preflight de tmux antes de abrir el primer terminal. Si falta, muestra la
      // tarjeta de instalación; si está (o no se puede comprobar), crea el terminal.
      await gateInitialTerminalOnTmux(termContainer);
    }

    syncLoadingOverlay();
    syncTerminalTheme();
    try { ro.observe(termContainer); } catch { /* ignore */ }
  }

  // Eventos públicos del drawer (FloatingTerminalDrawer) ─────────────────────
  function terminalVisible(): boolean {
    const container = document.getElementById("terminal-container");
    if (!container) return false;
    const host = container.closest<HTMLElement>("#workspace-quick-drawer");
    return host ? host.dataset.open === "true" && host.dataset.module === "terminal" : container.getClientRects().length > 0;
  }
  function selectStartupSession(): void {
    if (!sessions.size) return;
    const scope = terminalTargetScope();
    const command = getModeInitialCommand();
    const active = sessions.get(S.activeTabId);
    if (active?.targetScope === scope && active.startupCommand === command && !active.endedNormally) return;
    for (const [tabId, session] of sessions) {
      if (session.targetScope === scope && session.startupCommand === command && !session.endedNormally) { switchTab(tabId); return; }
    }
    S.tabCount++;
    const tabId = S.tabCount;
    createTerminal(tabId, { initialCommand: command });
    document.getElementById("tabs-container")?.appendChild(renderTab(tabId));
    switchTab(tabId);
  }
  function startVisibleTerminal(): void {
    if (!terminalVisible()) return;
    void runOneTimeInit()
      .then(async () => {
        if (!await refreshStartupCli() || !terminalVisible()) return;
        await attachOrCreateTerminals();
        if (terminalVisible()) selectStartupSession();
      })
      .catch((error) => {
        console.error("[floating-terminal] init", error);
        oneTimeInitPromise = null;
        setStatus(I18N.status.disconnected, false);
      });
  }
  // Cached module views do not remount React when the drawer is reopened.
  const startupHostObserver = new MutationObserver(() => {
    const host = document.getElementById("workspace-quick-drawer");
    if (host?.dataset.open === "true" && host.dataset.module === "terminal") startVisibleTerminal();
  });
  function observeStartupHost(): void {
    startupHostObserver.disconnect();
    const host = document.getElementById("workspace-quick-drawer");
    if (host) startupHostObserver.observe(host, { attributes: true, attributeFilter: ["data-open", "data-module"] });
  }
  observeStartupHost();
  document.addEventListener("astro:after-swap", observeStartupHost);
  window.addEventListener("lxp-terminal:init", startVisibleTerminal);
  window.addEventListener("lxp-terminal:opened", startVisibleTerminal);

  // Bindings globales una sola vez (incluso antes de la primera apertura del
  // drawer) para capturar logout y eventos de path desde files.
  bindGlobalListeners();

  // React puede montar TerminalPanel antes de que este módulo termine de
  // evaluarse. Sus CustomEvents no se almacenan: si ya existe el contenedor,
  // recuperamos la apertura perdida sin crear una segunda sesión.
  if (document.getElementById("terminal-container")) startVisibleTerminal();
