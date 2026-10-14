/**
 * Fila de conversación minimalista del sidebar: abre (click), borra (botón
 * papelera, con stopPropagation) e indicadores (spinner "respondiendo", punto
 * rojo "sin revisar", pin). Sin rename ni pin editable (no hay endpoints
 * cableados en desktop todavía). Puerto DOM de
 * `app/src/components/assistant/drawer/ConvoRow.tsx` recortado a lo mínimo.
 */
import { Loader2, Pin, Trash2 } from "lucide-react";
import { formatRelative } from "./format";
import type { AssistantStrings, Conversation } from "./types";

export function ConvoRow({ c, activeId, isLive, t, language, onOpen, onDelete }: {
  c: Conversation;
  activeId: string | null;
  isLive: boolean;
  t: AssistantStrings;
  language?: string;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isActive = c.id === activeId;
  const unreviewed = !isLive && !!c.unreviewed;
  const title = c.title?.trim() || c.id.slice(0, 8);
  const relative = formatRelative(c.updatedAt ?? c.createdAt, language, t);
  return (
    <div className={`sat-row ${isActive ? "is-active" : ""}`}>
      <button type="button" className="sat-row__main" onClick={() => onOpen(c.id)} title={title}>
        <span className="sat-row__title">
          {isLive ? <Loader2 size={11} className="animate-spin shrink-0" aria-hidden /> : null}
          {unreviewed ? <span className="sat-dot" aria-hidden /> : null}
          {c.pinned ? <Pin size={11} className="sat-row__pin" aria-hidden /> : null}
          <span className="truncate">{title}</span>
        </span>
        {c.preview ? <span className="sat-row__preview truncate">{c.preview}</span> : null}
        {relative ? <span className="sat-row__date">{relative}</span> : null}
      </button>
      <button
        type="button"
        className="sat-row__del"
        onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
        aria-label={t.deleteConversation}
        title={t.deleteConversation}
      >
        <Trash2 size={12} aria-hidden />
      </button>
    </div>
  );
}
