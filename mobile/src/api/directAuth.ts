/**
 * directAuth — login DIRECTO contra un box LUXIPANEL **standalone** (sin LP-LS).
 *
 * Un box en `OPERATION_MODE=standalone-local` no está registrado en LP-LS y NO
 * tiene `/api/sso/callback`: el gateway no lo alcanza, pero el móvil sí puede
 * hablarle directo si tiene ruta de red. Aquí replicamos el handshake que el
 * navegador hace con `/api/login`:
 *
 *  1. **GET** `/api/auth/login-methods` → `csrfCookieSetter` emite la cookie
 *     `luxipanel_csrf` en `Set-Cookie` (la capturamos: el login la exige).
 *  2. **POST** `/api/login` `{ user, pass, hcaptchaToken:"", remember }` con
 *     `Cookie: luxipanel_csrf=<v>` + `X-CSRF-Token: <v>` (double-submit). El
 *     panel responde `{ ok, mfaPending, expiresAt }` y fija `luxipanel_session`
 *     (JWT httpOnly) en `Set-Cookie`.
 *  3. Si `mfaPending` → **POST** `/api/auth/2fa/verify` `{ code }` con la cookie
 *     de sesión parcial → JWT completo.
 *
 * El JWT capturado se reenvía luego como `Authorization: Bearer` (el panel lo
 * acepta por cookie O por Bearer, ver `session.middleware.extractToken`), así el
 * transporte directo (`serverApi.directRequest`) es determinista y sobrevive al
 * cookie-jar nativo. Usamos `XMLHttpRequest` porque en RN es la vía fiable para
 * leer `Set-Cookie` (`getAllResponseHeaders`).
 */

const SESSION_COOKIE = "luxipanel_session";
const CSRF_COOKIE = "luxipanel_csrf";

/** Sesión directa capturada del box (espejo de las cookies del panel). */
export interface DirectSession {
  /** JWT de sesión capturado explícitamente; el login rechaza respuestas sin token. */
  jwt: string;
  /** Token CSRF para firmar mutaciones (cookie `luxipanel_csrf`). */
  csrf: { name: string; value: string } | null;
  /** Vencimiento en ms epoch (0 = desconocido). */
  exp: number;
}

export type StandaloneLoginResult =
  | { status: "ok"; session: DirectSession }
  | { status: "mfa"; partial: DirectSession }
  | { status: "error"; code: string; message: string };

export type StandaloneTotpResult =
  | { status: "ok"; session: DirectSession }
  | { status: "error"; code: string; message: string };

interface RawResp {
  status: number;
  body: Record<string, unknown>;
  cookies: string;
}

/** Normaliza la URL del panel: añade `https://`, quita barra final y un `/api` colgante. */
export function normalizePanelProfileUrl(input: string): string {
  const raw = String(input ?? "").trim();
  if (!raw) return "";
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || !["/", "/api", "/login", "/panel"].includes(url.pathname.replace(/\/$/, "") || "/")) throw new Error("Usa el dominio o IP y puerto de LUXIPANEL, sin credenciales ni rutas.");
  return url.origin;
}

// Preserve legacy installations served under a path; new connection profiles use an origin.
export function normalizeBaseUrl(input: string): string {
  const raw = String(input ?? "").trim();
  if (!raw) return "";
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("URL inválida");
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "").replace(/\/api$/i, "");
}

/** Extrae el valor de una cookie `name=value` de un blob de cabeceras Set-Cookie. */
export function extractCookie(haystack: string, name: string): string | null {
  // El valor de luxipanel_session (JWT) / luxipanel_csrf (hex) no contiene
  // `;`, `,` ni espacios → corte seguro antes de los atributos / siguiente cookie.
  const re = new RegExp(`${name}=([^;,\\s]+)`);
  const m = re.exec(haystack);
  return m ? m[1] : null;
}

