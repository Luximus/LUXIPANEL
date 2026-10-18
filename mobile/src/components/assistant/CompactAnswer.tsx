// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { visibleSummary } from "../../features/assistant/visible-summary";
import { MarkdownView } from "../MarkdownView";
import type { ThemeTokens } from "../../theme/colors";
import type { AssistantStrings } from "./types";

const labels: Record<string, string> = { es: "Ver detalle", en: "View details", de: "Details anzeigen", fr: "Voir les détails", it: "Mostra dettagli", pt: "Ver detalhes", ar: "عرض التفاصيل", bn: "বিস্তারিত দেখুন", hi: "विवरण देखें", ja: "詳細を表示", ko: "세부 정보 보기", ru: "Показать подробности" };

export function CompactAnswer({ text, summary, tokens, t, lang }: {
  text: string; summary?: string; tokens: ThemeTokens; t: AssistantStrings; lang?: string;
}) {
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 5, minWidth: 0 }}>
    <Text numberOfLines={2} ellipsizeMode="tail" style={{ color: tokens.textPrimary, lineHeight: 20 }}>{visibleSummary(summary || text)}</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)}>
      <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{labels[(lang ?? "es").split("-")[0]!] ?? labels.en}</Text>
    </Pressable>
    {open && <MarkdownView text={text} tokens={tokens} textColor={tokens.textPrimary} copyLabel={t.copy} copiedLabel={t.copied} />}
  </View>;
}
