import {
  detectPanelProvider,
  getLicenseState,
  getPanelHost,
  getSshState,
  maskIp,
  resolvePanelLogoUrl,
} from "../../features/app/utils";
import type { PanelRow, ServerPingStatus, TicketRow } from "../../features/app/viewModels";
import type { Panel, Ticket } from "../../types/models";
import type { Messages } from "../../i18n";

/**
 * Base estable de filas de panel (fase de refactor: extraída del controlador
 * `useMainTabController`). Transform PURO: NO depende del ping (panelStatuses),
 * que se superpone barato aparte. Solo cambia con panels/IP-revelada/idioma.
 */
export function buildPanelRowsBase(
  panels: Panel[],
  revealedPanelIps: Record<string, boolean>,
  language: string,
  t: Messages,
): PanelRow[] {
  return panels.map((panel) => {
    const licenseState = getLicenseState(panel);
    const sshState = getSshState(panel);
    const accessDomain = getPanelHost(panel);
    const { provider, providerLabel } = detectPanelProvider(panel, language);
    return {
      id: panel.id,
      nameLabel: panel.licenseName || t.panelTable.fallbacks.panelName,
      serverIpMasked: revealedPanelIps[panel.id] ? panel.serverIp || "-" : maskIp(panel.serverIp),
      serverIpRaw: panel.serverIp,
      categoryLabel: panel.category || t.panelTable.fallbacks.noCategory,
      tags: panel.tags ?? [],
      licenseState,
      sshState,
      provider,
      providerLabel,
      serverStatus: "unknown" as ServerPingStatus,
      accessDomain,
      canRecharge: licenseState === "license_inactive",
      canConnect: licenseState === "license_active",
      // Solo el CREADOR del panel puede editar/eliminar. A quien se le compartió
      // (full-share o granular) el servidor es de solo lectura.
      canEdit: (panel.ownership ?? "owner") === "owner",
      canDelete: (panel.ownership ?? "owner") === "owner",
      // El logo puede venir como ruta relativa al host del panel; RN necesita
      // URL absoluta para `<Image>`, así que la resolvemos contra accessDomain.
      brandingLogoUrl: resolvePanelLogoUrl(panel.brandingLogoUrl, accessDomain),
      searchBlob: [panel.licenseName ?? "", panel.licenseKey ?? "", panel.serverIp ?? "", String(panel.serverPort ?? 22),
        panel.category ?? "", providerLabel, accessDomain, ...(panel.tags ?? [])].join(" ").toLowerCase(),
      source: panel,
    };
  });
}

/**
 * Filas de la lista de tickets (fase de refactor: extraída del controlador).
 * Transform PURO ordenado por fecha desc.
 */
export function buildTicketRows(tickets: Ticket[], t: Messages): TicketRow[] {
  return [...tickets]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((ticket) => {
      let responseState: TicketRow["responseState"];
      if (!ticket.lastResponderRole) responseState = "no_response";
      else if (ticket.lastResponderRole === "admin") responseState = "awaiting_user";
      else responseState = "responded";
      const responseLabels = t.ticketTable.responseBadges;
      const responseStateLabel = responseLabels[responseState];
      return {
        id: ticket.id,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        responseState,
        responseStateLabel,
        createdAtLabel: new Date(ticket.createdAt).toLocaleString(),
        updatedAtLabel: ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : "—",
        closedAtLabel: ticket.closedAt ? new Date(ticket.closedAt).toLocaleString() : "—",
        searchBlob: `${ticket.title} ${ticket.status} ${ticket.priority} ${responseStateLabel}`.toLowerCase(),
        source: ticket,
      };
    });
}
