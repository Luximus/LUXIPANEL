// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type {
  DataTableColumnConfig,
  DataTableFilterConfig,
  DataTableQuickActionConfig,
  DataTableRowActionConfig,
  DataTableValueBadgeConfig,
} from "@/components/ui/DataTable";
import { BADGE } from "./badges";
import { deleteAction, editAction } from "./table-actions";
import { type Dict, pick } from "./table-i18n";

// Localized labels live under the `mail` i18n namespace (`mail.table.*`).
// These builders take that subtree and fall back to Spanish so the table never
// renders empty if a key is missing. Filter/badge `value`s stay in Spanish on
// purpose: they must match the (Spanish) data cell values.
type MailTableMessages = {
  // Shared status labels: filter values and value badges reuse them so they
  // match the (Spanish) data cells across all locales.
  status?: Dict;
  redirect?: { columns?: Dict; filters?: Dict; rowActions?: Dict };
  encryption?: { columns?: Dict; filters?: Dict; rowActions?: Dict };
  accounts?: { columns?: Dict; filters?: Dict; rowActions?: Dict; quickActions?: Dict };
  globalFilters?: { columns?: Dict; filters?: Dict; rowActions?: Dict };
  contacts?: { columns?: Dict; filters?: Dict; rowActions?: Dict };
  calendars?: { columns?: Dict; filters?: Dict; rowActions?: Dict };
  signatures?: { columns?: Dict; filters?: Dict; rowActions?: Dict };
  filters?: { columns?: Dict; filters?: Dict; rowActions?: Dict };
};

function buildActiveInactiveBadges(t?: MailTableMessages): DataTableValueBadgeConfig[] {
  const s = t?.status;
  return [
    { value: pick(s, "active", "Activo"), className: BADGE.okPill },
    { value: pick(s, "inactive", "Inactivo"), className: BADGE.neutralPill },
    { value: pick(s, "disabled", "Desactivado"), className: BADGE.dangerPill },
  ];
}

// ── Reglas globales por dominio ────────────────────────────────
export function buildMailRedirectColumns(t?: MailTableMessages): DataTableColumnConfig[] {
  const c = t?.redirect?.columns;
  return [
    { id: "domain", header: pick(c, "domain", "Dominio"), accessorKey: "domain", sortable: true, hideable: false },
    { id: "destinos", header: pick(c, "destinos", "Destinos"), accessorKey: "destinos", sortable: false, hideable: true },
  ];
}
export function buildMailRedirectFilters(t?: MailTableMessages): DataTableFilterConfig[] {
  const f = t?.redirect?.filters;
  return [
    { id: "searchMailRedirect", label: pick(f, "searchDomain", "Buscar dominio…"), accessorKey: "domain", type: "text" },
  ];
}
export function buildMailRedirectRowActions(t?: MailTableMessages): DataTableRowActionConfig[] {
  const a = t?.redirect?.rowActions;
  return [
    editAction(a),
    deleteAction(a),
  ];
}

// ── Encryption keys (public / private) ─────────────────────────
export function buildMailEncryptionColumns(t?: MailTableMessages): DataTableColumnConfig[] {
  const c = t?.encryption?.columns;
  return [
    { id: "keyId", header: pick(c, "keyId", "Key ID"), accessorKey: "keyId", sortable: true, hideable: false },
    { id: "label", header: pick(c, "label", "Identidad"), accessorKey: "label", sortable: true, hideable: true },
    { id: "keySize", header: pick(c, "keySize", "Key Size"), accessorKey: "keySize", sortable: true, hideable: true },
    { id: "created", header: pick(c, "created", "Created"), accessorKey: "created", sortable: true, hideable: true },
    { id: "expires", header: pick(c, "expires", "Expires"), accessorKey: "expires", sortable: true, hideable: true },
  ];
}
export function buildMailEncryptionFilters(t?: MailTableMessages): DataTableFilterConfig[] {
  const f = t?.encryption?.filters;
  return [
    { id: "searchMailKey", label: pick(f, "searchKey", "Buscar key…"), accessorKey: "keyId", type: "text" },
  ];
}
export function buildMailEncryptionRowActions(t?: MailTableMessages): DataTableRowActionConfig[] {
  const a = t?.encryption?.rowActions;
  return [
    { id: "view", label: pick(a, "view", "Ver"), icon: "ti-eye" },
    deleteAction(a),
  ];
}

