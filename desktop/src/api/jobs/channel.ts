/**
 * Jobs Marketplace — canal / bitácora del requerimiento (Fase 4 §D):
 * mensajes, upload multipart, grants por REFERENCIA y URL del stream SSE.
 * Extraído de `src/api/jobs.ts` (fachada); los consumidores importan `../api/jobs`.
 *
 * NUNCA exponer/loguear secretos: los grants de acceso son por REFERENCIA
 * (`resourceType`/`resourceRef`/`label`), JAMÁS material de llave (el backend
 * rechaza con KEY_MATERIAL → `jobs.grants.keyForbidden`).
 */

import { request } from "../client";
import { ENV } from "../../config/env";
import type {
  AccessGrant, ChannelAttachment, ChannelMessage, ChannelParticipant,
  Envelope, GrantResourceType,
} from "./types";

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

/** POST /portal/jobs/requirements/:id/channel/upload (multipart, campo 'file').
 *  Usa `fetch` crudo (NO `request`, que fuerza Content-Type JSON): el boundary
 *  multipart lo pone el runtime; solo enviamos `Authorization`. El endpoint
 *  devuelve `{ ok:true, data:{ url,key,name,type,size } }` (§C.3).
 *  No hereda step-up/refresh (el web tampoco lo maneja aquí). */
export async function uploadChannelFile(
  token: string,
  reqId: string,
  file: File,
): Promise<ChannelAttachment> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(
    `${ENV.apiUrl}/portal/jobs/requirements/${encodeURIComponent(reqId)}/channel/upload`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd },
  );
  const data = (await res.json().catch(() => null)) as
    | { ok?: boolean; data?: { url: string; key: string; name: string; type: string; size: number }; error?: string }
    | null;
  if (!res.ok || !data?.ok || !data.data?.url) {
    throw new Error(data?.error ?? `HTTP ${res.status}`);
  }
  const d = data.data;
  return { url: d.url, type: d.type, name: d.name ?? file.name, size: d.size };
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

// ── SSE en vivo del canal (EventSource) ───────────────────────────────────────
// EventSource no admite headers → autenticación por ?access_token. El consumo
// del EventSource lo hace la UI (ChannelDrawer); aquí solo construimos la URL.
// El payload SSE es SOLO señal: el contenido se re-trae con `getChannelMessages`
// / `getGrants` (auth), nunca se pinta del payload.

/** URL del stream SSE del canal de un requerimiento (token en query). */
export function jobsChannelStreamUrl(reqId: string, token: string): string {
  return `${ENV.apiUrl}/portal/jobs/requirements/${encodeURIComponent(reqId)}/stream?access_token=${encodeURIComponent(token)}`;
}
