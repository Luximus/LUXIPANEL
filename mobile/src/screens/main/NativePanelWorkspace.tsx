import { localizeServerError } from '../../lib/server-error-localization';
import { nativeText } from '../../i18n/native-text';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelText as Text } from "../../components/ui/PanelText";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native";
import { PanGestureHandler, State, type PanGestureHandlerStateChangeEvent } from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Bell,
  Terminal,
  Image as ImageIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderPlus,
  History,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Server,
  Settings,
  Sun,
  Moon,
  X,
} from "lucide-react-native";
import { callServerApi, unwrap } from "../../api/serverApi";
import { userRequest } from "../../api/serverUserApi";
import { luxAssistantProxy } from "../../api/client";
import {
  connectWorkspaceContext,
  disposeWorkspaceContext,
  retainWorkspaceContext,
  returnWorkspaceToLocal,
} from "../../api/workspaceContext";
import { ChatScreen } from "../ChatScreen";
import { chatController } from "../../features/assistant/chat-controller";
import { chatStore } from "../../features/assistant/chat-store";
import { projectLocation, rootProjectId } from "../../features/assistant/project-scope";
import type { Project } from "../../features/assistant/types";
import { useAssistantChat, useAssistantSession } from "../../features/assistant/hooks";
import { ConversationsDrawer } from "../../components/assistant/drawer/ConversationsDrawer";
import { ProjectsModal } from "../../components/account/ProjectsModal";
import { strings } from "../../components/assistant/strings";
import { ModuleSettingsDrawer } from "../../components/ui/ModuleSettingsDrawer";
import { AssistantSettingsTab } from "../../components/assistant-settings/AssistantSettingsTab";
import { TOOL_MODULES, LUX_MODULES, CORE_MODULES } from "../../features/app/luxipanel-modules";
import { getThemeTokens } from "../../theme/colors";
import { getMessages, isRtlLocale } from "../../i18n";
import { workspaceLabels, WORKSPACE_LOCALES } from "../../i18n/workspace";
import { ThemeTransitionScope } from "../../theme/ThemeTransitionProvider";
import { ThemeIconButton } from "../../components/ui/ThemeIconButton";
import type { ThemeOrigin } from "../../theme/theme-transition";
import { connectionMessages } from "../../i18n/connections";
import { useTheme } from "../../hooks/useTheme";
import { useTerminalKeyboard } from "../../hooks/useTerminalKeyboard";
import { fetchNativeModuleMenu, type NativeSidebarModule } from "../server/native-module-access";
import { WORKSPACE_MENU_TOOLS, workspaceMenuIds } from "./workspace-menu";
import { PersistentNativeModules } from "./PersistentNativeModules";
import { NativeModuleContext, dismissNativeModuleDialog, dismissNativeConfirmation } from "./native-module-context";
import { workspaceModuleViews } from "./workspace-module-views";
import { NativeOverlayHost } from "./NativeOverlayHost";
import { Avatar } from "../../components/ui/Avatar";
import { NativeConversationMedia } from "../../components/assistant/NativeConversationMedia";
import { PanelLogo } from "../../components/ui/PanelLogo";
import { WorkspaceServers, type WorkspaceTarget } from "./WorkspaceServers";
import type { PanelRow } from "../../features/app/viewModels";
import type { NativeModuleSession } from "./shell-types";
import { WorkspaceNotifications, WorkspaceSearch, type WorkspaceNotification, type WorkspaceSearchItem } from "./WorkspaceTopPanels";

type Props = {
  account: string;
  token: string;
  panels: PanelRow[];
  busy: boolean;
  language: string;
  active: boolean;
  focusPanelId?: string | null;
  onFocusHandled: () => void;
  onPanelChange: (id: string) => void;
  onManagePanels: () => void;
  onEditPanel?: (panel: PanelRow) => void;
  onDeletePanel?: (panel: PanelRow) => void;
  onAccount: () => void;
  onLogout: () => void;
  onSupport: () => void;
  onToggleTheme?: (origin?: ThemeOrigin) => void;
  onLanguageChange?: (language: string) => void;
};
type Connection = {
  panelId: string;
  targetId: string;
  id: string;
  name: string;
  revision?: number;
};
const modules = [...TOOL_MODULES, ...LUX_MODULES, ...CORE_MODULES];
const lightRail = {
  ...getThemeTokens(true),
  bgPrimary: "#151c2c",
  bgCardSolid: "#1e2939",
  bgInput: "#1e2939",
  textPrimary: "#f8fafc",
  textSecondary: "#cbd5e1",
  textMuted: "#94a3b8",
  border: "#334155",
};

