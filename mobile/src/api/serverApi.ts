import { createVersionedReads, resourceForPath, dataResources, reportFreshness } from "../lib/native-live-read";
import { listReadTtl } from "../lib/list-read-cache";
import { registerStoreReset } from "../lib/store-reset";
/**
 * Native module transport for a directly connected LUXIPANEL server.
 * LP-LS retired the old /portal/servers/:id/api gateway. A request without a
 * registered direct session fails closed, including binary file operations.
 */
import { createRequestCache } from "../lib/request-cache";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Códigos de guarda del gateway (no son errores HTTP del panel). */
export type GatewayGuardCode = "NO_CREDENTIALS" | "FINGERPRINT_PENDING" | "PANEL_UNAVAILABLE" | "DIRECT_AUTH_REQUIRED";

/** Cookie CSRF capturada del login directo (double-submit del panel). */
export interface DirectCsrf {
  name: string;
  value: string;
}

/**
 * Sesión directa de un servidor, sea del directorio o standalone. El registro
 * mapea `serverId → DirectTarget`; las llamadas de módulo usan su `baseUrl`.
 */
export interface DirectTarget {
  /** Origen del panel, sin barra final y sin `/api` (p. ej. `https://panel.example.com`). */
  baseUrl: string;
  /** Workspace identity; bridge is memory-only and never falls back to local. */
  bridgeSessionId?: string;
  parentPanelId?: string;
  targetId?: string;
  /** JWT de sesión del panel (cookie `luxipanel_session`), reenviado como Bearer. */
  jwt: string;
  /** Token CSRF para firmar mutaciones double-submit (cookie + header). */
  csrf: DirectCsrf | null;
  /** Vencimiento del JWT en ms epoch (0 = desconocido). */
  exp: number;
  /** Re-login al vencer/401: devuelve un target fresco (y actualiza el registro) o null. */
  relogin?: () => Promise<DirectTarget | null>;
}

let authRequiredHandler: ((profileId: string) => void) | undefined;
export function onDirectAuthRequired(handler: (profileId: string) => void): () => void { authRequiredHandler = handler; return () => { if (authRequiredHandler === handler) authRequiredHandler = undefined; }; }
function authRequired(target: DirectTarget) { const id = target.parentPanelId ?? [...directRegistry].find(([,value]) => value === target)?.[0]; if (id) authRequiredHandler?.(id); }
const directRegistry = new Map<string, DirectTarget>();
const versionedReads = createVersionedReads();
export function getDirectServerIds():string[]{return [...directRegistry.keys()];}
const directIdentityRevisions = new Map<string, number>();
function principalOf(jwt: string): string {
  try { const claims = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); return JSON.stringify([claims.userId ?? claims.sub, claims.username, claims.kind]); }
  catch { return jwt; }
}
function changeDirectIdentity(serverId: string) { directIdentityRevisions.set(serverId, (directIdentityRevisions.get(serverId) ?? 0) + 1); }
const directSessionRevisions = new Map<string, number>();
const directSessionListeners = new Set<() => void>();
export function subscribeDirectSessions(listener: () => void): () => void {
  directSessionListeners.add(listener);
  return () => { directSessionListeners.delete(listener); };
}
export function getDirectSessionRevision(serverId: string): number { return directSessionRevisions.get(serverId) ?? 0; }
function changedDirectSession(serverId: string): void {
  directSessionRevisions.set(serverId, getDirectSessionRevision(serverId) + 1);
  for (const listener of directSessionListeners) listener();
}

/** Registra (o reemplaza) un servidor como conexión DIRECTA bajo `serverId`. */
export function registerDirectServer(serverId: string, target: DirectTarget): void {
  const previous = directRegistry.get(serverId);
  if (!previous || previous.baseUrl !== target.baseUrl || previous.bridgeSessionId !== target.bridgeSessionId || principalOf(previous.jwt) !== principalOf(target.jwt)) changeDirectIdentity(serverId);
  directRegistry.set(serverId, target);
  if (!previous || previous.baseUrl !== target.baseUrl || previous.jwt !== target.jwt || previous.bridgeSessionId !== target.bridgeSessionId) {
    invalidateServerCache(serverId); versionedReads.clear(serverId); changedDirectSession(serverId);
  }
  if (!target.parentPanelId) {
    for (const [id, child] of directRegistry) {
      if (child.parentPanelId !== serverId) continue;
      if (previous && (previous.baseUrl !== target.baseUrl || principalOf(previous.jwt) !== principalOf(target.jwt))) { unregisterDirectServer(id); continue; }
      registerDirectServer(id, { ...child, baseUrl: target.baseUrl, jwt: target.jwt, csrf: target.csrf, exp: target.exp });
    }
  }
}

