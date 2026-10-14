/**
 * Método preferido para el step-up 2FA por acción. En vez de elegir el método
 * en cada verificación (passkey / código de app / código de recuperación), el
 * usuario fija UNO en Seguridad y el modal de step-up lo usa directo (sin
 * selector). Es una preferencia local del dispositivo (localStorage); si no hay
 * ninguna fijada o el método no está disponible, el modal vuelve al selector.
 */
export type StepUpMethod = "passkey" | "totp" | "recovery";

const KEY = "lp.stepUpMethod";

export function getStepUpMethodPref(): StepUpMethod | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "passkey" || v === "totp" || v === "recovery" ? v : null;
  } catch {
    return null;
  }
}

export function setStepUpMethodPref(method: StepUpMethod | null): void {
  try {
    if (method) localStorage.setItem(KEY, method);
    else localStorage.removeItem(KEY);
  } catch {
    /* almacenamiento no disponible: la preferencia simplemente no persiste */
  }
}
