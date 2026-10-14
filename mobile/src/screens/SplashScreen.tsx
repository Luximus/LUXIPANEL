import React, { useEffect, useRef } from "react";
import { Animated, Image, Text, View } from "react-native";
import type { ThemeMode } from "../features/app/types";
import { getMessages } from "../i18n";
import { getThemeTokens } from "../theme/colors";
import { getPageGradient } from "../features/app/utils";
import { styles } from "./SplashScreen.styles";

const LOGO2 = require("../../assets/logo2.png");
const LOGO_LIGHT = require("../../assets/logo_light.png");
const LOGO_DARK = require("../../assets/logo.png");

function PulseDot({ delay, color }: { delay: number; color: string }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, delay, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, opacity]);
  return <Animated.View style={[styles.dot, { backgroundColor: color, opacity }]} />;
}

export function SplashScreen({ theme, language }: { theme: ThemeMode; language?: string }) {
  const t = getMessages(language);
  const tokens = getThemeTokens(theme === "dark");
  const gradient = getPageGradient(theme);

  return (
    <View style={[styles.container, { backgroundColor: gradient[0] }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: tokens.bgCardSolid,
            borderColor: tokens.border,
          },
        ]}
      >
        <Image source={LOGO2} style={styles.logoBig} />
        <Image source={theme === "dark" ? LOGO_LIGHT : LOGO_DARK} style={styles.logoSmall} />
        <Text style={[styles.label, { color: tokens.textPrimary }]}>{t.splash.loading}</Text>
        <View style={styles.dotsRow}>
          <PulseDot delay={0} color={tokens.success} />
          <PulseDot delay={120} color={tokens.success} />
          <PulseDot delay={240} color={tokens.success} />
        </View>
        <Text style={[styles.copyright, { color: tokens.textMuted }]}>{t.splash.copyright}</Text>
      </View>
    </View>
  );
}

