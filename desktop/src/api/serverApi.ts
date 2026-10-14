import { createVersionedReads, resourceForPath, dataResources, reportFreshness } from "../lib/native-live-read";
import { createReadCache, listReadTtl } from "../lib/list-read-cache";
/**
 * serverApi (desktop) — cliente headless de gestión de módulos del servidor.
 *
 * Espejo del de la app (RN) adaptado a Electron/web: la subida usa `File`/`Blob`
 * estándar y la descarga devuelve un `Blob` vía XHR. Habla con el gateway de
 * LP-LS (`/portal/servers/:panelId/api*`) que tuneliza por UNA conexión SSH a la
 * API REST del LUXIPANEL del cliente (`/api/<módulo>/*`). Sin UI: sólo la capa
 * de llamadas, lista para conectar una UI futura.
 */
import { ENV } from "../config/env";
import { request } from "./client";
import { reloginStandalone, type DirectSession } from "./directAuth";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type GatewayGuardCode = "NO_CREDENTIALS" | "FINGERPRINT_PENDING" | "PANEL_UNAVAILABLE";

export interface GatewayResponse<T = unknown> {
  ok: boolean;
  status?: number;
  data?: T;
  code?: GatewayGuardCode | string;
  error?: string;
}

export interface JobRef {
  id: string;
  mode?: string;
}

export interface JobStatus {
  state: "queued" | "processing" | "done" | "failed" | "unknown" | string;
  error?: string;
  applied?: boolean;
  viewReady?: boolean;
  resource?: string;
  [k: string]: unknown;
}

// ── Conexión DIRECTA (standalone, sin gateway LP-LS) ────────────────────────
// Espejo de `app/src/api/serverApi.ts`. Cuando un `serverId` está registrado
// aquí como directo, `callServerApi`/`download`/`upload` hablan DIRECTO al box
// (login-methods → login → 2fa vía `directAuth`) en vez de tunelizar por LP-LS.
// El gateway se conserva como fallback: si no hay target directo, camino LP-LS.

/** Cookie CSRF capturada del login directo (double-submit del panel). */
export interface DirectCsrf {
  name: string;
  value: string;
}

/**
 * Objetivo de un servidor STANDALONE gestionado por conexión DIRECTA. El
 * registro mapea `serverId → DirectTarget`; el despacho a las funciones de
 * módulo es transparente (no cambian de firma).
 */
export interface DirectTarget {
  /** Origen del panel, sin barra final y sin `/api` (p. ej. `https://panel.example.com`). */
  baseUrl: string;
  /** JWT de sesión del panel (cookie `luxipanel_session`), reenviado como Bearer. */
  jwt: string;
  /** Token CSRF para firmar mutaciones double-submit (cookie + header). */
  csrf: DirectCsrf | null;
  /** Vencimiento del JWT en ms epoch (0 = desconocido). */
  exp: number;
  /** Re-login al vencer/401: devuelve un target fresco (y actualiza el registro) o null. */
  relogin?: () => Promise<DirectTarget | null>;
}

const directRegistry = new Map<string, DirectTarget>();
const versionedReads = createVersionedReads();
export function getDirectServerIds():string[]{return [...directRegistry.keys()];}
const directSessionListeners=new Set<(serverId: string)=>void>();
export function subscribeDirectSessions(listener:(serverId: string)=>void):()=>void {directSessionListeners.add(listener);return()=>{directSessionListeners.delete(listener);};}
const directSessionRevisions = new Map<string, number>();
export const getDirectSessionRevision = (serverId: string) => directSessionRevisions.get(serverId) ?? 0;
function notifyDirectSessions(serverId: string) {
  directSessionRevisions.set(serverId, getDirectSessionRevision(serverId) + 1);
  for (const listener of directSessionListeners) listener(serverId);
}


/** Registra (o reemplaza) un servidor como conexión DIRECTA bajo `serverId`. */
export function registerDirectServer(serverId: string, target: DirectTarget): void {
  const previous = directRegistry.get(serverId);
  directRegistry.set(serverId, target);
  if (!previous || previous.baseUrl !== target.baseUrl || previous.jwt !== target.jwt) {
    versionedReads.clear(serverId); notifyDirectSessions(serverId);
  }
}

