// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * A single conversation row in the sidebar list. Extracted verbatim from the
 * original `ChatPane.tsx`.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAssistantI18n } from "../i18n";
import { chatEngine } from "../chat-engine";
import {
  PROVIDER_META,
  type AssistantProviderId,
  type ConversationMeta,
  type AssistantAgent,
} from "../assistant-api";
import { ProviderIcon } from "../ProviderIcon";
import { formatConvoDate } from "./helpers";

/** A single conversation row in the list (mobile + desktop share this markup;
 *  `extraClassName` carries the desktop-only row separators). */
export function ConvoRow({
  c,
  activeId,
  extraClassName = "",
  projectLabel = null,
  inGroup = false,
  inProjectTree = false,
  hideInlineActions = false,
  renameRequestId = 0,
  agentById,
  projectTitleById,
  onOpen,
  onDelete,
  onRename,
  onTogglePin,
}: {
  c: ConversationMeta;
  activeId: string | null;
  extraClassName?: string;
  // When set (global search), show which project this chat belongs to.
  projectLabel?: string | null;
  // Child of an expanded agent thread: the agent identity lives on the group
  // header, so promote the conversation title and omit the repeated agent name.
  inGroup?: boolean;
  /** In a project folder, include the agent identity above the chat title. */
  inProjectTree?: boolean;
  hideInlineActions?: boolean;
  renameRequestId?: number;
  // Lookups for the agent name and project identity of each chat.
  agentById?: Map<string, AssistantAgent>;
  projectTitleById?: Map<string, string>;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
}) {
  const ct = useAssistantI18n().chatTab as Record<string, any>;
  useSyncExternalStore(chatEngine.subscribe, chatEngine.getVersion, chatEngine.getVersion);
  // "En curso": el chat transmite localmente, el backend lo reporta corriendo, o
  // ESTE chat es el subagente asignado a una tarea de equipo aún en `running`
  // (misma señal que el chip azul "En curso" del TeamTaskBoard del panel derecho).
  const isLive = chatEngine.isStreaming(c.id) || chatEngine.isBackgroundRunning(c.id) || chatEngine.isWorkerTaskRunning(c.id);
  const lastTurn = chatEngine.get(c.id)?.turns.at(-1);
  const canShowFinished = !!lastTurn && !lastTurn.error && !lastTurn.interrupted && !lastTurn.stopped && !lastTurn.ask?.length && !lastTurn.permission;
  const unreviewed = !isLive && activeId !== c.id && chatEngine.isUnreviewed(c.id, !!c.unreviewed);
  // Brief transition (≈700ms) when the live state flips off: the spinner
  // fades into a check so the user sees the task really finished, even when
  // the change arrived via the assistant WebSocket and the row didn't unmount.
  // `wasLiveRef` mirrors the previous render's value; an effect bumps
  // `justFinished` whenever isLive goes from true → false, and clears it on
  // a timer (no per-render setTimeout churn — the effect re-fires only when
  // the transition actually happens).
  const wasLiveRef = useRef(isLive);
  const [justFinished, setJustFinished] = useState(false);
  useEffect(() => {
    if (isLive) setJustFinished(false);
    if (wasLiveRef.current && !isLive) {
      setJustFinished(canShowFinished);
      const t = window.setTimeout(() => setJustFinished(false), 700);
      wasLiveRef.current = isLive;
      return () => window.clearTimeout(t);
    }
    wasLiveRef.current = isLive;
    return undefined;
  }, [isLive, canShowFinished]);
  // The agent paused asking the user to approve a tool → yellow "needs review" dot.
  const needsApproval = chatEngine.hasPendingPermission(c.id);
  // Inline-rename state (C3): the title cell becomes an <input> on Enter/Esc.
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(c.title);
  useEffect(() => {
    if (renameRequestId > 0) { setEditTitle(c.title); setEditing(true); }
  }, [renameRequestId, c.title]);
  const rowProvider = (c.provider && c.provider in PROVIDER_META)
    ? c.provider as AssistantProviderId
    : (c.originProvider && c.originProvider in PROVIDER_META)
      ? c.originProvider as AssistantProviderId
    : null;
  // Keep the provider, agent name and date above the conversation title.
  const isAgentChat = !!c.agentId;
  const rowAgent = c.agentId ? agentById?.get(c.agentId) ?? null : null;
  // Inside an expanded thread the agent identity is already on the header, so
  // demote to the plain conversation title (like the Dashboard group children).
  const showAgentIdentity = isAgentChat && (!inGroup || inProjectTree);
  const secondaryText = c.searchMatch?.snippet ?? (c.preview || "—");
  const dateLabel = formatConvoDate(c.updatedAt);
  const showAgentMeta = showAgentIdentity;

  function commitRename() {
    const next = editTitle.trim();
    setEditing(false);
    if (next && next !== c.title) onRename(c.id, next);
    else setEditTitle(c.title);
  }

  return (
    <div
      className={`group flex items-center gap-1 rounded-md px-2 py-2 cursor-pointer ${extraClassName}${activeId === c.id ? "bg-card" : "hover:bg-card/50"}`}
      onClick={() => { if (!editing) onOpen(c.id); }}
    >
      <div className="min-w-0 flex-1">
        {(rowProvider || showAgentMeta || dateLabel) && (
          <div className="lxp-convo-meta mb-0.5 flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground/80">
            {rowProvider && <span role="img" className="flex shrink-0 items-center" title={PROVIDER_META[rowProvider].label} aria-label={PROVIDER_META[rowProvider].label}>
              <ProviderIcon id={rowProvider} className="shrink-0 text-[11px] text-muted-foreground/80" />
            </span>}
            {showAgentMeta && <span className="flex min-w-0 items-center gap-1" title={rowAgent?.name ?? "Agente IA"}>
              <span className="truncate">{rowAgent?.name ?? "Agente IA"}</span>
            </span>}
            {dateLabel && <span className={`ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap text-[9px] ${(rowProvider || showAgentMeta) ? "border-l border-border/60 pl-2" : ""}`}>
              <i className="ti ti-clock text-[9px]" aria-hidden="true" />
              {dateLabel}
            </span>}
          </div>
        )}
        {editing ? (
          <input
            autoFocus
            value={editTitle}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") { e.preventDefault(); commitRename(); }
              else if (e.key === "Escape") { e.preventDefault(); setEditTitle(c.title); setEditing(false); }
            }}
            className="w-full rounded border border-input bg-background px-1.5 py-0.5 text-xs focus:border-primary focus:outline-none"
          />
        ) : (
          <p className="truncate text-xs font-medium flex items-center gap-1">
            {isLive ? (
              <i
                key="live-spinner"
                className="ti ti-loader-2 animate-spin text-emerald-500 text-[10px] transition-opacity duration-300"
                aria-hidden
              />
            ) : justFinished ? (
              <i
                key="live-done"
                className="ti ti-circle-check-filled text-emerald-500 text-[10px] animate-lxp-assistant-task-done"
                role="img"
                aria-label={ct.taskJustFinished ?? "Tarea completada"}
                title={ct.taskJustFinished ?? "Tarea completada"}
              />
            ) : null}
            {needsApproval && <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-yellow-400 ring-2 ring-yellow-400/30 animate-pulse" title={ct.approvalPendingTitle ?? "Aprobación pendiente — revisa el chat"} role="img" aria-label={ct.approvalPending ?? "Aprobación pendiente"} />}
            {c.pinned && <i className="ti ti-pinned text-amber-500 text-[10px]" aria-hidden></i>}
            {unreviewed && <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-red-500 ring-2 ring-red-500/30 animate-pulse" title={ct.newUnseenReply ?? "Respuesta nueva sin ver"} role="img" aria-label={ct.newUnseenReply ?? "Respuesta nueva sin ver"} />}
            <span className="truncate">{c.title}</span>
          </p>
        )}
        <p className={`flex min-w-0 items-center gap-1 text-[10px] ${c.searchMatch ? "text-foreground/80" : "text-muted-foreground"}`} title={c.searchMatch?.snippet}>
          {c.searchMatch && <i className={`ti ${c.searchMatch.role === "user" ? "ti-user" : "ti-robot"} shrink-0 text-[10px] text-primary`} aria-hidden="true" />}
          <span className="truncate">{secondaryText}</span>
        </p>
        {projectLabel && (
          <p className="mt-0.5 flex items-center gap-1 text-[9px] text-muted-foreground/70">
            <i className="ti ti-folder text-[9px]" aria-hidden></i>
            <span className="truncate">{projectLabel}</span>
          </p>
        )}
      </div>
      {!editing && !hideInlineActions && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onTogglePin(c.id, !c.pinned); }}
            className={`p-0.5 hover:text-amber-500 ${c.pinned ? "text-amber-500" : "opacity-0 group-hover:opacity-100 text-muted-foreground"}`}
            title={c.pinned ? (ct.unpin ?? "Desfijar") : (ct.pinTop ?? "Fijar arriba")}
            aria-label={c.pinned ? (ct.unpin ?? "Desfijar") : (ct.pinTop ?? "Fijar arriba")}
          >
            <i className={`ti ${c.pinned ? "ti-pinned-off" : "ti-pin"} text-xs`} aria-hidden></i>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setEditTitle(c.title); setEditing(true); }}
            className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-primary"
            title={ct.rename ?? "Renombrar"}
          >
            <i className="ti ti-pencil text-xs" aria-hidden></i>
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(c.id); }} className="p-0.5 text-muted-foreground hover:text-red-500" title={ct.deleteAction ?? "Eliminar"} aria-label={ct.deleteChat ?? "Eliminar chat"}>
            <i className="ti ti-trash text-xs" aria-hidden></i>
          </button>
        </>
      )}
    </div>
  );
}