/** The authenticated landing page is the persistent Chatbox, like /panel on mobile. */
export function NativePanelWorkspace(p: Props) {
  const colors = getThemeTokens(useTheme().theme === "dark");
  const es = p.language.startsWith("es");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<"history" | "modules" | "servers" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [targets, setTargets] = useState<WorkspaceTarget[]>([]);
  const [ready, setReady] = useState(false);
  const generation = useRef(0);
  const owned = useRef(new Set<string>());
  const owner = useRef(Symbol("workspace"));
  const mounted = useRef(true);
  const last = useRef<{ panelId: string; targetId: string } | null>(null);
  const storageKey = `luxipanel.workspace.${p.account}`;
  const connection = connections.find((c) => c.id === selected);
  const panel = p.panels.find((row) => row.id === connection?.panelId);
  const select = useCallback(
    async (panelId: string, targetId = "local", name?: string) => {
      const seq = ++generation.current;
      setBusy(true);
      setError("");
      const current = () => seq === generation.current;
      try {
        const id = await connectWorkspaceContext(p.account, panelId, p.token, targetId, current);
        if (!mounted.current) {
          disposeWorkspaceContext(id, owner.current);
          return;
        }
        retainWorkspaceContext(id, owner.current);
        owned.current.add(id);
        if (!current()) return;
        const row = p.panels.find((row) => row.id === panelId);
        const next = {
          panelId,
          targetId,
          id,
          revision: seq,
          name: name ?? row?.nameLabel ?? panelId,
        };
        setConnections((old) =>
          old.some((c) => c.id === id) ? old.map((c) => (c.id === id ? next : c)) : [...old, next],
        );
        setSelected(id);
        setDrawer(null);
        p.onPanelChange(panelId);
        await AsyncStorage.setItem(storageKey, JSON.stringify({ panelId, targetId }));
        if (!current()) return;
        const response = await callServerApi(panelId, p.token, "GET", "/api/servers");
        if (current()) {
          const rows = unwrap<WorkspaceTarget[]>(response) ?? [];
          setTargets(rows);
          const label = rows.find((row) => row.id === targetId && !row.isLocal)?.name;
          if (label)
            setConnections((old) =>
              old.map((row) => (row.id === id ? { ...row, name: label } : row)),
            );
        }
      } catch (cause) {
        if (current()) {
          setError(cause instanceof Error ? cause.message : String(cause));
          setDrawer("servers");
        }
      } finally {
        if (current()) setBusy(false);
      }
    },
    [p.account, p.token, p.panels, storageKey, p.onPanelChange],
  );
  const selectRef = useRef(select);
  selectRef.current = select;
  const returnLocal = async (panelId: string) => {
    setBusy(true);
    setError("");
    try {
      await returnWorkspaceToLocal(panelId, p.token);
      await select(panelId, "local");
    } catch (cause) {
      setBusy(false);
      setError(String(cause));
      setDrawer("servers");
    }
  };
  useEffect(() => {
    let current = true;
    void AsyncStorage.getItem(storageKey).then((raw) => {
      if (!current) return;
      try {
        last.current = raw ? JSON.parse(raw) : null;
      } catch {
        last.current = null;
      }
      setReady(true);
    });
    mounted.current = true;
    return () => {
      current = false;
      mounted.current = false;
      generation.current++;
      for (const id of owned.current) disposeWorkspaceContext(id, owner.current);
    };
  }, [storageKey]);
  const initialized = useRef(false);
  useEffect(() => {
    if (!ready || p.busy) return;
    if (p.focusPanelId && p.panels.some((row) => row.id === p.focusPanelId)) {
      initialized.current = true;
      void selectRef.current(p.focusPanelId);
      p.onFocusHandled();
      return;
    }
    if (initialized.current) return;
    initialized.current = true;
    const saved = last.current;
    if (saved && p.panels.some((row) => row.id === saved.panelId))
      void selectRef.current(saved.panelId, saved.targetId);
    else if (p.panels.length === 1) void selectRef.current(p.panels[0].id);
    else setDrawer("servers");
  }, [ready, p.busy, p.panels, p.focusPanelId]);
  useEffect(() => {
    if (p.busy) return;
    const removed = connections.filter((c) => !p.panels.some((row) => row.id === c.panelId));
    if (!removed.length) return;
    for (const c of removed) {
      disposeWorkspaceContext(c.id, owner.current);
      owned.current.delete(c.id);
    }
    setConnections((old) => old.filter((c) => !removed.some((row) => row.id === c.id)));
    if (removed.some((c) => c.id === selected)) {
      setSelected(null);
      setDrawer("servers");
    }
  }, [connections, selected, p.panels, p.busy]);
  useEffect(() => {
    if (!p.active || drawer !== "servers") return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (connection && dismissNativeConfirmation(connection.id)) return true;
      setDrawer(null);
      return true;
    });
    return () => listener.remove();
  }, [p.active, drawer, connection?.id]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      {connections.map((c) => (
        <View
          key={c.id}
          style={[{ flex: 1 }, c.id !== selected && { display: "none" }]}
          pointerEvents={c.id === selected ? "auto" : "none"}
          accessibilityElementsHidden={c.id !== selected}
          importantForAccessibility={c.id === selected ? "auto" : "no-hide-descendants"}
        >
          <WorkspaceSurface
            connection={c}
            token={p.token}
            account={p.account}
            language={p.language}
            active={p.active && c.id === selected}
            drawer={c.id === selected ? drawer : null}
            setDrawer={setDrawer}
            onServers={() => setDrawer("servers")}
            onReturnLocal={() => void returnLocal(c.panelId)}
            onAccount={p.onAccount}
            onLogout={p.onLogout}
            onSupport={p.onSupport}
            onToggleTheme={p.onToggleTheme}
            onLanguageChange={p.onLanguageChange}
          />
        </View>
      ))}
      {!selected && (
        <View style={styles.empty}>
          <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "700" }}>
            LUXIPANEL
          </Text>
          <Pressable onPress={() => setDrawer("servers")} style={styles.row}>
            <Server color={colors.brand} size={20} />
            <Text style={{ color: colors.textPrimary }}>
              {es ? nativeText("Seleccionar servidor", undefined, p.language) : nativeText("Select server", undefined, p.language)}
            </Text>
          </Pressable>
        </View>
      )}
      {busy && (
        <View pointerEvents="none" style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
        </View>
      )}
      {drawer === "servers" && (
        <WorkspaceServers
          panels={p.panels}
          targets={targets}
          panelId={connection?.panelId ?? ""}
          token={p.token}
          language={p.language}
          selectedTarget={connection?.targetId}
          error={error}
          busy={busy}
          onClose={() => setDrawer(null)}
          onSelectPanel={(id) => void select(id)}
          onSelectTarget={(target) => {
            if (!panel) return;
            if (target.isLocal) {
              void returnLocal(panel.id);
            } else void select(panel.id, target.id, target.name);
          }}
          onManagePanels={() => {
            setDrawer(null);
            p.onManagePanels();
          }}
          onEditPanel={(row) => {
            setDrawer(null);
            p.onEditPanel?.(row);
          }}
          onDeletePanel={p.onDeletePanel}
          onChanged={(rows) => setTargets(rows)}
        />
      )}
    </View>
  );
}

