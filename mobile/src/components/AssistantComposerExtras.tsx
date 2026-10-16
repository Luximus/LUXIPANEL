import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, AppState, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  File as FileIcon,
  Folder,
  Mic,
  Pencil,
  Plug,
  Search,
  Send,
  Square,
  X,
} from "lucide-react-native";
import type { ThemeTokens } from "../theme/colors";
import { getMessages } from "../i18n";
import { Modal } from "./ui/Modal";
import { FormSheet } from "./ui/FormSheet";
import type {
  ApprovalMode,
  ComposerAttachment,
  ComposerConnector,
  ConnectorBrowseItem,
} from "../features/assistant/types";

type ComposerMsgs = ReturnType<typeof getMessages>["assistantComposer"];

// ── Slash-commands (espejo de SLASH_COMMANDS de la web) ──────────────────────

export type SlashCommandDef = { cmd: string; args?: string; desc: string };

export const SLASH_COMMANDS: SlashCommandDef[] = [
  { cmd: "/help", desc: "Muestra los comandos disponibles" },
  { cmd: "/status", desc: "Proveedor, modo y modelo activos" },
  { cmd: "/provider", args: "<claude|codex|gemini|deepseek|minimax>", desc: "Cambia el proveedor activo" },
  { cmd: "/mode", args: "<api|cli>", desc: "Cambia el modo del proveedor activo" },
  { cmd: "/model", args: "<nombre>", desc: "Fija el modelo" },
  { cmd: "/mod", args: "<estado|enviar|probar|preview|…>", desc: "Gestiona tu módulo en desarrollo" },
  { cmd: "/ponytail", args: "[off|lite|full|ultra]", desc: "Modo de código minimalista (Ponytail)" },
  { cmd: "/ponytail-review", desc: "Revisa el diff buscando sobre-ingeniería" },
  { cmd: "/ponytail-audit", desc: "Audita todo el repo buscando sobre-ingeniería" },
  { cmd: "/ponytail-debt", desc: "Libro de deuda de comentarios ponytail:" },
  { cmd: "/clear", desc: "Limpia la conversación" },
];

/** Calcula las coincidencias de slash-command para el borrador actual. Vacío si
 *  el borrador no es un único token "/palabra" (espejo de `slashMatches`). */
export function slashMatchesFor(draft: string): SlashCommandDef[] {
  const m = /^\/(\S*)$/.exec(draft);
  if (!m) return [];
  const q = `/${(m[1] ?? "").toLowerCase()}`;
  return SLASH_COMMANDS.filter((c) => c.cmd.toLowerCase().startsWith(q));
}