// ── Cuentas de correo ──────────────────────────────────────────
export function buildMailAccountsColumns(t?: MailTableMessages): DataTableColumnConfig[] {
  const c = t?.accounts?.columns;
  return [
    { id: "address", header: pick(c, "address", "Dirección"), accessorKey: "address", sortable: true, hideable: false },
    { id: "domain", header: pick(c, "domain", "Dominio"), accessorKey: "domain", sortable: true, hideable: true },
    { id: "uso", header: pick(c, "uso", "Quota / Uso"), accessorKey: "uso", sortable: true, sortAccessor: "usoPct", hideable: true },
    { id: "reenvios", header: pick(c, "reenvios", "Reenvíos"), accessorKey: "reenvios", sortable: false, hideable: true },
    { id: "estado", header: pick(c, "estado", "Estado"), accessorKey: "estado", sortable: true, hideable: false },
  ];
}
export function buildMailAccountsFilters(t?: MailTableMessages): DataTableFilterConfig[] {
  const f = t?.accounts?.filters;
  const s = t?.status;
  const active = pick(s, "active", "Activo");
  const disabled = pick(s, "disabled", "Desactivado");
  return [
    { id: "searchMailAccount", label: pick(f, "search", "Buscar dirección o dominio…"), accessorKey: "address", type: "text" },
    { id: "filterMailAccountDomain", label: pick(f, "domain", "Dominio"), accessorKey: "domain", type: "select", options: [] },
    {
      id: "filterMailAccountEstado",
      label: pick(f, "estado", "Estado"),
      accessorKey: "estado",
      type: "select",
      options: [
        { label: active, value: active },
        { label: disabled, value: disabled },
      ],
    },
  ];
}
export function buildMailAccountsRowActions(t?: MailTableMessages): DataTableRowActionConfig[] {
  const a = t?.accounts?.rowActions;
  return [
    editAction(pick(a, "edit", "Editar cuenta")),
    { id: "depurarIa", label: pick(a, "depurarIa", "Depurar con IA"), icon: "ti-sparkles" },
    { id: "password", label: pick(a, "password", "Cambiar contraseña"), icon: "ti-key" },
    { id: "toggle", label: pick(a, "toggle", "Activar / Desactivar"), icon: "ti-toggle-right" },
    { id: "inbox", label: pick(a, "inbox", "Entrar al correo"), icon: "ti-mail-opened" },
    { id: "signatures", label: pick(a, "signatures", "Gestionar firmas"), icon: "ti-signature" },
    { id: "default", label: pick(a, "default", "Usar como predeterminado"), icon: "ti-star" },
    { id: "contacts", label: pick(a, "contacts", "Gestionar contactos"), icon: "ti-address-book" },
    { id: "calendars", label: pick(a, "calendars", "Gestionar calendarios"), icon: "ti-calendar-event" },
    { id: "autoresponder", label: pick(a, "autoresponder", "Gestionar autoresponder"), icon: "ti-message-reply" },
    { id: "filters", label: pick(a, "filters", "Gestionar filtros"), icon: "ti-filter" },
    { id: "forwards", label: pick(a, "forwards", "Gestionar reenvíos"), icon: "ti-arrow-forward" },
    { id: "diskusage", label: pick(a, "diskusage", "Gestionar disk usage"), icon: "ti-database-search" },
    { id: "clone", label: pick(a, "clone", "Clonar correo"), icon: "ti-copy" },
    deleteAction(pick(a, "delete", "Eliminar cuenta")),
  ];
}
export function buildMailAccountsQuickActions(t?: MailTableMessages): DataTableQuickActionConfig[] {
  const q = t?.accounts?.quickActions;
  return [
    { id: "bulkForward", label: pick(q, "bulkForward", "Añadir reenvío"), icon: "ti-arrow-forward" },
    { id: "bulkQuota", label: pick(q, "bulkQuota", "Cambiar quota"), icon: "ti-database-edit" },
    { id: "bulkDelete", label: pick(q, "bulkDelete", "Eliminar cuentas"), icon: "ti-trash", variant: "danger" },
  ];
}
export function buildMailAccountsValueBadges(t?: MailTableMessages): DataTableValueBadgeConfig[] {
  return buildActiveInactiveBadges(t);
}

// ── Filtros globales ───────────────────────────────────────────
export function buildMailGlobalFiltersColumns(t?: MailTableMessages): DataTableColumnConfig[] {
  const c = t?.globalFilters?.columns;
  return [
    { id: "name", header: pick(c, "name", "Filtro"), accessorKey: "name", sortable: true, hideable: false },
    { id: "estado", header: pick(c, "estado", "Estado"), accessorKey: "estado", sortable: true, hideable: true },
    { id: "rules", header: pick(c, "rules", "Reglas"), accessorKey: "rules", sortable: true, hideable: true },
    { id: "actionsCount", header: pick(c, "actionsCount", "Acciones"), accessorKey: "actionsCount", sortable: true, hideable: true },
  ];
}
export function buildMailGlobalFiltersFilters(t?: MailTableMessages): DataTableFilterConfig[] {
  const f = t?.globalFilters?.filters;
  return [
    { id: "searchMailGlobalFilter", label: pick(f, "search", "Buscar filtro…"), accessorKey: "name", type: "text" },
  ];
}
export function buildMailGlobalFiltersRowActions(t?: MailTableMessages): DataTableRowActionConfig[] {
  const a = t?.globalFilters?.rowActions;
  return [
    editAction(a),
    deleteAction(a),
  ];
}
export function buildMailGlobalFiltersValueBadges(t?: MailTableMessages): DataTableValueBadgeConfig[] {
  return buildActiveInactiveBadges(t);
}