/** Quita un servidor del registro directo (vuelve al camino gateway si se consulta). */
export function unregisterDirectServer(serverId: string): void {
  versionedReads.clear(serverId);
  directRegistry.delete(serverId);
  notifyDirectSessions(serverId);
}

/** Devuelve el target directo de `serverId` si está registrado, si no `undefined`. */
export function getDirect(serverId: string): DirectTarget | undefined {
  return directRegistry.get(serverId);
}

/** ¿Hay algún servidor directo registrado? (para gating barato en la UI). */
export function hasDirectServers(): boolean {
  return directRegistry.size > 0;
}

/**
 * Construye un `DirectTarget` (con relogin silencioso) a partir de una sesión ya
 * capturada y lo registra bajo `serverId`. Equivalente al `ensureTarget` del
 * overlay standalone de la app: la UI llama a esto tras `loginStandalone` /
 * `verifyStandaloneTotp`, o al reabrir un servidor con sesión persistida.
 *
 * `getPassword` (opcional) habilita el re-login no interactivo ante un 401: si
 * devuelve la contraseña guardada, `relogin()` rehace el handshake y refresca el
 * registro; `onSession` (opcional) persiste la sesión fresca. Sin `getPassword`
 * el target funciona pero un 401 exigirá re-autenticación manual.
 */
export function ensureTarget(
  serverId: string,
  opts: {
    baseUrl: string;
    username: string;
    session: DirectSession;
    getPassword?: () => string | null | Promise<string | null>;
    onSession?: (session: DirectSession) => void;
  },
): DirectTarget {
  const relogin = async (): Promise<DirectTarget | null> => {
    if (!opts.getPassword) return null;
    const pw = await opts.getPassword();
    if (!pw) return null;
    const s = await reloginStandalone(opts.baseUrl, opts.username, pw);
    if (!s) return null;
    opts.onSession?.(s);
    const fresh: DirectTarget = { baseUrl: opts.baseUrl, jwt: s.jwt, csrf: s.csrf, exp: s.exp, relogin };
    registerDirectServer(serverId, fresh);
    return fresh;
  };
  const target: DirectTarget = {
    baseUrl: opts.baseUrl,
    jwt: opts.session.jwt,
    csrf: opts.session.csrf,
    exp: opts.session.exp,
    relogin,
  };
  registerDirectServer(serverId, target);
  return target;
}

/**
 * Ejecuta una petición DIRECTA contra el box standalone, normalizando la
 * respuesta al MISMO shape `GatewayResponse` que produce el gateway
 * (`{ ok, status, data }`, `data` = envelope del panel) para que `unwrap` /
 * `extractJob` / la UI funcionen sin cambios. En `401` intenta `relogin()` una
 * vez; si no recupera, reusa el guard `PANEL_UNAVAILABLE`.
 */
async function directRequest<T = unknown>(
  target: DirectTarget,
  method: HttpMethod,
  path: string,
  body?: unknown,
  retried = false,
): Promise<GatewayResponse<T>> {
  const isMutation = method !== "GET";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${target.jwt}`,
    "x-client-platform": "desktop",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };
  // CSRF double-submit en mutaciones: el panel compara cookie == header.
  if (isMutation && target.csrf) {
    headers["X-CSRF-Token"] = target.csrf.value;
    headers["Cookie"] = `${target.csrf.name}=${target.csrf.value}`;
  }

  // El proceso main de Electron hace el fetch real (sin CORS ni bloqueo de la
  // cabecera `Cookie`); en `dev:web` cae al fetch del navegador.
  let result: { ok: boolean; status: number; data: unknown };
  try {
    if (window.electronApi?.request) {
      result = await window.electronApi.request({
        url: `${target.baseUrl}${path}`,
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } else {
      const response = await fetch(`${target.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const data: unknown = await response.json().catch(() => ({}));
      result = { ok: response.ok, status: response.status, data };
    }
  } catch (e) {
    return { ok: false, status: 0, code: "PANEL_UNAVAILABLE", error: e instanceof Error ? e.message : "network_error" };
  }

  if (result.status === 401 && !retried && target.relogin) {
    const fresh = await target.relogin();
    if (fresh) return directRequest<T>(fresh, method, path, body, true);
    return { ok: false, status: 401, code: "PANEL_UNAVAILABLE", error: "auth_required" };
  }
  const panel = result.data && typeof result.data === "object"
    ? result.data as { ok?: boolean; error?: string; message?: string; code?: string }
    : null;
  return {
    ok: result.ok && panel?.ok !== false,
    status: result.status,
    data: result.data as T,
    ...(panel?.ok === false || !result.ok ? {
      error: panel?.error || panel?.message || `HTTP ${result.status}`,
      code: panel?.code,
    } : {}),
  };
}

