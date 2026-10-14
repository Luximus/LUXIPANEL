import React, { useContext, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Keyboard, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeModuleContext } from "../../screens/main/native-module-visibility";
import { NativeOverlayHost } from "../../screens/main/NativeOverlayHost";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { getMessages } from "../../i18n";
import { loadSessionState } from "../../lib/session-state";

/** Workspace modules slide from the left; hiding one never disposes its content. */
export function NativeModuleDrawer({ visible, onClose, children }: {
  visible: boolean; onClose: () => void; children: React.ReactNode;
}) {
  const context = useContext(NativeModuleContext);
  const tokens = getThemeTokens(useTheme().theme === "dark");
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const drawerWidth = width <= 1024 ? width : width * 0.9;
  const [present, setPresent] = useState(visible);
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let current = true;
    let changed = false;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (current && !changed) setReducedMotion(value); }).catch(() => { if (current && !changed) setReducedMotion(false); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", value => { changed = true; setReducedMotion(value); });
    return () => { current = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (visible) setPresent(true);
    if (reducedMotion === null) return;
    const animation = Animated.timing(progress, { toValue: visible ? 1 : 0, duration: reducedMotion ? 0 : visible ? 280 : 220, easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad), useNativeDriver: true });
    animation.start(({ finished }) => { if (finished && !visible) setPresent(false); });
    return () => animation.stop();
  }, [visible, progress, reducedMotion]);
  return <View testID="native-module-drawer" style={[styles.root, { zIndex: visible ? 80 : 79 }, !visible && !present && styles.hidden]}
    pointerEvents={visible ? "auto" : "none"} accessibilityViewIsModal={visible}
    accessibilityElementsHidden={!visible} importantForAccessibility={visible ? "yes" : "no-hide-descendants"}>
    {/* Overlays belong to the full workspace, outside the animated/limited-width sheet. */}
    <NativeOverlayHost>
      <Pressable testID="native-module-backdrop" accessibilityRole="button" accessibilityLabel={getMessages(loadSessionState().language).common.close}
        onPress={() => { Keyboard.dismiss(); onClose(); }} style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: tokens.bgOverlay, opacity: progress }]} />
      </Pressable>
      <Animated.View testID="native-module-sheet" style={[styles.sheet, {
        width: drawerWidth, backgroundColor: tokens.bgCardSolid, borderRightColor: tokens.border,
        borderTopRightRadius: width <= 1024 ? 0 : 5, borderBottomRightRadius: width <= 1024 ? 0 : 5,
        paddingTop: context?.insideWorkspace ? 0 : insets.top,
        transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-drawerWidth, 0] }) }],
      }]}>{children}</Animated.View>
    </NativeOverlayHost>
  </View>;
}
const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }, hidden: { display: "none" },
  sheet: { height: "100%", minWidth: 0, overflow: "hidden", borderRightWidth: 1, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 12, height: 0 }, elevation: 16 },
});
