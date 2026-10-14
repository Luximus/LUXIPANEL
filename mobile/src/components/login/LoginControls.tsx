import React, { forwardRef, useContext, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { AlertCircle, CheckCircle2, ArrowRight } from "lucide-react-native";
import { PanelText as Text, PanelFontsReady } from "../ui/PanelText";
import { getThemeTokens, withAlpha } from "../../theme/colors";
export type LoginNoticeTone = "error" | "success";
type Colors = ReturnType<typeof getThemeTokens>;

export const LoginField = forwardRef<TextInput, TextInputProps & { label: string; colors: Colors; icon?: React.ReactNode; suffix?: React.ReactNode; rtl?: boolean }>(
  function LoginField({ label, colors, icon, suffix, rtl, style, ...props }, ref) {
    const [focused, setFocused] = useState(false);
    const fontsReady = useContext(PanelFontsReady);
    return <View style={{ gap: 8 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600", textAlign: rtl ? "right" : "left" }}>{label}</Text>
      <View style={[styles.field, { flexDirection: rtl ? "row-reverse" : "row", backgroundColor: colors.bgInput,
        borderColor: focused ? colors.brand : colors.borderStrong, opacity: props.editable === false ? 0.7 : 1 }]}>
        {icon}
        <TextInput ref={ref} accessibilityLabel={label} autoCapitalize="none" autoCorrect={false}
          placeholderTextColor={colors.textMuted} {...props}
          onFocus={event => { setFocused(true); props.onFocus?.(event); }}
          onBlur={event => { setFocused(false); props.onBlur?.(event); }}
          style={[styles.input, { color: colors.textPrimary, textAlign: rtl ? "right" : "left", ...(fontsReady ? { fontFamily: "LUXIPANEL-Inter" } : {}) }, style]} />
        {suffix}
      </View>
    </View>;
  },
);

export function LoginAction({ label, onPress, colors, busy = false, disabled = false, primary = false }: {
  label: string; onPress: () => void; colors: Colors; busy?: boolean; disabled?: boolean; primary?: boolean;
}) {
  const foreground = primary ? "#ffffff" : colors.textPrimary;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || disabled, busy }}
    disabled={busy || disabled} onPress={onPress}
    style={({ pressed }) => [styles.action, { backgroundColor: primary ? colors.brand : colors.bgSecondary,
      borderColor: primary ? colors.brand : colors.border, opacity: pressed || disabled ? 0.65 : busy ? 0.85 : 1 }]}>
    {busy ? <ActivityIndicator size="small" color={foreground} /> : null}
    <Text style={{ color: foreground, fontSize: 15, fontWeight: "700", textAlign: "center", flexShrink: 1 }}>{label}</Text>
    {primary && !busy ? <ArrowRight size={18} color={foreground} /> : null}
  </Pressable>;
}

export function LoginNotice({ message, tone, colors }: { message: string; tone: LoginNoticeTone; colors: Colors }) {
  const color = tone === "success" ? colors.success : colors.danger;
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;
  return <View style={[styles.notice, { borderColor: withAlpha(color, 0.28), backgroundColor: withAlpha(color, 0.08) }]}>
    <Icon size={18} color={color} />
    <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color, fontSize: 13, lineHeight: 19, flex: 1 }}>{message}</Text>
  </View>;
}
export const styles = StyleSheet.create({
  field: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, alignItems: "center", gap: 10 },
  input: { flex: 1, minWidth: 0, minHeight: 48, paddingVertical: 10, fontSize: 16 },
  action: { minHeight: 54, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 },
  notice: { padding: 14, borderWidth: 1, borderRadius: 14, flexDirection: "row", alignItems: "flex-start", gap: 10 },
});
