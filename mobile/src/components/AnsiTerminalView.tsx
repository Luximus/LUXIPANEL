// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ScopedNativeModal as Modal } from "../screens/main/native-module-context";;
import { Bot, Maximize2, Network, X } from "lucide-react-native";
import {
  ANSI_DARK_PALETTE,
  ANSI_LIGHT_PALETTE,
  parseAnsi,
  resolveAnsiColor,
  type AnsiSegment,
} from "./ansi-parser";
import { getThemeTokens } from "../theme/colors";

/**
 * Mini-terminal de SOLO LECTURA que pinta la salida ANSI de un proveedor CLI de
 * forma NATIVA (réplica de `CliTerminalView.tsx` de LUXIPANEL, que usa xterm.js).
 * Sin WebView, sin xterm: el parser `ansi-parser.ts` trocea la salida en
 * segmentos de color y aquí se pintan como `<Text>` monospace sobre un fondo de
 * terminal oscuro. Autoscroll al fondo, seleccionable, y botón de pantalla
 * completa (modal RN). Si hay más de un "lane" (orquestador + subagentes) se
 * muestran pestañas arriba con punto de estado (verde/ámbar/rojo) para conmutar
 * qué lane se ve.
 */

export type LaneStatus = "running" | "done" | "failed";

export interface TerminalLane {
  id?: string;
  title: string;
  subagentType?: string;
  status?: LaneStatus;
  output: string;
}

export interface AnsiTerminalLabels {
  /** Etiqueta del lane principal (multi-agente). */
  orchestrator: string;
  /** Etiqueta de un subagente sin nombrar. */
  subagent: string;
  /** Aviso "ejecutándose en el servidor". */
  runningOnServer: string;
  /** Accesibilidad: abrir pantalla completa. */
  expandFullscreen: string;
  /** Accesibilidad: cerrar pantalla completa. */
  closeFullscreen: string;
}

// i18n: defaults en ESPAÑOL (la Ola 2 / Fase F7 inyectan los locales reales al
// cablear `ServerAssistantPane`, que sí conoce `language`). Espejo del patrón
// `cliUsageBarsFallback` de la web.
export const ANSI_TERMINAL_LABELS_ES: AnsiTerminalLabels = {
  orchestrator: "Orquestador",
  subagent: "subagente",
  runningOnServer: "Ejecutándose en el servidor…",
  expandFullscreen: "Pantalla completa",
  closeFullscreen: "Cerrar",
};

// Locales reales (F7). El selector toma el prefijo de 2 letras y cae a `es`.
const ANSI_TERMINAL_LABELS: Record<string, AnsiTerminalLabels> = {
  es: ANSI_TERMINAL_LABELS_ES,
  en: { orchestrator: "Orchestrator", subagent: "subagent", runningOnServer: "Running on the server…", expandFullscreen: "Fullscreen", closeFullscreen: "Close" },
  fr: { orchestrator: "Orchestrateur", subagent: "sous-agent", runningOnServer: "Exécution sur le serveur…", expandFullscreen: "Plein écran", closeFullscreen: "Fermer" },
  pt: { orchestrator: "Orquestrador", subagent: "subagente", runningOnServer: "Executando no servidor…", expandFullscreen: "Tela cheia", closeFullscreen: "Fechar" },
  it: { orchestrator: "Orchestratore", subagent: "sotto-agente", runningOnServer: "In esecuzione sul server…", expandFullscreen: "Schermo intero", closeFullscreen: "Chiudi" },
  ru: { orchestrator: "Оркестратор", subagent: "субагент", runningOnServer: "Выполняется на сервере…", expandFullscreen: "Полный экран", closeFullscreen: "Закрыть" },
  zh: { orchestrator: "编排器", subagent: "子代理", runningOnServer: "正在服务器上运行…", expandFullscreen: "全屏", closeFullscreen: "关闭" },
  ko: { orchestrator: "오케스트레이터", subagent: "서브에이전트", runningOnServer: "서버에서 실행 중…", expandFullscreen: "전체 화면", closeFullscreen: "닫기" },
  ja: { orchestrator: "オーケストレーター", subagent: "サブエージェント", runningOnServer: "サーバーで実行中…", expandFullscreen: "全画面", closeFullscreen: "閉じる" },
  hi: { orchestrator: "ऑर्केस्ट्रेटर", subagent: "उप-एजेंट", runningOnServer: "सर्वर पर चल रहा है…", expandFullscreen: "पूर्ण स्क्रीन", closeFullscreen: "बंद करें" },
  ar: { orchestrator: "المنسّق", subagent: "وكيل فرعي", runningOnServer: "قيد التشغيل على الخادم…", expandFullscreen: "ملء الشاشة", closeFullscreen: "إغلاق" },
};