/** Quita un servidor del registro directo (hace que las siguientes consultas fallen cerrado). */
export function unregisterDirectServer(serverId: string): void {
  invalidateServerCache(serverId);
  versionedReads.clear(serverId);
  directRegistry.delete(serverId);
  for (const [id, child] of directRegistry) if (child.parentPanelId === serverId) unregisterDirectServer(id);
  changeDirectIdentity(serverId);
  changedDirectSession(serverId);
}

/** Devuelve el target directo de `serverId` si está registrado, si no `undefined`. */
export function getDirect(serverId: string): DirectTarget | undefined {
  return directRegistry.get(serverId);
}

registerStoreReset(() => {
  for (const serverId of [...directRegistry.keys()]) unregisterDirectServer(serverId);
});

/** ¿Hay algún servidor directo registrado? (para gating barato en la UI). */
export function hasDirectServers(): boolean {
  return directRegistry.size > 0;
}

// ── Transporte DIRECTO (standalone, sin gateway) ────────────────────────────

/**
 * Ejecuta una petición DIRECTA contra el box standalone, normalizando la
 * respuesta al MISMO shape `GatewayResponse` que produce el gateway
 * (`{ ok, status, data }`, `data` = envelope del panel) para que `unwrap` /
 * `extractJob` / las pantallas funcionen sin cambios. En `401` intenta
 * `relogin()` una vez; si no recupera, devuelve `code:"DIRECT_AUTH_REQUIRED"`.
 */
