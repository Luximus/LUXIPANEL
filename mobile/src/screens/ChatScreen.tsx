// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Pantalla del CHAT del asistente IA de un servidor (fase A5).
 *
 * Sustituye al `ServerAssistantPane` embebido en el carousel y a los slots del
 * navbar (`ChatHeaderBar` arriba + composer de `TitleBarTabs` abajo): la
 * cabecera (USO CLI + pills de identidad), la lista de turnos y el composer
 * viven JUNTOS aquí, cableados directo al `chat-store`/`chat-controller`
 * module-level — el stream sobrevive a navegar fuera (goBack) y volver.
 *
 * Se apila como ruta `Chat { panelId }` sobre la vista actual (patrón de las
 * rutas de sesión de B2). Params: solo ids serializables; todo el estado vive
 * en el store. La PORTADA del servidor quedó en el carousel
 * (`ServerCoverPane`); aquí solo existe el chat ya iniciado.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelText as Text } from "../components/ui/PanelText";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { RefreshCw, ServerOff, ShieldCheck, Sparkles } from "lucide-react-native";
import { luxAssistantProxy } from "../api/client";
import type { ServerMetricsState } from "../features/app/viewModels";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../theme/colors";
import { chatController } from "../features/assistant/chat-controller";
import {
  useAssistantChat,
  useAssistantComposer,
  useAssistantHeader,
  useAssistantSession,
} from "../features/assistant/hooks";
import { usePanelAvailability } from "../features/assistant/use-availability";
import { usePullRefresh } from "../hooks/usePullRefresh";
import { voiceCaptureSupported } from "../lib/voice-recorder";
import { chatStore } from "../features/assistant/chat-store";
import { sampleQuickReplies } from "../components/quick-reply-pool";
import { strings } from "../components/assistant/strings";
import { messageKeys, setAssistantLocale, turnRevision } from "../components/assistant/format";
import { listBottomPad, paneSurface, styles } from "../components/assistant/chat-pane.styles";
import { AGENT_VIOLET, ChatHeaderPills } from "../components/assistant/ChatHeaderPills";
import { CliUsageBarsLive } from "../components/assistant/CliUsageBarsLive";
import { StartTiles } from "../components/assistant/StartTiles";
import { getDirect } from "../api/serverApi";
import { RealtimeActivity } from "../components/assistant/RealtimeActivity";
import { useRealtimeVoiceState } from "../features/assistant/realtime-voice";
import { TurnView } from "../components/assistant/TurnView";
import { AssistantSendGate } from "../components/assistant/TurnQuickReplies";
import { ChatComposer } from "../components/assistant/ChatComposer";
import { NativePromptToolbar } from "../components/assistant/NativePromptToolbar";

