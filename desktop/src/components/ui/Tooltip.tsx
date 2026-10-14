import type { CSSProperties, ReactNode } from "react";

/**
 * Posición del tooltip (daisyUI). Usa `bottom` para controles pegados al borde
 * superior (titlebar, cabeceras) y `top` para los pegados al borde inferior
 * (composer, footer de modal); así el globo cae "hacia adentro" y no lo recorta
 * un ancestro con `overflow:hidden`.
 */
export type TooltipPosition = "top" | "bottom" | "left" | "right";

export type TooltipColor =
  | "primary"
  | "secondary"
  | "accent"
  | "info"
  | "success"
  | "warning"
  | "error";

type TooltipProps = {
  /** Texto a mostrar. Si viene vacío no se renderiza el wrapper (no-op). */
  tip?: string | null;
  position?: TooltipPosition;
  color?: TooltipColor;
  /**
   * `display` del wrapper. Va por inline-style para ganarle al `inline-block`
   * que daisyUI fuerza en `.tooltip` (capa utilities). Por defecto
   * `inline-flex`, ideal para envolver un botón/enlace sin alterar su caja.
   */
  display?: CSSProperties["display"];
  className?: string;
  children: ReactNode;
};

/**
 * Wrapper del tooltip de daisyUI (https://daisyui.com/components/tooltip/).
 * Envuelve un control (botón, enlace, icono…) y muestra `tip` al hacer
 * hover/focus, reemplazando al `title` nativo del navegador.
 *
 * Cuándo envolver vs. aplicar las clases directamente:
 * - **Envolver con `<Tooltip>`** cuando aplicar `.tooltip` al propio control
 *   rompería su layout: botones daisyUI `.btn` (su `display:inline-flex` lo
 *   pisa el `inline-block` de `.tooltip`, que está en la misma capa utilities),
 *   controles dentro de un `.join`, o controles con `overflow:hidden` propio
 *   (el globo se recortaría a sí mismo).
 * - **Aplicar `tooltip tooltip-<pos>` + `data-tip` al control** cuando su clase
 *   propia es *unlayered* (p. ej. `.lp-icon-btn`, `.lp-modal-btn`): esa clase
 *   gana en `display`/`position` sobre `.tooltip`, así que no hay wrapper que
 *   mantener.
 *
 * Nota a11y: el `data-tip` NO es nombre accesible. Si el control queda sin
 * texto visible al quitar el `title`, dale un `aria-label`.
 */
export function Tooltip({
  tip,
  position = "top",
  color,
  display = "inline-flex",
  className,
  children,
}: TooltipProps) {
  const text = tip?.trim();
  if (!text) return <>{children}</>;
  const classes = [
    "tooltip",
    `tooltip-${position}`,
    color ? `tooltip-${color}` : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={classes} data-tip={text} style={{ display }}>
      {children}
    </span>
  );
}