/** Popover de autocompletado de slash-commands flotando SOBRE el input. */
export function SlashCommandPopover({
  matches, tokens, onPick,
}: {
  matches: SlashCommandDef[]; tokens: ThemeTokens; onPick: (c: SlashCommandDef) => void;
}) {
  if (matches.length === 0) return null;
  return (
    <View style={[s.slashPop, { borderColor: tokens.border, backgroundColor: tokens.bgCardSolid }]}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 196 }}>
        {matches.map((c, idx) => (
          <Pressable key={c.cmd} onPress={() => onPick(c)} style={[s.slashRow, { borderBottomColor: tokens.border }, idx === matches.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={[s.slashCmd, { color: tokens.brand }]}>{c.cmd}</Text>
            {c.args ? <Text style={[s.slashArgs, { color: tokens.textMuted }]}>{c.args}</Text> : null}
            <Text numberOfLines={1} style={[s.slashDesc, { color: tokens.textMuted }]}>{c.desc}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ── Alerta MCP expirada + mensajes en cola ───────────────────────────────────

export function ComposerAlerts({
  mcpExpired, queued, t, tokens, onEditQueued, onRemoveQueued,
}: {
  mcpExpired: boolean; queued: string[]; t: ComposerMsgs; tokens: ThemeTokens;
  onEditQueued: (i: number) => void; onRemoveQueued: (i: number) => void;
}) {
  if (!mcpExpired && queued.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      {mcpExpired ? (
        <View style={[s.mcpBox, { borderColor: "rgba(251,191,36,0.4)", backgroundColor: "rgba(251,191,36,0.10)" }]}>
          <AlertTriangle size={14} color={tokens.warning} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={[s.mcpTitle, { color: tokens.warning }]}>{t.mcpExpiredTitle}</Text>
            <Text style={[s.mcpBody, { color: tokens.warning }]}>{t.mcpExpiredBody}</Text>
          </View>
        </View>
      ) : null}
      {queued.length > 0 ? (
        <View style={{ gap: 4 }}>
          <View style={s.queuedHead}>
            <Clock size={11} color={tokens.textMuted} />
            <Text style={[s.queuedHeadText, { color: tokens.textMuted }]}>{`${t.queuedHeading} (${queued.length})`}</Text>
          </View>
          <View style={s.queuedWrap}>
            {queued.map((q, i) => (
              <View key={i} style={[s.queuedChip, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
                <Text style={[s.queuedIdx, { color: tokens.textMuted }]}>{`${i + 1}.`}</Text>
                <Text numberOfLines={1} style={[s.queuedText, { color: tokens.textSecondary }]}>{q || t.queuedAttachment}</Text>
                <Pressable onPress={() => onEditQueued(i)} hitSlop={6} accessibilityLabel={t.editBeforeSend}>
                  <Pencil size={12} color={tokens.textMuted} />
                </Pressable>
                <Pressable onPress={() => onRemoveQueued(i)} hitSlop={6} accessibilityLabel={t.removeFromQueue}>
                  <X size={12} color={tokens.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ── Selector de modo de aprobación (manual / auto / plan) ────────────────────

export function ApprovalModeSelector({
  value, t, tokens, onChange,
}: {
  value: ApprovalMode; t: ComposerMsgs; tokens: ThemeTokens; onChange: (m: ApprovalMode) => void;
}) {
  const items: Array<{ id: ApprovalMode; label: string }> = [
    { id: "manual", label: t.approvalManual },
    { id: "auto", label: t.approvalAuto },
    { id: "plan", label: t.approvalPlan },
  ];
  return (
    <View style={[s.approvalWrap, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]} accessibilityLabel={t.approvalModeLabel}>
      {items.map((it) => {
        const active = value === it.id;
        return (
          <Pressable
            key={it.id}
            onPress={() => onChange(it.id)}
            style={[s.approvalSeg, active ? { backgroundColor: tokens.brand } : null]}
          >
            <Text style={[s.approvalSegText, { color: active ? "#fff" : tokens.textMuted }]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Barra de conectores Office (Drive/OneDrive…) ─────────────────────────────

export function ConnectorsBar({
  connectors, tokens, onBrowse, onManage,
}: {
  connectors: ComposerConnector[]; tokens: ThemeTokens;
  onBrowse: (id: string) => void; onManage: () => void;
}) {
  if (connectors.length === 0) return null;
  const connected = connectors.filter((c) => c.connected);
  return (
    <>
      {connected.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => onBrowse(c.id)}
          style={[s.iconBtn, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}
          accessibilityLabel={c.name}
        >
          <Folder size={16} color={tokens.textSecondary} />
        </Pressable>
      ))}
      <Pressable
        onPress={onManage}
        style={[s.iconBtn, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}
        accessibilityLabel="Office"
      >
        <Plug size={16} color={tokens.textSecondary} />
      </Pressable>
    </>
  );
}

// ── Lightbox / carrusel de imágenes de la conversación ───────────────────────

export function AttachmentLightbox({
  images, index, t, language, tokens, onClose, onIndex,
}: {
  images: ComposerAttachment[]; index: number; t: ComposerMsgs; language?: string; tokens: ThemeTokens;
  onClose: () => void; onIndex: (i: number) => void;
}) {
  const cur = images[index];
  if (!cur) return null;
  return (
    <Modal visible onClose={onClose} title={t.imageViewer} language={language} scrollable={false} fillHeight>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
        {cur.previewUri ? (
          <Image source={{ uri: cur.previewUri }} style={{ width: "100%", height: "78%" }} contentFit="contain" />
        ) : (
          <FileIcon size={64} color={tokens.textMuted} />
        )}
        <Text numberOfLines={1} style={{ color: tokens.textSecondary, fontSize: 13, fontWeight: "600" }}>{cur.name}</Text>
        {images.length > 1 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Pressable onPress={() => onIndex((index - 1 + images.length) % images.length)} style={[s.iconBtn, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
              <ChevronRight size={18} color={tokens.textSecondary} style={{ transform: [{ rotate: "180deg" }] }} />
            </Pressable>
            <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{`${index + 1} / ${images.length}`}</Text>
            <Pressable onPress={() => onIndex((index + 1) % images.length)} style={[s.iconBtn, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
              <ChevronRight size={18} color={tokens.textSecondary} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

// ── Botón de voz: grabación + waveform + estados + transcripción ─────────────

/** Mango imperativo de un grabador de audio inyectado (p. ej. envoltura de
 *  `expo-audio`). El composer permanece agnóstico de la librería concreta. */
export type VoiceRecorderHandle = {
  start: () => Promise<void>;
  stop: () => Promise<{ base64: string; mime: string } | null>;
  cancel: () => void;
};

type VoicePhase = "idle" | "recording" | "staged" | "transcribing";

/** Tope de grabación: al alcanzarlo se DETIENE sola y el clip queda listo para
 *  enviar (sin tope, un clip de muchos minutos superaba el presupuesto del
 *  transcriptor y se perdía entero tras la espera). Muy por debajo del límite
 *  de ~15MB de audio del túnel (`MAX_TOTAL_ATTACHMENT_BASE64`). */
const MAX_RECORDING_MS = 5 * 60_000;

/** Barras animadas que simulan la onda mientras se graba (Animated nativo). */
function Waveform({ active, color }: { active: boolean; color: string }) {
  const bars = useRef(Array.from({ length: 7 }, () => new Animated.Value(0.3))).current;
  useEffect(() => {
    if (!active) return;
    const anims = bars.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 90),
          Animated.timing(v, { toValue: 1, duration: 360, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          Animated.timing(v, { toValue: 0.3, duration: 360, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [active, bars]);
  return (
    <View style={s.wave}>
      {bars.map((v, i) => (
        <Animated.View
          key={i}
          style={[s.waveBar, { backgroundColor: color, height: v.interpolate({ inputRange: [0, 1], outputRange: [4, 18] }) }]}
        />
      ))}
    </View>
  );
}

export function VoiceComposerButton({
  t, tokens, createRecorder, onTranscribe, onSubmit, onPhaseChange,
}: {
  t: ComposerMsgs; tokens: ThemeTokens;
  /** Crea un grabador concreto; `null` ⇒ no hay captura disponible. */
  createRecorder: () => VoiceRecorderHandle | null;
  onTranscribe: (base64: string, mime: string) => Promise<string>;
  onSubmit: (text: string) => void | Promise<void>;
  /** Avisa al composer de que hay voz en curso: mientras lo haya NO debe
   *  desmontar este botón (desmontarlo tira la grabación / el clip). */
  onPhaseChange?: (active: boolean) => void;
}) {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<VoiceRecorderHandle | null>(null);
  const clipRef = useRef<{ base64: string; mime: string } | null>(null);
  const startingRef = useRef(false);
  const stoppingRef = useRef(false);

  const phaseChangeRef = useRef(onPhaseChange);
  phaseChangeRef.current = onPhaseChange;
  useEffect(() => {
    phaseChangeRef.current?.(phase !== "idle");
  }, [phase]);

  const startRec = async () => {
    // Guarda de reentrada: `setPhase("recording")` solo ocurre TRAS el await del
    // arranque (permiso + prepare, cientos de ms). Sin esto, un segundo tap en
    // esa ventana creaba un 2º grabador y pisaba `recRef`, dejando el primero
    // sin referencia — grabando y con el micrófono tomado hasta matar la app.
    if (startingRef.current || recRef.current) return;
    startingRef.current = true;
    phaseChangeRef.current?.(true);
    setError(null);
    const rec = createRecorder();
    if (!rec) { startingRef.current = false; phaseChangeRef.current?.(false); setError(t.voiceUnavailable); return; }
    recRef.current = rec;
    try {
      await rec.start();
      // Cancelado o desmontado mientras arrancaba: libera el micrófono.
      if (recRef.current !== rec) { try { rec.cancel(); } catch { /* ignore */ } return; }
      setPhase("recording");
    } catch (e) {
      // Permiso de micrófono denegado ≠ voz no soportada: díselo al usuario
      // (antes el único indicio era el icono teñido de rojo).
      setError(e instanceof Error && e.message === "microphone-permission-denied"
        ? (t.voicePermission ?? t.voiceUnavailable)
        : t.voiceUnavailable);
      if (recRef.current === rec) recRef.current = null;
      phaseChangeRef.current?.(false);
    } finally {
      startingRef.current = false;
    }
  };
  const stopRec = async () => {
    // Igual que el arranque: un 2º tap en Stop durante el await volvía a parar
    // el mismo grabador y su `null` pisaba el clip ya grabado.
    if (stoppingRef.current) return;
    const rec = recRef.current;
    if (!rec) return;
    stoppingRef.current = true;
    recRef.current = null;
    try { clipRef.current = (await rec.stop()) ?? null; }
    catch { clipRef.current = null; }
    finally { stoppingRef.current = false; }
    setPhase(clipRef.current ? "staged" : "idle");
    if (!clipRef.current) setError(t.voiceError);
  };
  // Auto-stop al tope de grabación: el clip queda "listo" en vez de crecer hasta
  // que el transcriptor lo rechace entero. En background el timer JS se pausa y
  // el micrófono deja de capturar (Android 10+/iOS sin entitlement): al salir de
  // la app se para la grabación en el acto y el clip queda staged.
  const stopRecRef = useRef(stopRec);
  stopRecRef.current = stopRec;
  useEffect(() => {
    if (phase !== "recording") return;
    const timer = setTimeout(() => { void stopRecRef.current(); }, MAX_RECORDING_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") void stopRecRef.current();
    });
    return () => { clearTimeout(timer); sub.remove(); };
  }, [phase]);
  // Desmontaje (atrás de Android, "+ → Regresar", cambio de pantalla) con una
  // grabación viva: cancela y libera el micrófono — sin esto la sesión de audio
  // seguía grabando sin forma de detenerla (la referencia se perdía).
  useEffect(() => () => {
    try { recRef.current?.cancel(); } catch { /* ignore */ }
    recRef.current = null;
    phaseChangeRef.current?.(false);
  }, []);
  // Cancelación EXPLÍCITA (X): único camino, junto al éxito, que tira el clip.
  const cancelRec = () => {
    try { recRef.current?.cancel(); } catch { /* ignore */ }
    recRef.current = null;
    clipRef.current = null;
    setError(null);
    setPhase("idle");
  };
  // El clip SOLO se descarta tras un éxito (o si el usuario cancela). Antes se
  // ponía `clipRef.current = null` ANTES de saber si la transcripción había
  // salido bien y el catch volvía a "idle": una caída de red, un 5xx o una
  // transcripción vacía (el controller devuelve "" sin red si no hay token o el
  // clip pasa el límite) dejaban el audio inalcanzable en memoria — hasta 5
  // minutos de grabación perdidos sin forma de reintentar.
  const sendClip = async () => {
    const clip = clipRef.current;
    if (!clip) { setPhase("idle"); return; }
    setError(null);
    setPhase("transcribing");
    let text = "";
    try {
      text = await onTranscribe(clip.base64, clip.mime);
    } catch {
      setPhase("staged");
      setError(t.voiceError);
      return;
    }
    if (!text.trim()) {
      // Vuelve a "staged" con el clip intacto: el botón Enviar reintenta.
      setPhase("staged");
      setError(t.voiceError);
      return;
    }
    clipRef.current = null;
    setError(null);
    try { await onSubmit(text.trim()); } finally { setPhase("idle"); phaseChangeRef.current?.(false); }
  };

  if (phase === "idle") {
    // Error visible (permiso denegado / transcripción fallida): pill con el
    // motivo + X para descartarlo; el mic reintenta. Antes solo se teñía el
    // icono de rojo y el fallo pasaba desapercibido.
    if (error) {
      return (
        <View style={[s.voicePill, { borderColor: "rgba(244,63,94,0.45)", backgroundColor: tokens.bgInput }]}>
          <Pressable onPress={startRec} hitSlop={6} accessibilityLabel={t.voiceRecord}>
            <Mic size={14} color={tokens.danger} />
          </Pressable>
          <Text numberOfLines={1} style={[s.voiceLabel, { color: tokens.danger, maxWidth: 170 }]}>{error}</Text>
          <Pressable onPress={() => setError(null)} hitSlop={6} accessibilityLabel={t.voiceCancel}>
            <X size={15} color={tokens.textMuted} />
          </Pressable>
        </View>
      );
    }
    return (
      <Pressable onPress={startRec} style={[s.iconBtn, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]} accessibilityLabel={t.voiceRecord}>
        <Mic size={16} color={tokens.textSecondary} />
      </Pressable>
    );
  }
  return (
    <View style={[
      s.voicePill,
      { borderColor: phase === "staged" && error ? "rgba(244,63,94,0.45)" : tokens.border, backgroundColor: tokens.bgInput },
    ]}>
      {phase === "recording" ? (
        <>
          <View style={[s.recDot, { backgroundColor: tokens.danger }]} />
          <Waveform active color={tokens.brand} />
          <Pressable onPress={cancelRec} hitSlop={6} accessibilityLabel={t.voiceCancel}>
            <X size={15} color={tokens.textMuted} />
          </Pressable>
          <Pressable onPress={stopRec} hitSlop={6} accessibilityLabel={t.voiceStop} style={[s.voiceGo, { backgroundColor: tokens.danger }]}>
            <Square size={12} color="#fff" fill="#fff" />
          </Pressable>
        </>
      ) : phase === "staged" ? (
        // Clip listo. Si la transcripción falló, el MISMO pill muestra el motivo
        // conservando el audio: Enviar reintenta, X descarta.
        <>
          <Mic size={14} color={error ? tokens.danger : tokens.success} />
          <Text numberOfLines={1} style={[s.voiceLabel, { color: error ? tokens.danger : tokens.textSecondary, maxWidth: 150 }]}>
            {error ?? t.voiceStaged}
          </Text>
          <Pressable onPress={cancelRec} hitSlop={6} accessibilityLabel={t.voiceCancel}>
            <X size={15} color={tokens.textMuted} />
          </Pressable>
          <Pressable onPress={sendClip} hitSlop={6} accessibilityLabel={t.voiceSend} style={[s.voiceGo, { backgroundColor: tokens.brand }]}>
            <Send size={12} color="#fff" />
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator size="small" color={tokens.brand} />
          <Text style={[s.voiceLabel, { color: tokens.textMuted }]}>{t.voiceTranscribing}</Text>
        </>
      )}
    </View>
  );
}

// ── Drawer de formularios: gestor de conectores Office ───────────────────────

export function ConnectorsManagerModal({
  visible, connectors, t, language, tokens, onClose, onConnect, onDisconnect,
}: {
  visible: boolean; connectors: ComposerConnector[]; t: ComposerMsgs; language?: string; tokens: ThemeTokens;
  onClose: () => void;
  onConnect: (id: string, secrets: Record<string, string>) => Promise<boolean>;
  onDisconnect: (id: string) => Promise<boolean>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  // Conector cuyo formulario de credenciales está abierto + valores tecleados.
  const [formId, setFormId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const disconnect = async (id: string) => {
    setBusyId(id);
    try { await onDisconnect(id); } finally { setBusyId(null); }
  };
  const openForm = (c: ComposerConnector) => {
    if ((c.fields ?? []).length === 0) { void submit(c.id); return; }
    setFormId(c.id); setValues({});
  };
  const submit = async (id: string) => {
    setBusyId(id);
    try { const ok = await onConnect(id, values); if (ok) { setFormId(null); setValues({}); } }
    finally { setBusyId(null); }
  };

  return (
    <FormSheet visible={visible} onClose={onClose} title={t.connectorsTitle} language={language}>
      <View style={{ gap: 8 }}>
        {connectors.map((c) => (
          <View key={c.id} style={[s.connCol, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
            <View style={s.connRowInner}>
              <Plug size={16} color={c.connected ? tokens.success : tokens.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[s.connName, { color: tokens.textPrimary }]}>{c.name}</Text>
                {c.connected ? <Text style={[s.connState, { color: tokens.success }]}>{t.connectorConnected}</Text> : null}
              </View>
              {c.connected ? (
                <Pressable onPress={() => disconnect(c.id)} disabled={busyId === c.id} style={[s.connBtn, { borderColor: tokens.border, backgroundColor: tokens.bgCardSolid }]}>
                  {busyId === c.id ? <ActivityIndicator size="small" color={tokens.textMuted} /> : <Text style={[s.connBtnText, { color: tokens.textSecondary }]}>{t.connectorDisconnect}</Text>}
                </Pressable>
              ) : (
                <Pressable onPress={() => openForm(c)} disabled={busyId === c.id} style={[s.connBtn, { borderColor: tokens.brand, backgroundColor: tokens.brand }]}>
                  {busyId === c.id && formId !== c.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[s.connBtnText, { color: "#fff" }]}>{t.connectorConnect}</Text>}
                </Pressable>
              )}
            </View>
            {formId === c.id ? (
              <View style={{ gap: 6, marginTop: 8 }}>
                {(c.setupSteps ?? []).length > 0 ? (
                  <Text style={{ color: tokens.textMuted, fontSize: 11, lineHeight: 15 }}>{(c.setupSteps ?? []).join("\n")}</Text>
                ) : null}
                {(c.fields ?? []).map((f) => (
                  <View key={f.key} style={{ gap: 2 }}>
                    <Text style={{ color: tokens.textMuted, fontSize: 11, fontWeight: "600" }}>{f.label}</Text>
                    <TextInput
                      value={values[f.key] ?? ""}
                      onChangeText={(v) => setValues((p) => ({ ...p, [f.key]: v }))}
                      placeholder={f.placeholder}
                      placeholderTextColor={tokens.textMuted}
                      secureTextEntry={f.type === "password"}
                      multiline={f.type === "textarea"}
                      autoCapitalize="none"
                      style={[s.connInput, { borderColor: tokens.border, backgroundColor: tokens.bgCardSolid, color: tokens.textPrimary, height: f.type === "textarea" ? 72 : 38 }]}
                    />
                  </View>
                ))}
                <Pressable onPress={() => submit(c.id)} disabled={busyId === c.id} style={[s.connBtn, { borderColor: tokens.brand, backgroundColor: tokens.brand, alignSelf: "flex-start", marginTop: 2 }]}>
                  {busyId === c.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[s.connBtnText, { color: "#fff" }]}>{t.connectorConnect}</Text>}
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </FormSheet>
  );
}

// ── Drawer de formularios: explorar archivos de un conector ──────────────────

export function ConnectorBrowseModal({
  visible, connector, t, language, tokens, onClose, onBrowse, onAttach,
}: {
  visible: boolean; connector: ComposerConnector | null; t: ComposerMsgs; language?: string; tokens: ThemeTokens;
  onClose: () => void;
  onBrowse: (id: string, query: string) => Promise<ConnectorBrowseItem[]>;
  onAttach: (id: string, fileId: string, name: string) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<ConnectorBrowseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const id = connector?.id ?? "";

  useEffect(() => {
    if (!visible || !id) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      void onBrowse(id, query).then((res) => { if (!cancelled) setFiles(res); }).finally(() => { if (!cancelled) setLoading(false); });
    }, query ? 320 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [visible, id, query, onBrowse]);

  const attach = async (f: ConnectorBrowseItem) => {
    setFetchingId(f.id);
    try { const ok = await onAttach(id, f.id, f.name); if (ok) onClose(); } finally { setFetchingId(null); }
  };

  return (
    <FormSheet visible={visible} onClose={onClose} title={`${t.connectorBrowseTitle} ${connector?.name ?? ""}`} language={language} scrollable={false} fillHeight>
      <View style={{ flex: 1, gap: 8 }}>
        <View style={[s.searchRow, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
          <Search size={15} color={tokens.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t.connectorSearch}
            placeholderTextColor={tokens.textMuted}
            style={{ flex: 1, color: tokens.textPrimary, fontSize: 13 }}
            autoCapitalize="none"
          />
        </View>
        {loading ? (
          <View style={{ paddingVertical: 24, alignItems: "center" }}><ActivityIndicator color={tokens.brand} /></View>
        ) : files.length === 0 ? (
          <Text style={{ color: tokens.textMuted, textAlign: "center", paddingVertical: 24, fontSize: 13 }}>{t.connectorNoFiles}</Text>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
            {files.map((f, idx) => (
              <View key={f.id} style={[s.fileRow, { borderBottomColor: tokens.border }, idx === files.length - 1 && { borderBottomWidth: 0 }]}>
                {f.isFolder ? <Folder size={16} color={tokens.warning} /> : <FileIcon size={16} color={tokens.textMuted} />}
                <Text numberOfLines={1} style={{ flex: 1, color: tokens.textPrimary, fontSize: 13 }}>{f.name}</Text>
                {!f.isFolder ? (
                  <Pressable onPress={() => attach(f)} disabled={fetchingId === f.id} style={[s.connBtn, { borderColor: tokens.brand, backgroundColor: tokens.brand }]}>
                    {fetchingId === f.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[s.connBtnText, { color: "#fff" }]}>{t.connectorAttach}</Text>}
                  </Pressable>
                ) : null}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </FormSheet>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  slashPop: {
    position: "absolute", left: 8, right: 8, bottom: "100%", marginBottom: 6,
    borderWidth: 1, borderRadius: 10, overflow: "hidden", zIndex: 30, elevation: 8,
  },
  slashRow: { flexDirection: "row", alignItems: "baseline", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  slashCmd: { fontFamily: "monospace", fontSize: 12, fontWeight: "700" },
  slashArgs: { fontFamily: "monospace", fontSize: 10 },
  slashDesc: { flex: 1, fontSize: 11, textAlign: "right" },
  mcpBox: { flexDirection: "row", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  mcpTitle: { fontSize: 12, fontWeight: "700" },
  mcpBody: { fontSize: 11, lineHeight: 15, opacity: 0.9, marginTop: 2 },
  queuedHead: { flexDirection: "row", alignItems: "center", gap: 4 },
  queuedHeadText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  queuedWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  queuedChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, maxWidth: "100%" },
  queuedIdx: { fontSize: 11, fontVariant: ["tabular-nums"] },
  queuedText: { fontSize: 11, maxWidth: 150 },
  approvalWrap: { flexDirection: "row", borderWidth: 1, borderRadius: 8, padding: 2, gap: 2 },
  approvalSeg: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  approvalSegText: { fontSize: 11, fontWeight: "700" },
  iconBtn: { width: 38, height: 38, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  voicePill: { flexDirection: "row", alignItems: "center", gap: 8, height: 38, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10 },
  voiceLabel: { fontSize: 12, fontWeight: "600" },
  voiceGo: { width: 26, height: 26, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  recDot: { width: 8, height: 8, borderRadius: 999 },
  wave: { flexDirection: "row", alignItems: "center", gap: 3, height: 20 },
  waveBar: { width: 3, borderRadius: 2 },
  connCol: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  connRowInner: { flexDirection: "row", alignItems: "center", gap: 10 },
  connInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, fontSize: 13, textAlignVertical: "top" },
  connName: { fontSize: 13, fontWeight: "700" },
  connState: { fontSize: 11, fontWeight: "600", marginTop: 1 },
  connBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, minWidth: 92, alignItems: "center" },
  connBtnText: { fontSize: 12, fontWeight: "700" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, height: 38 },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
});

// Re-exporta para que el navbar no tenga que importar de dos sitios.
export type { ComposerAttachment, ComposerConnector, ConnectorBrowseItem, ApprovalMode };
