// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tailwind className strings compartidos para los badges de estado de las
 * tablas (DataTableValueBadgeConfig.className). Se factorizan aquí porque los
 * mismos pills emerald/rose/neutral se re-tecleaban verbatim en varios
 * table-configs; cualquier cambio de estilo se hace ahora en un solo sitio.
 *
 * IMPORTANTE: estos strings deben permanecer como literales completos y
 * byte-idénticos a los originales — Tailwind v4 genera las clases escaneando
 * los `.ts` por coincidencia textual estática, así que NO deben construirse por
 * interpolación (un color dinámico no se detectaría y rompería el estilo).
 */

/** Pills `rounded-full` de estado (verde "ok", rojo "peligro", neutro). */
export const BADGE = {
  /** Verde — estado activo/disponible. */
  okPill:
    "inline-flex items-center rounded-full border border-emerald-600/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300",
  /** Rojo — estado fallido/bloqueado/desactivado. */
  dangerPill:
    "inline-flex items-center rounded-full border border-rose-600/30 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-700 dark:text-rose-300",
  /** Neutro — estado inactivo/pausado. */
  neutralPill:
    "inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground",
  /** Ámbar — advertencia/atención (proxy activo, challenge de acceso, etc.). */
  warnPill:
    "inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400",
  /** Ámbar fuerte — estado suspendido / grupo de sistema. */
  amberPill:
    "inline-flex items-center rounded-full border border-amber-600/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300",
  /** Azul cielo — grupo de usuario / categoría informativa. */
  skyPill:
    "inline-flex items-center rounded-full border border-sky-600/30 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-300",
  /** Color de marca (primary) — proveedor de almacenamiento (S3/R2). */
  primaryPill:
    "inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary",
} as const;
