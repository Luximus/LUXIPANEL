import React from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { styles } from "./TitleBarTabs.styles";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, LifeBuoy, Paperclip, Search, Send, Server, SlidersHorizontal, Store } from "lucide-react-native";
import { getLocaleDirection, getLocaleRowDirection, getLocaleTextAlign, getMessages, isRtlLocale } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { Avatar } from "./ui/Avatar";
import { useAuth } from "../context/useAuth";

export function TitleBarTabs({
  onGoServers,
  onGoSupport,
  onGoPayments,
  language,
  activeView,
  displayName,
  onOpenAccount,
  guestMode = false,
  searchValue = "",
  onSearchChange,
  onOpenFilters,
  filterCount = 0,
  searchPlaceholder,
  showSearchControls = false,
  ticketDetailControls,
  webview = false,
}: {
  /** Navega a la pantalla de servidores (botón del nav inferior en Datos y tokens). */
  onGoServers?: () => void;
  /** Navega a la pantalla de soporte (botón del nav inferior en Datos y tokens). */
  onGoSupport?: () => void;
  onGoPayments?: () => void;
  language?: string;
  activeView?: string;
  displayName: string;
  onOpenAccount: () => void;
  guestMode?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onOpenFilters?: () => void;
  filterCount?: number;
  searchPlaceholder?: string;
  showSearchControls?: boolean;
  webview?: boolean;
  ticketDetailControls?: {
    onBack?: () => void;
    onAttach?: () => void;
    onSend?: () => void;
    attachDisabled?: boolean;
    sendDisabled?: boolean;
    counterLabel?: string;
  };
}) {
  const t = getMessages(language);
  const rtl = isRtlLocale(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const searchControlBg = theme === "dark" ? tokens.bgCardSolid : tokens.bgInput;
  const searchControlText = theme === "dark" ? "#d7e2ff" : tokens.textPrimary;
  const searchControlMuted = theme === "dark" ? "#9aa8c7" : tokens.textMuted;
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12);
  const { userEmail, savedAccounts } = useAuth();
  const currentAccount = userEmail ? savedAccounts.find((entry) => entry.email === userEmail) : null;

  const ticketMode = Boolean(ticketDetailControls);

  // En la pantalla de pagos (Datos y tokens) la barra inferior actúa como nav:
  // muestra accesos a Servidores, Soporte y Tienda con icono + texto (en el
  // resto de vistas el botón de tienda queda solo como icono y el centro lo
  // ocupan los controles de búsqueda).
  const paymentsNav = !ticketMode && activeView === "payments";
  const navItems: Array<{
    key: string;
    label: string;
    renderIcon: (color: string) => React.ReactNode;
    onPress?: () => void;
    active: boolean;
  }> = [
    { key: "servers", label: t.titleBar.fabServers, renderIcon: (c) => <Server size={17} color={c} />, onPress: onGoServers, active: false },
    { key: "support", label: t.titleBar.fabSupport, renderIcon: (c) => <LifeBuoy size={17} color={c} />, onPress: onGoSupport, active: false },
    { key: "store", label: t.titleBar.fabStore, renderIcon: (c) => <Store size={17} color={c} />, onPress: onGoPayments, active: true },
  ];

  // Pantalla webview (vista "ssh"): sin barra propia. El gestor de pestañas vive
  // ahora en el tab "Pestañas" del drawer derecho; en webview se abre con el
  // acceso de borde de `SshScreen` (puente `open-panel-tabs`).
  if (webview) {
    return null;
  }

  return (
    <View
      style={[
        styles.bar,
        {
          borderTopColor: tokens.border,
          backgroundColor: tokens.bgPrimary,
          paddingBottom: bottomInset,
          // minHeight (no height fijo): en modo composer el bar crece hacia arriba
          // para alojar las filas de adjuntos debajo del input.
          minHeight: 56 + bottomInset,
          direction: getLocaleDirection(language),
          flexDirection: getLocaleRowDirection(language),
        },
      ]}
    >
      {paymentsNav ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.paymentsNavScroll}
          contentContainerStyle={[styles.paymentsNavContent, { flexDirection: getLocaleRowDirection(language) }]}
        >
          {navItems
            .filter((item) => Boolean(item.onPress))
            .map((item) => {
              const color = item.active ? "#fff" : tokens.textSecondary;
              return (
                <Pressable
                  key={item.key}
                  onPress={item.onPress}
                  accessibilityLabel={item.label}
                  style={[
                    styles.navPill,
                    {
                      backgroundColor: item.active ? tokens.brand : tokens.bgCardSolid,
                      borderColor: item.active ? tokens.brand : tokens.border,
                      flexDirection: getLocaleRowDirection(language),
                    },
                  ]}
                >
                  {item.renderIcon(color)}
                  <Text numberOfLines={1} style={[styles.navPillLabel, { color }]}>{item.label}</Text>
                </Pressable>
              );
            })}
        </ScrollView>
      ) : !ticketMode ? (
        <Pressable
          onPress={onGoPayments}
          accessibilityLabel={t.payments.title}
          style={[
            styles.logoBtn,
            {
              backgroundColor: activeView === "payments" ? tokens.brand : tokens.bgCardSolid,
              borderColor: activeView === "payments" ? tokens.brand : tokens.border,
            },
          ]}
        >
          <Store size={22} color={activeView === "payments" ? "#fff" : tokens.textSecondary} />
        </Pressable>
      ) : null}

      {ticketMode ? (
        <View style={styles.selectorArea}>
          <Pressable
            onPress={ticketDetailControls?.onBack}
            style={[styles.layoutBtn, styles.ticketBackBtn, { borderColor: "#c93c3c", backgroundColor: "#c93c3c" }]}
          >
            <ArrowLeft size={16} color="#fff" />
          </Pressable>
        </View>
      ) : null}
      {ticketMode ? (
        <View style={[styles.ticketControls, { flexDirection: getLocaleRowDirection(language) }]}>
          <Pressable
            onPress={ticketDetailControls?.onAttach}
            disabled={ticketDetailControls?.attachDisabled}
            style={[styles.ticketIconBtn, { borderColor: tokens.border, backgroundColor: tokens.bgInput, opacity: ticketDetailControls?.attachDisabled ? 0.5 : 1 }]}
          >
            <Paperclip size={16} color={tokens.textSecondary} />
          </Pressable>
          <View style={styles.ticketCounterSpace}>
            <Text style={[styles.ticketCounterText, { color: tokens.textMuted }]}>
              {ticketDetailControls?.counterLabel ?? ""}
            </Text>
          </View>
          <Pressable
            onPress={ticketDetailControls?.onSend}
            disabled={ticketDetailControls?.sendDisabled}
            style={[styles.ticketIconBtn, { borderColor: tokens.brand, backgroundColor: tokens.brand, opacity: ticketDetailControls?.sendDisabled ? 0.6 : 1 }]}
          >
            <Send size={16} color="#fff" />
          </Pressable>
        </View>
      ) : showSearchControls ? (
        <View style={[styles.searchControls, { flexDirection: getLocaleRowDirection(language) }]}>
          <View style={[styles.searchBox, { borderColor: tokens.border, backgroundColor: searchControlBg, flexDirection: getLocaleRowDirection(language) }]}>
            <Search size={15} color={searchControlMuted} />
            <TextInput
              value={searchValue}
              onChangeText={onSearchChange}
              placeholder={searchPlaceholder}
              placeholderTextColor={searchControlMuted}
              style={[styles.searchInput, { color: searchControlText, textAlign: getLocaleTextAlign(language) }]}
              autoCapitalize="none"
            />
          </View>
        </View>
      ) : paymentsNav ? null : (
        <View style={styles.searchControls} />
      )}
      {!ticketMode && showSearchControls ? (
        <Pressable
          onPress={onOpenFilters}
          style={[styles.filterBtn, { borderColor: tokens.border, backgroundColor: searchControlBg }]}
        >
          <SlidersHorizontal size={16} color={filterCount > 0 ? tokens.brand : searchControlMuted} />
          {filterCount > 0 ? (
            <View style={[styles.filterBadge, { backgroundColor: tokens.brand }]}>
              <Text style={styles.filterBadgeText}>{filterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
      {!ticketMode ? (
        <View style={[styles.rightCluster, rtl ? styles.rightClusterRtl : null]}>
          <Pressable
            onPress={onOpenAccount}
            style={[styles.accountBtn, { borderColor: tokens.border }]}
            accessibilityLabel={displayName}
          >
            <Avatar
              photoURL={currentAccount?.photoURL ?? null}
              displayName={displayName}
              size={46}
              bordered={false}
            />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
