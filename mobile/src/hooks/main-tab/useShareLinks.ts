import { useCallback, useEffect, useState, type MutableRefObject } from "react";
import { Alert } from "react-native";
import { claimPanelAccessLink } from "../../api/client";
import { pushGuestAccessLink, type GuestEntry } from "../../storage/guestHistory";
import type { View } from "../../features/app/types";
import type { Messages } from "../../i18n";
import { localizeCommonError } from "../../lib/error-localization";

/**
 * Sub-hook COHESIVO extraído de `useMainTabController` (fase de refactor <1000
 * líneas): enlaces de acceso compartibles entrantes (deep-links
 * `panel-share`/`panel-access`) — parseo, alta como acceso de invitado
 * (guest/public) y reclamo del enlace privado (con re-intento tras login).
 * Código movido verbatim; el estado compartido entra por parámetros. Contiene
 * un único efecto (reclamo pendiente al llegar el token), autocontenido.
 */
export function useShareLinks({
  token,
  t,
  setView,
  setActivePanelId,
  setAutoConnectEnabled,
  setSshUrl,
  setGuestMode,
  setGuestHistory,
  activeConnectionRef,
  refreshPanelsData,
}: {
  token: string | null;
  t: Messages;
  setView: (view: View) => void;
  setActivePanelId: (id: string | null) => void;
  setAutoConnectEnabled: (enabled: boolean) => void;
  setSshUrl: (url: string) => void;
  setGuestMode: (guest: boolean) => void;
  setGuestHistory: (entries: GuestEntry[]) => void;
  activeConnectionRef: MutableRefObject<{ panelId: string; panelName: string } | null>;
  refreshPanelsData: () => Promise<void>;
}) {
  const [pendingPrivateAccessToken, setPendingPrivateAccessToken] = useState<string | null>(null);

  const parseIncomingAccessLink = useCallback((rawUrl: string): { token: string; mode: "private" | "public" | "guest" | null } | null => {
    const urlText = String(rawUrl ?? "").trim();
    if (!urlText) return null;
    let parsed: URL;
    try {
      parsed = new URL(urlText);
    } catch {
      return null;
    }
    const location = `${parsed.hostname ?? ""}${parsed.pathname ?? ""}`.toLowerCase();
    if (!location.includes("panel-share") && !location.includes("panel-access")) return null;
    const accessToken = parsed.searchParams.get("token")?.trim() ?? "";
    if (!accessToken) return null;
    const modeRaw = parsed.searchParams.get("mode")?.trim().toLowerCase();
    const mode = modeRaw === "private" || modeRaw === "public" || modeRaw === "guest" ? modeRaw : null;
    return { token: accessToken, mode };
  }, []);

  // A guest-shareable invitation link: store it as an access entry and enter the
  // guest carousel; the exchange effect resolves it into a real panel card.
  const applyGuestAccessToken = useCallback(async (accessToken: string) => {
    const next = await pushGuestAccessLink({ token: accessToken, mode: "guest" });
    setGuestHistory(next);
    activeConnectionRef.current = null;
    setActivePanelId(null);
    setAutoConnectEnabled(false);
    setSshUrl("");
    setPendingPrivateAccessToken(null);
    setGuestMode(true);
    setView("dashboard");
  }, []);

  // La entrada por SUBDOMINIO fue retirada: un enlace "public" se guarda ahora
  // como enlace de acceso compartible (igual que un enlace de invitado) y entra
  // al carousel de invitado, sin resolver subdominio managed.
  const applyPublicAccessToken = useCallback(async (accessToken: string) => {
    const next = await pushGuestAccessLink({ token: accessToken, mode: "public" });
    setGuestHistory(next);
    activeConnectionRef.current = null;
    setActivePanelId(null);
    setAutoConnectEnabled(false);
    setSshUrl("");
    setPendingPrivateAccessToken(null);
    setGuestMode(true);
    setView("dashboard");
  }, []);

  const claimPrivateAccessToken = useCallback(async (accessToken: string) => {
    if (!token) {
      setPendingPrivateAccessToken(accessToken);
      activeConnectionRef.current = null;
      setActivePanelId(null);
      setAutoConnectEnabled(false);
      setSshUrl("");
      setGuestMode(false);
      setView("login");
      Alert.alert(
        t.accessLinks.signInRequiredTitle,
        t.accessLinks.signInRequiredBody,
      );
      return;
    }

    const fallback = t.accessLinks.linkPanelError;
    try {
      await claimPanelAccessLink(accessToken, token);
      setPendingPrivateAccessToken((current) => (current === accessToken ? null : current));
      await refreshPanelsData();
      setGuestMode(false);
      setView("dashboard");
      Alert.alert(
        t.accessLinks.panelAddedTitle,
        t.accessLinks.panelAddedBody,
      );
    } catch (error) {
      setPendingPrivateAccessToken((current) => (current === accessToken ? null : current));
      Alert.alert(t.common.error, localizeCommonError(error, t, fallback));
    }
  }, [refreshPanelsData, t, token]);

  const handleIncomingShareLink = useCallback((rawUrl: string) => {
    const parsed = parseIncomingAccessLink(rawUrl);
    if (!parsed) return;
    if (parsed.mode === "guest") {
      void applyGuestAccessToken(parsed.token);
      return;
    }
    if (parsed.mode === "public") {
      void applyPublicAccessToken(parsed.token);
      return;
    }
    void claimPrivateAccessToken(parsed.token);
  }, [applyGuestAccessToken, applyPublicAccessToken, claimPrivateAccessToken, parseIncomingAccessLink]);

  useEffect(() => {
    if (!token || !pendingPrivateAccessToken) return;
    void claimPrivateAccessToken(pendingPrivateAccessToken);
  }, [claimPrivateAccessToken, pendingPrivateAccessToken, token]);

  return { parseIncomingAccessLink, handleIncomingShareLink };
}