// ── Primitiva genérica (cubre TODOS los módulos) ────────────────────────────

const unsupportedBootstrap = new Map<string, number>();
const sharedServerReads = createReadCache();
export function invalidateServerReads(serverId?: string) {
  if (serverId === undefined) {sharedServerReads.clear(); versionedReads.clear();}
  else sharedServerReads.invalidate(key => JSON.parse(key)[0] === serverId);
}
subscribeDirectSessions(invalidateServerReads);
export async function callServerApi<T = unknown>(panelId: string, token: string, method: HttpMethod, path: string, body?: unknown): Promise<GatewayResponse<T>> {
  if (method !== "GET") {
    const revision = getDirectSessionRevision(panelId);
    invalidateServerData(panelId);
    try { return await uncachedServerApi<T>(panelId, token, method, path, body); }
    finally { if (getDirectSessionRevision(panelId) === revision) invalidateServerData(panelId); }
  }
  const catalogKey = ({ "/api/ai/agents": "agents", "/api/ai/agent-roles": "roles", "/api/ai/projects": "projects", "/api/ai/config": "config", "/api/ai/connectors": "connectors" } as Record<string, string>)[path];
  const read = async <R,>(requestPath: string): Promise<GatewayResponse<R>> => {
    const revision = getDirectSessionRevision(panelId);
    const key = JSON.stringify([panelId, token, revision, requestPath]);
    const ttl = listReadTtl(requestPath);
    for (let attempt = 0; attempt < 3; attempt++) {
      if (getDirectSessionRevision(panelId) !== revision) break;
      try {
        const load = () => uncachedServerApi<R>(panelId, token, method, requestPath, undefined);
        const result = ttl === null ? await load() : await sharedServerReads.read(key, load, ttl);
        if (getDirectSessionRevision(panelId) === revision) return result;
        break;
      } catch (error) {
        if (getDirectSessionRevision(panelId) !== revision) break;
        if (error instanceof Error && error.message === "READ_INVALIDATED" && attempt < 2) continue;
        return {ok:false,code:"PANEL_UNAVAILABLE",status:0};
      }
    }
    return { ok: false, code: "NO_CREDENTIALS", status: 409 };
  };
  const bootstrapScope = JSON.stringify([panelId, token, getDirectSessionRevision(panelId)]);
  if (catalogKey && (unsupportedBootstrap.get(bootstrapScope) ?? 0) <= Date.now()) {
    const response = await read<{ catalogs?: Record<string, unknown> }>("/api/ai/bootstrap");
    if (response.status === 404) unsupportedBootstrap.set(bootstrapScope, Date.now() + 300_000);
    const payload = unwrap<{ catalogs?: Record<string, unknown> }>(response);
    const catalog = response.ok ? payload?.catalogs?.[catalogKey] : undefined;
    if (catalog) return { ...response, data: catalog as T };
  }
  return read<T>(path);
}

