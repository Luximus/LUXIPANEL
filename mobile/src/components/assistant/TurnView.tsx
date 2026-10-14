import { nativeText } from '../../i18n/native-text';
import { localizeServerError } from '../../lib/server-error-localization';
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React, { useState, useSyncExternalStore } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronDown,
  CloudOff,
  Languages,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Square,
  Users,
} from "lucide-react-native";
import type { ChatMsg } from "../../features/assistant/types";
import { extractModifiedFiles } from "../../features/assistant/modified-files";
import type { ThemeTokens } from "../../theme/colors";
import { stripAnsi } from "../../lib/strip-ansi";
import { MarkdownView } from "../MarkdownView";
import { PROVIDER_META, ProviderIcon } from "../ProviderIcon";
import { accentBg } from "./chat-pane.styles";
import type { AssistantStrings } from "./types";
import { formatDuration, formatTokens, formatTurnTimestamp } from "./format";
import { TypingDots } from "./TypingDots";
import { ToolBlockView } from "./ToolBlockView";
import { ModifiedFilesView } from "./ModifiedFilesView";
import { PermissionView } from "./PermissionView";
import { AskView } from "./AskView";
import { CompactionDivider } from "./CompactionDivider";
import { CopyBtn } from "./CopyBtn";
import { TurnAttachments } from "./TurnAttachments";
import { NativeThoughtLine } from "./NativeThoughtLine";
import { NativeSpeakButton } from "./NativeSpeakButton";
import { bubblePrefs } from "../../lib/bubble-prefs";
// El botón Editar comparte los estilos de acción de burbuja con `CopyBtn`.
import { styles as copyBtnStyles } from "./CopyBtn.styles";
import { TurnQuickReplies } from "./TurnQuickReplies";
import { styles } from "./TurnView.styles";

/** Turno de chat estilo LUXIPANEL: usuario a la derecha (burbuja brand, hora
 *  debajo); asistente a la izquierda con avatar del proveedor + línea meta
 *  (hora · duración · tokens) y burbuja markdown a ancho completo.
 *
 *  MEMOIZADA (`React.memo`): sin memo, CADA token del stream re-renderizaba
 *  TODOS los turnos del hilo — y cada turno de asistente re-parsea su markdown
 *  (`MarkdownView`) y sus bloques de herramienta. Con 40 turnos y una respuesta
 *  de 800 deltas eso son ~32.000 re-renders de burbuja por respuesta: es la
 *  causa del "chat que va a tirones mientras escribe la IA".
 *
 *  El `rev` (ver `turnRevision`) es imprescindible: el reducer del stream MUTA
 *  el turno vivo en sitio, así que su identidad de objeto NO cambia y un memo a
 *  secas lo dejaría congelado. Los callbacks y `t`/`tokens` deben venir con
 *  identidad estable (ver los `useCallback` de `ChatScreen`). */
