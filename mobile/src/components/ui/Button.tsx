import React from "react";
import { ActivityIndicator, Pressable, type StyleProp, type ViewStyle } from "react-native";
import { PanelText as Text } from "./PanelText";
import { useModuleUi } from "./ModuleUi";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { getLocaleRowDirection } from "../../i18n";
import { loadSessionState } from "../../lib/session-state";
import { styles } from "./Button.styles";

type Variant = "primary" | "ghost" | "danger" | "secondary";
type Size = "sm" | "md";

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  icon,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const compact = useModuleUi();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;

  const palette = (() => {
    switch (variant) {
      case "primary":
        return { bg: tokens.actionPrimary, text: "#ffffff", border: tokens.actionPrimary };
      case "danger":
        return { bg: tokens.danger, text: "#ffffff", border: tokens.danger };
      case "secondary":
        return { bg: tokens.bgSecondary, text: tokens.textSecondary, border: tokens.border };
      case "ghost":
      default:
        return { bg: "transparent", text: tokens.textSecondary, border: tokens.border };
    }
  })();

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={[
        styles.btn,
        size === "sm" ? styles.btnSm : styles.btnMd,
        compact && { minHeight: size === "sm" ? 28 : 32, paddingVertical: 5, paddingHorizontal: size === "sm" ? 8 : 10, borderRadius: 5, gap: 4 },
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: isDisabled ? 0.6 : 1,
          flexDirection: getLocaleRowDirection(language),
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} size="small" />
      ) : (
        <>
          {icon ? React.cloneElement(icon as React.ReactElement<{ color?: string; size?: number }>, { ...(compact ? { size: size === "sm" ? 13 : 15 } : {}), color: (icon as React.ReactElement<{ color?: string }>).props.color ?? palette.text }) : null}
          <Text style={[styles.label, size === "sm" ? styles.labelSm : styles.labelMd, compact && { fontSize: size === "sm" ? 10 : 12, fontWeight: "500" }, { color: palette.text }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
