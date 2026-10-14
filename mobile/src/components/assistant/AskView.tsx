// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Check, HelpCircle, Send, Square } from "lucide-react-native";
import type { AssistantAskQuestion } from "../../features/assistant/types";
import type { ThemeTokens } from "../../theme/colors";
import type { AssistantStrings } from "./types";
import { assistantChatMessages } from "./format";
import { turnBoxStyles } from "./turn-box.styles";
import { styles } from "./AskView.styles";

/** Preguntas interactivas del agente: texto / opción única / multi + "otra
 *  respuesta", con botón Responder. Compone una respuesta legible y la envía
 *  como siguiente turno. */
export function AskView({
  questions, kind, interactive, t, tokens, onAnswer,
}: {
  questions: AssistantAskQuestion[]; kind?: "plan-approval"; interactive: boolean; t: AssistantStrings; tokens: ThemeTokens;
  /** `false` ⇒ el envío no se despachó (run vivo / sin token): se revierte el
   *  estado "Enviando…" para que la respuesta se pueda reintentar. */
  onAnswer: (text: string, opts?: { planDecision?: "approve" }) => boolean | void;
}) {
  const [single, setSingle] = useState<Record<string, string>>({});
  const [multi, setMulti] = useState<Record<string, string[]>>({});
  const [textVal, setTextVal] = useState<Record<string, string>>({});
  const [other, setOther] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  const valueFor = (q: AssistantAskQuestion): string[] => {
    const extra = (other[q.id] ?? "").trim();
    if (q.type === "text") return [(textVal[q.id] ?? "").trim()].filter(Boolean);
    if (q.type === "multi") { const base = multi[q.id] ?? []; return extra ? [...base, extra] : base; }
    const sel = extra ? extra : (single[q.id] ?? "");
    return sel ? [sel] : [];
  };
  const allAnswered = questions.every((q) => q.type === "multi" || valueFor(q).length > 0);
  const submit = (approvedChoice?: string) => {
    if (!interactive || sent || (!allAnswered && !approvedChoice)) return;
    const first = questions[0];
    const none = t.askNone ?? "(ninguno)";
    // El prefijo de la respuesta compuesta SE ENVÍA al agente y se pinta en la
    // burbuja del usuario: va en el idioma activo de la app, no en español fijo.
    const answersPrefix = assistantChatMessages().askAnswersPrefix;
    // Una sola pregunta `multi` sin nada marcado es una respuesta válida
    // ("ninguna de las opciones"), igual que en el caso multipregunta: sin este
    // fallback el botón se veía activo y no hacía absolutamente nada.
    const body = questions.length === 1 && first
      ? ((approvedChoice ?? valueFor(first).join(", ")) || (first.type === "multi" ? none : ""))
      : `${answersPrefix}\n${questions.map((q) => `- ${q.text}: ${valueFor(q).join(", ") || none}`).join("\n")}`;
    if (!body.trim()) return;
    setSent(true);
    // El envío puede no despacharse (run vivo, cola drenando): sin revertir, el
    // botón quedaba en "Enviando…" para siempre y la respuesta se perdía.
    const approved = kind === "plan-approval" && questions.length === 1 && first?.type === "single"
      && !!first.options?.[0] && (approvedChoice === first.options[0]
        || (!(other[first.id] ?? "").trim() && single[first.id] === first.options[0]));
    if (onAnswer(body, approved ? { planDecision: "approve" } : undefined) === false) setSent(false);
  };

  if (!interactive) {
    return (
      <View style={[turnBoxStyles.turnBox, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
        <View style={turnBoxStyles.turnBoxTitleRow}>
          <HelpCircle size={14} color={tokens.textMuted} />
          <Text style={[turnBoxStyles.turnBoxTitle, { color: tokens.textSecondary }]}>{t.askedQuestionOne ?? "El asistente hizo una pregunta"}</Text>
        </View>
        {questions.map((q) => <Text key={q.id} style={[turnBoxStyles.turnBoxBody, { color: tokens.textMuted }]}>• {q.text}</Text>)}
      </View>
    );
  }
  return (
    <View style={[turnBoxStyles.turnBox, { borderColor: tokens.brand, backgroundColor: tokens.brandDim }]}>
      <View style={turnBoxStyles.turnBoxTitleRow}>
        <HelpCircle size={14} color={tokens.brand} />
        <Text style={[turnBoxStyles.turnBoxTitle, { color: tokens.textPrimary }]}>{t.askNeedsDecision ?? "El asistente necesita tu decisión para continuar"}</Text>
      </View>
      {questions.map((q) => (
        <View key={q.id} style={styles.askQuestion}>
          <Text style={[turnBoxStyles.askQuestionText, { color: tokens.textPrimary }]}>{q.text}</Text>
          {q.type === "text" ? (
            <TextInput
              value={textVal[q.id] ?? ""}
              onChangeText={(v) => setTextVal((s) => ({ ...s, [q.id]: v }))}
              placeholder={t.askAnswerPlaceholder ?? "Escribe tu respuesta…"}
              placeholderTextColor={tokens.textMuted}
              style={[styles.askInput, { color: tokens.textPrimary, borderColor: tokens.border, backgroundColor: tokens.bgInput }]}
            />
          ) : (
            <>
              <View style={styles.askOptions}>
                {(q.options ?? []).map((opt) => {
                  const selected = q.type === "multi"
                    ? (multi[q.id] ?? []).includes(opt)
                    : (single[q.id] ?? "") === opt && !(other[q.id] ?? "").trim();
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => {
                        if (q.type === "multi") {
                          setMulti((s) => { const cur = s[q.id] ?? []; return { ...s, [q.id]: cur.includes(opt) ? cur.filter((o) => o !== opt) : [...cur, opt] }; });
                        } else {
                          setSingle((s) => ({ ...s, [q.id]: opt }));
                          setOther((s) => ({ ...s, [q.id]: "" }));
                          if (kind === "plan-approval" && questions.length === 1 && opt === q.options?.[0]) submit(opt);
                        }
                      }}
                      style={[styles.askOption, selected ? { backgroundColor: tokens.brand, borderColor: tokens.brand } : { backgroundColor: tokens.bgInput, borderColor: tokens.border }]}
                    >
                      {q.type === "multi" ? (selected ? <Check size={12} color="#fff" /> : <Square size={12} color={tokens.textMuted} />) : null}
                      <Text style={[styles.askOptionText, { color: selected ? "#fff" : tokens.textSecondary }]}>{opt}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                value={other[q.id] ?? ""}
                onChangeText={(v) => { setOther((s) => ({ ...s, [q.id]: v })); if (q.type !== "multi" && v.trim()) setSingle((s) => ({ ...s, [q.id]: "" })); }}
                placeholder={t.askOtherPlaceholder ?? "Otra respuesta…"}
                placeholderTextColor={tokens.textMuted}
                style={[styles.askInput, { color: tokens.textPrimary, borderColor: tokens.border, backgroundColor: tokens.bgInput, borderStyle: "dashed" }]}
              />
            </>
          )}
        </View>
      ))}
      <Pressable onPress={() => submit()} disabled={!allAnswered || sent} style={[styles.askSubmit, { backgroundColor: tokens.brand, opacity: (!allAnswered || sent) ? 0.5 : 1 }]}>
        {sent ? <ActivityIndicator size="small" color="#fff" /> : <Send size={13} color="#fff" />}
        <Text style={styles.askSubmitText}>{sent ? (t.askSending ?? "Enviando…") : (t.askRespond ?? "Responder")}</Text>
      </Pressable>
    </View>
  );
}