async function directRequest<T = unknown>(
  target: DirectTarget,
  method: HttpMethod,
  path: string,
  body?: unknown,
  retried = false,
  timeoutMs = 120000,
): Promise<GatewayResponse<T>> {
  const isMutation = method !== "GET";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${target.jwt}`,
    "x-client-platform": "app",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };
  if (target.bridgeSessionId) headers["X-Bridge-Session-Id"] = target.bridgeSessionId;
  // CSRF double-submit en mutaciones: el panel compara cookie == header. Mandamos
  // ambos explícitos (independiente del cookie-jar nativo) con el valor capturado.
  if (isMutation && target.csrf) {
    headers["X-CSRF-Token"] = target.csrf.value;
    headers["Cookie"] = `${target.csrf.name}=${target.csrf.value}`;
  }
  let response: Response;
  const abort = new AbortController();
  const deadline = setTimeout(() => abort.abort(), Math.max(1000, timeoutMs));
  try {
    response = await fetch(`${target.baseUrl}${path}`, {
      method,
      credentials: "omit",
      headers,
      signal: abort.signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    // Box inalcanzable: reusa el guard PANEL_UNAVAILABLE (la UI ya lo maneja).
    return { ok: false, status: 0, code: "PANEL_UNAVAILABLE", error: e instanceof Error ? e.message : "network_error" };
  }
  finally { clearTimeout(deadline); }
  if (response.status === 401 && !retried && target.relogin) {
    const fresh = await target.relogin();
    if (fresh) return directRequest<T>(fresh, method, path, body, true, timeoutMs);
    // Sesión vencida y sin re-login silencioso posible: reusa el guard
    // PANEL_UNAVAILABLE (todas las pantallas lo muestran localizado + reintento).
    authRequired(target);
    return { ok: false, status: 401, code: "DIRECT_AUTH_REQUIRED", error: "auth_required" };
  }
  if (response.status === 401) {
    authRequired(target);
    return { ok: false, status: 401, code: "DIRECT_AUTH_REQUIRED", error: "auth_required" };
  }
  const contentType = response.headers?.get("content-type") ?? "";
  const data: unknown = contentType && !contentType.includes("json") ? await response.text() : await response.json().catch(() => ({}));
  const panel = data && typeof data === "object" ? data as { ok?: boolean; code?: string; error?: string; message?: string } : null;
  return {
    ok: response.ok && panel?.ok !== false,
    status: response.status,
    data: data as T,
    code: panel?.ok === false ? panel.code : undefined,
    error: panel?.ok === false ? (panel.error ?? panel.message) : undefined,
  };
}

/** Respuesta cruda del gateway. `data` = envelope del panel (o texto si no-JSON). */
export interface GatewayResponse<T = unknown> {
  liveResource?: {serverId: string; resource: string};
  /** ok a nivel gateway = el status interno del panel fue < 400. */
  ok: boolean;
  /** Status HTTP interno del panel (0 si una guarda cortó antes del túnel). */
  status?: number;
  /** Envelope de respuesta del panel. */
  data?: T;
  /** Código de guarda cuando el gateway no pudo alcanzar el panel. */
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

// ── Primitiva genérica (cubre TODOS los módulos) ────────────────────────────

// ── Caché de LECTURAS del gateway (TTL + single-flight) ─────────────────────
// Cada GET de módulo cruza la red. Sin caché, entrar a una
// pantalla de módulo, volver y re-entrar (o abrirla desde dos superficies)
// repetía el mismo round-trip; y dos recursos que se piden a la vez en el mismo
// montaje salían por duplicado si compartían ruta.
//
// Reglas (conservadoras, para NO servir datos rancios):
//  - solo se cachean GET,
//  - TTL corto (`GATEWAY_GET_TTL_MS`),
//  - CUALQUIER mutación (POST/PUT/PATCH/DELETE) sobre un panel tira TODAS las
//    lecturas cacheadas de ESE panel (incluidas las que estén en vuelo),
//  - el refresco EXPLÍCITO (pull-to-refresh / `reload()`) salta la caché con
//    `withFreshGateway`.
const gatewayCache = createRequestCache();

/** Ventana de frescura de un GET de módulo. Corta: solo cubre el remonte de una
 *  pantalla y las lecturas duplicadas del mismo montaje. */
export const GATEWAY_GET_TTL_MS = 20_000;

/**
 * GETs que NUNCA se cachean por TTL (sí se deduplican en vuelo): son LIVE o se
 * SONDEAN en bucle, y servirlos de memoria los congelaría.
 *  - `/api/jobs/:id`  → sondeo de la cola write-behind: cachear su estado dejaría
 *    el job "queued" para siempre.
 *  - `/api/monitor/*` → stat cards en vivo (MonitorScreen sondea cada 8 s).
 *  - `/api/notifications*` → campana: debe reflejar lo recién llegado/leído.
 */
const LIVE_GET = /^\/api\/(jobs|monitor|notifications|chat|preferences|me)\b/;

/** ¿Este GET admite caché por TTL? (expuesto para los tests). */
export function isCacheableGet(method: HttpMethod, path: string): boolean {
  return method === "GET" && !LIVE_GET.test(path);
}

/** Profundidad de "lecturas frescas" en curso (`withFreshGateway`). */
let freshDepth = 0;

/**
 * Ejecuta `fn` saltándose el VALOR cacheado del gateway (sigue uniéndose a una
 * petición ya en vuelo, que por definición trae datos de ahora). Lo usa el
 * refresco explícito del usuario: pull-to-refresh y el `reload()` posterior a
 * una mutación.
 */
export async function withFreshGateway<T>(fn: () => Promise<T>): Promise<T> {
  freshDepth += 1;
  try {
    return await fn();
  } finally {
    freshDepth -= 1;
  }
}

/** Tira las lecturas cacheadas de un panel (o de todos si no se pasa `panelId`). */
export function invalidateServerCache(panelId?: string): void {
  versionedReads.invalidate(key => !panelId || JSON.parse(key)[0] === panelId);
  if (panelId) gatewayCache.invalidatePrefix(`${panelId}|`);
  else gatewayCache.clear();
}

/**
 * Llama una ruta `/api/<módulo>/*` permitida del panel. La allowlist del gateway
 * decide qué se puede alcanzar; el panel reaplica sus permisos por módulo/ruta.
 */
const unsupportedBootstrap = new Map<string, number>();
export async function callServerApi<T = unknown>(panelId: string, token: string, method: HttpMethod, path: string, body?: unknown, opts?: { timeoutMs?: number }): Promise<GatewayResponse<T>> {
  const catalogKey = ({ "/api/ai/agents": "agents", "/api/ai/agent-roles": "roles", "/api/ai/projects": "projects", "/api/ai/config": "config", "/api/ai/connectors": "connectors" } as Record<string, string>)[path];
  const scope = JSON.stringify([panelId, getDirectSessionRevision(panelId)]);
  if (method === "GET" && catalogKey && (unsupportedBootstrap.get(scope) ?? 0) <= Date.now()) {
    const response = await uncachedServerApi<{ catalogs?: Record<string, unknown> }>(panelId, token, "GET", "/api/ai/bootstrap", undefined, opts);
    if (response.status === 404) unsupportedBootstrap.set(scope, Date.now() + 300_000);
    const payload = unwrap<{ catalogs?: Record<string, unknown> }>(response);
    const catalog = response.ok ? payload?.catalogs?.[catalogKey] : undefined;
    if (catalog) return { ...response, data: catalog as T };
  }
  return uncachedServerApi<T>(panelId, token, method, path, body, opts);
}

function uncachedServerApi<T = unknown>(
  panelId: string,
  token: string,
  method: HttpMethod,
  path: string,
  body?: unknown,
  opts?: { timeoutMs?: number },
): Promise<GatewayResponse<T>> {
  if (method !== "GET") {
    // Mutación: las lecturas cacheadas de este panel dejan de ser válidas AHORA
    // (no al volver la respuesta: una lectura concurrente no debe re-cachear lo
    // viejo). Ver `request-cache`: invalidar en vuelo descarta ese resultado.
    const revision = getDirectSessionRevision(panelId);
    invalidateServerCache(panelId);
    return rawServerCall<T>(panelId, token, method, path, body, opts).finally(() => {
      if (getDirectSessionRevision(panelId) === revision) invalidateServerCache(panelId);
    });
  }
  // Los GET LIVE igualmente pasan por el caché, pero con TTL 0 → solo dedupe de
  // peticiones en vuelo (dos superficies pidiendo lo mismo a la vez = 1 túnel).
  const ttlMs = listReadTtl(path) ?? 0;
  return gatewayCache.fetch(
    `${panelId}|${getDirectSessionRevision(panelId)}|${path}`,
    () => rawServerCall<T>(panelId, token, method, path, body, opts),
    { ttlMs, force: freshDepth > 0 },
  );
}

async function rawServerCall<T>(
  panelId: string,
  _token: string,
  method: HttpMethod,
  path: string,
  body?: unknown,
  _opts?: { timeoutMs?: number },
): Promise<GatewayResponse<T>> {
  // LP-LS retiró el gateway de módulos. Nunca enviar una operación a una ruta
  // inexistente ni a otro servidor cuando falta la sesión directa del panel.
  const direct = getDirect(panelId);
  if (direct) {
    const revision = getDirectSessionRevision(panelId);
    const identity = directIdentityRevisions.get(panelId);
    const key = JSON.stringify([panelId, direct.baseUrl, direct.jwt, revision, path]);
    const result = method === "GET" && resourceForPath(path)
      ? await versionedReads.read(key, panelId, path, requestPath => directRequest<T>(direct, method, requestPath, body, false, _opts?.timeoutMs))
      : await directRequest<T>(direct, method, path, body, false, _opts?.timeoutMs);
    if (directIdentityRevisions.get(panelId) !== identity) return {ok:false, status:409, code:"DIRECT_AUTH_REQUIRED"};
    if (method === "GET" && resourceForPath(path)) result.liveResource = {serverId:panelId, resource:resourceForPath(path)};
    if (!result.ok) gatewayCache.invalidate(`${panelId}|${getDirectSessionRevision(panelId)}|${path}`);
    return result;
  }
  gatewayCache.invalidate(`${panelId}|${getDirectSessionRevision(panelId)}|${path}`);
  return { ok: false, status: 0, code: "DIRECT_AUTH_REQUIRED", error: "connect_required" };
}

/** Desempaqueta el envelope del panel: devuelve `data.data ?? data` cuando ok. */
export function unwrap<T = unknown>(res: GatewayResponse): T | null {
  if (!res.ok) return null;
  const panel = res.data as { ok?: boolean; data?: T } | T | undefined;
  if (panel && typeof panel === "object" && "data" in (panel as object)) {
    return ((panel as { data?: T }).data ?? null) as T | null;
  }
  return (panel ?? null) as T | null;
}

/** Extrae el `job` de una respuesta de mutación (write-behind), si lo hay. */
export function extractJob(res: GatewayResponse): JobRef | null {
  const panel = res.data as { job?: JobRef; data?: { job?: JobRef } } | undefined;
  return panel?.job ?? panel?.data?.job ?? null;
}

// ── Cola write-behind (sondeo de jobs) ──────────────────────────────────────

/** Sondea `GET /api/jobs/:id` hasta estado terminal. */
export async function pollJob(
  panelId: string,
  token: string,
  jobId: string,
  opts: { intervalMs?: number; maxTries?: number } = {},
): Promise<JobStatus> {
  const identity = () => JSON.stringify([getDirect(panelId)?.baseUrl, getDirect(panelId)?.jwt, getDirect(panelId)?.bridgeSessionId]);
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

/**
 * Tras una mutación: si la respuesta trae `job` y no está aplicado, espera a que
 * la cola termine. Devuelve el estado final del job (o null si no hubo job).
 */
export async function withJob(
  res: GatewayResponse,
  panelId: string,
  token: string,
  opts?: { intervalMs?: number; maxTries?: number },
): Promise<JobStatus | null> {
  const job = extractJob(res);
  if (!job || job.mode === "applied") return null;
  const status = await pollJob(panelId, token, job.id, opts);
  // La cola write-behind aplicó los cambios DESPUÉS de la mutación: una lectura
  // que hubiera volado en medio traería el estado previo. Volvemos a tirar el
  // caché del panel para que el `reload()` de la pantalla lea el estado final.
  invalidateServerCache(panelId);
  return status;
}

// ── Descarga binaria (stream) ───────────────────────────────────────────────

/**
 * Descarga un archivo del servidor (p. ej. `/api/files/download?path=...`) por
 * el passthrough binario. Devuelve un Blob (XHR responseType blob, soportado en
 * RN). `panelPath` debe ser una ruta GET permitida (files download/raw).
 */
export function downloadServerFile(panelId: string, _token: string, panelPath: string): Promise<Blob> {
  const direct = getDirect(panelId);
  if (!direct) return Promise.reject(new Error("connect_required"));
  return new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
      // Directo: el panel sirve la descarga por GET (`/api/files/download?path=`).
      xhr.open("GET", `${direct.baseUrl}${panelPath}`);
    xhr.withCredentials = false;
      xhr.responseType = "blob";
      xhr.setRequestHeader("Authorization", `Bearer ${direct.jwt}`);
      xhr.setRequestHeader("x-client-platform", "app");
      if (direct.bridgeSessionId) xhr.setRequestHeader("X-Bridge-Session-Id", direct.bridgeSessionId);
      xhr.onload = () => {
        if (getDirect(panelId) !== direct) { reject(new Error("connect_required")); return; }
        if (xhr.status >= 200 && xhr.status < 300 && xhr.response) resolve(xhr.response as Blob);
        else reject(new Error(`download_http_${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error("download_network_error"));
      xhr.send();
  });
}

// ── Subida binaria ──────────────────────────────────────────────────────────

/**
 * Sube un archivo al servidor reenviándolo a `/api/files/upload?...` del panel.
 * `panelPath` = ruta completa del panel (incluida su query dest/filename). El
 * archivo va como multipart `file` (el gateway lo reenvía como octet-stream).
 */
export async function uploadServerFile(
  panelId: string,
  _token: string,
  panelPath: string,
  file: { uri: string; name: string; type?: string },
): Promise<GatewayResponse> {
  const direct = getDirect(panelId);
  if (direct) {
    // Directo: el panel espera el cuerpo RAW octet-stream (no multipart) con
    // `dest`/`filename` en la query (ya incluidos en `panelPath`). Leemos el
    // archivo a un Blob octet-stream para que `express.raw` lo parsee.
    let blob: Blob;
    try {
      const buf = await (await fetch(file.uri)).arrayBuffer();
      blob = new Blob([buf], { type: "application/octet-stream" });
    } catch (e) {
      return { ok: false, status: 0, code: "PANEL_UNAVAILABLE", error: e instanceof Error ? e.message : "read_file_error" };
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/octet-stream",
      Authorization: `Bearer ${direct.jwt}`,
      "x-client-platform": "app",
    };
    if (direct.bridgeSessionId) headers["X-Bridge-Session-Id"] = direct.bridgeSessionId;
    if (getDirect(panelId) !== direct) return { ok: false, code: "DIRECT_AUTH_REQUIRED", error: "connect_required" };
    if (direct.csrf) {
      headers["X-CSRF-Token"] = direct.csrf.value;
      headers["Cookie"] = `${direct.csrf.name}=${direct.csrf.value}`;
    }
    try {
      const response = await fetch(`${direct.baseUrl}${panelPath}`, { method: "POST", credentials: "omit", headers, body: blob });
      const contentType = response.headers?.get("content-type") ?? "";
  const data: unknown = contentType && !contentType.includes("json") ? await response.text() : await response.json().catch(() => ({}));
      const panel = data && typeof data === "object" ? data as { ok?: boolean; code?: string; error?: string } : null;
      return { ok: response.ok && panel?.ok !== false, status: response.status, data, code: panel?.code, error: panel?.error };
    } catch (e) {
      return { ok: false, status: 0, code: "PANEL_UNAVAILABLE", error: e instanceof Error ? e.message : "network_error" };
    }
  }
  return { ok: false, status: 0, code: "DIRECT_AUTH_REQUIRED", error: "connect_required" };
}

// ── Envoltorios tipados del NÚCLEO (usuarios / archivos / monitor) ───────────
// Para el resto de módulos basta `callServerApi(panelId, token, METHOD, "/api/<m>/...")`.

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
  getPrefs: (p: string, t: string) => callServerApi(p, t, "GET", "/api/server-alerts/me/preferences"),
  getChannels: (p: string, t: string) => callServerApi(p, t, "GET", "/api/server-alerts/channels"),
  getHistory: (p: string, t: string) => callServerApi(p, t, "GET", "/api/server-alerts/history"),
  sendTest: (p: string, t: string) => callServerApi(p, t, "POST", "/api/server-alerts/test"),
  setPrefs: (p: string, t: string, body: unknown) => callServerApi(p, t, "PUT", "/api/server-alerts/me/preferences", body),
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

/** Expo (EAS): config, proyectos, builds, env.
 *  Las operaciones de EAS (build/submit/update/listados) ejecutan el CLI en el
 *  servidor: pueden tardar minutos, así que DESACTIVAN el timeout de cliente
 *  por defecto (60 s) que sí protege al resto de peticiones. */
const NO_TIMEOUT = { timeoutMs: 0 } as const;
export const serverExpoApi = {
  getConfig: (p: string, t: string) => callServerApi(p, t, "GET", "/api/expo/config"),
  setConfig: (p: string, t: string, body: unknown) => callServerApi(p, t, "PUT", "/api/expo/config", body),
  deleteConfig: (p: string, t: string) => callServerApi(p, t, "DELETE", "/api/expo/config"),
  projects: (p: string, t: string, root = "") => callServerApi(p, t, "GET", `/api/expo/projects${root ? `?root=${enc(root)}` : ""}`),
  build: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/expo/build", body, NO_TIMEOUT),
  buildList: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/expo/build-list", body, NO_TIMEOUT),
  buildView: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/expo/build-view", body, NO_TIMEOUT),
  buildCancel: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/expo/build-cancel", body),
  submit: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/expo/submit", body, NO_TIMEOUT),
  update: (p: string, t: string, body: unknown) => callServerApi(p, t, "POST", "/api/expo/update", body, NO_TIMEOUT),
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
  gatewayCache.invalidateWhere(key => key.startsWith(`${serverId}|`) && (!resources || Object.entries(dataResources).some(([path, resource]) => resources.includes(resource) && key.includes(path))));
}
