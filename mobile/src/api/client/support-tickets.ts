// Soporte: identidad del asistente, tickets (cliente + staff), bandeja de
// tareas del asistente y subida de adjuntos.
import { ENV } from "../../config/env";
import type {
  StaffAgent,
  Ticket,
  TicketAttachment,
  TicketDetail,
  TicketMessage,
} from "../../types/models";
import { readCache, request, TTL } from "./request";

// ─── Identidad del asistente de soporte (roster rotativo) ─────────────────
// El asistente de soporte ya no es un "Lux" fijo: el backend rota entre 5
// asistentes por turnos y expone la identidad ACTIVA. Contrato (autoridad):
// `backend/src/modules/support/ASSISTANT_ROSTER_CONTRACT.md`.
// Shape: `{ id, name, avatarUrl }`. `avatarUrl` sigue la convención
// `support/<id>/<n>.webp`; puede llegar absoluta o relativa al sitio.
export type SupportAssistantIdentity = {
  id: string;
  name: string;
  /** URL ABSOLUTA del avatar, ya resuelta (lista para `<Image source={{ uri }} />`). */
  avatarUrl: string;
};

/**
 * Resuelve a URL absoluta el `avatarUrl` que entrega el backend. Si ya es
 * absoluta (`http(s)://…`) se usa tal cual; si llega relativa (convención del
 * contrato `/support/<Folder>/<n>.webp`) se antepone el ORIGEN DEL SITIO que
 * sirve `public/` (frontend, `ENV.luxipanelUrl`), no el API: esos binarios los
 * sirve el frontend desde `public/support/…`, NO el backend (anteponer la base
 * del API daría 404). Así `<Image source={{ uri }}>` siempre recibe una URI
 * cargable. Devuelve "" si no hay valor.
 */
export function resolveAssistantAvatarUrl(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim() === "") return "";
  const url = raw.trim();
  if (/^https?:\/\//i.test(url)) return url;
  const base = ENV.luxipanelUrl.replace(/\/+$/, "");
  return `${base}/${url.replace(/^\/+/, "")}`;
}

/**
 * Lee la identidad del asistente ACTIVO. Prioriza el endpoint dedicado de
 * identidad y normaliza el avatar a URL absoluta. Nunca lanza: si falla, el
 * widget cae a su fallback ("Soporte" + placeholder).
 */
export async function getSupportAssistantIdentity(
  token: string,
): Promise<SupportAssistantIdentity | null> {
  try {
    const data = await request<{
      ok?: boolean;
      data?: { id?: unknown; name?: unknown; avatarUrl?: unknown };
    }>("/portal/support/chat/identity", token);
    const a = data?.data;
    if (!a) return null;
    const id = typeof a.id === "string" ? a.id : "";
    const name = typeof a.name === "string" ? a.name : "";
    const avatarUrl = resolveAssistantAvatarUrl(a.avatarUrl);
    if (!name) return null;
    return { id, name, avatarUrl };
  } catch {
    return null;
  }
}

