import { nativeText } from '../../i18n/native-text';
import React, { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Settings2, X } from "lucide-react-native";
import { NativeModuleContext, ScopedNativeModal } from "../../screens/main/native-module-context";
import { cancelActiveInlineEdit } from "../../lib/inline-edit-back";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { getMessages } from "../../i18n";
import { PanelText as Text } from "./PanelText";

/** Full-height right drawer shell; form variant keeps drafts safe from backdrop taps. */
export function ModuleSettingsDrawer({ visible, onClose, title, language, children, headerIcon, headerActions, variant = "settings", footer }: {
  visible: boolean; onClose: () => void; title: string; language: string; children: React.ReactNode;
  headerIcon?: React.ReactNode; headerActions?: React.ReactNode;
  variant?: "settings" | "form"; footer?: React.ReactNode;
}) {
  const context = useContext(NativeModuleContext);
  const tokens = getThemeTokens(useTheme().theme === "dark");
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const form = variant === "form";
  const drawerWidth = width <= 1024 ? width : Math.min(width * 0.6, form ? 640 : 960);
  const [visited, setVisited] = useState(visible);
  const [present, setPresent] = useState(visible);
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let active = true;
    let changed = false;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active && !changed) setReducedMotion(value); }).catch(() => { if (active && !changed) setReducedMotion(false); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", value => { changed = true; setReducedMotion(value); });
    return () => { active = false; subscription.remove(); };
  }, []);
  // Layout cleanup runs before the portal starts a retained exit animation.
  useLayoutEffect(() => {
    if (visible) { setVisited(true); setPresent(true); }
    if (reducedMotion === null) return;
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0, duration: reducedMotion ? 0 : visible ? 280 : 220,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad), useNativeDriver: true,
    });
    animation.start(({ finished }) => { if (finished && !visible) setPresent(false); });
    return () => animation.stop();
  }, [visible, progress, reducedMotion]);
  const exitAnimation = useCallback((done: () => void) => {
    Keyboard.dismiss();
    const animation = Animated.timing(progress, { toValue: 0, duration: reducedMotion !== false ? 0 : 220, easing: Easing.in(Easing.quad), useNativeDriver: true });
    animation.start(({ finished }) => { if (finished) done(); });
    return () => animation.stop();
  }, [progress, reducedMotion]);
  const close = () => { Keyboard.dismiss(); onClose(); };
  if (!visited && !visible) return null;
  return <ScopedNativeModal visible={visible || present} interactive={visible} exitAnimation={exitAnimation} transparent animationType="none" onRequestClose={() => { if (!cancelActiveInlineEdit()) close(); }}>
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.overlay} testID={form ? "module-form-drawer" : "module-settings-drawer"}>
        <Pressable testID={form ? "module-form-backdrop" : undefined} accessible={!form} accessibilityLabel={form ? undefined : getMessages(language).common.close} onPress={form ? undefined : close} style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: tokens.bgOverlay, opacity: progress }]} />
        </Pressable>
        <Animated.View testID={form ? "module-form-sheet" : undefined} style={[styles.sheet, {
          width: drawerWidth, backgroundColor: tokens.bgCardSolid, borderLeftColor: tokens.border,
          paddingTop: context?.insideWorkspace ? 0 : insets.top,
          paddingBottom: insets.bottom,
          transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [drawerWidth, 0] }) }],
        }]}>
          <View style={[styles.header, { borderColor: tokens.border }]}>
            {headerIcon ?? (form ? null : <Settings2 size={20} color={tokens.brand} />)}
            <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, { color: tokens.textPrimary }]}>{title}</Text>
            {headerActions}
            <Pressable accessibilityRole="button" accessibilityLabel={getMessages(language).common.close} onPress={close} style={styles.close}>
              <X size={20} color={tokens.textMuted} />
            </Pressable>
          </View>
          <NativeModuleContext.Provider value={context ? { ...context, visible: context.visible && visible } : null}>
            <View style={styles.fill}>{children}</View>
            {footer ? <View testID={form ? "module-form-footer" : undefined} style={[styles.footer, { borderTopColor: tokens.border }]}>{footer}</View> : null}
          </NativeModuleContext.Provider>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  </ScopedNativeModal>;
}

