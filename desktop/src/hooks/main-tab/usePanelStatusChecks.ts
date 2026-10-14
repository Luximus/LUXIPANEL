import { useCallback, useRef, useState } from "react";
import { testPanelSshConnection } from "../../api/client";
import type { ServerPingStatus } from "../../features/app/viewModels";
import type { Panel } from "../../types/models";
import { STATUS_FLUSH_MS, STATUS_TTL_MS } from "./constants";

/**
 * Estado en vivo del servidor por panel (ping = test-connection SSH),
 * extraído de `useMainTabController` SIN cambios de comportamiento. Se sondea
 * al cargar y en cada refresh; sólo aplica a paneles propios con IP y
 * credenciales guardadas (los compartidos/sin llave quedan "unknown").
 */
export function usePanelStatusChecks({ token }: { token: string | null }) {
  const [panelStatuses, setPanelStatuses] = useState<Record<string, ServerPingStatus>>({});
  // Último resultado de ping por panel + timestamp, para reusarlo dentro del
  // TTL y no rehacer el handshake SSH en cada carga/refresh.
  const panelStatusCacheRef = useRef<Record<string, { status: ServerPingStatus; at: number }>>({});

  /**
   * Sondea ("ping") el servidor de cada panel propio con IP + credenciales
   * reusando el test-connection SSH. Marca "checking" mientras corre y deja
   * "active"/"inactive" según responda. Los paneles compartidos o sin
   * credenciales no son sondeable: quedan "unknown" (sin badge de estado).
   * Se ejecuta en background (fire-and-forget) con concurrencia acotada.
   */
  const runPanelStatusChecks = useCallback(async (list: Panel[]) => {
    if (!token) return;
    const now = Date.now();
    const targets = list.filter((panel) =>
      Boolean(panel.serverIp)
      && (panel.ownership ?? "owner") === "owner"
      && (panel.sshSaveCredentials || (panel.sshKeyIds?.length ?? 0) > 0 || Boolean(panel.sshKeyId)));
    if (targets.length === 0) return;

    // Reusa el último resultado dentro del TTL (siembra al instante) y deja para
    // sondear solo los vencidos o sin medir. Así reentrar/refrescar no rehace el
    // handshake SSH de todos los servidores ni parpadea "Comprobando".
    const cache = panelStatusCacheRef.current;
    const seeded: Record<string, ServerPingStatus> = {};
    const stale: Panel[] = [];
    for (const panel of targets) {
      const hit = cache[panel.id];
      if (hit && now - hit.at < STATUS_TTL_MS) seeded[panel.id] = hit.status;
      else stale.push(panel);
    }
    setPanelStatuses((current) => {
      const next = { ...current, ...seeded };
      for (const panel of stale) next[panel.id] = "checking";
      return next;
    });
    if (stale.length === 0) return;

    // Agrupa los resultados en lotes: un setState por ping re-renderiza TODO el
    // árbol de la pestaña (todas las tarjetas + modales), lo que congela los
    // clics mientras se sondea. Volcar por lotes acota el nº de renders y deja
    // la UI respondiendo.
    const pending: Record<string, ServerPingStatus> = {};
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      flushTimer = null;
      const keys = Object.keys(pending);
      if (keys.length === 0) return;
      const batch: Record<string, ServerPingStatus> = {};
      for (const key of keys) {
        batch[key] = pending[key];
        delete pending[key];
      }
      setPanelStatuses((current) => ({ ...current, ...batch }));
    };
    const record = (panelId: string, status: ServerPingStatus) => {
      pending[panelId] = status;
      cache[panelId] = { status, at: Date.now() };
      if (!flushTimer) flushTimer = setTimeout(flush, STATUS_FLUSH_MS);
    };

    const queue = [...stale];
    const CONCURRENCY = 4;
    const worker = async () => {
      for (;;) {
        const panel = queue.shift();
        if (!panel) return;
        const reachable = await testPanelSshConnection(
          panel.id, panel.serverIp ?? "", token, panel.serverPort ?? undefined,
        );
        record(panel.id, reachable ? "active" : "inactive");
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    if (flushTimer) clearTimeout(flushTimer);
    flush();
  }, [token]);

  /** Invalida el cache de estado de un panel (p.ej. tras editar IP/credenciales)
   *  para que el próximo `runPanelStatusChecks` lo re-sondee de inmediato. */
  const invalidatePanelStatus = useCallback((panelId: string) => {
    delete panelStatusCacheRef.current[panelId];
  }, []);

  return { panelStatuses, runPanelStatusChecks, invalidatePanelStatus };
}