async function uncachedServerApi<T = unknown>(
  panelId: string,
  token: string,
  method: HttpMethod,
  path: string,
  body?: unknown,
): Promise<GatewayResponse<T>> {
  // Servidor STANDALONE registrado como directo → habla directo al box; si no,
  // camino gateway de LP-LS (managed). El resto de la capa es idéntico.
  const direct = getDirect(panelId);
  if (direct) {
    const revision = getDirectSessionRevision(panelId);
    const key = JSON.stringify([panelId, direct.baseUrl, direct.jwt, revision, path]);
    const result = method === "GET" && resourceForPath(path)
      ? await versionedReads.read(key, panelId, path, requestPath => directRequest<T>(direct, method, requestPath, body))
      : await directRequest<T>(direct, method, path, body);
    return revision === getDirectSessionRevision(panelId) ? result : {ok:false, status:409, code:"NO_CREDENTIALS"};
  }
  return request<GatewayResponse<T>>(`/portal/servers/${panelId}/api`, token, {
    method: "POST",
    body: JSON.stringify({ panelId, method, path, ...(body !== undefined ? { body } : {}) }),
  });
}

export function unwrap<T = unknown>(res: GatewayResponse): T | null {
  if (!res.ok) return null;
  const panel = res.data as { ok?: boolean; data?: T } | T | undefined;
  if (panel && typeof panel === "object" && "data" in (panel as object)) {
    return ((panel as { data?: T }).data ?? null) as T | null;
  }
  return (panel ?? null) as T | null;
}

export function extractJob(res: GatewayResponse): JobRef | null {
  const panel = res.data as { job?: JobRef; data?: { job?: JobRef } } | undefined;
  return panel?.job ?? panel?.data?.job ?? null;
}

// ── Cola write-behind (sondeo de jobs) ──────────────────────────────────────

