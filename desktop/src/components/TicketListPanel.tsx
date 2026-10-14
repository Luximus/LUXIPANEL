import * as React from "react";
import { Plus, RefreshCw, ChevronRight } from "lucide-react";
import { getTickets, type Ticket } from "../api/client";
import { ticketStrings, tkStatusLabel, tkPriorityLabel, tkStatusClass, tkFormatDate } from "./ticketHubStrings";

/** Panel "Mis tickets" del hub del asistente (desktop). Espejo del web. */
export default function TicketListPanel({
  token,
  language,
  reloadKey,
  onOpenTicket,
  onNewTicket,
}: {
  token: string;
  language: string;
  reloadKey?: number;
  onOpenTicket: (id: string) => void;
  onNewTicket: () => void;
}) {
  const t = ticketStrings(language);
  const [tickets, setTickets] = React.useState<Ticket[] | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setTickets(await getTickets(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.loadError);
    } finally {
      setBusy(false);
    }
  }, [token, t.loadError]);

  React.useEffect(() => {
    void load();
  }, [load, reloadKey]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-2 border-b border-base-300 p-2 dark:border-zinc-700">
        <button type="button" className="btn btn-primary btn-sm flex-1" onClick={onNewTicket}>
          <Plus size={15} />
          {t.newTicket}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()} disabled={busy} aria-label={t.loading}>
          <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {tickets === null ? (
          <p className="my-4 text-center text-sm opacity-60">{t.loading}</p>
        ) : error ? (
          <p className="my-4 text-center text-sm text-error">{error}</p>
        ) : tickets.length === 0 ? (
          <p className="my-4 text-center text-sm opacity-60">{t.noTickets}</p>
        ) : (
          tickets.map((ticket) => {
            const unread = ticket.lastResponderRole === "admin" && ticket.status !== "closed";
            return (
              <button
                key={ticket.id}
                type="button"
                onClick={() => onOpenTicket(ticket.id)}
                className="flex w-full items-center gap-2 rounded-xl border border-base-300 bg-base-200/40 p-3 text-start hover:border-primary dark:border-zinc-700"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap gap-1">
                    <span className={`badge badge-sm ${tkStatusClass(ticket.status)}`}>{tkStatusLabel(t, ticket.status)}</span>
                    <span className="badge badge-outline badge-sm">{tkPriorityLabel(t, ticket.priority)}</span>
                    {unread ? <span className="badge badge-primary badge-sm">{t.awaitingYou}</span> : null}
                  </div>
                  <p className="truncate text-sm font-semibold">{ticket.title}</p>
                  <span className="text-xs opacity-60">{tkFormatDate(ticket.createdAt, language)}</span>
                </div>
                <ChevronRight size={16} className="lp-rtl-flip shrink-0 opacity-50" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
