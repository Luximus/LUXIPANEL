import { nativeText } from '../../i18n/native-text';
import React, { useContext, useEffect, useRef, useState } from "react";
import { PanelText as Text } from "../../components/ui/PanelText";
import { Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Check, Code2, Folders, History, Pencil, Plus, RefreshCw, Settings, TerminalSquare, X } from "lucide-react-native";
import * as Crypto from "expo-crypto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import NativeTerminalSession, { type TerminalActions, type TerminalStatus, type TerminalViewport } from "../../components/NativeTerminalSession";
import { NativeModuleContext } from "../main/native-module-context";
import { killTerminalSession } from "../../api/client/terminal";
import { loadSessionState } from "../../lib/session-state";
import { pushCommandHistory } from "../../lib/terminal-command-history";
import { NativeModuleHeader } from "../../components/server/NativeModuleHeader";
import { ModuleSettingsDrawer } from "../../components/ui/ModuleSettingsDrawer";
import { useInlineEditCancel } from "../../hooks/useInlineEditCancel";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens, readableTextOn } from "../../theme/colors";
import ServerSnippetsTab from "../../components/ServerSnippetsTab";
import { getTerminalPreferences } from "../../components/server-snippets/terminal-preferences";

type Pane = "config" | "historial" | "snippets" | "consolas";
type Console = { id: string; name: string };

