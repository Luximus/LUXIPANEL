// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type {
  DataTableColumnConfig,
  DataTableFilterConfig,
  DataTableRowActionConfig,
  DataTableValueBadgeConfig,
} from "@/components/ui/DataTable";
import { deleteAction, editAction } from "./table-actions";
import { type Dict, pick } from "./table-i18n";

// Localized labels live under the `nginx` i18n namespace (`nginx.table.*`).
// These builders take that namespace and fall back to Spanish so the table
// never renders empty if a key is missing. Filter/badge `value`s stay in
// Spanish (or machine codes) on purpose: they must match the data cell values.
type NginxTableMessages = {
  sites?: {
    columns?: Dict;
    filters?: Dict;
    rowActions?: Dict;
    badges?: Dict;
  };
  upstreams?: {
    columns?: Dict;
    filters?: Dict;
  };
};

// ── Sitios (server blocks) ─────────────────────────────────────
export function buildNginxSitesColumns(t?: NginxTableMessages): DataTableColumnConfig[] {
  const c = t?.sites?.columns;
  return [
    { id: "name", header: pick(c, "name", "Sitio"), accessorKey: "name", sortable: true, hideable: false },
    { id: "domains", header: pick(c, "domains", "Dominios"), accessorKey: "domains", sortable: false, hideable: true },
    { id: "kind", header: pick(c, "kind", "Tipo"), accessorKey: "kind", sortable: true, hideable: true },
    { id: "target", header: pick(c, "target", "Root / Proxy"), accessorKey: "target", sortable: false, hideable: true },
    { id: "ssl", header: pick(c, "ssl", "SSL"), accessorKey: "ssl", sortable: true, hideable: true },
    { id: "renewal", header: pick(c, "renewal", "Renovación HTTPS"), accessorKey: "renewal", sortable: true, hideable: true },
    { id: "estado", header: pick(c, "estado", "Estado"), accessorKey: "estado", sortable: true, hideable: true },
  ];
}

export function buildNginxSitesFilters(t?: NginxTableMessages): DataTableFilterConfig[] {
  const f = t?.sites?.filters;
  return [
    { id: "searchNginxSite", label: pick(f, "searchSite", "Buscar sitio…"), accessorKey: "name", type: "text" },
    {
      id: "filterNginxSiteEstado",
      label: pick(f, "estado", "Estado"),
      accessorKey: "estado",
      type: "select",
      options: [
        { label: pick(f, "estadoActivo", "Activo"), value: "Activo" },
        { label: pick(f, "estadoInactivo", "Inactivo"), value: "Inactivo" },
      ],
    },
    {
      id: "filterNginxSiteKind",
      label: pick(f, "kind", "Tipo"),
      accessorKey: "kind",
      type: "select",
      options: ["static", "php", "proxy", "redirect", "unknown"].map((t) => ({ label: t, value: t })),
    },
  ];
}

export function buildNginxSitesRowActions(t?: NginxTableMessages): DataTableRowActionConfig[] {
  const a = t?.sites?.rowActions;
  return [
    editAction(a),
    { id: "toggle", label: pick(a, "toggle", "Activar / Desactivar"), icon: "ti-toggle-left" },
    { id: "ssl", label: pick(a, "ssl", "Habilitar HTTPS"), icon: "ti-lock" },
    { id: "renewal", label: pick(a, "renewal", "Ver renovación HTTPS"), icon: "ti-refresh" },
    deleteAction(a),
  ];
}

export function buildNginxSitesValueBadges(t?: NginxTableMessages): DataTableValueBadgeConfig[] {
  const b = t?.sites?.badges;
  return [
    { value: pick(b, "estadoActivo", "Activo"), className: "inline-flex items-center rounded-md border border-emerald-600/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400" },
    { value: pick(b, "estadoInactivo", "Inactivo"), className: "inline-flex items-center rounded-md border border-zinc-500/30 bg-zinc-500/10 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400" },
    { value: pick(b, "sslYes", "Sí"), className: "inline-flex items-center rounded-md border border-green-600/30 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400" },
    { value: pick(b, "sslNo", "No"), className: "inline-flex items-center rounded-md border border-amber-600/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400" },
    { value: pick(b, "renewalActive", "Activa"), className: "inline-flex items-center rounded-md border border-emerald-600/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400" },
    { value: pick(b, "renewalAttention", "Revisar"), className: "inline-flex items-center rounded-md border border-amber-600/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400" },
    { value: pick(b, "renewalExternal", "Externo"), className: "inline-flex items-center rounded-md border border-sky-600/30 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-600 dark:text-sky-400" },
    { value: pick(b, "renewalNoHttps", "Sin HTTPS"), className: "inline-flex items-center rounded-md border border-zinc-500/30 bg-zinc-500/10 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400" },
    { value: pick(b, "renewalUnknown", "Sin datos"), className: "inline-flex items-center rounded-md border border-zinc-500/30 bg-zinc-500/10 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400" },
    { value: "static", className: "inline-flex items-center rounded-md border border-blue-600/30 bg-blue-500/10 px-2 py-0.5 text-xs font-semibold font-mono text-blue-600 dark:text-blue-400" },
    { value: "php", className: "inline-flex items-center rounded-md border border-violet-600/30 bg-violet-500/10 px-2 py-0.5 text-xs font-semibold font-mono text-violet-600 dark:text-violet-400" },
    { value: "proxy", className: "inline-flex items-center rounded-md border border-cyan-600/30 bg-cyan-500/10 px-2 py-0.5 text-xs font-semibold font-mono text-cyan-600 dark:text-cyan-400" },
    { value: "redirect", className: "inline-flex items-center rounded-md border border-pink-600/30 bg-pink-500/10 px-2 py-0.5 text-xs font-semibold font-mono text-pink-600 dark:text-pink-400" },
    { value: "unknown", className: "inline-flex items-center rounded-md border border-zinc-500/30 bg-zinc-500/10 px-2 py-0.5 text-xs font-semibold font-mono text-zinc-500 dark:text-zinc-400" },
  ];
}

// ── Upstreams ──────────────────────────────────────────────────
export function buildNginxUpstreamsColumns(t?: NginxTableMessages): DataTableColumnConfig[] {
  const c = t?.upstreams?.columns;
  return [
    { id: "name", header: pick(c, "name", "Pool"), accessorKey: "name", sortable: true, hideable: false },
    { id: "servers", header: pick(c, "servers", "Servidores"), accessorKey: "servers", sortable: false, hideable: false },
    { id: "file", header: pick(c, "file", "Archivo"), accessorKey: "file", sortable: true, hideable: true },
  ];
}

export function buildNginxUpstreamsFilters(t?: NginxTableMessages): DataTableFilterConfig[] {
  const f = t?.upstreams?.filters;
  return [
    { id: "searchNginxUpstream", label: pick(f, "searchUpstream", "Buscar pool…"), accessorKey: "name", type: "text" },
  ];
}

// SSL/TLS no tiene tabla propia: HTTPS se habilita por sitio vía el bridge de
// NGINX (acción de fila "ssl" en la tabla de Sitios). El módulo `ssl`
// standalone se eliminó.
