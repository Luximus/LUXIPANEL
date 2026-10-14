// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Portada de un servidor dentro del `ServerWindowCarousel` (fase A5).
 *
 * Sustituye al `ServerAssistantPane` embebido: cada slide es SOLO la portada
 * (`ServerHomeCover`) con el estado de disponibilidad de la conexión SSH; el
 * chat vive en su propia pantalla (`ChatScreen`, ruta `Chat` del stack) y se
 * abre con el CTA "Empezar conversación" (`onStartChat`).
 *
 * También ancla el ciclo de vida del asistente que antes disparaba el pane al
 * montarse en cada slide: configura el token del controller, intenta la
 * restauración desde disco (título del auto-rótulo) y precarga proveedores en
 * cuanto el SSH conecta.
 */
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text } from "react-native";
import type { ServerModulePermissions } from "../../api/client";
import type { ServerMetricsState } from "../../features/app/viewModels";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { chatController } from "../../features/assistant/chat-controller";
import { usePanelAvailability } from "../../features/assistant/use-availability";
import { paneSurface, styles } from "./chat-pane.styles";
import { strings } from "./strings";
import { ServerHomeCover } from "./ServerHomeCover";
import { getDirect } from "../../api/serverApi";

export function ServerCoverPane({ panelId, token, language, serverIp, isOwner = true, ownerName, onViewOwner, isFavorite, onToggleFavorite, onAudit, onManageAccess, onRequestOpenModulePicker, onStartChat, onNewServer, onRegisterSshKey, onNewTerminal, panelName, logoUrl, metricsState, onMetricsRefresh, noData }: {
  panelId: string;
  token: string;
  language?: string;
  /** IP del servidor (se muestra enmascarada con ver/ocultar en la portada). */
  serverIp?: string;
  /** ¿El usuario es el CREADOR del panel? Solo el creador ve las acciones de
   *  administración. Default true (paneles propios / invitado). */
  isOwner?: boolean;
  /** Nombre del dueño que compartió el panel (badge "compartido por X"). */
  ownerName?: string;
  onViewOwner?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onAudit?: () => void;
  onManageAccess?: () => void;
  /** Abre el DRAWER CENTRAL "Más opciones" con los módulos del servidor. Pasa
   *  los permisos completos para el gating del chrome del webview. */
  onRequestOpenModulePicker?: (perms: ServerModulePermissions) => void;
  /** CTA "Empezar conversación": navega a la pantalla `Chat` de este panel. */
  onStartChat?: () => void;
  onNewServer?: () => void;
  onRegisterSshKey?: () => void;
  /** Abre una consola nueva del terminal nativo (pantalla `Terminal`). */
  onNewTerminal?: () => void;
  /** Nombre del panel/servidor (título de la portada). */
  panelName?: string;
  /** Logo de marca del panel (si lo hay). */
  logoUrl?: string;
  /** Métricas en vivo del panel (desde el contenedor). */
  metricsState?: ServerMetricsState;
  /** Fuerza al contenedor a re-sondear las métricas de este panel. */
  onMetricsRefresh?: (panelId: string) => Promise<void> | void;
  /** Cuenta sin datos (saldo MB <= 0): bloquea igual que las conexiones. */
  noData?: boolean;
}) {
  const t = useMemo(() => strings(language), [language]);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const surface = paneSurface(tokens);
  // Error legible de "Aprobar huella" (antes iba al notice del chat del pane).
  const [notice, setNotice] = useState<string | null>(null);

  const av = usePanelAvailability({ panelId, token, metricsState, noData, t, onMetricsRefresh, onError: setNotice });

  // Token del controller + restauración desde disco tras un cierre total del SO
  // (recupera el hilo persistido → título del chat para el auto-rótulo de la
  // pestaña, aunque el usuario aún no abra la pantalla del chat).
  useEffect(() => {
    if (!token) return;
    chatController.configure(panelId, { token });
    chatController.ensureDiskRestore(panelId);
  }, [panelId, token]);

  // Carga proactiva de proveedores cuando el SSH ya conecta (métricas "ok"):
  // el composer entra a la pantalla del chat con el proveedor listo.
  useEffect(() => {
    if (!getDirect(panelId) && (av.effectiveMetrics?.status !== "ok" || av.effectiveMetrics.metrics.liveStatus !== "ok")) return;
    chatController.loadProviders(panelId);
  }, [panelId, av.effectiveMetrics]);

  return (
    <ScrollView
      style={[styles.wrap, styles.list, surface.wrap]}
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      <ServerHomeCover
        token={token}
        language={language}
        t={t}
        tokens={tokens}
        panelName={panelName}
        logoUrl={logoUrl}
        serverIp={serverIp}
        isOwner={isOwner}
        ownerName={ownerName}
        onViewOwner={onViewOwner}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
        onAudit={onAudit}
        onManageAccess={onManageAccess}
        metrics={av.effectiveMetrics}
        connectionError={av.connectionError}
        blocked={av.blocked}
        noData={noData}
        isFingerprint={av.isFingerprint}
        unavailableReason={av.unavailableReason}
        approvingFp={av.approvingFp}
        refreshingStatus={av.refreshingStatus}
        onApproveFingerprint={() => void av.approveFingerprint()}
        onRefreshStatus={() => void av.refreshStatus()}
        onOpenModulePicker={() => onRequestOpenModulePicker?.(av.modulePerms)}
        onStartConversation={() => onStartChat?.()}
        onNewTerminal={onNewTerminal}
        onNewServer={onNewServer}
        onRegisterSshKey={onRegisterSshKey}
      />
      {notice ? <Text style={[styles.notice, { color: tokens.danger }]}>{notice}</Text> : null}
    </ScrollView>
  );
}
