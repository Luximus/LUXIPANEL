// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type {
  DataTableColumnConfig,
  DataTableRowActionConfig,
  DataTableValueBadgeConfig,
} from "@/components/ui/DataTable";
import { BADGE } from "./badges";
import { editAction, deleteAction } from "./table-actions";
import { pick, type TableMessages } from "./table-i18n";

// Tabla del módulo `servers` (registro local de destinos SSH, sin secretos).
// Las etiquetas viven bajo el namespace i18n `servers` (`table.*`, `common.*`,
// `authTypes.*`, `status.*`). Los builders caen al español si falta una clave
// para que la tabla nunca renderice sin encabezados. Los `value` de los badges
// quedan en el idioma del usuario porque deben coincidir EXACTAMENTE con el
// valor de la celda (el script localiza con el mismo subárbol).

export type ServersTableMessages = TableMessages<"table" | "common" | "authTypes" | "status">;

export function buildServersTableColumns(t?: ServersTableMessages): DataTableColumnConfig[] {
  const tb = t?.table;
  return [
    { id: "name", header: pick(tb, "name", "Nombre"), accessorKey: "name", sortable: true, hideable: false },
    { id: "host", header: pick(tb, "host", "Host"), accessorKey: "host", sortable: true, hideable: true },
    { id: "username", header: pick(tb, "username", "Usuario"), accessorKey: "username", sortable: true, hideable: true },
    { id: "authType", header: pick(tb, "authType", "Autenticación"), accessorKey: "authType", sortable: true, hideable: true },
    { id: "status", header: pick(tb, "status", "Estado"), accessorKey: "status", sortable: true, hideable: true },
  ];
}

export function buildServersTableRowActions(t?: ServersTableMessages): DataTableRowActionConfig[] {
  const c = t?.common;
  return [
    { id: "test", label: pick(c, "test", "Probar"), icon: "ti-plug-connected" },
    // Panel-to-panel MCP pairing (only meaningful for targets flagged as running
    // LUXIPANEL; the handler no-ops with a hint otherwise).
    { id: "pair", label: pick(c, "pair", "Emparejar"), icon: "ti-plugs-connected" },
    editAction(c),
    deleteAction(c),
  ];
}

// Badges de estado (aprobado / pendiente / sin probar). Los `value` deben
// coincidir con lo que el script pinta en la celda `status`.
export function buildServersValueBadges(t?: ServersTableMessages): DataTableValueBadgeConfig[] {
  const s = t?.status;
  const a = t?.authTypes;
  return [
    { value: pick(s, "approved", "Aprobado"), className: BADGE.okPill },
    { value: pick(s, "pending", "Pendiente"), className: BADGE.warnPill },
    { value: pick(s, "untested", "Sin probar"), className: BADGE.neutralPill },
    { value: pick(a, "key", "Clave SSH"), className: BADGE.skyPill },
    { value: pick(a, "password", "Contraseña"), className: BADGE.amberPill },
  ];
}
