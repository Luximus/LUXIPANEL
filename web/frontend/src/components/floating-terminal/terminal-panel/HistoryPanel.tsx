// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useCallback, useEffect, useMemo, useState } from "react";

import DataTable, { type DataTableColumnConfig } from "@/components/ui/DataTable";
import { formatMessage } from "@/i18n/client";
import type { TerminalMessages } from "../i18n";
import { HISTORY_MODE_KEYS, type HistoryMode } from "./helpers";

interface HistoryCommandItem {
  id: string;
  rawIndex: number;
  command: string;
}

interface HistoryConversationItem {
  id: string;
  sessionId: string;
  title: string;
  project: string;
  source: "codex" | "claude";
  entryCount: number;
  preview: string;
  copyCommand: string;
}

type HistoryPayload =
  | {
      mode: "commands";
      items: HistoryCommandItem[];
      total: number;
      visible: number;
      hasMore: boolean;
      loading: boolean;
      error: string | null;
    }
  | {
      mode: "codex" | "claude";
      items: HistoryConversationItem[];
      total: number;
      visible: number;
      hasMore: boolean;
      loading: boolean;
      error: string | null;
    };

const HISTORY_FAVORITES_KEY = "lxp.terminal.history.favorites";

function loadHistoryFavorites(): Record<HistoryMode, Set<string>> {
  // Same shape for an empty record and the parsed one: built once via the
  // shared key list so adding a new CLI to HISTORY_CLIS automatically flows
  // through here.
  const fromRecord = (raw: Partial<Record<HistoryMode, string[]>>) =>
    Object.fromEntries(HISTORY_MODE_KEYS.map((k) => [k, new Set(raw[k] ?? [])])) as Record<
      HistoryMode,
      Set<string>
    >;
  if (typeof window === "undefined") return fromRecord({});
  try {
    const raw = window.localStorage.getItem(HISTORY_FAVORITES_KEY);
    if (!raw) return fromRecord({});
    return fromRecord(JSON.parse(raw) as Partial<Record<HistoryMode, string[]>>);
  } catch {
    return fromRecord({});
  }
}

function persistHistoryFavorites(favorites: Record<HistoryMode, Set<string>>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      HISTORY_FAVORITES_KEY,
      JSON.stringify(
        Object.fromEntries(HISTORY_MODE_KEYS.map((k) => [k, Array.from(favorites[k])])),
      ),
    );
  } catch {
    /* ignore quota errors */
  }
}

function dispatchHistoryAction(detail: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("lxp-terminal:history-action", { detail }),
  );
}

const HISTORY_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const HISTORY_COMMANDS_RENDER_CELL = {
  command: (row: Record<string, unknown>) => (
    <code className="block truncate font-mono text-[11px] text-muted-foreground">
      {String(row.command ?? "")}
    </code>
  ),
};

function StarBtn({
  active,
  onToggle,
  messages,
}: {
  active: boolean;
  onToggle: () => void;
  messages: TerminalMessages["history"];
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`rounded-md p-1 transition-colors ${
        active ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground hover:text-foreground"
      }`}
      title={active ? messages.star.removeFavoriteTitle : messages.star.addFavoriteTitle}
      aria-label={active ? messages.star.removeFavoriteAria : messages.star.addFavoriteAria}
      aria-pressed={active}
    >
      <i className={`ti ${active ? "ti-star-filled" : "ti-star"} text-sm`} />
    </button>
  );
}

