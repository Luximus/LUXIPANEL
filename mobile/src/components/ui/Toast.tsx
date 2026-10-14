import { localizeServerError } from "../../lib/server-error-localization";
import { nativeText } from "../../i18n/native-text";
import { useLanguage } from "../../hooks/useLanguage";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, Check } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";

export type ToastVariant = "success" | "error";

/**
 * Toast flotante (abajo): tarjeta animada que aparece con fade + leve
 * deslizamiento y se auto-oculta. La app no tenía sistema de toasts; reemplaza
 * a los `Alert` del SO para confirmaciones tipo "copiado" (más bonito y no
 * bloqueante). Se cierra solo (~2.8s) o al tocarlo.
 */
export function Toast({
  visible,
  variant,
  message,
  nonce,
  onHide,
}: {
  visible: boolean;
  variant: ToastVariant;
  message: string;
  /** Cambia en cada disparo para re-armar la animación y el temporizador. */
  nonce: number;
  onHide: () => void;
}) {
  const language = useLanguage();
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      const timer = setTimeout(onHide, 2800);
      return () => clearTimeout(timer);
    }
    Animated.timing(anim, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, nonce]);

  const accent = variant === "error" ? tokens.danger : tokens.brand;
  return (
    <Animated.View
      pointerEvents={visible ? "box-none" : "none"}
      style={[
        styles.wrap,
        { bottom: insets.bottom + 24 },
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] },
      ]}
    >
      <Pressable
        onPress={onHide}
        accessibilityRole="button"
        style={[styles.card, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: accent }]}>
          {variant === "error"
            ? <AlertTriangle size={15} color="#ffffff" />
            : <Check size={16} color="#ffffff" strokeWidth={3} />}
        </View>
        <Text numberOfLines={3} style={[styles.text, { color: tokens.textPrimary }]}>{variant === "error" ? localizeServerError(message, language) : nativeText(message, undefined, language)}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center", zIndex: 100, elevation: 100 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: 480,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  iconWrap: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, fontSize: 14, fontWeight: "700" },
});
