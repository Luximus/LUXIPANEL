import { nativeText } from '../../i18n/native-text';
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";

/** Quiet, themed loading feedback without a text row shifting the drawer. */
export function ModuleLoading({ label }: { label?: string }) {
  const tokens = getThemeTokens(useTheme().theme === "dark");
  const loading = nativeText("Cargando…");
  return <View testID="module-loading" accessibilityRole="progressbar" accessibilityLabel={label ?? loading} style={{ paddingVertical: 14, alignItems: "center" }}>
    <ActivityIndicator size="small" color={tokens.brand} />
  </View>;
}
