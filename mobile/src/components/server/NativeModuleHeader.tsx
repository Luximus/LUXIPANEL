import { nativeText } from '../../i18n/native-text';
import React, { useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { ChevronLeft, RefreshCw, Settings, X } from "lucide-react-native";
import { PanelText as Text } from "../ui/PanelText";
import { ModuleUiContext, useModuleUi } from "../ui/ModuleUi";
import type { SegmentItem } from "../ui/SegmentedControl";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../../theme/colors";
import { getMessages } from "../../i18n";
import { loadSessionState } from "../../lib/session-state";

/** The compact Users/Groups toolbar shared by every server module. */
export function NativeModuleHeader({ title, subtitle, tabs, activeTab, onTabChange, onClose, closeLabel, onSettings, onRefresh, refreshing, actions, backButton = false }: {
  title: string; subtitle?: string; tabs?: SegmentItem[]; activeTab?: string; onTabChange?: (key: string) => void;
  onClose: () => void; closeLabel?: string; onSettings?: () => void; onRefresh?: () => void; refreshing?: boolean; actions?: React.ReactNode; backButton?: boolean;
}) {
  const tokens = getThemeTokens(useTheme().theme === "dark");
  const moduleUi = useModuleUi();
  const { width } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const language = loadSessionState().language;
  const hasTabs = !!tabs?.length && !!onTabChange;
  const hasActions = !!actions || !!onSettings || !!onRefresh;
  const stacked = (measuredWidth ?? width) <= 640 && hasActions;
  const settingsLabel = language.startsWith("es") ? nativeText("Configuración") : nativeText("Settings");
  const CloseIcon = backButton ? ChevronLeft : X;
  const close = <Pressable accessibilityRole="button" accessibilityLabel={closeLabel ?? getMessages(language).common.close} onPress={() => { Keyboard.dismiss(); onClose(); }} style={styles.close}><CloseIcon size={17} color={tokens.textMuted} /></Pressable>;
  const controls = <View testID="module-header-actions" style={[styles.actions, !stacked && { maxWidth: "65%" }]}>
    {actions ? <ScrollView horizontal style={{ flex: stacked ? 1 : undefined, flexShrink: 1, minWidth: 0 }} contentContainerStyle={styles.actionContent} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">{actions}</ScrollView> : <View style={{ flex: stacked ? 1 : undefined }} />}
    {onSettings ? <Pressable accessibilityRole="button" accessibilityLabel={settingsLabel} onPress={onSettings} style={[styles.settings, { backgroundColor: tokens.bgSecondary, borderColor: tokens.border }]}><Settings size={12} color={tokens.textSecondary} /><Text style={[styles.label, { color: tokens.textSecondary }]}>{settingsLabel}</Text></Pressable> : null}
    {onRefresh ? <Pressable accessibilityRole="button" accessibilityLabel={language.startsWith("es") ? nativeText("Actualizar") : nativeText("Refresh")} accessibilityState={{ disabled: !!refreshing, busy: !!refreshing }} disabled={refreshing} onPress={onRefresh} style={[styles.refresh, { borderColor: tokens.border }]}>{refreshing ? <ActivityIndicator size="small" color={tokens.brand} /> : <RefreshCw size={13} color={tokens.textMuted} />}</Pressable> : null}
  </View>;
  return <ModuleUiContext.Provider value={true}><View testID="native-module-header" accessibilityLabel={title} onLayout={event => setMeasuredWidth(event.nativeEvent.layout.width)} style={[styles.header, { backgroundColor: tokens.bgCardSolid, borderBottomColor: tokens.border }]}>
    <View style={[styles.row, { minHeight: stacked ? 36 : 44 }]}>
      {backButton ? close : null}
      {hasTabs ? <ScrollView horizontal accessibilityRole="tablist" accessibilityLabel={title} style={styles.tabs} contentContainerStyle={styles.tabContent} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {tabs!.map(tab => {
          const active = tab.key === activeTab;
          return <Pressable key={tab.key} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: active }}
            onPress={() => { Keyboard.dismiss(); onTabChange!(tab.key); }} style={[styles.tab, { borderColor: active ? tokens.border : "transparent", backgroundColor: active ? tokens.bgSecondary : "transparent" }]}>
            {tab.icon ? React.cloneElement(tab.icon as React.ReactElement<{ color?: string; size?: number }>, { size: 13, color: active ? tokens.textPrimary : tokens.textMuted }) : null}
            <Text numberOfLines={1} style={[styles.label, { color: active ? tokens.textPrimary : tokens.textMuted }]}>{tab.label}</Text>
            {tab.count !== undefined ? <View style={[styles.badge, { backgroundColor: withAlpha(active ? tokens.brand : tokens.textMuted, active ? 0.22 : 0.1) }]}><Text style={{fontSize:9,color:active?tokens.textPrimary:tokens.textMuted}}>{tab.count}</Text></View> : null}
          </Pressable>;
        })}
      </ScrollView> : <View style={styles.heading}><Text numberOfLines={1} accessibilityRole="header" style={[styles.title, { color: tokens.textPrimary }]}>{title}</Text>{subtitle && !moduleUi ? <Text numberOfLines={1} style={{fontSize:10,color:tokens.textMuted}}>{subtitle}</Text> : null}</View>}
      {!stacked && hasActions ? controls : null}
      {!backButton ? close : null}
    </View>
    {stacked ? controls : null}
  </View></ModuleUiContext.Provider>;
}
const styles = StyleSheet.create({
  header: { flexShrink: 0, borderBottomWidth: 1, paddingHorizontal: 10, paddingBottom: 3 },
  row: { flexDirection: "row", alignItems: "center", gap: 4 }, heading: { flex: 1, minWidth: 0 },
  title: { fontSize: 12, fontWeight: "600" }, label: { fontSize: 10, fontWeight: "500" },
  tabs: { flex: 1, minWidth: 0 }, tabContent: { gap: 4, alignItems: "center" },
  tab: { minHeight: 30, borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, flexDirection: "row", alignItems: "center", gap: 5 },
  badge: { minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, minHeight: 30, flexShrink: 1, minWidth: 0 },
  actionContent: { flexDirection: "row", alignItems: "center", gap: 4 },
  settings: { minHeight: 28, paddingHorizontal: 8, borderRadius: 5, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  refresh: { width: 28, height: 28, borderWidth: 1, borderRadius: 5, alignItems: "center", justifyContent: "center" },
  close: { width: 30, height: 36, alignItems: "center", justifyContent: "center", flexShrink: 0 },
});
