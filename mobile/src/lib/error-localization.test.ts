import { describe, it, expect } from "vitest";
import { LoginCancelledError, isLoginCancelled, localizeCommonError, localizeLoginError } from "./error-localization";
import type { Messages } from "../i18n";

// `Messages` solo se importa como tipo (se borra en compilación). Construimos un
// objeto mínimo con las rutas que tocan las funciones bajo test y lo casteamos.
const t = {
  auth: { couldNotAuthenticate: "AUTH_FAIL" },
  ticketDetail: { couldNotLoad: "TICKET_FAIL" },
  errors: { connectionFailed: "CONN_FAIL" },
  login: {
    blocked: "BLOCKED",
    errorsField: {
      googleFailed: "GOOGLE_FAIL",
      passkeyFailed: "PASSKEY_FAIL",
      recoveryInvalid: "RECOVERY_INVALID",
      mfaInvalid: "MFA_INVALID",
    },
  },
} as unknown as Messages;

const FB = "FALLBACK";

describe("isLoginCancelled", () => {
  it("es true para LoginCancelledError (usuario cerró el popup del proveedor)", () => {
    expect(isLoginCancelled(new LoginCancelledError())).toBe(true);
  });

  it("es false para un Error normal", () => {
    expect(isLoginCancelled(new Error("Google no devolvio id_token."))).toBe(false);
  });

  it("es false para null / undefined / string", () => {
    expect(isLoginCancelled(null)).toBe(false);
    expect(isLoginCancelled(undefined)).toBe(false);
    expect(isLoginCancelled("cancelado")).toBe(false);
  });
});

describe("localizeCommonError", () => {
  it("devuelve fallback con string vacío", () => {
    expect(localizeCommonError("", t, FB)).toBe(FB);
  });

  it("devuelve fallback con string de solo espacios (trim -> vacío)", () => {
    expect(localizeCommonError("   ", t, FB)).toBe(FB);
  });

  it("devuelve fallback para error puramente numérico", () => {
    expect(localizeCommonError("404", t, FB)).toBe(FB);
  });

  it("devuelve fallback para patron 'Error: 500'", () => {
    expect(localizeCommonError("Error: 500", t, FB)).toBe(FB);
    expect(localizeCommonError("error-403", t, FB)).toBe(FB);
  });

  it("devuelve fallback para patron 'E123'", () => {
    expect(localizeCommonError("E123", t, FB)).toBe(FB);
  });

  it("mapea no-autenticado a auth.couldNotAuthenticate", () => {
    expect(localizeCommonError("Not authenticated", t, FB)).toBe("AUTH_FAIL");
    expect(localizeCommonError("Unauthorized", t, FB)).toBe("AUTH_FAIL");
    expect(localizeCommonError("Session expired", t, FB)).toBe("AUTH_FAIL");
    expect(localizeCommonError("API token has been revoked", t, FB)).toBe("AUTH_FAIL");
  });

  it("mapea errores de ticket a ticketDetail.couldNotLoad", () => {
    expect(localizeCommonError("Ticket not found", t, FB)).toBe("TICKET_FAIL");
    expect(
      localizeCommonError("Only the ticket owner or an admin can close it", t, FB),
    ).toBe("TICKET_FAIL");
  });

  it("devuelve fallback para errores de servidor/genericos", () => {
    expect(localizeCommonError("Internal server error", t, FB)).toBe(FB);
    expect(localizeCommonError("Request failed", t, FB)).toBe(FB);
    expect(localizeCommonError("HTTP 500", t, FB)).toBe(FB);
    expect(localizeCommonError("HTTP 404", t, FB)).toBe(FB);
    expect(localizeCommonError("Forbidden", t, FB)).toBe(FB);
  });

  it("mapea errores de red a errors.connectionFailed", () => {
    expect(localizeCommonError("Network error", t, FB)).toBe("CONN_FAIL");
    expect(localizeCommonError("Failed to fetch", t, FB)).toBe("CONN_FAIL");
    // acentos normalizados: "Error de red"
    expect(localizeCommonError("Error de red", t, FB)).toBe("CONN_FAIL");
    expect(localizeCommonError("net::ERR_TIMED_OUT", t, FB)).toBe("CONN_FAIL");
    expect(localizeCommonError("timeout", t, FB)).toBe("CONN_FAIL");
    expect(localizeCommonError("WebSocket error", t, FB)).toBe("CONN_FAIL");
  });

  it("prioriza patrones de red especificos sobre el fallback generico", () => {
    expect(localizeCommonError("Network request failed", t, FB)).toBe("CONN_FAIL");
  });

  it("devuelve fallback para mensajes 'could not be completed' y similares", () => {
    expect(localizeCommonError("The operation could not be completed", t, FB)).toBe(FB);
    expect(localizeCommonError("Unknown error", t, FB)).toBe(FB);
    expect(localizeCommonError("Document picker cancelled", t, FB)).toBe(FB);
  });

  it("devuelve fallback para 'Error' corto (<=16 y empieza con error)", () => {
    expect(localizeCommonError("Error occurred", t, FB)).toBe(FB);
  });

  it("devuelve el texto crudo cuando no coincide ningun patron", () => {
    const msg = "El producto seleccionado no esta disponible en tu region";
    expect(localizeCommonError(msg, t, FB)).toBe(msg);
  });

  it("preserva el texto crudo (no la version normalizada) en passthrough", () => {
    const msg = "Saldo Insuficiente Para La Operación";
    expect(localizeCommonError(msg, t, FB)).toBe(msg);
  });

  it("extrae message de instancias Error", () => {
    expect(localizeCommonError(new Error("Unauthorized"), t, FB)).toBe("AUTH_FAIL");
  });

  it("devuelve fallback para tipos no-string/no-Error (null, number, objeto)", () => {
    expect(localizeCommonError(null, t, FB)).toBe(FB);
    expect(localizeCommonError(42, t, FB)).toBe(FB);
    expect(localizeCommonError({ foo: "bar" }, t, FB)).toBe(FB);
  });

  it("es case-insensitive vía normalizacion", () => {
    expect(localizeCommonError("NOT AUTHENTICATED", t, FB)).toBe("AUTH_FAIL");
  });
});