export async function pollJob(
  panelId: string,
  token: string,
  jobId: string,
  opts: { intervalMs?: number; maxTries?: number } = {},
): Promise<JobStatus> {
  const identity = () => JSON.stringify([getDirect(panelId)?.baseUrl, getDirect(panelId)?.jwt]);
  const scope = identity();
  const intervalMs = Math.max(300, opts.intervalMs ?? 700);
  const maxTries = Math.max(1, opts.maxTries ?? 40);
  for (let i = 0; i < maxTries && identity() === scope; i++) {
    const res = await callServerApi<{ data?: JobStatus } & JobStatus>(panelId, token, "GET", `/api/jobs/${jobId}`);
    const status = (unwrap<JobStatus>(res) ?? (res.data as JobStatus | undefined)) ?? { state: "unknown" };
    if (identity() !== scope) return {state:"unknown"};
    if (status.state === "done" && status.viewReady === false && status.resource)
      reportFreshness(panelId, status.resource, {state:"stale", failedAt:Date.now()/1000});
    if (["done", "failed", "unknown"].includes(status.state)) return status;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { state: "unknown" };
}

export async function withJob(
  res: GatewayResponse,
  panelId: string,
  token: string,
  opts?: { intervalMs?: number; maxTries?: number },
): Promise<JobStatus | null> {
  const job = extractJob(res);
  if (!job || job.mode === "applied") return null;
  return pollJob(panelId, token, job.id, opts);
}

// ── Descarga binaria (stream) ───────────────────────────────────────────────

export async function downloadServerFile(panelId: string, token: string, panelPath: string): Promise<Blob> {
  const direct = getDirect(panelId);
  if (direct && window.electronApi?.downloadBinary) {
    const result = await window.electronApi.downloadBinary({
      url: `${direct.baseUrl}${panelPath}`,
      headers: { Authorization: `Bearer ${direct.jwt}`, "x-client-platform": "desktop" },
    });
    if (!result.ok || !result.bytes) throw new Error(result.error ?? `download_http_${result.status}`);
    return new Blob([new Uint8Array(result.bytes)]);
  }
  return new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (direct) {
      // Directo: el panel sirve la descarga por GET (`/api/files/download?path=`).
      // GET no requiere CSRF; el JWT va como Bearer. El blob sí lo lee el XHR del
      // renderer (a diferencia de Set-Cookie, la respuesta binaria es accesible).
      xhr.open("GET", `${direct.baseUrl}${panelPath}`);
      xhr.responseType = "blob";
      xhr.setRequestHeader("Authorization", `Bearer ${direct.jwt}`);
      xhr.setRequestHeader("x-client-platform", "desktop");
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300 && xhr.response) resolve(xhr.response as Blob);
        else reject(new Error(`download_http_${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error("download_network_error"));
      xhr.send();
      return;
    }
    xhr.open("POST", `${ENV.apiUrl}/portal/servers/${panelId}/api/stream`);
    xhr.responseType = "blob";
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response) resolve(xhr.response as Blob);
      else reject(new Error(`download_http_${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("download_network_error"));
    xhr.send(JSON.stringify({ panelId, path: panelPath }));
  });
}

// ── Subida binaria ──────────────────────────────────────────────────────────

export async function uploadServerFile(
  panelId: string,
  token: string,
  panelPath: string,
  file: File | Blob,
  filename?: string,
): Promise<GatewayResponse> {
  const direct = getDirect(panelId);
  if (direct) {
    // Directo: el panel espera el cuerpo RAW octet-stream (no multipart) con
    // `dest`/`filename` ya en la query de `panelPath` (lo parsea `express.raw`).
    const headers: Record<string, string> = {
      "Content-Type": "application/octet-stream",
      Authorization: `Bearer ${direct.jwt}`,
      "x-client-platform": "desktop",
    };
    if (direct.csrf) {
      headers["X-CSRF-Token"] = direct.csrf.value;
      headers["Cookie"] = `${direct.csrf.name}=${direct.csrf.value}`;
    }
    try {
      if (window.electronApi?.uploadBinary) {
        const result = await window.electronApi.uploadBinary({
          url: `${direct.baseUrl}${panelPath}`,
          headers,
          bytes: new Uint8Array(await file.arrayBuffer()),
        });
        return { ok: result.ok, status: result.status, data: result.data };
      }
      const response = await fetch(`${direct.baseUrl}${panelPath}`, { method: "POST", headers, body: file });
      const data: unknown = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, data };
    } catch (e) {
      return { ok: false, status: 0, code: "PANEL_UNAVAILABLE", error: e instanceof Error ? e.message : "network_error" };
    }
  }
  const form = new FormData();
  form.append("file", file, filename ?? (file as File).name ?? "upload.bin");
  const url = `${ENV.apiUrl}/portal/servers/${panelId}/api/upload?path=${encodeURIComponent(panelPath)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data: unknown = await response.json().catch(() => ({}));
  return data as GatewayResponse;
}

// ── Envoltorios tipados del NÚCLEO (usuarios / archivos / monitor) ───────────
// Para el resto de módulos: `callServerApi(panelId, token, METHOD, "/api/<m>/...")`.

export const serverUsersApi = {
  list: (panelId: string, token: string) => callServerApi(panelId, token, "GET", "/api/users"),
  sessions: (panelId: string, token: string) => callServerApi(panelId, token, "GET", "/api/users/sessions"),
  create: (panelId: string, token: string, body: unknown) => callServerApi(panelId, token, "POST", "/api/users", body),
  update: (panelId: string, token: string, id: string, body: unknown) =>
    callServerApi(panelId, token, "PUT", `/api/users/${encodeURIComponent(id)}`, body),
  remove: (panelId: string, token: string, id: string) =>
    callServerApi(panelId, token, "DELETE", `/api/users/${encodeURIComponent(id)}`),
  changePassword: (panelId: string, token: string, id: string, body: unknown) =>
    callServerApi(panelId, token, "PUT", `/api/users/${encodeURIComponent(id)}/password`, body),
  listRoles: (panelId: string, token: string) => callServerApi(panelId, token, "GET", "/api/roles"),
};

export const serverFilesApi = {
  list: (panelId: string, token: string, path: string) =>
    callServerApi(panelId, token, "GET", `/api/files/list?path=${encodeURIComponent(path)}`),
  read: (panelId: string, token: string, path: string) =>
    callServerApi(panelId, token, "GET", `/api/files/read?path=${encodeURIComponent(path)}`),
  write: (panelId: string, token: string, path: string, content: string) =>
    callServerApi(panelId, token, "PUT", "/api/files/write", { path, content }),
  mkdir: (panelId: string, token: string, path: string) =>
    callServerApi(panelId, token, "POST", "/api/files/mkdir", { path }),
  rename: (panelId: string, token: string, from: string, to: string) =>
    callServerApi(panelId, token, "PUT", "/api/files/rename", { from, to }),
  remove: (panelId: string, token: string, path: string) =>
    callServerApi(panelId, token, "DELETE", "/api/files", { path }),
  download: downloadServerFile,
  upload: uploadServerFile,
};

export const serverMonitorApi = {
  snapshot: (panelId: string, token: string) => callServerApi(panelId, token, "GET", "/api/monitor/snapshot"),
  system: (panelId: string, token: string) => callServerApi(panelId, token, "GET", "/api/monitor/system"),
  stats: (panelId: string, token: string) => callServerApi(panelId, token, "GET", "/api/monitor/stats"),
  services: (panelId: string, token: string) => callServerApi(panelId, token, "GET", "/api/monitor/services"),
  processes: (panelId: string, token: string) => callServerApi(panelId, token, "GET", "/api/monitor/processes"),
  alertRules: (panelId: string, token: string) => callServerApi(panelId, token, "GET", "/api/monitor/alerts/rules"),
  alertEvents: (panelId: string, token: string) => callServerApi(panelId, token, "GET", "/api/monitor/alerts/events"),
};

// ── Resto de módulos + vistas (CRUD principal; el resto via callServerApi) ───

const enc = encodeURIComponent;

/** Correo (mail): cuentas, reenvíos, filtros, bandeja IMAP/SMTP. */
export const serverMailApi = {
  listAccounts: (p: string, t: string) => callServerApi(p, t, "GET", "/api/accounts"),
  createAccount: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/accounts", body),
  updateAccount: (p: string, t: string, id: string, body: unknown) => callServerApi(p, t, "PUT", `/api/accounts/${enc(id)}`, body),
  deleteAccount: (p: string, t: string, id: string) => callServerApi(p, t, "DELETE", `/api/accounts/${enc(id)}`),
  listForwards: (p: string, t: string, accountId: string) => callServerApi(p, t, "GET", `/api/accounts/${enc(accountId)}/forwards`),
  setForwards: (p: string, t: string, accountId: string, body: unknown) => callServerApi(p, t, "PUT", `/api/accounts/${enc(accountId)}/forwards`, body),
  listFilters: (p: string, t: string, accountId: string) => callServerApi(p, t, "GET", `/api/accounts/${enc(accountId)}/filters`),
  createFilter: (p: string, t: string, accountId: string, body: unknown) => callServerApi(p, t, "POST", `/api/accounts/${enc(accountId)}/filters`, body),
  updateFilter: (p: string, t: string, accountId: string, filterId: string, body: unknown) => callServerApi(p, t, "PUT", `/api/accounts/${enc(accountId)}/filters/${enc(filterId)}`, body),
  deleteFilter: (p: string, t: string, accountId: string, filterId: string) => callServerApi(p, t, "DELETE", `/api/accounts/${enc(accountId)}/filters/${enc(filterId)}`),
  listFolders: (p: string, t: string, accountId: string) => callServerApi(p, t, "GET", `/api/mail/${enc(accountId)}/folders`),
  listMessages: (p: string, t: string, accountId: string, query = "") => callServerApi(p, t, "GET", `/api/mail/${enc(accountId)}/messages${query}`),
  send: (p: string, t: string, accountId: string, body: unknown) => callServerApi(p, t, "POST", `/api/mail/${enc(accountId)}/send`, body),
};

/** Obsidian: vaults + notas (incluye append/daily, ya con REST). */
export const serverObsidianApi = {
  listVaults: (p: string, t: string) => callServerApi(p, t, "GET", "/api/obsidian/vaults"),
  createVault: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/obsidian/vaults", body),
  deleteVault: (p: string, t: string, id: string) => callServerApi(p, t, "DELETE", `/api/obsidian/vaults/${enc(id)}`),
  tree: (p: string, t: string, id: string) => callServerApi(p, t, "GET", `/api/obsidian/vaults/${enc(id)}/tree`),
  readNote: (p: string, t: string, id: string, path: string) => callServerApi(p, t, "GET", `/api/obsidian/vaults/${enc(id)}/note?path=${enc(path)}`),
  writeNote: (p: string, t: string, id: string, path: string, content: string) => callServerApi(p, t, "PUT", `/api/obsidian/vaults/${enc(id)}/note`, { path, content }),
  appendNote: (p: string, t: string, id: string, path: string, content: string) => callServerApi(p, t, "POST", `/api/obsidian/vaults/${enc(id)}/note/append`, { path, content }),
  dailyNote: (p: string, t: string, id: string, content: string, date?: string) => callServerApi(p, t, "POST", `/api/obsidian/vaults/${enc(id)}/daily`, { content, ...(date ? { date } : {}) }),
  deleteNote: (p: string, t: string, id: string, path: string) => callServerApi(p, t, "DELETE", `/api/obsidian/vaults/${enc(id)}/note?path=${enc(path)}`),
  search: (p: string, t: string, id: string, q: string) => callServerApi(p, t, "GET", `/api/obsidian/vaults/${enc(id)}/search?q=${enc(q)}`),
};

/** Cron: tareas crontab + agentes IA programados. */
export const serverCronApi = {
  status: (p: string, t: string) => callServerApi(p, t, "GET", "/api/cron/status"),
  listJobs: (p: string, t: string) => callServerApi(p, t, "GET", "/api/cron/jobs"),
  createJob: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/cron/jobs", body),
  updateJob: (p: string, t: string, id: string, body: unknown) => callServerApi(p, t, "PUT", `/api/cron/jobs/${enc(id)}`, body),
  toggleJob: (p: string, t: string, id: string) => callServerApi(p, t, "POST", `/api/cron/jobs/${enc(id)}/toggle`),
  deleteJob: (p: string, t: string, id: string) => callServerApi(p, t, "DELETE", `/api/cron/jobs/${enc(id)}`),
  listAiJobs: (p: string, t: string) => callServerApi(p, t, "GET", "/api/cron/ai-jobs"),
  createAiJob: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/cron/ai-jobs", body),
  runAiJob: (p: string, t: string, id: string) => callServerApi(p, t, "POST", `/api/cron/ai-jobs/${enc(id)}/run`),
};

/** Notificaciones del servidor (server-alerts): prefs, envío, programadas, reglas. */
export const serverAlertsApi = {
  getPrefs: (p: string, t: string) => callServerApi(p, t, "GET", "/api/server-alerts/prefs"),
  setPrefs: (p: string, t: string, body: unknown) => callServerApi(p, t, "PUT", "/api/server-alerts/prefs", body),
  send: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/server-alerts/send", body),
  listScheduled: (p: string, t: string) => callServerApi(p, t, "GET", "/api/server-alerts/scheduled"),
  createScheduled: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/server-alerts/scheduled", body),
  updateScheduled: (p: string, t: string, id: string, body: unknown) => callServerApi(p, t, "PUT", `/api/server-alerts/scheduled/${enc(id)}`, body),
  deleteScheduled: (p: string, t: string, id: string) => callServerApi(p, t, "DELETE", `/api/server-alerts/scheduled/${enc(id)}`),
  listRules: (p: string, t: string) => callServerApi(p, t, "GET", "/api/server-alerts/rules"),
  createRule: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/server-alerts/rules", body),
  updateRule: (p: string, t: string, id: string, body: unknown) => callServerApi(p, t, "PUT", `/api/server-alerts/rules/${enc(id)}`, body),
  deleteRule: (p: string, t: string, id: string) => callServerApi(p, t, "DELETE", `/api/server-alerts/rules/${enc(id)}`),
};

/** Campana de notificaciones in-panel (módulo notifications). */
export const serverNotificationsApi = {
  list: (p: string, t: string, query = "") => callServerApi(p, t, "GET", `/api/notifications${query}`),
  unreadCount: (p: string, t: string) => callServerApi(p, t, "GET", "/api/notifications/unread-count"),
  markRead: (p: string, t: string, id: string) => callServerApi(p, t, "PATCH", `/api/notifications/${enc(id)}/read`),
  readAll: (p: string, t: string) => callServerApi(p, t, "POST", "/api/notifications/read-all"),
  remove: (p: string, t: string, id: string) => callServerApi(p, t, "DELETE", `/api/notifications/${enc(id)}`),
  clear: (p: string, t: string) => callServerApi(p, t, "DELETE", "/api/notifications"),
};

/** Expo (EAS): config, proyectos, builds, env. */
export const serverExpoApi = {
  getConfig: (p: string, t: string) => callServerApi(p, t, "GET", "/api/expo/config"),
  setConfig: (p: string, t: string, body: unknown) => callServerApi(p, t, "PUT", "/api/expo/config", body),
  deleteConfig: (p: string, t: string) => callServerApi(p, t, "DELETE", "/api/expo/config"),
  projects: (p: string, t: string, root = "") => callServerApi(p, t, "GET", `/api/expo/projects${root ? `?root=${enc(root)}` : ""}`),
  build: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/expo/build", body),
  buildList: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/expo/build-list", body),
  buildView: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/expo/build-view", body),
  buildCancel: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/expo/build-cancel", body),
  submit: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/expo/submit", body),
  update: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/expo/update", body),
  envList: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/expo/env-list", body),
  envSet: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/expo/env-set", body),
  envUpdate: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/expo/env-update", body),
  envDelete: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/expo/env-delete", body),
};

/** Vista Módulos: catálogo + mostrar/ocultar/reordenar. */
export const serverModulesViewApi = {
  installed: (p: string, t: string) => callServerApi(p, t, "GET", "/api/modules/installed"),
  list: (p: string, t: string) => callServerApi(p, t, "GET", "/api/admin/modules"),
  toggle: (p: string, t: string, id: string, enabled: boolean) => callServerApi(p, t, "PATCH", `/api/admin/modules/${enc(id)}`, { enabled }),
  reorder: (p: string, t: string, order: string[]) => callServerApi(p, t, "PUT", "/api/admin/modules/order", { order }),
};

/** Vista Ajustes: settings + seguridad propia (2FA/passkeys/recovery). */
export const serverSettingsApi = {
  getAll: (p: string, t: string) => callServerApi(p, t, "GET", "/api/settings"),
  getCategory: (p: string, t: string, category: string) => callServerApi(p, t, "GET", `/api/settings/${enc(category)}`),
  set: (p: string, t: string, body: unknown) => callServerApi(p, t, "PUT", "/api/settings", body),
  setBulk: (p: string, t: string, body: unknown) => callServerApi(p, t, "PUT", "/api/settings/bulk", body),
  remove: (p: string, t: string, key: string) => callServerApi(p, t, "DELETE", `/api/settings/${enc(key)}`),
  totpStatus: (p: string, t: string) => callServerApi(p, t, "GET", "/api/auth/totp/status"),
  totpSetup: (p: string, t: string) => callServerApi(p, t, "GET", "/api/auth/totp/setup"),
  totpEnable: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/auth/totp/enable", body),
  listPasskeys: (p: string, t: string) => callServerApi(p, t, "GET", "/api/auth/passkeys"),
  recoveryStatus: (p: string, t: string) => callServerApi(p, t, "GET", "/api/auth/recovery/status"),
};

export function invalidateServerData(serverId: string, resources?: string[]) {
  versionedReads.invalidate(key => { const parts = JSON.parse(key) as unknown[]; return parts[0] === serverId && (!resources || Object.entries(dataResources).some(([path, resource]) => resources.includes(resource) && String(parts[4]).startsWith(path))); });
  sharedServerReads.invalidate(key => { const parts = JSON.parse(key) as unknown[]; return parts[0] === serverId && (!resources || Object.entries(dataResources).some(([path, resource]) => resources.includes(resource) && String(parts[3]).startsWith(path))); });
}
