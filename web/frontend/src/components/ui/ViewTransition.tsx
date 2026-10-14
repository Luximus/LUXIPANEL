// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * ViewTransition — cambio de vista (tabs / menús / pasos) con el preset único
 * de movimiento del panel (`src/styles/motion.css`, sección "Cambio de VISTA":
 * `.lxp-view-enter`, `.lxp-view-enter-right`, `.lxp-view-enter-left`, 200ms
 * ease-out). Sólo se anima el panel ENTRANTE; el saliente desaparece en seco
 * (evita doble layout y no necesita JS de timing).
 *
 * Dos estrategias, según el coste de remontar la vista:
 *
 * 1. `<ViewTransition viewKey={tab}>` — remonta un `<div key>` en cada cambio,
 *    lo que reinicia la animación CSS. Úsalo cuando el contenido YA se monta y
 *    desmonta con el tab (bloques `{tab === "x" && …}`): el remontaje del
 *    wrapper no añade coste. NO lo uses sobre vistas que deben conservar
 *    estado interno al alternar (chat con stream en curso, xterm, paneles con
 *    DOM gobernado por scripts imperativos).
 *
 * 2. `useViewEnterReplay(activeKey, direction)` — devuelve un `ref` para un
 *    contenedor que YA está montado (las vistas se muestran/ocultan con
 *    `display`). En cada cambio de `activeKey` quita y vuelve a poner la clase
 *    de entrada (con reflow entre medias) para reproducir la animación sin
 *    remontar nada. No anima en el primer render.
 *
 * `useViewDirection(activeKey, orderedKeys)` calcula la dirección: ir a un tab
 * posterior en el orden → entra desde la derecha; anterior → desde la
 * izquierda; sin orden conocido o primer render → "none" (fade + 6px arriba).
 *
 * Layout: el wrapper es un `<div>` normal (no `display:contents`, que anularía
 * transform/opacity). Pasa `className` para heredar el layout del sitio
 * (`flex-1 min-h-0 flex flex-col`, `space-y-3`, `h-full`…) y no romper
 * scroll/altura. `prefers-reduced-motion` lo cubre motion.css.
 */
import { createElement, useEffect, useRef, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ViewDirection = "right" | "left" | "none";

const ENTER_CLASSES = ["lxp-view-enter", "lxp-view-enter-right", "lxp-view-enter-left"] as const;

/** Clase de entrada del preset para una dirección. */
export function viewEnterClass(direction: ViewDirection = "none"): string {
  if (direction === "right") return "lxp-view-enter-right";
  if (direction === "left") return "lxp-view-enter-left";
  return "lxp-view-enter";
}

/**
 * Dirección del cambio de vista según el índice de `activeKey` en
 * `orderedKeys` respecto al valor anterior. Estable entre renders con el mismo
 * `activeKey` (StrictMode-safe: el segundo render no ve cambio).
 */
export function useViewDirection<K>(activeKey: K, orderedKeys: readonly K[]): ViewDirection {
  const prevRef = useRef<K>(activeKey);
  const dirRef = useRef<ViewDirection>("none");
  if (prevRef.current !== activeKey) {
    const prev = orderedKeys.indexOf(prevRef.current);
    const next = orderedKeys.indexOf(activeKey);
    dirRef.current = prev < 0 || next < 0 || prev === next ? "none" : next > prev ? "right" : "left";
    prevRef.current = activeKey;
  }
  return dirRef.current;
}

export interface ViewTransitionProps {
  /** Identidad de la vista activa; cambiarla remonta el wrapper (reinicia la animación). */
  viewKey: string | number;
  direction?: ViewDirection;
  className?: string;
  /** Etiqueta del wrapper (por defecto `div`). */
  as?: ElementType;
  children?: ReactNode;
}

/** Wrapper remontado por `viewKey` con la clase de entrada del preset. */
export function ViewTransition({ viewKey, direction = "none", className, as, children }: ViewTransitionProps) {
  return createElement(
    as ?? "div",
    { key: viewKey, className: cn(viewEnterClass(direction), className) },
    children,
  );
}

/**
 * Reproduce la animación de entrada sobre un contenedor YA montado cada vez que
 * cambia `activeKey` (vistas que alternan con `display`, no con montaje).
 * No anima en el primer render.
 */
export function useViewEnterReplay<T extends HTMLElement>(
  activeKey: unknown,
  direction: ViewDirection = "none",
) {
  const ref = useRef<T>(null);
  const first = useRef(true);
  const dirRef = useRef(direction);
  dirRef.current = direction;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = ref.current;
    if (!el) return;
    el.classList.remove(...ENTER_CLASSES);
    // Forzar reflow para que el navegador reinicie la animación al re-añadir.
    void el.offsetWidth;
    el.classList.add(viewEnterClass(dirRef.current));
  }, [activeKey]);
  return ref;
}
