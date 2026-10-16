// Floating terminal — command history + Codex/Claude conversation history,
// terminal preferences (theme + history-tab order), and resume-in-terminal.
import { S, sessions, HISTORY_PAGE_SIZE, DEFAULT_TERMINAL_THEME_CONFIG } from "./state";
import { I18N, tI18n } from "./i18n";
import { api } from "@/lib/api-client";
import { TARGET_SCOPE_SESSION_KEY } from "@/lib/api-client";
import { createTerminal } from "./terminal";
import { renderTab, switchTab } from "./tabs";
import { syncTerminalThemeControls, applyTerminalThemeToSessions } from "./theme";

  // ── Shared command history (localStorage ring buffer) ──────
  function historyKey(): string {
    const uid = document.getElementById("terminal-i18n")?.getAttribute("data-user-id") || "anonymous";
    let scope = "local";
    try { scope = sessionStorage.getItem(TARGET_SCOPE_SESSION_KEY) || "local"; } catch { /* unavailable */ }
    return `terminal-history:u${uid}:${scope}`;
  }
  const HISTORY_MAX = 200;

  type HistoryMode = "commands" | "codex" | "claude";
  const HISTORY_MODE_LABELS: Record<HistoryMode, string> = {
    commands: I18N.modeTerminal,
    codex: "Codex",
    claude: "Claude",
  };
  const DEFAULT_HISTORY_TAB_ORDER: HistoryMode[] = ["codex", "claude", "commands"];

  interface LoadedConversation {
    source: Exclude<HistoryMode, "commands">;
    sessionId: string;
    title: string;
    startedAt: number;
    updatedAt: number;
    entryCount: number;
    project?: string | null;
    preview: string;
    transcript: string;
  }

  interface ConversationHistoryResponse {
    codex: LoadedConversation[];
    claude: LoadedConversation[];
  }

  interface ConversationHistoryPageResponse {
    items: LoadedConversation[];
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  }

  interface ConversationHistoryPageState {
    loading: boolean;
    loadPromise: Promise<void> | null;
    error: string;
    total: number;
    hasMore: boolean;
    nextOffset: number;
  }

  let historyMode: HistoryMode = "commands";
  let lastHistoryMode: HistoryMode | null = null;
  let historyTabOrder: HistoryMode[] = [...DEFAULT_HISTORY_TAB_ORDER];
  let historyVisible:HistoryMode[]=[...DEFAULT_HISTORY_TAB_ORDER];
  let historyPreferencesLoaded=false;
  let historyPreferencesVersion=0;
  let historyPreferencesBound=false;
  let historyPreferencesScope="";
  S.commandHistoryVisibleCount = historyPageSize("commands") * 2;
  let conversationHistory: ConversationHistoryResponse = { codex: [], claude: [] };
  const createConversationPageState = (): ConversationHistoryPageState => ({
    loading: false,
    loadPromise: null,
    error: "",
    total: 0,
    hasMore: true,
    nextOffset: 0,
  });
  let conversationHistoryMeta: Record<Exclude<HistoryMode, "commands">, ConversationHistoryPageState> = {
    codex: createConversationPageState(),
    claude: createConversationPageState(),
  };
  let historyOrderSaveTimer: ReturnType<typeof setTimeout> | null = null;
  let historyOrderSaveInFlight = false;
  let historyOrderSaveQueued = false;
  const selectedConversationIds: Record<Exclude<HistoryMode, "commands">, Set<string>> = {
    codex: new Set<string>(),
    claude: new Set<string>(),
  };

  function getHistory(): string[] {
    try { const value = JSON.parse(localStorage.getItem(historyKey()) ?? "[]"); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }

  function pushHistory(cmd: string) {
    cmd = cmd.trim();
    if (!cmd) return;
    const hist = getHistory().filter((c) => c !== cmd);
    hist.push(cmd);
    if (hist.length > HISTORY_MAX) hist.splice(0, hist.length - HISTORY_MAX);
    localStorage.setItem(historyKey(), JSON.stringify(hist));
  }

  function getConversationPageState(mode: Exclude<HistoryMode, "commands">): ConversationHistoryPageState {
    return conversationHistoryMeta[mode];
  }

  function resetConversationHistoryMode(mode: Exclude<HistoryMode, "commands">): void {
    conversationHistory[mode] = [];
    conversationHistoryMeta[mode] = createConversationPageState();
  }

  function historyPageSize(mode: HistoryMode): number {
    try { const size=JSON.parse(localStorage.getItem(`lxp:data-table:prefs:terminal-history-${mode}`) ?? "{}").pageSize;return [10,25,50,100].includes(size) ? size : HISTORY_PAGE_SIZE; } catch {return HISTORY_PAGE_SIZE;}
  }
  async function loadConversationHistory(mode: Exclude<HistoryMode, "commands">, reset = false, pageSize = historyPageSize(mode)): Promise<void> {
    if (reset) {
      resetConversationHistoryMode(mode);
    }

    const pageState = getConversationPageState(mode);
    if (pageState.loadPromise) return pageState.loadPromise;
    if (!pageState.hasMore && pageState.nextOffset > 0) return Promise.resolve();

    pageState.loadPromise = (async () => {
      pageState.loading = true;
      pageState.error = "";

      const scope = sessionStorage.getItem(TARGET_SCOPE_SESSION_KEY) || "local";
      const current = () => getConversationPageState(mode) === pageState && scope === (sessionStorage.getItem(TARGET_SCOPE_SESSION_KEY) || "local");
      const batchEnd = pageState.nextOffset + Math.max(1, pageSize) * 2;
      renderHistoryPanel();
      try {
        do {
        const res = await api.get<ConversationHistoryPageResponse>("/api/terminal/conversations", {
          params: {
            source: mode,
            offset: pageState.nextOffset,
            limit: Math.min(100, batchEnd - pageState.nextOffset),
          },
        });

        if (!current()) return;
        if (!res.ok || !res.data) {
          throw new Error(res.error || I18N.errors.loadConversations);
        }

        const items = Array.isArray(res.data.items) ? res.data.items : [];
        const unique = new Map((pageState.nextOffset === 0 ? [] : conversationHistory[mode]).map(item => [item.sessionId, item]));
        for (const item of items) unique.set(item.sessionId, item);
        conversationHistory[mode] = [...unique.values()];
        pageState.total = Number(res.data.total ?? conversationHistory[mode].length) || conversationHistory[mode].length;
        pageState.hasMore = Boolean(res.data.hasMore ?? conversationHistory[mode].length < pageState.total);
        pageState.nextOffset = Number(res.data.offset ?? pageState.nextOffset) + items.length;
        if (items.length === 0) pageState.hasMore = false;
        } while (pageState.hasMore && pageState.nextOffset < batchEnd);
      } catch (error) {
        console.error("[terminal history]", error);
        if (current()) pageState.error = error instanceof Error ? error.message : I18N.errors.loadConversations;
      } finally {
        pageState.loading = false;
        pageState.loadPromise = null;
      }

      if (current()) renderHistoryPanel();
      // Loading follows the last visible DataTable page; scroll never triggers it.
      // Auto-load deshabilitado: el usuario decide cuándo cargar más
      // resultados desde el botón del DataTable de React.
    })();

    return pageState.loadPromise;
  }

  function getConversationList(mode: Exclude<HistoryMode, "commands">): LoadedConversation[] {
    return conversationHistory[mode];
  }

  function getSelectedConversationCount(mode = historyMode): number {
    if (mode === "commands") return 0;
    return selectedConversationIds[mode].size;
  }

  function getHistoryCountLabel(): string {
    return historyMode === "commands"
      ? I18N.countCommands
      : tI18n(I18N.countConversations, { cli: HISTORY_MODE_LABELS[historyMode] });
  }

  function getDefaultHistoryMode(): HistoryMode {
    return historyTabOrder.find(mode=>historyVisible.includes(mode)) ?? "commands";
  }

  function getVisibleCommandHistory(): string[] {
    return getHistory().slice().reverse().slice(0, S.commandHistoryVisibleCount);
  }

  function maybeLoadMoreHistoryIfNeeded(mode = historyMode): void {
    const listEl = document.getElementById("history-list");
    if (!listEl) return;

    const nearBottom = listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 24;
    if (!nearBottom) return;

    if (mode === "commands") {
      const total = getHistory().length;
      if (S.commandHistoryVisibleCount >= total) return;
      S.commandHistoryVisibleCount = Math.min(total, S.commandHistoryVisibleCount + historyPageSize("commands") * 2);
      renderHistoryPanel();
      return;
    }

    const pageState = getConversationPageState(mode);
    if (pageState.loading || !pageState.hasMore) return;
    void loadConversationHistory(mode);
  }

  function normalizeHistoryTabOrder(value: unknown): HistoryMode[] {
    const candidates = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(",").map((item) => item.trim())
        : [];

    const seen = new Set<HistoryMode>();
    const order: HistoryMode[] = [];
    for (const candidate of candidates) {
      if (candidate === "commands" || candidate === "codex" || candidate === "claude") {
        if (!seen.has(candidate)) {
          seen.add(candidate);
          order.push(candidate);
        }
      }
    }

    for (const mode of DEFAULT_HISTORY_TAB_ORDER) {
      if (!seen.has(mode)) order.push(mode);
    }

    return order;
  }

  function syncHistoryOrderControl(): void {
    window.dispatchEvent(new CustomEvent("lxp-terminal:history-preferences",{detail:{order:historyTabOrder,visible:historyVisible,busy:!historyPreferencesLoaded}}));
  }

  function bindHistoryPreferencesControls():void {
    if(historyPreferencesBound)return;
    historyPreferencesBound=true;
    window.addEventListener("lxp-terminal:history-preferences-request",syncHistoryOrderControl);
    window.addEventListener("lxp-terminal:history-preferences-change",(event:Event)=>{
      const detail=(event as CustomEvent).detail;
      if(!historyPreferencesLoaded||historyPreferencesScope!==(sessionStorage.getItem(TARGET_SCOPE_SESSION_KEY)||"local")||!detail||!Array.isArray(detail.order)||!Array.isArray(detail.visible))return;
      const nextVisible=detail.visible.filter((id:unknown):id is HistoryMode=>id==="commands"||id==="codex"||id==="claude");
      if(!nextVisible.length||new Set(nextVisible).size!==nextVisible.length)return;
      historyTabOrder=normalizeHistoryTabOrder(detail.order);historyVisible=nextVisible;historyPreferencesVersion++;
      if(!historyVisible.includes(historyMode))historyMode=getDefaultHistoryMode();
      lastHistoryMode=null;renderHistoryPanel();syncHistoryOrderControl();scheduleHistoryOrderSave();
    });
  }

  async function loadTerminalPreferences(): Promise<void> {
    const scopeBefore=sessionStorage.getItem(TARGET_SCOPE_SESSION_KEY)||"local";
    const versionBefore=++historyPreferencesVersion;
    if(historyOrderSaveTimer){clearTimeout(historyOrderSaveTimer);historyOrderSaveTimer=null;}
    historyOrderSaveQueued=false;
    if(historyPreferencesScope!==scopeBefore){historyTabOrder=[...DEFAULT_HISTORY_TAB_ORDER];historyVisible=[...DEFAULT_HISTORY_TAB_ORDER];}
    historyPreferencesScope=scopeBefore;
    historyPreferencesLoaded=false;syncHistoryOrderControl();
    let loaded=false,loadError="";
    try {
      const res = await api.get<{ fontSize: number; historyOrder: HistoryMode[];historyVisible?:HistoryMode[] }>("/api/terminal/preferences");
      if(scopeBefore!==(sessionStorage.getItem(TARGET_SCOPE_SESSION_KEY)||"local")||versionBefore!==historyPreferencesVersion)return;
      if (res.ok && res.data) {
        loaded=true;
        historyTabOrder = normalizeHistoryTabOrder(res.data.historyOrder);
        historyVisible=Array.isArray(res.data.historyVisible)&&res.data.historyVisible.length?res.data.historyVisible.filter(id=>DEFAULT_HISTORY_TAB_ORDER.includes(id)):[...DEFAULT_HISTORY_TAB_ORDER];
        if(!historyVisible.length)historyVisible=[...DEFAULT_HISTORY_TAB_ORDER];
        S.fontSize = Number.isInteger(res.data.fontSize) && res.data.fontSize >= 11 && res.data.fontSize <= 20 ? res.data.fontSize : 13;
        const scope = sessionStorage.getItem(TARGET_SCOPE_SESSION_KEY) || "local";
        sessions.forEach((session) => {
          if (session.targetScope !== scope) return;
          session.term.options.fontSize = S.fontSize;
          try { session.fitAddon.fit(); } catch { /* hidden terminal */ }
        });
        // Tema xterm fijo en "default" — la UI de personalización fue retirada.
        S.terminalThemeConfig = structuredClone(DEFAULT_TERMINAL_THEME_CONFIG);
        lastHistoryMode = null;
      } else loadError=res.error||I18N.errors.loadConversations;
    } catch (error) {
      console.error("[terminal preferences]", error);
      loadError=error instanceof Error?error.message:I18N.errors.loadConversations;
    } finally {
      if(scopeBefore!==(sessionStorage.getItem(TARGET_SCOPE_SESSION_KEY)||"local")||versionBefore!==historyPreferencesVersion)return;
      historyPreferencesLoaded=loaded;
      if(!historyVisible.includes(historyMode))historyMode=getDefaultHistoryMode();
      renderHistoryPanel();
      syncHistoryOrderControl();
      if(loadError)window.dispatchEvent(new CustomEvent("lxp-terminal:history-preferences",{detail:{error:loadError,busy:true}}));
      const fontSelect = document.getElementById("s-terminal-font-size") as HTMLSelectElement | null;
      if (fontSelect) fontSelect.value = String(S.fontSize);
      syncTerminalThemeControls();
      applyTerminalThemeToSessions();
    }
  }

  function scheduleHistoryOrderSave(immediate = false): void {
    if (historyOrderSaveTimer) {
      clearTimeout(historyOrderSaveTimer);
      historyOrderSaveTimer = null;
    }

    if (immediate) {
      void saveHistoryOrder();
      return;
    }

    historyOrderSaveTimer = setTimeout(() => {
      historyOrderSaveTimer = null;
      void saveHistoryOrder();
    }, 400);
  }

  async function saveHistoryOrder(): Promise<void> {
    if(!historyPreferencesLoaded||historyPreferencesScope!==(sessionStorage.getItem(TARGET_SCOPE_SESSION_KEY)||"local"))return;
    if (historyOrderSaveInFlight) {
      historyOrderSaveQueued = true;
      return;
    }

    historyOrderSaveInFlight = true;
    const scopeBefore=sessionStorage.getItem(TARGET_SCOPE_SESSION_KEY)||"local",version=historyPreferencesVersion;
    try {
      lastHistoryMode = null;
      if (!historyVisible.includes(historyMode)) {
        historyMode = getDefaultHistoryMode();
      }
      renderHistoryPanel();

      const res = await api.patch<any>("/api/terminal/preferences", { historyOrder: historyTabOrder, historyVisible });
      if(scopeBefore!==(sessionStorage.getItem(TARGET_SCOPE_SESSION_KEY)||"local")||version!==historyPreferencesVersion)return;
      if (!res.ok) {
        console.error("[terminal preferences]", res.error ?? "No se pudo guardar el orden del historial");
        window.dispatchEvent(new CustomEvent("lxp-terminal:history-preferences",{detail:{error:res.error||I18N.errors.loadConversations,busy:false}}));
      }
    } catch(error) {
      if(scopeBefore===(sessionStorage.getItem(TARGET_SCOPE_SESSION_KEY)||"local")&&version===historyPreferencesVersion)
        window.dispatchEvent(new CustomEvent("lxp-terminal:history-preferences",{detail:{error:error instanceof Error?error.message:I18N.errors.loadConversations,busy:false}}));
    } finally {
      historyOrderSaveInFlight = false;
      if (historyOrderSaveQueued) {
        historyOrderSaveQueued = false;
        void saveHistoryOrder();
      }
    }
  }

  function renderHistoryFilters(): void {
    const wrap = document.getElementById("history-filters");
    if (!wrap) return;

    wrap.setAttribute("role","tablist");
    wrap.innerHTML = historyTabOrder.filter(mode=>historyVisible.includes(mode))
      .map((mode) => {
        const active = historyMode === mode;
        return `
          <button
            type="button"
            role="tab" aria-selected="${active}" tabindex="${active?0:-1}"
            data-history-mode="${mode}"
            class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}">
            ${HISTORY_MODE_LABELS[mode]}
          </button>
        `;
      })
      .join("");
  }

  function updateHistoryFilterButtons(): void {
    const buttons = document.querySelectorAll<HTMLButtonElement>("#history-filters [data-history-mode]");
    buttons.forEach((button) => {
      const active = button.dataset.historyMode === historyMode;
      button.setAttribute("aria-selected",String(active));button.tabIndex=active?0:-1;
      button.className = active
        ? "rounded-md px-2.5 py-1 text-xs font-medium transition-colors bg-primary/10 text-primary"
        : "rounded-md px-2.5 py-1 text-xs font-medium transition-colors text-muted-foreground hover:text-foreground";
    });
  }

  function updateHistoryActionButtons(): void {
    const countLabel = document.getElementById("history-count-label");
    const loadBtn = document.getElementById("btn-load-selected") as HTMLButtonElement | null;
    const clearBtn = document.getElementById("btn-clear-history");

    if (countLabel) countLabel.textContent = getHistoryCountLabel();

    if (loadBtn) {
      loadBtn.classList.add("hidden");
      loadBtn.disabled = true;
    }
    if (clearBtn) {
      const isCommands = historyMode === "commands";
      clearBtn.classList.toggle("hidden", !isCommands);
      clearBtn.setAttribute("title", isCommands ? I18N.confirm.clearHistoryTitle : I18N.confirm.deleteConversationTitle);
      clearBtn.setAttribute("aria-label", isCommands ? I18N.confirm.clearHistoryTitle : I18N.confirm.deleteConversationTitle);
    }
  }

  function renderHistoryPanel(): void {
    const countEl = document.getElementById("history-count");
    if (!countEl) return;

    renderHistoryFilters();
    updateHistoryFilterButtons();
    updateHistoryActionButtons();

    // React es ahora dueño del render del listado de historial (DataTable
    // con favoritos). Aquí sólo emitimos eventos con los datos brutos y
    // actualizamos el contador.
    if (historyMode === "commands") {
      const hist = getHistory().slice().reverse();
      const visibleHist = hist.slice(0, S.commandHistoryVisibleCount);
      countEl.textContent = hist.length > visibleHist.length ? `${visibleHist.length} / ${hist.length}` : String(visibleHist.length);

      const items = visibleHist.map((cmd, i) => ({
        id: `cmd-${hist.length - 1 - i}`,          // estable: índice en getHistory()
        rawIndex: hist.length - 1 - i,
        command: cmd,
      }));
      window.dispatchEvent(
        new CustomEvent("lxp-terminal:history-data", {
          detail: {
            mode: "commands",
            items,
            total: hist.length,
            visible: visibleHist.length,
            hasMore: visibleHist.length < hist.length,
            loading: false,
            error: null,
          },
        }),
      );
      // Antes hacíamos auto-load aquí vía requestAnimationFrame, pero con el
      // listado en React el `nearBottom` siempre era true (el div mount no
      // reporta scrollHeight real hasta que React commitea), causando un
      // bucle de eventos que congelaba el navegador. Ahora el usuario carga
      // más usando el botón "Cargar más" del DataTable.
      return;
    }

    const entries = getConversationList(historyMode);
    const pageState = getConversationPageState(historyMode);
    countEl.textContent = pageState.total > entries.length ? `${entries.length} / ${pageState.total}` : String(entries.length);

    const items = entries.map((conversation) => ({
      id: `${historyMode}-${conversation.sessionId}`,
      sessionId: conversation.sessionId,
      title: conversation.title || conversation.sessionId,
      project: conversation.project ?? "",
      source: conversation.source,
      entryCount: conversation.entryCount,
      preview: conversation.preview,
      copyCommand: conversation.source === "codex" ? buildConversationResumeCommand(conversation) : "",
    }));

    window.dispatchEvent(
      new CustomEvent("lxp-terminal:history-data", {
        detail: {
          mode: historyMode,
          items,
          total: pageState.total,
          visible: entries.length,
          hasMore: pageState.hasMore,
          loading: pageState.loading,
          error: pageState.error ?? null,
        },
      }),
    );
    // Auto-load deshabilitado: usar el botón "Cargar más" del DataTable.
  }

  function setHistoryMode(mode: HistoryMode): void {
    if(!historyVisible.includes(mode))return;
    historyMode = mode;
    lastHistoryMode = mode;
    if (mode !== "commands" && !conversationHistory[mode].length && !getConversationPageState(mode).loading) {
      void loadConversationHistory(mode);
    }
    renderHistoryPanel();
  }

  function toggleConversationSelection(mode: Exclude<HistoryMode, "commands">, sessionId: string): void {
    const selection = selectedConversationIds[mode];
    if (selection.has(sessionId)) selection.delete(sessionId);
    else selection.add(sessionId);

    if (historyMode === mode) renderHistoryPanel();
    else updateHistoryActionButtons();
  }

  function shellQuote(value: string): string {
    if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) return value;
    const escaped = value.replaceAll("'", `'\"'\"'`);
    return `'${escaped}'`;
  }

  function buildConversationResumeCommand(conversation: LoadedConversation): string {
    const sessionId = shellQuote(conversation.sessionId);
    return conversation.source === "codex"
      ? `codex resume --no-alt-screen ${sessionId}`
      : `claude --resume ${sessionId}`;
  }

  async function copyTextToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fall through to the legacy clipboard path.
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }

  // La "terminal por defecto" es una sesión shell (sin `initialCommand` de
  // CLI). Snippets, historial de comandos y reanudar conversaciones SIEMPRE
  // corren aquí: nunca en una pestaña CLI (Codex/Claude) que pueda estar
  // arrancando (overlay "Preparando consola opencode...").
  function getDefaultTerminalTabId(): number | null {
    const active = sessions.get(S.activeTabId);
    const scope = sessionStorage.getItem(TARGET_SCOPE_SESSION_KEY) || "local";
    if (active && active.targetScope === scope && !active.startupCommand) return S.activeTabId;
    for (const [tabId, session] of sessions) {
      if (session.targetScope === scope && !session.startupCommand) return tabId;
    }
    return null;
  }

  function ensureDefaultTerminalTab(): number {
    const existing = getDefaultTerminalTabId();
    if (existing !== null) {
      if (existing !== S.activeTabId) switchTab(existing);
      return existing;
    }
    // No hay shell disponible (p.ej. sólo hay pestañas CLI): crea una.
    S.tabCount++;
    const tabId = S.tabCount;
    createTerminal(tabId, { initialCommand: null });
    const tabs = document.getElementById("tabs-container");
    if (tabs) tabs.appendChild(renderTab(tabId));
    switchTab(tabId);
    return tabId;
  }

  function openConversationInNewTerminal(conversation: LoadedConversation): void {
    // Reanudar SIEMPRE en la terminal por defecto (shell) en vez de abrir una
    // pestaña CLI nueva: evita el doble arranque y que la consola quede
    // atascada en "Preparando consola opencode".
    const resume = buildConversationResumeCommand(conversation);
    const projectPath = conversation.project || null;
    const command = projectPath ? `cd ${shellQuote(projectPath)} && ${resume}` : resume;
    window.dispatchEvent(
      new CustomEvent("lxp-terminal:inject-command", {
        detail: { command, run: true },
      }),
    );
  }

  function loadConversationIntoNewTerminal(mode: Exclude<HistoryMode, "commands">, sessionId: string): void {
    const conversation = getConversationList(mode).find((entry) => entry.sessionId === sessionId);
    if (!conversation) return;

    selectedConversationIds[mode].clear();
    selectedConversationIds[mode].add(sessionId);
    if (historyMode === mode) renderHistoryPanel();
    else updateHistoryActionButtons();
    openConversationInNewTerminal(conversation);
  }

  function loadSelectedConversationsIntoTerminal(): void {
    if (historyMode === "commands") return;
    const selectedSessionIds = Array.from(selectedConversationIds[historyMode]);
    if (selectedSessionIds.length !== 1) return;
    loadConversationIntoNewTerminal(historyMode, selectedSessionIds[0]);
  }

  // setSidebarTab eliminado: las pestañas Consola/Snippets/Historial/Configuración
  // son controladas por el componente React FloatingTerminalDrawer. Conservamos sólo
  // el efecto lateral relevante (asegurar el modo correcto al activar "Historial").
  function handleDrawerTabChanged(tab: string): void {
    if (tab === "history") {
      setHistoryMode(lastHistoryMode ?? getDefaultHistoryMode());
    }
  }

  (window as any).runHistory = (idx: number) => {
    const hist = getHistory();
    const cmd = hist[idx];
    if (!cmd) return;
    window.dispatchEvent(
      new CustomEvent("lxp-terminal:inject-command", {
        detail: { command: cmd, run: true },
      }),
    );
  };

  (window as any).toggleConversationSelection = toggleConversationSelection;

export {
  getHistory,
  pushHistory,
  loadConversationHistory,
  getConversationPageState,
  renderHistoryPanel,
  renderHistoryFilters,
  setHistoryMode,
  getDefaultHistoryMode,
  loadTerminalPreferences,
  ensureDefaultTerminalTab,
  loadConversationIntoNewTerminal,
  copyTextToClipboard,
  scheduleHistoryOrderSave,
  syncHistoryOrderControl,
  bindHistoryPreferencesControls,
  handleDrawerTabChanged,
  historyKey,
  selectedConversationIds,
  historyMode,
  conversationHistory,
};
export type { HistoryMode };