export function ChatScreen({ panelId, token, language, projectPath, metricsState, onMetricsRefresh, onNewTerminal, onBack, onOpenSettings, keyboardShift, layoutManaged = false, topBar, bottomNavigation, onBottomChromeLayout }: {
  panelId: string;
  token: string;
  language?: string;
  /** Ruta del proyecto activo cuando el workspace conoce su jerarquía. */
  projectPath?: string | null;
  /** Métricas en vivo del panel (el contenedor sondea el slide visible, que es
   *  este mismo panel: el chat se abre desde su portada). */
  metricsState?: ServerMetricsState;
  /** Fuerza al contenedor a re-sondear las métricas de este panel. */
  onMetricsRefresh?: (panelId: string) => Promise<void> | void;
  /** Abre una consola nueva del terminal nativo (chip "Terminal" del composer). */
  onNewTerminal?: () => void;
  /** Vuelve a la portada del servidor (pop de esta pantalla). */
  onBack: () => void;
  onOpenSettings?: () => void;
  /** Desplazamiento del teclado (lo publica MainScreen): el composer sube con
   *  él, igual que hacía el navbar inferior. */
  keyboardShift: Animated.Value;
  /** Parent measures keyboard overlap and owns the fixed mobile navbar. */
  layoutManaged?: boolean;
  topBar?: React.ReactNode;
  bottomNavigation?: React.ReactNode;
  onBottomChromeLayout?: (height: number) => void;
}) {
  const t = useMemo(() => strings(language), [language]);
  // Publica el idioma ACTIVO DE LA APP a los helpers de formato (hora, fecha,
  // separador de miles) y a las hojas del chat que no reciben `lang` por props
  // (CompactionDivider, TurnQuickReplies, AskView, MarkdownView). Va en el
  // cuerpo del render (no en un effect) para que el primer pintado ya use el
  // idioma correcto.
  setAssistantLocale(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const surface = paneSurface(tokens);

  // Estado reactivo del store module-level (fase A4): sesión, composer, header
  // y chat (mensajes/adjuntos/meta). La pantalla no posee nada de esto.
  const session = useAssistantSession(panelId);
  const composer = useAssistantComposer(panelId);
  const header = useAssistantHeader(panelId);
  const chat = useAssistantChat(panelId);
  const provider = session.provider;
  const conversationId = session.conversationId;
  const messages = chat.messages;
  const busy = composer.busy;
  const isStarted = composer.started;
  const [voice, setVoice] = useState<{ ttsAvailable: boolean; voiceName?: string; autoSpeak: boolean }>({ ttsAvailable: false, autoSpeak: false });
  useEffect(() => {
    let active = true;
    setVoice({ ttsAvailable: false, autoSpeak: false });
    if (token) void Promise.all([
      luxAssistantProxy<{ capabilities?: { tts?: string | null } }>(panelId, token, "GET", "/api/ai/voice/capabilities"),
      luxAssistantProxy<{ config?: { voice?: { voice?: string; autoSpeak?: boolean } } }>(panelId, token, "GET", "/api/ai/config"),
    ]).then(([capabilities, config]) => {
      if (active) setVoice({
        ttsAvailable: !!capabilities?.capabilities?.tts,
        voiceName: config?.config?.voice?.voice,
        autoSpeak: !!config?.config?.voice?.autoSpeak,
      });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [panelId, token, provider]);

  // Configura el controller (token) y dispara la restauración desde disco tras
  // un cierre total del SO. PRIMER effect: los siguientes asumen token puesto.
  useEffect(() => {
    chatController.configure(panelId, { token });
    chatController.ensureDiskRestore(panelId);
  }, [panelId, token]);

  // Apertura de terminal (chip "Terminal" del composer): el controller no
  // navega; la pantalla le registra el opener que baja por props.
  const newTerminalRef = useRef(onNewTerminal);
  newTerminalRef.current = onNewTerminal;
  useEffect(
    () => chatController.registerUiHandlers(panelId, { terminal: () => newTerminalRef.current?.() }),
    [panelId],
  );

  // 6 respuestas rápidas AL AZAR del pool (100 variaciones por idioma). Se re-barajan
  // por conversación/panel/idioma (no en cada render, para que no parpadeen al teclear).
  const quickReplies = useMemo(() => sampleQuickReplies(language, 6), [language, panelId, conversationId]);

  // Disponibilidad de la conexión SSH (mismo árbol que web/desktop) + permisos
  // de módulos. El error de "Aprobar huella" va al notice del chat.
  const av = usePanelAvailability({
    panelId, token, metricsState, t, onMetricsRefresh,
    onError: (text) => chatController.setNotice(panelId, text),
  });
  const blocked = av.blocked;

  // El composer sube con el teclado (translateY = -keyboardShift) pero la lista
  // no se encoge: sin este relleno, el turno recién enviado y el arranque de la
  // respuesta quedan DETRÁS del composer hasta cerrar el teclado.
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (e) =>
      setKbHeight(e.endCoordinates?.height ?? 0),
    );
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const scrollRef = useRef<ScrollView | null>(null);
  // Auto-scroll solo si el usuario está "pegado" al fondo (no scrolleó arriba).
  const stickToBottomRef = useRef(true);
  // Al abrir un hilo, el skeleton se sustituye por el historial tras una lectura
  // asíncrona. Su scroll inicial no debe marcar al usuario como "despegado".
  const openingScrollRef = useRef(false);
  const openingScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollToEnd = (animated = true) => scrollRef.current?.scrollToEnd({ animated });
  const scrollOpenedChatToEnd = () => {
    openingScrollRef.current = true;
    stickToBottomRef.current = true;
    scrollToEnd(false);
    if (openingScrollTimerRef.current) clearTimeout(openingScrollTimerRef.current);
    openingScrollTimerRef.current = setTimeout(() => {
      scrollToEnd(false);
      openingScrollRef.current = false;
      openingScrollTimerRef.current = null;
    }, 350);
  };
  useEffect(() => () => {
    if (openingScrollTimerRef.current) clearTimeout(openingScrollTimerRef.current);
  }, []);
  const onListScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (openingScrollRef.current) return;
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    stickToBottomRef.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 48;
  };
  // Auto-scroll al CRECER EL CONTENIDO (deltas del stream, cierre de turno con
  // una tabla markdown o un bloque de código largo) si el usuario sigue pegado
  // al fondo. Antes esto colgaba de un `requestAnimationFrame` sobre el efecto
  // de [messages]: se disparaba ANTES de que el ScrollView midiera los hijos
  // nuevos, así que usaba la altura de contenido ANTERIOR y no llegaba al final.
  // `onContentSizeChange` se emite ya con la altura nueva medida.
  const onContentSizeChange = () => {
    if (openingScrollRef.current) scrollToEnd(false);
    else if (stickToBottomRef.current) scrollToEnd();
  };
  // Intención de scroll del controller (envío / apertura de hilo): re-engancha
  // el stick y baja al fondo aunque el usuario hubiera scrolleado arriba.
  const scrollSeqRef = useRef(chat.scrollSeq);
  useEffect(() => {
    if (scrollSeqRef.current === chat.scrollSeq) return;
    scrollSeqRef.current = chat.scrollSeq;
    scrollOpenedChatToEnd();
  }, [chat.scrollSeq]);
  // También al montar esta pantalla con un chat restaurado, sin bumpScroll nuevo.
  useEffect(() => {
    scrollOpenedChatToEnd();
  }, [panelId, conversationId]);

  // Claves de render ESTABLES por mensaje: con `key={i}` React reutilizaba el
  // subárbol por posición y el estado local de los hijos (archivos modificados
  // abiertos, herramienta desplegada, resumen de compactación, borradores del
  // bloque de preguntas) se quedaba pegado a OTRO mensaje cada vez que la lista
  // se reemplaza entera (apertura de hilo, compactación, pull-to-refresh, retry).
  const keys = useMemo(() => messageKeys(messages), [messages]);
  // ── PERF del stream ────────────────────────────────────────────────────────
  // Esta pantalla re-renderiza en CADA delta (el array de mensajes cambia de
  // identidad por token). Todo lo que baja a los hijos memoizados (`TurnView`,
  // `ChatComposer`, `ChatHeaderPills`, `CliUsageBarsLive`) tiene que tener
  // identidad ESTABLE o el memo no ahorra nada.
  //
  // `rev`: firma del contenido MUTABLE de cada turno. El reducer del stream muta
  // el turno vivo EN SITIO (misma referencia), así que la comparación superficial
  // del memo no lo vería cambiar; con `rev` se re-renderiza SOLO ese turno y los
  // anteriores (que sí conservan identidad) se saltan.
  const revs = useMemo(() => messages.map(turnRevision), [messages]);
  // Índice del ÚLTIMO turno de usuario (habilita "Editar" mientras la IA corre).
  // Antes se resolvía con `messages.slice(i + 1).every(...)` DENTRO del map: O(n²)
  // por render, con una copia de array por turno, en cada token.
  const lastUserIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "user") return i;
    return -1;
  }, [messages]);
  // ¿Se puede despachar un envío? (mismos guards que `sendQuick` del controller).
  // Atenúa y desactiva las respuestas rápidas (chips del turno y tarjetas de
  // inicio) en vez de tragarse el toque en silencio.
  const realtimeVoice = useRealtimeVoiceState();
  const canSend = !busy && !blocked && !!token;
  const sendGate = useMemo(() => ({ canSend }), [canSend]);

  // Callbacks con identidad estable para los hijos memoizados. Solo dependen del
  // panel (el controller resuelve el resto contra el store module-level).
  const onAnswer = useCallback((text: string, opts?: { planDecision?: "approve" }) => chatController.sendQuick(panelId, text, opts), [panelId]);
  const onPermission = useCallback(
    (requestId: string, decision: "allow" | "deny" | "always", tool?: string) =>
      chatController.decidePermission(panelId, requestId, decision, tool),
    [panelId],
  );
  const onRetry = useCallback(() => chatController.retryLast(panelId), [panelId]);
  const onNewChat = useCallback(() => chatController.newConversation(panelId), [panelId]);
  const onEdit = useCallback((text: string) => chatController.editMessage(panelId, text), [panelId]);
  const onCompact = useCallback(() => { void chatController.compactNow(panelId); }, [panelId]);
  const leaderConversationId = chat.leaderConv?.conversationId ?? null;
  const onBackToLeader = useCallback(() => {
    if (leaderConversationId) chatController.openConversation(panelId, leaderConversationId);
  }, [panelId, leaderConversationId]);
  // El padre (MainScreen) declara `onBack` como arrow inline: se lee por ref para
  // que el composer memoizado no se re-renderice por él en cada delta.
  const backRef = useRef(onBack);
  backRef.current = onBack;
  const goBack = useCallback(() => backRef.current(), []);
  // GET por el proxy SSO para la barra "USO CLI" (la red vive fuera del
  // componente presentacional, regla A3). Memoizado: es prop de un hijo memoizado.
  const proxyGet = useCallback(
    <T,>(path: string) => luxAssistantProxy<T>(panelId, token, "GET", path),
    [panelId, token],
  );

  // Aviso del chat: los códigos del controller se traducen aquí; los textos
  // (p. ej. error del servidor al aprobar la huella) llegan ya legibles.
  const notice = chat.notice
    ? (chat.notice.kind === "error" ? t.error
      : chat.notice.kind === "unavailable" ? t.unavailable
      : chat.notice.kind === "attachTooLarge" ? t.attachTooLarge
      : chat.notice.kind === "attachTooMany" ? t.attachTooMany
      : chat.notice.text)
    : null;

  // Publica el bloqueo por métricas al composer (pinta placeholder y desactiva
  // el envío). `busy` lo posee el controller (setBusy).
  useEffect(() => {
    chatStore.patchComposer(panelId, { blocked, blockedReason: av.unavailableReason });
  }, [panelId, blocked, av.unavailableReason]);
  // Disponibilidad de voz: el botón de micrófono aparece solo si la plataforma
  // soporta captura (iOS/Android). En web/SSR queda oculto.
  useEffect(() => { chatStore.patchComposer(panelId, { voiceAvailable: voiceCaptureSupported }); }, [panelId]);
  // Disponibilidad de terminal: el chip "Terminal" del composer aparece solo si
  // hay opener y el permiso del módulo terminal está concedido (paridad web).
  useEffect(() => {
    chatStore.patchComposer(panelId, { terminalAvailable: !!onNewTerminal && av.modulePerms.terminal });
  }, [panelId, onNewTerminal, av.modulePerms.terminal]);

  // Config del proveedor activo (modo API/CLI + modelo) — chip de cabecera,
  // barra "USO CLI" y soporte de imágenes del composer.
  useEffect(() => {
    void chatController.refreshProviderConfig(panelId);
  }, [panelId, token, provider, isStarted]);
  // Sondea el ID de sesión del proveedor (solo CLI) y la ventana de contexto al
  // cambiar de conversación y cuando un run asienta (`busy` → false).
  useEffect(() => {
    chatController.refreshRunMeta(panelId);
  }, [panelId, token, conversationId, busy, provider]);
  // Meta del hilo activo (proyecto / chat del líder) al cambiar de conversación.
  useEffect(() => {
    chatController.refreshConversationMeta(panelId);
  }, [panelId, token, conversationId]);

  // Carga de proveedores en cuanto el SSH conecta (la portada ya la dispara;
  // el guard `providersLoaded` del controller evita duplicarla).
  useEffect(() => {
    if (!getDirect(panelId) && (av.effectiveMetrics?.status !== "ok" || av.effectiveMetrics.metrics.liveStatus !== "ok")) return;
    chatController.loadProviders(panelId);
  }, [panelId, av.effectiveMetrics]);

  const activeProviderCfg = chat.activeProviderCfg;

  // Pull-to-refresh del propio chat: re-lee los mensajes del hilo activo SIN
  // resetear el agente ni pintar el skeleton. Solo se dispara en el TOPE del
  // scroll del chat (lo garantiza el `RefreshControl`).
  const { refreshing: chatRefreshing, onRefresh: onChatRefresh } = usePullRefresh(() => chatController.reloadMessages(panelId));

  return (
    <View style={[styles.wrap, surface.wrap]}>
      {topBar}
      {/* ── Cabecera del chat: barra "USO CLI" ARRIBA y fila de identidad
          (proveedor·modelo, agente, proyecto, ctx, Compactar) DEBAJO. Antes se
          publicaba al navbar vía assistantBridge.setNavHeader; ahora se pinta
          aquí mismo. Oculta con la conexión bloqueada. ── */}
      {!blocked ? (
        <View style={{ backgroundColor: tokens.bgPrimary }}>
          {provider && activeProviderCfg?.mode === "cli" ? (
            <CliUsageBarsLive
              panelId={panelId}
              token={token}
              provider={provider}
              refreshKey={chat.usageRefreshKey}
              theme={theme === "dark" ? "dark" : "light"}
              language={language}
              t={t}
              // La red vive fuera del componente presentacional (regla A3): GET por el proxy SSO.
              proxyGet={proxyGet}
            />
          ) : null}
        </View>
      ) : null}
      {/* ── Chat ─────────────────────────────────────────────────────────── */}
      {/* El gate de envío baja por contexto: los chips de respuesta rápida
          cuelgan de TurnView (presentacional puro, que no conoce el composer). */}
      <AssistantSendGate.Provider value={sendGate}>
        <ScrollView
          ref={scrollRef}
          style={styles.list}
          contentContainerStyle={[styles.listContent, listBottomPad(layoutManaged ? 0 : kbHeight)]}
          keyboardShouldPersistTaps="handled"
          onScroll={onListScroll}
          onContentSizeChange={onContentSizeChange}
          scrollEventThrottle={64}
          nestedScrollEnabled
          // Pull-to-refresh propio del chat: el RefreshControl solo dispara en el
          // tope (offset 0), así "actualiza solo cuando no hay nada más para
          // subir". Solo con un hilo persistido.
          refreshControl={
            conversationId
              ? <RefreshControl refreshing={chatRefreshing} onRefresh={onChatRefresh} tintColor={tokens.brand} colors={[tokens.brand]} />
              : undefined
          }
        >
          {blocked ? (
            <View style={styles.blocked}>
              <ServerOff size={26} color={tokens.textMuted} />
              <Text style={[styles.blockedText, { color: tokens.textMuted }]}>{av.unavailableReason}</Text>
              {av.isFingerprint ? (
                <Pressable
                  onPress={() => void av.approveFingerprint()}
                  disabled={av.approvingFp || !token}
                  style={[styles.approveBtn, { backgroundColor: tokens.brand, opacity: av.approvingFp ? 0.7 : 1 }]}
                >
                  {av.approvingFp ? <ActivityIndicator size="small" color="#ffffff" /> : <ShieldCheck size={14} color="#ffffff" />}
                  <Text style={styles.approveBtnText}>{av.approvingFp ? t.approving : t.approveFp}</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => void av.refreshStatus()}
                  disabled={av.refreshingStatus || !token}
                  style={[styles.ghostBtn, { borderColor: tokens.border, opacity: av.refreshingStatus ? 0.7 : 1 }]}
                >
                  {av.refreshingStatus ? <ActivityIndicator size="small" color={tokens.textMuted} /> : <RefreshCw size={14} color={tokens.textMuted} />}
                  <Text style={[styles.ghostBtnText, { color: tokens.textSecondary }]}>{av.refreshingStatus ? t.refreshing : t.refresh}</Text>
                </Pressable>
              )}
              {notice ? <Text style={[styles.notice, { color: tokens.danger }]}>{notice}</Text> : null}
            </View>
          ) : null}
          {!blocked && messages.length === 0 && !notice ? (
            // Chat iniciado, aún sin mensajes. Paridad con el estado vacío de la
            // web (`ChatPane.tsx`): chat de AGENTE → tarjeta simple centrada; chat
            // suelto/proyecto → "puntos de partida". Al enviar el primer mensaje
            // desaparecen (messages.length pasa a > 0).
            session.agentName ? (
              <View style={styles.emptyAgentState}>
                <View style={[styles.emptyIcon, { backgroundColor: withAlpha(AGENT_VIOLET, 0.12) }]}>
                  <Sparkles size={28} color={AGENT_VIOLET} />
                </View>
                <Text style={[styles.emptyAgentTitle, { color: tokens.textPrimary }]}>
                  {(t.chatWith ?? "Chat con {name}").replace("{name}", session.agentName)}
                </Text>
                <Text style={[styles.emptyAgentHint, { color: tokens.textMuted }]}>
                  {t.typeMessageHint ?? "Escribe tu mensaje abajo."}
                </Text>
              </View>
            ) : (
              // Tarjetas de inicio: si el envío no procede (run vivo / sin token),
              // se atenúan y no responden al toque (el propio `StartTiles` no
              // tiene estado `disabled`; se envuelve para no duplicarlo dentro).
              <View style={{ opacity: canSend ? 1 : 0.5 }} pointerEvents={canSend ? "auto" : "none"}>
                <StartTiles
                  quickReplies={quickReplies}
                  projectTitle={chat.activeProject?.title ?? null}
                  t={t}
                  tokens={tokens}
                  onPick={(text) => chatController.sendQuick(panelId, text)}
                />
              </View>
            )
          ) : null}
          {/* La identidad del agente IA custom vive en la pill de la cabecera fija
              (ChatHeaderPills), como la top bar del panel. */}
          {!blocked && messages.map((m, i) => {
            // Editar (paridad web): solo en el último turno de usuario y mientras
            // la IA corre (busy) — reenvía el mensaje editado tras parar el run.
            const isLastUserTurn = busy && i === lastUserIdx;
            return (
              <TurnView
                key={keys[i]}
                msg={m}
                rev={revs[i]}
                provider={provider}
                panelId={panelId}
                token={token}
                agentName={session.agentName}
                ttsAvailable={voice.ttsAvailable}
                voiceName={voice.voiceName}
                autoSpeak={voice.autoSpeak && activeProviderCfg?.mode === "api" && !(realtimeVoice?.panelId === panelId && realtimeVoice.conversationId === conversationId && realtimeVoice.phase !== "idle")}
                conversationId={conversationId}
                tokens={tokens}
                theme={theme === "dark" ? "dark" : "light"}
                t={t}
                lang={language}
                isLast={i === messages.length - 1}
                onAnswer={onAnswer}
                onPermission={onPermission}
                onRetry={onRetry}
                onNewChat={onNewChat}
                onEdit={isLastUserTurn ? onEdit : undefined}
              />
            );
          })}
          {!blocked && <RealtimeActivity panelId={panelId} conversationId={conversationId} tokens={tokens} t={t} />}
          {!blocked && notice ? <Text style={[styles.notice, { color: tokens.danger }]}>{notice}</Text> : null}
        </ScrollView>
      </AssistantSendGate.Provider>
      {/* Orden del prompt: estado, Historial/Proyecto, selectores y entrada.
          Todo el chrome inferior sube junto con el teclado. */}
      <Animated.View onLayout={(event) => onBottomChromeLayout?.(event.nativeEvent.layout.height)} style={{ transform: [{ translateY: Animated.multiply(keyboardShift, -1) }] }}>
        {!blocked && (messages.length > 0 || !!session.agentName || !!leaderConversationId || !!header.ctx?.warn || !!projectPath) ? (
          <ChatHeaderPills
            agentName={session.agentName}
            projectTitle={projectPath ?? chat.activeProject?.title ?? null}
            leaderConversationId={leaderConversationId}
            conversationId={conversationId}
            tokensTotal={header.tokensTotal}
            assistantTurns={header.assistantTurns}
            tokensEstimated={header.tokensEstimated}
            language={language}
            onBackToLeader={onBackToLeader}
            streaming={busy}
            streamStartedAt={header.streamStartedAt}
            ctx={header.ctx}
            compacting={header.compacting}
            onCompact={onCompact}
            t={t}
            tokens={tokens}
          />
        ) : null}
        {bottomNavigation}
        <NativePromptToolbar panelId={panelId} language={language} showTerminal={!layoutManaged} />
        <ChatComposer panelId={panelId} language={language} onBack={goBack} onOpenSettings={onOpenSettings} bottomInsetManaged={layoutManaged} />
      </Animated.View>
    </View>
  );
}
