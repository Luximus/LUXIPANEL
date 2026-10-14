import React from "react";
import { ActivityIndicator, Image, Text, View } from "react-native";
import { RotateCw, WifiOff } from "lucide-react-native";
import type { ThemeMode } from "../features/app/types";
import { getMessages } from "../i18n";
import { getThemeTokens } from "../theme/colors";
import { getPageGradient } from "../features/app/utils";
import { Button } from "../components/ui/Button";
import { styles } from "./OfflineScreen.styles";

const LOGO2 = require("../../assets/logo2.png");
const LOGO_LIGHT = require("../../assets/logo_light.png");
const LOGO_DARK = require("../../assets/logo.png");

export function OfflineScreen({
  theme,
  language,
  checking,
  onRetry,
}: {
  theme: ThemeMode;
  language: string;
  checking: boolean;
  onRetry: () => void;
}) {
  const t = getMessages(language);
  const tokens = getThemeTokens(theme === "dark");
  const gradient = getPageGradient(theme);
  const isDark = theme === "dark";

  return (
    <View style={[styles.overlay, { backgroundColor: gradient[0] }]}>
      <View
        style={[
          styles.card,
          { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border },
        ]}
      >
        <Image source={LOGO2} style={styles.logoBig} />
        <Image source={isDark ? LOGO_LIGHT : LOGO_DARK} style={styles.logoSmall} />

        <View style={[styles.iconCircle, { backgroundColor: "rgba(244,63,94,0.15)" }]}>
          <WifiOff size={28} color={tokens.danger} />
        </View>

        <Text style={[styles.eyebrow, { color: tokens.danger }]}>{t.offline.eyebrow}</Text>
        <Text style={[styles.title, { color: tokens.textPrimary }]}>{t.offline.title}</Text>
        <Text style={[styles.message, { color: tokens.textMuted }]}>{t.offline.message}</Text>

        <Button
          variant="primary"
          onPress={onRetry}
          disabled={checking}
          label={checking ? t.offline.checking : t.offline.retry}
          icon={checking ? <ActivityIndicator color="#fff" size="small" /> : <RotateCw size={16} />}
          style={styles.retryBtn}
        />

        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: tokens.danger }]} />
          <Text style={[styles.statusLabel, { color: tokens.textMuted }]}>{t.offline.waiting}</Text>
        </View>
      </View>
    </View>
  );
}