export type SettingsSection = { key: string; label: string; icon?: React.ReactNode };
/** Fixed navigation column and a separately scrolling content column, also on phones. */
export function SettingsColumns({ sections, value, onChange, children, language }: {
  sections: SettingsSection[]; value: string; onChange: (key: string) => void; children: React.ReactNode; language: string;
}) {
  const tokens = getThemeTokens(useTheme().theme === "dark");
  const { width } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const expanded = (measuredWidth ?? width) >= 576;
  // Operation groups may have no distinct icons; keep their names readable.
  const showLabels = expanded;
  return <View testID="module-settings-columns" style={styles.columns} onLayout={e => setMeasuredWidth(e.nativeEvent.layout.width)}>
    <View style={[styles.navigation, { width: expanded ? 208 : showLabels ? 112 : 56, backgroundColor: tokens.bgSecondary, borderRightColor: tokens.border }]}>
      <ScrollView nestedScrollEnabled accessibilityRole="tablist" accessibilityLabel={language.startsWith("es") ? nativeText("Secciones de configuración") : nativeText("Settings sections")} contentContainerStyle={styles.navContent} keyboardShouldPersistTaps="handled">
        {sections.map(section => <Pressable key={section.key} accessibilityRole="tab" accessibilityLabel={section.label} accessibilityState={{ selected: value === section.key }} onPress={() => { Keyboard.dismiss(); onChange(section.key); }} style={[styles.navButton, { justifyContent: showLabels ? "flex-start" : "center", backgroundColor: value === section.key ? tokens.brandDim : "transparent" }]}>
          {<View style={{ opacity: value === section.key ? 1 : 0.7 }}>{section.icon ?? <Settings2 size={20} color={value === section.key ? tokens.brand : tokens.textMuted} />}</View>}
          {showLabels && <Text numberOfLines={expanded ? 2 : 3} style={[styles.navLabel, { fontSize: expanded ? 13 : 11, color: value === section.key ? tokens.brand : tokens.textSecondary }]}>{section.label}</Text>}
        </Pressable>)}
      </ScrollView>
    </View>
    <View testID="module-settings-content" style={styles.content}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: tokens.textPrimary, borderColor: tokens.border }]}>{sections.find(section => section.key === value)?.label}</Text>
      <View style={styles.fill}>{children}</View>
    </View>
  </View>;
}

/** Lazily mount sections, retaining edits and disabling overlays in hidden sections. */
export function SettingsSectionBody({ active, children }: { active: boolean; children: React.ReactNode }) {
  const context = useContext(NativeModuleContext);
  const [visited, setVisited] = useState(active);
  useEffect(() => { if (active) setVisited(true); }, [active]);
  if (!active && !visited) return null;
  return <NativeModuleContext.Provider value={context ? { ...context, visible: context.visible && active } : null}>
    <View style={[styles.fill, !active && { display: "none" }]} pointerEvents={active ? "auto" : "none"} accessibilityElementsHidden={!active} importantForAccessibility={active ? "auto" : "no-hide-descendants"}>{children}</View>
  </NativeModuleContext.Provider>;
}
const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0, minWidth: 0 }, overlay: { flex: 1, alignItems: "flex-end" },
  sheet: { height: "100%", minHeight: 0, minWidth: 0, overflow: "hidden", borderLeftWidth: 1, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: -12, height: 0 }, elevation: 16 },
  header: { height: 56, flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, borderBottomWidth: 1 },
  title: { flex: 1, fontSize: 15, fontWeight: "600" }, close: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  footer: { flexDirection: "row", flexShrink: 0, justifyContent: "flex-end", gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1 },
  columns: { flex: 1, minHeight: 0, flexDirection: "row" }, navigation: { flexShrink: 0, borderRightWidth: 1 },
  navContent: { padding: 6, gap: 4 }, navButton: { minHeight: 44, borderRadius: 8, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, gap: 8 },
  navLabel: { flex: 1, fontSize: 13, fontWeight: "500" }, content: { flex: 1, minWidth: 0, minHeight: 0 },
  sectionTitle: { fontSize: 14, fontWeight: "600", padding: 14, borderBottomWidth: 1 },
});
