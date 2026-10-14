import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  ArrowDownUp,
  Check,
  Cpu,
  Globe,
  HardDrive,
  KeyRound,
  MemoryStick,
  Unplug,
  Server,
  PencilRuler,
  Tag,
  Trash2,
} from "lucide-react-native";
import type { PanelRow, PanelEditorState, ServerMetricsState, ServerPingStatus } from "../features/app/viewModels";
import {
  testServerSshConnection,
  type PanelTaxonomy,
  type SshKeyOption,
  type SshKeySummary,
} from "../api/client";
import { computeMetricDisplay, type MetricKind, type MetricSeverity } from "../features/app/metrics-format";
import { sanitizeIp, sanitizePort } from "../features/app/panel-editor-utils";
import { getLocaleRowDirection, getLocaleTextAlign, getMessages } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { SegmentedControl } from "./ui/SegmentedControl";
import { Button } from "./ui/Button";
import { IconButton } from "./ui/IconButton";
import { Select } from "./ui/Select";
import { Chip } from "./ui/Chip";
import { SettingsPanels, type SettingsTab } from "./DataTableSettingsModal";
import ServerChatTab from "./ServerChatTab";
import { AssistantSettingsTab } from "./assistant-settings/AssistantSettingsTab";
import ServerSnippetsTab from "./ServerSnippetsTab";
import { ServerTabSkeleton, ChatTabSkeleton, ListPanelSkeleton } from "./skeletons";
import { usePullRefresh } from "../hooks/usePullRefresh";

type ThemeTokens = ReturnType<typeof getThemeTokens>;

/** Tabs del drawer izquierdo. Para invitados solo se muestra "server". */
export type ServerDrawerTab = "snippets" | "chat" | "settings" | "server" | "ssh_keys" | "categories";

/** Orden de los tabs del drawer izquierdo (para navegación por swipe infinita).
 *  Dos modos EXCLUYENTES:
 *   · Vista servers (carousel/dashboard, sin módulo activo): tabs permanentes
 *     `server`/`ssh_keys`/`categories`.
 *   · Dentro de un módulo (terminal abierto o chat iniciado): SOLO los tabs del
 *     módulo — `snippets` (Terminal, primero) y `chat` + `settings` (ajustes del
 *     asistente, al lado de Chat). Los tabs de servers se ocultan aquí.
 *  Invitado: solo "server". */
export function serverDrawerTabsFor(guestMode: boolean, chatStarted: boolean, terminalOpen = false): ServerDrawerTab[] {
  if (guestMode) return ["server"];
  const modules: ServerDrawerTab[] = [];
  if (terminalOpen) modules.push("snippets");
  if (chatStarted) modules.push("chat", "settings");
  // Dentro de un módulo NO se muestran los tabs de servers (server/ssh/categorías):
  // esos solo viven en la vista servers (carousel).
  if (modules.length > 0) return modules;
  return ["server", "ssh_keys", "categories"];
}

/** Tabs (clave + etiqueta i18n) del drawer izquierdo. Lo consume tanto este
 *  componente como el `DrawerTopBar` del navbar (cromo movido arriba). Mismo
 *  criterio de modos que `serverDrawerTabsFor`: dentro de un módulo solo se
 *  pintan sus tabs (Terminal / Chat + Ajustes); en la vista servers, los
 *  permanentes. "Snippets" se rotula "Terminal"; "settings" = ajustes del
 *  asistente (antes el engranaje dentro de Chat). */
export function serverDrawerTabItems(
  guestMode: boolean,
  t: ReturnType<typeof getMessages>,
  chatStarted: boolean,
  terminalOpen = false,
): { key: ServerDrawerTab; label: string; accent?: boolean }[] {
  if (guestMode) return [{ key: "server", label: t.titleBar.fabServer }];
  const modules: { key: ServerDrawerTab; label: string; accent?: boolean }[] = [];
  if (terminalOpen) modules.push({ key: "snippets", label: "Terminal", accent: true });
  if (chatStarted) {
    modules.push({ key: "chat", label: t.dataTableSettings.tabs.chat, accent: true });
    modules.push({ key: "settings", label: t.assistantSettings.settingsButton, accent: true });
  }
  if (modules.length > 0) return modules;
  return [
    { key: "server", label: t.titleBar.fabServer },
    { key: "ssh_keys", label: "SSH" },
    { key: "categories", label: t.dataTableSettings.tabs.categories },
  ];
}

/** Datos/handlers que `SettingsPanels` necesita para los tabs SSH/Categorías. */
type SettingsData = {
  taxonomy: PanelTaxonomy["categories"];
  sshKeys: SshKeySummary[];
  refreshTaxonomy: () => Promise<void>;
  refreshSshKeys: () => Promise<void>;
  applyCategoryCreated: (category: { id: string; name: string }) => void;
  applyCategoryRenamed: (id: string, name: string) => void;
  applyCategoryDeleted: (id: string) => void;
  applyTagCreated: (categoryId: string, tag: { id: string; name: string }) => void;
  applyTagRenamed: (id: string, name: string) => void;
  applyTagDeleted: (id: string) => void;
  applySshKeyCreated: (key: SshKeySummary) => void;
  applySshKeyUpdated: (key: SshKeySummary) => void;
  applySshKeyDeleted: (id: string) => void;
};

