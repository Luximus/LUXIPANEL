import { nativeText } from '../../i18n/native-text';
import { localizeServerError } from '../../lib/server-error-localization';
import React, { useCallback, useEffect, useRef, useState } from "react";
import { PanelText as Text } from "../../components/ui/PanelText";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { callServerApi, unwrap } from "../../api/serverApi";
import { streamDirectAgent, type DirectAgentEvent } from "../../api/directAgent";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { TablerChevronLeft, TablerSparkles } from "../../features/app/tabler-icons";

type ChatMessage = { role: "user" | "assistant"; content: string; textOriginal?: string; textTranslated?: string; ask?: DirectAgentEvent["questions"]; askKind?: "plan-approval" };
type Conversation = { id: string; title?: string };

/** Native direct session workspace. The server remains the authority for AI access. */
export function NativeAgentScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const { theme } = useTheme();
  const colors = getThemeTokens(theme === "dark");
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activity, setActivity] = useState<string | null>(null);
  const [permission, setPermission] = useState<{ id: string; title?: string; detail?: string } | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [pendingAsk, setPendingAsk] = useState<{ questions: NonNullable<DirectAgentEvent["questions"]>; kind?: "plan-approval" } | null>(null);
  const [planDecision, setPlanDecision] = useState<"approve" | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);
  const loadHistory = useCallback(async () => {
    const result = await callServerApi(panelId, token, "GET", "/api/ai/conversations?limit=30");
    if (!result.ok) return;
    const body = unwrap<{ items?: Conversation[] }>(result);
    setConversations(Array.isArray(body?.items) ? body.items.filter((item) => !!item.id) : []);
  }, [panelId, token]);
  useEffect(() => { void loadHistory(); return () => { abortRef.current?.(); }; }, [loadHistory]);
  const openConversation = async (item: Conversation) => {
    if (sending) return;
    const result = await callServerApi(panelId, token, "GET", `/api/ai/conversations/${encodeURIComponent(item.id)}/messages?limit=100`);
    if (!result.ok) { setError(result.error ?? nativeText("No se pudo abrir la conversación.")); return; }
    const body = unwrap<{ items?: ChatMessage[] }>(result);
    const history = (body?.items ?? []).filter((message) => (message.role === "user" || message.role === "assistant") && typeof message.content === "string");
    setMessages(history);
    const last = history.at(-1);
    setPendingAsk(last?.role === "assistant" && last.ask?.length ? { questions: last.ask, kind: last.askKind } : null);
    setConversationId(item.id);
    setShowHistory(false);
    setError(null);
    setSuggestions([]);
  };
  const onEvent = (event: DirectAgentEvent) => {
    if (event.type === "text" && event.delta) {
      setMessages((current) => {
        const next = [...current];
        const last = next.at(-1);
        if (last?.role === "assistant") next[next.length - 1] = { ...last, content: last.content + event.delta };
        else next.push({ role: "assistant", content: event.delta! });
        return next;
      });
      setActivity(null);
    } else if (event.type === "tool_use") setActivity(event.name ? nativeText("Usando {p0}…", {p0: String(event.name)}) : nativeText("Usando una herramienta…"));
    else if (event.type === "tool_result" || event.type === "done") setActivity(null);
    else if (event.type === "permission_request" && event.id) setPermission({ id: event.id, title: event.title, detail: event.detail });
    else if (event.type === "permission_resolved") setPermission(null);
    else if (event.type === "ask" && event.questions?.length) {
      setPendingAsk({ questions: event.questions, kind: event.kind });
      setSuggestions(event.questions.flatMap((question) => question.options ?? []));
    }
    else if (event.type === "error") setError(event.message ?? nativeText("Error del agente."));
  };
  const send = useCallback(async () => {
    const content = draft.trim();
    if (!content || sending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    setError(null);
    setSuggestions([]);
    setPendingAsk(null);
    setSending(true);
    try {
      let activeId = conversationId;
      if (!activeId) {
        const created = await callServerApi(panelId, token, "POST", "/api/ai/conversations", { firstMessage: content.slice(0, 2000) });
        activeId = unwrap<{ conversation?: { id?: string } }>(created)?.conversation?.id ?? null;
        if (!activeId) { setError(created.error ?? nativeText("No se pudo crear la conversación.")); return; }
        setConversationId(activeId);
      }
      const result = await streamDirectAgent(panelId, { messages: next.slice(-50), conversationId: activeId, ...(planDecision ? { planDecision } : {}) }, onEvent, (abort) => { abortRef.current = abort; });
      abortRef.current = null;
      setPlanDecision(null);
      if (!result.ok) setError(result.error);
      void loadHistory();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : nativeText("Error de conexión"));
    } finally {
      setSending(false);
      setActivity(null);
    }
  }, [draft, messages, panelId, token, sending, conversationId, loadHistory, planDecision]);
  const decidePermission = async (decision: "allow" | "deny") => {
    if (!permission || !conversationId) return;
    const result = await callServerApi(panelId, token, "POST", "/api/ai/agent/permission", { conversationId, requestId: permission.id, decision });
    if (!result.ok) { setError(result.error ?? nativeText("No se pudo enviar la decisión.")); return; }
    setPermission(null);
  };
  const stop = async () => {
    abortRef.current?.();
    abortRef.current = null;
    setPermission(null);
    if (conversationId) await callServerApi(panelId, token, "POST", "/api/ai/agent/stop", { conversationId });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bgPrimary }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={onBack} accessibilityLabel={nativeText("Ver módulos")} style={{ padding: 5 }}><TablerChevronLeft size={22} color={colors.textPrimary} /></Pressable>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: colors.brandDim, alignItems: "center", justifyContent: "center" }}><TablerSparkles size={21} color={colors.brand} /></View>
        <View style={{ flex: 1 }}><Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 17 }}>{nativeText("Agentes IA")}</Text><Text style={{ color: colors.textMuted, fontSize: 12 }}>{nativeText("Espacio de trabajo del servidor")}</Text></View>
        <Pressable onPress={() => { void loadHistory(); setShowHistory((value) => !value); }} accessibilityLabel={nativeText("Historial")} style={{ padding: 7 }}><Text style={{ color: colors.brand, fontWeight: "700" }}>{nativeText("Historial")}</Text></Pressable>
        <Pressable onPress={() => { if (sending) return; setMessages([]); setConversationId(null); setError(null); setSuggestions([]); setPendingAsk(null); setPlanDecision(null); setShowHistory(false); }} accessibilityLabel={nativeText("Nueva conversación")} style={{ padding: 7, opacity: sending ? 0.5 : 1 }}><Text style={{ color: colors.brand, fontWeight: "700" }}>{nativeText("Nuevo")}</Text></Pressable>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        {showHistory ? <View style={{ gap: 8 }}><Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 16 }}>{nativeText("Conversaciones recientes")}</Text>{conversations.map((item) => <Pressable key={item.id} accessibilityRole="button" onPress={() => void openConversation(item)} style={{ padding: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCardSolid }}><Text style={{ color: colors.textPrimary }} numberOfLines={2}>{item.title || nativeText("Conversación")}</Text></Pressable>)}{!conversations.length ? <Text style={{ color: colors.textMuted }}>{nativeText("No hay conversaciones guardadas.")}</Text> : null}</View> : null}
        {messages.length === 0 ? (
          <View style={{ padding: 22, marginTop: 20, borderRadius: 18, backgroundColor: colors.bgCardSolid, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
            <TablerSparkles size={28} color={colors.brand} />
            <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 21 }}>{nativeText("¿En qué trabajamos?")}</Text>
            <Text style={{ color: colors.textSecondary, lineHeight: 21 }}>{nativeText("Consulta y gestiona tu servidor con el agente de LUXIPANEL. Para ver los módulos, toca la flecha superior.")}</Text>
          </View>
        ) : null}
        {messages.map((message, index) => (
          <View key={index} style={{ alignSelf: message.role === "user" ? "flex-end" : "stretch", maxWidth: "92%", borderRadius: 16, padding: 14, backgroundColor: message.role === "user" ? colors.brand : colors.bgCardSolid, borderWidth: message.role === "user" ? 0 : 1, borderColor: colors.border }}>
            <Text selectable style={{ color: message.role === "user" ? colors.accentText : colors.textPrimary, lineHeight: 21, fontSize: 14 }}>{(message.role === "user" ? message.textOriginal : message.textTranslated) ?? message.content}</Text>
          </View>
        ))}
        {sending ? <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><ActivityIndicator color={colors.brand} /><Text style={{ color: colors.textMuted }}>{activity ?? nativeText("El agente está trabajando…")}</Text><Pressable onPress={() => void stop()}><Text style={{ color: colors.danger, fontWeight: "700" }}>{nativeText("Detener")}</Text></Pressable></View> : null}
        {permission ? <View style={{ borderRadius: 14, padding: 14, gap: 10, backgroundColor: colors.bgCardSolid, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{permission.title ?? nativeText("El agente solicita permiso")}</Text>{permission.detail ? <Text style={{ color: colors.textSecondary }}>{permission.detail}</Text> : null}<View style={{ flexDirection: "row", gap: 16 }}><Pressable onPress={() => void decidePermission("allow")}><Text style={{ color: colors.brand, fontWeight: "700" }}>{nativeText("Permitir")}</Text></Pressable><Pressable onPress={() => void decidePermission("deny")}><Text style={{ color: colors.danger, fontWeight: "700" }}>{nativeText("Rechazar")}</Text></Pressable></View></View> : null}
        {pendingAsk ? <View style={{ gap: 9, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCardSolid }}>
          {pendingAsk.questions.map((question) => <View key={question.id} style={{ gap: 7 }}><Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{question.text}</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{(question.options ?? []).map((option, index) => <Pressable key={`${question.id}:${index}`} onPress={() => { setDraft(option); setPlanDecision(pendingAsk.kind === "plan-approval" && pendingAsk.questions.length === 1 && index === 0 ? "approve" : null); }} style={{ padding: 9, borderRadius: 10, borderColor: colors.border, borderWidth: 1 }}><Text style={{ color: colors.textPrimary }}>{option}</Text></Pressable>)}</View></View>)}
        </View> : null}
        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, lineHeight: 20 }}>{localizeServerError(error)}</Text> : null}
      </ScrollView>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 9, paddingHorizontal: 12, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bgCardSolid }}>
        <TextInput
          value={draft}
          onChangeText={(value) => { setDraft(value); setPlanDecision(null); }}
          placeholder={nativeText("Escribe al agente…")}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={4096}
          style={{ flex: 1, maxHeight: 130, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgInput, paddingHorizontal: 12, paddingVertical: 9, color: colors.textPrimary, fontSize: 15 }}
        />
        <Pressable onPress={() => void send()} disabled={!draft.trim() || sending} accessibilityRole="button" accessibilityLabel={nativeText("Enviar mensaje")} style={{ minWidth: 70, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.brand, opacity: !draft.trim() || sending ? 0.5 : 1 }}>
          <Text style={{ color: colors.accentText, fontWeight: "700" }}>{nativeText("Enviar")}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
