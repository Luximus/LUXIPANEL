import { detectPanelProvider, getLicenseState, getPanelHost, getPanelSubdomainLabel, getSshState, maskIp, panelHostLabel } from "../../features/app/utils";
import type { Messages } from "../../i18n/messages";
import type { PanelRow, ServerPingStatus } from "../../features/app/viewModels";
import type { Panel } from "../../types/models";

/**
 * Proyección Panel → PanelRow del carousel/tabla de Servidores, extraída de
 * `useMainTabController` SIN cambios (builder puro; el `useMemo` sigue en el
 * controlador con las mismas dependencias).
 */
export function buildPanelRows({ panels, revealedPanelIps, panelStatuses, language, t }: {
  panels: Panel[];
  revealedPanelIps: Record<string, boolean>;
  panelStatuses: Record<string, ServerPingStatus>;
  language: string;
  t: Messages;
}): PanelRow[] {
  return panels.map((panel) => {
    const licenseState = getLicenseState(panel);
    const sshState = getSshState(panel);
    // Columna/etiqueta "dominio": host de la URL de acceso (customDomain),
    // nunca la URL completa cruda. El valor crudo vive en `source.customDomain`.
    const accessDomain = panelHostLabel(getPanelHost(panel));
    const { provider, providerLabel } = detectPanelProvider(panel, language);
    const serverStatus = panelStatuses[panel.id] ?? "unknown";
    return {
      id: panel.id,
      nameLabel: panel.licenseName || t.panelTable.fallbacks.panelName,
      serverIpMasked: revealedPanelIps[panel.id] ? panel.serverIp || "-" : maskIp(panel.serverIp),
      categoryLabel: panel.category || t.panelTable.fallbacks.noCategory,
      tags: panel.tags ?? [],
      licenseState,
      sshState,
      provider,
      providerLabel,
      serverStatus,
      accessDomain,
      accessSubdomain: getPanelSubdomainLabel(accessDomain),
      canRecharge: licenseState === "license_inactive",
      canConnect: licenseState === "license_active",
      // Solo el CREADOR del panel puede editar/eliminar/auditar/gestionar acceso.
      // A quien se le compartió (full-share o granular) es de solo lectura.
      canEdit: (panel.ownership ?? "owner") === "owner",
      canDelete: (panel.ownership ?? "owner") === "owner",
      brandingLogoUrl: panel.brandingLogoUrl ?? null,
      searchBlob: [panel.licenseName ?? "", panel.licenseKey ?? "", panel.serverIp ?? "", String(panel.serverPort ?? 22), panel.category ?? "", providerLabel, accessDomain, ...(panel.tags ?? [])].join(" ").toLowerCase(),
      source: panel,
    };
  });
}
