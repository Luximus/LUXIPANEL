/**
 * Jobs Marketplace — canal/bitácora del requerimiento (Fase 4): mensajes,
 * adjuntos (multipart RN), grants por REFERENCIA, URL del stream SSE y mapeo de
 * errores a claves i18n. Ver la fachada `../jobs.ts` para la convención general.
 */
import { request } from "../client";
import { ENV } from "../../config/env";
import type {
  AccessGrant,
  ChannelAttachment,
  ChannelMessage,
  ChannelParticipant,
  GrantResourceType,
} from "./types";

// ── Envelope canónico del backend ─────────────────────────────────────────────
type Envelope<T> = { ok: boolean; data: T };

// ── Canal / bitácora (§ messages + channel/upload + grants + stream) ──────────

const CHANNEL_PAGE = 30;

/** GET /portal/jobs/requirements/:id/messages?limit=&before= */
export async function getChannelMessages(
  token: string,
  reqId: string,
  opts?: { limit?: number; before?: string },
): Promise<{ messages: ChannelMessage[]; participants: ChannelParticipant[]; nextBefore: string | null }> {
  const qs = new URLSearchParams();
  qs.set("limit", String(opts?.limit ?? CHANNEL_PAGE));
  if (opts?.before) qs.set("before", opts.before);
  const res = await request<Envelope<{
    messages: ChannelMessage[]; participants: ChannelParticipant[]; nextBefore: string | null;
  }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/messages?${qs.toString()}`,
    token,
  );
  return {
    messages: res.data.messages ?? [],
    participants: res.data.participants ?? [],
    nextBefore: res.data.nextBefore ?? null,
  };
}

/** POST /portal/jobs/requirements/:id/messages */
export async function postChannelMessage(
  token: string,
  reqId: string,
  content: string,
  attachments?: ChannelAttachment[],
): Promise<ChannelMessage> {
  const body: Record<string, unknown> = { content };
  if (attachments && attachments.length) body.attachments = attachments;
  const res = await request<Envelope<{ message: ChannelMessage }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/messages`,
    token,
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.data.message;
}

// ── Subida de adjuntos del canal (multipart, campo 'file') ────────────────────
// DIFERENCIA vs desktop: en React Native NO existe `File`. Usamos el patrón
// XHR+FormData de la app (igual que `uploadBlogImage` en blog.ts): RN acepta el
// objeto `{uri,name,type}` en FormData y el runtime pone el boundary multipart.
// Solo enviamos `Authorization` + `x-client-platform` (NO fijar Content-Type).
// NO hereda step-up/refresh (el web/desktop tampoco lo manejan aquí). El
// endpoint devuelve `{ ok:true, data:{ url,key,name,type,size } }` (§C.3).

/** Archivo seleccionado para subir al canal (expo-image-picker / document-picker). */
export type JobsUploadFile = { uri: string; name: string; type: string };

/** POST /portal/jobs/requirements/:reqId/channel/upload → adjunto del canal. */
export function uploadChannelFile(
  token: string,
  reqId: string,
  file: JobsUploadFile,
): Promise<ChannelAttachment> {
  return new Promise<ChannelAttachment>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${ENV.apiUrl}/portal/jobs/requirements/${encodeURIComponent(reqId)}/channel/upload`;
    const form = new FormData();
    form.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);

    xhr.open("POST", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("x-client-platform", "app");

    xhr.addEventListener("load", () => {
      let data:
        | { ok?: boolean; data?: { url: string; key: string; name: string; type: string; size: number }; error?: string }
        | null = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error("Respuesta inválida del servidor"));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300 && data?.ok && data.data?.url) {
        const d = data.data;
        resolve({ url: d.url, type: d.type, name: d.name ?? file.name, size: d.size });
      } else {
        // Sin status en el `Error`: `jobsErrorKey` mapea por mensaje (incluye
        // 413/TOO_LARGE/ENTITY → `channel.attachTooLarge`).
        reject(new Error(data?.error ?? `HTTP ${xhr.status}`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Error de red al subir el adjunto")));
    xhr.addEventListener("abort", () => reject(new Error("Carga cancelada")));

    try {
      xhr.send(form as unknown as Document);
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Error al subir"));
    }
  });
}

/** GET /portal/jobs/requirements/:id/grants?includeRevoked= */
export async function getGrants(
  token: string,
  reqId: string,
  includeRevoked?: boolean,
): Promise<AccessGrant[]> {
  const qs = includeRevoked ? "?includeRevoked=true" : "";
  const res = await request<Envelope<{ grants: AccessGrant[] }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/grants${qs}`,
    token,
  );
  return res.data.grants ?? [];
}

