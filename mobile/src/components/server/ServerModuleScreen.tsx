import { localizeServerError } from '../../lib/server-error-localization';
import { nativeText } from "../../i18n/native-text";
/**
 * ServerModuleScreen — scaffold común de las pantallas de módulos NATIVAS.
 * Cabecera fija del drawer web: navegación, acciones, ajustes y cierre.
 * El cuerpo mantiene su scroll, guardas, errores y pull-to-refresh.
 */
import React, { useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { NativeModuleContext } from "../../screens/main/native-module-visibility";
import { NativeModuleExtras } from "../../screens/server/native-extras/NativeModuleExtras";
import { PanelText as Text } from "../ui/PanelText";
import { RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { getMessages } from "../../i18n";
import { loadSessionState } from "../../lib/session-state";
import type { SegmentItem } from "../ui/SegmentedControl";
import { Button } from "../ui/Button";
import { NativeModuleHeader } from "./NativeModuleHeader";
import { ModuleUiContext, moduleSpacing } from "../ui/ModuleUi";
import { workspaceModuleViews } from "../../screens/main/workspace-module-views";
import { ModuleSettingsDrawer, SettingsColumns, SettingsSectionBody } from "../ui/ModuleSettingsDrawer";
import { createModuleSettingsStore, ModuleSettingsPagesContext, RegisteredModuleSettingsPage, type ModuleSettingsPage } from "./module-settings-pages";
import { settingsSections } from "./module-settings-layout";
import type { GatewayGuardCode } from "../../api/serverApi";

export function ServerModuleScreen({
  title,
  subtitle,
  onBack,
  tabs,
  activeTab,
  onTabChange,
  action,
  error,
  guardCode,
  onRetry,
  refreshing = false,
  onRefresh,
  onSettings,
  headerActions,
  settingsPages = [],
  renderHeader,
  contentContainerStyle,
  showExtras = true,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  tabs?: SegmentItem[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  action?: { label: string; icon?: React.ReactNode; onPress: () => void } | null;
  error?: string | null;
  guardCode?: GatewayGuardCode | null;
  onRetry?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  onSettings?: () => void;
  headerActions?: React.ReactNode;
  settingsPages?: ModuleSettingsPage[];
  renderHeader?: (controls: { onSettings?: () => void; onClose: () => void; guarded: boolean }) => React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  showExtras?: boolean;
  children: React.ReactNode;
}) {
  const moduleContext = useContext(NativeModuleContext);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const insets = useSafeAreaInsets();
  const language = loadSessionState().language;
  const t = getMessages(language).serverTable;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPage, setSettingsPage] = useState("");
  const settingsStore = useMemo(() => createModuleSettingsStore(key => { setSettingsPage(key); setSettingsOpen(true); }), []);
  const registeredPages = useSyncExternalStore(settingsStore.subscribe, settingsStore.pages);
  const sourcePages = [...settingsPages, ...registeredPages.filter(page => !settingsPages.some(own => own.key === page.key))];
  const layout = settingsSections(moduleContext?.moduleId ?? "", sourcePages.map(page => page.key));
  const renderSource = (key: string) => {
    const page = sourcePages.find(source => source.key === key)!;
    return "content" in page ? page.content : <RegisteredModuleSettingsPage store={settingsStore} pageKey={key} />;
  };
  const pages: ModuleSettingsPage[] = layout ? layout.map(section => ({
    key: section.key, label: nativeText(section.es, undefined, language),
    icon: sourcePages.find(page => page.key === section.sources[0])?.icon,
    content: <View style={{ gap: 20 }}>{section.sources.map(key => <View key={key} style={{gap:12}}>{section.sources.length > 1 && key.startsWith("table:") ? <Text style={{color:tokens.textPrimary,fontWeight:"700"}}>{sourcePages.find(page=>page.key===key)?.label}</Text> : null}{renderSource(key)}</View>)}</View>,
  })) : sourcePages.map(page => ({ ...page, content: renderSource(page.key) }));
  const selectedPage = layout?.find(section => section.key === settingsPage || section.sources.includes(settingsPage))?.key ?? settingsPage;
  const pageKey = pages.some(page => page.key === selectedPage) ? selectedPage : pages[0]?.key ?? "";
  // These screens consume selectedView directly (including their operation groups).
  const navigationModules = ["firewall", "dns", "cloudflare", "webhooks", "preferences", "files", "codebase-graph"];
  const views = moduleContext?.selectView && navigationModules.includes(moduleContext.moduleId ?? "")
    ? workspaceModuleViews[moduleContext!.moduleId!] : undefined;
  const headerTabs = tabs ?? views?.map(view => ({ key: view.id, label: nativeText(view.es, undefined, language) }));
  const selectedView = moduleContext?.selectedView ?? views?.[0]?.id;
  const contentContext = views && moduleContext ? { ...moduleContext, selectedView } : moduleContext;
  const scroll = useRef<ScrollView>(null);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [activeTab, selectedView]);

  const guardMessage = guardCode
    ? guardCode === "DIRECT_AUTH_REQUIRED"
      ? nativeText("Conecta este servidor para gestionar sus módulos.", undefined, language)
      : guardCode === "NO_CREDENTIALS"
      ? t.guardNoCredentials
      : guardCode === "FINGERPRINT_PENDING"
        ? t.guardFingerprintPending
        : t.guardPanelUnavailable
    : null;

  return (
    <ModuleUiContext.Provider value={true}>
    <ModuleSettingsPagesContext.Provider value={settingsStore}>
    <View style={{ flex: 1, minHeight: 0, backgroundColor: tokens.bgPrimary, paddingTop: moduleContext?.insideWorkspace || moduleContext?.insideModuleDrawer ? 0 : insets.top }}>
      {renderHeader ? renderHeader({ onSettings: onSettings ?? (pages.length ? () => setSettingsOpen(true) : undefined), onClose: onBack, guarded: !!guardMessage }) : <NativeModuleHeader title={title} subtitle={subtitle} onClose={onBack}
        backButton={!moduleContext?.insideModuleDrawer && !moduleContext?.insideWorkspace}
        tabs={headerTabs} activeTab={activeTab ?? selectedView} onTabChange={onTabChange ?? moduleContext?.selectView}
        onSettings={onSettings ?? (pages.length ? () => setSettingsOpen(true) : undefined)} onRefresh={onRefresh} refreshing={refreshing}
        actions={!guardMessage && (action || headerActions) ? <>{action ? <Button label={action.label} icon={action.icon} onPress={action.onPress} size="sm" /> : null}{headerActions}</> : undefined}
      />}
      <NativeModuleContext.Provider value={contentContext}>
      <ScrollView
        ref={scroll}
        testID="native-module-content"
        style={{ flex: 1 }}
        contentContainerStyle={[moduleContext?.moduleId === "files" ? { padding: 0, gap: 14 } : moduleSpacing, { paddingBottom: insets.bottom + 24 }, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand} /> : undefined
        }
      >
        {guardMessage ? (
          <View style={{ alignItems: "center", paddingVertical: 40, gap: 12 }}>
            <Text style={{ color: tokens.textMuted, fontSize: 14, textAlign: "center" }}>{guardMessage}</Text>
            {onRetry ? <Button label={t.retry} variant="secondary" size="sm" onPress={onRetry} /> : null}
          </View>
        ) : (
          <>
            {error ? (
              <View style={{ alignItems: "center", paddingVertical: 12, gap: 10 }}>
                <Text style={{ color: tokens.danger, fontSize: 13, textAlign: "center" }}>{localizeServerError(error)}</Text>
                {onRetry ? <Button label={t.retry} variant="secondary" size="sm" onPress={onRetry} /> : null}
              </View>
            ) : null}

            {children}
            {showExtras && moduleContext?.panelId && moduleContext.moduleId && <NativeModuleExtras panelId={moduleContext.panelId} token={moduleContext.token ?? ""} moduleId={moduleContext.moduleId} onSaved={onRefresh} />}
          </>
        )}
      </ScrollView>
      {pages.length ? <ModuleSettingsDrawer visible={settingsOpen} onClose={() => setSettingsOpen(false)} title={`${nativeText("Configuración", undefined, language)} · ${title}`} language={language}>
        <SettingsColumns sections={pages} value={pageKey} onChange={setSettingsPage} language={language}>
          {pages.map(page => <SettingsSectionBody key={page.key} active={page.key === pageKey}>
            <ModuleSettingsPagesContext.Provider value={null}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16 }}>
              {error ? <Text accessibilityRole="alert" style={{color:tokens.danger}}>{localizeServerError(error)}</Text> : null}
              {page.content}
            </ScrollView></ModuleSettingsPagesContext.Provider>
          </SettingsSectionBody>)}
        </SettingsColumns>
      </ModuleSettingsDrawer> : null}
      </NativeModuleContext.Provider>
    </View>
    </ModuleSettingsPagesContext.Provider>
    </ModuleUiContext.Provider>
  );
}