/** Etiquetas del terminal ANSI para el locale dado (prefijo de 2 letras). */
export function ansiTerminalLabels(lang?: string): AnsiTerminalLabels {
  return ANSI_TERMINAL_LABELS[(lang ?? "es").slice(0, 2)] ?? ANSI_TERMINAL_LABELS_ES;
}

function statusDotColor(status: LaneStatus | undefined, tokens: ReturnType<typeof getThemeTokens>): string {
  if (status === "done") return tokens.success;
  if (status === "failed") return tokens.danger;
  return tokens.warning; // running (pulso) o desconocido
}

/** Punto de estado: pulsa (opacidad) cuando el lane sigue corriendo. */
function StatusDot({ status, tokens }: { status?: LaneStatus; tokens: ReturnType<typeof getThemeTokens> }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const running = status === "running" || status === undefined;
  useEffect(() => {
    if (!running) { pulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [running, pulse]);
  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: statusDotColor(status, tokens), opacity: running ? pulse : 1 }]}
    />
  );
}

/** Indicador "ejecutándose en el servidor" (punto verde pulsante + texto). */
function RunningIndicator({ tokens, label }: { tokens: ReturnType<typeof getThemeTokens>; label: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.runningRow}>
      <Animated.View style={[styles.dot, { backgroundColor: tokens.success, opacity: pulse }]} />
      <Text style={[styles.runningText, { color: tokens.success }]}>{label}</Text>
    </View>
  );
}

