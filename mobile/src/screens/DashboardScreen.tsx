import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Animated, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { styles } from "./DashboardScreen.styles";
import { AlertTriangle, Database, Download, FolderTree, KeyRound, Lock, Newspaper, Plus, RefreshCw, Settings, Tags, TrendingUp, Upload } from "lucide-react-native";
import PanelCardGrid from "../components/PanelCardGrid";
import ServerWindowCarousel from "../components/ServerWindowCarousel";
import { Button } from "../components/ui/Button";
import { IconButton } from "../components/ui/IconButton";
import { AuditModal } from "../components/AuditModal";
import type { PanelRow, ServerMetricsState } from "../features/app/viewModels";
import type { PanelInvitation } from "../types/models";
import type { PanelTaxonomy, SshKeySummary, ServerModulePermissions } from "../api/client";
import { getLocaleDirection, getLocaleRowDirection, getLocaleTextAlign, getMessages, isRtlLocale } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { useEnterAnimation } from "../hooks/useEnterAnimation";
import { getThemeTokens } from "../theme/colors";
import { LoginBackground } from "../components/LoginBackground";

/** Modo de visualizaciÃ³n de Servidores: carousel (window cards) o lista plana. */
export function DashboardScreen({
  language,
  licensedCount,
  unlicensedCount,
  busyPanels,
  panelRows,
  panelMetrics,
  favorites,
  onActiveServerPanelChange,
  palettePanelId,
  focusPanelId,
  onFocusHandled,
  onPanelRowAction,
  onOpenModulePicker,
  onOpenCreatePanel,
  onRefreshPanels,
  onGoServers,
  onGoSupport,
  onGoSecurity,
  onGoPayments,
  onGoUsage,
  blogDrawerOpen = false,
  onOpenBlogDrawer,
  onCloseBlogDrawer,
  isAdmin = false,
  searchValue,
  onSearchChange,
  openFiltersSignal = 0,
  onFilterCountChange,
  balancesVersion = 0,
  invitations,
  onRespondInvitation,
  token,
  taxonomy,
  sshKeys,
  refreshTaxonomy,
  refreshSshKeys,
  applyCategoryCreated,
  applyCategoryRenamed,
  applyCategoryDeleted,
  applyTagCreated,
  applyTagRenamed,
  applyTagDeleted,
  applySshKeyCreated,
  applySshKeyUpdated,
  applySshKeyDeleted,
  guestMode = false,
}: {
  isDark?: boolean;
  language: string;
  licensedCount: number;
  unlicensedCount: number;
  busyPanels: boolean;
  panelRows: PanelRow[];
  panelMetrics?: Record<string, ServerMetricsState>;
  favorites?: Set<string>;
  onActiveServerPanelChange?: (panelId: string | null) => void;
  /** Panel cuya paleta ya está aplicada: el carousel muestra skeleton en los slides
   *  cuyo color aún no llegó (evita el flash de color al cambiar de panel). */
  palettePanelId?: string | null;
  /** Panel al que el carousel debe desplazarse (p. ej. recién creado). */
  focusPanelId?: string | null;
  /** El carousel ya hizo foco en `focusPanelId` (para limpiarlo). */
  onFocusHandled?: () => void;
  onPanelRowAction: (actionId: string, row: PanelRow) => void;
  /** Abre el drawer central "Más opciones" con los módulos activos del servidor
   *  (lo monta MainScreen como bottom-sheet independiente). */
  onOpenModulePicker?: (row: PanelRow, perms: ServerModulePermissions) => void;
  /** Abre una herramienta (chat/terminal) como webview de panel que despliega el
   *  drawer flotante de LUXIPANEL (botones "Empezar conversación"/"Nueva terminal"). */
  onOpenCreatePanel: () => void;
  onRefreshPanels: () => void;
  onGoServers: () => void;
  onGoSupport: () => void;
  onGoSecurity: () => void;
  onGoPayments?: () => void;
  blogDrawerOpen?: boolean;
  onOpenBlogDrawer?: (tab?: "profile" | "blog") => void;
  onCloseBlogDrawer?: () => void;
  /** Staff/admin: muestra el tab "Soporte" (consola de tickets) en el TopMiniNav.
   *  El cliente usa el asistente (FAB), por eso por defecto no se muestra. */
  isAdmin?: boolean;
  /** Abre Pagos directamente en el tab "Historial de consumo" (chip MB). */
  onGoUsage?: () => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  openFiltersSignal?: number;
  onFilterCountChange?: (count: number) => void;
  /** Contador que bumpea el controlador al cambiar los saldos (compra
   *  acreditada): re-consulta el saldo de datos para el chip y el gating. */
  balancesVersion?: number;
  invitations: PanelInvitation[];
  onRespondInvitation: (shareId: string, decision: "accepted" | "rejected", kind?: "panel_share" | "server_user_share" | "group") => void;
  token: string;
  taxonomy?: PanelTaxonomy["categories"];
  sshKeys?: SshKeySummary[];
  refreshTaxonomy?: () => Promise<void>;
  refreshSshKeys?: () => Promise<void>;
  applyCategoryCreated?: (category: { id: string; name: string }) => void;
  applyCategoryRenamed?: (id: string, name: string) => void;
  applyCategoryDeleted?: (id: string) => void;
  applyTagCreated?: (categoryId: string, tag: { id: string; name: string }) => void;
  applyTagRenamed?: (id: string, name: string) => void;
  applyTagDeleted?: (id: string) => void;
  applySshKeyCreated?: (key: SshKeySummary) => void;
  applySshKeyUpdated?: (key: SshKeySummary) => void;
  applySshKeyDeleted?: (id: string) => void;
  guestMode?: boolean;
}) {
  const t = getMessages(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const rtl = isRtlLocale(language);
  const direction = getLocaleDirection(language);
  const rowDirection = getLocaleRowDirection(language);
  const textAlign = getLocaleTextAlign(language);
  const [ioModal, setIoModal] = useState<{ open: boolean; mode: "import" | "export" }>({ open: false, mode: "export" });
  const [settingsModal, setSettingsModal] = useState<"categories" | "tags" | "ssh_keys" | "integrations" | "api" | null>(null);
  const [auditModal, setAuditModal] = useState<{ open: boolean; panelId: string | null; panelName: string }>({
    open: false,
    panelId: null,
    panelName: "",
  });
  // Intercepta "audit" para su modal local; Manage Access vive en el tab Server
  // del drawer (MainScreen). El terminal nativo ("Nueva terminal", open_terminal)
  // lo monta MainScreen a nivel de pestaña para que el drawer izquierdo (tab
  // "Terminal") pueda abrirse ENCIMA de él. El resto se delega.
  const handleRowAction = (actionId: string, row: PanelRow) => {
    if (actionId === "audit") {
      setAuditModal({ open: true, panelId: row.id, panelName: row.nameLabel });
      return;
    }
    if (actionId === "support") {
      onGoSupport();
      return;
    }
    onPanelRowAction(actionId, row);
  };

  // Exportar (y el resto de acciones sensibles) ya NO se gatean aquÃ­: el 2FA es
  // opt-in por acciÃ³n (scope `export`) y lo pide el reintento central de `request`.
  const headerAnim = useEnterAnimation({ duration: 450, fromY: -12 });
  const fabAnim = useEnterAnimation({ duration: 400, delay: 200, fromY: 16 });
  const centerCtaAnim = useEnterAnimation({ duration: 420, delay: 160, fromY: 8 });
  const [pulse] = useState(() => new Animated.Value(1));
  const centerCtaSourceDark = require("../../assets/cloud-computing-dark.png");
  const centerCtaSourceLight = require("../../assets/cloud-computing-ligth.png");
  const centerCtaAssetDark = useMemo(() => Image.resolveAssetSource(centerCtaSourceDark), []);
  const centerCtaAssetLight = useMemo(() => Image.resolveAssetSource(centerCtaSourceLight), []);
  const hasPanelRecords = panelRows.length > 0;

  // Modo de vista (carousel por defecto) persistido en AsyncStorage. El carousel
  // monta el asistente IA embebido + polling del slide visible; la lista es la
  // vista plana clÃ¡sica.
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // El modelo por datos (MB) fue retirado: ya no hay wallet de datos ni aviso de
  // saldo bajo. El saldo de tokens vive en el tab "Perfil".

  // Las tarjetas de saldo se movieron al tab "Perfil" del drawer de Bitácora, así
  // que la cabecera solo tendría sentido con banners activos (invitaciones / carga),
  // hoy desactivados (`false &&`) → la cabecera NO se renderiza y el chat ocupa
  // toda la pantalla desde justo bajo la barra superior.
  const hasHeaderContent =
    (false && !guestMode && invitations.length > 0) ||
    (false && busyPanels);

  const HeroHeader = (
    <Animated.View style={[styles.header, headerAnim.style]}>
      {/* Cabecera sin barra de acciones: New/Import/Export/Usage/Integrations/API
          viven en el bottom-sheet central (swipe-up). Blog por swipe-izquierda.
          Refrescar = pull-to-refresh del carousel. */}
      {/* Las tarjetas de saldo (tokens / servidores) se movieron al tab "Perfil"
          del drawer de Bitácora para dar más alto al chat del asistente. */}

      {false && !guestMode && invitations.length > 0 ? (
        <View style={[styles.inviteBanner, { backgroundColor: tokens.brandDim, borderColor: tokens.borderBrand }]}>
          <Text style={[styles.inviteTitle, { color: tokens.textPrimary, textAlign }]}>
            {t.dashboard.pendingInvitations}
          </Text>
          {invitations.map((invite) => (
            <View key={invite.id} style={[styles.inviteRow, { flexDirection: rowDirection }]}>
              <Text numberOfLines={1} style={{ color: tokens.textSecondary, fontSize: 13, flex: 1, textAlign }}>
                {invite.kind === "group"
                  ? `${t.sharing.groupPrefix}: ${invite.groupName || invite.panelName}`
                  : invite.kind === "server_user_share"
                    ? `${invite.panelName}${invite.linuxUsername ? ` Â· ${invite.linuxUsername}` : ""}`
                    : invite.panelName}
                {" Â· "}{invite.owner.name || invite.owner.email || t.dashboard.invitationOwnerFallback}
              </Text>
              <View style={{ flexDirection: rowDirection, gap: 6 }}>
                <Button
                  variant="primary"
                  size="sm"
                  label={t.common.accept}
                  onPress={() => onRespondInvitation(invite.id, "accepted", invite.kind)}
                />
                <Button
                  variant="danger"
                  size="sm"
                  label={t.common.reject}
                  onPress={() => onRespondInvitation(invite.id, "rejected", invite.kind)}
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {false && busyPanels ? (
        <View style={[styles.busyRow, { backgroundColor: tokens.bgCard, borderColor: tokens.border, flexDirection: rowDirection }]}>
          <ActivityIndicator color={tokens.brand} size="small" />
          <Text style={{ color: tokens.textMuted, fontSize: 13, textAlign }}>{t.dashboard.loadingPanel}</Text>
        </View>
      ) : null}
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: "transparent", direction }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LoginBackground theme={theme} />
      {hasHeaderContent ? HeroHeader : null}
      <View style={styles.content}>
        <PanelCardGrid
          data={panelRows}
          language={language}
          viewMode="carousel"
          metrics={panelMetrics}
          favorites={favorites}
          onActivePanelChange={onActiveServerPanelChange}
          palettePanelId={palettePanelId}
          focusPanelId={focusPanelId}
          onFocusHandled={onFocusHandled}
          onMetricsRefresh={onRefreshPanels}
          token={token}
          noData={false}
          onRowAction={handleRowAction}
          onOpenModulePicker={onOpenModulePicker}
          loading={busyPanels}
          refreshing={busyPanels}
          onRefresh={onRefreshPanels}
          ListHeaderComponent={null}
          ListFooterComponent={null}
          guestMode={guestMode}
          externalSearch={searchValue}
          onExternalSearchChange={onSearchChange}
          externalFiltersOpenSignal={openFiltersSignal}
          onActiveFilterCountChange={onFilterCountChange}
          hideInternalControls
          emptyComponent={(
            <View style={styles.emptyCentered}>
              <Animated.View style={centerCtaAnim.style}>
                <Animated.View style={{ transform: [{ scale: pulse }] }}>
                  {theme === "dark" ? (
                    <Pressable
                      key="dashboard-cta-dark"
                      onPress={onOpenCreatePanel}
                      style={[styles.centerCtaBtn, styles.centerCtaBtnDark]}
                      accessibilityLabel={t.dashboard.newConnection}
                      android_ripple={{ color: "transparent" }}
                    >
                      <Image
                        source={centerCtaSourceDark}
                        style={{ width: centerCtaAssetDark.width, height: centerCtaAssetDark.height, borderRadius: 999 }}
                        resizeMode="cover"
                        fadeDuration={0}
                      />
                    </Pressable>
                  ) : (
                    <Pressable
                      key="dashboard-cta-light"
                      onPress={onOpenCreatePanel}
                      style={[styles.centerCtaBtn, styles.centerCtaBtnLight]}
                      accessibilityLabel={t.dashboard.newConnection}
                      android_ripple={{ color: "transparent" }}
                    >
                      <Image
                        source={centerCtaSourceLight}
                        style={{ width: centerCtaAssetLight.width, height: centerCtaAssetLight.height, borderRadius: 999 }}
                        resizeMode="cover"
                        fadeDuration={0}
                      />
                    </Pressable>
                  )}
                </Animated.View>
              </Animated.View>
            </View>
          )}
        />
      </View>

      {false ? (
        <Animated.View style={[styles.fabStack, rtl ? styles.fabStackRtl : null, fabAnim.style]} pointerEvents="box-none">
          {!guestMode ? (
            <View style={styles.fabVerticalTop}>
              <IconButton
                shape="round"
                size={44}
                variant="secondary"
                style={styles.fabShadow}
                onPress={() => setSettingsModal("categories")}
                accessibilityLabel={t.dataTableSettings.tabs.categories}
                icon={<FolderTree size={18} />}
              />
              <IconButton
                shape="round"
                size={44}
                variant="secondary"
                style={styles.fabShadow}
                onPress={() => setSettingsModal("tags")}
                accessibilityLabel={t.dataTableSettings.tabs.tags}
                icon={<Tags size={18} />}
              />
              {hasPanelRecords ? (
                // Exportar siempre disponible; el 2FA (si el usuario activÃ³ el
                // scope `export`) lo pide el reintento central al exportar.
                <IconButton
                  shape="round"
                  size={44}
                  variant="secondary"
                  style={styles.fabShadow}
                  onPress={() => setIoModal({ open: true, mode: "export" })}
                  accessibilityLabel={t.dashboard.exportTitle}
                  icon={<Download size={18} />}
                />
              ) : null}
              {/* SSH y API debajo del botÃ³n Exportar (misma columna derecha). */}
              <IconButton
                shape="round"
                size={44}
                variant="secondary"
                style={styles.fabShadow}
                onPress={() => setSettingsModal("ssh_keys")}
                accessibilityLabel={t.dataTableSettings.tabs.sshKeys}
                icon={<Lock size={18} />}
              />
              {hasPanelRecords ? (
                <IconButton
                  shape="round"
                  size={44}
                  variant="secondary"
                  style={styles.fabShadow}
                  onPress={() => setSettingsModal("api")}
                  accessibilityLabel={t.dataTableSettings.tabs.api}
                  icon={<KeyRound size={18} />}
                />
              ) : null}
            </View>
          ) : null}
          {hasPanelRecords ? (
            <IconButton
              shape="round"
              size={52}
              variant="primary"
              style={styles.fabPrimaryShadow}
              onPress={onOpenCreatePanel}
              accessibilityLabel={t.dashboard.newConnection}
              icon={<Plus size={20} />}
            />
          ) : null}
        </Animated.View>
      ) : null}
      {/* Import/Export ahora son tabs del bottom-sheet central (swipe-up). */}
      {!guestMode ? (
        <AuditModal
          open={auditModal.open}
          panelId={auditModal.panelId}
          panelName={auditModal.panelName}
          token={token}
          language={language}
          onClose={() => setAuditModal((prev) => ({ ...prev, open: false }))}
        />
      ) : null}
      {/* Manage Access (ServerSharingModal) vive ahora en el tab Server del drawer
          izquierdo (MainScreen). */}
      {/* SSH/Categorías/Tags viven en el drawer izquierdo; Integraciones/API en el
          bottom-sheet central. El modal de ajustes (gear) se eliminó. */}

      {/* El terminal nativo ("Nueva terminal") se monta en MainScreen a nivel de
          pestaña (no aquí) para que el drawer izquierdo pueda abrirse encima. */}
    </KeyboardAvoidingView>
  );
}