describe("localizeLoginError", () => {
  it("devuelve fallback con string vacío", () => {
    expect(localizeLoginError("", t, FB)).toBe(FB);
  });

  it("mapea cuenta bloqueada a login.blocked", () => {
    expect(localizeLoginError("Tu cuenta ha sido bloqueada", t, FB)).toBe("BLOCKED");
    expect(localizeLoginError("Account has been blocked", t, FB)).toBe("BLOCKED");
    expect(localizeLoginError("Cuenta no disponible", t, FB)).toBe("BLOCKED");
  });

  it("mapea errores de Google a googleFailed", () => {
    expect(localizeLoginError("Inicio con Google cancelado", t, FB)).toBe("GOOGLE_FAIL");
    expect(localizeLoginError("sign in cancelled", t, FB)).toBe("GOOGLE_FAIL");
    expect(localizeLoginError("Google no devolvio id_token", t, FB)).toBe("GOOGLE_FAIL");
  });

  it("mapea errores de passkey a passkeyFailed", () => {
    expect(localizeLoginError("invalid passkey response", t, FB)).toBe("PASSKEY_FAIL");
    expect(localizeLoginError("Passkeys no disponibles en este dispositivo", t, FB)).toBe(
      "PASSKEY_FAIL",
    );
  });

  it("mapea credenciales/recovery invalidos a recoveryInvalid", () => {
    expect(localizeLoginError("Invalid credentials", t, FB)).toBe("RECOVERY_INVALID");
    expect(localizeLoginError("Credenciales invalidas", t, FB)).toBe("RECOVERY_INVALID");
    expect(localizeLoginError("recovery code already used", t, FB)).toBe("RECOVERY_INVALID");
  });

  it("mapea TOTP/MFA a mfaInvalid", () => {
    expect(localizeLoginError("Invalid TOTP", t, FB)).toBe("MFA_INVALID");
    expect(localizeLoginError("MFA token expired", t, FB)).toBe("MFA_INVALID");
    expect(localizeLoginError("Codigo TOTP invalido", t, FB)).toBe("MFA_INVALID");
  });

  it("devuelve fallback para rate-limit / demasiados intentos", () => {
    expect(localizeLoginError("Too many attempts", t, FB)).toBe(FB);
    expect(localizeLoginError("Demasiados intentos", t, FB)).toBe(FB);
    expect(localizeLoginError("Could not sign in", t, FB)).toBe(FB);
  });

  it("devuelve fallback para errores de proveedores Apple/GitHub/Microsoft", () => {
    expect(localizeLoginError("Apple sign in failed", t, FB)).toBe(FB);
    expect(localizeLoginError("GitHub no esta configurado", t, FB)).toBe(FB);
    expect(localizeLoginError("Microsoft did not return a token", t, FB)).toBe(FB);
  });

  it("delega en localizeCommonError cuando no hay patron de login", () => {
    // "Network error" no es patron de login -> cae a common -> connectionFailed
    expect(localizeLoginError("Network error", t, FB)).toBe("CONN_FAIL");
    // "Not authenticated" -> common -> auth.couldNotAuthenticate
    expect(localizeLoginError("Not authenticated", t, FB)).toBe("AUTH_FAIL");
  });

  it("delega y devuelve texto crudo si common tampoco matchea", () => {
    const msg = "Mensaje totalmente desconocido sin patron";
    expect(localizeLoginError(msg, t, FB)).toBe(msg);
  });

  it("extrae message de instancias Error", () => {
    expect(localizeLoginError(new Error("Invalid credentials"), t, FB)).toBe(
      "RECOVERY_INVALID",
    );
  });
});
