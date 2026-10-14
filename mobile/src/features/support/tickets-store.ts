// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Store MODULE-LEVEL de los tickets de soporte (fase B4, dominio tickets).
 *
 * Posee la lista de tickets y su flag de carga fuera del árbol de React,
 * compartidos por todas las pestañas (antes cada MainTab tenía su copia +
 * `ticketsRef`). Cada mutación persiste el cache scoped por cuenta
 * (`storage/portalDataCache`) en best-effort, como hacía el hook.
 *
 * Los estados de los MODALES (nuevo ticket / detalle) siguen en el hook: son
 * UI por pestaña y se promoverán a screens modales en una tanda posterior.
 *
 * La siembra desde cache (`hydrateTicketsFromCache`) solo aplica si ningún
 * fetch/replace la pisó ya: con el store compartido, la hidratación tardía de
 * otra pestaña no debe clobberear datos más frescos del bootstrap.
 *
 * Patrón module-store + `useSyncExternalStore`, como el resto del repo.
 */
import { useSyncExternalStore } from "react";
import { getTickets as fetchTickets } from "../../api/client";
import { registerStoreReset } from "../../lib/store-reset";
import { loadTicketsCache, saveTicketsCache } from "../../storage/portalDataCache";
import type { Ticket } from "../../types/models";

export type TicketsState = {
  tickets: Ticket[];
  /** `true` mientras corre el refresh explícito (spinner de la pantalla). */
  busy: boolean;
};

let state: TicketsState = { tickets: [], busy: false };
/** `true` en cuanto un fetch/replace fijó datos frescos (gate del hydrate). */
let fresh = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setState(next: TicketsState): void {
  if (next === state) return;
  state = next;
  emit();
}

function setTicketsAndCache(userEmail: string | null | undefined, tickets: Ticket[]): void {
  fresh = true;
  setState({ ...state, tickets });
  void saveTicketsCache(userEmail, tickets);
}

/** Snapshot imperativo (mutadores async que no deben depender del render). */
export function getTickets(): Ticket[] {
  return state.tickets;
}

/** Siembra desde el cache local de la cuenta, solo si aún no hay datos
 *  frescos (el bootstrap/refresh mandan). No persiste (ya viene de disco). */
export async function hydrateTicketsFromCache(userEmail: string | null | undefined): Promise<void> {
  const cache = await loadTicketsCache(userEmail);
  if (!cache || fresh) return;
  setState({ ...state, tickets: cache.tickets });
}

/** Recarga la lista desde la API (marca `busy`), persiste el cache y devuelve
 *  las filas. Los errores PROPAGAN (mismo contrato que el hook: el spinner se
 *  apaga en finally y el caller decide). */
export async function refreshTickets(
  token: string,
  userEmail: string | null | undefined,
): Promise<Ticket[]> {
  setState({ ...state, busy: true });
  try {
    const rows = await fetchTickets(token);
    setTicketsAndCache(userEmail, rows);
    return rows;
  } finally {
    setState({ ...state, busy: false });
  }
}

/** Reemplazo completo (bootstrap inicial junto a paneles). */
export function replaceTickets(userEmail: string | null | undefined, tickets: Ticket[]): void {
  setTicketsAndCache(userEmail, tickets);
}

/** Prepend de un ticket recién creado. */
export function applyTicketCreated(userEmail: string | null | undefined, ticket: Ticket): void {
  setTicketsAndCache(userEmail, [ticket, ...state.tickets]);
}

/** Actualiza UNA fila con un updater (respuesta enviada / cambio de estado). */
export function applyTicketUpdated(
  userEmail: string | null | undefined,
  ticketId: string,
  update: (ticket: Ticket) => Ticket,
): void {
  setTicketsAndCache(userEmail, state.tickets.map((x) => (x.id === ticketId ? update(x) : x)));
}

export function applyTicketDeleted(userEmail: string | null | undefined, ticketId: string): void {
  setTicketsAndCache(userEmail, state.tickets.filter((x) => x.id !== ticketId));
}

/** Estado reactivo (lista + busy) para el hook y las pantallas. */
export function useTickets(): TicketsState {
  return useSyncExternalStore(subscribe, () => state);
}

/** SOLO tests: resetea el estado en memoria (no toca disco). */
export function __resetTicketsForTests(): void {
  state = { tickets: [], busy: false };
  fresh = false;
}

// Logout / cambio de cuenta: tickets = datos por-usuario → fuera (el cache a
// disco ya está scoped por cuenta en `portalDataCache`, no hay que tocarlo).
registerStoreReset(() => {
  fresh = false;
  if (state.tickets.length > 0 || state.busy) setState({ tickets: [], busy: false });
});
