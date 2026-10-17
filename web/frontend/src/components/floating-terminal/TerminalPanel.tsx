// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useRef, useState } from "react";

import { useBodyPointerEventsWhileOpen } from "@/lib/body-pointer-events";
import { useViewDirection, useViewEnterReplay } from "@/components/ui/ViewTransition";
import { ConfigPanel } from "./terminal-panel/ConfigPanel";
import { HistoryPanel } from "./terminal-panel/HistoryPanel";
import { MobileKeysBar } from "./terminal-panel/MobileKeysBar";
import {
  SIDEBAR_TABS,
  SIDEBAR_TAB_ICONS,
  STORAGE_KEY_SIDEBAR_TAB,
  readString,
  sidebarTabLabel,
  writeString,
} from "./terminal-panel/helpers";
import type {
  ConfigSubtab,
  SidebarTab,
  SnippetsSnapshot,
  TerminalPanelProps,
} from "./terminal-panel/types";
import { useKeyboardInset } from "./terminal-panel/use-keyboard-inset";
import { useTerminalCliState } from "./terminal-panel/use-terminal-cli-state";
import { useTerminalMessages } from "./terminal-panel/use-terminal-messages";

// Guard de "init una sola vez" compartido entre AMBAS instancias del panel
// (drawer flotante y vista de página): el JS vanilla del terminal sólo necesita
// el evento `lxp-terminal:init` la primera vez. Se resetea cuando se cierran
// todas las pestañas (`lxp-terminal:all-sessions-closed`).
let terminalInitDispatched = false;

/**
 * Contenido compartido del Terminal — único componente para los dos modos
 * (drawer flotante y vista de página). Monta el `#terminal-container` y demás
 * IDs que el JS vanilla (`floating-terminal.ts`, cargado globalmente desde
 * `FloatingTerminal.astro`) usa para re-alojar las sesiones xterm. Montar este
 * panel = "el terminal está visible": despacha `lxp-terminal:opened` para que el
 * vanilla traiga las sesiones a ESTE contenedor, y `lxp-terminal:closed` al
 * desmontar para devolverlas al pocket.
 */
