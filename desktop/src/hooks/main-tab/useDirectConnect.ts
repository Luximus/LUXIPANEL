import { useCallback, useState } from "react";
import { normalizeBaseUrl } from "../../api/directAuth";
import type { ToastApi } from "../../components/ToastProvider";
import type { Messages } from "../../i18n/messages";
import { getPanelDisplayName } from "../../features/app/utils";
import type { Panel } from "../../types/models";

export type DirectConnectState = { open: boolean; url: string; name: string };

/**
 * Conexión DIRECTA nativa (owner) desde la tarjeta de panel. Resuelve la URL
 * del box desde `customDomain` (`normalizeBaseUrl` añade https por defecto y
 * preserva esquema/puerto/ruta) y abre el alta standalone pre-rellenada. El
 * tráfico NO pasa por LP-LS (sin gateway `connectPanel`, sin webview), así que
 * este flujo NO comparte refs con el núcleo de sesión/webview y se aísla sin
 * riesgo. Comportamiento idéntico al original en `useMainTabController`.
 */
export function useDirectConnect({ toast, t }: { toast: ToastApi; t: Messages }) {
  const [directConnect, setDirectConnect] = useState<DirectConnectState>({ open: false, url: "", name: "" });

  const beginDirectConnect = useCallback((panel: Panel) => {
    const url = normalizeBaseUrl(panel.customDomain ?? "");
    if (!url) {
      toast.error(t.errors.panelHasNoSubdomain);
      return;
    }
    setDirectConnect({ open: true, url, name: getPanelDisplayName(panel) });
  }, [t.errors.panelHasNoSubdomain, toast]);

  const closeDirectConnect = useCallback(() => setDirectConnect({ open: false, url: "", name: "" }), []);

  return { directConnect, beginDirectConnect, closeDirectConnect };
}
