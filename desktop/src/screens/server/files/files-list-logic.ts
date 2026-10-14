/**
 * files-list-logic — lógica PURA de las listas de FilesModule (orden del
 * directorio y claves de lista). Sin React ni DOM: testeable en node. Copia
 * verbatim del gemelo de `app/` (agnóstica de UI, se reusa tal cual).
 */

/** Entrada de directorio (subconjunto que necesita el orden). */
export type SortableEntry = { name: string; isDir: boolean };

/**
 * Orden del listado de un directorio: carpetas primero, luego por nombre
 * (`localeCompare`). Es el criterio que ya usaba la pantalla; se extrae para
 * poder memoizarlo y testearlo.
 */
export function compareEntries(a: SortableEntry, b: SortableEntry): number {
  if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
  return a.name.localeCompare(b.name);
}

/** Copia ordenada del listado (no muta la entrada). */
export function sortEntries<E extends SortableEntry>(entries: readonly E[]): E[] {
  return [...entries].sort(compareEntries);
}

/**
 * Clave estable de una línea del visor de comprimidos. Un .tar puede repetir
 * la misma ruta (p. ej. entradas de directorio duplicadas), así que la clave
 * incluye el índice — como hacía el `key` original — para no colisionar.
 */
export function archiveKeyExtractor(line: string, index: number): string {
  return `${line}-${index}`;
}