export function WorkspaceSurface({
  connection,
  token,
  account,
  language,
  active,
  drawer,
  setDrawer,
  onServers,
  onReturnLocal,
  onAccount,
  onLogout,
  onSupport,
  onToggleTheme,
  onLanguageChange,
}: {
  connection: Connection;
  token: string;
  account: string;
  language: string;
  active: boolean;
  drawer: string | null;
  setDrawer: (value: "history" | "modules" | "servers" | null) => void;
  onServers: () => void;
  onReturnLocal?: () => void;
  onAccount: () => void;
  onLogout: () => void;
  onSupport: () => void;
  onToggleTheme?: (origin?: ThemeOrigin) => void;
  onLanguageChange?: (language: string) => void;
}) {
  const isDark = useTheme().theme === "dark";
  const colors = getThemeTokens(isDark);
  const darkRail = useMemo(() => {
    if (!isDark) return lightRail;
    const mix = (bg: string, card: string) => {
      if (!/^#[0-9a-f]{6}$/i.test(bg) || !/^#[0-9a-f]{6}$/i.test(card)) return bg;
      return (
        "#" +
        [1, 3, 5]
          .map((i) =>
            Math.round(
              parseInt(bg.slice(i, i + 2), 16) * 0.65 + parseInt(card.slice(i, i + 2), 16) * 0.35,
            )
              .toString(16)
              .padStart(2, "0"),
          )
          .join("")
      );
    };
    return { ...colors, bgPrimary: mix(colors.bgPrimary, colors.bgCardSolid) };
  }, [isDark, colors]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const es = language.startsWith("es");
  const labels = workspaceLabels(language);
  const rtl = isRtlLocale(language);
  const messages = getMessages(language);
  const at = useMemo(() => ({ ...strings(language), ...labels.assistant }), [language, labels]);
  const session = useAssistantSession(connection.id);
  const chat = useAssistantChat(connection.id);
  const shift = useRef(new Animated.Value(0)).current;
  const kb = useTerminalKeyboard(insets.top);
  const [access, setAccess] = useState(new Set<string>());
  const [sidebarModules, setSidebarModules] = useState<NativeSidebarModule[]>([]);
  const [accessError, setAccessError] = useState("");
  const [menuModule, setMenuModule] = useState<string | null>(null);
  const [module, setModule] = useState<NativeModuleSession | null>(null);
  const [projects, setProjects] = useState<"new" | "list" | "picker" | null>(null);
  const [media, setMedia] = useState(false);
  const [topPanel, setTopPanel] = useState<"notifications" | "search" | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [settings, setSettings] = useState(false);
  const [languagePicker, setLanguagePicker] = useState(false);
  const [settingsVisited, setSettingsVisited] = useState(false);
  const [historyVisited, setHistoryVisited] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const menuModules = useMemo(() => {
    const byId = new Map(modules.map((module) => [module.id, module] as const));
    return workspaceMenuIds(sidebarModules, access).map(id => byId.get(id)).filter((entry): entry is NonNullable<typeof entry> => !!entry);
  }, [access, sidebarModules]);
  const fixedMenuModules = WORKSPACE_MENU_TOOLS
    .map(id => access.has(id) ? modules.find(entry => entry.id === id) : undefined)
    .filter((entry): entry is NonNullable<typeof entry> => !!entry);
  const searchableModules = useMemo(() => modules.filter(entry => access.has(entry.id)), [access]);
  const searchItems = useMemo<WorkspaceSearchItem[]>(() => searchableModules.flatMap((entry) => {
    const label = (labels.nav as Record<string, string>)[entry.labelKey] ??
      (messages.modules.labels as Record<string, string>)[entry.labelKey] ?? entry.id;
    return [
      { id: entry.id, label, kind: "module" as const, moduleId: entry.id },
      ...(workspaceModuleViews[entry.id] ?? []).map(view => ({
        id: `${entry.id}:${view.id}`,
        label: (labels.workspaceViews as Record<string, Record<string, string>>)[entry.id]?.[view.id] ?? view.en,
        description: label,
        kind: "module" as const,
        moduleId: view.id === "project-map" ? "project-map" : entry.id,
        viewId: view.id,
      })),
    ];
  }), [searchableModules, labels, messages]);
  useEffect(() => {
    if (!active) return;
    let current = true;
    const refresh = () => {
      void userRequest<{ count: number }>(connection.id, "GET", "/api/notifications/unread-count")
        .then(data => { if (current) setNotificationCount(data.count ?? 0); }).catch(() => {});
      void userRequest<{ count: number }>(connection.id, "GET", "/api/chat/unread-count")
        .then(data => { if (current) setMessageCount(data.count ?? 0); }).catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => { current = false; clearInterval(timer); };
  }, [active, connection.id]);
  const [historySearch, setHistorySearch] = useState(false);
  const [topChromeHeight, setTopChromeHeight] = useState(56);
  const [bottomChromeHeight, setBottomChromeHeight] = useState(180);
  const measureBottomChrome = useCallback((height: number) => {
    setBottomChromeHeight((previous) => Math.abs(previous - height) > 1 ? height : previous);
  }, []);
  const [clock, setClock] = useState(() => new Date());
  const [projectCatalog, setProjectCatalog] = useState<Project[]>([]);
  useEffect(() => {
    let current = true;
    void luxAssistantProxy<{ projects?: Project[]; items?: Project[] } | Project[]>(connection.id, token, "GET", "/api/ai/projects")
      .then((res) => {
        if (!current || res == null) return;
        const list = Array.isArray(res) ? res : (res.projects ?? res.items ?? []);
        if (Array.isArray(list)) setProjectCatalog(list);
      });
    return () => { current = false; };
  }, [connection.id, token, historyVersion]);
  const selectedRootId = rootProjectId(session.projectId, projectCatalog);
  const selectedRoot = projectCatalog.find((project) => project.id === selectedRootId);
  const chatProjectPath = projectLocation(chat.activeProject?.id ?? session.projectId, projectCatalog).join(" / ") || chat.activeProject?.title || null;
  const selectedProjectLabel = session.projectId
    ? selectedRoot?.name ?? selectedRoot?.title ?? chat.activeProject?.title ?? at.projectsSection
    : at.looseChats ?? nativeText("Chats sueltos", undefined, language);
  // Zonas físicas de borde: el ScrollView del chat se queda los gestos del
  // contenedor, por lo que el PanResponder anterior nunca recibía el swipe del
  // borde derecho en Android. Estas zonas solo miden 36 px y no bloquean el chat.
  const openEdgeDrawer = useCallback((side: "left" | "right", event: PanGestureHandlerStateChangeEvent) => {
    const { oldState, translationX, velocityX } = event.nativeEvent;
    if (oldState !== State.ACTIVE || !active || drawer || module || settings || projects || media || languagePicker || topPanel) return;
    const opens = side === "left"
      ? translationX > 64 || velocityX > 650
      : translationX < -64 || velocityX < -650;
    if (!opens) return;
    if (side === "left") setDrawer(rtl ? "modules" : "history");
    else {
      setMenuModule(null);
      setDrawer(rtl ? "history" : "modules");
    }
  }, [active, drawer, module, settings, projects, media, languagePicker, topPanel, rtl, setDrawer]);
  const closeSwipe = useMemo(() => {
    const shouldClose = (_: GestureResponderEvent, gesture: PanResponderGestureState) =>
      Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4;
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: shouldClose,
      onMoveShouldSetPanResponder: shouldClose,
      onPanResponderRelease: (_, gesture) => {
        const closesLeft = (drawer === "history") !== rtl;
        if (Math.abs(gesture.dx) >= 64 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4 &&
          (closesLeft ? gesture.dx < 0 : gesture.dx > 0)) setDrawer(null);
      },
    });
  }, [drawer, rtl, setDrawer]);
  useEffect(() => {
    if (drawer !== "history") return;
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, [drawer]);
  const accessGeneration = useRef(0);
  const loadAccess = useCallback(() => {
    const seq = ++accessGeneration.current;
    void fetchNativeModuleMenu(connection.id)
      .then((value) => {
        if (seq === accessGeneration.current) {
          setAccess(value.ids);
          setSidebarModules(value.sidebar);
          setMenuModule(current => current && workspaceMenuIds(value.sidebar, value.ids).includes(current) ? current : null);
          setAccessError("");
        }
      })
      .catch((cause) => {
        if (seq === accessGeneration.current) setAccessError(String(cause));
      });
  }, [connection.id, connection.revision]);
  useEffect(() => {
    loadAccess();
    return () => {
      accessGeneration.current++;
    };
  }, [loadAccess]);
  useEffect(() => {
    if (drawer === "modules") loadAccess();
  }, [drawer, loadAccess]);
  useEffect(() => {
    if (drawer === "history") setHistoryVisited(true);
  }, [drawer]);
  const closeModule = useCallback(() => setModule(null), []);
  const open = (moduleId: string, selectedView?: string) => {
    if (!access.has(moduleId)) return;
    if (moduleId === "assistant") {
      setModule(null);
      setDrawer(null);
      return;
    }
    setDrawer(null);
    setModule({ panelId: connection.id, moduleId, selectedView, viewRevision: Date.now() });
  };
  const newChat = (projectId?: string) => {
    chatStore.patchSession(connection.id, { agentId: null, agentName: null });
    chatController.newConversation(connection.id, {
      projectId: projectId ?? session.projectId ?? "",
    });
    setModule(null);
    setDrawer(null);
  };
  const openHistory = useCallback(() => setDrawer("history"), [setDrawer]);
  const openSettings = useCallback(() => { setSettingsVisited(true); setSettings(true); }, []);
  useEffect(() => {
    if (!active) return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (dismissNativeConfirmation(connection.id)) return true;
      if (module && dismissNativeConfirmation(`${module.panelId}:${module.moduleId}`)) return true;
      if (media) { setMedia(false); return true; }
      if (topPanel) { setTopPanel(null); return true; }
      if (languagePicker) {
        setLanguagePicker(false);
        return true;
      }
      if (dismissNativeModuleDialog(connection.id)) return true;
      if (projects) {
        setProjects(null);
        return true;
      }
      if (settings) {
        setSettings(false);
        return true;
      }
      if (drawer) {
        setDrawer(null);
        return true;
      }
      if (module) {
        if (!dismissNativeModuleDialog(`${module.panelId}:${module.moduleId}`)) setModule(null);
        return true;
      }
      return false;
    });
    return () => listener.remove();
  }, [active, projects, settings, drawer, module, languagePicker, media, topPanel, connection.id]);
  const openNotification = (notification: WorkspaceNotification) => {
    setTopPanel(null);
    const event = notification.target?.event;
    if (event?.name === "luxipanel:assistant-settings-open") { openSettings(); return; }
    if (event?.name === "luxipanel:assistant-new-conversation") { newChat(); return; }
    const conversationId = event?.detail?.conversationId ?? notification.target?.query?.c;
    if (event?.name === "luxipanel:assistant-open-conversation" && typeof conversationId === "string") {
      void chatController.openConversation(connection.id, conversationId); return;
    }
    const path = notification.target?.href ?? notification.link?.split(/[?#]/)[0];
    if (!path || !/^\/panel(?:\/[a-z0-9-]+)?$/.test(path)) return;
    if (path === "/panel") { setModule(null); if (typeof conversationId === "string") void chatController.openConversation(connection.id, conversationId); return; }
    const entry = modules.find(item => `/panel/${item.route}` === path);
    if (entry) {
      const query = notification.target?.query ?? (notification.link ? Object.fromEntries(new URL(notification.link, "https://panel.local").searchParams) : {});
      open(entry.id, entry.id === "chat" ? query.c : query.tab);
    }
  };
  const badge = (count: number) => count > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text></View> : null;
  const context = useMemo(
    () => ({ key: connection.id, visible: active, insideWorkspace: true, openModule: open }),
    [connection.id, active],
  );
  const button = (label: string, icon: React.ReactNode, action: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={action}
      style={styles.icon}
    >
      {icon}
    </Pressable>
  );
  return (
    <NativeModuleContext.Provider value={context}>
      <ThemeTransitionScope value={`${connection.id}:${module?.moduleId ?? ""}:${module?.selectedView ?? ""}:${module?.viewRevision ?? ""}:${drawer}:${settings}:${projects}`} />
      <NativeOverlayHost>
        <View
          ref={kb.surfaceRef}
          onLayout={kb.onSurfaceLayout}
          style={{ flex: 1, direction: rtl ? "rtl" : "ltr" }}
        >
          <View style={{ flex: 1, paddingBottom: kb.overlap }}>
            {access.has("assistant") ? (
              <ChatScreen
                panelId={connection.id}
                token={token}
                language={language}
                projectPath={chatProjectPath}
                layoutManaged
                topBar={<View onLayout={(event) => setTopChromeHeight(event.nativeEvent.layout.height)} style={[styles.navbar,styles.topNavbar,{backgroundColor:colors.bgPrimary,borderColor:colors.border}]}>
                  {button(es?nativeText("Notificaciones", undefined, language):nativeText("Notifications", undefined, language),<><Bell size={19} color={colors.textSecondary}/>{badge(notificationCount)}</>,()=>setTopPanel("notifications"))}
                  <Pressable accessibilityLabel={es?nativeText("Seleccionar servidor", undefined, language):nativeText("Select server", undefined, language)} onPress={onServers} style={[styles.project,styles.serverPicker,{flex:1,maxWidth:undefined,backgroundColor:colors.bgInput}]}><Server size={17} color={colors.textSecondary}/><Text numberOfLines={1} style={{flex:1,color:colors.textSecondary,fontSize:12}}>{connection.name}</Text><ChevronDown size={13} color={colors.textMuted}/></Pressable>
                  {button(labels.actions.chat,<><MessageCircle size={19} color={colors.textSecondary}/>{badge(messageCount)}</>,()=>{setTopPanel(null);open("chat");})}
                  {button(es?nativeText("Buscar en LUXIPANEL", undefined, language):nativeText("Search LUXIPANEL", undefined, language),<Search size={19} color={colors.textSecondary}/>,()=>setTopPanel("search"))}
                </View>}
                bottomNavigation={<View style={[styles.navbar,{backgroundColor:colors.bgPrimary,borderColor:colors.border}]}>
                  {button(labels.actions.openHistory,<History size={19} color={colors.textSecondary}/>,()=>{setHistorySearch(false);setDrawer("history");})}
                  <Pressable accessibilityLabel={at.projectsSection} onPress={()=>setProjects("picker")} style={[styles.project,styles.projectPicker,{borderColor:colors.border,minWidth:0,flex:1}]}><Folder size={16} color={colors.textMuted}/><Text numberOfLines={1} ellipsizeMode="head" style={{color:colors.textSecondary,fontSize:12,flex:1}}>{chatProjectPath ?? selectedProjectLabel}</Text><ChevronDown size={12} color={colors.textMuted}/></Pressable>
                  {access.has("terminal")&&button(es?nativeText("Nueva terminal", undefined, language):nativeText("New terminal", undefined, language),<Terminal size={19} color={colors.textSecondary}/>,()=>open("terminal","new"))}
                  {button(es?"Multimedia":nativeText("Media", undefined, language),<ImageIcon size={19} color={colors.textSecondary}/>,()=>setMedia(true))}
                  {button(labels.nav.modules,<Menu size={20} color={colors.textSecondary}/>,()=>{setMenuModule(null);setDrawer("modules");})}
                </View>}
                keyboardShift={shift}
                onBottomChromeLayout={measureBottomChrome}
                onBack={openHistory}
                onOpenSettings={openSettings}
                onNewTerminal={access.has("terminal") ? () => open("terminal", "new") : undefined}
              />
            ) : (
              <View style={styles.empty}>
                <Text style={{ color: colors.textMuted }}>
                  {accessError ||
                    (es ? nativeText("Selecciona un módulo para comenzar", undefined, language) : nativeText("Select a module to begin", undefined, language))}
                </Text>
              </View>
            )}

          </View>
        </View>
        {!drawer && !module && !settings && !projects && !media && !languagePicker && !topPanel ? (
          <View pointerEvents="box-none" style={[styles.edgeGestureLayer, { top: topChromeHeight, bottom: bottomChromeHeight }]}>
            <PanGestureHandler
              activeOffsetX={[-8, 8]}
              failOffsetY={[-24, 24]}
              onHandlerStateChange={(event) => openEdgeDrawer("left", event)}
            >
              <View style={[styles.edgeGestureZone, { left: 0 }]} />
            </PanGestureHandler>
            <PanGestureHandler
              activeOffsetX={[-8, 8]}
              failOffsetY={[-24, 24]}
              onHandlerStateChange={(event) => openEdgeDrawer("right", event)}
            >
              <View style={[styles.edgeGestureZone, { right: 0 }]} />
            </PanGestureHandler>
          </View>
        ) : null}
        <NativeConversationMedia panelId={connection.id} token={token} language={language} visible={media} onClose={()=>setMedia(false)}/>
        <PersistentNativeModules
          active={module}
          token={token}
          accountId={account}
          visible={active}
          onClose={closeModule}
        />
        {topPanel === "notifications" && <WorkspaceNotifications panelId={connection.id} token={token} language={language} colors={colors} onClose={() => setTopPanel(null)} onCount={setNotificationCount} onOpen={openNotification}/>}
        {topPanel === "search" && <WorkspaceSearch panelId={connection.id} token={token} language={language} colors={colors} modules={searchItems} onClose={() => setTopPanel(null)} onModule={(id, view) => { setTopPanel(null); open(id, view); }} onConversation={(id) => { setTopPanel(null); setModule(null); void chatController.openConversation(connection.id, id); }}/>}
        {settingsVisited && (
          <NativeModuleContext.Provider value={{ ...context, visible: active }}>
            <ModuleSettingsDrawer visible={settings} onClose={() => setSettings(false)} title={es ? nativeText("Ajustes del asistente", undefined, language) : nativeText("Assistant settings", undefined, language)} language={language}>
              <AssistantSettingsTab panelId={connection.id} token={token} language={language} onOpenChat={() => setSettings(false)} onCloseDrawer={() => setSettings(false)} />
            </ModuleSettingsDrawer>
          </NativeModuleContext.Provider>
        )}
        {drawer === "history" || drawer === "modules" ? (
          <Pressable
            style={styles.backdrop}
            accessibilityLabel={messages.common.close}
            onPress={() => setDrawer(null)}
          />
        ) : null}
        {historyVisited && (
          <View
            {...closeSwipe.panHandlers}
            style={[
              styles.drawer,
              {
                ...(rtl ? { right: 0 } : { left: 0 }),
                width: Math.min(360, width * 0.9),
                backgroundColor: darkRail.bgPrimary,
              },
              drawer !== "history" && { display: "none" },
            ]}
            pointerEvents={drawer === "history" ? "auto" : "none"}
            accessibilityElementsHidden={drawer !== "history"}
          >
            <View style={[styles.header, { borderColor: darkRail.border }]}>
              <Pressable onPress={() => open("preferences")} accessibilityLabel={messages.account.tabProfile}>
                <PanelLogo />
              </Pressable>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: darkRail.textPrimary, fontSize: 11 }}>
                  {clock.toLocaleDateString(language, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </Text>
                <Text style={{ color: darkRail.textSecondary, fontSize: 10 }}>
                  {clock.toLocaleTimeString(language)}
                </Text>
              </View>
              {button(labels.actions.settings,<Settings size={19} color={darkRail.textMuted}/>,()=>{setSettingsVisited(true);setSettings(true);})}
              {button(labels.actions.closeSession,<LogOut size={19} color={darkRail.textMuted}/>,onLogout)}
            </View>
            <NativeModuleContext.Provider
              value={{ ...context, visible: active && drawer === "history" }}
            >
              <View style={{ flex: 1, paddingHorizontal: 10 }}>
                <ConversationsDrawer
                  key={historyVersion}
                  workspace
                  searchOpen={historySearch}
                  fill
                  panelId={connection.id}
                  token={token}
                  t={at}
                  tokens={darkRail}
                  activeId={session.conversationId}
                  projectId={session.projectId ?? ""}
                  onOpen={(id) => {
                    void chatController.openConversation(connection.id, id);
                    setModule(null);
                    setDrawer(null);
                  }}
                  onNew={() => newChat("")}
                  onNewInProject={(id) => newChat(id)}
                  onDeleted={(id) => {
                    if (id !== session.conversationId) return;
                    chatStore.patchSession(connection.id, { agentId: null, agentName: null });
                    chatController.newConversation(connection.id, { projectId: session.projectId ?? "" });
                  }}
                  onOpenAllProjects={() => setProjects("list")}
                  onPickAgent={(agent) => {
                    chatController.newConversation(connection.id);
                    if (agent.providerId)
                      chatController.setProvider(connection.id, agent.providerId);
                    chatStore.patchSession(connection.id, {
                      agentId: agent.id,
                      agentName: agent.name ?? null,
                    });
                    setDrawer(null);
                  }}
                />
              </View>
            </NativeModuleContext.Provider>
            <View
              style={{
                paddingHorizontal: 12,
                paddingTop: 8,
                paddingBottom: insets.bottom + 8,
                gap: 6,
                borderTopWidth: 1,
                borderColor: darkRail.border,
              }}
            >
              <Pressable onPress={() => setProjects("new")} style={styles.create}>
                <FolderPlus size={18} color={darkRail.brand} />
                <Text style={{ color: darkRail.textPrimary, fontSize: 14 }}>{at.newProject}</Text>
              </Pressable>
              <Pressable onPress={() => newChat("")} style={styles.create}>
                <Plus size={18} color={darkRail.brand} />
                <Text style={{ color: darkRail.textPrimary, fontSize: 14 }}>
                  {labels.chatPanel.newConversation}
                </Text>
              </Pressable>
              {session.projectId && selectedRootId && session.projectId !== selectedRootId && selectedRoot ? (
                <Pressable onPress={() => newChat(selectedRootId)} style={styles.create}>
                  <FolderPlus size={18} color={darkRail.brand} />
                  <Text style={{ color: darkRail.textPrimary, fontSize: 14 }}>
                    {(at.newProjectConversationTitle ?? nativeText("Nueva conversación en {project}", undefined, language)).replace("{project}", selectedRoot.name ?? selectedRoot.title ?? selectedRoot.id)}
                  </Text>
                </Pressable>
              ) : null}

            </View>
          </View>
        )}
        {drawer === "modules" && (
          <View
            testID="workspace-modules-menu"
            {...closeSwipe.panHandlers}
            style={[
              styles.drawer,
              {
                ...(rtl ? { left: 0 } : { right: 0 }),
                width: Math.min(340, width * 0.94),
                backgroundColor: colors.bgPrimary,
                paddingBottom: insets.bottom,
              },
            ]}
          >
            <View style={[styles.header, { borderColor: colors.border }]}>
              <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>
                {labels.nav.modules}
              </Text>
              {onToggleTheme ? <ThemeIconButton theme={isDark ? "dark" : "light"} label={connectionMessages(language).theme} onToggle={onToggleTheme} /> : null}
              {onLanguageChange ? (
                <Pressable onPress={() => setLanguagePicker(true)} style={styles.icon}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {language.toUpperCase()}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityLabel={messages.account.tabProfile} onPress={()=>open("preferences")}><Avatar displayName={account.split(":").at(-1) || nativeText("LUXIPANEL", undefined, language)}/></Pressable>
              {button(messages.common.close, <X size={20} color={colors.textMuted} />, () =>
                setDrawer(null),
              )}
            </View>
            <ScrollView testID="workspace-modules-scroll" style={{flex:1,minHeight:0}} contentContainerStyle={{ padding: 8, gap: 4 }}>
              {accessError ? (
                <Pressable onPress={loadAccess}>
                  <Text style={{ color: colors.danger }}>{localizeServerError(accessError, language)}</Text>
                </Pressable>
              ) : null}
              {menuModule && (
                <Pressable accessibilityLabel={labels.nav.modules} onPress={() => setMenuModule(null)} style={styles.moduleRow}>
                  <ChevronLeft size={19} color={colors.textMuted} />
                  <Text style={{ color: colors.textPrimary }}>{labels.nav.modules}</Text>
                </Pressable>
              )}
              {menuModule
                ? (workspaceModuleViews[menuModule] ?? []).map((view) => (
                    <Pressable
                      key={view.id}
                      style={styles.moduleRow}
                      onPress={() =>
                        open(view.id === "project-map" ? "project-map" : menuModule, view.id)
                      }
                    >
                      <Text style={{ color: colors.textPrimary, flex: 1 }}>
                        {(labels.workspaceViews as Record<string, Record<string, string>>)[
                          menuModule
                        ]?.[view.id] ?? view.en}
                      </Text>
                      <ChevronRight size={17} color={colors.textMuted} />
                    </Pressable>
                  ))
                : menuModules
                    .map((m) => {
                      const Icon = m.icon;
                      return (
                        <Pressable
                          key={m.id}
                          testID={`workspace-menu-module:${m.id}`}
                          onPress={() =>
                            (workspaceModuleViews[m.id]?.length ?? 0) > 1 ? setMenuModule(m.id) : open(m.id)
                          }
                          style={[
                            styles.moduleRow,
                            {
                              backgroundColor:
                                module?.moduleId === m.id ? colors.bgCardSolid : undefined,
                            },
                          ]}
                        >
                          <Icon size={21} color={colors.textSecondary} />
                          <Text style={{ color: colors.textPrimary, flex: 1, fontSize: 14 }}>
                            {(labels.nav as Record<string, string>)[m.labelKey] ??
                              (messages.modules.labels as Record<string, string>)[m.labelKey] ??
                              m.id}
                          </Text>
                          {(workspaceModuleViews[m.id]?.length ?? 0) > 1 ? (
                            <ChevronRight size={17} color={colors.textMuted} />
                          ) : null}
                        </Pressable>
                      );
                    })}
            </ScrollView>
            {fixedMenuModules.length > 0 && <View testID="workspace-modules-tools" style={{flexShrink:0,borderTopWidth:1,borderColor:colors.border,backgroundColor:colors.bgCardSolid,padding:8,gap:4}}>
              <Text style={{color:colors.textMuted,fontSize:10,fontWeight:"700",letterSpacing:1,paddingHorizontal:12,textTransform:"uppercase"}}>{labels.groups.tools}</Text>
              {fixedMenuModules.map(entry => {
                const Icon = entry.icon;
                return <Pressable key={entry.id} testID={`workspace-menu-tool:${entry.id}`} accessibilityRole="button" onPress={()=>open(entry.id)} style={styles.moduleRow}>
                  <Icon size={21} color={colors.textSecondary}/>
                  <Text style={{color:colors.textPrimary,fontSize:14}}>{(labels.nav as Record<string,string>)[entry.labelKey] ?? entry.id}</Text>
                </Pressable>;
              })}
            </View>}
            {connection.targetId !== "local" && onReturnLocal && (
              <View style={{flexShrink:0,borderTopWidth:1,borderColor:colors.border,padding:8}}>
                <Pressable testID="workspace-menu-return-local" accessibilityRole="button" accessibilityLabel={labels.serverSwitcher.returnTitle} onPress={onReturnLocal} style={styles.moduleRow}>
                  <ArrowLeft size={21} color={colors.textSecondary}/>
                  <Text style={{color:colors.textPrimary,fontSize:14}}>{labels.serverSwitcher.returnButton}</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
        {languagePicker && (
          <View
            style={[
              styles.overlay,
              {
                zIndex: 130,
                backgroundColor: colors.bgPrimary,
                padding: 16,
                paddingBottom: insets.bottom,
              },
            ]}
          >
            <View style={styles.header}>
              <Text style={{ color: colors.textPrimary, flex: 1 }}>
                {es ? nativeText("Idioma", undefined, language) : nativeText("Language", undefined, language)}
              </Text>
              {button(messages.common.close, <X size={20} color={colors.textMuted} />, () =>
                setLanguagePicker(false),
              )}
            </View>
            <ScrollView>
              {WORKSPACE_LOCALES.map((locale) => (
                <Pressable
                  key={locale.code}
                  style={styles.moduleRow}
                  onPress={() => {
                    onLanguageChange?.(locale.code);
                    setLanguagePicker(false);
                  }}
                >
                  <Text style={{ color: colors.textPrimary }}>{locale.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
        <ProjectsModal
          visible={projects !== null}
          createOnOpen={projects === "new"}
          pickerOnly={projects === "picker"}
          panelId={connection.id}
          token={token}
          language={language}
          activeProjectId={session.projectId ?? ""}
          onClose={() => {
            setProjects(null);
            setHistoryVersion((v) => v + 1);
          }}
          onPick={(id) => {
            newChat(id);
          }}
        />
      </NativeOverlayHost>
    </NativeModuleContext.Provider>
  );
}
const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, padding: 24 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  loading: { position: "absolute", top: 12, alignSelf: "center", zIndex: 110 },
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 50,
    gap: 6,
  },
  topNavbar: { borderTopWidth: 0, borderBottomWidth: 1 },
  icon: { height: 32, minWidth: 32, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  badge: { position: "absolute", top: -5, right: -7, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, alignItems: "center", justifyContent: "center", backgroundColor: "#e24b5b" },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  project: { flexDirection: "row", alignItems: "center", gap: 4, height: 32, flexShrink: 1 },
  serverPicker: { paddingHorizontal: 8, borderRadius: 8 },
  projectPicker: { paddingHorizontal: 8, borderWidth: 1, borderRadius: 8 },
  overlay: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 85 },
  backdrop: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 90,
    backgroundColor: "rgba(0,0,0,.48)",
  },
  drawer: { position: "absolute", top: 0, bottom: 0, zIndex: 95 },
  edgeGestureLayer: { position: "absolute", left: 0, right: 0, zIndex: 80 },
  edgeGestureZone: { position: "absolute", top: 0, bottom: 0, width: 36 },
  header: {
    minHeight: 56,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
  },
  create: { flexDirection: "row", alignItems: "center", gap: 10, height: 38, paddingHorizontal: 8 },
  serverSelect: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  moduleRow: { flexDirection: "row", alignItems: "center", padding: 12, gap: 12, borderRadius: 8 },
});
