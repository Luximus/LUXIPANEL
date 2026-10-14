import React, { useRef } from "react";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import type { ThemeOrigin } from "../../theme/theme-transition";
import { Pressable, View } from "react-native";
import { Moon, Sun } from "lucide-react-native";
import type { ThemeMode } from "../../features/app/types";
import { getThemeTokens } from "../../theme/colors";
import { styles } from "./ThemeToggle.styles";

export function ThemeToggle({ theme, onToggle }: { theme: ThemeMode; onToggle: (origin?: ThemeOrigin) => void }) {
  const ref = useRef<View>(null);
  const isDark = theme === "dark";
  const tokens = getThemeTokens(isDark);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: withTiming(isDark ? 26 : 0, {duration:180}) }] }), [isDark]);
  return (
    <Pressable
      ref={ref}
      onPress={() => { if (!ref.current) { onToggle(); return; } ref.current.measureInWindow((x,y,w,h) => onToggle({x:x+w/2,y:y+h/2})); }}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      style={[
        styles.track,
        {
          backgroundColor: isDark ? tokens.brandDim : tokens.bgSecondary,
          borderColor: tokens.borderStrong,
        },
      ]}
    >
      <View style={styles.iconLeft}>
        <Sun size={14} color={isDark ? "#fbbf24" : "#b45309"} />
      </View>
      <View style={styles.iconRight}>
        <Moon size={14} color={isDark ? "#f8fafc" : "#1e293b"} />
      </View>
      <Animated.View
        style={[
          styles.thumb,
          {
            backgroundColor: isDark ? "#0f172a" : "#ffffff",
            borderColor: tokens.borderStrong,
          },
          thumb,
        ]}
      />
    </Pressable>
  );
}

