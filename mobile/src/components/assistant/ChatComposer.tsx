// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Composer del chat del asistente (fase A5). Portado 1:1 del modo
 * `chat-composer` de `TitleBarTabs` (el navbar inferior ya no actúa como
 * composer): pill [+][textarea auto-grow][acción única] + chips (Terminal /
 * modo de aprobación / conectores) + adjuntos + modales, ahora como franja
 * inferior de `ChatScreen`.
 *
 * Es un CONTENEDOR (no presentacional): lee el estado del composer del
 * `chat-store` module-level y opera directamente contra `chat-controller`
 * (el puente `assistantBridge` murió con el pane).
 */
import React, { useEffect, useState } from "react";
import { PanelText as Text } from "../ui/PanelText";
import { BackHandler, Image, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ArrowUp, ClipboardPaste, Folder, ListPlus, Mic, Paperclip, Plug, Plus, Settings2, Square, X } from "lucide-react-native";
import { getLocaleDirection, getLocaleRowDirection, getLocaleTextAlign, getMessages } from "../../i18n";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { chatStore } from "../../features/assistant/chat-store";
import { chatController } from "../../features/assistant/chat-controller";
import { useAssistantComposer } from "../../features/assistant/hooks";
import { createVoiceRecorder } from "../../lib/voice-recorder";
import { strings } from "./strings";
import {
  AttachmentLightbox,
  ComposerAlerts,
  ConnectorBrowseModal,
  ConnectorsManagerModal,
  SlashCommandPopover,
  VoiceComposerButton,
  slashMatchesFor,
  type VoiceRecorderHandle,
} from "../AssistantComposerExtras";
import { styles } from "./ChatComposer.styles";

/** MEMOIZADO: el composer cuelga de `ChatScreen`, que re-renderiza en CADA delta
 *  del stream (la lista de mensajes cambia de identidad por token). El composer
 *  no depende de los mensajes —lee su propio slice del store— así que sin memo
 *  se re-renderizaba entero (input, chips, adjuntos, conectores) cientos de veces
 *  por respuesta para pintar exactamente lo mismo. Requiere que `onBack` llegue
 *  con identidad estable (ver el `useCallback` de `ChatScreen`). */
