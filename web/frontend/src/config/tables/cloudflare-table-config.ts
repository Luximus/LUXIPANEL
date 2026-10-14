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
import { pick, type TableMessages } from "./table-i18n";

// Las etiquetas viven bajo el namespace i18n `cloudflare` (`dns.*`, `access.*`,
// `common.*`). Estos builders toman ese subárbol y caen al español si falta una
// clave, de modo que las tablas nunca renderizan vacías. Los `value` de
// filtros/badges quedan en el idioma del usuario porque deben coincidir
// EXACTAMENTE con el valor de la celda (que también se localiza en el script con
// el mismo subárbol).

export type CloudflareTableMessages = TableMessages<"dns" | "access" | "common">;

// ── DNS records ───────────────────────────────────────────────
// Proxy ON = ámbar (`BADGE.warnPill`, literal completo escaneable por
// Tailwind v4), Proxy OFF = neutro.
export const CF_DNS_PROXY_ON_BADGE = BADGE.warnPill;

export function buildCfDnsColumns(t?: CloudflareTableMessages): DataTableColumnConfig[] {
  const d = t?.dns;
  return [
    { id: "type", header: pick(d, "type", "Tipo"), accessorKey: "type", sortable: true, hideable: false },
    { id: "name", header: pick(d, "name", "Nombre"), accessorKey: "name", sortable: true, hideable: false },
    { id: "content", header: pick(d, "content", "Contenido"), accessorKey: "content", sortable: true, hideable: true },
    { id: "proxy", header: pick(d, "proxied", "Proxy"), accessorKey: "proxy", sortable: true, hideable: true },
    { id: "ttl", header: pick(d, "ttl", "TTL"), accessorKey: "ttl", sortable: true, sortAccessor: "ttlNum", hideable: true },
    { id: "server", header: pick(d, "pointsToServer", "Apunta a este servidor"), accessorKey: "server", sortable: true, hideable: true },
  ];
}

export function buildCfDnsFilters(t?: CloudflareTableMessages): DataTableFilterConfig[] {
  const d = t?.dns;
  return [
    { id: "searchCfDnsName", label: pick(d, "name", "Nombre"), accessorKey: "name", type: "text" },
    {
      id: "filterCfDnsType",
      label: pick(d, "type", "Tipo"),
      accessorKey: "type",
      type: "select",
      options: ["A", "AAAA", "CNAME", "TXT", "MX", "NS"].map((v) => ({ label: v, value: v })),
    },
  ];
}

export function buildCfDnsRowActions(t?: CloudflareTableMessages): DataTableRowActionConfig[] {
  const d = t?.dns;
  return [
    editAction(d),
    deleteAction(d),
  ];
}

// El texto de la celda de Proxy/Apunta-al-servidor se construye en el script con
// estas mismas claves; los `value` aquí deben coincidir byte-a-byte.
export function buildCfDnsValueBadges(t?: CloudflareTableMessages): DataTableValueBadgeConfig[] {
  const d = t?.dns;
  return [
    { value: pick(d, "proxyOn", "Proxy"), className: CF_DNS_PROXY_ON_BADGE },
    { value: pick(d, "proxyOff", "Directo"), className: BADGE.neutralPill },
    { value: pick(d, "pointsToServer", "Apunta a este servidor"), className: BADGE.okPill },
  ];
}

// ── Access rules (IP) ─────────────────────────────────────────
export function buildCfAccessColumns(t?: CloudflareTableMessages): DataTableColumnConfig[] {
  const a = t?.access;
  return [
    { id: "mode", header: pick(a, "mode", "Acción"), accessorKey: "mode", sortable: true, hideable: false },
    { id: "ip", header: pick(a, "ipHeader", "IP"), accessorKey: "ip", sortable: true, hideable: false },
    { id: "notes", header: pick(a, "notes", "Notas"), accessorKey: "notes", sortable: true, hideable: true },
  ];
}

export function buildCfAccessFilters(t?: CloudflareTableMessages): DataTableFilterConfig[] {
  const a = t?.access;
  return [
    { id: "searchCfAccessIp", label: pick(a, "ipHeader", "IP"), accessorKey: "ip", type: "text" },
    {
      id: "filterCfAccessMode",
      label: pick(a, "mode", "Acción"),
      accessorKey: "mode",
      type: "select",
      options: [
        { label: pick(a, "block", "Bloquear"), value: pick(a, "block", "Bloquear") },
        { label: pick(a, "allow", "Permitir"), value: pick(a, "allow", "Permitir") },
        { label: pick(a, "challenge", "Challenge"), value: pick(a, "challenge", "Challenge") },
      ],
    },
  ];
}

export function buildCfAccessRowActions(t?: CloudflareTableMessages): DataTableRowActionConfig[] {
  const c = t?.common;
  return [
    deleteAction(c),
  ];
}

// whitelist=verde, block=rojo, challenge=ámbar (`BADGE.warnPill`, literal
// completo escaneable por Tailwind v4).
export const CF_ACCESS_CHALLENGE_BADGE = BADGE.warnPill;

export function buildCfAccessValueBadges(t?: CloudflareTableMessages): DataTableValueBadgeConfig[] {
  const a = t?.access;
  return [
    { value: pick(a, "allow", "Permitir"), className: BADGE.okPill },
    { value: pick(a, "block", "Bloquear"), className: BADGE.dangerPill },
    { value: pick(a, "challenge", "Challenge"), className: CF_ACCESS_CHALLENGE_BADGE },
  ];
}
