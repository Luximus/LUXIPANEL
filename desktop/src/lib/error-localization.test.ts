import { describe, it, expect } from "vitest";
import { isLoginCancelled, localizeLoginError } from "./error-localization";
import type { Messages } from "../i18n";

// Minimal stub de Messages: solo las claves que la función realmente lee.
const t = {
  login: {
    blocked: "BLOCKED",
    errorsField: {
      appleFailed: "APPLE_FAILED",
      githubFailed: "GITHUB_FAILED",
      microsoftFailed: "MICROSOFT_FAILED",
      googleFailed: "GOOGLE_FAILED",
      passkeyFailed: "PASSKEY_FAILED",
      recoveryInvalid: "RECOVERY_INVALID",
      mfaInvalid: "MFA_INVALID",
    },
  },
} as unknown as Messages;

const FALLBACK = "FALLBACK";

describe("isLoginCancelled", () => {
  it("es true cuando el usuario cierra el popup del proveedor", () => {
    expect(isLoginCancelled({ code: "auth/popup-closed-by-user" })).toBe(true);
    expect(isLoginCancelled({ code: "auth/cancelled-popup-request" })).toBe(true);
    expect(isLoginCancelled({ code: "auth/user-cancelled" })).toBe(true);
    expect(isLoginCancelled({ code: "auth/web-context-cancelled" })).toBe(true);
  });

  it("es false para fallos reales de Firebase", () => {
    expect(isLoginCancelled({ code: "auth/internal-error" })).toBe(false);
    expect(isLoginCancelled({ code: "auth/account-exists-with-different-credential" })).toBe(false);
  });

  it("es false para errores sin code o entradas no-objeto", () => {
    expect(isLoginCancelled(new Error("boom"))).toBe(false);
    expect(isLoginCancelled(null)).toBe(false);
    expect(isLoginCancelled(undefined)).toBe(false);
    expect(isLoginCancelled("auth/popup-closed-by-user")).toBe(false);
  });
});

