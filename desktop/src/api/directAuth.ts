/**
 * directAuth (desktop) — login DIRECTO contra un box LUXIPANEL **standalone**
 * (sin LP-LS). Espejo de `app/src/api/directAuth.ts`; misma máquina de estados y
 * mismo contrato del panel, adaptado al transporte de Electron.
 *
 * Un box en `OPERATION_MODE=standalone-local` no está registrado en LP-LS y NO
 * tiene `/api/sso/callback`: el gateway no lo alcanza, pero el desktop sí puede
 * hablarle directo si tiene ruta de red. Replicamos el handshake que el
 * navegador hace con `/api/login`:
 *
 *  1. **GET** `/api/auth/login-methods` → el panel emite `luxipanel_csrf` en
 *     `Set-Cookie` (la capturamos: el login la exige).
 *  2. **POST** `/api/login` `{ user, pass, hcaptchaToken:"", remember }` con
 *     `Cookie: luxipanel_csrf=<v>` + `X-CSRF-Token: <v>` (double-submit). El
 *     panel responde `{ ok, mfaPending, expiresAt }` y fija `luxipanel_session`
 *     (JWT httpOnly) en `Set-Cookie`.
 *  3. Si `mfaPending` → **POST** `/api/auth/2fa/verify` `{ code }` con la cookie
 *     de sesión parcial → JWT completo.
 *
 * El JWT capturado se reenvía luego como `Authorization: Bearer` (el panel lo
 * acepta por cookie O por Bearer, ver `session.middleware.extractToken`), así el
 * transporte directo (`serverApi.directRequest`) es determinista.
 *
 * TRANSPORTE (diferencia con la app): en RN se usa `XMLHttpRequest` porque su
 * `getAllResponseHeaders()` expone `Set-Cookie`. En el renderer de Electron NI
 * `fetch` NI `XHR` pueden leer `Set-Cookie` (cabecera de respuesta prohibida por
 * la spec), así que delegamos en el PROCESO MAIN vía `electronApi.requestWithCookies`
 * (IPC `http:request-cookies`), donde el `fetch` de undici sí lee
 * `headers.getSetCookie()`. Sin ese puente (p. ej. `dev:web` en navegador) el
 * login directo no puede capturar el JWT y devuelve `NO_COOKIE_TRANSPORT`.
 */

const SESSION_COOKIE = "luxipanel_session";
const CSRF_COOKIE = "luxipanel_csrf";

/** Sesión directa capturada del box (espejo de las cookies del panel). */
export interface DirectSession {
  /** JWT de sesión (cookie `luxipanel_session`). */
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
export function normalizeBaseUrl(input: string): string {
  let s = (input ?? "").trim();
  if (!s) return s;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  s = s.replace(/\/+$/, "");
  s = s.replace(/\/api$/i, "");
  return s;
}

/** Extrae el valor de una cookie `name=value` de un blob de cabeceras Set-Cookie. */
function extractCookie(haystack: string, name: string): string | null {
  // El valor de luxipanel_session (JWT) / luxipanel_csrf (hex) no contiene
  // `;`, `,` ni espacios → corte seguro antes de los atributos / siguiente cookie.
  const re = new RegExp(`${name}=([^;,\\s]+)`);
  const m = re.exec(haystack);
  return m ? m[1] : null;
}

/**
 * Canjea el handoff SSO del portal sin navegar al panel remoto. El ticket sólo
 * vive en memoria y viaja en el body de un POST; nunca se guarda en pestañas.
 */
export async function redeemPanelHandoff(rawUrl: string): Promise<{ baseUrl: string; session: DirectSession } | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol) || url.pathname !== "/api/auth/sso/handoff") return null;
  const ticket = url.searchParams.get("ticket");
  if (!ticket) return null;
  const baseUrl = url.origin;
  // El handoff sólo fija la cookie de sesión. La petición de métodos obtiene
  // la cookie CSRF que el box exige después para las mutaciones.
  const pre = await directHttp("GET", `${baseUrl}/api/auth/login-methods`);
  const csrf = extractCookie(pre.cookies, CSRF_COOKIE);
  const response = await directHttp("POST", `${baseUrl}/api/auth/sso/handoff`, {
    headers: csrf ? { Cookie: `${CSRF_COOKIE}=${csrf}`, "X-CSRF-Token": csrf } : {},
    body: { ticket },
  });
  const jwt = extractCookie(response.cookies, SESSION_COOKIE);
  if (response.status !== 200 || !jwt) return null;
  const finalCsrf = extractCookie(response.cookies, CSRF_COOKIE) ?? csrf;
  return {
    baseUrl,
    session: {
      jwt,
      csrf: finalCsrf ? { name: CSRF_COOKIE, value: finalCsrf } : null,
      exp: 0,
    },
  };
}

/**
 * Petición JSON con lectura de Set-Cookie. Delega SIEMPRE en el proceso main
 * (`electronApi.requestWithCookies`) porque el renderer no puede leer
 * `Set-Cookie`. Lanza `no_cookie_transport` si el puente no está disponible.
 */
async function directHttp(
  method: string,
  url: string,
  opts: { headers?: Record<string, string>; body?: unknown } = {},
): Promise<RawResp> {
  const bridge = window.electronApi?.requestWithCookies;
  if (!bridge) throw new Error("no_cookie_transport");
  const headers: Record<string, string> = {
    Accept: "application/json",
    "x-client-platform": "desktop",
    ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(opts.headers ?? {}),
  };
  const result = await bridge({
    url,
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const body =
    result.data && typeof result.data === "object"
      ? (result.data as Record<string, unknown>)
      : {};
  return { status: result.status, body, cookies: result.cookies ?? "" };
}

function errorMessage(body: Record<string, unknown>, fallback: string): string {
  const e = body?.["error"];
  return typeof e === "string" && e ? e : fallback;
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
  let csrfVal: string | null;
  try {
    const pre = await directHttp("GET", `${base}/api/auth/login-methods`);
    csrfVal = extractCookie(pre.cookies, CSRF_COOKIE);
  } catch (e) {
    if (e instanceof Error && e.message === "no_cookie_transport") {
      return {
        status: "error",
        code: "NO_COOKIE_TRANSPORT",
        message: "El login directo requiere la app de escritorio",
      };
    }
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
    resp = await directHttp("POST", `${base}/api/login`, {
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
    resp = await directHttp("POST", `${base}/api/auth/2fa/verify`, { headers, body: { code } });
  } catch {
    return { status: "error", code: "UNREACHABLE", message: "No se pudo conectar con el servidor" };
  }
  if (resp.status >= 400) {
    const c = typeof resp.body?.["code"] === "string" ? (resp.body["code"] as string) : `HTTP_${resp.status}`;
    return { status: "error", code: c, message: errorMessage(resp.body, "Código 2FA incorrecto") };
  }
  const jwt = extractCookie(resp.cookies, SESSION_COOKIE) ?? partial.jwt;
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
