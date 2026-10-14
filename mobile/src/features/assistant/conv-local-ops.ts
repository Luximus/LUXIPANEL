// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Mutaciones locales del drawer de conversaciones (borrar / renombrar / fijar)
 * pendientes de verse reflejadas en lo que devuelve el servidor.
 *
 * El drawer pinta de forma optimista y a la vez trae la lista por páginas en
 * background (el árbol de agentes agrupa sobre la lista ENTERA). Una página que
 * se pidió con la lista vieja llega DESPUÉS de la mutación y, al pintarse,
 * resucitaba el chat recién borrado o revertía un rename que el servidor ya
 * había aceptado. Todo snapshot del servidor se fusiona aquí antes de pintarse.
 *
 * VERSIONADO (`seq`): cada mutación en vuelo estampa su número de secuencia en
 * los campos que escribe. El rollback de una petición fallida solo puede tocar
 * el campo si ESA petición sigue siendo la dueña del valor pendiente: sin esto,
 * dos mutaciones rápidas sobre la misma fila (renombrar A → renombrar B) hacían
 * que el fallo de la primera borrase la op local de la segunda —que el servidor
 * SÍ había aceptado— y el siguiente snapshot restauraba el título viejo.
 */
import type { Conversation } from "./types";

/** Campos mutables de una op local (los que se versionan con `seq`). */
export type ConvLocalOpField = "removed" | "title" | "pinned";
const OP_FIELDS: ConvLocalOpField[] = ["removed", "title", "pinned"];

export type ConvLocalOp = {
  removed?: boolean;
  title?: string;
  pinned?: boolean;
  /** Secuencia de la mutación que escribió cada campo pendiente (ver arriba). */
  seq?: Partial<Record<ConvLocalOpField, number>>;
};
export type ConvLocalOps = Map<string, ConvLocalOp>;

/** Contador monotónico de mutaciones (vida del proceso). Cada llamada a una
 *  mutación del drawer toma uno y lo pasa a `setLocalOp`/`clearLocalOp`. */
let opSeq = 0;
export function nextOpSeq(): number {
  opSeq += 1;
  return opSeq;
}

/** Aplica las mutaciones locales sobre un snapshot del servidor: quita lo borrado
 *  y reimpone renames/pines. */
export function mergeLocalOps(items: Conversation[], ops: ConvLocalOps): Conversation[] {
  if (ops.size === 0) return items;
  const out: Conversation[] = [];
  for (const c of items) {
    const op = ops.get(c.id);
    if (!op) { out.push(c); continue; }
    if (op.removed) continue;
    out.push({
      ...c,
      ...(op.title !== undefined ? { title: op.title } : {}),
      ...(op.pinned !== undefined ? { pinned: op.pinned } : {}),
    });
  }
  return out;
}

/** Registra (acumulando sobre lo ya pendiente) una mutación local. `seq` marca
 *  qué petición escribió cada campo, para que solo ella pueda revertirlo. */
export function setLocalOp(ops: ConvLocalOps, id: string, op: ConvLocalOp, seq?: number): void {
  const cur = ops.get(id) ?? {};
  const nextSeq: Partial<Record<ConvLocalOpField, number>> = { ...(cur.seq ?? {}) };
  if (seq !== undefined) {
    for (const f of OP_FIELDS) if (op[f] !== undefined) nextSeq[f] = seq;
  }
  const next: ConvLocalOp = { ...cur, ...op };
  // Sin versión (llamadas legacy/sin `seq`) la op no lleva el campo: el rollback
  // sin `seq` limpia incondicionalmente, como antes.
  if (Object.keys(nextSeq).length > 0) next.seq = nextSeq;
  else delete next.seq;
  ops.set(id, next);
}

/**
 * Retira un campo de la mutación pendiente (rollback: el servidor la rechazó) y
 * descarta la entrada si ya no queda nada pendiente.
 *
 * Con `seq`: solo limpia si el valor pendiente lo escribió ESA petición. Devuelve
 * `true` si se limpió (el llamador debe revertir también lo pintado) y `false` si
 * la op ya no es suya (una mutación posterior manda: no se toca nada).
 */
export function clearLocalOp(ops: ConvLocalOps, id: string, field: ConvLocalOpField, seq?: number): boolean {
  const op = ops.get(id);
  if (!op) return false;
  if (op[field] === undefined) return false;
  if (seq !== undefined && op.seq?.[field] !== seq) return false;
  delete op[field];
  if (op.seq) delete op.seq[field];
  if (op.removed === undefined && op.title === undefined && op.pinned === undefined) ops.delete(id);
  return true;
}
