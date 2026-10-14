import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { ThemeMode } from "../features/app/types";
import { getMessages } from "../i18n";
import { getThemeTokens } from "../theme/colors";
import { getPageGradient } from "../features/app/utils";
import { styles } from "./LoadingPanelScreen.styles";

export function LoadingPanelScreen({ theme, language }: { theme: ThemeMode; language?: string }) {
  const t = getMessages(language);
  const tokens = getThemeTokens(theme === "dark");
  const gradient = getPageGradient(theme);

  return (
    <View style={[styles.container, { backgroundColor: gradient[0] }]}>
      <View
        style={[
          styles.card,
          { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border },
        ]}
      >
        <ActivityIndicator color={tokens.brand} size="large" />
        <Text style={[styles.label, { color: tokens.textPrimary }]}>{t.splash.loadingPanel}</Text>
      </View>
    </View>
  );
}

