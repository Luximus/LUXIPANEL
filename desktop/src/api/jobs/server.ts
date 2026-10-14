/**
 * Jobs Marketplace — modalidad "Servidor" (AI Dev Marketplace): servidores del
 * usuario, proveedores IA del panel y sesión/exec del acceso efímero.
 * Extraído de `src/api/jobs.ts` (fachada); los consumidores importan `../api/jobs`.
 */

import { request } from "../client";
import type { Envelope, JobServer, ServerSessionView } from "./types";

// ── Modalidad "Servidor" (AI Dev Marketplace) ─────────────────────────────────

/** GET /portal/jobs/servers → servidores registrados del usuario (para selectores). */
export async function listMyServers(token: string): Promise<JobServer[]> {
  const res = await request<{ ok: boolean; data: JobServer[] }>(
    "/portal/jobs/servers",
    token,
  );
  return (res.data ?? []) as JobServer[];
}

/** POST /portal/ssh/assistant/providers → proveedores IA habilitados en un panel. */
export async function listServerProviders(
  token: string,
  panelId: string,
): Promise<{ providers: string[]; activeProvider?: string }> {
  try {
    const res = await request<{ ok: boolean; data?: { providers: string[]; activeProvider?: string } }>(
      "/portal/ssh/assistant/providers",
      token,
      { method: "POST", body: JSON.stringify({ panelId }) },
    );
    return res.data ?? { providers: [] };
  } catch {
    return { providers: [] };
  }
}

/** GET …/server/session → estado sanitizado de la sesión (buyer|assignee). */
export async function getServerSession(token: string, reqId: string): Promise<ServerSessionView | null> {
  const res = await request<Envelope<{ session: ServerSessionView | null }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/server/session`,
    token,
  );
  return res.data.session ?? null;
}

/** POST …/server/reprovision → reintenta el acceso efímero (assignee). */
export async function reprovisionServer(token: string, reqId: string): Promise<{ status: string }> {
  const res = await request<Envelope<{ status: string }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/server/reprovision`,
    token,
    { method: "POST", body: JSON.stringify({}) },
  );
  return res.data;
}

/** POST …/server/exec → ejecuta un comando sobre el servidor del cliente (assignee). */
export async function execServerCommand(
  token: string,
  reqId: string,
  command: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const res = await request<Envelope<{ stdout: string; stderr: string; exitCode: number }>>(
    `/portal/jobs/requirements/${encodeURIComponent(reqId)}/server/exec`,
    token,
    { method: "POST", body: JSON.stringify({ command }) },
  );
  return res.data;
}