/** Mirrors the web's mobile dock; changing panes never unmounts a PTY. */
export function NativeTerminalScreen({ panelId, token, onBack }: {
  panelId: string; token: string; onBack: () => void;
}) {
  const context = useContext(NativeModuleContext);
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const [consoles, setConsoles] = useState<Console[]>(() => [{ id: Crypto.randomUUID(), name: "Terminal 1" }]);
  const [selected, setSelected] = useState(consoles[0].id);
  const [pane, setPane] = useState<Pane | null>(null);
  const [toolTab, setToolTab] = useState<Exclude<Pane, "consolas"> | null>(null);
  const [newSnippetRequest, setNewSnippetRequest] = useState(0);
  const [canCreateSnippet, setCanCreateSnippet] = useState(false);
  const [fontSize, setFontSize] = useState(13);
  const [statuses, setStatuses] = useState<Record<string, TerminalStatus>>({});
  const [viewport, setViewport] = useState<TerminalViewport>({ bottom: 0, height: 0 });
  const injectors = useRef(new Map<string, (js: string) => void>());
  const actions = useRef(new Map<string, TerminalActions>());
  const nextNumber = useRef(2);
  const requestedRevision = useRef(context?.viewRevision);
  const language = loadSessionState().language;
  const es = language.startsWith("es");
  const visible = context?.visible ?? true;
  const status = statuses[selected] ?? "connecting";
  const statusLabel = status === "ready" ? (es ? nativeText("Conectado") : nativeText("Connected")) : status === "connecting" ? (es ? nativeText("Conectando…") : nativeText("Connecting…")) : (es ? nativeText("Desconectado") : "Disconnected");
  const statusColor = status === "ready" ? tokens.success : status === "connecting" ? tokens.warning : tokens.danger;
  const buttons = [
    { key: "config", label: es ? nativeText("Configuración") : nativeText("Settings"), Icon: Settings },
    { key: "historial", label: es ? nativeText("Historial") : nativeText("History"), Icon: History },
    { key: "snippets", get label() { return nativeText("Snippets"); }, Icon: Code2 },
    { key: "consolas", label: es ? nativeText("Consolas") : nativeText("Consoles"), Icon: Folders },
  ] as const;
  const panel = buttons.find((item) => item.key === pane);
  useEffect(() => { if (!selected) setViewport({ bottom: 0, height: 0 }); }, [selected]);
  const PanelIcon = panel?.Icon ?? Folders;
  const closePane = () => { Keyboard.dismiss(); setPane(null); };
  const openPane = (next: Pane) => {
    actions.current.get(selected)?.blur();
    Keyboard.dismiss();
    if (next !== "consolas") setToolTab(next);
    setPane(next);
  };
  useEffect(() => {
    let current = true;
    setFontSize(13);
    void getTerminalPreferences(panelId, token).then((prefs) => {
      if (current && prefs) setFontSize(prefs.fontSize);
    });
    return () => { current = false; };
  }, [panelId, token]);
  const add = () => {
    const id = Crypto.randomUUID();
    const name = `Terminal ${nextNumber.current++}`;
    setConsoles((old) => [...old, { id, name }]);
    setSelected(id);
    closePane();
  };
  useEffect(() => {
    if (requestedRevision.current === context?.viewRevision) return;
    requestedRevision.current = context?.viewRevision;
    if (context?.selectedView === "new") add();
  }, [context?.selectedView, context?.viewRevision]);
  const close = (id: string) => {
    void killTerminalSession(panelId, token, id);
    injectors.current.delete(id);
    actions.current.delete(id);
    const index = consoles.findIndex((row) => row.id === id);
    if (selected === id) setSelected(consoles[index + 1]?.id ?? consoles[index - 1]?.id ?? "");
    setConsoles((old) => old.filter((row) => row.id !== id));
    setStatuses((old) => { const next = { ...old }; delete next[id]; return next; });
  };
  return (
    <View style={[styles.root, { backgroundColor: "#0b1220", paddingTop: context?.insideWorkspace || context?.insideModuleDrawer ? 0 : insets.top }]}>
      <NativeModuleHeader title={nativeText("Terminal")} subtitle={consoles.find((row) => row.id === selected)?.name}
        onSettings={() => openPane("config")}
        closeLabel={es ? nativeText("Volver al chat") : nativeText("Return to chat")}
        onClose={() => { actions.current.get(selected)?.blur(); Keyboard.dismiss(); onBack(); }}
      />
      {consoles.map((row) => (
        <View key={row.id} style={[styles.fill, selected !== row.id && styles.hidden]} pointerEvents={selected === row.id && !pane ? "auto" : "none"} accessibilityElementsHidden={selected !== row.id || !!pane} importantForAccessibility={selected === row.id && !pane ? "auto" : "no-hide-descendants"}>
          <NativeTerminalSession
            panelId={panelId} token={token} language={language} fontSize={fontSize} sessionId={row.id}
            active={visible && selected === row.id && !pane}
            onRegisterInjector={(inject) => { injectors.current.set(row.id, inject); }}
            onRegisterActions={(value) => { actions.current.set(row.id, value); }}
            onStatusChange={(value) => setStatuses((old) => old[row.id] === value ? old : { ...old, [row.id]: value })}
            onViewportChange={(value) => { if (selected === row.id) setViewport((old) => old.bottom === value.bottom && old.height === value.height ? old : value); }}
            onCommand={(command, injected) => { if (!injected) void pushCommandHistory(panelId, command); }}
          />
        </View>
      ))}
      {!consoles.length && <Pressable onPress={add} style={styles.empty} accessibilityRole="button">
        <Plus size={24} color={tokens.brand} />
        <Text style={{ color: "#cbd5e1" }}>{es ? nativeText("Nueva terminal") : nativeText("New terminal")}</Text>
      </Pressable>}
      {!pane && <View testID="terminal-floating-actions" style={[styles.dock, {
        right: Math.max(16, insets.right),
        bottom: Math.max(16, insets.bottom) + viewport.bottom,
        flexDirection: viewport.height > 0 && viewport.height + 48 < 232 ? "row" : "column",
      }]}>
        {buttons.filter(({ key }) => key !== "config").map(({ key, label, Icon }) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: pane === key }} onPress={() => openPane(key)} style={({ pressed }) => [styles.floatingButton, {
          backgroundColor: key === "consolas" ? tokens.brand : tokens.bgCardSolid,
          borderColor: key === "consolas" ? tokens.brand : tokens.border,
          opacity: pressed ? 0.8 : 1,
        }]}>
          <Icon size={20} color={key === "consolas" ? readableTextOn(tokens.brand) : tokens.textPrimary} />
        </Pressable>)}
      </View>}
      <ModuleSettingsDrawer visible={!!pane} onClose={closePane} title={panel?.label ?? nativeText("Terminal")} language={language}
        headerIcon={<PanelIcon size={20} color={tokens.brand} />}
        headerActions={pane === "snippets" ? <Pressable style={styles.iconButton} disabled={!canCreateSnippet} accessibilityState={{ disabled: !canCreateSnippet }} accessibilityRole="button" accessibilityLabel={es ? nativeText("Nuevo snippet") : nativeText("New snippet")} onPress={() => setNewSnippetRequest((old) => old + 1)}><Plus size={20} color={canCreateSnippet ? tokens.brand : tokens.textMuted} /></Pressable> : undefined}
      >
            {pane === "consolas" && <ConsoleList consoles={consoles} selected={selected} es={es}
              onSelect={(id) => { setSelected(id); closePane(); }} onClose={close}
              onRename={(id, name) => setConsoles((old) => old.map((row) => row.id === id ? { ...row, name: name.trim() || row.name } : row))}
            />}
            {pane === "consolas" && <View style={[styles.footer, { borderColor: tokens.border }]}>
              <View style={styles.footerRow}>
                <Pressable accessibilityRole="button" accessibilityLabel={es ? nativeText("Nueva terminal") : nativeText("New terminal")} onPress={add} style={[styles.newButton, { backgroundColor: tokens.bgSecondary, borderColor: tokens.border }]}>
                  <Plus size={18} color={tokens.textPrimary} /><Text style={{ color: tokens.textPrimary, fontWeight: "600", fontSize: 12 }}>{es ? nativeText("Nueva terminal") : nativeText("New terminal")}</Text>
                </Pressable>
                {!!consoles.length && <View accessibilityLabel={statusLabel} style={styles.status}><View style={[styles.dot, { backgroundColor: statusColor }]} /></View>}
              </View>
              {!!consoles.length && <View style={styles.footerRow}>
                <Text accessibilityLiveRegion="polite" style={{ flex: 1, color: tokens.textMuted, fontSize: 12 }}>{statusLabel}</Text>
                {(status === "error" || status === "exited") && <Pressable accessibilityRole="button" accessibilityLabel={es ? nativeText("Reconectar terminal") : nativeText("Reconnect terminal")} style={styles.reconnect} onPress={() => { actions.current.get(selected)?.reconnect(); closePane(); }}><RefreshCw size={15} color={tokens.brand} /><Text style={{ color: tokens.brand }}>{es ? nativeText("Reconectar") : nativeText("Reconnect")}</Text></Pressable>}
              </View>}
            </View>}
            {/* Keep the tools instance mounted so search and snippet drafts survive closing a panel. */}
            {toolTab && <View style={[styles.fill, pane === "consolas" && styles.hidden]}>
              <ServerSnippetsTab tab={toolTab} hideTabs newSnippetRequest={newSnippetRequest}
                onSnippetAvailabilityChange={setCanCreateSnippet}
                panelId={panelId} token={token} language={language}
                onPreferencesChange={(prefs) => setFontSize(prefs.fontSize)}
                injectIntoTerminal={(js) => injectors.current.get(selected)?.(js)} onAfterRun={closePane}
              />
            </View>}
      </ModuleSettingsDrawer>
    </View>
  );
}

