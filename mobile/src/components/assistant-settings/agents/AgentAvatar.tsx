// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AgentAvatar (RN) — el avatar canónico de un agente: un Avataaars generado a
 * partir de su `avatarConfig` (o del `seed` derivado de id/nombre cuando falta).
 *
 * Igual que el web, el SVG se genera 100% EN PROCESO con `@dicebear/core` +
 * `@dicebear/avataaars` (sin red / sin WebView) y se pinta con `<SvgXml>` de
 * react-native-svg. Solo si DiceBear lanzara (schema roto) caemos a un icono
 * `Bot` de respaldo sobre el círculo neutro. Determinista por (config, seed).
 */
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { Bot } from "lucide-react-native";
import type { ThemeTokens } from "../../../theme/colors";
import type { AvatarConfig } from "../types";
import { buildAvatarSvg } from "./agent-avataaars";

export function AgentAvatar({
  config,
  size = 36,
  color,
  seed = "agent",
  tokens,
}: {
  config?: AvatarConfig | null;
  /** Lado del cuadrado renderizado (px). */
  size?: number;
  /** Tinte del icono `Bot` de respaldo. Por defecto el color de marca. */
  color?: string;
  /** Seed estable (id o nombre del agente) para avatares deterministas. */
  seed?: string;
  tokens: ThemeTokens;
}) {
  // La generación es pura y determinista; se memoiza por (config, size, seed).
  // Si DiceBear lanzara, `xml` queda null y se muestra el icono Bot de respaldo.
  const xml = useMemo(() => {
    try {
      return buildAvatarSvg(config, size, seed);
    } catch {
      return null;
    }
  }, [config, size, seed]);

  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tokens.bgSecondary },
      ]}
    >
      {xml ? (
        <SvgXml xml={xml} width={size} height={size} />
      ) : (
        <Bot size={Math.round(size * 0.56)} color={color ?? tokens.brand} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
