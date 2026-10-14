// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type {
  DataTableColumnConfig,
  DataTableRowActionConfig,
  DataTableValueBadgeConfig,
} from "@/components/ui/DataTable";
import { deleteAction, editAction } from "./table-actions";
import { pick, type Dict, type TableMessages } from "./table-i18n";

// Tres tablas del módulo Expo: historial de builds, cuentas de tienda y
// variables de entorno. Las etiquetas viven bajo el namespace i18n `expo`
// (`history.*`, `storeAccounts.*`, `env.*`); los builders caen al español si
// falta una clave. Los `value` de filtros/badges quedan en el idioma del
// usuario porque deben coincidir EXACTAMENTE con el valor de la celda (que el
// script localiza con el mismo subárbol).

export type ExpoTableMessages = TableMessages<"history" | "storeAccounts" | "env">;

// Pills de estado/fuente (espejo de BUILD_STATUS_TONE del script). Literales
// COMPLETOS para que Tailwind v4 los detecte por escaneo estático — no se
// construyen por interpolación; solo se reutilizan entre las dos tablas.
const PILL_EMERALD = "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-500";
const PILL_AMBER = "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-500";
const PILL_SKY = "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-sky-500/10 text-sky-500";
const PILL_MUTED = "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground";
const PILL_DESTRUCTIVE = "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-destructive/10 text-destructive";

// ── Historial de builds ───────────────────────────────────────────────────────
// El filtrado por estado/plataforma/perfil/rango-de-fechas lo siguen haciendo
// los controles externos de la página (el calendario de rango no se puede
// expresar en DataTable); el script publica el dataset ya filtrado. DataTable
// añade ordenación, configuración de columnas y paginación.
export function buildExpoBuildsColumns(t?: ExpoTableMessages): DataTableColumnConfig[] {
  const h = t?.history;
  return [
    { id: "app", header: pick(h, "colApp", "App"), accessorKey: "app", sortable: true, hideable: false },
    { id: "status", header: pick(h, "status", "Estado"), accessorKey: "status", sortable: true, hideable: false },
    { id: "platform", header: pick(h, "platform", "Plataforma"), accessorKey: "platform", sortable: true, hideable: true },
    { id: "profile", header: pick(h, "profile", "Perfil"), accessorKey: "profile", sortable: true, hideable: true },
    {
      id: "fecha",
      header: pick(h, "date", "Fecha"),
      accessorKey: "fecha",
      sortable: true,
      sortAccessor: "fechaTs",
      hideable: true,
    },
  ];
}

// Acciones por fila (menú ⋯): el script las habilita según el estado del build
// (logs solo si arrancó, QR solo con artefacto, cancelar solo si cancelable).
export function buildExpoBuildsRowActions(t?: ExpoTableMessages): DataTableRowActionConfig[] {
  const h = t?.history;
  return [
    { id: "logs", label: pick(h, "logs", "Logs"), icon: "ti-file-text" },
    { id: "qr", label: pick(h, "qr", "QR"), icon: "ti-qrcode" },
    { id: "open", label: pick(h, "openLink", "Abrir enlace"), icon: "ti-external-link" },
    { id: "cancel", label: pick(h, "cancel", "Cancelar build"), icon: "ti-player-stop", variant: "danger" },
  ];
}

// Pills de estado (espejo de BUILD_STATUS_TONE del script).
export function buildExpoBuildStatusBadges(t?: ExpoTableMessages): DataTableValueBadgeConfig[] {
  const statusLabels = t?.history?.["statusLabels"] as Dict | undefined;
  return [
    { value: pick(statusLabels, "finished", "Finished"), className: PILL_EMERALD },
    { value: pick(statusLabels, "errored", "Failed"), className: PILL_DESTRUCTIVE },
    { value: pick(statusLabels, "canceled", "Canceled"), className: PILL_MUTED },
    { value: pick(statusLabels, "inProgress", "In progress"), className: PILL_AMBER },
    { value: pick(statusLabels, "inQueue", "Queued"), className: PILL_AMBER },
    { value: pick(statusLabels, "new", "New"), className: PILL_SKY },
  ];
}

// ── Cuentas de tienda (credenciales unificadas) ───────────────────────────────
export function buildExpoStoreColumns(t?: ExpoTableMessages): DataTableColumnConfig[] {
  const s = t?.storeAccounts;
  return [
    { id: "platform", header: pick(s, "colPlatform", "Plataforma"), accessorKey: "platform", sortable: true, hideable: false },
    { id: "source", header: pick(s, "colSource", "Fuente"), accessorKey: "source", sortable: true, hideable: true },
    { id: "detail", header: pick(s, "colDetail", "Detalle"), accessorKey: "detail", sortable: false, hideable: true },
    {
      id: "updated",
      header: pick(s, "colUpdated", "Actualizado"),
      accessorKey: "updated",
      sortable: true,
      sortAccessor: "updatedTs",
      hideable: true,
    },
  ];
}

export function buildExpoStoreValueBadges(t?: ExpoTableMessages): DataTableValueBadgeConfig[] {
  const s = t?.storeAccounts;
  return [
    { value: "EAS", className: PILL_EMERALD },
    { value: pick(s, "sourceProject", "Proyecto"), className: PILL_SKY },
    { value: pick(s, "sourcePanel", "Panel"), className: PILL_AMBER },
  ];
}

// ── Variables de entorno / secrets ────────────────────────────────────────────
// El filtrado (texto + ámbito/visibilidad/entorno) lo siguen haciendo los
// controles externos; el script publica el dataset ya filtrado.
export function buildExpoEnvColumns(t?: ExpoTableMessages): DataTableColumnConfig[] {
  const e = t?.env;
  return [
    { id: "name", header: pick(e, "name", "Nombre"), accessorKey: "name", sortable: true, hideable: false },
    { id: "value", header: pick(e, "value", "Valor"), accessorKey: "value", sortable: false, hideable: true },
    { id: "scope", header: pick(e, "scope", "Ámbito"), accessorKey: "scope", sortable: true, hideable: true },
    { id: "visibility", header: pick(e, "visibility", "Visibilidad"), accessorKey: "visibility", sortable: true, hideable: true },
    { id: "environments", header: pick(e, "colEnvironments", "Entornos"), accessorKey: "environments", sortable: false, hideable: true },
  ];
}

export function buildExpoEnvRowActions(t?: ExpoTableMessages): DataTableRowActionConfig[] {
  const e = t?.env;
  return [
    editAction(pick(e, "editTitle", "Editar variable")),
    deleteAction(pick(e, "deleteTitle", "Eliminar variable")),
  ];
}