export default function TerminalPanel({
  variant,
  locale,
  onClose,
  onRequestVisible,
  onLockedChange,
}: TerminalPanelProps) {
  const messages = useTerminalMessages(locale);
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = () => {
    if (!settingsDialog.current?.open) settingsDialog.current?.showModal();
    setSettingsOpen(true);
  };
  useEffect(() => {
    window.addEventListener("lxp-terminal:open-settings", openSettings);
    const trigger = document.getElementById("terminal-page-settings-trigger");
    trigger?.addEventListener("click", openSettings);
    return () => {
      window.removeEventListener("lxp-terminal:open-settings", openSettings);
      trigger?.removeEventListener("click", openSettings);
    };
  }, []);
  useBodyPointerEventsWhileOpen(settingsOpen);

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(() => {
    const stored = readString(STORAGE_KEY_SIDEBAR_TAB);
    return stored && (SIDEBAR_TABS as string[]).includes(stored)
      ? (stored as SidebarTab)
      : "snippets";
  });
  const [activeConfigTab, setActiveConfigTab] = useState<ConfigSubtab>("general");
  // Transición de vista entre tabs del panel lateral (snippets/historial):
  // direccional según SIDEBAR_TABS, reproducida sobre el contenedor
  // montado (las secciones alternan con display, no con montaje).
  const sidebarViewDirection = useViewDirection(sidebarTab, SIDEBAR_TABS);
  const sidebarViewRef = useViewEnterReplay<HTMLDivElement>(sidebarTab, sidebarViewDirection);
  // En móvil, este flag controla si el panel lateral (snippets/historial/
  // historial) está deslizado desde la derecha por encima del terminal.
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // <md (768px): el panel lateral es un overlay deslizante; sólo entonces se
  // marca `inert` al cerrarse (en ≥md siempre está visible en flujo).
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Mientras el panel lateral está deslizado por encima del terminal (overlay
  // `absolute z-40`), mantenemos el `body` interactivo (vaul deja
  // `body { pointer-events: none }` incluso con modal={false}). Inocuo en vista.
  useBodyPointerEventsWhileOpen(mobileSidebarOpen);

  const keyboardInset = useKeyboardInset();
  const keyboardOpen = keyboardInset > 0;

  // En móvil, al seleccionar un snippet o abrir una conversación del historial
  // queremos revelar el terminal: el panel lateral se ejecuta como overlay y,
  // si no lo cerramos, tapa la salida del comando recién lanzado.
  useEffect(() => {
    function closeSidebar() {
      setMobileSidebarOpen(false);
    }
    function handleHistoryAction(event: Event) {
      const action = (event as CustomEvent<{ action?: string }>).detail?.action;
      if (action === "open") closeSidebar();
    }
    window.addEventListener("lxp-terminal:inject-command", closeSidebar);
    window.addEventListener("lxp-terminal:history-action", handleHistoryAction as EventListener);
    return () => {
      window.removeEventListener("lxp-terminal:inject-command", closeSidebar);
      window.removeEventListener("lxp-terminal:history-action", handleHistoryAction as EventListener);
    };
  }, []);

  const [historySettingsContainer, setHistorySettingsContainer] = useState<HTMLDivElement | null>(null);
  const [snippetsSnapshot, setSnippetsSnapshot] = useState<SnippetsSnapshot>({
    categories: [],
    tags: [],
  });

  useEffect(() => {
    function handle(event: Event) {
      const detail = (event as CustomEvent<SnippetsSnapshot>).detail;
      if (!detail) return;
      const nextCategories = Array.isArray(detail.categories) ? detail.categories : [];
      const nextTags = Array.isArray(detail.tags) ? detail.tags : [];
      // Bail si el contenido es idéntico (evita invalidar useMemo/DataTables).
      setSnippetsSnapshot((prev) => {
        const sameCats =
          prev.categories.length === nextCategories.length &&
          prev.categories.every(
            (c, i) =>
              c.id === nextCategories[i].id && c.name === nextCategories[i].name,
          );
        const sameTags =
          prev.tags.length === nextTags.length &&
          prev.tags.every(
            (t, i) =>
              t.id === nextTags[i].id &&
              t.name === nextTags[i].name &&
              t.categoryId === nextTags[i].categoryId,
          );
        if (sameCats && sameTags) return prev;
        return { categories: nextCategories, tags: nextTags };
      });
    }
    window.addEventListener("lxp-terminal:snippets-changed", handle as EventListener);
    return () => {
      window.removeEventListener("lxp-terminal:snippets-changed", handle as EventListener);
    };
  }, []);

  useEffect(() => {
    writeString(STORAGE_KEY_SIDEBAR_TAB, sidebarTab);
    window.dispatchEvent(
      new CustomEvent("lxp-terminal:tab-changed", { detail: { tab: sidebarTab } }),
    );
  }, [sidebarTab]);

  const {
    stateError,
    installedEntries,
    availableToInstall,
    activeCli,
    handleInstall,
    handleSelectActive,
  } = useTerminalCliState({ onRequestVisible });

  // Ciclo de vida "montar = visible". Despacha init (una vez, compartido) +
  // opened para que el vanilla re-aloje las sesiones xterm en ESTE
  // `#terminal-container`; al desmontar despacha closed (mueve al pocket).
  useEffect(() => {
    if (!terminalInitDispatched) {
      terminalInitDispatched = true;
      window.dispatchEvent(new CustomEvent("lxp-terminal:init"));
    }
    window.dispatchEvent(
      new CustomEvent("lxp-terminal:opened", { detail: { tab: "console" } }),
    );
    window.dispatchEvent(
      new CustomEvent("lxp-terminal:tab-changed", { detail: { tab: "console" } }),
    );
    return () => {
      window.dispatchEvent(new CustomEvent("lxp-terminal:closed"));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleAllClosed() {
      terminalInitDispatched = false;
    }
    window.addEventListener("lxp-terminal:all-sessions-closed", handleAllClosed);
    return () => {
      window.removeEventListener("lxp-terminal:all-sessions-closed", handleAllClosed);
    };
  }, []);

  return (
    <>
      <div className="relative flex flex-1 overflow-hidden min-h-0">
        <section
          data-floating-terminal-panel="console"
          className="flex h-full min-w-0 flex-1 flex-col overflow-hidden md:basis-[70%] md:max-w-[70%]"
        >
          <div data-terminal-toolbar className="sticky top-0 z-20 flex shrink-0 items-center gap-0 border-b border-border bg-card/95 px-3 pt-2 pb-2 backdrop-blur-sm">
            <div
              id="tabs-container"
              role="tablist"
              aria-label={messages.pageTitle}
              className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div
                id="tab-1"
                role="tab"
                aria-selected="true"
                className="group relative flex max-w-56 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
              >
                <i className="ti ti-terminal-2 text-emerald-500 text-sm"></i>
                <span className="terminal-tab-label">{messages.console.firstTab}</span>
              </div>
            </div>
            <button
              id="btn-new-tab"
              type="button"
              className="ml-2 mb-0.5 shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={messages.console.newTab}
              aria-label={messages.console.newTab}
            >
              <i className="ti ti-plus text-sm"></i>
            </button>
            <button
              id="terminal-status"
              type="button"
              title={messages.console.connecting}
              aria-label={messages.console.connecting}
              aria-describedby="terminal-status-tooltip"
              className="group relative ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span data-terminal-status-dot aria-hidden="true" className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500"></span>
              <span id="terminal-status-tooltip" role="tooltip" className="pointer-events-none absolute right-0 top-full z-50 mt-2 hidden max-w-64 whitespace-normal rounded-lg border border-border bg-popover px-3 py-2 text-left text-xs text-popover-foreground shadow-lg group-hover:block group-focus:block">{messages.console.connecting}</span>
            </button>
            <button
              id="btn-reconnect"
              type="button"
              className="ml-2 hidden rounded-lg border border-primary/30 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
            >
              {messages.console.reconnect}
            </button>
            {variant === "drawer" && (
              <button type="button" onClick={openSettings} className="ml-2 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title={messages.sidebar.tabConfig} aria-label={messages.sidebar.tabConfig}>
                <i className="ti ti-settings text-base" aria-hidden="true"></i>
              </button>
            )}
            {variant === "drawer" && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="ml-2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={messages.console.closeDrawer}
                title={messages.console.closeDrawerTitle}
              >
                <i className="ti ti-chevron-down text-base"></i>
              </button>
            )}
          </div>
          <div
            id="terminal-container"
            className="flex-1 min-h-0 overflow-hidden bg-background"
          ></div>
        </section>

        {/* Panel lateral: en móvil es un panel fijo a la derecha que se desliza
            (translateX(100%)) con el estándar de movimiento del panel (200ms
            ease-out, como el colapso del sidebar izquierdo) en vez de
            `hidden`. En ≥md va siempre en flujo (30%). Cerrado en móvil →
            `inert` para sacarlo del tab-order. */}
        <aside
          data-mobile-open={mobileSidebarOpen ? "true" : "false"}
          inert={!mobileSidebarOpen && isNarrow}
          className={
            "absolute inset-y-0 right-0 z-40 flex h-full w-[88%] max-w-md flex-col border-l border-border bg-card shadow-2xl " +
            "md:relative md:inset-auto md:z-auto md:w-full md:max-w-[30%] md:basis-[30%] md:shadow-none " +
            "transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none " +
            "max-md:data-[mobile-open=false]:translate-x-full max-md:data-[mobile-open=false]:opacity-0 max-md:data-[mobile-open=false]:pointer-events-none"
          }
        >
          <div data-terminal-sidebar-tabs className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-2">
            {SIDEBAR_TABS.map((t) => (
              <button
                key={t}
                type="button"
                data-terminal-sidebar-tab={t}
                aria-pressed={sidebarTab === t}
                title={sidebarTabLabel(messages, t)}
                onClick={() => setSidebarTab(t)}
                className={
                  sidebarTab === t
                    ? "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors duration-200 ease-out"
                    : "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-200 ease-out hover:bg-accent hover:text-foreground"
                }
              >
                <i className={`ti ${SIDEBAR_TAB_ICONS[t]} text-sm`}></i>
                <span>{sidebarTabLabel(messages, t)}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
              aria-label={messages.sidebar.closePanel}
              title={messages.sidebar.closePanelTitle}
            >
              <i className="ti ti-x text-base"></i>
            </button>
          </div>
          {/* Las secciones permanecen montadas (DOM gobernado por scripts:
              #panel-snippets, historial…): la transición de vista se
              reproduce sobre este contenedor ya montado (motion.css). */}
          <div ref={sidebarViewRef} className="flex-1 overflow-hidden">
            <section
              data-floating-terminal-panel="snippets"
              className={
                sidebarTab === "snippets"
                  ? "flex h-full flex-col overflow-hidden"
                  : "hidden"
              }
            >
              <div
                id="panel-snippets"
                className="flex h-full min-h-0 flex-col overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {messages.snippets.heading}
                  </p>
                  <button
                    id="btn-new-snippet"
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title={messages.snippets.newSnippet}
                    aria-label={messages.snippets.newSnippet}
                  >
                    <i className="ti ti-plus text-sm"></i>
                    <span>{messages.snippets.newSnippet}</span>
                  </button>
                </div>
                <div className="space-y-2 border-b border-border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                      <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"></i>
                      <input
                        id="snippet-search"
                        type="text"
                        placeholder={messages.snippets.searchPlaceholder}
                        className="h-10 w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        aria-label={messages.snippets.searchAria}
                      />
                    </div>
                    <select
                      id="snippet-cat"
                      className="h-10 w-32 shrink-0 rounded-lg border border-input bg-background px-2 text-xs text-muted-foreground focus:border-primary focus:outline-none"
                      aria-label={messages.snippets.filterByCategoryAria}
                    >
                      <option value="">{messages.snippets.allCategories}</option>
                    </select>
                  </div>
                  <div id="snippet-tag-filters" className="flex flex-wrap gap-1.5"></div>
                </div>
                <div id="snippet-list" className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3"></div>
                <div id="snippet-pagination" className="shrink-0"></div>
              </div>
            </section>

            <section
              data-floating-terminal-panel="history"
              className={
                sidebarTab === "history"
                  ? "flex h-full flex-col overflow-hidden"
                  : "hidden"
              }
            >
              <div
                id="panel-history"
                className="flex h-full min-h-0 flex-col overflow-hidden"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <div
                    id="history-filters"
                    className="flex items-center gap-1 rounded-lg border border-border bg-background p-1"
                  ></div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      <span id="history-count">0</span>
                      <span id="history-count-label" className="ml-1">{messages.history.commandsLabel}</span>
                    </span>
                    <div ref={setHistorySettingsContainer} data-history-table-settings />
                    <button
                      id="btn-clear-history"
                      type="button"
                      className="text-xs text-muted-foreground transition-colors hover:text-destructive"
                      title={messages.history.clearHistory}
                      aria-label={messages.history.clearHistory}
                    >
                      <i className="ti ti-trash text-xs"></i>
                    </button>
                  </div>
                </div>
                <div id="history-list" className="flex-1 min-h-0 overflow-y-auto">
                  {sidebarTab === "history" ? <HistoryPanel messages={messages.history} settingsButtonContainer={historySettingsContainer} /> : null}
                </div>
              </div>
            </section>

          </div>
        </aside>

        {/* Backdrop semitransparente que cierra el panel lateral al tocar fuera.
            Sólo visible en móvil cuando el panel está abierto. */}
        <button
          type="button"
          aria-label={messages.sidebar.closePanel}
          aria-hidden={!mobileSidebarOpen}
          tabIndex={mobileSidebarOpen ? 0 : -1}
          onClick={() => setMobileSidebarOpen(false)}
          data-open={mobileSidebarOpen ? "true" : "false"}
          className="lxp-fade absolute inset-0 z-30 bg-black/40 md:hidden"
        />

        {stateError && (
          <div
            role="alert"
            className="pointer-events-none absolute bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive shadow"
          >
            {stateError}
          </div>
        )}
      </div>

      <dialog ref={settingsDialog} onClose={() => setSettingsOpen(false)} data-lxp-module-settings aria-label={messages.config.regionAria} className="border border-border bg-card p-0 text-foreground">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
          <div className="flex items-center gap-2"><i className="ti ti-settings text-primary" aria-hidden="true"></i><h2 className="text-base font-semibold">{messages.config.regionAria}</h2></div>
          <button type="button" onClick={() => settingsDialog.current?.close()} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={messages.sidebar.closePanel}><i className="ti ti-x text-lg" aria-hidden="true"></i></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ConfigPanel messages={messages} activeConfigTab={activeConfigTab} setActiveConfigTab={setActiveConfigTab} installedEntries={installedEntries} availableToInstall={availableToInstall} activeCli={activeCli} onSelectActive={handleSelectActive} onInstall={(entry) => {
            if (window.matchMedia("(max-width:1024px)").matches) settingsDialog.current?.close();
            void handleInstall(entry);
          }} snippetsSnapshot={snippetsSnapshot} />
        </div>
      </dialog>

      <MobileKeysBar
        messages={messages}
        sidebarTab={sidebarTab}
        setSidebarTab={setSidebarTab}
        mobileSidebarOpen={mobileSidebarOpen}
        setMobileSidebarOpen={setMobileSidebarOpen}
        keyboardOpen={keyboardOpen}
        keyboardInset={keyboardInset}
      />
    </>
  );
}