export type ServerDrawerProps = SettingsData & {
  /** Panel del slide visible del carousel (o null si no hay ninguno). */
  panel: PanelRow | null;
  /** Métricas en vivo del panel visible. */
  metrics: ServerMetricsState | undefined;
  /** Los paneles todavía se están cargando y aún no hay ninguno: muestra el
   *  skeleton del tab activo en vez de un estado vacío/intermedio. */
  loading?: boolean;
  language?: string;
  token: string;
  guestMode?: boolean;
  /** Tab activo (controlado por `MainScreen` para el swipe infinito entre tabs). */
  tab: ServerDrawerTab;
  onTabChange: (tab: ServerDrawerTab) => void;
  onClose: () => void;
  /** Abre la pantalla `Chat` del panel (fase A5): tras abrir/crear un hilo o
   *  lanzar un agente desde el drawer, el chat debe quedar a la vista. */
  onOpenChat?: (panelId: string) => void;
  /** El cromo (cabecera + tabs) vive en el `DrawerTopBar` del navbar: oculta el
   *  header/tabs internos y deja solo el cuerpo del tab activo. */
  chromeInNavbar?: boolean;
  // ── Edición inline del panel visible (tab "Server") ──
  panelEditor: PanelEditorState;
  sshKeyOptions: SshKeyOption[];
  setPanelEditor: React.Dispatch<React.SetStateAction<PanelEditorState>>;
  closePanelEditor: () => void;
  submitPanelEditor: () => void;
  requestDeletePanel: () => void;
  /** Favorito del panel visible (estado compartido con el carousel). */
  isFavorite: boolean;
  onToggleFavorite: () => void;
  /** Entra al panel SSH real ("Utilizar más herramientas"); lo resuelve MainScreen. */
  onEnterPanel: () => void;
  /** El chat del panel visible está iniciado (conversación activa): controla si el
   *  tab "Chat" es visible en el drawer. */
  chatStarted: boolean;
  /** Sub-tab inicial del tab SSH al montar ("register" para abrir directo en el
   *  formulario de registro de llave; por defecto "list"). */
  initialSshTab?: "list" | "register";
  /** El terminal del panel está abierto (vista SSH): habilita el tab "Snippets"
   *  (primero) — NO se muestra en el carousel/dashboard. */
  terminalOpen?: boolean;
  /** Inyecta JS en el WebView del terminal (para ejecutar snippets). Lo resuelve
   *  `MainScreen` con el injector registrado por `SshScreen`. */
  injectIntoTerminal?: (js: string) => void;
  // ── Gestión de consolas (sub-tab "Consolas" del tab "Terminal") ──
  /** Consolas (terminales nativos) abiertas; `undefined` fuera del overlay de
   *  consola. Cada una es una conexión/WebView independiente y viva. */
  consoles?: { id: string; panelId: string; panelName: string; label?: string; autoLabel?: string }[];
  /** Consola activa (visible). */
  activeConsoleId?: string | null;
  /** Cambia la consola activa (la muestra). */
  onSelectConsole?: (id: string) => void;
  /** Cierra (termina) una consola. */
  onCloseConsole?: (id: string) => void;
  /** Renombra una consola (nombre custom; vacío vuelve al auto-rótulo). */
  onRenameConsole?: (id: string, label: string) => void;
  /** Abre una consola nueva para el panel del drawer. */
  onNewConsole?: () => void;
  /** Pull-to-refresh del tab "Server": recarga paneles/estado + taxonomía + llaves
   *  (lo resuelve `MainScreen`). Los tabs SSH/Categorías/Chat se refrescan solos. */
  onRefresh?: () => Promise<void> | void;
};

function severityColor(severity: MetricSeverity, tokens: ThemeTokens): string {
  switch (severity) {
    case "high": return tokens.danger;
    case "mid": return tokens.warning;
    case "low": return tokens.success;
    case "neutral": return tokens.textSecondary;
    default: return tokens.textMuted;
  }
}

/**
 * Contenido del drawer izquierdo (Server | SSH | Categorías). El shell animado
 * (backdrop + slide + gesto de cierre) lo aporta `MainScreen`; aquí solo va el
 * encabezado, el strip de tabs y el cuerpo del tab activo. El tab "Server" muestra
 * la info del servidor visible que antes vivía en la barra de la window card.
 */
