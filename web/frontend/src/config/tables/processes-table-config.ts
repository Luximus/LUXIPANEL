// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type {
  DataTableColumnConfig,
  DataTableFilterConfig,
  DataTableRowActionConfig,
} from "@/components/ui/DataTable";

export const PROCESSES_TABLE_ID = "monitor-processes-table";

// i18n strings injected from the page (`t.monitor.processes.table`). Kept as a
// loose record so the .astro can pass the translated subtree directly.
export type ProcessTableStrings = {
  colHelp: string;
  actionExplain: string;
  colPid: string;
  colName: string;
  colUser: string;
  colCpu: string;
  colRam: string;
  colMem: string;
  filterSearch: string;
  filterUser: string;
  actionKill: string;
};

export function processTableColumns(t: ProcessTableStrings): DataTableColumnConfig[] {
  return [
    { id: "explain", header: t.colHelp, accessorKey: "pid", sortable: false, hideable: false,
      actionId: "explain", actionLabel: t.actionExplain, actionIcon: "ti-help-circle", actionLabelAccessor: "name" },
    { id: "pid", header: t.colPid, accessorKey: "pid", sortable: true },
    { id: "name", header: t.colName, accessorKey: "name", sortable: true },
    { id: "user", header: t.colUser, accessorKey: "user", sortable: true },
    { id: "cpuLabel", header: t.colCpu, accessorKey: "cpuLabel", sortable: true },
    { id: "memRssLabel", header: t.colRam, accessorKey: "memRssLabel", sortable: true },
    { id: "memLabel", header: t.colMem, accessorKey: "memLabel", sortable: true },
  ];
}

export function processTableFilters(t: ProcessTableStrings): DataTableFilterConfig[] {
  return [
    { id: "search", label: t.filterSearch, accessorKey: "name", type: "text" },
    { id: "filterUser", label: t.filterUser, accessorKey: "user", type: "text" },
  ];
}

export function processTableRowActions(t: ProcessTableStrings): DataTableRowActionConfig[] {
  return [
    { id: "kill", label: t.actionKill, icon: "ti-trash", variant: "danger" },
  ];
}
