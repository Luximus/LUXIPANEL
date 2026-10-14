import React, { useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Moon, Sun } from "lucide-react-native";
import { getThemeTokens } from "../../theme/colors";
import type { ThemeMode } from "../../features/app/types";
import type { ThemeOrigin } from "../../theme/theme-transition";

export function ThemeIconButton({ theme, label, onToggle }: {
  theme: ThemeMode; label: string; onToggle: (origin?: ThemeOrigin) => void;
}) {
  const ref = useRef<View>(null), colors = getThemeTokens(theme === "dark");
  return <Pressable ref={ref} accessibilityRole="switch" accessibilityLabel={label}
    accessibilityState={{ checked: theme === "dark" }}
    onPress={() => {
      if (!ref.current) { onToggle(); return; }
      ref.current.measureInWindow((x, y, width, height) => onToggle({ x: x + width / 2, y: y + height / 2 }));
    }}
    style={({ pressed }) => [styles.button, { backgroundColor: colors.bgCardSolid, borderColor: colors.border, opacity: pressed ? 0.65 : 1 }]}>
    {theme === "dark" ? <Sun size={19} color={colors.textSecondary} /> : <Moon size={19} color={colors.textSecondary} />}
  </Pressable>;
}
const styles = StyleSheet.create({ button: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 14 } });
