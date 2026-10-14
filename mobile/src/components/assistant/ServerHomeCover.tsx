// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowDownUp,
  Cpu,
  Eye,
  EyeOff,
  HardDrive,
  KeyRound,
  MemoryStick,
  MessageSquare,
  PencilRuler,
  Plus,
  RefreshCw,
  ScrollText,
  ServerOff,
  ShieldCheck,
  Star,
  TerminalSquare,
  UserCog,
  Users,
} from "lucide-react-native";
import type { ServerMetricsState } from "../../features/app/viewModels";
import { computeMetricDisplay, type MetricKind } from "../../features/app/metrics-format";
import { getMessages } from "../../i18n";
import type { ThemeTokens } from "../../theme/colors";
import type { AssistantStrings } from "./types";
import { styles } from "./ServerHomeCover.styles";

/** Enmascara una IP dejando solo el primer octeto: "198.252.100.122" → "198.•••.•••.•••". */
function maskIp(ip: string): string {
  const parts = ip.split(".");
  if (parts.length !== 4) return "•••••••••";
  return `${parts[0]}.•••.•••.•••`;
}

/**
 * Portada del servidor (antes de iniciar el chat): logo + nombre + badge
 * "compartido por" + IP enmascarada con acciones de administración + 4 métricas
 * en vivo + botones de acción (módulos / conversación / terminal / registrar
 * servidor / llave SSH). Extraída 1:1 del `ServerAssistantPane` (fase A3): todo
 * el estado remoto y los handlers llegan por props; aquí solo vive el estado de
 * UI local (logo roto, IP revelada, tooltip de usuarios).
 */
