// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Registro CENTRAL de reset de los stores module-level (higiene de sesión).
 *
 * Con el estado en stores a nivel de módulo (fases A4/B2–B4), cerrar sesión ya
 * NO desmonta el estado: sin un reset explícito, el siguiente login vería los
 * tickets/llaves SSH/conversaciones del usuario anterior (fuga de datos entre
 * cuentas). Cada store CON DATOS POR USUARIO se auto-registra aquí al cargarse
 * (una línea al final del módulo); el flujo de logout/cambio de cuenta llama
 * `resetAllStores()` sin conocer la lista — añadir un store nuevo no requiere
 * tocar AuthContext.
 *
 * Qué NO se registra: preferencias de dispositivo (tema, idioma, prefs de
 * burbujas/botones flotantes), datos de invitado (`storage/guestHistory`),
 * cuentas guardadas (`storage/savedAccounts`, son multi-cuenta a propósito) y
 * buses de eventos sin datos (rate-limit, agents-events).
 *
 * Este módulo NO importa nada (los stores lo importan a él): cero ciclos.
 */

type ResetFn = () => void;

const resetters = new Set<ResetFn>();

/** Registra la función de reset de un store (llamar a nivel de módulo, al
 *  crearse el store). Devuelve la baja (útil en tests; en la app no se usa). */
export function registerStoreReset(reset: ResetFn): () => void {
  resetters.add(reset);
  return () => {
    resetters.delete(reset);
  };
}

/**
 * Vacía TODOS los stores registrados (logout / cambio de cuenta / sesión
 * revocada). Los resets también abortan el trabajo en curso (p. ej. el
 * controller del chat aborta sus streams SSE/XHR activos antes de limpiarse).
 * Un reset roto no impide el resto (la limpieza de sesión es best-effort
 * pero debe llegar hasta el final).
 */
export function resetAllStores(): void {
  for (const reset of resetters) {
    try {
      reset();
    } catch {
      /* un store roto no debe dejar a medias la limpieza de sesión */
    }
  }
}
