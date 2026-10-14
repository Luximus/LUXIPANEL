/**
 * i18n compacto (es/en) de los panels de ticket del asistente (app RN). Espejo
 * del de web/desktop. Otros idiomas caen a inglés; la paridad completa se hace
 * en la fase de pulido reusando los `screens/ticket*` existentes.
 */
export type TicketStrings = {
  myTickets: string; newTicket: string; back: string; noTickets: string; loading: string; loadError: string;
  statusOpen: string; statusInProgress: string; statusResolved: string; statusClosed: string;
  prioCritical: string; prioHigh: string; prioMedium: string; prioLow: string; awaitingYou: string;
  noMessages: string; you: string; support: string; replyPlaceholder: string;
  send: string; attach: string; closeTicket: string; delete: string; deleteConfirm: string;
  closedNotice: string; title: string; titlePlaceholder: string; description: string; descriptionPlaceholder: string;
  priority: string; create: string; creating: string; titleRequired: string; createError: string;
  needPaidData: string; twoFaRequired: string; cancel: string;
  tasks: string; noTasks: string; tasksLoadError: string;
  taskPending: string; taskRunning: string; taskDone: string; taskFailed: string; taskCanceled: string;
  taskResult: string; taskErrorDetail: string;
};

const STR: Record<string, TicketStrings> = {
  es: {
    myTickets: "Mis tickets", newTicket: "Nuevo ticket", back: "Volver",
    noTickets: "Aún no tienes tickets. Crea uno si el asistente no resolvió tu duda.",
    loading: "Cargando…", loadError: "No se pudieron cargar los tickets.",
    statusOpen: "Abierto", statusInProgress: "En progreso", statusResolved: "Resuelto", statusClosed: "Cerrado",
    prioCritical: "Crítica", prioHigh: "Alta", prioMedium: "Media", prioLow: "Baja", awaitingYou: "Te respondieron",
    noMessages: "Sin mensajes todavía.", you: "Tú", support: "Soporte",
    replyPlaceholder: "Escribe tu respuesta…", send: "Enviar", attach: "Adjuntar",
    closeTicket: "Cerrar ticket", delete: "Eliminar",
    deleteConfirm: "¿Eliminar este ticket? No se puede deshacer.", closedNotice: "Este ticket está cerrado.",
    title: "Asunto", titlePlaceholder: "Resume tu problema", description: "Descripción",
    descriptionPlaceholder: "Cuéntanos qué ocurre con el mayor detalle posible…",
    priority: "Prioridad", create: "Crear ticket", creating: "Creando…",
    titleRequired: "Escribe un asunto (mínimo 5 caracteres).", createError: "No se pudo crear el ticket.",
    needPaidData: "Necesitas datos de pago activos para abrir un ticket. Compra datos primero.",
    twoFaRequired: "Verificación 2FA requerida para esta acción.", cancel: "Cancelar",
    tasks: "Tareas",
    noTasks: "No tienes tareas en segundo plano. El asistente puede ejecutar comandos en tu servidor que sigan corriendo aunque cierres el chat.",
    tasksLoadError: "No se pudieron cargar las tareas.",
    taskPending: "En cola", taskRunning: "Ejecutando", taskDone: "Completada", taskFailed: "Error", taskCanceled: "Cancelada",
    taskResult: "Resultado", taskErrorDetail: "Detalle",
  },
  en: {
    myTickets: "My tickets", newTicket: "New ticket", back: "Back",
    noTickets: "You have no tickets yet. Create one if the assistant didn't solve your question.",
    loading: "Loading…", loadError: "Couldn't load tickets.",
    statusOpen: "Open", statusInProgress: "In progress", statusResolved: "Resolved", statusClosed: "Closed",
    prioCritical: "Critical", prioHigh: "High", prioMedium: "Medium", prioLow: "Low", awaitingYou: "New reply",
    noMessages: "No messages yet.", you: "You", support: "Support",
    replyPlaceholder: "Write your reply…", send: "Send", attach: "Attach",
    closeTicket: "Close ticket", delete: "Delete",
    deleteConfirm: "Delete this ticket? This can't be undone.", closedNotice: "This ticket is closed.",
    title: "Subject", titlePlaceholder: "Summarize your problem", description: "Description",
    descriptionPlaceholder: "Tell us what's happening in as much detail as possible…",
    priority: "Priority", create: "Create ticket", creating: "Creating…",
    titleRequired: "Enter a subject (at least 5 characters).", createError: "Couldn't create the ticket.",
    needPaidData: "You need active paid data to open a ticket. Buy data first.",
    twoFaRequired: "2FA verification required for this action.", cancel: "Cancel",
    tasks: "Tasks",
    noTasks: "You have no background tasks. The assistant can run commands on your server that keep going even if you close the chat.",
    tasksLoadError: "Couldn't load tasks.",
    taskPending: "Queued", taskRunning: "Running", taskDone: "Completed", taskFailed: "Failed", taskCanceled: "Canceled",
    taskResult: "Result", taskErrorDetail: "Detail",
  },
};

export function ticketStrings(locale?: string): TicketStrings {
  return STR[(locale ?? "es").slice(0, 2)] ?? STR.es;
}
export function tkStatusLabel(t: TicketStrings, s: string): string {
  return s === "open" ? t.statusOpen : s === "in_progress" ? t.statusInProgress
    : s === "resolved" ? t.statusResolved : s === "closed" ? t.statusClosed : s;
}
export function tkPriorityLabel(t: TicketStrings, p: string): string {
  return p === "critical" ? t.prioCritical : p === "high" ? t.prioHigh
    : p === "medium" ? t.prioMedium : p === "low" ? t.prioLow : p;
}
export function tkFormatDate(iso: string | null | undefined, locale?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(locale === "en" ? "en" : locale, {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "";
  }
}
export function isImageAtt(a: { url: string; type?: string }): boolean {
  return (a.type ?? "").toLowerCase().startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(a.url);
}
/** Etiqueta del estado de una tarea del asistente. */
export function tkTaskLabel(t: TicketStrings, status: string): string {
  return status === "pending" ? t.taskPending : status === "running" ? t.taskRunning
    : status === "done" ? t.taskDone : status === "error" ? t.taskFailed
    : status === "canceled" ? t.taskCanceled : status;
}
