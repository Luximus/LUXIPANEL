// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React, { createContext, useContext } from "react";
import { Pressable, Text, View } from "react-native";
import { ArrowRight, Eye, List, RefreshCw, RotateCcw } from "lucide-react-native";
import type { ThemeTokens } from "../../theme/colors";
import type { AssistantStrings } from "./types";
import { styles } from "./TurnQuickReplies.styles";

/**
 * ¿Se puede despachar un envío ahora mismo? (`sendQuick` del controller lo
 * rechaza si hay un run vivo, la conexión está bloqueada o no hay token).
 *
 * Va por CONTEXTO y no por props porque el padre directo (`TurnView`) es un
 * componente de presentación puro que no conoce el estado del composer: la
 * pantalla (`ChatScreen`) envuelve la lista de turnos con el proveedor y los
 * chips lo leen aquí. Default `true` ⇒ sin proveedor, el comportamiento es el
 * de siempre.
 */
export const AssistantSendGate = createContext<{ canSend: boolean }>({ canSend: true });

/** Quick-replies por turno (bajo el último turno terminado): Reescribe /
 *  Resúmelo / Continúa / Reintentar — envían un prompt como siguiente turno.
 *  Si el envío no procede (IA corriendo, sin token), los chips se atenúan y no
 *  responden al toque en vez de "no hacer nada" en silencio. */
export function TurnQuickReplies({ t, tokens, onAnswer, disabled }: {
  t: AssistantStrings;
  tokens: ThemeTokens;
  onAnswer: (text: string) => boolean | void;
  /** Fuerza el estado desactivado (si no se pasa, manda el `AssistantSendGate`). */
  disabled?: boolean;
}) {
  const gate = useContext(AssistantSendGate);
  const off = disabled ?? !gate.canSend;
  const items: Array<{ label: string; icon: React.ReactNode; prompt: string }> = [
    { label: t.quickRewrite ?? "Reescribe", icon: <RefreshCw size={11} color={tokens.textMuted} />, prompt: t.quickRewritePrompt ?? "Reescribe tu respuesta anterior de otra forma, más clara y mejor estructurada." },
    { label: t.quickSummarize ?? "Resúmelo", icon: <List size={11} color={tokens.textMuted} />, prompt: t.quickSummarizePrompt ?? "Resume tu respuesta anterior en 3 puntos clave." },
    { label: t.quickContinue ?? "Continúa", icon: <ArrowRight size={11} color={tokens.textMuted} />, prompt: t.quickContinuePrompt ?? "Continúa donde lo dejaste." },
    { label: t.quickRetry ?? "Reintentar", icon: <RotateCcw size={11} color={tokens.textMuted} />, prompt: t.quickRetryPrompt ?? "Reintenta: vuelve a responder a mi última petición desde cero." },
    { label: t.quickReview ?? "Revisar", icon: <Eye size={11} color={tokens.textMuted} />, prompt: t.quickReviewPrompt ?? "Revisa los últimos cambios que hiciste." },
  ];
  return (
    <>
      <View style={[styles.turnDivider, { backgroundColor: tokens.border }]} />
      <View style={styles.quickTurnRow}>
        {items.map((q) => (
          <Pressable
            key={q.label}
            onPress={() => onAnswer(q.prompt)}
            disabled={off}
            accessibilityState={{ disabled: off }}
            style={({ pressed }) => [
              styles.quickTurnChip,
              { borderColor: tokens.border, backgroundColor: tokens.bgInput, opacity: off ? 0.45 : pressed ? 0.7 : 1 },
            ]}
          >
            {q.icon}
            <Text style={[styles.quickTurnText, { color: tokens.textSecondary }]}>{q.label}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}
