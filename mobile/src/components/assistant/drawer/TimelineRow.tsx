// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React, { useContext } from "react";
import { View } from "react-native";
import { withAlpha, type ThemeTokens } from "../../../theme/colors";
import { NativeModuleContext } from "../../../screens/main/native-module-context";
import { styles } from "./TimelineRow.styles";

/** Decoración de timeline (patrón "feeds"): un punto a la izquierda de la fila +
 *  un conector vertical que la enlaza con la siguiente. El conector se omite en
 *  el último elemento visible para que la línea no sobresalga. Es solo una capa
 *  visual: envuelve el `ConvoRow` anidado sin tocar su contenido ni su tacto.
 *  Espejo RN de `TimelineRow` web (dot h-2 w-2 + línea w-px sobre el border-l). */
export function TimelineRowRN({ isLast, tokens, children }: { isLast: boolean; tokens: ThemeTokens; children: React.ReactNode }) {
  const workspace = useContext(NativeModuleContext)?.insideWorkspace;
  if (workspace) return <View style={{ marginTop: 6 }}>{children}</View>;
  return (
    <View style={styles.timelineRow}>
      {!isLast ? <View pointerEvents="none" style={[styles.timelineLine, { backgroundColor: withAlpha(tokens.textMuted, 0.3) }]} /> : null}
      <View pointerEvents="none" style={[styles.timelineDot, { backgroundColor: tokens.textMuted, borderColor: tokens.bgCardSolid }]} />
      {children}
    </View>
  );
}
