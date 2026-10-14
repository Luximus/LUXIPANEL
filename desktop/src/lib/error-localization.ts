import type { Messages } from "../i18n";

/** Firebase lanza estos códigos cuando el usuario CIERRA el popup del proveedor
 *  (Google/Apple/GitHub/Microsoft) sin completar el login. No son fallos: el
 *  llamador debe restaurar el menú en silencio para que el usuario pueda
 *  reintentar, sin mostrar ningún error. */
const SIGN_IN_CANCEL_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
  "auth/web-context-cancelled",
]);

/** True cuando el error es el usuario cancelando el popup del proveedor (cerró
 *  la ventana de Firebase), no un fallo real de autenticación. */
export function isLoginCancelled(error: unknown): boolean {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  return typeof code === "string" && SIGN_IN_CANCEL_CODES.has(code);
}

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message ?? "";
  return typeof error === "string" ? error : "";
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

/**
 * Traduce los mensajes de error del login al idioma activo. El backend (y
 * algunos throws del cliente) devuelven texto en un idioma fijo (ES/EN); aquí
 * los mapeamos a las claves i18n del locale seleccionado. Lo desconocido cae al
 * `fallback` (ya localizado) para que NUNCA se muestre texto sin traducir.
 */
export function localizeLoginError(error: unknown, t: Messages, fallback: string): string {
  const raw = extractMessage(error).trim();
  if (!raw) return fallback;

  const text = normalize(raw);

  if (includesAny(text, [
    "cuenta ha sido bloqueada",
    "account has been blocked",
    "no puedes ingresar",
    "cuenta no disponible",
    "account not available",
  ])) {
    return t.login.blocked;
  }

  if (includesAny(text, [
    "sign in with apple",
    "inicio con apple",
    "apple sign-in",
    "couldnt sign in with apple",
    "no se pudo iniciar con apple",
    "apple no devolvio",
    "apple did not return",
  ])) {
    return t.login.errorsField.appleFailed;
  }

  if (includesAny(text, [
    "github",
    "inicio con github",
  ])) {
    return t.login.errorsField.githubFailed;
  }

  if (includesAny(text, [
    "microsoft",
    "inicio con microsoft",
  ])) {
    return t.login.errorsField.microsoftFailed;
  }

  if (includesAny(text, [
    "google",
    "inicio con google",
    "sign in cancelled",
    "sign_in_cancelled",
  ])) {
    return t.login.errorsField.googleFailed;
  }

  if (includesAny(text, [
    "passkey",
    "invalid passkey response",
  ])) {
    return t.login.errorsField.passkeyFailed;
  }

  if (includesAny(text, [
    "recovery",
    "codigo de recuperacion",
    "recovery code",
    "credenciales invalidas",
    "invalid credentials",
  ])) {
    return t.login.errorsField.recoveryInvalid;
  }

  if (includesAny(text, [
    "totp",
    "2fa",
    "mfa token",
  ])) {
    return t.login.errorsField.mfaInvalid;
  }

  // Desconocido: nunca mostramos el texto crudo (puede venir en otro idioma).
  return fallback;
}
