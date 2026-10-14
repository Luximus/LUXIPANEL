import React from "react";
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Bell, Search, SlidersHorizontal } from "lucide-react-native";
import { getLocaleRowDirection, getLocaleTextAlign, getMessages } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { useEnterAnimation } from "../hooks/useEnterAnimation";

/**
 * Top-bar de la vista de servidores/chat: título del servidor visible + buscador
 * (filtra el carousel) + filtros + botón de pestañas + avatar de cuenta. Recoge
 * lo que antes vivía en el navbar inferior, que ahora actúa como composer del
 * chat. Se monta a nivel `MainScreen` (uno solo, no por tarjeta).
 */
export function ChatTopBar({
  language,
  onOpenNotifications,
  searchValue,
  onSearchChange,
  onOpenFilters,
  filterCount = 0,
  searchPlaceholder,
}: {
  language?: string;
  /** Campana: abre el drawer central de notificaciones de servidores (ocupa el
   *  lugar del antiguo avatar, que se movió a la esquina inferior derecha). */
  onOpenNotifications: () => void;
  searchValue: string;
  onSearchChange?: (value: string) => void;
  onOpenFilters?: () => void;
  filterCount?: number;
  searchPlaceholder?: string;
}) {
  const t = getMessages(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const rowDirection = getLocaleRowDirection(language);
  const textAlign = getLocaleTextAlign(language);
  const notifLabel = (language ?? "es").startsWith("en") ? "Notifications" : "Notificaciones";
  const searchBg = theme === "dark" ? tokens.bgCardSolid : tokens.bgInput;
  const searchText = theme === "dark" ? "#d7e2ff" : tokens.textPrimary;
  const searchMuted = theme === "dark" ? "#9aa8c7" : tokens.textMuted;
  // Entrada suave por opacidad (sin desplazamiento, fromY: 0) cuando la barra
  // aparece (al entrar a servidores o al cerrar un drawer): aparece con fade,
  // sin moverse de sitio, para no desfasar nada.
  const enter = useEnterAnimation({ duration: 220, fromY: 0 });

  return (
    <Animated.View style={[styles.bar, { backgroundColor: tokens.bgPrimary, borderBottomColor: tokens.border, flexDirection: rowDirection }, enter.style]}>
      {/* Buscador + filtros UNIFICADOS: el botón de filtros vive DENTRO de la caja
          (mismo borde, separados por un divisor fino) para que se vean como uno. */}
      <View style={[styles.search, { borderColor: tokens.border, backgroundColor: searchBg, flexDirection: rowDirection }]}>
        <Search size={15} color={searchMuted} />
        <TextInput
          value={searchValue}
          onChangeText={onSearchChange}
          placeholder={searchPlaceholder}
          placeholderTextColor={searchMuted}
          style={[styles.searchInput, { color: searchText, textAlign }]}
          autoCapitalize="none"
        />
        <View style={[styles.searchDivider, { backgroundColor: tokens.border }]} />
        <Pressable onPress={onOpenFilters} accessibilityLabel={t.panelTable.filters.search} style={styles.filterInline}>
          <SlidersHorizontal size={16} color={filterCount > 0 ? tokens.brand : searchMuted} />
          {filterCount > 0 ? (
            <View style={[styles.filterBadge, { backgroundColor: tokens.brand }]}>
              <Text style={styles.badgeText}>{filterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Campana de notificaciones de servidores (en el lugar del antiguo avatar). */}
      <Pressable onPress={onOpenNotifications} accessibilityLabel={notifLabel} style={[styles.iconBtn, { borderColor: tokens.border, backgroundColor: searchBg }]}>
        <Bell size={18} color={tokens.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  search: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    height: 40,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: "600", padding: 0 },
  // Divisor fino + botón de filtros embebidos en la caja del buscador (1 solo bloque).
  searchDivider: { width: 1, height: 22, marginHorizontal: 2 },
  filterInline: { alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  filterBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  accountBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
