import React from "react";
import { ActivityIndicator, Pressable, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { styles } from "./IconButton.styles";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Shape = "square" | "round";

/**
 * Canonical icon-only button. Keeps the same border / radius / token language as
 * the text `Button` so icon actions (refresh, FAB, row actions, send, …) stay
 * visually uniform across the app.
 *
 * - shape "square" → borderRadius 10 (matches Button); "round" → 999 (FABs / pills).
 * - Pass `style` to override background/border for special states (e.g. an active
 *   favourite star). Pass the icon with an explicit `color` to keep that color;
 *   otherwise it inherits the variant foreground.
 */
export function IconButton({
  icon,
  onPress,
  variant = "secondary",
  shape = "square",
  size = 40,
  disabled,
  loading,
  accessibilityLabel,
  style,
}: {
  icon: React.ReactNode;
  onPress?: () => void;
  variant?: Variant;
  shape?: Shape;
  size?: number;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");

  const palette = (() => {
    switch (variant) {
      case "primary":
        return { bg: tokens.brand, fg: "#ffffff", border: tokens.brand };
      case "danger":
        return { bg: tokens.danger, fg: "#ffffff", border: tokens.danger };
      case "ghost":
        return { bg: "transparent", fg: tokens.textSecondary, border: "transparent" };
      case "secondary":
      default:
        return { bg: tokens.bgCardSolid, fg: tokens.textSecondary, border: tokens.border };
    }
  })();

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress ? (event) => { event.stopPropagation(); onPress(); } : undefined}
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.btn,
        {
          width: size,
          height: size,
          borderRadius: shape === "round" ? 999 : 10,
          borderWidth: variant === "ghost" ? 0 : 1,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: isDisabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} size="small" />
      ) : icon ? (
        React.cloneElement(icon as React.ReactElement<{ color?: string }>, {
          color: (icon as React.ReactElement<{ color?: string }>).props.color ?? palette.fg,
        })
      ) : null}
    </Pressable>
  );
}
