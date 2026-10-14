import React, { useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { styles } from "./Avatar.styles";

export function getInitials(value: string): string {
  const parts = value.trim().split(/[\s._-]+/g).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function Avatar({
  photoURL,
  displayName,
  size = 32,
  bordered = true,
}: {
  photoURL?: string | null;
  displayName: string;
  size?: number;
  bordered?: boolean;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(photoURL) && !failed;
  const radius = size / 2;
  const fontSize = Math.round(size * 0.36);

  if (showPhoto && photoURL) {
    // GIF/WebP ANIMADO: usamos el `Image` de `expo-image`, que anima GIF y WebP
    // por defecto en iOS y Android (a diferencia del `<Image>` nativo de RN, que
    // en Android solo mostraba el primer fotograma estático).
    return (
      <Image
        source={{ uri: photoURL }}
        onError={() => setFailed(true)}
        contentFit="cover"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth: bordered ? 1 : 0,
          borderColor: tokens.border,
        }}
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: tokens.brand,
          borderColor: tokens.border,
          borderWidth: bordered ? 1 : 0,
        },
      ]}
    >
      <Text style={[styles.initials, { color: "#ffffff", fontSize }]}>{getInitials(displayName)}</Text>
    </View>
  );
}

