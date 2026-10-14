import { nativeText } from '../../../i18n/native-text';
import React from "react";
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Settings, X } from "lucide-react-native";
import { PanelText as Text } from "../../../components/ui/PanelText";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../../../theme/colors";
import { getMessages } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";

/** Compact two-row toolbar from the web Users/Groups drawer. */
export function UsersModuleHeader({ tabs, activeTab, onTabChange, action, onPlans, onSettings, onClose, guarded }: {
  tabs: { key: string; label: string; count: number }[];
  activeTab: string; onTabChange: (key: string) => void;
  action: { label: string; icon: React.ReactNode; onPress: () => void };
  onPlans: () => void; onSettings?: () => void; onClose: () => void; guarded: boolean;
}) {
  const dark = useTheme().theme === "dark";
  const tokens = getThemeTokens(dark);
  // Same solid-action token as panel-workspace.css on the web.
  const primary = tokens.actionPrimary;
  const language = loadSessionState().language;
  const es = language.startsWith("es");
  const plansLabel = es ? nativeText("Planes de hosting") : nativeText("Hosting plans");
  const plans = <Pressable key="plans" accessibilityRole="button" accessibilityLabel={plansLabel} onPress={onPlans}
    style={[styles.button, { backgroundColor: tokens.bgSecondary, borderColor: tokens.border }]}>
    <Text style={[styles.label, { color: tokens.textSecondary }]}>{plansLabel}</Text>
  </Pressable>;
  const create = <Pressable key="create" accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress}
    style={[styles.button, { backgroundColor: primary, borderColor: primary }]}>
    {React.cloneElement(action.icon as React.ReactElement<{ size?: number; color?: string }>, { size: 13, color: "#ffffff" })}
    <Text style={[styles.label, { color: "#ffffff" }]}>{action.label}</Text>
  </Pressable>;
  return <View testID="users-module-header" style={[styles.header, { backgroundColor: tokens.bgCardSolid, borderBottomColor: tokens.border }]}>
    <View style={styles.topRow}>
      <ScrollView horizontal accessibilityRole="tablist" style={{ flex: 1 }} contentContainerStyle={{ alignItems: "center", gap: 4 }} showsHorizontalScrollIndicator={false}>
        {tabs.map(tab => {
          const active = tab.key === activeTab;
          return <Pressable key={tab.key} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: active }}
            onPress={() => { Keyboard.dismiss(); onTabChange(tab.key); }}
            style={[styles.tab, { borderColor: active ? tokens.border : "transparent", backgroundColor: active ? tokens.bgSecondary : "transparent" }]}>
            <Text style={[styles.label, { color: active ? tokens.textPrimary : tokens.textMuted }]}>{tab.label}</Text>
            <View style={[styles.badge, { backgroundColor: withAlpha(active ? tokens.brand : tokens.textMuted, active ? 0.22 : 0.10) }]}>
              <Text style={{ fontSize: 9, fontWeight: "600", color: active ? tokens.textPrimary : tokens.textMuted }}>{tab.count}</Text>
            </View>
          </Pressable>;
        })}
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel={getMessages(language).common.close} onPress={() => { Keyboard.dismiss(); onClose(); }} style={styles.close}>
        <X size={17} color={tokens.textMuted} />
      </Pressable>
    </View>
    {!guarded ? <View style={styles.actionRow}>
      <ScrollView horizontal style={{ flex: 1, minWidth: 0 }} contentContainerStyle={{ flexDirection: "row", alignItems: "center", gap: 4 }} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {activeTab === "users" ? [create, plans] : [plans, create]}
      </ScrollView>
      {onSettings ? <Pressable accessibilityRole="button" accessibilityLabel={es ? nativeText("Configuración") : nativeText("Settings")} onPress={onSettings} style={[styles.button, { backgroundColor: tokens.bgSecondary, borderColor: tokens.border }]}>
        <Settings size={12} color={tokens.textSecondary} />
        <Text style={[styles.label, { color: tokens.textSecondary }]}>{es ? nativeText("Configuración") : nativeText("Settings")}</Text>
      </Pressable> : null}
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  header: { paddingHorizontal: 10, paddingBottom: 3, borderBottomWidth: 1, flexShrink: 0 },
  topRow: { flexDirection: "row", alignItems: "center", height: 36 },
  tab: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, minHeight: 30 },
  badge: { minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  close: { width: 30, height: 36, alignItems: "center", justifyContent: "center" },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 30 },
  button: { minHeight: 28, paddingHorizontal: 8, borderRadius: 5, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  label: { fontSize: 10, fontWeight: "500" },
});
