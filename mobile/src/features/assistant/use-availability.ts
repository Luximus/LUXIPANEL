// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Disponibilidad del asistente de un panel (fase A5, extraído del pane).
 *
 * El asistente usa la misma conexión SSH en background que las métricas: si no
 * conectan, se bloquea con la razón (mismo árbol que web/desktop). El gap
 * FINGERPRINT se resuelve aquí con `approveFingerprint`. Lo comparten la
 * portada del carousel (`ServerCoverPane`) y la pantalla del chat
 * (`ChatScreen`): cada montaje mantiene su propio override local de métricas
 * tras "Refrescar estado" (se descarta cuando el contenedor entrega métricas
 * nuevas por props).
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  approvePanelFingerprint,
  getServerMetrics,
  getServerModulePermissions,
  type ServerModulePermissions,
} from "../../api/client";
import type { ServerMetricsState } from "../app/viewModels";
import type { AssistantStrings } from "../../components/assistant/types";
import { getDirect, getDirectSessionRevision, subscribeDirectSessions } from "../../api/serverApi";
import { assistantAvailabilityReason } from "./availability-reason";

export type { AvailabilityReason } from "./availability-reason";

export function usePanelAvailability({ panelId, token, metricsState, noData, t, onMetricsRefresh, onError }: {
  panelId: string;
  token: string;
  /** Métricas en vivo del panel (las sondea el contenedor). */
  metricsState?: ServerMetricsState;
  /** Cuenta sin datos (saldo MB <= 0): bloquea con su propio motivo. */
  noData?: boolean;
  t: AssistantStrings;
  /** Fuerza al contenedor a re-sondear las métricas de este panel. */
  onMetricsRefresh?: (panelId: string) => Promise<void> | void;
  /** Error legible al aprobar la huella (cada superficie decide dónde pintarlo). */
  onError?: (text: string | null) => void;
}) {
  // Módulos permitidos del usuario SSH de la conexión en background (assistant/
  // terminal), según su grupo en LUXIPANEL. Gatea "Empezar conversación" y "Nueva
  // terminal". Fallback no-restrictivo (ambos true) hasta cargar / si no se puede
  // resolver (p. ej. panel compartido), para no ocultar de más.
  const [modulePerms, setModulePerms] = useState<ServerModulePermissions>({ assistant: true, terminal: true, available: [] });
  const directRevision = useSyncExternalStore(subscribeDirectSessions, () => getDirectSessionRevision(panelId), () => 0);
  useEffect(() => {
    let current = true;
    if (!token || !panelId) return;
    void getServerModulePermissions(panelId, token).then(value => { if (current) setModulePerms(value); });
    return () => { current = false; };
  }, [panelId, token, directRevision]);

  const [approvingFp, setApprovingFp] = useState(false);
  const [fpApproved, setFpApproved] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  // Override local de métricas tras "Refrescar estado": refleja el resultado al
  // instante sin esperar el siguiente sondeo del contenedor.
  const [metricsOverride, setMetricsOverride] = useState<ServerMetricsState | null>(null);
  const effectiveMetrics = metricsOverride ?? metricsState;
  useEffect(() => { setMetricsOverride(null); }, [metricsState]);

  const direct = !!getDirect(panelId);
  const reasonKind = assistantAvailabilityReason(effectiveMetrics, direct);
  const isFingerprint = reasonKind === "fingerprint";
  const unavailableReason = noData && !direct ? t.noData
    : reasonKind === "creds" ? t.unavailCreds
      : reasonKind === "fingerprint" ? t.unavailFingerprint
        : reasonKind === "unreachable" ? t.unavailUnreachable
          : reasonKind === "generic" ? t.unavailGeneric
            : null;
  const blocked = (!!noData && !direct) || (reasonKind !== null && !(fpApproved && isFingerprint));
  // Error de CONEXIÓN con el servidor en background: se desactivan las acciones
  // que requieren la conexión y se ofrece Actualizar (re-sondea; si ya conecta,
  // `refreshStatus` limpia reasonKind y reaparecen).
  const connectionError = reasonKind === "unreachable" || reasonKind === "generic";

  const approveFingerprint = async (): Promise<void> => {
    if (!token || approvingFp) return;
    setApprovingFp(true);
    onError?.(null);
    const r = await approvePanelFingerprint(panelId, token);
    setApprovingFp(false);
    if (r.ok) {
      setFpApproved(true);
      void onMetricsRefresh?.(panelId); // refresca métricas del contenedor al instante
    } else {
      onError?.(r.error || t.unavailGeneric);
    }
  };

  const refreshStatus = async (): Promise<void> => {
    if (!token || refreshingStatus) return;
    setRefreshingStatus(true);
    onError?.(null);
    const r = await getServerMetrics(panelId, token);
    setRefreshingStatus(false);
    setMetricsOverride(r.ok ? { status: "ok", metrics: r.metrics } : { status: "error" });
    void onMetricsRefresh?.(panelId);
  };

  return {
    effectiveMetrics,
    reasonKind,
    isFingerprint,
    unavailableReason,
    blocked,
    connectionError,
    modulePerms,
    approvingFp,
    refreshingStatus,
    approveFingerprint,
    refreshStatus,
  };
}