/** XHR JSON con lectura de Set-Cookie (combina header directo + getAllResponseHeaders). */
export function xhrRequest(
  method: string,
  url: string,
  opts: { headers?: Record<string, string>; body?: unknown; timeoutMs?: number } = {},
): Promise<RawResp> {
  return new Promise<RawResp>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.withCredentials = false;
    xhr.timeout = opts.timeoutMs ?? 20000;
    xhr.setRequestHeader("x-client-platform", "app");
    xhr.setRequestHeader("Accept", "application/json");
    if (opts.body !== undefined) xhr.setRequestHeader("Content-Type", "application/json");
    for (const [k, v] of Object.entries(opts.headers ?? {})) {
      try { xhr.setRequestHeader(k, v); } catch { /* header reservado: lo ignora el SO */ }
    }
    xhr.onload = () => {
      let body: Record<string, unknown> = {};
      try { body = JSON.parse(xhr.responseText) as Record<string, unknown>; } catch { body = {}; }
      const direct = xhr.getResponseHeader("Set-Cookie") ?? xhr.getResponseHeader("set-cookie") ?? "";
      const all = (() => { try { return xhr.getAllResponseHeaders() ?? ""; } catch { return ""; } })();
      resolve({ status: xhr.status, body, cookies: `${direct}\n${all}` });
    };
    xhr.onerror = () => reject(new Error("network_error"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.send(opts.body !== undefined ? JSON.stringify(opts.body) : undefined);
  });
}

function errorMessage(body: Record<string, unknown>, fallback: string): string {
  const e = body?.["error"];
  return typeof e === "string" && e ? e : fallback;
}

/** Canjea el ticket de LP en el box sin mostrar una página ni pedir credenciales.
 * El ticket viaja por POST y el JWT se captura igual que en el login nativo. */
export async function redeemPanelHandoff(
  baseUrl: string,
  handoff: { url: string; ticket: string },
  isCurrent: () => boolean = () => true,
): Promise<DirectSession | null> {
  const base = normalizeBaseUrl(baseUrl);
  try {
    const endpoint = new URL(`${base}/api/auth/sso/handoff`);
    const supplied = new URL(handoff.url);
    // Un ticket del servidor A nunca se envía al servidor B.
    if (!handoff.ticket || handoff.ticket.length > 256
      || !["https:", "http:"].includes(endpoint.protocol)
      || endpoint.username || endpoint.password
      || supplied.origin !== endpoint.origin || supplied.pathname !== endpoint.pathname
      || supplied.search || supplied.hash || supplied.username || supplied.password || !isCurrent()) return null;
    const pre = await xhrRequest("GET", `${base}/api/auth/login-methods`);
    if (pre.status >= 400 || !isCurrent()) return null;
    const csrf = extractCookie(pre.cookies, CSRF_COOKIE);
    const headers: Record<string, string> = {};
    if (csrf) { headers["X-CSRF-Token"] = csrf; headers.Cookie = `${CSRF_COOKIE}=${csrf}`; }
    const response = await xhrRequest("POST", endpoint.toString(), { headers, body: { ticket: handoff.ticket } });
    if (response.status >= 400 || !isCurrent()) return null;
    const jwt = extractCookie(response.cookies, SESSION_COOKIE);
    if (!jwt) return null; // Ticket expirado/consumido: el box devuelve /login sin cookie.
    let exp = 0;
    try {
      const encoded = jwt.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/") ?? "";
      const claims = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
      if (typeof claims.exp === "number") exp = claims.exp * 1000;
    } catch { /* La petición autenticada sigue verificando el JWT en el box. */ }
    const csrfValue = extractCookie(response.cookies, CSRF_COOKIE) ?? csrf;
    return { jwt, csrf: csrfValue ? { name: CSRF_COOKIE, value: csrfValue } : null, exp };
  } catch { return null; }
}

