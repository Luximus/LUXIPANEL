// Registro global de la edición INLINE activa (renombrar categoría/tag en la
// fila, renombrar pestaña/consola…). El botón atrás de Android lo consulta
// ANTES de cerrar el contenedor (drawer lateral, FormSheet, Modal): si hay una
// edición en curso, atrás la CANCELA (descarta el borrador) y consume el
// evento; el contenedor solo se cierra en el siguiente atrás.
//
// Solo puede haber una edición inline activa a la vez (una única fila con su
// TextInput enfocado), por eso basta un slot único: cada editor registra su
// "cancelar" al entrar en edición y lo retira al salir.

type CancelInlineEdit = () => void;

let active: CancelInlineEdit | null = null;

export function registerInlineEditCancel(cancel: CancelInlineEdit): void {
  active = cancel;
}

export function unregisterInlineEditCancel(cancel: CancelInlineEdit): void {
  if (active === cancel) active = null;
}

/** Cancela la edición inline activa si la hay. Devuelve true si consumió el atrás. */
export function cancelActiveInlineEdit(): boolean {
  if (!active) return false;
  const cancel = active;
  active = null;
  cancel();
  return true;
}