function ConsoleList({ consoles, selected, es, onSelect, onClose, onRename }: {
  consoles: Console[]; selected: string; es: boolean;
  onSelect: (id: string) => void; onClose: (id: string) => void; onRename: (id: string, name: string) => void;
}) {
  const language = loadSessionState().language;
  const context = useContext(NativeModuleContext);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  useInlineEditCancel(editing !== null && (context?.visible ?? true), () => setEditing(null));
  const commit = () => { if (editing) onRename(editing, draft); setEditing(null); Keyboard.dismiss(); };
  return <ScrollView style={styles.fill} contentContainerStyle={styles.consoleList} keyboardShouldPersistTaps="handled">
    {!consoles.length && <Text style={{ color: tokens.textMuted }}>{es ? nativeText("No hay consolas abiertas") : nativeText("No open consoles")}</Text>}
    {consoles.map((row) => <View key={row.id} style={[styles.consoleRow, { backgroundColor: row.id === selected ? tokens.brandDim : "transparent", borderLeftColor: row.id === selected ? tokens.brand : "transparent" }]}>
      {editing === row.id ? <TextInput autoFocus selectTextOnFocus value={draft} onChangeText={setDraft} onSubmitEditing={commit} accessibilityLabel={es ? nativeText("Nombre de la terminal") : nativeText("Terminal name")} style={[styles.renameInput, { color: tokens.textPrimary, borderColor: tokens.border }]} /> : <Pressable accessibilityRole="button" accessibilityState={{ selected: row.id === selected }} onPress={() => onSelect(row.id)} style={styles.consoleSelect}>
        <TerminalSquare size={16} color={row.id === selected ? tokens.brand : tokens.textMuted} /><Text numberOfLines={1} style={[styles.fill, { color: tokens.textPrimary, fontSize: 13 }]}>{row.name}</Text>
      </Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel={`${nativeText(editing === row.id ? "Guardar" : "Renombrar", undefined, language)} ${row.name}`} style={styles.rowButton} onPress={() => { if (editing === row.id) commit(); else { setEditing(row.id); setDraft(row.name); } }}>
        {editing === row.id ? <Check size={16} color={tokens.brand} /> : <Pencil size={15} color={tokens.textMuted} />}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${nativeText("Cerrar", undefined, language)} ${row.name}`} onPress={() => { if (editing === row.id) { setEditing(null); Keyboard.dismiss(); } onClose(row.id); }} style={styles.rowButton}><X size={16} color={tokens.textMuted} /></Pressable>
    </View>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, fill: { flex: 1 }, hidden: { display: "none" },
  iconButton: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  dock: { position: "absolute", gap: 10, zIndex: 2 },
  floatingButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center", elevation: 5, shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } },
  consoleList: { padding: 8, gap: 4 },
  consoleRow: { minHeight: 48, paddingHorizontal: 6, gap: 4, flexDirection: "row", alignItems: "center", borderLeftWidth: 3, borderRadius: 8 },
  consoleSelect: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 4 },
  rowButton: { width: 32, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 6 },
  renameInput: { flex: 1, height: 40, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, fontSize: 13 },
  footer: { padding: 12, gap: 8, borderTopWidth: 1 }, footerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  newButton: { flex: 1, minHeight: 44, borderRadius: 8, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  status: { width: 36, alignItems: "center", justifyContent: "center" }, dot: { width: 9, height: 9, borderRadius: 5 },
  reconnect: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 6 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
});
