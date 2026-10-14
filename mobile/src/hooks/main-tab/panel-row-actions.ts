import { Alert, Share } from "react-native";
import { createPanelAccessLink } from "../../api/client";
import { getLicenseState } from "../../features/app/utils";
import type { View } from "../../features/app/types";
import type { PanelRow } from "../../features/app/viewModels";
import type { Panel } from "../../types/models";
import type { Messages } from "../../i18n";
import { localizeCommonError } from "../../lib/error-localization";

/** Todo lo que la acción de fila necesita del controlador (se captura fresco en
 *  cada invocación; el wrapper del controlador lo arma inline). */
export type PanelRowActionCtx = {
  token: string | null;
  effectiveToken: string | null;
  guestMode: boolean;
  t: Messages;
  activeConnectionRef: { current: { panelId: string; panelName: string } | null };
  setSshUrl: (url: string) => void;
  setView: (view: View) => void;
  goToPaymentsView: () => void;
  openDirectConnect: (panel: Panel) => void;
  openEditPanelModal: (row: PanelRow) => void;
  openDeletePanelModal: (row: PanelRow) => void;
  toggleRevealedIp: (panelId: string) => void;
};

/**
 * Cuerpo PURO (fase de refactor: extraído de `useMainTabController`) de
 * `handlePanelRowAction`: acciones de una fila/tarjeta de panel (conectar,
 * compartir, editar, borrar, recargar, revelar IP), incluida la rama de
 * invitado. Misma lógica, mismo orden de casos.
 */
export async function runPanelRowAction(ctx: PanelRowActionCtx, actionId: string, row: PanelRow): Promise<void> {
  const { token, guestMode, t } = ctx;
  const panel = row.source;
  if (guestMode) {
    if (actionId === "connect") ctx.openDirectConnect(panel);
    return;
  }
  if (actionId === "share_private" || actionId === "share_public") {
    if (!token) return;
    const isPrivate = actionId === "share_private";
    const mode = isPrivate ? "private" : "public";
    const fallback = t.accessLinks.shareLinkError;
    try {
      const response = await createPanelAccessLink(panel.id, mode, token);
      const shareUrl = response.link?.url ?? "";
      if (!shareUrl) throw new Error(fallback);
      const panelName = panel.licenseName || row.nameLabel || t.panelTable.fallbacks.panelName;
      const message = isPrivate
        ? `${t.accessLinks.privateAccessPrefix}: ${panelName}\n${shareUrl}`
        : `${t.accessLinks.publicAccessPrefix}: ${panelName}\n${shareUrl}`;
      await Share.share({ message });
    } catch (error) {
      Alert.alert(t.common.error, localizeCommonError(error, t, fallback));
    }
    return;
  }
  if (actionId === "connect") {
    if (!token) return;
    // Modelo de datos (GB/MB): el acceso se cobra por login contra el saldo de
    // datos, no por llave de licencia. Solo se bloquea cuando el panel quedó
    // inactivo por saldo agotado/cancelación; ahí se guía a recargar datos.
    if (getLicenseState(panel) === "license_inactive") {
      ctx.goToPaymentsView();
      return;
    }
    // NATIVO: conecta DIRECTO al backend del box (usuario Linux + password +
    // 2FA), registra el DirectTarget bajo panel.id y abre las PANTALLAS
    // NATIVAS de módulos. Sin webview, sin gateway, sin redirectUrl SSO. Si
    // hay sesión/contraseña guardada para el panel, reconecta un-tap.
    ctx.openDirectConnect(panel);
    return;
  }

  if (actionId === "connect_local") {
    if (!token) return;
    // Mismo criterio de datos que "connect": sin saldo → recargar, no error de
    // "licencia". (Este botón solo aparece en paneles activos, pero guardamos
    // la coherencia por si la fila se invoca por otra vía.)
    if (getLicenseState(panel) === "license_inactive") {
      ctx.goToPaymentsView();
      return;
    }
    // El "connect_local" (llave SSH local) pertenecía al modelo webview/gateway;
    // el flujo nativo autentica por password/2FA contra el box. Unificado.
    ctx.openDirectConnect(panel);
    return;
  }

  if (actionId === "toggle_ip") {
    ctx.toggleRevealedIp(panel.id);
    return;
  }

  if (actionId === "edit") {
    ctx.openEditPanelModal(row);
    return;
  }

  if (actionId === "recharge_data") {
    ctx.goToPaymentsView();
    return;
  }

  if (actionId === "delete") {
    ctx.openDeletePanelModal(row);
  }
}
