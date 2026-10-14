import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import type { PaymentRow, ProductRow } from "../api/client";
import type { TokenPack } from "../api/billing";
import type { AppTab, ThemeMode } from "../features/app/types";
import { getMessages } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { SegmentedControl } from "./ui/SegmentedControl";
import { TabsManagerPanel } from "./TabsManagerPanel";
import { GuestConnectionsPanel } from "./GuestConnectionsPanel";
import type { GuestEntry } from "../storage/guestHistory";
import type { PanelRow } from "../features/app/viewModels";
import ProfileTab, { type ProfileSubTab } from "./account/ProfileTab";
export type { ProfileSubTab } from "./account/ProfileTab";
import { PaymentsPanel } from "../screens/PaymentsModal";
import { BlogReaderScreen } from "../screens/BlogReaderScreen";
import { JobsScreen } from "../screens/JobsScreen";
import { PublicacionesScreen } from "../screens/PublicacionesScreen";
import { AssistantSettingsTab } from "./assistant-settings";

/** Tabs de primer nivel del drawer derecho. Bitácora/Seguridad/Pagos ya NO son
 *  de primer nivel: ahora son sub-tabs dentro de "profile" (Perfil).
 *  "assistant-settings" replica el AssistantSettingsModal de LUXIPANEL (Fase 4). */
export type BlogDrawerTab = "tabs" | "store" | "profile" | "blog" | "assistant-settings";

/** Sub-tabs del tab "Comunidad" (antes "Blog"). "Publicaciones" es placeholder;
 *  "Empleo" embebe la pantalla de Empleo (JobsScreen, compact) y "Blog" embebe el
 *  feed social. Ambos viven DENTRO del tab, sin abrir otra vista. */
type CommunitySubTab = "posts" | "jobs" | "blog";

/** Orden de los tabs del drawer (para navegación por swipe): Comunidad · Perfil ·
 *  Tienda · Conexiones. "tabs" (gestor de pestañas, etiquetado "Conexiones") sigue
 *  siendo el tab por defecto al abrir el drawer aunque ahora va al final. */
export const BLOG_DRAWER_TABS: BlogDrawerTab[] = ["blog", "profile", "assistant-settings", "store", "tabs"];

/** Gestión de pestañas (global de `MainScreen`) para el tab "Pestañas" del
 *  drawer; reemplaza al antiguo modal de pestañas del navbar. */
export type DrawerTabsData = {
  tabs: AppTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onSelectServers: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onRenameTab: (tabId: string, label: string) => void;
  onOpenNewTab: () => void;
  canOpenNewTab: boolean;
};

/** Datos del controlador (de la pestaña activa) que necesitan los paneles del
 *  drawer; reportados por `MainTab` vía `registerProfile`. */
export type DrawerData = {
  token: string;
  setLanguage: (next: string) => void;
  logout: () => Promise<void>;
  displayName: string;
  /** Identidad del usuario actual: habilita borrar las propias publicaciones y el avatar del composer en el muro embebido. */
  currentUserId?: string | null;
  photoURL?: string | null;
  serverCount: number;
  balancesVersion: number;
  isAdmin: boolean;
  paymentRows: PaymentRow[];
  productRows: ProductRow[];
  busyPayments: boolean;
  refreshPayments: () => Promise<void> | void;
  purchasePlan: (productId: string, platform: "ios" | "android") => void;
  purchaseTokenPack: (pack: TokenPack) => void;
  iapReady: boolean;
  tokenPurchaseSignal: number;
  switchAccount: () => Promise<void>;
  toggleTheme: () => void;
  theme: ThemeMode;
  /** Conexiones de invitado (solo modo invitado): lista + handlers. */
  guestEntries?: GuestEntry[];
  guestPanelRows?: PanelRow[];
  /** Panel visible/activo en el carousel: su tarjeta de conexión se resalta. */
  guestActivePanelId?: string | null;
  onGuestAdd?: () => void;
  onGuestRemove?: (key: string) => void;
  onGuestSelect?: (panelId: string | null) => void;
  /** Panel/servidor activo cuyo asistente IA configura el tab "Asistente"
   *  (Fase 4). Sin él, el tab muestra un placeholder "conecta un servidor". */
  assistantPanelId?: string | null;
  /** Abre la pantalla `Chat` del panel (fase A5): lo usa "Iniciar chat" con un
   *  agente desde el tab "Asistente". */
  onOpenAssistantChat?: (panelId: string) => void;
};

