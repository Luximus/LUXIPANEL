import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { styles as storeStyles } from "../../screens/PaymentsScreen.styles";
import { getTokenBalance, type TokenBalance } from "../../api/billing";
import { getLocaleRowDirection, getLocaleTextAlign, getMessages } from "../../i18n";
import { useTheme } from "../../hooks/useTheme";
import { usePullRefresh } from "../../hooks/usePullRefresh";
import { getThemeTokens } from "../../theme/colors";
import type { ThemeMode } from "../../features/app/types";
import { AccountInfoPanel } from "./AccountInfoModal";
import { SegmentedControl } from "../ui/SegmentedControl";
import WorklogTab from "./WorklogTab";
import { SecurityTab } from "./SecurityTab";
import { PayoutSection } from "./PayoutSection";


/** Sub-tabs internos del tab "Perfil" del drawer derecho. "info" (Información) es
 *  el primero y muestra saldos + datos personales; los demás incrustan lo que
 *  antes eran tabs de primer nivel del drawer (Bitácora/Seguridad/Pagos). */
export type ProfileSubTab = "info" | "worklog" | "security" | "payments";

/**
 * Tab "Perfil" del drawer derecho: ahora un contenedor con sub-tabs
 * (Información · Bitácora · Seguridad · Pagos). El sub-tab "Información" reúne las
 * 4 tarjetas de saldo (total disponible, bono mensual, tokens, servidores) y el
 * panel de datos personales (perfil/avatar/idioma/eliminar cuenta); los demás
 * incrustan el contenido que antes vivía como tabs de primer nivel del drawer.
 */
export default function ProfileTab({
  visible,
  token,
  language,
  setLanguage,
  displayName,
  logout,
  serverCount,
  balancesVersion = 0,
  switchAccount,
  toggleTheme,
  theme,
  onClose,
  onSupport,
  subTab,
  onSubTabChange,
}: {
  visible: boolean;
  token: string;
  language: string;
  setLanguage: (next: string) => void;
  displayName: string;
  logout: () => Promise<void>;
  serverCount: number;
  balancesVersion?: number;
  switchAccount: () => Promise<void>;
  toggleTheme: () => void;
  theme: ThemeMode;
  onClose: () => void;
  /** Abre el soporte desde el pie de "Información" (botón movido del ChatTopBar). */
  onSupport?: () => void;
  subTab: ProfileSubTab;
  onSubTabChange: (next: ProfileSubTab) => void;
}) {
  const t = getMessages(language);
  const { theme: themeMode } = useTheme();
  const tokens = getThemeTokens(themeMode === "dark");
  const rowDirection = getLocaleRowDirection(language);
  const textAlign = getLocaleTextAlign(language);
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(null);

  // Carga del saldo de tokens (tarjeta del sub-tab "Información"). Reutilizada por
  // el efecto inicial y por el pull-to-refresh. El modelo por datos (MB) fue
  // retirado: ya no hay wallet de datos.
  const loadBalances = useCallback(async () => {
    if (!token) return;
    setTokenBalance(await getTokenBalance(token));
  }, [token]);

  useEffect(() => {
    if (!visible || !token || subTab !== "info") return;
    loadBalances().catch(() => { /* best-effort: si falla no mostramos saldo */ });
  }, [visible, token, balancesVersion, subTab, loadBalances]);

  // Pull-to-refresh por sub-tab. "Información" recarga saldos directo; "Seguridad"
  // y "Pagos" delegan en la recarga forzada que sus hijos registran (sus datos
  // viven en SecurityTab / PayoutSection).
  const securityReloadRef = useRef<(() => Promise<void>) | null>(null);
  const payoutReloadRef = useRef<(() => Promise<void>) | null>(null);
  const infoRefresh = usePullRefresh(loadBalances);
  const securityRefresh = usePullRefresh(() => securityReloadRef.current?.() ?? Promise.resolve());
  const payoutRefresh = usePullRefresh(() => payoutReloadRef.current?.() ?? Promise.resolve());

  return (
    <View style={subStyles.root}>
      {/* Sub-tabs del Perfil: Información (datos personales + saldos) primero,
          luego Bitácora · Seguridad · Pagos. El contenido de abajo se adapta. */}
      <View style={[subStyles.tabsWrap, { borderBottomColor: tokens.border }]}>
        <SegmentedControl
          scroll
          items={[
            { key: "info", label: t.account.tabInfo },
            { key: "worklog", label: t.account.tabWorklog },
            { key: "security", label: t.account.tabSecurity },
            { key: "payments", label: t.account.tabPayments },
          ]}
          value={subTab}
          onChange={(k) => onSubTabChange(k as ProfileSubTab)}
        />
      </View>

      {subTab === "info" ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={infoRefresh.refreshing} onRefresh={infoRefresh.onRefresh} tintColor={tokens.brand} colors={[tokens.brand]} />}
        >
          {/* Las 4 tarjetas de saldo usan EXACTAMENTE el estilo "glance" de la
              Tienda (PaymentsScreen.styles): mismo contenedor, etiqueta y tamaños
              de fuente del valor. */}
          <View style={[storeStyles.glanceRow, { flexDirection: rowDirection }]}>
            <View style={[storeStyles.glanceCard, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}>
              <Text style={[storeStyles.glanceLabel, { color: tokens.textMuted, textAlign }]} numberOfLines={2}>{t.payments.tokenBalance}</Text>
              <Text style={[storeStyles.glanceValue, { color: tokens.textPrimary, textAlign }]} numberOfLines={1}>{tokenBalance === null ? "-" : tokenBalance.available.toLocaleString(language)}</Text>
            </View>
            <View style={[storeStyles.glanceCard, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}>
              <Text style={[storeStyles.glanceLabel, { color: tokens.textMuted, textAlign }]} numberOfLines={2}>{t.dashboard.totalServers}</Text>
              <Text style={[storeStyles.glanceValue, { color: tokens.textPrimary, textAlign }]} numberOfLines={1}>{serverCount}</Text>
            </View>
          </View>

      {/* Las acciones de cuenta (usar otra cuenta, tema claro/oscuro, eliminar
          cuenta y cerrar sesión) viven ahora DENTRO de `AccountInfoPanel`, en sus
          filas combinadas (Idioma + Usar otra cuenta · Tema + Eliminar + Salir). */}
          <AccountInfoPanel
            visible={visible}
            onClose={onClose}
            language={language}
            setLanguage={setLanguage}
            displayName={displayName}
            token={token}
            logout={logout}
            switchAccount={switchAccount}
            toggleTheme={toggleTheme}
            onSupport={onSupport}
          />
        </ScrollView>
      ) : null}

      {subTab === "worklog" ? (
        <WorklogTab visible={visible && subTab === "worklog"} token={token} language={language} />
      ) : null}

      {subTab === "security" ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 12 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={securityRefresh.refreshing} onRefresh={securityRefresh.onRefresh} tintColor={tokens.brand} colors={[tokens.brand]} />}
        >
          <SecurityTab language={language} token={token} onRegisterReload={(fn) => { securityReloadRef.current = fn; }} />
        </ScrollView>
      ) : null}

      {subTab === "payments" ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 12 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={payoutRefresh.refreshing} onRefresh={payoutRefresh.onRefresh} tintColor={tokens.brand} colors={[tokens.brand]} />}
        >
          <PayoutSection language={language} token={token} onRegisterReload={(fn) => { payoutReloadRef.current = fn; }} />
        </ScrollView>
      ) : null}
    </View>
  );
}

const subStyles = StyleSheet.create({
  root: { flex: 1 },
  tabsWrap: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 1 },
});
