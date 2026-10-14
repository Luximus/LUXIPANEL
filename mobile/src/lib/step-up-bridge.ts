/**
 * Puente imperativo entre el helper `request` (no-React) y el host de modal de
 * step-up (React). `StepUpProvider` registra su handler aquí; cuando el backend
 * responde 403 STEP_UP_REQUIRED, `request` llama a `promptStepUp(scope)`, que
 * abre el modal, verifica el código TOTP y devuelve un token step-up (o null si
 * se cancela / no hay 2FA). El provider cachea el token por scope (~5 min).
 */
export type StepUpHandler = (scope: string) => Promise<string | null>;

let handler: StepUpHandler | null = null;

export function registerStepUpHandler(next: StepUpHandler | null): void {
  handler = next;
}

export async function promptStepUp(scope: string): Promise<string | null> {
  if (!handler) return null;
  try {
    return await handler(scope);
  } catch {
    return null;
  }
}
