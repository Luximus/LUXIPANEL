import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { createTicket, deleteTicket, getTicket, sendTicketMessage, updateTicketStatus } from "../../api/client";
import { ENV } from "../../config/env";
import { openExternal } from "../../features/app/utils";
import type { NewTicketState, TicketDetailState, TicketRow } from "../../features/app/viewModels";
import type { TicketAttachment } from "../../types/models";
import {
  applyTicketCreated,
  applyTicketDeleted,
  applyTicketUpdated,
  refreshTickets as refreshTicketsStore,
  useTickets,
} from "../../features/support/tickets-store";
import { scheduleLocalNotification } from "../../lib/notifications";
import { localizeCommonError } from "../../lib/error-localization";
import type { Messages } from "../../i18n";
import { buildTicketRows } from "./row-builders";

/**
 * Sub-hook COHESIVO extraído de `useMainTabController` (fase de refactor <1000
 * líneas): dominio SOPORTE — lista de tickets (store B4), filas derivadas,
 * modal de ticket nuevo, detalle de ticket (responder / cambiar estado) y las
 * acciones de fila. Código movido verbatim; el estado compartido entra por
 * parámetros. Hooks contenidos: useTickets + 2 useState + useRef + 1 efecto de
 * sincronización de ref (sin dependencias cruzadas con otros efectos).
 */
