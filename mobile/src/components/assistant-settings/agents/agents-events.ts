// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Bus de eventos en memoria para "agentes actualizados". Reemplaza el
 * `window.dispatchEvent(new CustomEvent("lxp:assistant:agents-updated"))` del
 * web (no hay `window` en React Native). Tras cada mutación (crear/editar/
 * eliminar agente/rol/equipo) se llama `agentsEvents.emit()`; los consumidores
 * (AgentsModule, dashboards) se re-suscriben para recargar.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export const agentsEvents = {
  /** Notifica a todos los suscriptores que los agentes cambiaron. */
  emit(): void {
    for (const cb of listeners) {
      try {
        cb();
      } catch {
        /* un listener roto no debe tumbar al resto */
      }
    }
  },
  /** Suscribe un callback; devuelve la función para des-suscribir. */
  subscribe(cb: Listener): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};
