import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTicket, getTicket, getTickets, sendTicketMessage, updateTicketStatus } from "../../api/client";
import type { ToastApi } from "../../components/ToastProvider";
import type { Messages } from "../../i18n/messages";
import type { View } from "../../features/app/types";
import type { NewTicketState, TicketDetailState, TicketRow } from "../../features/app/viewModels";
import type { Ticket, TicketAttachment } from "../../types/models";

/**
 * Soporte (tickets del portal) del controlador de pestaña principal, extraído
 * de `useMainTabController` SIN cambios de comportamiento: lista + poll de
 * fondo (45s) con notificación nativa, modal de nuevo ticket y detalle/hilo
 * con respuesta y cambio de estado. Aislado: solo depende de `token`, la
 * vista activa (gatea el poll) y los servicios de toast/i18n.
 */
export function useSupportTickets({ token, view, t, toast }: {
  token: string | null;
  view: View;
  t: Messages;
  toast: ToastApi;
}) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [busyTickets, setBusyTickets] = useState(false);
  // Los tickets se cargan una sola vez al entrar a soporte; luego el poll de
  // fondo (45s) refresca. Evita re-consultar la lista en cada visita.
  const ticketsLoadedOnceRef = useRef(false);
  const [newTicket, setNewTicket] = useState<NewTicketState>({ open: false, title: "", description: "", priority: "medium", saving: false, error: "" });
  const [ticketDetail, setTicketDetail] = useState<TicketDetailState>({ open: false, loading: false, ticket: null, replyContent: "", sending: false, error: "", pendingStatus: "", changingStatus: false });

  const openTicketsCount = useMemo(() => tickets.filter((ticket) => ticket.status === "open" || ticket.status === "in_progress").length, [tickets]);

  const ticketRows = useMemo<TicketRow[]>(() => [...tickets].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((ticket) => {
    // Desktop is user-facing, so response state is computed from the user's POV:
    // - admin spoke last → user must reply
    // - user spoke last → already responded
    let responseState: TicketRow["responseState"];
    if (!ticket.lastResponderRole) responseState = "no_response";
    else if (ticket.lastResponderRole === "admin") responseState = "awaiting_user";
    else responseState = "responded";
    const responseLabels = t.ticketTable.responseBadges;
    const responseStateLabel = responseLabels[responseState];
    return {
      id: ticket.id,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      responseState,
      responseStateLabel,
      createdAtLabel: new Date(ticket.createdAt).toLocaleString(),
      updatedAtLabel: ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : "—",
      closedAtLabel: ticket.closedAt ? new Date(ticket.closedAt).toLocaleString() : "—",
      searchBlob: `${ticket.title} ${ticket.status} ${ticket.priority} ${responseStateLabel}`.toLowerCase(),
      source: ticket,
    };
  }), [tickets, t]);

  useEffect(() => {
    if (!token || view !== "support") return;
    const refresh = async () => {
      setBusyTickets(true);
      try {
        const rows = await getTickets(token);
        setTickets(rows);
        if (rows.length > 0) {
          const detail = await getTicket(rows[0].id, token);
          const adminReply = detail.ticket.messages?.some((msg) => msg.isAdmin);
          if (adminReply && "Notification" in window) {
            if (Notification.permission === "granted") new Notification(t.support.notificationTitle, { body: t.support.notificationBody });
            else if (Notification.permission !== "denied") {
              const granted = await Notification.requestPermission();
              if (granted === "granted") new Notification(t.support.notificationTitle, { body: t.support.notificationBody });
            }
          }
        }
      } finally {
        setBusyTickets(false);
      }
    };
    if (!ticketsLoadedOnceRef.current) {
      ticketsLoadedOnceRef.current = true;
      void refresh();
    }
    const intervalId = window.setInterval(() => void refresh(), 45_000);
    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [token, view]);

  const refreshSupportTickets = useCallback(async () => {
    if (!token) return;
    setBusyTickets(true);
    try {
      const rows = await getTickets(token);
      setTickets(rows);
    } finally {
      setBusyTickets(false);
    }
  }, [token]);

  const openNewTicketModal = () => setNewTicket({ open: true, title: "", description: "", priority: "medium", saving: false, error: "", failedField: null });
  const closeNewTicketModal = () => setNewTicket((current) => ({ ...current, open: false, error: "", saving: false }));
  const submitNewTicket = async (attachments: TicketAttachment[] = []) => {
    if (!token) return;
    const title = newTicket.title.trim();
    const description = newTicket.description.trim();
    if (title.length < 5) {
      setNewTicket((current) => ({ ...current, error: t.errors.ticketTitleTooShort, failedField: "title" }));
      return;
    }
    setNewTicket((current) => ({ ...current, saving: true, error: "", failedField: null }));
    try {
      const { ticket } = await createTicket({
        title,
        description: description || undefined,
        priority: newTicket.priority,
        attachments: attachments.length > 0 ? attachments : undefined,
      }, token);
      setTickets((prev) => [ticket, ...prev]);
      setNewTicket({ open: false, title: "", description: "", priority: "medium", saving: false, error: "", failedField: null });
      toast.success(t.toast.created);
    } catch (error) {
      setNewTicket((current) => ({ ...current, saving: false, error: error instanceof Error ? error.message : t.errors.couldNotCreateTicket }));
    }
  };

  const closeTicketDetail = useCallback(() => {
    setTicketDetail({ open: false, loading: false, ticket: null, replyContent: "", sending: false, error: "", pendingStatus: "", changingStatus: false });
  }, []);

  const openTicketDetail = useCallback(async (ticketId: string) => {
    if (!token) return;
    setTicketDetail({ open: true, loading: true, ticket: null, replyContent: "", sending: false, error: "", pendingStatus: "", changingStatus: false });
    try {
      const { ticket } = await getTicket(ticketId, token);
      setTicketDetail((current) => ({
        ...current,
        loading: false,
        ticket,
        pendingStatus: ticket.status,
      }));
    } catch (error) {
      setTicketDetail((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : t.errors.couldNotLoadTicket,
      }));
    }
  }, [token]);

  const sendTicketReply = useCallback(async (attachments: TicketAttachment[] = []) => {
    if (!token || !ticketDetail.ticket) return;
    const ticketId = ticketDetail.ticket.id;
    const content = ticketDetail.replyContent.trim();
    if (!content && attachments.length === 0) {
      setTicketDetail((current) => ({ ...current, error: t.errors.replyEmpty }));
      return;
    }
    setTicketDetail((current) => ({ ...current, sending: true, error: "" }));
    try {
      const { message } = await sendTicketMessage(ticketId, { content, attachments: attachments.length > 0 ? attachments : undefined }, token);
      // Append local del mensaje al detalle + sincroniza la fila de la lista,
      // sin re-consultar el ticket ni la lista completa.
      setTicketDetail((current) => (current.ticket && current.ticket.id === ticketId
        ? {
            ...current,
            replyContent: "",
            sending: false,
            ticket: {
              ...current.ticket,
              messages: [...(current.ticket.messages ?? []), message],
              lastResponderRole: "user",
              lastResponseAt: message.createdAt,
              updatedAt: message.createdAt,
              messageCount: (current.ticket.messageCount ?? 0) + 1,
            },
          }
        : { ...current, replyContent: "", sending: false }));
      setTickets((prev) => prev.map((x) => (x.id === ticketId
        ? { ...x, lastResponderRole: "user", lastResponseAt: message.createdAt, updatedAt: message.createdAt, messageCount: (x.messageCount ?? 0) + 1 }
        : x)));
    } catch (error) {
      setTicketDetail((current) => ({
        ...current,
        sending: false,
        error: error instanceof Error ? error.message : t.errors.couldNotSendMessage,
      }));
    }
  }, [ticketDetail.replyContent, ticketDetail.ticket, token]);

  const changeTicketStatus = useCallback(async () => {
    if (!token || !ticketDetail.ticket) return;
    const target = ticketDetail.pendingStatus;
    if (!target || target === ticketDetail.ticket.status) return;
    setTicketDetail((current) => ({ ...current, changingStatus: true, error: "" }));
    try {
      const { ticket } = await updateTicketStatus(ticketDetail.ticket.id, target, token);
      // Update local del estado en el detalle y en la fila de la lista.
      setTicketDetail((current) => (current.ticket
        ? { ...current, ticket: { ...current.ticket, ...ticket }, pendingStatus: ticket.status }
        : current));
      setTickets((prev) => prev.map((x) => (x.id === ticket.id ? { ...x, ...ticket } : x)));
      toast.success(t.toast.saved);
    } catch (error) {
      setTicketDetail((current) => ({
        ...current,
        error: error instanceof Error ? error.message : t.errors.couldNotChangeStatus,
      }));
    } finally {
      setTicketDetail((current) => ({ ...current, changingStatus: false }));
    }
  }, [ticketDetail.pendingStatus, ticketDetail.ticket, token]);

  const handleSupportRowAction = useCallback((actionId: string, row: TicketRow) => {
    if (actionId === "view_ticket") void openTicketDetail(row.id);
  }, [openTicketDetail]);

  return {
    tickets,
    setTickets,
    busyTickets,
    ticketRows,
    openTicketsCount,
    refreshSupportTickets,
    newTicket,
    setNewTicket,
    openNewTicketModal,
    closeNewTicketModal,
    submitNewTicket,
    ticketDetail,
    setTicketDetail,
    openTicketDetail,
    closeTicketDetail,
    sendTicketReply,
    changeTicketStatus,
    handleSupportRowAction,
  };
}