export function useSupportTickets({ token, userEmail, t, bootstrappedRef }: {
  token: string | null;
  userEmail: string | null;
  t: Messages;
  /** Ref de arranque del controlador: los refresh explícitos lo marcan. */
  bootstrappedRef: MutableRefObject<boolean>;
}) {
  // Tickets: dominio extraído al store module-level (fase B4); lista + busy
  // reactivos, mutadores locales vía applyTicket*.
  const { tickets, busy: busyTickets } = useTickets();
  const [newTicket, setNewTicket] = useState<NewTicketState>({
    open: false, title: "", description: "", priority: "medium", saving: false, error: "",
  });
  const [ticketDetail, setTicketDetail] = useState<TicketDetailState>({
    open: false, loading: false, ticket: null, replyContent: "", sending: false, error: "",
    pendingStatus: "", changingStatus: false,
  });
  const ticketDetailRef = useRef(ticketDetail);

  useEffect(() => {
    ticketDetailRef.current = ticketDetail;
  }, [ticketDetail]);

  const openTicketsCount = useMemo(
    () => tickets.filter((ticket) => ticket.status === "open" || ticket.status === "in_progress").length,
    [tickets],
  );

  const ticketRows = useMemo<TicketRow[]>(() => buildTicketRows(tickets, t), [tickets, t]);

  const refreshSupportTickets = useCallback(async () => {
    if (!token) return;
    const rows = await refreshTicketsStore(token, userEmail);
    if (rows.length > 0) {
      const detail = await getTicket(rows[0].id, token);
      const adminReply = detail.ticket.messages?.some((msg) => msg.isAdmin);
      if (adminReply) {
        await scheduleLocalNotification({
          title: t.support.notificationTitle,
          body: t.support.notificationBody,
        });
      }
    }
    bootstrappedRef.current = true;
  }, [t.support.notificationBody, t.support.notificationTitle, token, userEmail]);

  const openSupportPortal = () => {
    void openExternal(`${ENV.luxipanelUrl}/portal/support`);
  };

  const openNewTicketModal = () => setNewTicket({
    open: true, title: "", description: "", priority: "medium", saving: false, error: "",
  });
  const closeNewTicketModal = () => setNewTicket((c) => ({ ...c, open: false, error: "", saving: false }));
  const submitNewTicket = async (attachments: TicketAttachment[] = []) => {
    if (!token) return;
    const title = newTicket.title.trim();
    const description = newTicket.description.trim();
    if (title.length < 5) {
      setNewTicket((c) => ({ ...c, error: t.errors.ticketTitleTooShort })); return;
    }
    setNewTicket((c) => ({ ...c, saving: true, error: "" }));
    try {
      const { ticket } = await createTicket({
        title, description: description || undefined, priority: newTicket.priority,
        attachments: attachments.length > 0 ? attachments : undefined,
      }, token);
      applyTicketCreated(userEmail, ticket);
      setNewTicket({
        open: false, title: "", description: "", priority: "medium", saving: false, error: "",
      });
    } catch (error) {
      setNewTicket((c) => ({
        ...c, saving: false,
        error: localizeCommonError(error, t, t.errors.couldNotCreateTicket),
      }));
    }
  };

  const closeTicketDetail = useCallback(() => {
    setTicketDetail({
      open: false, loading: false, ticket: null, replyContent: "", sending: false, error: "",
      pendingStatus: "", changingStatus: false,
    });
  }, []);

  const openTicketDetail = useCallback(async (ticketId: string) => {
    if (!token) return;
    setTicketDetail({
      open: true, loading: true, ticket: null, replyContent: "", sending: false, error: "",
      pendingStatus: "", changingStatus: false,
    });
    try {
      const { ticket } = await getTicket(ticketId, token);
      setTicketDetail((c) => ({ ...c, loading: false, ticket, pendingStatus: ticket.status }));
    } catch (error) {
      setTicketDetail((c) => ({
        ...c, loading: false,
        error: localizeCommonError(error, t, t.errors.couldNotLoadTicket),
      }));
    }
  }, [token, t.errors.couldNotLoadTicket]);

  const sendTicketReply = useCallback(async (attachments: TicketAttachment[] = []) => {
    if (!token) return;
    const currentDetail = ticketDetailRef.current;
    if (!currentDetail.ticket) return;
    const ticketId = currentDetail.ticket.id;
    const content = currentDetail.replyContent.trim();
    if (!content && attachments.length === 0) {
      setTicketDetail((c) => ({ ...c, error: t.errors.replyEmpty })); return;
    }
    setTicketDetail((c) => ({ ...c, sending: true, error: "" }));
    try {
      const { message } = await sendTicketMessage(ticketId, {
        content, attachments: attachments.length > 0 ? attachments : undefined,
      }, token);
      // Append local del mensaje al detalle + sincroniza la fila de la lista,
      // sin re-consultar el ticket ni la lista completa.
      setTicketDetail((c) => (c.ticket && c.ticket.id === ticketId
        ? {
            ...c,
            replyContent: "",
            sending: false,
            ticket: {
              ...c.ticket,
              messages: [...(c.ticket.messages ?? []), message],
              lastResponderRole: "user",
              lastResponseAt: message.createdAt,
              updatedAt: message.createdAt,
              messageCount: (c.ticket.messageCount ?? 0) + 1,
            },
          }
        : { ...c, replyContent: "", sending: false }));
      applyTicketUpdated(userEmail, ticketId, (x) => ({
        ...x, lastResponderRole: "user" as const, lastResponseAt: message.createdAt,
        updatedAt: message.createdAt, messageCount: (x.messageCount ?? 0) + 1,
      }));
    } catch (error) {
      setTicketDetail((c) => ({
        ...c, sending: false,
        error: localizeCommonError(error, t, t.errors.couldNotSendMessage),
      }));
    }
  }, [token, t.errors.couldNotSendMessage, t.errors.replyEmpty, userEmail]);

  const changeTicketStatus = useCallback(async () => {
    if (!token || !ticketDetail.ticket) return;
    const target = ticketDetail.pendingStatus;
    if (!target || target === ticketDetail.ticket.status) return;
    setTicketDetail((c) => ({ ...c, changingStatus: true, error: "" }));
    try {
      const { ticket } = await updateTicketStatus(ticketDetail.ticket.id, target, token);
      // Update local del estado en el detalle y en la fila de la lista.
      setTicketDetail((c) => (c.ticket
        ? { ...c, ticket: { ...c.ticket, ...ticket }, pendingStatus: ticket.status }
        : c));
      applyTicketUpdated(userEmail, ticket.id, (x) => ({ ...x, ...ticket }));
    } catch (error) {
      setTicketDetail((c) => ({
        ...c,
        error: localizeCommonError(error, t, t.errors.couldNotChangeStatus),
      }));
    } finally {
      setTicketDetail((c) => ({ ...c, changingStatus: false }));
    }
  }, [ticketDetail.pendingStatus, ticketDetail.ticket, token, t.errors.couldNotChangeStatus, userEmail]);

  const handleSupportRowAction = useCallback(async (actionId: string, row: TicketRow) => {
    if (actionId === "view_ticket") {
      void openTicketDetail(row.id);
      return;
    }
    if (actionId === "delete_ticket") {
      if (!token) return;
      await deleteTicket(row.id, token);
      applyTicketDeleted(userEmail, row.id);
    }
  }, [openTicketDetail, token, userEmail]);

  return {
    tickets, busyTickets, ticketRows, openTicketsCount,
    newTicket, setNewTicket, openNewTicketModal, closeNewTicketModal, submitNewTicket,
    ticketDetail, setTicketDetail, openTicketDetail, closeTicketDetail,
    sendTicketReply, changeTicketStatus, handleSupportRowAction,
    refreshSupportTickets, openSupportPortal,
  };
}
