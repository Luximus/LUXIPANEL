import React from "react";
import { Pressable, Text, type StyleProp, type ViewStyle } from "react-native";
import { styles } from "./Chip.styles";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { getLocaleRowDirection } from "../../i18n";
import { loadSessionState } from "../../lib/session-state";

/**
 * Canonical selectable chip (priority chips, tag chips, option toggles). Pill
 * radius, fontSize 13 / weight 700. Filled with the brand color when selected,
 * or with `accent` for semantic chips (e.g. ticket priority colors).
 */
export function Chip({
  label,
  selected,
  onPress,
  accent,
  icon,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accent?: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const activeColor = accent ?? tokens.brand;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          flexDirection: getLocaleRowDirection(language),
          backgroundColor: selected ? activeColor : "transparent",
          borderColor: selected ? activeColor : tokens.border,
        },
        style,
      ]}
    >
      {icon
        ? React.cloneElement(icon as React.ReactElement<{ color?: string }>, {
            color: selected ? "#ffffff" : tokens.textSecondary,
          })
        : null}
      <Text style={[styles.label, { color: selected ? "#ffffff" : tokens.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