export default function ServerDrawer({
  panel,
  metrics,
  loading = false,
  language,
  token,
  guestMode = false,
  tab: tabProp,
  onTabChange,
  onClose,
  onOpenChat,
  chromeInNavbar = false,
  taxonomy,
  sshKeys,
  refreshTaxonomy,
  refreshSshKeys,
  applyCategoryCreated,
  applyCategoryRenamed,
  applyCategoryDeleted,
  applyTagCreated,
  applyTagRenamed,
  applyTagDeleted,
  applySshKeyCreated,
  applySshKeyUpdated,
  applySshKeyDeleted,
  panelEditor,
  sshKeyOptions,
  setPanelEditor,
  closePanelEditor,
  submitPanelEditor,
  requestDeletePanel,
  isFavorite,
  onToggleFavorite,
  onEnterPanel,
  chatStarted,
  initialSshTab,
  terminalOpen = false,
  injectIntoTerminal,
  consoles,
  activeConsoleId,
  onSelectConsole,
  onCloseConsole,
  onRenameConsole,
  onNewConsole,
  onRefresh,
}: ServerDrawerProps) {
  const t = getMessages(language);
  const tp = t.panelTable;
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const rowDirection = getLocaleRowDirection(language);
  const textAlign = getLocaleTextAlign(language);

  // Tab efectivo: coerce al PRIMER tab válido del modo actual si el controlado no
  // aplica (p. ej. invitado con un tab SSH heredado, o un tab de servers al entrar
  // a un módulo donde esos tabs ya no existen). No fijar "server": en modo módulo
  // no está en la lista y dejaría el cuerpo en blanco.
  const tabItems = serverDrawerTabItems(guestMode, t, chatStarted, terminalOpen);
  const tab: ServerDrawerTab = tabItems.some((i) => i.key === tabProp) ? tabProp : tabItems[0].key;
  const title = tab === "snippets"
    ? "Terminal"
    : tab === "chat"
      ? t.dataTableSettings.tabs.chat
      : tab === "ssh_keys"
        ? "SSH"
        : tab === "categories"
          ? t.dataTableSettings.tabs.categories
          : t.titleBar.fabServer;

  const settingsData: SettingsData = {
    taxonomy, sshKeys, refreshTaxonomy, refreshSshKeys,
    applyCategoryCreated, applyCategoryRenamed, applyCategoryDeleted,
    applyTagCreated, applyTagRenamed, applyTagDeleted,
    applySshKeyCreated, applySshKeyUpdated, applySshKeyDeleted,
  };

  // El ping (test-connection SSH) SOLO corre para paneles propios; en invitado/compartido
  // queda "unknown" → el badge se atascaba en "Verificando…" para siempre. Si el ping no
  // resolvió, derivar el estado de las MÉTRICAS (que sí cargan vía el gateway): métricas OK
  // + liveStatus ok → Activo; métricas en error o liveStatus no-ok → Sin respuesta; mientras
  // cargan → Verificando.
  const pingStatus = panel?.serverStatus ?? "unknown";
  const status: ServerPingStatus =
    pingStatus === "active" || pingStatus === "inactive"
      ? pingStatus
      : metrics?.status === "ok"
        ? (metrics.metrics.liveStatus === "ok" ? "active" : "inactive")
        : metrics?.status === "error"
          ? "inactive"
          : pingStatus;
  const statusColor = status === "active" ? tokens.success : status === "inactive" ? tokens.danger : tokens.warning;
  const statusLabel = status === "active"
    ? tp.statusActive
    : status === "inactive"
      ? tp.statusNoResponse
      : tp.statusChecking;
  // ¿El usuario es el CREADOR del panel? Solo el creador puede editar/eliminar; a
  // quien se le compartió, el tab Servidor es de SOLO LECTURA (IP enmascarada).
  const isOwner = (panel?.source.ownership ?? "owner") === "owner";
  // Editando inline el panel visible (no invitado, ES dueño y `panelEditor` ABIERTO
  // apuntando a él). Se chequea `.open` DE FORMA CONSISTENTE con el guard de siembra
  // (`useLayoutEffect` en MainScreen, que también exige `panelEditor.open`): así al
  // cerrar el editor no se queda "editando" un panel con el drawer cerrado ni el
  // skeleton/edición quedan desincronizados de si hay o no una siembra viva.
  const editing = isOwner && !guestMode && !!panel
    && panelEditor.open && panelEditor.mode === "edit" && panelEditor.panelId === panel.source.id;
  // Sembrando: el dueño abrió el tab Server pero su editor inline todavía no apunta
  // a este panel. Mostramos skeleton en vez de la versión de solo lectura para que
  // NO se vea el parpadeo de la "versión antigua" mientras se siembra el editor.
  const seeding = isOwner && !guestMode && !!panel && !editing;

  // Helpers de la edición inline (tarjetas como inputs), enlazados a `panelEditor`.
  const hasSharedKeys = sshKeyOptions.length > 0;
  const categoryOptions = [
    { value: "", label: t.panelEditor.categoryEmpty },
    ...taxonomy.map((c) => ({ value: c.name, label: c.name })),
  ];
  const availableTags = taxonomy.find((c) => c.name === panelEditor.category)?.tags ?? [];
  const selectedTags = new Set(panelEditor.tags);
  const selectedKeys = new Set(panelEditor.sshKeyIds);
  const clearInvalid = () => setPanelEditor((c) => (c.invalidField === null ? c : { ...c, invalidField: null }));
  const toggleTag = (name: string) => setPanelEditor((c) => {
    const s = new Set(c.tags);
    if (s.has(name)) s.delete(name); else s.add(name);
    return { ...c, tags: Array.from(s) };
  });
  const toggleKey = (id: string) => setPanelEditor((c) => {
    const s = new Set(c.sshKeyIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    return { ...c, sshKeyIds: Array.from(s) };
  });
  const setField = (patch: Partial<PanelEditorState>) => setPanelEditor((c) => ({ ...c, ...patch }));

  // ── Probar conexión SSH REAL (usuario + llave) con los valores EN VIVO del
  // editor, SIN guardar. El guardado de los cambios es automático al cerrar el
  // drawer. El backend abre una conexión SSH y valida el usuario que funciona.
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const connCopy = (language ?? "es").startsWith("en")
    ? { okUser: (u: string) => `Connected as ${u} ✓`, okNoUser: "Connection successful ✓", fail: "Couldn't connect. Check the IP, port, key and SSH user.", ipReq: "Enter the server IP first." }
    : { okUser: (u: string) => `Conectado como ${u} ✓`, okNoUser: "Conexión exitosa ✓", fail: "No se pudo conectar. Revisa IP, puerto, llave y usuario SSH.", ipReq: "Ingresa primero la IP del servidor." };
  const runConnectionTest = async () => {
    if (testing) return;
    const ip = panelEditor.ip.trim();
    if (!ip) { setTestResult({ ok: false, msg: connCopy.ipReq }); return; }
    const parsedPort = Number.parseInt(panelEditor.port.trim(), 10);
    const hasPrivateKey = panelEditor.sshPrivateKey.trim().length > 0;
    setTesting(true);
    setTestResult(null);
    const res = await testServerSshConnection({
      panelId: panelEditor.panelId ?? undefined,
      ip,
      port: Number.isInteger(parsedPort) ? parsedPort : 22,
      sshUsername: panelEditor.sshUsername.trim() || undefined,
      sshKey: hasPrivateKey ? panelEditor.sshPrivateKey : undefined,
      passphrase: hasPrivateKey ? panelEditor.sshPassphrase : undefined,
      sshKeyId: !hasPrivateKey ? (panelEditor.sshKeyIds.find(Boolean) || undefined) : undefined,
    }, token);
    setTesting(false);
    setTestResult(res.connected
      ? { ok: true, msg: res.username ? connCopy.okUser(res.username) : connCopy.okNoUser }
      : { ok: false, msg: res.error || connCopy.fail });
  };

  // La configuración de notificaciones push por servidor se migró a un módulo de
  // LUXIPANEL y ya no se gestiona desde la app. El drawer central de
  // Notificaciones (botón de campana del top-bar) solo muestra el registro.

  // Tarjeta editable. SE INVOCA COMO FUNCIÓN (`{editCard({...})}`), NO como
  // `<editCard/>`: así el árbol devuelto (View/TextInput nativos) se reconcilia por
  // posición y el TextInput conserva el foco entre renders (definir un componente
  // inline lo remontaría en cada tecla).
  const editCard = (opts: {
    key: string; icon: React.ReactNode; label: string; value: string;
    onChangeText: (v: string) => void;
    placeholder?: string; multiline?: boolean; keyboardType?: "default" | "numeric"; secureTextEntry?: boolean; invalid?: boolean;
  }) => (
    <View key={opts.key} style={[styles.infoCard, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
      <View style={[styles.infoHead, { flexDirection: rowDirection }]}>
        {opts.icon}
        <Text style={[styles.infoLabel, { color: tokens.textMuted, textAlign }]}>{opts.label}</Text>
      </View>
      <TextInput
        value={opts.value}
        onChangeText={opts.onChangeText}
        placeholder={opts.placeholder}
        placeholderTextColor={tokens.textMuted}
        multiline={opts.multiline}
        keyboardType={opts.keyboardType}
        secureTextEntry={opts.secureTextEntry}
        autoCapitalize="none"
        style={[
          styles.editInput,
          opts.multiline ? styles.editTextarea : null,
          { borderColor: opts.invalid ? tokens.danger : tokens.border, backgroundColor: tokens.bgSecondary, color: tokens.textPrimary, textAlign },
        ]}
      />
    </View>
  );

  const InfoCard = ({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) => (
    <View style={[styles.infoCard, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
      <View style={[styles.infoHead, { flexDirection: rowDirection }]}>
        {icon}
        <Text style={[styles.infoLabel, { color: tokens.textMuted, textAlign }]}>{label}</Text>
      </View>
      {children}
    </View>
  );

  const MetricRow = ({ kind, icon, label }: { kind: MetricKind; icon: React.ReactNode; label: string }) => {
    const d = computeMetricDisplay(kind, metrics, tp);
    const barColor = severityColor(d.severity, tokens);
    return (
      <View style={[styles.metricRow, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
        <View style={[styles.metricTopRow, { flexDirection: rowDirection }]}>
          {icon}
          <Text style={[styles.infoLabel, { color: tokens.textMuted, flex: 1, textAlign }]}>{label}</Text>
          <Text style={[styles.metricValue, { color: tokens.textPrimary }]} numberOfLines={1}>{d.value}</Text>
        </View>
        <View style={[styles.metricBottomRow, { flexDirection: rowDirection }]}>
          <Text style={[styles.metricSub, { color: tokens.textMuted, textAlign }]} numberOfLines={1}>{d.secondary}</Text>
          <View style={[styles.barTrack, { backgroundColor: tokens.border }]}>
            {d.barWidth ? <View style={[styles.barFill, { width: d.barWidth as `${number}%`, backgroundColor: barColor }]} /> : null}
          </View>
        </View>
      </View>
    );
  };

  // El nombre del servidor es el TÍTULO del drawer (DrawerTopBar), así que ya no
  // se repite como cabecera dentro del cuerpo (se quitó la fila estrella + nombre
  // + punto de estado). El estado sigue visible en la tarjeta "Estado".

  // Tira compacta de métricas en vivo (solo lectura) para el modo edición.
  const MetricMini = ({ kind, icon }: { kind: MetricKind; icon: React.ReactNode }) => {
    const d = computeMetricDisplay(kind, metrics, tp);
    return (
      <View style={[styles.miniStat, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
        {icon}
        <Text style={[styles.miniStatValue, { color: tokens.textPrimary }]} numberOfLines={1}>{d.value}</Text>
      </View>
    );
  };

  // Pull-to-refresh del tab "Server": recarga paneles/estado + taxonomía + llaves.
  const serverRefresh = usePullRefresh(useCallback(async () => {
    await onRefresh?.();
  }, [onRefresh]));

  const serverContent = (loading || serverRefresh.refreshing) ? (
    // Carga inicial o pull-to-refresh en vuelo: skeleton mientras vuelven los
    // datos del servidor (paneles/métricas/estado).
    <ServerTabSkeleton />
  ) : !panel ? (
    <View style={styles.emptyState}>
      <Server size={30} color={tokens.textMuted} />
      <Text style={[styles.emptyText, { color: tokens.textMuted, textAlign }]}>{t.dashboard.totalServers}: 0</Text>
    </View>
  ) : seeding ? (
    <ServerTabSkeleton />
  ) : editing ? (
    // Edición inline: cada dato es una tarjeta-input; multi-valor = selector/chips.
    // El botón "Probar conexión" va FIJO abajo (fuera del scroll), como el botón
    // de registro de los tabs SSH/Categorías.
    <View style={styles.editWrap}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollBody}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={serverRefresh.refreshing} onRefresh={serverRefresh.onRefresh} tintColor={tokens.brand} colors={[tokens.brand]} />}
    >
      {/* Métricas en vivo (solo lectura). */}
      <View style={[styles.miniRow, { flexDirection: rowDirection }]}>
        <MetricMini kind="cpu" icon={<Cpu size={12} color={tokens.textMuted} />} />
        <MetricMini kind="ram" icon={<MemoryStick size={12} color={tokens.textMuted} />} />
        <MetricMini kind="disk" icon={<HardDrive size={12} color={tokens.textMuted} />} />
        <MetricMini kind="traffic" icon={<ArrowDownUp size={12} color={tokens.textMuted} />} />
      </View>

      {/* "Utilizar más herramientas" — movido arriba (sobre Estado), fila propia. */}
      <Button
        variant="secondary"
        label={tp.actions.useMoreTools}
        icon={<PencilRuler size={15} />}
        onPress={onEnterPanel}
        style={styles.enterPanelTop}
      />

      {/* Estado + Proveedor en 1 fila. */}
      <View style={[styles.pairRow, { flexDirection: rowDirection }]}>
        <View style={styles.pairCol}>
          <InfoCard icon={<Server size={12} color={statusColor} />} label={tp.columns.license}>
            <Text numberOfLines={1} style={[styles.infoValue, { color: statusColor, textAlign }]}>{statusLabel}</Text>
          </InfoCard>
        </View>
        {panel.providerLabel ? (
          <View style={styles.pairCol}>
            <InfoCard icon={<Server size={12} color={tokens.textMuted} />} label={tp.providerLabel}>
              <Text numberOfLines={1} style={[styles.infoValue, { color: tokens.textSecondary, textAlign }]}>{panel.providerLabel}</Text>
            </InfoCard>
          </View>
        ) : null}
      </View>

      {/* URL de acceso a LUXIPANEL (customDomain, URL completa) + IP+puerto en 1 fila. */}
      <View style={[styles.pairRow, { flexDirection: rowDirection }]}>
        <View style={styles.pairCol}>
          {editCard({
            key: "accessUrl",
            icon: <Server size={12} color={tokens.textMuted} />,
            label: t.panelEditor.accessUrlLabel,
            value: panelEditor.accessUrl,
            invalid: panelEditor.invalidField === "accessUrl",
            placeholder: t.panelEditor.accessUrlPlaceholder,
            onChangeText: (v) => { clearInvalid(); setField({ accessUrl: v }); },
          })}
        </View>
        <View style={styles.pairCol}>
          {/* IP + Puerto (markup inline, no componente: conserva el foco al teclear). */}
          <View style={[styles.infoCard, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
            <View style={[styles.infoHead, { flexDirection: rowDirection }]}>
              <Globe size={12} color={tokens.textMuted} />
              <Text style={[styles.infoLabel, { color: tokens.textMuted, textAlign }]}>{tp.columns.ip}</Text>
            </View>
            <View style={[styles.ipPortRow, { flexDirection: rowDirection }]}>
              <TextInput
                value={panelEditor.ip}
                onChangeText={(v) => { clearInvalid(); setField({ ip: sanitizeIp(v) }); }}
                placeholder={t.panelEditor.ipPlaceholder}
                placeholderTextColor={tokens.textMuted}
                keyboardType="numeric"
                style={[styles.editInput, { flex: 1, minWidth: 0, borderColor: panelEditor.invalidField === "ip" ? tokens.danger : tokens.border, backgroundColor: tokens.bgSecondary, color: tokens.textPrimary, textAlign }]}
              />
              <TextInput
                value={panelEditor.port}
                onChangeText={(v) => setField({ port: sanitizePort(v) })}
                placeholder="22"
                placeholderTextColor={tokens.textMuted}
                keyboardType="numeric"
                style={[styles.editInput, styles.portInputNarrow, { borderColor: tokens.border, backgroundColor: tokens.bgSecondary, color: tokens.textPrimary, textAlign: "center" }]}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Categoría (selector). */}
      <InfoCard icon={<Tag size={12} color={tokens.textMuted} />} label={tp.columns.category}>
        <Select
          value={panelEditor.category}
          options={categoryOptions}
          onChange={(next) => {
            const allowed = new Set((taxonomy.find((c) => c.name === next)?.tags ?? []).map((tg) => tg.name));
            setPanelEditor((c) => ({ ...c, category: next, tags: c.tags.filter((n) => allowed.has(n)) }));
          }}
        />
      </InfoCard>

      {/* Tags (chips selectores de la categoría). */}
      {availableTags.length > 0 ? (
        <InfoCard icon={<Tag size={12} color={tokens.textMuted} />} label={t.panelEditor.tagsLabel}>
          <View style={[styles.tagsWrap, { flexDirection: rowDirection }]}>
            {availableTags.map((tag) => (
              <Chip key={tag.id} label={tag.name} selected={selectedTags.has(tag.name)} onPress={() => toggleTag(tag.name)} />
            ))}
          </View>
        </InfoCard>
      ) : null}

      {/* SSH: selección de llaves compartidas o registro de la primera llave. */}
      {hasSharedKeys ? (
        <InfoCard icon={<KeyRound size={12} color={tokens.textMuted} />} label={"SSH"}>
          <View style={{ gap: 6 }}>
            {sshKeyOptions.map((key) => {
              const active = selectedKeys.has(key.id);
              return (
                <Pressable
                  key={key.id}
                  onPress={() => toggleKey(key.id)}
                  style={[styles.sshKeyRow, { borderColor: tokens.border, backgroundColor: active ? tokens.brandDim : tokens.bgSecondary, flexDirection: rowDirection }]}
                >
                  <View style={[styles.checkbox, { borderColor: tokens.border, backgroundColor: active ? tokens.brand : "transparent" }]}>
                    {active ? <Check size={12} color="#fff" /> : null}
                  </View>
                  <Text numberOfLines={1} style={{ flex: 1, color: tokens.textPrimary, fontSize: 13, fontWeight: "700" }}>
                    {key.linuxUsername || t.panelEditor.noSshUser}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </InfoCard>
      ) : (
        <>
          {editCard({
            key: "sshUser",
            icon: <KeyRound size={12} color={tokens.textMuted} />,
            label: t.panelEditor.sshUserLabel,
            value: panelEditor.sshUsername,
            invalid: panelEditor.invalidField === "sshUsername",
            placeholder: t.panelEditor.sshUserPlaceholder,
            onChangeText: (v) => { clearInvalid(); setField({ sshUsername: v }); },
          })}
          {editCard({
            key: "sshKey",
            icon: <KeyRound size={12} color={tokens.textMuted} />,
            label: t.panelEditor.firstKeyLabel,
            value: panelEditor.sshPrivateKey,
            invalid: panelEditor.invalidField === "sshPrivateKey",
            placeholder: t.panelEditor.firstKeyPlaceholder,
            multiline: true,
            onChangeText: (v) => { clearInvalid(); setField({ sshPrivateKey: v }); },
          })}
          {editCard({
            key: "sshPass",
            icon: <KeyRound size={12} color={tokens.textMuted} />,
            label: t.panelEditor.passphraseLabel,
            value: panelEditor.sshPassphrase,
            invalid: panelEditor.invalidField === "sshPassphrase",
            placeholder: t.panelEditor.passphrasePlaceholder,
            secureTextEntry: true,
            onChangeText: (v) => { clearInvalid(); setField({ sshPassphrase: v }); },
          })}
        </>
      )}

      {/* Las notificaciones del servidor se configuran ahora en el drawer central
          de Notificaciones (botón de campana del top-bar). */}

      {panelEditor.error ? (
        <View style={[styles.errorBox, { borderColor: tokens.danger, backgroundColor: tokens.bgSecondary }]}>
          <Text style={{ color: tokens.danger, fontSize: 13 }}>{panelEditor.error}</Text>
        </View>
      ) : null}

      {/* Código de acceso y gestión de acceso se movieron a la PORTADA del servidor
          (botones junto a "usuarios conectados"), igual que en web. */}
    </ScrollView>

    {/* Probar conexión SSH REAL (usuario + llave) + Eliminar — barra FIJA en la
        parte inferior del tab (mismo patrón que el registro en SSH/Categorías).
        Los cambios del editor se autoguardan al cerrar el drawer; solo testea. */}
    <View style={[styles.testBar, { borderTopColor: tokens.border }]}>
      <View style={[styles.saveRow, { flexDirection: rowDirection }]}>
        <IconButton
          variant="danger"
          size={42}
          onPress={requestDeletePanel}
          disabled={testing}
          accessibilityLabel={tp.actions.delete}
          icon={<Trash2 size={16} />}
        />
        <Button
          variant="primary"
          label={testing ? t.panelEditor.testingConnection : t.panelEditor.testConnection}
          icon={<Unplug size={15} color="#fff" />}
          onPress={() => void runConnectionTest()}
          loading={testing}
          disabled={testing}
          style={styles.saveBtn}
        />
      </View>
      {testResult ? (
        <Text style={[styles.testResult, { color: testResult.ok ? tokens.success : tokens.danger, textAlign }]}>
          {testResult.msg}
        </Text>
      ) : null}
    </View>
    </View>
  ) : (
    // Solo lectura: invitado o aún sin sembrar la edición.
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollBody}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={serverRefresh.refreshing} onRefresh={serverRefresh.onRefresh} tintColor={tokens.brand} colors={[tokens.brand]} />}
    >
      <InfoCard icon={<Tag size={12} color={tokens.textMuted} />} label={tp.columns.category}>
        <Text numberOfLines={1} style={[styles.infoValue, { color: tokens.textSecondary, textAlign }]}>
          {panel.categoryLabel || tp.fallbacks.noCategory}
        </Text>
      </InfoCard>
      <InfoCard icon={<Server size={12} color={statusColor} />} label={tp.columns.license}>
        <Text numberOfLines={1} style={[styles.infoValue, { color: statusColor, textAlign }]}>{statusLabel}</Text>
      </InfoCard>
      {!guestMode && panel.providerLabel ? (
        <InfoCard icon={<Server size={12} color={tokens.textMuted} />} label={tp.providerLabel}>
          <Text numberOfLines={1} style={[styles.infoValue, { color: tokens.textSecondary, textAlign }]}>{panel.providerLabel}</Text>
        </InfoCard>
      ) : null}
      {/* IP SIEMPRE enmascarada en solo lectura (paneles compartidos / invitado). */}
      {panel.serverIpMasked ? (
        <InfoCard icon={<Globe size={12} color={tokens.textMuted} />} label={tp.columns.ip}>
          <Text numberOfLines={1} style={[styles.infoValueMono, { color: tokens.textSecondary, textAlign }]}>{panel.serverIpMasked}</Text>
        </InfoCard>
      ) : null}
      <MetricRow kind="cpu" icon={<Cpu size={13} color={tokens.textMuted} />} label={tp.metrics.cpu} />
      <MetricRow kind="ram" icon={<MemoryStick size={13} color={tokens.textMuted} />} label={tp.metrics.ram} />
      <MetricRow kind="disk" icon={<HardDrive size={13} color={tokens.textMuted} />} label={tp.metrics.disk} />
      <MetricRow kind="traffic" icon={<ArrowDownUp size={13} color={tokens.textMuted} />} label={tp.metrics.traffic} />
      {!guestMode && panel.tags.length > 0 ? (
        <InfoCard icon={<Tag size={12} color={tokens.textMuted} />} label={t.panelEditor.tagsLabel}>
          <View style={[styles.tagsWrap, { flexDirection: rowDirection }]}>
            {panel.tags.map((tag, idx) => (
              <View key={`${tag}-${idx}`} style={[styles.tagChip, { backgroundColor: tokens.bgSecondary, borderColor: tokens.border }]}>
                <Text style={[styles.tagText, { color: tokens.textSecondary }]}>{tag}</Text>
              </View>
            ))}
          </View>
        </InfoCard>
      ) : null}
    </ScrollView>
  );

  return (
    <View style={styles.root}>
      {/* Solo los tabs: sin título ni botón de cerrar. El drawer se cierra tocando
          el backdrop, con swipe o con el botón atrás. */}
      {!chromeInNavbar && tabItems.length > 1 ? (
        <SegmentedControl
          items={tabItems}
          value={tab}
          onChange={(k) => onTabChange(k as ServerDrawerTab)}
          scroll
          style={[styles.tabs, { borderBottomColor: tokens.border }]}
        />
      ) : null}

      <View style={styles.body}>
        {tab === "snippets" ? (
          loading ? (
            <ListPanelSkeleton rows={6} />
          ) : panel ? (
            <ServerSnippetsTab
              panelId={panel.id}
              token={token}
              language={language}
              injectIntoTerminal={injectIntoTerminal ?? (() => {})}
              onAfterRun={onClose}
              consoles={consoles}
              activeConsoleId={activeConsoleId}
              onSelectConsole={onSelectConsole}
              onCloseConsole={onCloseConsole}
              onRenameConsole={onRenameConsole}
              onNewConsole={onNewConsole}
            />
          ) : (
            <View style={styles.emptyState}>
              <Server size={30} color={tokens.textMuted} />
              <Text style={[styles.emptyText, { color: tokens.textMuted, textAlign }]}>{t.dashboard.totalServers}: 0</Text>
            </View>
          )
        ) : null}
        {tab === "chat" ? (
          loading ? (
            <ChatTabSkeleton />
          ) : panel ? (
            <ServerChatTab panelId={panel.id} token={token} language={language} onAfterNew={() => { onClose(); onOpenChat?.(panel.id); }} />
          ) : (
            <View style={styles.emptyState}>
              <Server size={30} color={tokens.textMuted} />
              <Text style={[styles.emptyText, { color: tokens.textMuted, textAlign }]}>{t.dashboard.totalServers}: 0</Text>
            </View>
          )
        ) : null}
        {tab === "settings" ? (
          loading ? (
            <ChatTabSkeleton />
          ) : panel ? (
            <AssistantSettingsTab
              panelId={panel.id}
              token={token}
              language={language ?? "es"}
              onCloseDrawer={onClose}
              onOpenChat={onOpenChat}
            />
          ) : (
            <View style={styles.emptyState}>
              <Server size={30} color={tokens.textMuted} />
              <Text style={[styles.emptyText, { color: tokens.textMuted, textAlign }]}>{t.dashboard.totalServers}: 0</Text>
            </View>
          )
        ) : null}
        {tab === "server" ? serverContent : null}
        {tab === "ssh_keys" || tab === "categories" ? (
          loading ? (
            <ListPanelSkeleton rows={6} />
          ) : (
            <SettingsPanels
              visible
              tab={tab as SettingsTab}
              onTabChange={() => {}}
              hideTabs
              presentation="drawer"
              language={language ?? "es"}
              token={token}
              initialSshTab={initialSshTab}
              {...settingsData}
            />
          )
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: "800" },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 1 },
  body: { flex: 1 },
  scroll: { flex: 1 },
  scrollBody: { padding: 12, gap: 9 },
  nameRow: { alignItems: "center", gap: 8, marginBottom: 2 },
  favBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  serverName: { flex: 1, fontSize: 17, fontWeight: "800" },
  // Cabecera del modo edición (sobre el formulario).
  editHead: { paddingHorizontal: 12, paddingTop: 10, gap: 8 },
  miniRow: { gap: 6 },
  miniStat: { flex: 1, flexBasis: 0, minWidth: 0, borderWidth: 1, borderRadius: 10, paddingVertical: 7, alignItems: "center", justifyContent: "center", gap: 2 },
  miniStatValue: { fontSize: 12, fontWeight: "800" },
  accessRow: { gap: 8 },
  accessBtn: { flex: 1 },
  infoCard: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 4 },
  infoHead: { alignItems: "center", gap: 5 },
  infoLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  infoValue: { fontSize: 14, fontWeight: "700" },
  infoValueMono: { flex: 1, fontSize: 14, fontWeight: "700", fontFamily: "monospace" },
  ipRow: { alignItems: "center", gap: 8 },
  ipToggle: { width: 28, height: 28, borderRadius: 7, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  metricRow: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 6 },
  metricTopRow: { alignItems: "center", gap: 6 },
  metricValue: { fontSize: 14, fontWeight: "800" },
  metricBottomRow: { alignItems: "center", gap: 8 },
  metricSub: { flex: 1, fontSize: 11 },
  barTrack: { width: 90, height: 5, borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },
  tagsWrap: { flexWrap: "wrap", gap: 6, marginTop: 2 },
  tagChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 12, fontWeight: "600" },
  // Edición inline (tarjetas-input).
  editInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, minHeight: 38 },
  editTextarea: { minHeight: 72, textAlignVertical: "top" },
  ipPortRow: { gap: 6, alignItems: "center" },
  portInput: { width: 70 },
  portInputNarrow: { width: 50 },
  // Pares de tarjetas en 1 fila (Estado+Proveedor / Nombre+IP).
  pairRow: { gap: 9, alignItems: "stretch" },
  pairCol: { flex: 1, minWidth: 0 },
  enterPanelTop: { marginBottom: 2 },
  // Tarjeta de notificaciones.
  notifHint: { fontSize: 11.5, lineHeight: 16, marginBottom: 2 },
  notifGroup: { gap: 6, marginTop: 4 },
  notifRow: { alignItems: "center", justifyContent: "space-between", gap: 10 },
  notifLabel: { flex: 1, fontSize: 13 },
  stepper: { alignItems: "center", gap: 8 },
  stepBtn: { width: 28, height: 28, borderRadius: 7, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stepValue: { minWidth: 30, fontSize: 14, fontWeight: "800", textAlign: "center" },
  sshKeyRow: { alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  // Fila compacta de login (icono + etiqueta corta + switch) sin texto de ayuda.
  errorBox: { borderWidth: 1, borderRadius: 8, padding: 10 },
  // Modo edición: scroll + barra fija inferior con "Probar conexión".
  editWrap: { flex: 1 },
  testBar: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, borderTopWidth: 1 },
  saveRow: { alignItems: "center", gap: 8, marginTop: 2 },
  saveBtn: { flex: 1 },
  testResult: { fontSize: 12.5, fontWeight: "600", marginTop: 6, paddingHorizontal: 4, lineHeight: 17 },
  enterPanelBtn: { marginTop: 8 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  emptyText: { fontSize: 13 },
});
