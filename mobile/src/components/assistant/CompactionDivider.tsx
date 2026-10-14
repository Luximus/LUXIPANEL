// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown, ChevronsDownUp } from "lucide-react-native";
import type { ChatMsg } from "../../features/assistant/types";
import type { ThemeTokens } from "../../theme/colors";
import { MarkdownView } from "../MarkdownView";
import type { AssistantStrings } from "./types";
import { compactionLabel, stripCompactionMarker } from "./format";
import { styles } from "./CompactionDivider.styles";

/** Divisor de compactación: ocupa el lugar de los turnos plegados por una
 *  compactación de contexto. Toca para expandir el resumen que el modelo ve. */
export function CompactionDivider({ msg, t, tokens }: { msg: ChatMsg; t: AssistantStrings; tokens: ThemeTokens }) {
  const [open, setOpen] = useState(false);
  const n = msg.summarizedCount ?? 0;
  // El marcador del resumen lo emite el backend en el idioma del hilo: se quita
  // por forma ("[…]" al principio), no casando contra el texto en español.
  const body = stripCompactionMarker(typeof msg.content === "string" ? msg.content : "");
  // Etiqueta traducida ("{n} mensajes anteriores resumidos" / "Conversación
  // compactada"): antes el caso n > 0 salía en español en los 11 idiomas.
  const label = compactionLabel(n);
  return (
    <View style={{ marginVertical: 2 }}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.compactWrap}>
        <View style={[styles.compactLine, { backgroundColor: tokens.border }]} />
        <View style={[styles.compactPill, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
          <ChevronsDownUp size={11} color={tokens.textMuted} />
          <Text style={[styles.compactPillText, { color: tokens.textMuted }]}>{label}</Text>
          <ChevronDown size={11} color={tokens.textMuted} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
        </View>
        <View style={[styles.compactLine, { backgroundColor: tokens.border }]} />
      </Pressable>
      {open && body ? (
        <View style={[styles.compactBody, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
          <MarkdownView text={body} tokens={tokens} textColor={tokens.textMuted} fontSize={12.5} copyLabel={t.copy} copiedLabel={t.copied} />
        </View>
      ) : null}
    </View>
  );
}