export function HistoryPanel({ messages, settingsButtonContainer }: { messages: TerminalMessages["history"]; settingsButtonContainer?: HTMLElement | null }) {
  // Columnas estables — memoizadas por etiqueta para no re-disparar el
  // `useEffect [columns]` interno del DataTable salvo que cambie el idioma.
  const HISTORY_COMMANDS_COLUMNS = useMemo<DataTableColumnConfig[]>(
    () => [
      { id: "command", header: messages.colCommand, accessorKey: "command", sortable: false, hideable: false },
    ],
    [messages.colCommand],
  );
  const HISTORY_CONVERSATIONS_COLUMNS = useMemo<DataTableColumnConfig[]>(
    () => [
      { id: "title", header: messages.colTitle, accessorKey: "title", sortable: false, hideable: false },
      { id: "project", header: messages.colProject, accessorKey: "project", sortable: false, hideable: true },
      { id: "entryCount", header: messages.colMessages, accessorKey: "entryCount", sortable: true, hideable: true },
    ],
    [messages.colTitle, messages.colProject, messages.colMessages],
  );
  // Un payload por modo: cuando el script vanilla emite uno, sólo refresca el
  // modo activo; los demás conservan los datos previos sin parpadear.
  const [payloads, setPayloads] = useState<Partial<Record<HistoryMode, HistoryPayload>>>({});
  const [favorites, setFavorites] = useState<Record<HistoryMode, Set<string>>>(() => loadHistoryFavorites());
  const [activeMode, setActiveMode] = useState<HistoryMode>("commands");

  useEffect(() => {
    function handle(event: Event) {
      const detail = (event as CustomEvent<HistoryPayload>).detail;
      if (!detail || !detail.mode) return;
      setPayloads((prev) => ({ ...prev, [detail.mode]: detail }));
      setActiveMode(detail.mode);
    }
    window.addEventListener("lxp-terminal:history-data", handle as EventListener);
    return () => window.removeEventListener("lxp-terminal:history-data", handle as EventListener);
  }, []);

  const toggleFavorite = useCallback((mode: HistoryMode, id: string) => {
    setFavorites((prev) => {
      const nextSet = new Set(prev[mode]);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      const next = { ...prev, [mode]: nextSet };
      persistHistoryFavorites(next);
      return next;
    });
  }, []);

  const payload = payloads[activeMode] ?? null;
  const favs = favorites[activeMode];

  const sortedRows = useMemo<Record<string, unknown>[]>(() => {
    if (!payload) return [];
    const items = payload.items as Array<HistoryCommandItem | HistoryConversationItem>;
    const fav: Record<string, unknown>[] = [];
    const rest: Record<string, unknown>[] = [];
    for (const item of items) {
      const row = { ...item, favorite: favs.has(item.id) };
      if (favs.has(item.id)) fav.push(row);
      else rest.push(row);
    }
    return [...fav, ...rest];
  }, [payload, favs]);

  const commandsRenderRowActions = useCallback(
    (row: Record<string, unknown>) => (
      <>
        <StarBtn
          active={favs.has(String(row.id))}
          onToggle={() => toggleFavorite("commands", String(row.id))}
          messages={messages}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dispatchHistoryAction({ action: "run-command", rawIndex: row.rawIndex });
          }}
          title={messages.run}
          aria-label={messages.run}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <i className="ti ti-player-play text-sm" />
        </button>
      </>
    ),
    [favs, toggleFavorite, messages],
  );

  const conversationsRenderCell = useMemo(
    () => ({
      title: (row: Record<string, unknown>) => (
        <button
          type="button"
          onClick={() =>
            dispatchHistoryAction({
              action: "open",
              mode: activeMode,
              sessionId: row.sessionId,
            })
          }
          className="block min-w-0 max-w-full truncate text-left text-xs font-medium text-foreground hover:text-primary"
          title={String(row.preview ?? "")}
        >
          {String(row.title ?? "")}
        </button>
      ),
      project: (row: Record<string, unknown>) => {
        const project = String(row.project ?? "");
        return project ? (
          <span className="inline-block rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
            {project}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    }),
    [activeMode],
  );

  const conversationsRenderRowActions = useCallback(
    (row: Record<string, unknown>) => (
      <>
        <StarBtn
          active={favs.has(String(row.id))}
          onToggle={() => toggleFavorite(activeMode, String(row.id))}
          messages={messages}
        />
        {activeMode === "codex" ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              dispatchHistoryAction({
                action: "copy",
                mode: activeMode,
                copyCommand: row.copyCommand,
              });
            }}
            title={messages.copyCodexCommand}
            aria-label={messages.copyCodexCommand}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <i className="ti ti-copy text-sm" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dispatchHistoryAction({
              action: "delete",
              mode: activeMode,
              sessionId: row.sessionId,
              title: row.title,
            });
          }}
          title={messages.deleteConversation}
          aria-label={messages.delete}
          className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <i className="ti ti-trash text-sm" />
        </button>
      </>
    ),
    [activeMode, favs, toggleFavorite, messages],
  );

  if (!payload) {
    return (
      <div className="py-8 text-center text-xs text-muted-foreground">
        <i className="ti ti-loader-2 animate-spin text-2xl block mb-2 opacity-40 mx-auto"></i>
        {messages.loading}
      </div>
    );
  }

  if (payload.error && payload.items.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-destructive/80">
        <i className="ti ti-alert-triangle text-2xl block mb-2 opacity-40 mx-auto"></i>
        {payload.error}
      </div>
    );
  }

  if (payload.items.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-muted-foreground">
        <i
          className={`ti ${activeMode === "commands" ? "ti-terminal-2" : "ti-message-2"} text-2xl block mb-2 opacity-30 mx-auto`}
        ></i>
        {activeMode === "commands"
          ? messages.emptyCommands
          : formatMessage(messages.emptyConversations, {
              cli: activeMode === "codex" ? "Codex" : "Claude",
            })}
      </div>
    );
  }

  if (activeMode === "commands") {
    return (
      <div className="p-2">
        <DataTable
          tableId="terminal-history-commands"
          title={messages.titleCommands}
          columns={HISTORY_COMMANDS_COLUMNS}
          data={sortedRows}
          renderCell={HISTORY_COMMANDS_RENDER_CELL}
          renderRowActions={commandsRenderRowActions}
          pageSizeOptions={HISTORY_PAGE_SIZE_OPTIONS}
          settingsButtonContainer={settingsButtonContainer}
          pageWindowSource={{ total: payload.total, hasMore: payload.hasMore, loading: payload.loading, error: payload.error,
            onLoadMore: (pageSize) => dispatchHistoryAction({ action: "load-more", mode: "commands", pageSize }) }}
        />
      </div>
    );
  }

  return (
    <div className="p-2">
      <DataTable
        tableId={`terminal-history-${activeMode}`}
        title={activeMode === "codex" ? messages.titleCodex : messages.titleClaude}
        columns={HISTORY_CONVERSATIONS_COLUMNS}
        data={sortedRows}
        renderCell={conversationsRenderCell}
        renderRowActions={conversationsRenderRowActions}
        pageSizeOptions={HISTORY_PAGE_SIZE_OPTIONS}
        settingsButtonContainer={settingsButtonContainer}
        pageWindowSource={{ total: payload.total, hasMore: payload.hasMore, loading: payload.loading, error: payload.error,
          onLoadMore: (pageSize) => dispatchHistoryAction({ action: "load-more", mode: activeMode, pageSize }) }}
      />
    </div>
  );
}
