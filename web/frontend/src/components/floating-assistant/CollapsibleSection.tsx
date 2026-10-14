// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useId, useState, type ReactNode } from "react";

/**
 * Contenedor colapsable reutilizable para las secciones del asistente.
 *
 * Cabecera estilo "Tailwind Plus header": icon-box opcional + título +
 * descripción (clickable) + slot opcional a la derecha (p.ej. el interruptor de
 * activación) + chevron a la DERECHA que rota 180° al abrir. El cuerpo se
 * muestra/oculta al pulsar la cabecera (no al pulsar el slot derecho). Estado
 * inicial = colapsado.
 */
export function CollapsibleSection({
  title,
  description,
  icon,
  iconClassName,
  headerAction,
  stackActionsOnMobile = false,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Icono/avatar opcional renderizado dentro de la icon-box al inicio de la fila. */
  icon?: ReactNode;
  /** Override de las clases de la icon-box (p.ej. un tint de marca). Por defecto neutral. */
  iconClassName?: string;
  headerAction?: ReactNode;
  /**
   * Cuando `headerAction` es un cluster ancho (varios botones), apílalo en su
   * propia línea a ancho completo por debajo de @2xl (container query = el panel
   * del drawer) para que el título/descripción no quede aplastado en móvil. En
   * @2xl+ vuelve a la fila única de siempre. Los headerAction pequeños (un
   * toggle) NO deben activarlo. Ver AgentsTab (tarjetas de equipo).
   */
  stackActionsOnMobile?: boolean;
  defaultOpen?: boolean;
  /** Controlled mode: the parent owns the open state (defaultOpen is ignored). */
  open?: boolean;
  onOpenChange?(open: boolean): void;
  className?: string;
  children: ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const toggle = () => {
    if (controlledOpen === undefined) setInternalOpen(!open);
    onOpenChange?.(!open);
  };
  const bodyId = useId();

  return (
    <section
      className={
        className
          ? `rounded-xl border-2 transition-colors ${className}`
          : "rounded-lg border border-border bg-card/40"
      }
    >
      <header
        className={
          "group relative flex items-center gap-x-4 rounded-lg p-4 transition-colors hover:bg-muted/40" +
          (stackActionsOnMobile ? " flex-wrap gap-y-2 @2xl:flex-nowrap @2xl:gap-y-0" : "")
        }
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-center gap-x-4 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {icon != null && (
            <span
              className={
                iconClassName ??
                "flex size-11 flex-none items-center justify-center rounded-lg bg-muted/60 text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-foreground"
              }
            >
              {icon}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">{title}</span>
            {description && (
              <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                {description}
              </span>
            )}
          </span>
        </button>
        {headerAction && (
          <div
            className={
              "flex-none" +
              (stackActionsOnMobile
                ? " order-last w-full @2xl:order-none @2xl:w-auto"
                : "")
            }
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {headerAction}
          </div>
        )}
        <button
          type="button"
          onClick={toggle}
          tabIndex={-1}
          aria-hidden
          className="flex-none rounded-sm text-muted-foreground transition-colors group-hover:text-foreground"
        >
          <i
            className={`ti ti-chevron-down text-sm transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </header>
      <div
        id={bodyId}
        role="region"
        aria-hidden={!open}
        className={open
          ? "grid grid-rows-[1fr] px-4 pb-4 transition-[grid-template-rows] duration-200 ease-out"
          : "hidden"}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="rounded-xl bg-muted/30 p-4">{children}</div>
        </div>
      </div>
    </section>
  );
}
