import type {
  DataTableColumnConfig,
  DataTableFilterConfig,
  DataTableRowActionConfig,
  DataTableValueBadgeConfig,
} from "../../components/DataTable";
import type { Messages } from "../../i18n";
import type { PanelRow, TicketRow } from "./viewModels";

export function getPanelColumns(t: Messages): DataTableColumnConfig<PanelRow>[] {
  return [
    { id: "ip", header: t.panelTable.columns.ip, accessorKey: "serverIpMasked", sortable: true, hideable: true },
    { id: "domain", header: t.panelTable.columns.domain, accessorKey: "accessDomain", sortable: true, hideable: true },
    { id: "category", header: t.panelTable.columns.category, accessorKey: "categoryLabel", sortable: true, hideable: true },
    { id: "tags", header: t.panelTable.columns.tags, accessorKey: "tags", sortable: false, hideable: true },
    { id: "license", header: t.panelTable.columns.license, accessorKey: "licenseState", sortable: true, hideable: true },
    { id: "ssh", header: t.panelTable.columns.ssh, accessorKey: "sshState", sortable: true, hideable: true },
  ];
}

export function getPanelFilters(t: Messages): DataTableFilterConfig<PanelRow>[] {
  return [
    { id: "search", label: t.panelTable.filters.search, accessorKey: "searchBlob", type: "text" },
    { id: "provider", label: t.panelTable.filters.allProviders, accessorKey: "providerLabel", type: "select" },
    { id: "category", label: t.panelTable.filters.allCategories, accessorKey: "categoryLabel", type: "select" },
    { id: "tag", label: t.panelTable.filters.allTags, accessorKey: "tags", type: "select" },
  ];
}

export function getPanelRowActions(t: Messages): DataTableRowActionConfig<PanelRow>[] {
  return [
    { id: "connect", label: t.panelTable.actions.connect, visible: (row) => row.canConnect },
    { id: "edit", label: t.panelTable.actions.edit, visible: (row) => row.canEdit !== false },
    { id: "audit", label: t.audit.action, visible: (row) => row.canEdit !== false },
    { id: "manage_access", label: t.sharing.manageAccess, visible: (row) => row.canEdit !== false },
    { id: "recharge_data", label: t.dashboard.lowDataCta, visible: (row) => row.canRecharge },
    { id: "delete", label: t.panelTable.actions.delete, variant: "danger", visible: (row) => row.canDelete !== false },
  ];
}

export function getTicketColumns(t: Messages): DataTableColumnConfig<TicketRow>[] {
  return [
    { id: "title", header: t.ticketTable.columns.title, accessorKey: "title", sortable: true, hideable: true },
    { id: "status", header: t.ticketTable.columns.status, accessorKey: "status", sortable: true, hideable: true },
    { id: "priority", header: t.ticketTable.columns.priority, accessorKey: "priority", sortable: true, hideable: true },
    { id: "responseState", header: t.ticketTable.columns.response, accessorKey: "responseState", sortable: true, hideable: true },
    { id: "createdAt", header: t.ticketTable.columns.date, accessorKey: "createdAtLabel", sortable: true, hideable: true },
    { id: "updatedAt", header: t.ticketTable.columns.updated, accessorKey: "updatedAtLabel", sortable: true, hideable: true },
    { id: "closedAt", header: t.ticketTable.columns.closed, accessorKey: "closedAtLabel", sortable: true, hideable: true },
  ];
}

export function getTicketFilters(t: Messages): DataTableFilterConfig<TicketRow>[] {
  return [
    { id: "search", label: t.ticketTable.filters.search, accessorKey: "searchBlob", type: "text" },
    {
      id: "status",
      label: t.ticketTable.filters.allStatuses,
      accessorKey: "status",
      type: "select",
      options: [
        { label: t.ticketTable.statusBadges.open, value: "open" },
        { label: t.ticketTable.statusBadges.in_progress, value: "in_progress" },
        { label: t.ticketTable.statusBadges.resolved, value: "resolved" },
        { label: t.ticketTable.statusBadges.closed, value: "closed" },
      ],
    },
    {
      id: "priority",
      label: t.ticketTable.filters.allPriorities,
      accessorKey: "priority",
      type: "select",
      options: [
        { label: t.ticketTable.priorityBadges.critical, value: "critical" },
        { label: t.ticketTable.priorityBadges.high, value: "high" },
        { label: t.ticketTable.priorityBadges.medium, value: "medium" },
        { label: t.ticketTable.priorityBadges.low, value: "low" },
      ],
    },
    {
      id: "responseState",
      label: t.ticketTable.filters.allResponses,
      accessorKey: "responseState",
      type: "select",
      options: [
        { label: t.ticketTable.responseBadges.responded, value: "responded" },
        { label: t.ticketTable.responseBadges.awaiting_user, value: "awaiting_user" },
        { label: t.ticketTable.responseBadges.awaiting_admin, value: "awaiting_admin" },
        { label: t.ticketTable.responseBadges.no_response, value: "no_response" },
      ],
    },
  ];
}

export function getTicketBadgeConfig(t: Messages): DataTableValueBadgeConfig[] {
  return [
    { value: "open", className: "border-transparent bg-zinc-400/90 text-white dark:bg-rose-300/95 dark:text-white", label: t.ticketTable.statusBadges.open },
    { value: "in_progress", className: "border-transparent bg-emerald-500/90 text-white dark:bg-rose-400/95 dark:text-white", label: t.ticketTable.statusBadges.in_progress },
    { value: "resolved", className: "border-transparent bg-amber-400/95 text-amber-950 dark:bg-emerald-500/85 dark:text-white", label: t.ticketTable.statusBadges.resolved },
    { value: "closed", className: "border-transparent bg-red-500/90 text-white dark:bg-zinc-400/90 dark:text-white", label: t.ticketTable.statusBadges.closed },
    { value: "critical", className: "border-transparent bg-red-500/90 text-white dark:text-white", label: t.ticketTable.priorityBadges.critical },
    { value: "high", className: "border-transparent bg-rose-500/90 text-white dark:text-white", label: t.ticketTable.priorityBadges.high },
    { value: "medium", className: "border-transparent bg-rose-300/95 text-rose-900 dark:text-white", label: t.ticketTable.priorityBadges.medium },
    { value: "low", className: "border-transparent bg-red-200/95 text-red-900 dark:text-white", label: t.ticketTable.priorityBadges.low },
    { value: "responded", className: "border-transparent bg-emerald-500/85 text-white dark:text-white", label: t.ticketTable.responseBadges.responded },
    { value: "awaiting_user", className: "border-transparent bg-amber-400/95 text-amber-950 dark:bg-amber-500/85 dark:text-white", label: t.ticketTable.responseBadges.awaiting_user },
    { value: "awaiting_admin", className: "border-transparent bg-rose-500/90 text-white dark:text-white", label: t.ticketTable.responseBadges.awaiting_admin },
    { value: "no_response", className: "border-transparent bg-zinc-400/90 text-white dark:text-white", label: t.ticketTable.responseBadges.no_response },
  ];
}

export function getSupportRowActions(t: Messages): DataTableRowActionConfig<TicketRow>[] {
  return [{ id: "view_ticket", label: t.ticketTable.actions.view }];
}
