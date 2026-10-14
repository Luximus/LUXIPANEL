// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type {
  DataTableColumnConfig,
  DataTableRowActionConfig,
  DataTableValueBadgeConfig,
} from "@/components/ui/DataTable";
import { BADGE } from "./badges";
import { deleteAction, editAction } from "./table-actions";
import { pick, type TableMessages } from "./table-i18n";

// Las dos tablas del módulo server-alerts: "Notificaciones programadas" y
// "Reglas por métrica". Las etiquetas viven bajo el namespace i18n
// `serverAlerts` (`scheduled.*`, `rules.*`, `common.*`); estos builders toman
// ese subárbol y caen al español si falta una clave, de modo que la tabla nunca
// renderiza sin encabezados. Los `value` de badges quedan en el idioma del
// usuario porque deben coincidir EXACTAMENTE con el valor de la celda (que el
// script también localiza con el mismo subárbol: `common.yes`/`common.no`).

export type ServerAlertsTableMessages = TableMessages<"scheduled" | "rules" | "common">;

// ── Notificaciones programadas ───────────────────────────────────────────────
export function buildScheduledTableColumns(t?: ServerAlertsTableMessages): DataTableColumnConfig[] {
  const s = t?.scheduled;
  return [
    { id: "title", header: pick(s, "fieldTitle", "Título"), accessorKey: "title", sortable: true, hideable: false },
    { id: "when", header: pick(s, "when", "Cuándo"), accessorKey: "when", sortable: false, hideable: true },
    { id: "recurring", header: pick(s, "recurring", "Recurrente"), accessorKey: "recurring", sortable: true, hideable: true },
    { id: "enabled", header: pick(s, "enabled", "Activa"), accessorKey: "enabled", sortable: true, hideable: true },
    {
      id: "lastFired",
      header: pick(s, "lastFired", "Último disparo"),
      accessorKey: "lastFired",
      sortable: true,
      sortAccessor: "lastFiredTs",
      hideable: true,
    },
  ];
}

export function buildScheduledTableRowActions(t?: ServerAlertsTableMessages): DataTableRowActionConfig[] {
  const c = t?.common;
  return [editAction(c), { id: "toggle", label: pick(c, "toggle", "Activar o pausar"), icon: "ti-player-pause" }, deleteAction(c)];
}

// ── Reglas por métrica ───────────────────────────────────────────────────────
export function buildRulesTableColumns(t?: ServerAlertsTableMessages): DataTableColumnConfig[] {
  const r = t?.rules;
  const s = t?.scheduled;
  return [
    { id: "name", header: pick(r, "name", "Nombre"), accessorKey: "name", sortable: true, hideable: false },
    { id: "metric", header: pick(r, "metric", "Métrica"), accessorKey: "metric", sortable: true, hideable: true },
    { id: "condition", header: pick(r, "condition", "Condición"), accessorKey: "condition", sortable: false, hideable: true },
    { id: "cooldown", header: pick(r, "cooldown", "Cooldown"), accessorKey: "cooldown", sortable: true, sortAccessor: "cooldownTs", hideable: true },
    { id: "enabled", header: pick(r, "enabled", "Activa"), accessorKey: "enabled", sortable: true, hideable: true },
    {
      id: "lastFired",
      header: pick(s, "lastFired", "Último disparo"),
      accessorKey: "lastFired",
      sortable: true,
      sortAccessor: "lastFiredTs",
      hideable: true,
    },
  ];
}

export function buildRulesTableRowActions(t?: ServerAlertsTableMessages): DataTableRowActionConfig[] {
  const c = t?.common;
  return [editAction(c), { id: "toggle", label: pick(c, "toggle", "Activar o pausar"), icon: "ti-player-pause" }, deleteAction(c)];
}

// Badges compartidos por ambas tablas para las columnas booleanas (Recurrente /
// Activa) — pero el DataTable ya pinta los booleanos JS como Sí/No localizado.
// Estos badges se usan solo si la celda fuera string; los dejamos disponibles
// por si una columna necesita un pill explícito (verde = sí, neutro = no).
export function buildServerAlertsValueBadges(t?: ServerAlertsTableMessages): DataTableValueBadgeConfig[] {
  const c = t?.common;
  const yes = pick(c, "yes", "Sí");
  const no = pick(c, "no", "No");
  return [
    { value: yes, className: BADGE.okPill },
    { value: no, className: BADGE.neutralPill },
  ];
}
