// Soporte: identidad del asistente, tickets del usuario, bandeja de tareas del
// asistente, staff (admin) y subida de adjuntos — extraído de client.ts.
import { ENV } from "../../config/env";
import type { Ticket, TicketAttachment, TicketDetail, TicketMessage } from "../../types/models";
import { request } from "./request";

// ── Identidad del asistente de soporte (roster rotativo) ──────────────────
// El asistente de soporte ya no es un "Lux" fijo: un roster de 5 personas rota
// por turnos y el backend expone la identidad ACTIVA. Endpoint ligero (Opción A
// del contrato `backend/src/modules/support/ASSISTANT_ROSTER_CONTRACT.md`):
// read-only, no cobra diamantes y no depende de que el proveedor IA esté arriba.
export type SupportAssistantIdentity = {
  id: string;
  name: string;
  /** Ruta relativa al sitio: `/support/<Folder>/<n>.webp`. */
  avatarUrl: string;
  /** Fin (UTC ISO) del turno de 8h vigente. Opcional. */
  shiftEndsAt?: string;
};

/**
 * Identidad del asistente de soporte activo. Devuelve `null` ante cualquier
 * fallo (la UI cae a un respaldo genérico) — nunca lanza.
 */
export async function getSupportAssistantIdentity(token: string): Promise<SupportAssistantIdentity | null> {
  try {
    const data = await request<{ ok?: boolean; data?: SupportAssistantIdentity }>(
      "/portal/support/chat/identity",
      token,
    );
    const a = data?.data;
    if (a && typeof a.name === "string" && typeof a.avatarUrl === "string" && typeof a.id === "string") {
      return a;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getTickets(token: string): Promise<Ticket[]> {
  const data = await request<{ tickets: Ticket[] }>("/portal/support/tickets", token);
  return data.tickets;
}

export async function getTicket(ticketId: string, token: string): Promise<{ ticket: TicketDetail }> {
  return request<{ ticket: TicketDetail }>(`/portal/support/tickets/${ticketId}`, token);
}

// ── Bandeja de tareas del asistente (comandos al agente del servidor en background) ──
export type AssistantTaskStatus = "pending" | "running" | "done" | "error" | "canceled";
export type AssistantTask = {
  id: string;
  panelId: string | null;
  panel: string | null;
  instruction: string;
  status: AssistantTaskStatus;
  result: string | null;
  error: string | null;
  unread: boolean;
  createdAt: string | null;
  finishedAt: string | null;
};

export async function getAssistantTasks(token: string): Promise<{ tasks: AssistantTask[]; unread: number }> {
  const res = await request<{ ok?: boolean; data?: { tasks: AssistantTask[]; unread: number } }>(
    "/portal/support/assistant/tasks",
    token,
  );
  return res?.data ?? { tasks: [], unread: 0 };
}

export async function cancelAssistantTask(id: string, token: string): Promise<boolean> {
  try {
    const res = await request<{ ok?: boolean }>(`/portal/support/assistant/tasks/${id}/cancel`, token, { method: "POST" });
    return Boolean(res?.ok);
  } catch {
    return false;
  }
}

export async function ackAssistantTask(id: string, token: string): Promise<void> {
  await request(`/portal/support/assistant/tasks/${id}/ack`, token, { method: "POST" }).catch(() => undefined);
}

export type CreateTicketInput = {
  title: string;
  description?: string;
  priority?: "critical" | "high" | "medium" | "low";
  attachments?: TicketAttachment[];
};

export async function createTicket(input: CreateTicketInput, token: string): Promise<{ ticket: Ticket }> {
  return request<{ ticket: Ticket }>("/portal/support/tickets", token, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function sendTicketMessage(
  ticketId: string,
  payload: { content: string; attachments?: TicketAttachment[] },
  token: string,
): Promise<{ message: TicketMessage }> {
  return request<{ message: TicketMessage }>(`/portal/support/tickets/${ticketId}/messages`, token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTicketStatus(
  ticketId: string,
  status: "open" | "in_progress" | "resolved" | "closed",
  token: string,
): Promise<{ ticket: Ticket }> {
  return request<{ ticket: Ticket }>(`/portal/support/tickets/${ticketId}/status`, token, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

/** Elimina un ticket del usuario. Puede pedir 2FA scope "ticket.delete" (lo
 *  resuelve el `request` central con el header X-Step-Up-Token). */
export async function deleteTicket(ticketId: string, token: string): Promise<void> {
  await request(`/portal/support/tickets/${ticketId}`, token, { method: "DELETE" });
}

// ─── Admin de tickets (staff) ─────────────────────────────────────────────
// Capacidades de staff portadas desde la web. Prefijo /portal, token Bearer.
// Solo responden a cuentas admin; el backend ya existe. updateTicketStatus
// (PUT /portal/support/tickets/:id/status) puede pedir 2FA scope "ticket.edit",
// que el `request` central resuelve con el header X-Step-Up-Token.

/** Ticket enriquecido para la vista de staff (incluye triage de spam). */
export type StaffTicket = Ticket & {
  /** Marcado como spam por el triage automático. */
  triageSpam?: boolean | null;
  /** Motivo del triage (heurística que lo marcó como spam). */
  triageReason?: string | null;
};

/** Agente asignable (soporte o admin) con su carga de casos activos. */
export type StaffAgent = {
  id: string;
  name?: string | null;
  email?: string | null;
  activeCases?: number;
  isAdmin?: boolean;
};

/** Lista los tickets de staff (todos los clientes). Solo admin. */
export async function staffListTickets(token: string): Promise<StaffTicket[]> {
  const data = await request<{ ok?: boolean; data?: StaffTicket[] }>(
    "/portal/support/staff/tickets",
    token,
  );
  return Array.isArray(data?.data) ? data.data : [];
}

/** Cola de spam / triage (tickets retenidos por la heurística). Solo admin. */
export async function staffListSpam(token: string): Promise<StaffTicket[]> {
  const data = await request<{ ok?: boolean; data?: StaffTicket[] }>(
    "/portal/support/staff/spam",
    token,
  );
  return Array.isArray(data?.data) ? data.data : [];
}

/** Agentes asignables, separados en soporte y admins. Solo admin. */
export async function staffListAgents(
  token: string,
): Promise<{ support: StaffAgent[]; admins: StaffAgent[] }> {
  const data = await request<{ ok?: boolean; data?: { support?: StaffAgent[]; admins?: StaffAgent[] } }>(
    "/portal/support/staff/agents",
    token,
  );
  return {
    support: Array.isArray(data?.data?.support) ? data.data.support : [],
    admins: Array.isArray(data?.data?.admins) ? data.data.admins : [],
  };
}

/** Reasigna un ticket a un agente (assigneeId). Devuelve el ticket actualizado. */
export async function staffAssignTicket(
  ticketId: string,
  assigneeId: string,
  token: string,
): Promise<StaffTicket | null> {
  const data = await request<{ ok?: boolean; data?: StaffTicket }>(
    `/portal/support/staff/tickets/${ticketId}/assign`,
    token,
    { method: "POST", body: JSON.stringify({ assigneeId }) },
  );
  return data?.data ?? null;
}

/** Saca un ticket de la cola de spam. Con `assign:true` lo auto-asigna. */
export async function staffMarkNotSpam(
  ticketId: string,
  token: string,
  assign?: boolean,
): Promise<StaffTicket | null> {
  const data = await request<{ ok?: boolean; data?: StaffTicket }>(
    `/portal/support/staff/tickets/${ticketId}/not-spam`,
    token,
    { method: "POST", body: JSON.stringify(assign ? { assign: true } : {}) },
  );
  return data?.data ?? null;
}

/** Re-ejecuta el triage de spam sobre un ticket. Solo admin. */
export async function staffRetriageTicket(
  ticketId: string,
  token: string,
): Promise<void> {
  await request(`/portal/support/staff/tickets/${ticketId}/retriage`, token, {
    method: "POST",
  });
}

export type UploadProgressEvent = {
  loaded: number;
  total: number;
  pct: number;
};

export type UploadController = {
  promise: Promise<TicketAttachment>;
  abort: () => void;
};

/**
 * Upload a single support attachment to the backend (which forwards to R2).
 * Uses XMLHttpRequest so the modal can render upload progress and abort in-flight uploads.
 */
export function uploadTicketAttachment(
  file: File,
  token: string,
  onProgress?: (event: UploadProgressEvent) => void,
): UploadController {
  const xhr = new XMLHttpRequest();
  const url = `${ENV.apiUrl}/portal/support/upload`;

  const promise = new Promise<TicketAttachment>((resolve, reject) => {
    const form = new FormData();
    form.append("file", file, file.name);

    xhr.open("POST", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable || !onProgress) return;
      const total = event.total > 0 ? event.total : file.size;
      const pct = total > 0 ? (event.loaded / total) * 100 : 0;
      onProgress({ loaded: event.loaded, total, pct });
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as TicketAttachment & { ok?: boolean; error?: string };
          if (data && typeof data.url === "string") {
            resolve({
              url: data.url,
              type: data.type ?? file.type,
              name: data.name ?? file.name,
              size: data.size ?? file.size,
              key: data.key,
            });
            return;
          }
          reject(new Error("Respuesta inválida del servidor"));
        } catch {
          reject(new Error("Respuesta inválida del servidor"));
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText) as { error?: string };
          reject(new Error(data?.error ?? `HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Error de red al subir el archivo"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Carga cancelada"));
    });

    try {
      xhr.send(form);
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Error al subir"));
    }
  });

  return {
    promise,
    abort: () => {
      try { xhr.abort(); } catch { /* ignore */ }
    },
  };
}
