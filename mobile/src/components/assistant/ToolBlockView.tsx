// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Check, ChevronDown, TerminalSquare, X } from "lucide-react-native";
import type { ToolBlock } from "../../features/assistant/types";
import type { ThemeTokens } from "../../theme/colors";
import { stripAnsi } from "../../lib/strip-ansi";
import { AnsiTerminalView, ansiTerminalLabels } from "../AnsiTerminalView";
import type { AssistantStrings } from "./types";
import { styles } from "./ToolBlockView.styles";

/** Parámetros de entrada de una tool como JSON legible (réplica del `<pre>` de
 *  `input` de la web). Vacío si no hay input o es trivial. */
function toolInputJson(input: unknown): string {
  if (input == null) return "";
  if (typeof input === "string") return input.trim();
  try {
    const s = JSON.stringify(input, null, 2);
    return s && s !== "{}" && s !== "null" ? s : "";
  } catch { return ""; }
}

/** Bloque de tool colapsable: icono de estado + nombre + parámetros (input) y
 *  output. Para tools CLI (`*.cli`) el cuerpo es un mini-terminal ANSI nativo
 *  (`AnsiTerminalView`) en lugar del texto monoespaciado plano. */
export function ToolBlockView({ tool, tokens, theme, t, lang }: { tool: ToolBlock; tokens: ThemeTokens; theme: "dark" | "light"; t: AssistantStrings; lang?: string }) {
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? !tool.done; // abierto mientras corre; colapsado al acabar
  const isCli = tool.name.endsWith(".cli");
  const output = isCli ? tool.output : stripAnsi(tool.output);
  const params = toolInputJson(tool.input);
  return (
    <View style={[styles.toolBlock, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
      <Pressable onPress={() => setUserOpen(!open)} style={styles.toolHead}>
        {!tool.done ? (
          <ActivityIndicator size="small" color={tokens.textMuted} />
        ) : tool.success !== false ? (
          <Check size={13} color={tokens.success} />
        ) : (
          <X size={13} color={tokens.warning} />
        )}
        {/* Consola del servidor (CLI): glifo de terminal esmeralda + título fijo,
            espejo del bloque "Consola del servidor / Ver historial" de la web. */}
        {isCli ? <TerminalSquare size={13} color={tokens.success} /> : null}
        <Text numberOfLines={1} style={[styles.toolName, { color: tokens.textSecondary }]}>
          {isCli ? (t.serverConsole ?? "Consola del servidor") : tool.name}
        </Text>
        {/* Enlace "Ver historial" al terminar un turno CLI con éxito (paridad web). */}
        {isCli && tool.done && tool.success !== false ? (
          <Text style={[styles.toolHistLink, { color: tokens.textMuted }]}>{t.viewHistory ?? "Ver historial"}</Text>
        ) : null}
        <ChevronDown size={13} color={tokens.textMuted} style={{ marginLeft: isCli ? 4 : "auto", transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
      </Pressable>
      {open ? (
        isCli ? (
          // CLI: el output es salida cruda de terminal → render ANSI nativo.
          (output ? (
            <View style={[styles.toolBody, { borderTopColor: tokens.border, padding: 6 }]}>
              <AnsiTerminalView output={output} running={!tool.done} theme={theme} labels={ansiTerminalLabels(lang)} />
            </View>
          ) : null)
        ) : (params || output) ? (
          <View style={[styles.toolBody, { borderTopColor: tokens.border }]}>
            {params ? (
              <>
                <Text style={[styles.toolParamLabel, { color: tokens.textMuted }]}>{t.toolParams ?? "Parámetros"}</Text>
                <Text selectable style={[styles.toolOutput, { backgroundColor: "#0b0f15" }]}>{params}</Text>
              </>
            ) : null}
            {output ? <Text selectable style={styles.toolOutput}>{output}</Text> : null}
          </View>
        ) : null
      ) : null}
    </View>
  );
}