/**
 * Login directo. Devuelve `ok` con la sesión, `mfa` si el box exige 2FA (hay que
 * pedir el código con `verifyStandaloneTotp`), o `error` con `code`/`message`.
 */
export async function loginStandalone(
  baseUrl: string,
  user: string,
  pass: string,
  opts: { remember?: boolean } = {},
): Promise<StandaloneLoginResult> {
  const base = normalizeBaseUrl(baseUrl);
  if (!base) return { status: "error", code: "BAD_URL", message: "URL inválida" };

  // 1. Obtener cookie CSRF.
  let csrfVal: string | null = null;
  try {
    const pre = await xhrRequest("GET", `${base}/api/auth/login-methods`);
    csrfVal = extractCookie(pre.cookies, CSRF_COOKIE);
  } catch {
    return { status: "error", code: "UNREACHABLE", message: "No se pudo conectar con el servidor" };
  }

  // 2. POST /api/login (double-submit CSRF).
  const headers: Record<string, string> = {};
  if (csrfVal) {
    headers["X-CSRF-Token"] = csrfVal;
    headers["Cookie"] = `${CSRF_COOKIE}=${csrfVal}`;
  }
  let resp: RawResp;
  try {
    resp = await xhrRequest("POST", `${base}/api/login`, {
      headers,
      body: { user, pass, hcaptchaToken: "", remember: opts.remember ?? true },
    });
  } catch {
    return { status: "error", code: "UNREACHABLE", message: "No se pudo conectar con el servidor" };
  }
  if (resp.status >= 400) {
    const code = typeof resp.body?.["code"] === "string" ? (resp.body["code"] as string) : `HTTP_${resp.status}`;
    return { status: "error", code, message: errorMessage(resp.body, "Credenciales inválidas") };
  }

  const jwt = extractCookie(resp.cookies, SESSION_COOKIE) ?? "";
  const csrf2 = extractCookie(resp.cookies, CSRF_COOKIE) ?? csrfVal;
  const exp = typeof resp.body?.["expiresAt"] === "number" ? (resp.body["expiresAt"] as number) : 0;
  const session: DirectSession = {
    jwt,
    csrf: csrf2 ? { name: CSRF_COOKIE, value: csrf2 } : null,
    exp,
  };

  if (!jwt || resp.body?.["ok"] !== true) return { status: "error", code: "INVALID_AUTH_RESPONSE", message: "No se recibió una sesión válida del servidor" };
  if (resp.body?.["mfaPending"] === true) return { status: "mfa", partial: session };
  return { status: "ok", session };
}

/** Verifica el código TOTP de 6 dígitos tras un login `mfaPending`. */
export async function verifyStandaloneTotp(
  baseUrl: string,
  partial: DirectSession,
  code: string,
): Promise<StandaloneTotpResult> {
  const base = normalizeBaseUrl(baseUrl);
  const cookieParts: string[] = [];
  if (partial.jwt) cookieParts.push(`${SESSION_COOKIE}=${partial.jwt}`);
  if (partial.csrf) cookieParts.push(`${partial.csrf.name}=${partial.csrf.value}`);
  const headers: Record<string, string> = { Cookie: cookieParts.join("; ") };
  if (partial.csrf) headers["X-CSRF-Token"] = partial.csrf.value;

  let resp: RawResp;
  try {
    resp = await xhrRequest("POST", `${base}/api/auth/2fa/verify`, { headers, body: { code } });
  } catch {
    return { status: "error", code: "UNREACHABLE", message: "No se pudo conectar con el servidor" };
  }
  if (resp.status >= 400) {
    const c = typeof resp.body?.["code"] === "string" ? (resp.body["code"] as string) : `HTTP_${resp.status}`;
    return { status: "error", code: c, message: errorMessage(resp.body, "Código 2FA incorrecto") };
  }
  const jwt = extractCookie(resp.cookies, SESSION_COOKIE);
  if (!jwt || resp.body?.["ok"] !== true || resp.body?.["mfaPending"] === true) return { status: "error", code: "INVALID_AUTH_RESPONSE", message: "No se recibió la sesión completa" };
  const csrf = extractCookie(resp.cookies, CSRF_COOKIE);
  const exp = typeof resp.body?.["expiresAt"] === "number" ? (resp.body["expiresAt"] as number) : 0;
  return {
    status: "ok",
    session: { jwt, csrf: csrf ? { name: CSRF_COOKIE, value: csrf } : partial.csrf, exp },
  };
}