describe("localizeLoginError", () => {
  describe("fallback / entradas vacías", () => {
    it("devuelve fallback con string vacío", () => {
      expect(localizeLoginError("", t, FALLBACK)).toBe(FALLBACK);
    });

    it("devuelve fallback con solo espacios (trim)", () => {
      expect(localizeLoginError("   ", t, FALLBACK)).toBe(FALLBACK);
    });

    it("devuelve fallback con null", () => {
      expect(localizeLoginError(null, t, FALLBACK)).toBe(FALLBACK);
    });

    it("devuelve fallback con undefined", () => {
      expect(localizeLoginError(undefined, t, FALLBACK)).toBe(FALLBACK);
    });

    it("devuelve fallback con número (no string ni Error)", () => {
      expect(localizeLoginError(42, t, FALLBACK)).toBe(FALLBACK);
    });

    it("devuelve fallback con objeto plano sin message", () => {
      expect(localizeLoginError({ foo: "bar" }, t, FALLBACK)).toBe(FALLBACK);
    });

    it("devuelve fallback con texto desconocido", () => {
      expect(localizeLoginError("something totally unrelated", t, FALLBACK)).toBe(FALLBACK);
    });
  });

  describe("entrada como Error vs string", () => {
    it("extrae message de una instancia Error", () => {
      expect(localizeLoginError(new Error("invalid credentials"), t, FALLBACK)).toBe(
        t.login.errorsField.recoveryInvalid,
      );
    });

    it("acepta string directamente", () => {
      expect(localizeLoginError("invalid credentials", t, FALLBACK)).toBe(
        t.login.errorsField.recoveryInvalid,
      );
    });
  });

  describe("cuenta bloqueada", () => {
    it("mapea 'cuenta ha sido bloqueada'", () => {
      expect(localizeLoginError("Tu cuenta ha sido bloqueada", t, FALLBACK)).toBe(t.login.blocked);
    });

    it("mapea 'account has been blocked'", () => {
      expect(localizeLoginError("Your account has been blocked", t, FALLBACK)).toBe(t.login.blocked);
    });

    it("mapea 'no puedes ingresar'", () => {
      expect(localizeLoginError("No puedes ingresar", t, FALLBACK)).toBe(t.login.blocked);
    });

    it("mapea 'cuenta no disponible'", () => {
      expect(localizeLoginError("Cuenta no disponible", t, FALLBACK)).toBe(t.login.blocked);
    });

    it("mapea 'account not available'", () => {
      expect(localizeLoginError("Account not available", t, FALLBACK)).toBe(t.login.blocked);
    });

    it("normaliza acentos en 'no puedes ingresar' (mayúsculas/tildes)", () => {
      // La función normaliza con NFD + quita diacríticos; 'ingresar' no lleva tilde,
      // pero verificamos que mayúsculas no afecten el match.
      expect(localizeLoginError("NO PUEDES INGRESAR", t, FALLBACK)).toBe(t.login.blocked);
    });
  });

  describe("apple sign-in", () => {
    it("mapea 'sign in with apple'", () => {
      expect(localizeLoginError("Couldn't sign in with Apple", t, FALLBACK)).toBe(
        t.login.errorsField.appleFailed,
      );
    });

    it("mapea texto en español con tilde 'apple no devolvio'", () => {
      // "apple no devolvió" -> normalize quita la tilde -> "apple no devolvio"
      expect(localizeLoginError("Apple no devolvió datos", t, FALLBACK)).toBe(
        t.login.errorsField.appleFailed,
      );
    });

    it("mapea 'no se pudo iniciar con apple'", () => {
      expect(localizeLoginError("No se pudo iniciar con Apple", t, FALLBACK)).toBe(
        t.login.errorsField.appleFailed,
      );
    });
  });

  describe("github", () => {
    it("mapea 'github'", () => {
      expect(localizeLoginError("GitHub OAuth failed", t, FALLBACK)).toBe(
        t.login.errorsField.githubFailed,
      );
    });
  });

  describe("microsoft", () => {
    it("mapea 'microsoft'", () => {
      expect(localizeLoginError("Microsoft login error", t, FALLBACK)).toBe(
        t.login.errorsField.microsoftFailed,
      );
    });
  });

  describe("google", () => {
    it("mapea 'google'", () => {
      expect(localizeLoginError("Google sign-in error", t, FALLBACK)).toBe(
        t.login.errorsField.googleFailed,
      );
    });

    it("mapea 'sign in cancelled'", () => {
      expect(localizeLoginError("Sign in cancelled", t, FALLBACK)).toBe(
        t.login.errorsField.googleFailed,
      );
    });

    it("mapea 'sign_in_cancelled'", () => {
      expect(localizeLoginError("sign_in_cancelled", t, FALLBACK)).toBe(
        t.login.errorsField.googleFailed,
      );
    });
  });

  describe("passkey", () => {
    it("mapea 'passkey'", () => {
      expect(localizeLoginError("Passkey not recognized", t, FALLBACK)).toBe(
        t.login.errorsField.passkeyFailed,
      );
    });

    it("mapea 'invalid passkey response'", () => {
      expect(localizeLoginError("Invalid passkey response", t, FALLBACK)).toBe(
        t.login.errorsField.passkeyFailed,
      );
    });
  });

  describe("recovery / credenciales inválidas", () => {
    it("mapea 'recovery code'", () => {
      expect(localizeLoginError("Recovery code invalid", t, FALLBACK)).toBe(
        t.login.errorsField.recoveryInvalid,
      );
    });

    it("mapea 'credenciales invalidas' (con tilde normalizada)", () => {
      expect(localizeLoginError("Credenciales inválidas", t, FALLBACK)).toBe(
        t.login.errorsField.recoveryInvalid,
      );
    });

    it("mapea 'codigo de recuperacion' (con tildes)", () => {
      expect(localizeLoginError("Código de recuperación incorrecto", t, FALLBACK)).toBe(
        t.login.errorsField.recoveryInvalid,
      );
    });
  });

  describe("mfa / totp / 2fa", () => {
    it("mapea 'totp'", () => {
      expect(localizeLoginError("Invalid TOTP", t, FALLBACK)).toBe(t.login.errorsField.mfaInvalid);
    });

    it("mapea '2fa'", () => {
      expect(localizeLoginError("2FA required", t, FALLBACK)).toBe(t.login.errorsField.mfaInvalid);
    });

    it("mapea 'mfa token'", () => {
      expect(localizeLoginError("MFA token missing", t, FALLBACK)).toBe(
        t.login.errorsField.mfaInvalid,
      );
    });
  });

  describe("prioridad de reglas (orden de evaluación)", () => {
    it("bloqueo gana sobre google si ambos términos aparecen", () => {
      // "blocked" se evalúa antes que "google".
      expect(
        localizeLoginError("Your account has been blocked from Google", t, FALLBACK),
      ).toBe(t.login.blocked);
    });

    it("github gana sobre google cuando ambos aparecen (github se evalúa primero)", () => {
      expect(localizeLoginError("github and google failed", t, FALLBACK)).toBe(
        t.login.errorsField.githubFailed,
      );
    });

    it("recovery (credenciales invalidas) gana sobre totp por orden", () => {
      expect(localizeLoginError("invalid credentials with totp", t, FALLBACK)).toBe(
        t.login.errorsField.recoveryInvalid,
      );
    });
  });
});
