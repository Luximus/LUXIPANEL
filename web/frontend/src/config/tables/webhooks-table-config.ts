// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type {
  DataTableColumnConfig,
  DataTableFilterConfig,
  DataTableRowActionConfig,
  DataTableValueBadgeConfig,
} from "@/components/ui/DataTable";
import { BADGE } from "./badges";
import { deleteAction, editAction } from "./table-actions";
import { type Dict, pick } from "./table-i18n";

// Localized labels live under the `webhooks` i18n namespace (`webhooks.table.*`).
// These builders take that `table` subtree and fall back to Spanish so the
// tables never render empty if a key is missing. Filter/badge `value`s stay in
// Spanish on purpose: they must match the (Spanish) data cell values.
type WebhooksTableMessages = {
  gateway?: {
    columns?: Dict;
    filters?: Dict;
    rowActions?: Dict;
    options?: Dict;
  };
  webhooks?: {
    columns?: Dict;
    filters?: Dict;
    rowActions?: Dict;
    options?: Dict;
  };
  apiKeys?: {
    columns?: Dict;
    filters?: Dict;
    rowActions?: Dict;
  };
  discovered?: {
    columns?: Dict;
    filters?: Dict;
    rowActions?: Dict;
    options?: Dict;
  };
};

// ── Gateway (receive-data, inbound) webhooks ──────────────────
export function buildGatewayTableColumns(t?: WebhooksTableMessages): DataTableColumnConfig[] {
  const c = t?.gateway?.columns;
  return [
    { id: "name", header: pick(c, "name", "Nombre"), accessorKey: "name", sortable: true, hideable: false },
    { id: "auth", header: pick(c, "auth", "Auth"), accessorKey: "auth", sortable: false, hideable: true },
    { id: "recibidos", header: pick(c, "recibidos", "Recibidos"), accessorKey: "recibidos", sortable: true, hideable: true },
    { id: "ultima", header: pick(c, "ultima", "Última"), accessorKey: "ultima", sortable: true, hideable: true },
    { id: "estado", header: pick(c, "estado", "Estado"), accessorKey: "estado", sortable: true, hideable: false },
  ];
}

export function buildGatewayTableFilters(t?: WebhooksTableMessages): DataTableFilterConfig[] {
  const f = t?.gateway?.filters;
  const o = t?.gateway?.options;
  return [
    { id: "searchGatewayName", label: pick(f, "searchName", "Buscar nombre…"), accessorKey: "name", type: "text" },
    {
      id: "filterGatewayEstado",
      label: pick(f, "estado", "Estado"),
      accessorKey: "estado",
      type: "select",
      options: [
        { label: pick(o, "statusActive", "Activo"), value: "Activo" },
        { label: pick(o, "statusPaused", "Pausado"), value: "Pausado" },
      ],
    },
  ];
}

export function buildGatewayTableRowActions(t?: WebhooksTableMessages): DataTableRowActionConfig[] {
  const a = t?.gateway?.rowActions;
  return [
    { id: "copy", label: pick(a, "copy", "Copiar URL"), icon: "ti-link" },
    { id: "payloads", label: pick(a, "payloads", "Ver payloads"), icon: "ti-database" },
    editAction(a),
    deleteAction(a),
  ];
}

export const GATEWAY_TABLE_VALUE_BADGES: DataTableValueBadgeConfig[] = [
  { value: "Activo", className: BADGE.okPill },
  { value: "Pausado", className: BADGE.neutralPill },
];

// ── Webhooks ───────────────────────────────────────────────────
export function buildWebhooksTableColumns(t?: WebhooksTableMessages): DataTableColumnConfig[] {
  const c = t?.webhooks?.columns;
  return [
    { id: "url", header: pick(c, "url", "URL"), accessorKey: "url", sortable: true, hideable: false },
    { id: "eventos", header: pick(c, "eventos", "Eventos"), accessorKey: "eventos", sortable: false, hideable: true },
    { id: "estado", header: pick(c, "estado", "Estado"), accessorKey: "estado", sortable: true, hideable: false },
  ];
}

export function buildWebhooksTableFilters(t?: WebhooksTableMessages): DataTableFilterConfig[] {
  const f = t?.webhooks?.filters;
  const o = t?.webhooks?.options;
  return [
    { id: "searchWebhookUrl", label: pick(f, "searchUrl", "Buscar URL…"), accessorKey: "url", type: "text" },
    {
      id: "filterWebhookEstado",
      label: pick(f, "estado", "Estado"),
      accessorKey: "estado",
      type: "select",
      options: [
        { label: pick(o, "statusActive", "Activo"), value: "Activo" },
        { label: pick(o, "statusPaused", "Pausado"), value: "Pausado" },
        { label: pick(o, "statusFailing", "Fallando"), value: "Fallando" },
      ],
    },
  ];
}