export const ChatComposer = React.memo(function ChatComposer({ panelId, language, onBack, onOpenSettings, bottomInsetManaged = false }: {
  panelId: string;
  language?: string;
  /** Regresa a la portada del servidor (pop de la pantalla del chat). */
  onBack: () => void;
  onOpenSettings?: () => void;
  bottomInsetManaged?: boolean;
}) {
  const t = getMessages(language);
  const ct = t.assistantComposer;
  const at = strings(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const controlBg = theme === "dark" ? "#27272a" : "#f8fafc";
  const controlText = theme === "dark" ? "#f5f5f5" : "#171d2c";
  const controlMuted = theme === "dark" ? "#a0a0a0" : "#64748b";
  const controlBorder = theme === "dark" ? "#3f3f46" : "#e2e8f0";
  const armedBackground = theme === "dark" ? "#f5f5f5" : "#475569";
  const armedInk = theme === "dark" ? "#27272a" : "#ffffff";
  const insets = useSafeAreaInsets();
  const bottomInset = bottomInsetManaged ? Math.max(insets.bottom, 8) : Math.max(insets.bottom, 12);

  // Estado enriquecido del composer (input/slash/MCP/cola/aprobación/voz/
  // conectores/bloqueo) del store module-level.
  const composer = useAssistantComposer(panelId);
  const input = composer.input;
  const setInput = (v: string) => chatStore.patchComposer(panelId, { input: v });
  const canSend = !composer.busy && !composer.blocked
    && (input.trim().length > 0 || composer.attachmentNames.length > 0);
  const canQueue = input.trim().length > 0;

  const [connectorsManagerOpen, setConnectorsManagerOpen] = useState(false);
  const [browseConnectorId, setBrowseConnectorId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // Hay grabación / clip / transcripción en curso dentro de VoiceComposerButton:
  // mientras dure, el slot de acción NO puede cambiar a Enviar (lo desmontaría).
  const [voiceActive, setVoiceActive] = useState(false);
  // Popover del botón "+" del pill (Regresar · Adjuntar · Pegar imagen).
  const [plusOpen, setPlusOpen] = useState(false);
  // Atrás de Android con el popover abierto: ciérralo en vez de hacer pop de
  // toda la pantalla del chat (el handler global de MainScreen no lo conoce).
  useEffect(() => {
    if (!plusOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setPlusOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [plusOpen]);
  // Altura auto-grow del textarea del pill (crece hasta 120).
  const [inputHeight, setInputHeight] = useState(20);
  const slashMatches = slashMatchesFor(input);
  const sourceToken = /(^|\s)@([\w-]*)$/.exec(input);
  const sourceQuery = sourceToken?.[2]?.toLocaleLowerCase() ?? "";
  const sourceOptions = [
    ...(onOpenSettings ? [
      { key: "audio", name: language?.startsWith("es") ? "Opciones de audio" : "Audio settings", description: language?.startsWith("es") ? "Voz y transcripción" : "Voice and transcription", action: onOpenSettings },
      { key: "settings", name: language?.startsWith("es") ? "Configuración avanzada" : "Advanced settings", description: "", action: onOpenSettings },
    ] : []),
    ...composer.connectors.filter((item) => item.connected).map((item) => ({ key: `connector-${item.id}`, name: item.name, description: language?.startsWith("es") ? "Consultar archivos" : "Browse files", action: () => setBrowseConnectorId(item.id) })),
    ...(composer.connectors.length ? [{ key: "connectors", name: language?.startsWith("es") ? "Conectar herramientas" : "Connect tools", description: "", action: () => setConnectorsManagerOpen(true) }] : []),
  ];
  const sourceMatches = sourceToken && !composer.busy
    ? sourceOptions.filter((item) => item.name.toLocaleLowerCase().includes(sourceQuery))
    : [];
  const imageAttachments = composer.attachments.filter((a) => a.mime.startsWith("image/") && a.previewUri);
  const browseConnector = composer.connectors.find((c) => c.id === browseConnectorId) ?? null;
  // Grabador de voz concreto (envoltura de `expo-audio`): pide permiso de
  // micrófono, graba a `.m4a` y devuelve el clip en base64 para transcribirlo
  // por el túnel. `null` en web/SSR (sin captura); la visibilidad del botón la
  // decide `composer.voiceAvailable` (lo publica `ChatScreen`).
  const createRecorder = (): VoiceRecorderHandle | null => createVoiceRecorder();

  // Qué ocupa el slot de acción. El botón de voz se mantiene montado SIEMPRE que
  // haya voz en curso (`voiceActive`), incluso con un run corriendo: desmontarlo
  // cancela el grabador y tira el clip.
  const voiceMounted = composer.voiceAvailable && !composer.blocked
    && (voiceActive || (!composer.busy && !canSend));
  const showSend = !composer.busy && canSend && !voiceActive;
  const showSendOff = !composer.busy && !showSend && !voiceMounted;

  return (
    <View
      style={[
        styles.bar,
        {
          borderTopColor: tokens.border,
          backgroundColor: tokens.bgPrimary,
          paddingBottom: bottomInset,
          direction: getLocaleDirection(language),
        },
      ]}
    >
      <View style={styles.column}>
        {/* Autocompletado de slash-commands: flota SOBRE toda la columna. */}
        <SlashCommandPopover
          matches={slashMatches}
          tokens={tokens}
          onPick={(c) => setInput(`${c.cmd} `)}
        />
        {sourceMatches.length > 0 ? <View style={[styles.sourceMenu, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}>
          <ScrollView keyboardShouldPersistTaps="always" style={{ maxHeight: 210 }}>
            {sourceMatches.map((item) => <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.name}
              onPress={() => {
                const head = sourceToken ? input.slice(0, sourceToken.index + sourceToken[1].length) : input;
                setInput(head);
                item.action();
              }}
              style={[styles.sourceRow, { borderBottomColor: tokens.border }]}>
              {item.key === "audio" ? <Mic size={16} color={tokens.textMuted} /> : item.key === "settings" ? <Settings2 size={16} color={tokens.textMuted} /> : item.key === "connectors" ? <Plug size={16} color={tokens.textMuted} /> : <Folder size={16} color={tokens.textMuted} />}
              <Text style={{ color: tokens.textPrimary, fontSize: 13, fontWeight: "600", flexShrink: 1 }}>{item.name}</Text>
              {item.description ? <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 11, flex: 1, textAlign: "right" }}>{item.description}</Text> : null}
            </Pressable>)}
          </ScrollView>
        </View> : null}
        {/* Alerta MCP expirada + mensajes "En cola (N)" (chips numerados). */}
        <ComposerAlerts
          mcpExpired={composer.mcpExpired}
          queued={composer.queued}
          t={ct}
          tokens={tokens}
          onEditQueued={(i) => chatController.editQueued(panelId, i)}
          onRemoveQueued={(i) => chatController.removeQueued(panelId, i)}
        />
        {/* Los selectores viven en la franja superior, antes de Historial/Proyecto. */}
        <View style={[styles.pill, { borderColor: controlBorder, backgroundColor: controlBg }]}>
          <View style={[styles.inputRow, { flexDirection: getLocaleRowDirection(language), borderColor: controlBorder, backgroundColor: tokens.bgPrimary }]}>
          {/* Botón "+" con popover: Regresar · Adjuntar archivo · Pegar imagen. */}
          <View>
            {plusOpen ? (
              <View style={[styles.plusMenu, { borderColor: controlBorder, backgroundColor: theme === "dark" ? "#323236" : "#ffffff", left: 0 }]}>
                <Pressable
                  onPress={() => { setPlusOpen(false); onBack(); }}
                  style={[styles.plusMenuItem, { flexDirection: getLocaleRowDirection(language) }]}
                >
                  <ArrowLeft size={16} color={tokens.textSecondary} />
                  <Text style={[styles.plusMenuItemText, { color: tokens.textPrimary, textAlign: getLocaleTextAlign(language) }]}>{t.titleBar.goToServers}</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setPlusOpen(false); void chatController.pickFile(panelId); }}
                  disabled={composer.busy}
                  style={[styles.plusMenuItem, { flexDirection: getLocaleRowDirection(language), opacity: composer.busy ? 0.5 : 1 }]}
                >
                  <Paperclip size={16} color={tokens.textSecondary} />
                  <Text style={[styles.plusMenuItemText, { color: tokens.textPrimary, textAlign: getLocaleTextAlign(language) }]}>{ct.attach}</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setPlusOpen(false); void chatController.pasteImage(panelId); }}
                  disabled={composer.busy}
                  style={[styles.plusMenuItem, { flexDirection: getLocaleRowDirection(language), opacity: composer.busy ? 0.5 : 1 }]}
                >
                  <ClipboardPaste size={16} color={tokens.textSecondary} />
                  <Text style={[styles.plusMenuItemText, { color: tokens.textPrimary, textAlign: getLocaleTextAlign(language) }]}>{ct.pasteImage}</Text>
                </Pressable>
                {onOpenSettings ? <Pressable onPress={() => { setPlusOpen(false); onOpenSettings(); }} style={[styles.plusMenuItem, { flexDirection: getLocaleRowDirection(language) }]}><Settings2 size={16} color={tokens.textSecondary}/><Text style={[styles.plusMenuItemText, { color: tokens.textPrimary }]}>{language?.startsWith("es") ? "Configuración avanzada" : "Advanced settings"}</Text></Pressable> : null}
                {onOpenSettings ? <Pressable onPress={() => { setPlusOpen(false); onOpenSettings(); }} style={[styles.plusMenuItem, { flexDirection: getLocaleRowDirection(language) }]}><Mic size={16} color={tokens.textSecondary}/><Text style={[styles.plusMenuItemText, { color: tokens.textPrimary }]}>{language?.startsWith("es") ? "Opciones de audio" : "Audio settings"}</Text></Pressable> : null}
                {composer.connectors.filter((item) => item.connected).map((item) => <Pressable key={item.id} onPress={() => { setPlusOpen(false); setBrowseConnectorId(item.id); }} style={[styles.plusMenuItem, { flexDirection: getLocaleRowDirection(language) }]}><Folder size={16} color={tokens.textSecondary}/><Text numberOfLines={1} style={[styles.plusMenuItemText, { color: tokens.textPrimary, flex: 1 }]}>{item.name}</Text></Pressable>)}
                {composer.connectors.length > 0 ? <Pressable onPress={() => { setPlusOpen(false); setConnectorsManagerOpen(true); }} style={[styles.plusMenuItem, { flexDirection: getLocaleRowDirection(language) }]}><Plug size={16} color={tokens.textSecondary}/><Text style={[styles.plusMenuItemText, { color: tokens.textPrimary }]}>{language?.startsWith("es") ? "Conectar herramientas" : "Connect tools"}</Text></Pressable> : null}
              </View>
            ) : null}
            <Pressable
              onPress={() => setPlusOpen((v) => !v)}
              disabled={composer.busy}
              accessibilityLabel={ct.attach}
              style={[styles.pillBtn, { opacity: composer.busy ? 0.4 : 1 }]}
            >
              <Plus size={20} color={tokens.textMuted} />
            </Pressable>
          </View>
          <TextInput
            value={input}
            onChangeText={setInput}
            onFocus={() => setPlusOpen(false)}
            placeholder={composer.blocked ? (composer.blockedReason ?? at.unavailable) : (composer.imageAttachSupported ? ct.inputPlaceholder : ct.inputPlaceholderPlain)}
            placeholderTextColor={controlMuted}
            multiline
            onContentSizeChange={(e) => setInputHeight(Math.min(120, Math.max(20, e.nativeEvent.contentSize.height)))}
            style={[styles.pillInput, { color: controlText, textAlign: getLocaleTextAlign(language), height: inputHeight + 16 }]}
          />
          {/* Slot de acción. Los botones son SLOTS FIJOS (cada uno su propio
              `cond ? … : null`) y NO ramas de un ternario: React conserva la
              instancia de `VoiceComposerButton` mientras `voiceMounted` siga
              siendo cierto, aunque a su lado aparezcan/desaparezcan Detener y
              Encolar. Cualquier reestructuración del árbol aquí lo REMONTA, y su
              cleanup cancela el grabador y tira el clip en silencio.

              Prioridad: voz (mientras haya grabación/clip vivo, incluso con run
              en curso) · detener + encolar (run en curso) · enviar · enviar (off).
              El 2º botón "Encolar" es paridad ChatPane.tsx:4116-4132: mete el
              texto actual en la cola (chips "En cola (N)"). */}
          <View style={{ flexDirection: getLocaleRowDirection(language), alignItems: "center", gap: 6 }}>
            {voiceMounted ? (
              // `voiceActive` tiene prioridad sobre TODO lo demás: el estado de la
              // voz vive DENTRO de este botón, así que teclear una letra, adjuntar
              // un archivo o que algo ponga `busy` (respuesta rápida, AskView,
              // StartTiles, retryLast, un run arrancado desde otra superficie) lo
              // desmontaba a mitad de una nota de voz y la tiraba en silencio.
              <VoiceComposerButton
                t={ct}
                tokens={tokens}
                createRecorder={createRecorder}
                onTranscribe={(b64, mime) => chatController.transcribeVoice(panelId, b64, mime)}
                onSubmit={(text) => chatController.sendText(panelId, text)}
                onPhaseChange={setVoiceActive}
              />
            ) : null}
            {composer.busy ? (
              <Pressable
                onPress={() => chatController.stopStream(panelId)}
                accessibilityLabel={ct.voiceStop}
                style={[styles.pillBtn, { backgroundColor: armedBackground }]}
              >
                <Square size={15} color={armedInk} fill={armedInk} />
              </Pressable>
            ) : null}
            {composer.busy ? (
              // Solo texto: `queueCurrent` encola texto (los adjuntos no viajan en
              // la cola). Contar adjuntos aquí pintaba el botón habilitado para un
              // no-op silencioso.
              <Pressable
                onPress={() => chatController.queueCurrent(panelId)}
                disabled={!canQueue}
                accessibilityLabel={ct.queueMessage}
                style={[styles.pillBtn, { borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bgCardSolid, opacity: canQueue ? 1 : 0.5 }]}
              >
                <ListPlus size={16} color={tokens.textSecondary} />
              </Pressable>
            ) : null}
            {showSend ? (
              <Pressable
                onPress={() => void chatController.send(panelId)}
                accessibilityLabel={ct.voiceSend}
                style={[styles.pillBtn, { backgroundColor: armedBackground }]}
              >
                <ArrowUp size={19} color={armedInk} strokeWidth={2.4} />
              </Pressable>
            ) : null}
            {showSendOff ? (
              <Pressable
                disabled
                accessibilityLabel={ct.voiceSend}
                style={[styles.pillBtn, { backgroundColor: theme === "dark" ? "#36363a" : "#e2e8f0" }]}
              >
                <ArrowUp size={19} color={theme === "dark" ? "#a0a0a0" : "#94a3b8"} strokeWidth={2.4} />
              </Pressable>
            ) : null}
          </View>
          </View>
        </View>
        {/* Adjuntos: 1 por fila DEBAJO del input + botones. Las imágenes muestran
            miniatura y abren el lightbox al tocarse. */}
        {composer.attachments.map((att, index) => {
          const isImg = att.mime.startsWith("image/") && !!att.previewUri;
          const imgIdx = imageAttachments.findIndex((a) => a === att);
          return (
            <View
              key={`${att.name}-${index}`}
              style={[styles.attachRow, { borderColor: tokens.border, backgroundColor: controlBg, flexDirection: getLocaleRowDirection(language) }]}
            >
              {isImg ? (
                <Pressable onPress={() => setLightboxIndex(imgIdx >= 0 ? imgIdx : 0)} accessibilityLabel={ct.viewPreview}>
                  <Image source={{ uri: att.previewUri }} style={{ width: 26, height: 26, borderRadius: 5 }} />
                </Pressable>
              ) : (
                <Paperclip size={13} color={controlMuted} />
              )}
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, fontWeight: "600", color: controlText, textAlign: getLocaleTextAlign(language) }}>{att.name}</Text>
              <Pressable onPress={() => chatController.clearAttachment(panelId, index)} hitSlop={8} accessibilityLabel={ct.removeAttachment}>
                <X size={14} color={controlMuted} />
              </Pressable>
            </View>
          );
        })}
        {/* Modales: gestor de conectores, explorador de archivos, lightbox. */}
        <ConnectorsManagerModal
          visible={connectorsManagerOpen}
          connectors={composer.connectors}
          t={ct}
          language={language}
          tokens={tokens}
          onClose={() => setConnectorsManagerOpen(false)}
          onConnect={(id, secrets) => chatController.connectConnector(panelId, id, secrets)}
          onDisconnect={(id) => chatController.disconnectConnector(panelId, id)}
        />
        <ConnectorBrowseModal
          visible={!!browseConnector}
          connector={browseConnector}
          t={ct}
          language={language}
          tokens={tokens}
          onClose={() => setBrowseConnectorId(null)}
          onBrowse={(id, query) => chatController.browseConnector(panelId, id, query)}
          onAttach={(id, fileId, name) => chatController.fetchConnectorFile(panelId, id, fileId, name)}
        />
        {lightboxIndex !== null ? (
          <AttachmentLightbox
            images={imageAttachments}
            index={lightboxIndex}
            t={ct}
            language={language}
            tokens={tokens}
            onClose={() => setLightboxIndex(null)}
            onIndex={(i) => setLightboxIndex(i)}
          />
        ) : null}
      </View>
    </View>
  );
});