export const TurnView = React.memo(function TurnView({
  msg,
  provider,
  panelId,
  token,
  agentName,
  ttsAvailable,
  voiceName,
  autoSpeak,
  conversationId,
  tokens,
  theme,
  t,
  isLast,
  onAnswer,
  onPermission,
  onRetry,
  onNewChat,
  onEdit,
  lang,
}: {
  msg: ChatMsg;
  panelId: string;
  token: string;
  agentName?: string | null;
  ttsAvailable?: boolean;
  voiceName?: string;
  autoSpeak?: boolean;
  conversationId?: string | null;
  /** Firma del contenido MUTABLE del turno (`turnRevision`): no se pinta; existe
   *  para que la comparación superficial del memo detecte los deltas del stream,
   *  que mutan `msg` en sitio. */
  rev?: string;
  provider: string;
  tokens: ThemeTokens;
  theme: "dark" | "light";
  t: AssistantStrings;
  lang?: string;
  isLast?: boolean;
  /** `false` ⇒ el envío no se despachó (run vivo / sin token). */
  onAnswer?: (text: string, opts?: { planDecision?: "approve" }) => boolean | void;
  onPermission?: (requestId: string, decision: "allow" | "deny" | "always", tool?: string) => void;
  onRetry?: () => void;
  onNewChat?: () => void;
  /** Editar este mensaje de usuario (solo el último turno mientras corre la IA,
   *  paridad web): siembra el texto en el composer para reenviarlo. */
  onEdit?: (text: string) => void;
}) {
  const bubbleProvider = msg.provider || provider;
  useSyncExternalStore(bubblePrefs.subscribe, () => JSON.stringify(bubblePrefs.get(bubbleProvider)), () => "{}");
  const prefs = bubblePrefs.get(bubbleProvider);
  // Divisor de compactación: reemplaza el turno por completo.
  if (msg.role === "assistant" && msg.summarizedCount && msg.summarizedCount > 0) {
    return <CompactionDivider msg={msg} t={t} tokens={tokens} />;
  }
  const meta = PROVIDER_META[bubbleProvider] ?? null;
  if (msg.role === "user" && msg.auto) {
    return <View style={{ alignItems: "center", marginVertical: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bgInput, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
        <Users size={12} color={tokens.textMuted} />
        <Text style={{ color: tokens.textMuted, fontSize: 10 }}>{(lang ?? "es").startsWith("es") ? "Aviso automático del equipo" : "Automatic team notice"}</Text>
      </View>
    </View>;
  }
  if (msg.role === "user") {
    const userInk = theme === "dark" ? "#f4f4f5" : "#312e81";
    const userMuted = theme === "dark" ? "#d4d4d8" : "#55518c";
    return (
      <View style={styles.turnUser}>
        <View style={[styles.userBubble, {
          backgroundColor: theme === "dark" ? "#30343b" : "#e0e7ff",
          borderColor: theme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(49,46,129,0.10)",
        }]}>
          {msg.attachments?.length ? <TurnAttachments panelId={panelId} token={token} items={msg.attachments} language={lang} tokens={tokens} /> : msg.attachmentName ? (
            <View style={[styles.attChip, { borderColor: theme === "dark" ? "rgba(255,255,255,0.18)" : "rgba(49,46,129,0.18)", backgroundColor: theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.45)" }]}>
              <Paperclip size={11} color={userMuted} />
              <Text numberOfLines={1} style={[styles.attChipText, { color: userInk }]}>{msg.attachmentName}</Text>
            </View>
          ) : null}
          {prefs.input && msg.content ? <RawDisclosure label={msg.raw ? ((lang ?? "es").startsWith("es") ? "Texto enviado al agente (inglés)" : "Text sent to agent (English)") : ((lang ?? "es").startsWith("es") ? "Entrada original" : "Original input")} text={msg.raw ?? msg.content} tokens={tokens} /> : null}
          {msg.content ? <Text style={[styles.userText, { color: userInk }]}>{msg.content}</Text> : null}
          {/* Acciones de la burbuja de usuario (paridad web): copiar y —solo en el
              último turno mientras corre la IA— editar para reenviar. */}
          {msg.content || msg.createdAt ? (
            <View style={[styles.bubbleActionsUser, { borderTopColor: theme === "dark" ? "rgba(255,255,255,0.15)" : "rgba(49,46,129,0.15)" }]}>
              {msg.content ? <CopyBtn text={msg.content} t={t} color={userMuted} /> : null}
              {onEdit && msg.content ? (
                <Pressable
                  onPress={() => onEdit(msg.content)}
                  hitSlop={8}
                  style={copyBtnStyles.bubbleActionBtn}
                  accessibilityLabel={t.editResend ?? "Editar"}
                >
                  <Pencil size={12} color={userMuted} />
                  <Text style={[copyBtnStyles.bubbleActionText, { color: userMuted }]}>{t.editResend ?? "Editar"}</Text>
                </Pressable>
              ) : null}
              {msg.createdAt ? <Text style={[styles.userTime, { color: userMuted }]}>{formatTurnTimestamp(msg.createdAt, lang)}</Text> : null}
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  const accent = meta?.tint ?? tokens.brand;
  const tools = msg.tools ?? [];
  const cliTool = tools.find((tool) => tool.name.endsWith(".cli"));
  const visibleTools = prefs.terminalLive ? (cliTool ? tools.filter((tool) => tool.name.endsWith(".cli")) : tools) : [];
  const historyTool = prefs.terminalLive && msg.cliHistoryLog && !cliTool
    ? { id: "cli-history", name: "history.cli", output: msg.cliHistoryLog, done: true, success: true }
    : null;
  const cliRaw = cliTool?.output ?? msg.cliHistoryLog ?? "";
  const cliRun = !!cliTool || !!msg.cli;
  const hasThought = !!msg.pending || (prefs.terminalLive && cliRun);
  const hasAnswer = !!(msg.content || msg.attachments?.length || msg.status || msg.ask?.length || msg.permission || msg.error || msg.interrupted || msg.stopped || msg.translationError || (msg.pending && !visibleTools.length) || (cliRun && !msg.pending));
  const planPreview = msg.askKind === "plan-approval" && !msg.pending
    ? /^(?:\*\*)?(?:Resumen|Summary)(?:\*\*)?:\s*(.+?)\n\s*\n((?:Plan completo|Full plan):[\s\S]+)$/i.exec(msg.content.trim())
    : null;
  return (
    <View style={styles.turnAssistant}>
      <View style={styles.aHead}>
        <View style={[styles.avatar, { backgroundColor: accentBg(accent) }]}>
          {agentName ? <Sparkles size={14} color="#a78bfa" /> : meta ? (
            <ProviderIcon id={bubbleProvider} size={14} color={accent} />
          ) : bubbleProvider ? (
            <Text style={[styles.avatarInitial, { color: accent }]}>{bubbleProvider.charAt(0).toUpperCase()}</Text>
          ) : (
            <Bot size={14} color={tokens.textMuted} />
          )}
        </View>
        {/* Nombre del agente/proveedor (paridad web: fila-header con avatar + nombre). */}
        <Text numberOfLines={1} style={[styles.aName, { color: tokens.textSecondary }]}>{agentName ?? meta?.label ?? (bubbleProvider || "IA")}</Text>
        {agentName && meta ? <View style={[styles.providerBadge, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}><ProviderIcon id={bubbleProvider} size={11} color={accent} /><Text numberOfLines={1} style={{ fontSize: 10, color: tokens.textMuted }}>{meta.label}</Text></View> : null}
        {msg.pending ? <ActivityIndicator size="small" color={tokens.brand} /> : msg.error ? <AlertCircle size={15} color={tokens.danger} /> : msg.interrupted ? <CloudOff size={15} color={tokens.warning} /> : msg.stopped ? <Square size={14} color={tokens.textMuted} /> : <CheckCircle2 size={15} color={tokens.success} />}
        <View style={styles.metaRow}>
          {msg.createdAt && !msg.pending ? (
            <Text style={[styles.metaText, { color: tokens.textMuted }]}>{formatTurnTimestamp(msg.createdAt, lang)}</Text>
          ) : null}
          {typeof msg.durationMs === "number" && !msg.pending ? (
            <Text style={[styles.metaText, { color: tokens.textMuted }]}>{`· ${formatDuration(msg.durationMs)}`}</Text>
          ) : null}
          {msg.tokens && msg.tokens.total > 0 && !msg.pending ? (
            <Text style={[styles.metaText, { color: tokens.textMuted }]}>
              {`· ${formatTokens(msg.tokens.total)}${msg.tokens.estimated ? "~" : ""} tok`}
            </Text>
          ) : null}
        </View>
      </View>
      {(hasThought || visibleTools.length > 0 || !!historyTool || hasAnswer) ? <View style={[styles.aBubble, { backgroundColor: tokens.bgSecondary, borderColor: tokens.border }]}>
        {hasThought ? <NativeThoughtLine raw={prefs.terminalLive ? cliRaw : ""} answer={msg.content} pending={msg.pending} status={msg.error ? "failed" : msg.stopped ? "stopped" : "done"} tokens={tokens} language={lang} /> : null}
        {/* Herramientas (params + output / terminal ANSI) PRIMERO; el texto/resumen
            va debajo, como en la web (proceso plegado arriba, respuesta abajo). */}
        {visibleTools.length > 0 || historyTool ? (
          <View style={{ gap: 5 }}>
            {visibleTools.map((tool) => (
              <ToolBlockView key={tool.id} tool={tool} tokens={tokens} theme={theme} t={t} lang={lang} />
            ))}
            {historyTool ? <ToolBlockView tool={historyTool} tokens={tokens} theme={theme} t={t} lang={lang} /> : null}
          </View>
        ) : !prefs.terminalLive && msg.pending && cliRun ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 }}>
            <ActivityIndicator size="small" color={tokens.textMuted} />
            <Text style={[styles.metaText, { color: tokens.textMuted }]}>{(lang ?? "es").startsWith("es") ? "Trabajando en segundo plano…" : "Working in background…"}</Text>
          </View>
        ) : null}
        {/* Archivos modificados (modificados / eliminados, colapsable). */}
        {(() => {
          if (!prefs.modifiedFiles || msg.role !== "assistant" || isUserPending(msg)) return null;
          const files = extractModifiedFiles(msg);
          return files.length > 0 ? <ModifiedFilesView files={files} panelId={panelId} token={token} language={lang} t={t} tokens={tokens} /> : null;
        })()}
        {msg.attachments?.length ? <TurnAttachments panelId={panelId} token={token} items={msg.attachments} language={lang} tokens={tokens} /> : null}
        {planPreview ? (
          <PlanPreview summary={planPreview[1]!} detail={planPreview[2]!} tokens={tokens} lang={lang} t={t} />
        ) : msg.content ? (
          <MarkdownView
            text={stripAnsi(msg.content)}
            tokens={tokens}
            textColor={tokens.textPrimary}
            copyLabel={t.copy}
            copiedLabel={t.copied}
          />
        ) : msg.status && msg.pending ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <ActivityIndicator size="small" color={tokens.textMuted} />
            <Text style={[styles.metaText, { color: tokens.textMuted }]}>
              {msg.status === "translating" ? (t.statusTranslating ?? "Traduciendo…") : (t.statusWorking ?? "Trabajando…")}
            </Text>
          </View>
        ) : msg.pending && !(msg.tools?.length) ? (
          <TypingDots color={tokens.textMuted} />
        ) : !msg.pending && cliRun && !msg.content && !msg.error && !msg.stopped ? (
          <Text style={[styles.metaText, { color: tokens.textMuted, fontStyle: "italic" }]}>{(lang ?? "es").startsWith("es") ? "El agente terminó sin una respuesta final; revisa el bloque de proceso." : "The agent finished without a final answer; review the process block."}</Text>
        ) : null}
        {/* Copiar la respuesta del asistente (paridad web): solo cuando ya hay
            texto terminado (no pendiente, sin error). */}
        {msg.content && !msg.pending && !msg.error ? (
          <View style={styles.bubbleActions}>
            <CopyBtn text={stripAnsi(msg.content)} t={t} color={tokens.textMuted} />
            {ttsAvailable ? <NativeSpeakButton panelId={panelId} token={token} text={msg.content} conversationId={conversationId} voiceName={voiceName} autoPlay={autoSpeak && isLast} tokens={tokens} language={lang} /> : null}
          </View>
        ) : null}
        {/* Preguntas interactivas (ask). */}
        {msg.ask && msg.ask.length > 0 ? (
          <AskView
            questions={msg.ask}
            kind={msg.askKind}
            interactive={!!isLast && !!onAnswer && !msg.pending && !msg.stopped}
            t={t}
            tokens={tokens}
            onAnswer={(text, opts) => onAnswer?.(text, opts)}
          />
        ) : null}
        {/* Gate de permisos mid-run. */}
        {msg.permission ? (
          <PermissionView
            request={msg.permission}
            // Tras un error duro el run murió: decidir postearía un requestId
            // obsoleto y limpiaría el gate sin efecto real (igual que AskView).
            interactive={!!isLast && !!onPermission && !msg.stopped && !msg.error}
            t={t}
            tokens={tokens}
            onDecide={(decision) => onPermission?.(msg.permission!.id, decision, msg.permission!.tool)}
          />
        ) : null}
        {/* Quick-replies: solo en el último turno terminado con respuesta. */}
        {isLast && onAnswer && msg.content && !msg.pending && !msg.stopped && !msg.error && !(msg.ask && msg.ask.length) ? (
          <TurnQuickReplies t={t} tokens={tokens} onAnswer={onAnswer} />
        ) : null}
        {/* Conexión interrumpida (la tarea sigue en el servidor). */}
        {msg.interrupted && !msg.error ? (
          <View style={[styles.stateRow, { borderColor: "rgba(251,191,36,0.45)", backgroundColor: "rgba(251,191,36,0.10)" }]}>
            <CloudOff size={13} color={tokens.warning} />
            <Text style={[styles.stateText, { color: tokens.warning }]}>{t.connectionInterrupted ?? "Conexión interrumpida — la tarea sigue en el servidor; reanudando al volver…"}</Text>
          </View>
        ) : null}
        {/* Respuesta sin traducir (fallo de traducción): aviso colapsable. */}
        {msg.translationError ? <TranslationErrorNotice detail={msg.translationError} t={t} tokens={tokens} /> : null}
        {/* Proceso parado. */}
        {msg.stopped && !msg.error ? (
          <View style={[styles.stateRow, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
            <Square size={11} color={tokens.textMuted} />
            <Text style={[styles.stateText, { color: tokens.textMuted }]}>{t.processStopped ?? "Proceso parado."}</Text>
          </View>
        ) : null}
        {/* Error duro: Reintentar / Nuevo chat. */}
        {msg.error ? (
          <View style={[styles.errBox, { borderColor: "rgba(244,63,94,0.45)", backgroundColor: "rgba(244,63,94,0.10)" }]}>
            <View style={styles.errTitleRow}>
              <AlertCircle size={14} color={tokens.danger} />
              <Text style={[styles.errTitle, { color: tokens.danger }]}>{t.errorTitle ?? "No se pudo completar la respuesta"}</Text>
            </View>
            <Text style={[styles.errDetail, { color: tokens.danger }]}>{msg.error === "NO_FINAL_RESPONSE"
              ? nativeText("El agente terminó sin una respuesta final; revisa el bloque de proceso.", undefined, lang)
              : localizeServerError(msg.error, lang)}</Text>
            <View style={styles.errBtnRow}>
              {onRetry ? (
                <Pressable onPress={onRetry} style={[styles.errBtn, { borderColor: "rgba(244,63,94,0.4)", backgroundColor: tokens.bgInput }]}>
                  <RefreshCw size={12} color={tokens.danger} />
                  <Text style={[styles.errBtnText, { color: tokens.danger }]}>{t.retry ?? "Reintentar"}</Text>
                </Pressable>
              ) : null}
              {onNewChat ? (
                <Pressable onPress={onNewChat} style={[styles.errBtn, { borderColor: "rgba(244,63,94,0.4)", backgroundColor: tokens.bgInput }]}>
                  <Plus size={12} color={tokens.danger} />
                  <Text style={[styles.errBtnText, { color: tokens.danger }]}>{t.startNewChat ?? "Empezar nuevo chat"}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
      </View> : null}
    </View>
  );
});

/** ¿El turno aún está streameando (pending)? Helper para no calcular archivos
 *  modificados a media respuesta (se recalcula al terminar). */
function isUserPending(msg: ChatMsg): boolean {
  return !!msg.pending;
}

function RawDisclosure({ label, text, tokens }: { label: string; text: string; tokens: ThemeTokens }) {
  const [open, setOpen] = useState(false);
  return <View style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 7, backgroundColor: tokens.bgInput, marginTop: 4 }}>
    <Pressable onPress={() => setOpen((value) => !value)} accessibilityRole="button" accessibilityLabel={label}
      style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 5 }}>
      <Text style={{ flex: 1, color: tokens.textMuted, fontSize: 10, textTransform: "uppercase" }}>{label}</Text>
      <ChevronDown size={12} color={tokens.textMuted} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
    </Pressable>
    {open ? <Text selectable style={{ color: tokens.textPrimary, fontSize: 11, lineHeight: 16, borderTopWidth: 1, borderTopColor: tokens.border, padding: 8 }}>{text}</Text> : null}
  </View>;
}

/** Enseña el resumen sin ocultar el texto íntegro que el usuario aprueba. */
function PlanPreview({ summary, detail, tokens, lang, t }: { summary: string; detail: string; tokens: ThemeTokens; lang?: string; t: AssistantStrings }) {
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 8 }}>
    <MarkdownView text={summary} tokens={tokens} textColor={tokens.textPrimary} copyLabel={t.copy} copiedLabel={t.copied} />
    <View style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, backgroundColor: tokens.bgInput, padding: 9 }}>
      <Pressable onPress={() => setOpen((value) => !value)} accessibilityRole="button"
        accessibilityLabel={nativeText("Ver plan completo", undefined, lang)}
        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={{ color: tokens.brand, fontSize: 12, fontWeight: "700", flex: 1 }}>{nativeText("Ver plan completo", undefined, lang)}</Text>
        <ChevronDown size={14} color={tokens.textMuted} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
      </Pressable>
      {open ? <View style={{ borderTopWidth: 1, borderColor: tokens.border, marginTop: 8, paddingTop: 8 }}>
        <MarkdownView text={detail} tokens={tokens} textColor={tokens.textPrimary} copyLabel={t.copy} copiedLabel={t.copied} />
      </View> : null}
    </View>
  </View>;
}

/** Aviso colapsable "mostrado sin traducir" con el motivo dentro. */
function TranslationErrorNotice({ detail, t, tokens }: { detail: string; t: AssistantStrings; tokens: ThemeTokens }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.stateRow, { borderColor: tokens.border, backgroundColor: tokens.bgInput, flexDirection: "column", alignItems: "stretch", gap: 4 }]}>
      <Pressable onPress={() => setOpen((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Languages size={13} color={tokens.textMuted} />
        <Text style={[styles.stateText, { color: tokens.textMuted, flex: 1 }]}>{t.shownUntranslated ?? "Mostrado sin traducir — la traducción no se pudo realizar"}</Text>
        <ChevronDown size={12} color={tokens.textMuted} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
      </Pressable>
      {open ? <Text style={[styles.errDetail, { color: tokens.textMuted, paddingLeft: 19 }]}>{detail}</Text> : null}
    </View>
  );
}