/** POST /portal/jobs/requirements/:id/grants — comparte acceso por REFERENCIA.
 *  NUNCA material de llave: solo `resourceType`/`resourceRef`/`label`. */
export async function shareAccess(
  token: string,
  reqId: string,
  body: { resourceType: GrantResourceType; resourceRef: string; label?: string },
): Promise<AccessGrant> {
  const res = await request<Envelope<{ grant: AccessGrant; message: ChannelMessage }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/grants`,
    token,
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.data.grant;
}

/** POST /portal/jobs/requirements/:id/grants/:grantId/revoke */
export async function revokeGrant(token: string, reqId: string, grantId: string): Promise<AccessGrant> {
  const res = await request<Envelope<{ grant: AccessGrant }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/grants/${encodeURIComponent(grantId)}/revoke`,
    token,
    { method: "POST" },
  );
  return res.data.grant;
}

// ── Stream en vivo del canal (SSE) ────────────────────────────────────────────
// En React Native NO existe EventSource → la app NO consume este stream con
// EventSource. El canal en vivo se actualiza vía push Expo (señal) + refetch /
// pull-to-refresh (ver §D del contrato). El payload SSE/push es SOLO señal: el
// contenido SIEMPRE se re-trae con `getChannelMessages` / `getGrants` (auth).
// Mantenemos la URL exportada por paridad con web/desktop y por si la fase de
// integración añade un consumidor XHR; la pantalla NO debe abrir un EventSource.

/** URL del stream del canal de un requerimiento (token en query). */
export function jobsChannelStreamUrl(reqId: string, token: string): string {
  return `${ENV.apiUrl}/portal/jobs/requirements/${encodeURIComponent(reqId)}/stream?access_token=${encodeURIComponent(token)}`;
}

// ── Mapeo de errores a clave i18n ─────────────────────────────────────────────
// `request` aplana el error del backend a `Error(message)` SIN status, así que
// mapeamos por substring del mensaje (en MAYÚSCULAS), espejo de `errorMessage`
// de portal-jobs.ts. Devuelve la clave bajo el namespace `jobs.*` que la UI
// resuelve con `t.jobs[key]`.

/** Convierte el `Error` lanzado por `request` en una clave i18n `jobs.*`. */
export function jobsErrorKey(err: unknown): string {
  const m = (err instanceof Error ? err.message : String(err ?? "")).toUpperCase();
  // Eje MB/datos (metering IA) agotado vs. eje TOKENS del escrow (§F).
  if (m.includes("DIAMOND") || m.includes("SALDO") || m.includes("BALANCE")) return "ai.noBalance";
  // 402 escrow (tokens insuficientes).
  if (m.includes("INSUFFICIENT") && m.includes("TOKEN")) return "error.insufficientTokens";
  // Gate de moderación (§C): el requerimiento no es apto / falta moderar.
  if (m.includes("MODERAT") || m.includes("MODERA")) return "ai.notModerated";
  if (m.includes("CANCELL")) return "error.notCancellable";
  if (m.includes("OFFER") && m.includes("ACTIVE")) return "error.offerActive";
  // Fase 4: el canal aún no tiene contraparte (sin profesional asignado).
  if (m.includes("NO_ASSIGNEE") || m.includes("ASSIGNEE")) return "channel.notAssignedYet";
  // Fase 4: nunca se comparte material de llave por el canal (§E).
  if (m.includes("KEY_MATERIAL") || m.includes("MATERIAL")) return "grants.keyForbidden";
  // Adjunto demasiado grande (413).
  if (m.includes("TOO_LARGE") || m.includes("TOO LARGE") || m.includes("413") || m.includes("ENTITY")) {
    return "channel.attachTooLarge";
  }
  // Fase 11: gate de elegibilidad y 1-intento del test técnico.
  if (m.includes("JOB_TEST_REQUIRED")) return "test.gateRequired";
  if (m.includes("JOB_TEST_ATTEMPT_EXISTS") || m.includes("JOB_TEST_ATTEMPT_DONE")) return "test.attemptExists";
  if (m.includes("JOB_TEST_NOT_GENERATED")) return "test.notGenerated";
  if (m.includes("JOB_TEST_INVALID")) return "test.invalid";
  return "error.generic";
}
