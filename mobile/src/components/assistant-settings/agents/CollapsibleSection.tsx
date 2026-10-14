// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * CollapsibleSection (RN) — acordeón CONTROLADO: el estado `open` y `onToggle`
 * los posee el padre, que puede forzar "solo uno abierto a la vez" (la lista de
 * equipos/grupos del módulo Agentes). Cabecera con título + subtítulo opcional +
 * slot `right` opcional (p. ej. acciones del grupo) + chevron que rota al abrir.
 * Pulsar la cabecera alterna; el slot `right` tiene su propio touch target.
 */
import React from "react";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import type { ThemeTokens } from "../../../theme/colors";
import { s } from "../styles";

export function CollapsibleSection({
  title,
  subtitle,
  open,
  onToggle,
  right,
  tokens,
  style,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  /** Slot a la derecha de la cabecera (acciones, badges…). */
  right?: React.ReactNode;
  tokens: ThemeTokens;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        s.card,
        { backgroundColor: tokens.bgInput, borderColor: tokens.border, padding: 0, gap: 0 },
        style,
      ]}
    >
      <View style={[s.rowBetween, { padding: 12, gap: 8 }]}>
        <Pressable onPress={onToggle} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
          {open ? (
            <ChevronDown size={18} color={tokens.textMuted} />
          ) : (
            <ChevronRight size={18} color={tokens.textMuted} />
          )}
          <View style={{ flex: 1 }}>
            {typeof title === "string" ? (
              <Text style={[s.cardTitle, { color: tokens.textPrimary }]} numberOfLines={1}>
                {title}
              </Text>
            ) : (
              title
            )}
            {subtitle != null ? (
              typeof subtitle === "string" ? (
                <Text style={[s.cardDesc, { color: tokens.textMuted }]} numberOfLines={2}>
                  {subtitle}
                </Text>
              ) : (
                subtitle
              )
            ) : null}
          </View>
        </Pressable>
        {right != null ? <View style={{ flexShrink: 0 }}>{right}</View> : null}
      </View>
      {open ? <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>{children}</View> : null}
    </View>
  );
}
