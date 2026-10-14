import { useEffect, useRef } from "react";
import { Keyboard } from "react-native";
import { cancelActiveInlineEdit, registerInlineEditCancel, unregisterInlineEditCancel } from "../lib/inline-edit-back";

/**
 * Sesión de edición INLINE (renombrar categoría/tag/pestaña/consola en la
 * fila): mientras `editing` sea true, registra `cancel` como la edición activa
 * para que la descarten (sin commit) tanto el botón atrás de Android como el
 * OCULTADO del teclado (atrás con teclado abierto, swipe para cerrarlo…).
 * Al confirmar (submit/✓) la edición termina antes de que llegue el evento
 * `keyboardDidHide`, así que el commit no se cancela.
 */
export function useInlineEditCancel(editing: boolean, cancel: () => void): void {
  // `cancel` suele ser una closure nueva por render: se lee por ref para no
  // re-registrar (y perder el listener) en cada tecleo del borrador.
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  useEffect(() => {
    if (!editing) return;
    const doCancel = () => cancelRef.current();
    registerInlineEditCancel(doCancel);
    const hide = Keyboard.addListener("keyboardDidHide", () => cancelActiveInlineEdit());
    return () => {
      hide.remove();
      unregisterInlineEditCancel(doCancel);
    };
  }, [editing]);
}