// ── Contactos ──────────────────────────────────────────────────
export function buildMailContactsColumns(t?: MailTableMessages): DataTableColumnConfig[] {
  const c = t?.contacts?.columns;
  return [
    { id: "email", header: pick(c, "email", "Email"), accessorKey: "email", sortable: true, hideable: false },
    { id: "name", header: pick(c, "name", "Nombre"), accessorKey: "name", sortable: true, hideable: true },
  ];
}
export function buildMailContactsFilters(t?: MailTableMessages): DataTableFilterConfig[] {
  const f = t?.contacts?.filters;
  return [
    { id: "searchMailContact", label: pick(f, "searchEmail", "Buscar email…"), accessorKey: "email", type: "text" },
  ];
}
export function buildMailContactsRowActions(t?: MailTableMessages): DataTableRowActionConfig[] {
  const a = t?.contacts?.rowActions;
  return [
    editAction(a),
    deleteAction(a),
  ];
}

// ── Calendarios ────────────────────────────────────────────────
export function buildMailCalendarsColumns(t?: MailTableMessages): DataTableColumnConfig[] {
  const c = t?.calendars?.columns;
  return [
    { id: "name", header: pick(c, "name", "Nombre"), accessorKey: "name", sortable: true, hideable: false },
    { id: "timezone", header: pick(c, "timezone", "Timezone"), accessorKey: "timezone", sortable: true, hideable: true },
    { id: "estado", header: pick(c, "estado", "Estado"), accessorKey: "estado", sortable: true, hideable: true },
  ];
}
export function buildMailCalendarsFilters(t?: MailTableMessages): DataTableFilterConfig[] {
  const f = t?.calendars?.filters;
  return [
    { id: "searchMailCalendar", label: pick(f, "search", "Buscar calendario…"), accessorKey: "name", type: "text" },
  ];
}
export function buildMailCalendarsRowActions(t?: MailTableMessages): DataTableRowActionConfig[] {
  const a = t?.calendars?.rowActions;
  return [
    editAction(a),
    deleteAction(a),
  ];
}
export function buildMailCalendarsValueBadges(t?: MailTableMessages): DataTableValueBadgeConfig[] {
  return buildActiveInactiveBadges(t);
}

// ── Firmas por cuenta ──────────────────────────────────────────
export function buildMailSignaturesColumns(t?: MailTableMessages): DataTableColumnConfig[] {
  const c = t?.signatures?.columns;
  return [
    { id: "sender", header: pick(c, "sender", "Remitente"), accessorKey: "sender", sortable: true, hideable: false },
    { id: "preview", header: pick(c, "preview", "Firma"), accessorKey: "preview", sortable: false, hideable: true },
  ];
}
export function buildMailSignaturesFilters(t?: MailTableMessages): DataTableFilterConfig[] {
  const f = t?.signatures?.filters;
  return [
    { id: "searchMailSignature", label: pick(f, "search", "Filtrar y buscar…"), accessorKey: "sender", type: "text" },
  ];
}
export function buildMailSignaturesRowActions(t?: MailTableMessages): DataTableRowActionConfig[] {
  const a = t?.signatures?.rowActions;
  return [
    editAction(a),
    deleteAction(a),
  ];
}

// ── Filtros por cuenta ─────────────────────────────────────────
export function buildMailFiltersColumns(t?: MailTableMessages): DataTableColumnConfig[] {
  const c = t?.filters?.columns;
  return [
    { id: "name", header: pick(c, "name", "Nombre"), accessorKey: "name", sortable: true, hideable: false },
    { id: "estado", header: pick(c, "estado", "Estado"), accessorKey: "estado", sortable: true, hideable: true },
  ];
}
export function buildMailFiltersFilters(t?: MailTableMessages): DataTableFilterConfig[] {
  const f = t?.filters?.filters;
  return [
    { id: "searchMailFilter", label: pick(f, "search", "Buscar filtro…"), accessorKey: "name", type: "text" },
  ];
}
export function buildMailFiltersRowActions(t?: MailTableMessages): DataTableRowActionConfig[] {
  const a = t?.filters?.rowActions;
  return [
    editAction(a),
    deleteAction(a),
  ];
}
export function buildMailFiltersValueBadges(t?: MailTableMessages): DataTableValueBadgeConfig[] {
  return buildActiveInactiveBadges(t);
}
