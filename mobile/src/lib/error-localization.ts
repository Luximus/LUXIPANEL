import type { Messages } from "../i18n";

/** Se lanza cuando el usuario cierra el popup/hoja del proveedor (Google, Apple,
 *  GitHub, Microsoft) sin completar el login. Es una cancelación, no un fallo:
 *  la UI debe volver al estado inicial en silencio (sin error) para que el
 *  usuario pueda reintentar el proceso de autenticación. */
export class LoginCancelledError extends Error {
  constructor() {
    super("login_cancelled");
    this.name = "LoginCancelledError";
  }
}

/** True cuando el error representa una cancelación del usuario (cerró el popup
 *  del proveedor), no un fallo real de autenticación. */
export function isLoginCancelled(error: unknown): boolean {
  return error instanceof LoginCancelledError;
}

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message ?? "";
  return typeof error === "string" ? error : "";
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

export function localizeCommonError(error: unknown, t: Messages, fallback: string): string {
  const raw = extractMessage(error).trim();
  if (!raw) return fallback;

  const text = normalize(raw);
  if (/^error[:\s-]*\d+$/i.test(raw) || /^e\d+$/i.test(raw) || /^\d+$/.test(raw)) {
    return fallback;
  }

  if (includesAny(text, [
    "not authenticated",
    "unauthorized",
    "missing bearer token",
    "invalid or expired access token",
    "api token has been revoked",
    "customer no longer exists",
    "session expired",
  ])) {
    return t.auth.couldNotAuthenticate;
  }

  if (includesAny(text, [
    "ticket not found",
    "only the ticket owner or an admin can",
    "solo puedes cerrar tus propios tickets",
  ])) {
    return t.ticketDetail.couldNotLoad;
  }

  if (includesAny(text, [
    "network error",
    "error de red",
    "failed to fetch",
    "network request failed",
    "timed out",
    "time out",
    "timeout",
    "websocket error",
    "connection refused",
    "connection reset",
    "internet disconnected",
    "name not resolved",
    "network changed",
    "address unreachable",
    "host unreachable",
    "net::err_",
  ])) {
    return t.errors.connectionFailed;
  }

  if (includesAny(text, [
    "internal server error",
    "request failed",
    "http 5",
    "http 4",
    "forbidden",
    "se requiere una compra activa para acceder a soporte",
    "no se recibio ningun archivo",
    "adjunto invalido",
    "archivo no encontrado en almacenamiento",
    "superan el limite total de 5 mb",
    "respuesta invalida del servidor",
    "invalid server response",
  ])) {
    return fallback;
  }

  if (includesAny(text, [
    "could not be completed",
    "operation couldnt be completed",
    "unknown error",
    "document picker",
    "sharing",
    "error 1",
  ])) {
    return fallback;
  }

  if (raw.length <= 16 && /^error\b/i.test(raw)) {
    return fallback;
  }

  return raw;
}

export function localizeLoginError(error: unknown, t: Messages, fallback: string): string {
  const raw = extractMessage(error).trim();
  if (!raw) return fallback;

  const text = normalize(raw);

  if (includesAny(text, [
    "cuenta ha sido bloqueada",
    "account has been blocked",
    "cuenta no disponible",
  ])) {
    return t.login.blocked;
  }

  if (includesAny(text, [
    "google sign-in requiere una development build nativa",
    "google no devolvio id_token",
    "google no devolvio id token",
    "inicio con google cancelado",
    "sign in cancelled",
    "sign_in_cancelled",
  ])) {
    return t.login.errorsField.googleFailed;
  }

  if (includesAny(text, [
    "passkeys requieren una build nativa",
    "passkeys no disponibles en este dispositivo",
    "invalid passkey response",
  ])) {
    return t.login.errorsField.passkeyFailed;
  }

  if (includesAny(text, [
    "credenciales invalidas",
    "invalid credentials",
    "codigo de recuperacion invalido",
    "recovery code invalid",
    "recovery code already used",
  ])) {
    return t.login.errorsField.recoveryInvalid;
  }

  if (includesAny(text, [
    "codigo totp invalido",
    "invalid totp",
    "mfa token expired",
    "2fa no esta habilitado",
    "totp setup required first",
  ])) {
    return t.login.errorsField.mfaInvalid;
  }

  if (includesAny(text, [
    "demasiados intentos",
    "too many attempts",
    "rate limit",
    "no se pudo iniciar sesion",
    "could not sign in",
  ])) {
    return fallback;
  }

  // Apple / GitHub / Microsoft: errores propios (build nativa, cancelado, sin
  // token, sin configurar) y los del backend. El `fallback` que pasa cada
  // handler ya es el `errorsField.<provider>Failed` localizado, así que basta
  // con devolverlo en vez de dejar pasar el texto crudo en español.
  if (includesAny(text, [
    "apple",
    "github",
    "microsoft",
    "requiere una development build",
    "requires a native",
    "no esta configurado",
    "is not configured",
    "no devolvio",
    "did not return",
  ])) {
    return fallback;
  }

  return localizeCommonError(raw, t, fallback);
}
