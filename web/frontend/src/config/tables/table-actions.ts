// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Helpers compartidos para descriptores de acción de DataTable que se repetían
 * verbatim en varios table-configs. Centralizan la forma EXACTA (mismos
 * `id`/`icon`/`variant`) para que un cambio se haga en un solo sitio; la
 * etiqueta (localizada) se pasa por llamada.
 */
import type {
  DataTableQuickActionConfig,
  DataTableRowActionConfig,
} from "@/components/ui/DataTable";
import { type Dict, pick } from "./table-i18n";

/**
 * E-07: cada llamada repetía el par clave + fallback castellano
 * (`editAction(pick(a, "edit", "Editar"))` ~20 veces). Ahora se puede pasar
 * directamente el subárbol i18n y el helper resuelve clave y fallback:
 *
 *   editAction(a)                          → pick(a, "edit", "Editar")
 *   deleteAction(a)                        → pick(a, "delete", "Eliminar")
 *   editAction(pick(a, "edit", "Editar cuenta"))  ← sigue valiendo (etiqueta
 *                                                   explícita para los casos
 *                                                   con texto propio)
 */
function resolveLabel(source: string | Dict | undefined, key: string, fallback: string): string {
  return typeof source === "string" ? source : pick(source, key, fallback);
}

/** Acción de fila estándar "Editar" (ícono lápiz). */
export function editAction(
  labelOrMessages: string | Dict | undefined,
  icon = "ti-edit",
): DataTableRowActionConfig {
  return { id: "edit", label: resolveLabel(labelOrMessages, "edit", "Editar"), icon };
}

/** Acción de fila estándar "Eliminar" (peligro, ícono papelera). */
export function deleteAction(labelOrMessages: string | Dict | undefined): DataTableRowActionConfig {
  return {
    id: "delete",
    label: resolveLabel(labelOrMessages, "delete", "Eliminar"),
    icon: "ti-trash",
    variant: "danger",
  };
}

/** Acción rápida/masiva estándar "Eliminar seleccionados" (peligro, papelera). */
export function deleteSelectedAction(
  labelOrMessages: string | Dict | undefined,
): DataTableQuickActionConfig {
  return {
    id: "delete",
    label: resolveLabel(labelOrMessages, "deleteSelected", "Eliminar seleccionados"),
    icon: "ti-trash",
    variant: "danger",
  };
}
