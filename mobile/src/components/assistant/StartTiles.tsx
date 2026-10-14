// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React from "react";
import { Image, Pressable, Text, View, useWindowDimensions } from "react-native";
import { Activity, ServerCog, ShieldCheck, Sparkles, TerminalSquare, Zap } from "lucide-react-native";
import type { ThemeTokens } from "../../theme/colors";
import type { AssistantStrings } from "./types";
import { styles } from "./StartTiles.styles";

// Paleta rotativa de las tarjetas "puntos de partida" del estado vacío (paridad
// con `START_TILES` de la web `ChatPane.tsx`): un cuadro de color por tarjeta con
// glifo blanco; la posición de la sugerencia indexa el color/icono.
const START_TILES: { color: string; icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { color: "#6366f1", icon: Sparkles },
  { color: "#10b981", icon: ServerCog },
  { color: "#0ea5e9", icon: TerminalSquare },
  { color: "#f59e0b", icon: ShieldCheck },
  { color: "#f43f5e", icon: Activity },
  { color: "#8b5cf6", icon: Zap },
];

/** Estado vacío "puntos de partida" del chat iniciado sin mensajes (paridad con
 *  el estado vacío de la web `ChatPane.tsx`): título + descripción + divisor +
 *  tarjetas de sugerencia con icono de color. Al tocar una, se envía como
 *  primer mensaje (`onPick`). */
export function StartTiles({ quickReplies, projectTitle, t, tokens, onPick }: {
  quickReplies: string[];
  projectTitle?: string | null;
  t: AssistantStrings;
  tokens: ThemeTokens;
  onPick: (text: string) => void;
}) {
  const { height } = useWindowDimensions();
  const compact = height < 700;
  return (
    <View style={[styles.emptyStartWrap, compact && styles.emptyStartWrapCompact]}>
      <View style={styles.emptyStartInner}>
        <View style={styles.emptyStartHeading}>
          <View style={styles.emptyStartLogo}>
            <Image source={require("../../../assets/logo2.png")} style={styles.emptyStartLogoImage} resizeMode="contain" />
          </View>
          <Text style={[styles.emptyStartTitle, { color: tokens.textPrimary }]}>
            {projectTitle
              ? (t.newProjectConversationTitle ?? "Nueva conversación en {project}").replace("{project}", projectTitle)
              : (t.welcomeTitle ?? "Hola, soy tu asistente de servidor.")}
          </Text>
          <Text style={[styles.emptyStartDesc, { color: tokens.textMuted }]}>
            {t.startPointsDescription ?? "Elige un punto de partida o escribe tu propia pregunta abajo."}
          </Text>
        </View>
        <View style={styles.startCards}>
          {quickReplies.slice(0, 4).map((ex, i) => {
            const tile = START_TILES[i % START_TILES.length];
            const TileIcon = tile.icon;
            return (
              <Pressable
                key={i}
                onPress={() => onPick(ex)}
                style={({ pressed }) => [styles.startCard, { borderColor: tokens.border, backgroundColor: tokens.bgCardSolid, opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={[styles.startCardTile, { backgroundColor: tile.color }]}>
                  <TileIcon size={18} color="#ffffff" />
                </View>
                <Text style={[styles.startCardText, { color: tokens.textPrimary }]}>{ex}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