/** Tira de pestañas: un tab por lane, orquestador primero. */
function LaneTabs({
  lanes,
  laneOrder,
  selected,
  onSelect,
  labels,
  tokens,
}: {
  lanes: Record<string, TerminalLane>;
  laneOrder: string[];
  selected: string;
  onSelect: (id: string) => void;
  labels: AnsiTerminalLabels;
  tokens: ReturnType<typeof getThemeTokens>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.tabsBar, { borderBottomColor: tokens.border }]}
      contentContainerStyle={styles.tabsContent}
    >
      {laneOrder.map((id) => {
        const lane = lanes[id];
        if (!lane) return null;
        const isMain = id === "main";
        const active = id === selected;
        const label = isMain ? labels.orchestrator : lane.title || labels.subagent;
        const IconCmp = isMain ? Network : Bot;
        return (
          <Pressable
            key={id}
            onPress={() => onSelect(id)}
            style={[styles.tab, active ? { backgroundColor: tokens.brandDim } : null]}
          >
            <IconCmp size={12} color={active ? tokens.brandLight : "#8b97a7"} />
            <Text
              numberOfLines={1}
              style={[styles.tabLabel, { color: active ? "#e4e4e7" : "#8b97a7" }]}
            >
              {label}
            </Text>
            <StatusDot status={lane.status} tokens={tokens} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Cuerpo del terminal: salida ANSI parseada → <Text> monospace con autoscroll. */
function TerminalBody({
  output,
  isDark,
  flex,
}: {
  output: string;
  isDark: boolean;
  flex?: boolean;
}) {
  const palette = isDark ? ANSI_DARK_PALETTE : ANSI_LIGHT_PALETTE;
  const defaultFg = isDark ? "#e4e4e7" : "#1f2937";
  const segments = useMemo(() => parseAnsi(output), [output]);
  const scrollRef = useRef<ScrollView | null>(null);

  return (
    <ScrollView
      ref={scrollRef}
      style={flex ? styles.bodyFlex : styles.bodyFixed}
      contentContainerStyle={styles.bodyContent}
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      showsVerticalScrollIndicator
    >
      <Text selectable style={[styles.mono, { color: defaultFg }]}>
        {segments.map((seg, i) => (
          <AnsiSpan key={i} seg={seg} palette={palette} defaultFg={defaultFg} />
        ))}
      </Text>
    </ScrollView>
  );
}

function AnsiSpan({ seg, palette, defaultFg }: { seg: AnsiSegment; palette: Record<string, string>; defaultFg: string }) {
  const color = resolveAnsiColor(seg.color, palette) ?? defaultFg;
  const bg = resolveAnsiColor(seg.bgColor, palette);
  return (
    <Text
      style={{
        color,
        backgroundColor: bg,
        fontWeight: seg.bold ? "700" : "400",
        opacity: seg.dim ? 0.65 : 1,
        textDecorationLine: seg.underline ? "underline" : "none",
      }}
    >
      {seg.text}
    </Text>
  );
}

export function AnsiTerminalView({
  output,
  lanes,
  laneOrder,
  running,
  theme,
  labels = ANSI_TERMINAL_LABELS_ES,
}: {
  /** Modo buffer único (historial / no multi-agente). */
  output?: string;
  /** Modo multi-agente: buffers por lane (orquestador + subagentes). */
  lanes?: Record<string, TerminalLane>;
  /** Orden de visualización de {@link lanes}; la primera es la pestaña por defecto. */
  laneOrder?: string[];
  running?: boolean;
  theme: "dark" | "light";
  labels?: AnsiTerminalLabels;
}) {
  const isDark = theme === "dark";
  const tokens = getThemeTokens(isDark);
  const tabbed = !!lanes && !!laneOrder && laneOrder.length > 0;

  const [selfSelected, setSelfSelected] = useState<string>(laneOrder?.[0] ?? "main");
  // Protege contra una selección que ya no existe (la lista de lanes crece/mengua).
  const selected = tabbed && lanes![selfSelected] ? selfSelected : (laneOrder?.[0] ?? "main");

  const activeOutput = tabbed ? (lanes![selected]?.output ?? "") : (output ?? "");
  const laneStatus = tabbed ? lanes![selected]?.status : undefined;
  const showRunning = tabbed ? laneStatus === "running" : !!running;

  const [expanded, setExpanded] = useState(false);
  const termBg = isDark ? "#0a0a0a" : "#e5e7eb";

  const tabs = tabbed && laneOrder!.length > 1 ? (
    <LaneTabs
      lanes={lanes!}
      laneOrder={laneOrder!}
      selected={selected}
      onSelect={setSelfSelected}
      labels={labels}
      tokens={tokens}
    />
  ) : null;

  return (
    <View style={[styles.wrap, { backgroundColor: termBg, borderColor: tokens.border }]}>
      <Pressable
        onPress={() => setExpanded(true)}
        accessibilityLabel={labels.expandFullscreen}
        hitSlop={8}
        style={styles.maxBtn}
      >
        <Maximize2 size={13} color="#c7cdd6" />
      </Pressable>
      {tabs}
      <TerminalBody output={activeOutput} isDark={isDark} />
      {showRunning ? <RunningIndicator tokens={tokens} label={labels.runningOnServer} /> : null}

      <Modal visible={expanded} animationType="fade" transparent onRequestClose={() => setExpanded(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable
            onPress={() => setExpanded(false)}
            accessibilityLabel={labels.closeFullscreen}
            hitSlop={8}
            style={styles.modalClose}
          >
            <X size={20} color="#ffffff" />
          </Pressable>
          <View style={[styles.modalBox, { backgroundColor: termBg, borderColor: "rgba(255,255,255,0.1)" }]}>
            {tabs}
            <TerminalBody output={activeOutput} isDark={isDark} flex />
            {showRunning ? <RunningIndicator tokens={tokens} label={labels.runningOnServer} /> : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    borderRadius: 8,
    borderWidth: 1,
    padding: 4,
    overflow: "hidden",
  },
  maxBtn: {
    position: "absolute",
    right: 6,
    top: 6,
    zIndex: 10,
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  tabsBar: {
    borderBottomWidth: 1,
    marginBottom: 4,
    marginRight: 30, // hueco para el botón de pantalla completa
  },
  tabsContent: { gap: 4, alignItems: "center", paddingBottom: 4 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tabLabel: { fontSize: 10, fontWeight: "600", maxWidth: 130 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  bodyFixed: { height: 256, width: "100%" },
  bodyFlex: { flex: 1, width: "100%" },
  bodyContent: { paddingHorizontal: 6, paddingVertical: 4 },
  mono: {
    fontFamily: "monospace",
    fontSize: 11,
    lineHeight: 16,
  },
  runningRow: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 5, paddingTop: 2 },
  runningText: { fontSize: 10 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    padding: 12,
    paddingTop: 56,
  },
  modalClose: {
    position: "absolute",
    right: 16,
    top: 16,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  modalBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 6,
    overflow: "hidden",
  },
});

export default AnsiTerminalView;