/**
 * Re-login no interactivo (para recuperar un 401 mid-uso). Devuelve la sesión o
 * null si falla / requiere 2FA (en ese caso el usuario re-autentica a mano).
 */
export async function reloginStandalone(
  baseUrl: string,
  user: string,
  pass: string,
): Promise<DirectSession | null> {
  const r = await loginStandalone(baseUrl, user, pass);
  return r.status === "ok" ? r.session : null;
}

export interface PanelLoginMethods { password: boolean; passkey: boolean; recovery: boolean; hcaptchaEnabled?: boolean; }
export async function probePanel(baseUrl: string): Promise<PanelLoginMethods> {
  const response = await xhrRequest("GET", `${normalizeBaseUrl(baseUrl)}/api/auth/login-methods`);
  const methods = response.body.data as PanelLoginMethods | undefined;
  if (response.status >= 400 || response.body.ok !== true || !methods || typeof methods.password !== "boolean") throw new Error("Esta dirección no responde como LUXIPANEL.");
  return methods;
}
export async function publicLayout(baseUrl: string): Promise<Record<string,string>> {
  try { const res = await xhrRequest("GET", `${normalizeBaseUrl(baseUrl)}/api/public/layout`); return res.status === 200 ? (res.body.data as Record<string,string> ?? {}) : {}; } catch { return {}; }
}
export async function recoveryStandalone(baseUrl: string, username: string, code: string, remember: boolean): Promise<StandaloneLoginResult> {
  const base = normalizeBaseUrl(baseUrl);
  const pre = await xhrRequest("GET", `${base}/api/auth/login-methods`);
  const csrf = extractCookie(pre.cookies, CSRF_COOKIE);
  const res = await xhrRequest("POST", `${base}/api/auth/recovery/verify`, { headers: csrf ? { Cookie: `${CSRF_COOKIE}=${csrf}`, "X-CSRF-Token": csrf } : {}, body: { username, code, remember } });
  const jwt = extractCookie(res.cookies, SESSION_COOKIE);
  if (res.status >= 400 || res.body.ok !== true || !jwt) return { status:"error", code:String(res.body.code ?? "AUTH_ERROR"), message: errorMessage(res.body, "Código inválido") };
  const session = { jwt, csrf: csrf ? {name:CSRF_COOKIE,value:csrf} : null, exp: Number(res.body.expiresAt ?? 0) };
  return res.body.mfaPending === true ? {status:"mfa",partial:session} : {status:"ok",session};
}
export async function refreshStandaloneSession(baseUrl: string, previous: DirectSession): Promise<DirectSession | null> {
  const headers: Record<string,string> = {Authorization:`Bearer ${previous.jwt}`};
  if (previous.csrf) { headers.Cookie = `${previous.csrf.name}=${previous.csrf.value}`; headers["X-CSRF-Token"] = previous.csrf.value; }
  const response = await xhrRequest("POST", `${normalizeBaseUrl(baseUrl)}/api/auth/refresh`, {headers,body:{}});
  const jwt = extractCookie(response.cookies, SESSION_COOKIE);
  if (response.status >= 400 || response.body.ok !== true || !jwt) return null;
  const csrf = extractCookie(response.cookies, CSRF_COOKIE);
  return {jwt,csrf:csrf?{name:CSRF_COOKIE,value:csrf}:previous.csrf,exp:Number(response.body.expiresAt ?? previous.exp)};
}
