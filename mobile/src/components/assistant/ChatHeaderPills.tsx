// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React, { useEffect, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Check, Copy, CornerUpLeft, Folder, MessageSquare, Minimize2, Sparkles } from "lucide-react-native";
import type { AssistantContextWindow } from "../../features/assistant/types";
import { withAlpha, type ThemeTokens } from "../../theme/colors";
import type { AssistantStrings } from "./types";
import { styles } from "./ChatHeaderPills.styles";
import { formatTokens } from "./format";

// Violeta del agente custom (paridad con el badge de agente de la web).
export const AGENT_VIOLET = "#8b5cf6";

// Cronómetro del stream de la cabecera: tickea cada segundo mientras el cliente
// transmite. `Mm Ss` (omite minutos si 0). Paridad con `StreamTimer` de la web.
function HeaderStreamTimer({ startedAt, color }: { startedAt: number | null; color: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return null;
  const secs = Math.max(0, Math.floor((now - startedAt) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return <Text style={{ fontSize: 10, fontWeight: "600", color }}>{m > 0 ? `${m}m ${s}s` : `${s}s`}</Text>;
}

// ── Cabecera de la conversación (pills de identidad + scope + Terminal) ──────
// Espejo compacto de la top bar de `ChatPane.tsx` (AgentInfoChips): pill de
// identidad del agente (violeta), pill "Volver al líder" si el chat es un worker
// delegado, chip de proyecto o "Chat suelto", tokens, ID y estado del stream.
export const ChatHeaderPills = React.memo(function ChatHeaderPills({
  agentName,
  projectTitle, leaderConversationId, onBackToLeader,
  conversationId, tokensTotal, assistantTurns, tokensEstimated, language,
  streaming, streamStartedAt, ctx, compacting, onCompact,
  t, tokens,
}: {
  agentName?: string | null;
  /** Título del proyecto al que pertenece el chat (chip de proyecto). Null = suelto. */
  projectTitle?: string | null;
  /** Chat del líder si el activo es un worker delegado (pill "Volver al líder"). */
  leaderConversationId?: string | null;
  conversationId?: string | null;
  tokensTotal?: number;
  assistantTurns?: number;
  tokensEstimated?: boolean;
  language?: string;
  onBackToLeader?: () => void;
  /** Este cliente transmite ahora (cronómetro) + inicio del stream. */
  streaming?: boolean;
  streamStartedAt?: number | null;
  /** Ventana de contexto estimada (medidor "ctx NN%" + gating de Compactar). */
  ctx?: AssistantContextWindow | null;
  compacting?: boolean;
  onCompact?: () => void;
  t: AssistantStrings;
  tokens: ThemeTokens;
}) {
  const [copiedId, setCopiedId] = useState(false);
  const AMBER = "#f59e0b";
  const ctxPct = ctx && ctx.limit > 0 ? Math.round(ctx.ratio * 100) : 0;
  const ctxHot = !!ctx && ctx.ratio >= 0.9;
  const ctxColor = ctxHot ? tokens.danger : ctx?.warn ? AMBER : tokens.textMuted;
  const showCtx = !!ctx?.enabled && ctx.limit > 0 && (ctx.warn || ctx.ratio >= 0.5);
  const showCompact = !!ctx?.warn && !streaming && !!onCompact;
  const compactColor = ctxHot ? tokens.danger : AMBER;
  return (
    <View style={[styles.chatHeadBar, { borderBottomColor: tokens.border }]}>
      <View style={styles.chatHeadSummary}>
        {tokensTotal && tokensTotal > 0 ? <Text accessibilityLabel={`${formatTokens(tokensTotal, language)} ${language?.startsWith("es") ? "tokens gastados" : "tokens used"}, ${assistantTurns ?? 0} ${language?.startsWith("es") ? "turnos" : "turns"}`} style={{ fontSize: 10, fontWeight: "600", color: tokens.textMuted }}>{`Σ ${formatTokens(tokensTotal, language)}${tokensEstimated ? "~" : ""} tok · ${assistantTurns ?? 0}`}</Text> : null}
        {conversationId ? <Pressable onPress={() => { void Clipboard.setStringAsync(conversationId).then(() => { setCopiedId(true); setTimeout(() => setCopiedId(false), 1500); }).catch(() => undefined); }} accessibilityLabel={copiedId ? t.copied : (language?.startsWith("es") ? "Copiar ID chat" : "Copy chat ID")}
          style={[styles.chatHeadScopePill, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
          {copiedId ? <Check size={11} color={tokens.textMuted} /> : <Copy size={11} color={tokens.textMuted} />}
          <Text style={[styles.chatHeadScopeText, { color: tokens.textMuted }]}>{copiedId ? t.copied : "ID chat"}</Text>
        </Pressable> : null}
        {/* Proyecto del chat: chip de proyecto (primary) o "Chat suelto" (gris). */}
        {projectTitle ? (
          <View style={[styles.chatHeadScopePill, styles.chatHeadProject, { borderColor: withAlpha(tokens.brand, 0.3), backgroundColor: withAlpha(tokens.brand, 0.1) }]}>
            <Folder size={11} color={tokens.brand} />
            <Text numberOfLines={1} ellipsizeMode="head" style={[styles.chatHeadScopeText, { color: tokens.brand }]}>{projectTitle}</Text>
          </View>
        ) : (
          <View style={[styles.chatHeadScopePill, styles.chatHeadProject, { borderColor: withAlpha(tokens.textMuted, 0.3), backgroundColor: withAlpha(tokens.textMuted, 0.08) }]}>
            <MessageSquare size={10} color={tokens.textMuted} />
            <Text numberOfLines={1} style={[styles.chatHeadScopeText, { color: tokens.textMuted }]}>{t.chatLooseScope ?? "Chat suelto"}</Text>
          </View>
        )}
      </View>
      {agentName || (leaderConversationId && onBackToLeader) || showCtx || showCompact || streaming ? (
        <View style={styles.chatHeadDetails}>
          {agentName ? (
            // Pill de identidad del agente activo (violeta, paridad con el botón de
            // agente de la web).
            <View style={[styles.chatHeadAgentPill, { borderColor: withAlpha(AGENT_VIOLET, 0.4), backgroundColor: withAlpha(AGENT_VIOLET, 0.1) }]}>
              <Sparkles size={11} color={AGENT_VIOLET} />
              <Text numberOfLines={1} style={[styles.chatHeadAgentName, { color: tokens.textPrimary }]}>{agentName}</Text>
            </View>
          ) : null}
          {/* Volver al chat del líder: solo cuando el chat activo es un worker delegado. */}
          {leaderConversationId && onBackToLeader ? (
            <Pressable
              onPress={onBackToLeader}
              style={[styles.chatHeadScopePill, { borderColor: withAlpha(tokens.brand, 0.3), backgroundColor: withAlpha(tokens.brand, 0.1) }]}
              accessibilityLabel={t.backToLeader ?? "Volver al chat del líder"}
            >
              <CornerUpLeft size={11} color={tokens.brand} />
              <Text numberOfLines={1} style={[styles.chatHeadScopeText, { color: tokens.brand }]}>{t.backToLeader ?? "Volver al chat del líder"}</Text>
            </Pressable>
          ) : null}
          {/* Cluster derecho: medidor ctx% + botón Compactar + cronómetro de stream. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            {showCtx ? (
              <Text style={{ fontSize: 10, fontWeight: "600", color: ctxColor }}>{`ctx ${ctxPct}%`}</Text>
            ) : null}
            {showCompact ? (
              <Pressable
                onPress={onCompact}
                disabled={compacting}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: withAlpha(compactColor, 0.4), backgroundColor: withAlpha(compactColor, 0.1), borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, opacity: compacting ? 0.6 : 1 }}
                accessibilityLabel={t.compact ?? "Compactar"}
              >
                {compacting ? <ActivityIndicator size="small" color={compactColor} /> : <Minimize2 size={11} color={compactColor} />}
                <Text style={{ fontSize: 10, fontWeight: "600", color: compactColor }}>{compacting ? (t.compacting ?? "Compactando…") : (t.compact ?? "Compactar")}</Text>
              </Pressable>
            ) : null}
            {streaming ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <ActivityIndicator size="small" color={tokens.success} />
                <HeaderStreamTimer startedAt={streamStartedAt ?? null} color={tokens.success} />
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
      {/* Terminal se abre desde la barra de controles del prompt. */}
    </View>
  );
});
