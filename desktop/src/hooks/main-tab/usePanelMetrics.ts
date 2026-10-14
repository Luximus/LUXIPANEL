import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { getServerMetrics } from "../../api/client";
import type { View } from "../../features/app/types";
import type { ServerMetricsState } from "../../features/app/viewModels";
import { applyServerPalette, clearServerPalette, loadPanelPalette } from "../../theme/panel-palette";

/**
 * Métricas en vivo (CPU/RAM/disco) por panel + paleta de marca por servidor,
 * extraído de `useMainTabController` SIN cambios de comportamiento. Sólo se
 * sondea el panel del slide visible del carousel de Servidores (1 cada 30s)
 * mientras la vista esté en "dashboard" y la ventana visible. Incluye también
 * el foco pendiente de panel (p.ej. al tocar una notificación de uso elevado).
 */
export function usePanelMetrics({ effectiveToken, view, setView }: {
  effectiveToken: string | null;
  view: View;
  setView: Dispatch<SetStateAction<View>>;
}) {
  const [panelMetrics, setPanelMetrics] = useState<Record<string, ServerMetricsState>>({});
  const [visibleServerPanelId, setVisibleServerPanelId] = useState<string | null>(null);
  const onActiveServerPanelChange = useCallback((panelId: string | null) => {
    setVisibleServerPanelId(panelId);
  }, []);
  // Panel a enfocar en el carousel (p.ej. al tocar una notificación de uso
  // elevado de un servidor): el carousel desplaza a su tarjeta y luego limpia.
  const [pendingFocusPanelId, setPendingFocusPanelId] = useState<string | null>(null);
  const clearPendingFocus = useCallback(() => setPendingFocusPanelId(null), []);
  const focusServerPanel = useCallback((panelId: string) => {
    setView("dashboard");
    setPendingFocusPanelId(panelId);
  }, [setView]);
  // Refresco puntual de métricas de un panel (p.ej. tras aprobar la huella SSH
  // en el asistente: las tarjetas CPU/RAM/Disco deben actualizarse al instante).
  const refreshPanelMetrics = useCallback(async (panelId: string) => {
    if (!effectiveToken) return;
    setPanelMetrics((cur) => (cur[panelId] ? cur : { ...cur, [panelId]: { status: "loading" } }));
    const result = await getServerMetrics(panelId, effectiveToken);
    setPanelMetrics((cur) => ({
      ...cur,
      [panelId]: result.ok ? { status: "ok", metrics: result.metrics } : { status: "error" },
    }));
  }, [effectiveToken]);

  // Polling de métricas (CPU/RAM/disco) SÓLO del panel del slide visible del
  // carousel: 1 sondeo al activarse + cada 30s, gateado por vista "dashboard" y
  // ventana visible. Al cambiar de slide el efecto se re-arma para el nuevo
  // panel; mantiene el último valor mientras refresca en background. LP ya no
  // cobra por datos (MB), así que no hay gate de saldo: se sondea siempre.
  useEffect(() => {
    if (!effectiveToken || view !== "dashboard" || !visibleServerPanelId) return;
    // `visibleServerPanelId` puede traer VARIOS ids (página del carousel con
    // grilla), separados por coma. Sondeamos todos los visibles.
    const ids = visibleServerPanelId.split(",").filter(Boolean);
    if (!ids.length) return;
    let cancelled = false;
    const fetchOne = async (panelId: string) => {
      setPanelMetrics((current) => (current[panelId] ? current : { ...current, [panelId]: { status: "loading" } }));
      const result = await getServerMetrics(panelId, effectiveToken);
      if (cancelled) return;
      setPanelMetrics((current) => ({
        ...current,
        [panelId]: result.ok
          ? { status: "ok", metrics: result.metrics }
          : { status: "error" },
      }));
    };
    const fetchOnce = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      for (const id of ids) void fetchOne(id);
    };
    void fetchOnce();
    const intervalId = window.setInterval(() => void fetchOnce(), 30_000);
    const onVisibility = () => { if (document.visibilityState === "visible") void fetchOnce(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [effectiveToken, view, visibleServerPanelId]);

  // Paleta de marca POR SERVIDOR: al cambiar el slide visible del carousel
  // (o salir del dashboard), recolorea los tokens `--lp-brand*` con el branding
  // del panel activo (paridad con web/app). Reusa el reporte existente de panel
  // visible (no añade otro IntersectionObserver). `visibleServerPanelId` puede
  // traer varios ids (grilla); para el color de marca basta el primero visible.
  useEffect(() => {
    const id = view === "dashboard"
      ? (visibleServerPanelId?.split(",").filter(Boolean)[0] ?? null)
      : null;
    if (!effectiveToken || !id) {
      clearServerPalette();
      return;
    }
    let cancelled = false;
    void loadPanelPalette(id, effectiveToken).then((palette) => {
      if (!cancelled) applyServerPalette(palette);
    });
    return () => { cancelled = true; };
  }, [effectiveToken, view, visibleServerPanelId]);

  // Al desmontar el controlador (cerrar pestaña/salir) se limpia el override.
  useEffect(() => () => { clearServerPalette(); }, []);

  return {
    panelMetrics,
    onActiveServerPanelChange,
    refreshPanelMetrics,
    pendingFocusPanelId,
    clearPendingFocus,
    focusServerPanel,
  };
}
