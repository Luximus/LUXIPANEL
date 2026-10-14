// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Store MODULE-LEVEL de las llaves SSH de la cuenta (fase B4, dominio SSH).
 *
 * Primera pieza del troceo de `useMainTabController`: la lista de llaves y sus
 * mutadores locales viven fuera del árbol de React, compartidos por todas las
 * pestañas (antes cada MainTab tenía su copia y su propio refetch). El hook la
 * consume vía `useSshKeys`; los flujos imperativos (submit del editor de panel,
 * selector de método de conexión) leen el snapshot con `getSshKeys`.
 *
 * Los mutadores `applySshKey*` replican el contrato previo del hook: tras la
 * mutación en la API actualizan el estado en memoria SIN refetch. Al cerrar
 * sesión el store se vacía vía `lib/store-reset` (las llaves son datos del
 * usuario: no deben sobrevivir a un cambio de cuenta); el efecto de bootstrap
 * re-sincroniza al entrar otro token.
 *
 * Patrón module-store + `useSyncExternalStore`, como el resto del repo.
 */
import { useSyncExternalStore } from "react";
import { getSshKeys as fetchSshKeys, type SshKeySummary } from "../../api/client";
import { registerStoreReset } from "../../lib/store-reset";

let keys: SshKeySummary[] = [];
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

function setKeys(next: SshKeySummary[]): void {
  if (next === keys) return;
  keys = next;
  emit();
}

/** Snapshot imperativo (flujos async que no deben depender del render). */
export function getSshKeys(): SshKeySummary[] {
  return keys;
}

/** Recarga la lista desde la API. Errores: los traga y conserva la lista
 *  vigente (mismo contrato que el `refreshSshKeys` del hook). */
export async function refreshSshKeys(token: string): Promise<void> {
  try {
    setKeys(await fetchSshKeys(token));
  } catch (error) {
    console.error(error);
  }
}

export function applySshKeyCreated(key: SshKeySummary): void {
  setKeys(keys.some((k) => k.id === key.id)
    ? keys.map((k) => (k.id === key.id ? key : k))
    : [...keys, key]);
}

export function applySshKeyUpdated(key: SshKeySummary): void {
  setKeys(keys.map((k) => (k.id === key.id ? key : k)));
}

export function applySshKeyDeleted(id: string): void {
  setKeys(keys.filter((k) => k.id !== id));
}

/** Llaves asignadas a un panel (por `panelIds`), sobre el snapshot actual. */
export function getKeysAttachedToPanel(panelId: string): SshKeySummary[] {
  return keys.filter((key) => Array.isArray(key.panelIds) && key.panelIds.includes(panelId));
}

/** Lista reactiva (la consumen el hook y las pantallas). */
export function useSshKeys(): SshKeySummary[] {
  return useSyncExternalStore(subscribe, () => keys);
}

/** SOLO tests: resetea el estado en memoria. */
export function __resetSshKeysForTests(): void {
  keys = [];
}

// Logout / cambio de cuenta: las llaves son datos por-usuario → fuera.
registerStoreReset(() => {
  if (keys.length > 0) setKeys([]);
});