export function ServerHomeCover({
  token, language, t, tokens,
  panelName, logoUrl, serverIp, isOwner, ownerName, onViewOwner,
  isFavorite, onToggleFavorite, onAudit, onManageAccess,
  metrics, connectionError, blocked, noData, isFingerprint, unavailableReason,
  approvingFp, refreshingStatus, onApproveFingerprint, onRefreshStatus,
  onOpenModulePicker, onStartConversation, onNewTerminal, onNewServer, onRegisterSshKey,
}: {
  /** Solo para deshabilitar acciones sin sesión (mismo gating que el pane). */
  token: string;
  language?: string;
  t: AssistantStrings;
  tokens: ThemeTokens;
  panelName?: string;
  logoUrl?: string;
  serverIp?: string;
  isOwner: boolean;
  ownerName?: string;
  onViewOwner?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onAudit?: () => void;
  onManageAccess?: () => void;
  /** Métricas efectivas del panel (override local del pane ?? las del contenedor). */
  metrics?: ServerMetricsState;
  /** Error de CONEXIÓN en background (inalcanzable / fallo de métricas). */
  connectionError: boolean;
  blocked: boolean;
  noData?: boolean;
  isFingerprint: boolean;
  unavailableReason: string | null;
  approvingFp: boolean;
  refreshingStatus: boolean;
  onApproveFingerprint: () => void;
  onRefreshStatus: () => void;
  /** Abre el drawer central "Más opciones" (módulos); el pane cierra los permisos. */
  onOpenModulePicker: () => void;
  /** Inicia el chat nativo (el pane marca `started`). */
  onStartConversation: () => void;
  onNewTerminal?: () => void;
  onNewServer?: () => void;
  onRegisterSshKey?: () => void;
}) {
  // Strings de métricas (CPU/RAM/Disco/Datos) reutilizadas del panelTable, para que
  // las 4 tarjetas de la portada sean idénticas a las del tab Server del drawer izq.
  const msgs = getMessages(language);
  const tp = msgs.panelTable;
  const insets = useSafeAreaInsets();
  const [logoBroken, setLogoBroken] = useState(false);
  const [ipRevealed, setIpRevealed] = useState(false);
  // Tooltip con la lista de usuarios Linux conectados (junto a la IP).
  const [usersTooltipOpen, setUsersTooltipOpen] = useState(false);
  // Reintenta el logo de marca si cambia su URL: un fallo previo (imagen rota/que
  // no cargó) no debe dejar el panel con el icono por defecto para siempre.
  useEffect(() => { setLogoBroken(false); }, [logoUrl]);
  // Usuarios Linux conectados (viajan con las métricas: mismo sondeo SSH en
  // background cada 30s del panel visible). Sólo se muestran cuando el sondeo
  // corrió (connectedUsers no nulo); si no, el botón se oculta.
  const connectedUsers = metrics?.status === "ok" ? (metrics.metrics.connectedUsers ?? null) : null;
  useEffect(() => { if (!connectedUsers) setUsersTooltipOpen(false); }, [connectedUsers]);

  return (
    // Portada: logo de la app + Entrar a panel + Empezar conversación.
    // El navbar inferior se oculta mientras esto se muestra (MainScreen).
    <View style={[styles.introWrap, { paddingBottom: insets.bottom + 28 }]}>
      {/* zIndex elevado mientras el tooltip de usuarios está abierto para
          que el popover pinte por encima de la fila de métricas (hermano
          posterior) en iOS. */}
      <View style={[styles.introHero, usersTooltipOpen ? styles.introHeroRaised : null]}>
        {/* Si el panel/servidor trae imagen y carga, se muestra SOLA (no el
            icono base) y con `contain` para que NO se recorte. Solo se cae al
            icono base de la app si no hay imagen o el remoto está roto. */}
        <View style={styles.introLogo}>
          {logoUrl && !logoBroken ? (
            <Image
              source={{ uri: logoUrl }}
              style={styles.introLogoImg}
              resizeMode="contain"
              onError={() => setLogoBroken(true)}
            />
          ) : (
            <Image source={require("../../../assets/icon.png")} style={styles.introLogoImg} resizeMode="contain" />
          )}
        </View>
        {panelName ? (
          <View style={styles.introTitleRow}>
            {onToggleFavorite ? (
              <Pressable
                onPress={() => onToggleFavorite()}
                accessibilityLabel={isFavorite ? t.favoriteRemove : t.favoriteAdd}
                hitSlop={8}
              >
                <Star size={22} color={isFavorite ? tokens.warning : tokens.textMuted} fill={isFavorite ? tokens.warning : "transparent"} />
              </Pressable>
            ) : null}
            <Text numberOfLines={2} style={[styles.introTitle, { color: tokens.textPrimary }]}>{panelName}</Text>
          </View>
        ) : null}
        {/* Badge "compartido por X": solo en paneles compartidos. Toca →
            abre el perfil público (Perfil + Bitácora) del que compartió. */}
        {!isOwner && ownerName ? (
          <Pressable
            onPress={() => onViewOwner?.()}
            accessibilityLabel={`${(language ?? "es").startsWith("en") ? "Shared by" : "Compartido por"} ${ownerName}`}
            style={[styles.sharedBadge, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}
          >
            <Users size={12} color={tokens.brand} />
            <Text numberOfLines={1} style={[styles.sharedBadgeText, { color: tokens.textSecondary }]}>
              {(language ?? "es").startsWith("en") ? "Shared by" : "Compartido por"} <Text style={{ color: tokens.brand, fontWeight: "800" }}>{ownerName}</Text>
            </Text>
          </Pressable>
        ) : null}
        {/* IP enmascarada con ver/ocultar bajo el nombre. */}
        {serverIp ? (
          <View style={styles.introIpRow}>
            <Text style={[styles.introIpText, { color: tokens.textMuted }]}>
              {isOwner && ipRevealed ? serverIp : maskIp(serverIp)}
            </Text>
            {/* Revelar IP: SOLO el creador. A quien se le compartió el panel
                la IP le queda siempre enmascarada (sin botón de ojo). */}
            {isOwner ? (
              <Pressable
                onPress={() => setIpRevealed((v) => !v)}
                accessibilityLabel={ipRevealed ? t.hideIp : t.showIp}
                hitSlop={8}
                style={[styles.introIpToggle, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}
              >
                {ipRevealed ? <EyeOff size={14} color={tokens.textMuted} /> : <Eye size={14} color={tokens.textMuted} />}
              </Pressable>
            ) : null}
            {/* Usuarios Linux conectados: botón con contador + tooltip con
                la lista de nombres. Datos del mismo sondeo SSH de métricas. */}
            {connectedUsers ? (
              <View style={styles.introUsersAnchor}>
                <Pressable
                  onPress={() => setUsersTooltipOpen((v) => !v)}
                  accessibilityLabel={t.connectedUsers ?? "Connected users"}
                  hitSlop={8}
                  style={[styles.introUsersBtn, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}
                >
                  <Users size={14} color={tokens.textMuted} />
                  <Text style={[styles.introUsersCount, { color: tokens.textSecondary }]}>{connectedUsers.count}</Text>
                </Pressable>
                {usersTooltipOpen ? (
                  <>
                    {/* Capa invisible para cerrar al tocar fuera. */}
                    <Pressable style={styles.introUsersBackdrop} onPress={() => setUsersTooltipOpen(false)} />
                    <View style={[styles.introUsersPopover, { borderColor: tokens.border, backgroundColor: tokens.bgCardSolid }]}>
                      <Text style={[styles.introUsersPopTitle, { color: tokens.textMuted }]}>{t.connectedUsersTitle ?? "Connected users"}</Text>
                      {connectedUsers.users.length ? (
                        <ScrollView style={styles.introUsersList} keyboardShouldPersistTaps="handled">
                          {connectedUsers.users.map((u) => (
                            <View key={u.name} style={styles.introUsersItem}>
                              <Text numberOfLines={1} style={[styles.introUsersName, { color: tokens.textPrimary }]}>{u.name}</Text>
                              {u.sessions > 1 ? (
                                <Text style={[styles.introUsersSessions, { color: tokens.textMuted }]}>×{u.sessions}</Text>
                              ) : null}
                            </View>
                          ))}
                        </ScrollView>
                      ) : (
                        <Text style={[styles.introUsersEmpty, { color: tokens.textMuted }]}>{t.connectedUsersEmpty ?? "No users connected"}</Text>
                      )}
                    </View>
                  </>
                ) : null}
              </View>
            ) : null}
            {/* Acciones rápidas junto a usuarios (igual que en web):
                auditoría · gestión de acceso. SOLO el creador del panel
                (a los compartidos no se les muestran). */}
            {isOwner && token && onAudit ? (
              <Pressable onPress={() => onAudit()} accessibilityLabel={msgs.audit.title} hitSlop={6} style={[styles.introIpToggle, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
                <ScrollText size={14} color={tokens.textMuted} />
              </Pressable>
            ) : null}
            {isOwner && token && onManageAccess ? (
              <Pressable onPress={() => onManageAccess()} accessibilityLabel={msgs.sharing.manageAccess} hitSlop={6} style={[styles.introIpToggle, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
                <UserCog size={14} color={tokens.textMuted} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
      {/* 4 métricas en vivo (CPU/RAM/Disco/Datos) en una fila, iguales a las
          del tab Server del drawer izquierdo. */}
      <View style={styles.introStatsRow}>
        {([
          { kind: "cpu", icon: <Cpu size={15} color={tokens.textMuted} />, label: tp.metrics.cpu },
          { kind: "ram", icon: <MemoryStick size={15} color={tokens.textMuted} />, label: tp.metrics.ram },
          { kind: "disk", icon: <HardDrive size={15} color={tokens.textMuted} />, label: tp.metrics.disk },
          { kind: "traffic", icon: <ArrowDownUp size={15} color={tokens.textMuted} />, label: tp.metrics.traffic },
        ] as Array<{ kind: MetricKind; icon: React.ReactNode; label: string }>).map(({ kind, icon, label }) => {
          const d = computeMetricDisplay(kind, metrics, tp);
          return (
            <View key={kind} style={[styles.introStatCard, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
              {icon}
              <Text numberOfLines={1} style={[styles.introStatValue, { color: tokens.textPrimary }]}>{d.value}</Text>
              <Text numberOfLines={1} style={[styles.introStatLabel, { color: tokens.textMuted }]}>{label}</Text>
            </View>
          );
        })}
      </View>
      <View style={[styles.introSeparator, { backgroundColor: tokens.border }]} />
      <View style={styles.introBtns}>
        {/* Huella sin aprobar / servidor inalcanzable: botón para resolver
            el bloqueo + NOTA explicativa. Debajo siguen disponibles las
            demás acciones MENOS "Empezar conversación" (que requiere SSH
            funcionando). Al aprobar, `blocked` pasa a false y reaparece. */}
        {connectionError ? (
          /* Error de conexión en background: contenedor con motivo +
             Actualizar; las acciones que requieren conexión se ocultan. */
          <View style={[styles.introErrorBox, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
            <ServerOff size={22} color={tokens.danger} />
            <Text style={[styles.introErrorText, { color: tokens.textSecondary }]}>{unavailableReason}</Text>
            <Pressable
              onPress={() => onRefreshStatus()}
              disabled={refreshingStatus || !token}
              accessibilityLabel={t.refresh}
              style={({ pressed }) => [styles.introBtn, { alignSelf: "stretch", backgroundColor: tokens.brand, opacity: (refreshingStatus || pressed) ? 0.85 : 1 }]}
            >
              {refreshingStatus ? <ActivityIndicator size="small" color="#fff" /> : <RefreshCw size={18} color="#fff" />}
              <Text style={styles.introBtnText}>{refreshingStatus ? t.refreshing : t.refresh}</Text>
            </Pressable>
          </View>
        ) : blocked && !noData ? (
          <>
            {isFingerprint ? (
              <Pressable
                onPress={() => onApproveFingerprint()}
                disabled={approvingFp || !token}
                accessibilityLabel={t.approveFp}
                style={({ pressed }) => [styles.introBtn, { backgroundColor: tokens.brand, opacity: (approvingFp || pressed) ? 0.85 : 1 }]}
              >
                {approvingFp ? <ActivityIndicator size="small" color="#fff" /> : <ShieldCheck size={18} color="#fff" />}
                <Text style={styles.introBtnText}>{approvingFp ? t.approving : t.approveFp}</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => onRefreshStatus()}
                disabled={refreshingStatus || !token}
                accessibilityLabel={t.refresh}
                style={({ pressed }) => [styles.introBtn, { backgroundColor: tokens.brand, opacity: (refreshingStatus || pressed) ? 0.85 : 1 }]}
              >
                {refreshingStatus ? <ActivityIndicator size="small" color="#fff" /> : <RefreshCw size={18} color="#fff" />}
                <Text style={styles.introBtnText}>{refreshingStatus ? t.refreshing : t.refresh}</Text>
              </Pressable>
            )}
            <Text style={[styles.introNote, { color: tokens.textMuted }]}>
              {isFingerprint ? (t.fingerprintNote ?? unavailableReason ?? "") : (unavailableReason ?? "")}
            </Text>
          </>
        ) : null}

        {/* Acciones que REQUIEREN la conexión SSH del gateway (panel/módulos,
            chat IA, terminal). Se ocultan con error de conexión: abrirlas
            rebotaría en el SSO; el usuario primero pulsa Actualizar arriba. */}
        {!connectionError ? (
          <>
            {/* "Utilizar más herramientas": abre el DRAWER CENTRAL con la
                lista DINÁMICA de módulos activos del servidor. */}
            <Pressable
              onPress={() => onOpenModulePicker()}
              accessibilityLabel={msgs.modules.openButton}
              style={({ pressed }) => [styles.introBtn, { backgroundColor: tokens.brand, opacity: pressed ? 0.9 : 1 }]}
            >
              <PencilRuler size={18} color="#fff" />
              <Text style={styles.introBtnText}>{msgs.modules.openButton}</Text>
            </Pressable>
            {/* "Empezar conversación": inicia el CHAT NATIVO (composer del
                navbar inferior + área de mensajes nativa que streamea por el
                gateway). Ya NO abre la webview del panel. El gating
                (blocked/connectionError/huella) se aplica arriba: este botón
                solo se renderiza cuando la conexión SSH está disponible. */}
            <Pressable
              onPress={() => onStartConversation()}
              accessibilityLabel={t.startConversation ?? "Empezar conversación"}
              style={({ pressed }) => [styles.introBtn, styles.introBtnSecondary, { borderColor: tokens.border, backgroundColor: tokens.bgCardSolid, opacity: pressed ? 0.9 : 1 }]}
            >
              <MessageSquare size={18} color={tokens.brand} />
              <Text style={[styles.introBtnText, { color: tokens.textPrimary }]}>{t.startConversation ?? "Empezar conversación"}</Text>
            </Pressable>
            {/* "Nueva terminal": abre una CONSOLA del emulador 100% NATIVO
                (`NativeTerminalSession`, sin WebView). El cableado va por
                `onNewTerminal` → `open_terminal` → `openNewConsole` en
                MainScreen, que monta el terminal nativo a pantalla completa. */}
            <Pressable
              onPress={() => onNewTerminal?.()}
              accessibilityLabel={t.newTerminal ?? "Nueva terminal"}
              style={({ pressed }) => [styles.introBtn, styles.introBtnSecondary, { borderColor: tokens.border, backgroundColor: tokens.bgCardSolid, opacity: pressed ? 0.9 : 1 }]}
            >
              <TerminalSquare size={18} color={tokens.brand} />
              <Text style={[styles.introBtnText, { color: tokens.textPrimary }]}>{t.newTerminal ?? "Nueva terminal"}</Text>
            </Pressable>
          </>
        ) : null}
        {/* Separador: arriba las acciones que operan SOBRE el servidor
            (panel/módulos, chat IA, terminal — requieren conexión SSH en
            background o directa); abajo las de GESTIÓN de la información del
            servidor (registrar servidor / llave SSH), que no conectan. */}
        <View style={[styles.introSeparator, { backgroundColor: tokens.border }]} />
        <Pressable
          onPress={() => onNewServer?.()}
          accessibilityLabel={t.newServerConnection ?? "Registrar nuevo servidor"}
          style={({ pressed }) => [styles.introBtn, styles.introBtnSecondary, { borderColor: tokens.border, backgroundColor: tokens.bgCardSolid, opacity: pressed ? 0.9 : 1 }]}
        >
          <Plus size={18} color={tokens.brand} />
          <Text style={[styles.introBtnText, { color: tokens.textPrimary }]}>{t.newServerConnection ?? "Registrar nuevo servidor"}</Text>
        </Pressable>
        {/* "Registrar llave SSH": SOLO el creador. En paneles compartidos
            no aparece (el usuario no administra las llaves del servidor). */}
        {isOwner ? (
          <Pressable
            onPress={() => onRegisterSshKey?.()}
            accessibilityLabel={t.registerSshKey ?? "Registrar llave SSH"}
            style={({ pressed }) => [styles.introBtn, styles.introBtnSecondary, { borderColor: tokens.border, backgroundColor: tokens.bgCardSolid, opacity: pressed ? 0.9 : 1 }]}
          >
            <KeyRound size={18} color={tokens.brand} />
            <Text style={[styles.introBtnText, { color: tokens.textPrimary }]}>{t.registerSshKey ?? "Registrar llave SSH"}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
