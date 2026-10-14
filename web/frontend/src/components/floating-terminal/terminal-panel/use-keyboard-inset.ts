// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useState } from "react";

/**
 * Detección del teclado virtual (móvil) vía VisualViewport: cuando el teclado
 * se despliega, el viewport visual se encoge respecto al de layout. Ese
 * "inset" inferior = altura del teclado. Lo usamos para (a) revelar la barra
 * de teclas auxiliares SÓLO mientras el teclado está abierto y (b) anclarla
 * justo por encima del teclado (`position: fixed; bottom: inset`). Umbral
 * alto (150px) para no confundir el ocultar/mostrar de la barra de URL del
 * navegador con el teclado. Ningún navegador de escritorio dispara esto.
 */
export function useKeyboardInset(): number {
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    let raf = 0;
    const update = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        const inset = window.innerHeight - vv.height - vv.offsetTop;
        setKeyboardInset(inset > 150 ? Math.round(inset) : 0);
      });
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      window.cancelAnimationFrame(raf);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return keyboardInset;
}
