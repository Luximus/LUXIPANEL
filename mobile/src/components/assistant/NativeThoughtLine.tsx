import React, { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Check, ChevronDown, Sparkles, Square, X } from "lucide-react-native";
import type { ThemeTokens } from "../../theme/colors";
import { stripAnsi } from "../../lib/strip-ansi";
import { PanelText as Text } from "../ui/PanelText";

/** Agent narration in a CLI transcript; tool calls and their output stay in the console. */
export function extractCliProgress(raw: string, answer = ""): string[] {
  const lines = stripAnsi(raw).replace(/\x00[^\x00]*\x00/g, "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  const flush = () => {
    const value = current.join("\n").trim();
    if (value && value !== blocks.at(-1)) blocks.push(value);
    current = [];
  };
  for (const line of lines) {
    const value = line.trim();
    if (!value || /^─{3,}$/.test(value) || /^(?:\$ |⏺ |● |⎿ |↳ |Reading additional input from stdin\.\.\.|\[error\])/.test(value) || /^\s{2,}/.test(line)) {
      flush(); continue;
    }
    current.push(value);
  }
  flush();
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
  if (answer && normalize(blocks.at(-1) ?? "") === normalize(answer)) blocks.pop();
  return blocks;
}

export function NativeThoughtLine({ raw, answer, pending, status, tokens, language }: {
  raw: string; answer: string; pending?: boolean; status?: "done" | "failed" | "stopped"; tokens: ThemeTokens; language?: string;
}) {
  const [open, setOpen] = useState(false);
  const steps = extractCliProgress(raw, answer);
  const spanish = (language ?? "es").startsWith("es");
  const current = pending ? steps.at(-1) : undefined;
  const previous = pending ? steps.slice(0, -1) : steps;
  const doneLabel = status === "failed" ? (spanish ? "Error" : "Error") : status === "stopped" ? (spanish ? "Detenido" : "Stopped") : (spanish ? "Listo" : "Done");
  return <View style={{ borderBottomWidth: 1, borderBottomColor: tokens.border, paddingHorizontal: 12, paddingVertical: 9 }}>
    <Pressable onPress={() => setOpen((value) => !value)} disabled={previous.length === 0} accessibilityRole="button"
      accessibilityLabel={current ?? (pending ? (spanish ? "Ejecutando" : "Working") : doneLabel)}
      style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      {pending ? <ActivityIndicator size="small" color={tokens.brand} /> : status === "failed" ? <X size={14} color={tokens.danger} /> : status === "stopped" ? <Square size={13} color={tokens.textMuted} /> : <Check size={14} color={tokens.success} />}
      <Text numberOfLines={2} style={{ color: tokens.textSecondary, fontSize: 12, flex: 1 }}>
        {current ?? (pending ? (spanish ? "Ejecutando…" : "Working…") : doneLabel)}
      </Text>
      {previous.length ? <>
        <Text style={{ color: tokens.textMuted, fontSize: 10 }}>{previous.length}</Text>
        <ChevronDown size={13} color={tokens.textMuted} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
      </> : <Sparkles size={12} color={tokens.textMuted} />}
    </Pressable>
    {open ? <View style={{ marginTop: 9, gap: 7, paddingLeft: 21 }}>
      {previous.map((step, index) => <View key={`${index}-${step.slice(0, 12)}`} style={{ flexDirection: "row", alignItems: "flex-start", gap: 7 }}>
        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: tokens.textMuted, marginTop: 5.5 }} />
        <Text selectable style={{ color: tokens.textMuted, fontSize: 11, lineHeight: 16, flex: 1 }}>{step}</Text>
      </View>)}
    </View> : null}
  </View>;
}
