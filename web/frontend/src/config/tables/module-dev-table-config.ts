// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type {
  DataTableColumnConfig,
  DataTableFilterConfig,
  DataTableRowActionConfig,
  DataTableValueBadgeConfig,
} from "@/components/ui/DataTable";
import { pick, type TableMessages } from "./table-i18n";

// La tabla "Mis módulos" del marketplace. Las etiquetas viven bajo el
// namespace i18n `moduleDev` (`table.*`, `states.*`, `actions.*`); estos
// builders toman ese subárbol y caen al español si falta una clave, de modo
// que la tabla nunca renderiza vacía. Los `value` de filtros/badges quedan en
// el idioma del usuario porque deben coincidir EXACTAMENTE con el valor de la
// celda (que también se localiza en el script con el mismo subárbol).

export type ModuleDevTableMessages = TableMessages<"table" | "states" | "actions">;

// reviewStatus → label localizado (espejo del orden del script).
const STATE_KEYS = ["enviado", "revision", "correccion", "aprobado", "publico", "inactivo", "suspendido"] as const;

const STATE_BADGE_CLASS: Record<(typeof STATE_KEYS)[number], string> = {
  enviado: "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  revision: "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  correccion: "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  aprobado: "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  publico: "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  inactivo: "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium border-border bg-muted/40 text-muted-foreground",
  suspendido: "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium border-destructive/30 bg-destructive/10 text-destructive",
};

export function buildModuleDevTableColumns(t?: ModuleDevTableMessages): DataTableColumnConfig[] {
  const c = t?.table;
  return [
    { id: "modulo", header: pick(c, "colModule", "Módulo"), accessorKey: "modulo", sortable: true, hideable: false },
    { id: "codigo", header: pick(c, "colCode", "Código"), accessorKey: "codigo", sortable: true, hideable: true },
    { id: "estado", header: pick(c, "colStatus", "Estado"), accessorKey: "estado", sortable: true, hideable: false },
    { id: "version", header: pick(c, "colVersion", "Versión"), accessorKey: "version", sortable: true, hideable: true },
    {
      id: "actualizado",
      header: pick(c, "colUpdated", "Actualizado"),
      accessorKey: "actualizado",
      sortable: true,
      sortAccessor: "actualizadoTs",
      hideable: true,
    },
  ];
}

export function buildModuleDevTableFilters(t?: ModuleDevTableMessages): DataTableFilterConfig[] {
  const c = t?.table;
  const s = t?.states;
  return [
    { id: "searchModule", label: pick(c, "searchPlaceholder", "Buscar módulo…"), accessorKey: "modulo", type: "text" },
    {
      id: "filterEstado",
      label: pick(c, "colStatus", "Estado"),
      accessorKey: "estado",
      type: "select",
      options: STATE_KEYS.map((k) => ({ label: pick(s, k, k), value: pick(s, k, k) })),
    },
  ];
}

// Todas las acciones del ciclo van en el menú; el script las habilita por fila
// según `reviewStatus`/vínculo (mismo patrón que el módulo Usuarios, que muestra
// todas y las gatea en el handler de `lxp:data-table:row-action`).
export function buildModuleDevTableRowActions(t?: ModuleDevTableMessages): DataTableRowActionConfig[] {
  const a = t?.actions;
  return [
    { id: "detail", label: pick(a, "details", "Detalle"), icon: "ti-list-details" },
    { id: "chat", label: pick(a, "openChat", "Abrir en el asistente"), icon: "ti-robot" },
    { id: "resubmit", label: pick(a, "resubmit", "Reenviar"), icon: "ti-send" },
    { id: "checks", label: pick(a, "checks", "Validar"), icon: "ti-checklist" },
    { id: "test", label: pick(a, "test", "Probar tests"), icon: "ti-flask" },
    { id: "preview", label: pick(a, "preview", "Instalar preview"), icon: "ti-package-import" },
    { id: "republish", label: pick(a, "republish", "Reactivar"), icon: "ti-rocket" },
    { id: "unpublish", label: pick(a, "unpublish", "Despublicar"), icon: "ti-eye-off", variant: "danger" },
  ];
}

export function buildModuleDevTableValueBadges(t?: ModuleDevTableMessages): DataTableValueBadgeConfig[] {
  const s = t?.states;
  return STATE_KEYS.map((k) => ({ value: pick(s, k, k), className: STATE_BADGE_CLASS[k] }));
}