/**
 * Contenido del drawer derecho: strip de tabs (Comunidad · Perfil · Tienda · Conexiones)
 * + botón de cierre. Bitácora/Seguridad/Pagos ya no son tabs de primer nivel: son
 * sub-tabs dentro de "Perfil" (junto a "Información"). El shell animado + la
 * navegación por swipe entre tabs los aporta `MainScreen`.
 */
export default function BlogDrawerContent({
  visible,
  tab,
  onTabChange,
  onClose,
  onSupport,
  jobsEnabled,
  language,
  chromeInNavbar = false,
  tabsData,
  token,
  setLanguage,
  displayName,
  currentUserId,
  photoURL,
  logout,
  serverCount,
  balancesVersion,
  isAdmin,
  paymentRows,
  productRows,
  busyPayments,
  refreshPayments,
  purchasePlan,
  purchaseTokenPack,
  iapReady,
  tokenPurchaseSignal,
  switchAccount,
  toggleTheme,
  theme,
  profileSubTab,
  onProfileSubTabChange,
  guestMode = false,
  guestEntries,
  guestPanelRows,
  guestActivePanelId,
  onGuestSelect,
  onGuestRemove,
  onGuestAdd,
  assistantPanelId,
  onOpenAssistantChat,
}: {
  visible: boolean;
  tab: BlogDrawerTab;
  onTabChange: (tab: BlogDrawerTab) => void;
  onClose: () => void;
  /** Abre el soporte desde el pie del tab "Perfil" (botón movido del ChatTopBar).
   *  Ausente en modo invitado → el botón no se muestra. */
  onSupport?: () => void;
  /** Habilita el sub-tab "Empleo" dentro de Comunidad (embebe `JobsScreen`).
   *  `false`/ausente en modo invitado → el sub-tab "Empleo" no se muestra. */
  jobsEnabled?: boolean;
  language: string;
  /** El cromo (tabs + cerrar) vive en el `DrawerTopBar` del navbar: oculta el
   *  header interno y deja solo el cuerpo del tab activo. */
  chromeInNavbar?: boolean;
  /** Gestión de pestañas para el tab "Pestañas" (global de MainScreen). */
  tabsData: DrawerTabsData;
  /** Sub-tab activo dentro de "Perfil" (Información/Bitácora/Seguridad/Pagos),
   *  controlado por `MainScreen` (estado de UI del drawer, no del controlador). */
  profileSubTab: ProfileSubTab;
  onProfileSubTabChange: (next: ProfileSubTab) => void;
  /** Modo invitado: el drawer derecho muestra SOLO las conexiones de invitado
   *  (Perfil/Tienda/Comunidad no aplican). Los datos/handlers (guestEntries/onGuest*)
   *  viajan en el bundle `DrawerData` (registerProfile); aquí solo el flag. */
  guestMode?: boolean;
} & DrawerData) {
  const t = getMessages(language);
  const { theme: themeMode } = useTheme();
  const tokens = getThemeTokens(themeMode === "dark");

  // Sub-tab activo de "Comunidad". Vuelve al primero ("Publicaciones") cada vez
  // que se cambia de tab de primer nivel: un tab con sub-tabs debe reabrirse en su
  // primer sub-tab, igual que el resto de drawers.
  const [communitySubTab, setCommunitySubTab] = useState<CommunitySubTab>("posts");
  useEffect(() => {
    setCommunitySubTab("posts");
  }, [tab]);

  return (
    <View style={[styles.root, { backgroundColor: tokens.bgPrimary }]}>
      {/* Solo los tabs: sin botón de cerrar. El drawer se cierra tocando el
          backdrop, con swipe o con el botón atrás. */}
      {!chromeInNavbar && !guestMode ? (
        <View style={[styles.header, { borderBottomColor: tokens.border }]}>
          <View style={styles.tabsWrap}>
            <SegmentedControl
              scroll
              items={[
                { key: "blog", label: t.blogfeed.communityTitle },
                { key: "profile", label: t.account.tabProfile },
                { key: "assistant-settings", label: t.assistantSettings.tabLabel },
                { key: "store", label: t.account.store },
                { key: "tabs", label: t.titleBar.tabsLabel },
              ]}
              value={tab}
              onChange={(k) => onTabChange(k as BlogDrawerTab)}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.body}>
        {guestMode ? (
          <GuestConnectionsPanel
            language={language}
            entries={guestEntries ?? []}
            panelRows={guestPanelRows ?? []}
            activePanelId={guestActivePanelId}
            onSelect={(panelId) => onGuestSelect?.(panelId)}
            onRemove={(key) => onGuestRemove?.(key)}
            onAdd={() => onGuestAdd?.()}
          />
        ) : (
        <>
        {tab === "tabs" ? (
          <TabsManagerPanel
            language={language}
            tabs={tabsData.tabs}
            activeTabId={tabsData.activeTabId}
            onSelectTab={tabsData.onSelectTab}
            onSelectServers={tabsData.onSelectServers}
            onCloseTab={tabsData.onCloseTab}
            onRenameTab={tabsData.onRenameTab}
            onOpenNewTab={tabsData.onOpenNewTab}
            canOpenNewTab={tabsData.canOpenNewTab}
            onAfterSelect={onClose}
          />
        ) : null}

        {tab === "store" ? (
          <PaymentsPanel
            visible={visible && tab === "store"}
            language={language}
            token={token}
            payments={paymentRows}
            busy={busyPayments}
            onRefresh={() => void refreshPayments()}
            onBuyTokenPack={(pack) => purchaseTokenPack(pack)}
            iapReady={iapReady}
            tokenPurchaseSignal={tokenPurchaseSignal}
            isAdmin={isAdmin}
          />
        ) : null}

        {tab === "profile" ? (
          <ProfileTab
            visible={visible}
            token={token}
            language={language}
            setLanguage={setLanguage}
            displayName={displayName}
            logout={logout}
            serverCount={serverCount}
            balancesVersion={balancesVersion}
            switchAccount={switchAccount}
            toggleTheme={toggleTheme}
            theme={theme}
            onClose={onClose}
            onSupport={onSupport}
            subTab={profileSubTab}
            onSubTabChange={onProfileSubTabChange}
          />
        ) : null}

        {tab === "assistant-settings" ? (
          <AssistantSettingsTab
            panelId={assistantPanelId}
            token={token}
            language={language}
            onCloseDrawer={onClose}
            onOpenChat={onOpenAssistantChat}
          />
        ) : null}

        {tab === "blog" ? (
          <View style={styles.community}>
            {/* Sub-tabs de "Comunidad": Publicaciones · Empleo · Blog. Todos viven
                DENTRO del tab: "Publicaciones" embebe el muro social
                (`PublicacionesScreen` compact); "Empleo" embebe `JobsScreen`
                (compact, oculto a invitados); "Blog" embebe el lector. Ninguno
                abre otra vista. */}
            <View style={[styles.communityTabs, { borderBottomColor: tokens.border }]}>
              <SegmentedControl
                scroll
                items={[
                  { key: "posts", label: t.blogfeed.tabPosts },
                  ...(jobsEnabled ? [{ key: "jobs", label: t.blogfeed.tabJobs }] : []),
                  { key: "blog", label: t.blogfeed.screenTitle },
                ]}
                value={communitySubTab}
                onChange={(k) => setCommunitySubTab(k as CommunitySubTab)}
              />
            </View>
            <View style={styles.communityBody}>
              {communitySubTab === "blog" ? (
                <BlogReaderScreen language={language} token={token} compact />
              ) : communitySubTab === "jobs" ? (
                <JobsScreen language={language} token={token} compact />
              ) : (
                <PublicacionesScreen language={language} token={token} displayName={displayName} photoURL={photoURL} currentUserId={currentUserId} compact />
              )}
            </View>
          </View>
        ) : null}
        </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tabsWrap: { flex: 1 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
  // Tab "Comunidad": fila de sub-tabs + cuerpo del sub-tab activo.
  community: { flex: 1 },
  communityTabs: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 1 },
  communityBody: { flex: 1 },
});