export function buildWebhooksTableRowActions(t?: WebhooksTableMessages): DataTableRowActionConfig[] {
  const a = t?.webhooks?.rowActions;
  return [
    { id: "edit", label: pick(a, "edit", "Editar"), icon: "ti-pencil" },
    { id: "test", label: pick(a, "test", "Enviar prueba"), icon: "ti-send" },
    { id: "history", label: pick(a, "history", "Historial"), icon: "ti-history" },
    { id: "regenerate", label: pick(a, "regenerate", "Rotar secret"), icon: "ti-refresh" },
    deleteAction(a),
  ];
}

export const WEBHOOKS_TABLE_VALUE_BADGES: DataTableValueBadgeConfig[] = [
  {
    value: "Activo",
    className: BADGE.okPill,
  },
  {
    value: "Pausado",
    className: BADGE.neutralPill,
  },
  {
    value: "Fallando",
    className: BADGE.dangerPill,
  },
];

// ── API Keys ───────────────────────────────────────────────────
export function buildApiKeysTableColumns(t?: WebhooksTableMessages): DataTableColumnConfig[] {
  const c = t?.apiKeys?.columns;
  return [
    { id: "name", header: pick(c, "name", "Nombre"), accessorKey: "name", sortable: true, hideable: false },
    { id: "prefix", header: pick(c, "prefix", "Prefijo"), accessorKey: "prefix", sortable: true, hideable: true },
    { id: "creada", header: pick(c, "creada", "Creada"), accessorKey: "creada", sortable: true, hideable: true },
    { id: "expira", header: pick(c, "expira", "Expira"), accessorKey: "expira", sortable: true, hideable: true },
  ];
}

export function buildApiKeysTableFilters(t?: WebhooksTableMessages): DataTableFilterConfig[] {
  const f = t?.apiKeys?.filters;
  return [
    { id: "searchApiKeyName", label: pick(f, "searchName", "Buscar nombre…"), accessorKey: "name", type: "text" },
  ];
}

export function buildApiKeysTableRowActions(t?: WebhooksTableMessages): DataTableRowActionConfig[] {
  const a = t?.apiKeys?.rowActions;
  return [
    { id: "revoke", label: pick(a, "revoke", "Revocar"), icon: "ti-trash", variant: "danger" },
  ];
}

// ── Detectados (discovered webhooks) ──────────────────────────
export function buildDiscoveredTableColumns(t?: WebhooksTableMessages): DataTableColumnConfig[] {
  const c = t?.discovered?.columns;
  return [
    { id: "origen", header: pick(c, "origen", "Origen"), accessorKey: "origen", sortable: true },
    { id: "name", header: pick(c, "name", "Nombre"), accessorKey: "name", sortable: true },
    { id: "target", header: pick(c, "target", "Destino"), accessorKey: "target", sortable: true, hideable: false },
    { id: "location", header: pick(c, "location", "Ubicación"), accessorKey: "location", sortable: true, hideable: true },
    { id: "estado", header: pick(c, "estado", "Estado"), accessorKey: "estado", sortable: true },
  ];
}

export function buildDiscoveredTableFilters(t?: WebhooksTableMessages): DataTableFilterConfig[] {
  const f = t?.discovered?.filters;
  const o = t?.discovered?.options;
  return [
    { id: "searchDiscoveredTarget", label: pick(f, "searchTarget", "Buscar destino…"), accessorKey: "target", type: "text" },
    {
      id: "filterDiscoveredSource",
      label: pick(f, "origen", "Origen"),
      accessorKey: "origen",
      type: "select",
      options: [
        { label: pick(o, "panel", "Panel"), value: "Panel" },
        { label: pick(o, "gitHook", "Git hook"), value: "Git hook" },
        { label: pick(o, "nginx", "Nginx"), value: "Nginx" },
        { label: pick(o, "cron", "Cron"), value: "Cron" },
        { label: pick(o, "systemd", "systemd"), value: "systemd" },
        { label: pick(o, "config", "Config"), value: "Config" },
        { label: pick(o, "proyecto", "Proyecto"), value: "Proyecto" },
      ],
    },
  ];
}

export function buildDiscoveredTableRowActions(t?: WebhooksTableMessages): DataTableRowActionConfig[] {
  const a = t?.discovered?.rowActions;
  return [
    { id: "detail", label: pick(a, "detail", "Ver detalle"), icon: "ti-eye" },
    deleteAction(a),
  ];
}

export const DISCOVERED_TABLE_VALUE_BADGES: DataTableValueBadgeConfig[] = [
  { value: "Activo", className: BADGE.okPill },
  { value: "Inactivo", className: BADGE.neutralPill },
  { value: "—", className: BADGE.neutralPill },
  { value: "Panel", className: BADGE.neutralPill },
  { value: "Git hook", className: BADGE.neutralPill },
  { value: "Nginx", className: BADGE.neutralPill },
  { value: "Cron", className: BADGE.neutralPill },
  { value: "systemd", className: BADGE.neutralPill },
  { value: "Config", className: BADGE.neutralPill },
  { value: "Proyecto", className: BADGE.neutralPill },
];