export function getTickets(token: string): Promise<Ticket[]> {
  return readCache.fetch(`tickets|${token}`, async () => {
    const data = await request<{ tickets: Ticket[] }>("/portal/support/tickets", token);
    return data.tickets;
  }, { ttlMs: TTL.tickets });
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
  return request<{ message: TicketMessage }>(
    `/portal/support/tickets/${ticketId}/messages`,
    token,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
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

export async function deleteTicket(ticketId: string, token: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/portal/support/tickets/${ticketId}`, token, {
    method: "DELETE",
  });
}

// ─── Admin de tickets (staff) ─────────────────────────────────────────────
// Contrato backend (prefijo /portal, Bearer; solo admin). Espejo del admin de
// soporte de la web: cola general + cola de spam/triage + reasignación.

/** Cola general de tickets de staff (todos los tickets, vista admin). */
export async function staffListTickets(token: string): Promise<Ticket[]> {
  const data = await request<{ ok?: boolean; data?: Ticket[] }>(
    "/portal/support/staff/tickets",
    token,
  );
  return Array.isArray(data.data) ? data.data : [];
}

/** Cola de spam / triage (tickets marcados como spam por el triage). */
export async function staffListSpam(token: string): Promise<Ticket[]> {
  const data = await request<{ ok?: boolean; data?: Ticket[] }>(
    "/portal/support/staff/spam",
    token,
  );
  return Array.isArray(data.data) ? data.data : [];
}

/** Agentes asignables: equipo de soporte + admins. */
export async function staffListAgents(
  token: string,
): Promise<{ support: StaffAgent[]; admins: StaffAgent[] }> {
  const data = await request<{ ok?: boolean; data?: { support?: StaffAgent[]; admins?: StaffAgent[] } }>(
    "/portal/support/staff/agents",
    token,
  );
  return {
    support: Array.isArray(data.data?.support) ? data.data!.support : [],
    admins: Array.isArray(data.data?.admins) ? data.data!.admins : [],
  };
}

/** Asigna (o reasigna) un ticket a un agente. */
export async function staffAssignTicket(
  ticketId: string,
  assigneeId: string,
  token: string,
): Promise<{ ticket: Ticket }> {
  const data = await request<{ ok?: boolean; data?: Ticket }>(
    `/portal/support/staff/tickets/${ticketId}/assign`,
    token,
    { method: "POST", body: JSON.stringify({ assigneeId }) },
  );
  return { ticket: data.data as Ticket };
}

/**
 * Saca un ticket de la cola de spam (no es spam). Si `assign` es true el backend
 * lo asigna al agente que lo rescata.
 */
export async function staffMarkNotSpam(
  ticketId: string,
  token: string,
  assign?: boolean,
): Promise<{ ticket: Ticket }> {
  const data = await request<{ ok?: boolean; data?: Ticket }>(
    `/portal/support/staff/tickets/${ticketId}/not-spam`,
    token,
    { method: "POST", body: JSON.stringify(typeof assign === "boolean" ? { assign } : {}) },
  );
  return { ticket: data.data as Ticket };
}

/** Vuelve a pasar el ticket por el triage de spam. */
export async function staffRetriageTicket(
  ticketId: string,
  token: string,
): Promise<{ ok: boolean }> {
  const data = await request<{ ok?: boolean }>(
    `/portal/support/staff/tickets/${ticketId}/retriage`,
    token,
    { method: "POST" },
  );
  return { ok: data.ok !== false };
}

export type UploadProgressEvent = {
  loaded: number;
  total: number;
  pct: number;
};

export type UploadFileInput = {
  uri: string;
  name: string;
  type: string;
  size?: number;
};

export type UploadController = {
  promise: Promise<TicketAttachment>;
  abort: () => void;
};

/**
 * RN equivalent of the desktop XHR-based upload — uses XMLHttpRequest (which
 * RN polyfills) so the modal can render upload progress and abort uploads.
 */
export function uploadTicketAttachment(
  file: UploadFileInput,
  token: string,
  onProgress?: (event: UploadProgressEvent) => void,
): UploadController {
  const xhr = new XMLHttpRequest();
  const url = `${ENV.apiUrl}/portal/support/upload`;

  const promise = new Promise<TicketAttachment>((resolve, reject) => {
    const form = new FormData();
    // RN's FormData accepts the {uri,name,type} object pattern for files.
    form.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);

    xhr.open("POST", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("x-client-platform", "app");

    if (xhr.upload && onProgress) {
      xhr.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;
        const total = event.total > 0 ? event.total : file.size ?? 0;
        const pct = total > 0 ? (event.loaded / total) * 100 : 0;
        onProgress({ loaded: event.loaded, total, pct });
      });
    }

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
      xhr.send(form as unknown as Document);
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
