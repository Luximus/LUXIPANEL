import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PanelTaxonomy, SshKeyOption, SshKeySummary } from "../api/client";
import type { PanelEditorState } from "../features/app/viewModels";
import { getMessages } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../theme/colors";
import { TablerServer, TablerChevronRight } from "../features/app/tabler-icons";
import { SegmentedControl } from "./ui/SegmentedControl";
import { SettingsPanels, type SettingsTab } from "./DataTableSettingsModal";
import { ImportExportPanel } from "./ImportExportPanel";
import { PanelEditorPanel } from "./PanelEditorPanel";

// "transfer" engloba Importar + Exportar; "integrations" engloba Integraciones +
// API (cada uno con un sub-conmutador interno), para acortar la tira de tabs.
export type ActionsSheetTab = "new" | "transfer" | "integrations";

/** Orden de tabs del sheet central (para navegación por swipe horizontal). */
export const ACTIONS_SHEET_TABS: ActionsSheetTab[] = ["new", "transfer", "integrations"];

/** Items (key + label) de los tabs del sheet central para pintarlos en el
 *  `DrawerTopBar` de la barra superior (igual que los drawers izq/der). */
export function actionsSheetTabItems(
  t: ReturnType<typeof getMessages>,
): { key: ActionsSheetTab; label: string }[] {
  return [
    { key: "new", label: t.dashboard.tabNew },
    { key: "transfer", label: t.dashboard.tabTransfer },
    { key: "integrations", label: t.dataTableSettings.tabs.integrations },
  ];
}

/** Datos del controlador que necesitan los paneles del sheet central. */
export type ActionsSheetData = {
  token: string;
  isAdmin: boolean;
  taxonomy: PanelTaxonomy["categories"];
  sshKeys: SshKeySummary[];
  sshKeyOptions: SshKeyOption[];
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
  panelEditor: PanelEditorState;
  setPanelEditor: React.Dispatch<React.SetStateAction<PanelEditorState>>;
  submitPanelEditor: () => void;
  requestDeletePanel: () => void;
  closePanelEditor: () => void;
  onAfterImport: () => void;
};

/**
 * Contenido del bottom-sheet central: un asa (solo visual) y el panel del tab
 * activo. Los tabs viven en la barra superior (`DrawerTopBar`). El shell animado
 * (slide vertical + backdrop + arrastre-para-cerrar en TODO el contenedor) lo
 * aporta `MainScreen`; aquí no hay gesto propio. Se cierra arrastrando el sheet
 * hacia abajo, tocando el backdrop o con el botón atrás.
 */
export default function ActionsSheet({
  visible,
  tab,
  language,
  data,
  onOpenStandalone,
}: {
  visible: boolean;
  tab: ActionsSheetTab;
  /** Aceptados (los pasa MainScreen) pero el cambio de tab y el cierre viven en
   *  el navbar / el shell del sheet, no aquí. */
  onTabChange?: (tab: ActionsSheetTab) => void;
  onClose?: () => void;
  language: string;
  data: ActionsSheetData;
  /** Abre el gestor de servidores STANDALONE (conexión directa, sin LP-LS). */
  onOpenStandalone?: () => void;
}) {
  const t = getMessages(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const insets = useSafeAreaInsets();
  // Sub-conmutadores de los tabs combinados.
  const [transferMode, setTransferMode] = useState<"export" | "import">("export");
  const [integrationsSub, setIntegrationsSub] = useState<"integrations" | "api">("integrations");

  // Al cambiar de tab de primer nivel, los sub-conmutadores vuelven a su primera
  // opción ("Exportar" / "Integraciones"): un tab con sub-tabs debe empezar SIEMPRE
  // en el primero al volver a él, no donde quedó la última vez.
  useEffect(() => {
    setTransferMode("export");
    setIntegrationsSub("integrations");
  }, [tab]);

  const settingsData = {
    taxonomy: data.taxonomy,
    sshKeys: data.sshKeys,
    refreshTaxonomy: data.refreshTaxonomy,
    refreshSshKeys: data.refreshSshKeys,
    applyCategoryCreated: data.applyCategoryCreated,
    applyCategoryRenamed: data.applyCategoryRenamed,
    applyCategoryDeleted: data.applyCategoryDeleted,
    applyTagCreated: data.applyTagCreated,
    applyTagRenamed: data.applyTagRenamed,
    applyTagDeleted: data.applyTagDeleted,
    applySshKeyCreated: data.applySshKeyCreated,
    applySshKeyUpdated: data.applySshKeyUpdated,
    applySshKeyDeleted: data.applySshKeyDeleted,
  };

  return (
    <View style={[styles.root, { backgroundColor: tokens.bgPrimary }]}>
      {/* Asa (solo indicador visual): el arrastre-para-cerrar lo gestiona el shell
          del sheet en MainScreen sobre TODO el contenedor. */}
      <View style={styles.handleZone}>
        <View style={[styles.handle, { backgroundColor: tokens.border }]} />
      </View>

      <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {tab === "new" ? (
          <>
            {/* Servidor STANDALONE: conexión DIRECTA al box (sin LP-LS de puente). */}
            {onOpenStandalone ? (
              <Pressable
                onPress={onOpenStandalone}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  marginBottom: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: withAlpha(tokens.brand, 0.3),
                  backgroundColor: withAlpha(tokens.brand, 0.08),
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(tokens.brand, 0.14) }}>
                  <TablerServer size={20} color={tokens.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: tokens.textPrimary, fontSize: 14, fontWeight: "700" }}>
                    {t.serverStandalone.launcher}
                  </Text>
                  <Text numberOfLines={2} style={{ color: tokens.textMuted, fontSize: 12 }}>
                    {t.serverStandalone.launcherHint}
                  </Text>
                </View>
                <TablerChevronRight size={18} color={tokens.textMuted} />
              </Pressable>
            ) : null}
            <PanelEditorPanel
              panelEditor={data.panelEditor}
              taxonomy={data.taxonomy}
              sshKeys={data.sshKeyOptions}
              setPanelEditor={data.setPanelEditor}
              closePanelEditor={data.closePanelEditor}
              submitPanelEditor={data.submitPanelEditor}
              requestDeletePanel={data.requestDeletePanel}
              language={language}
              hideCancel
            />
          </>
        ) : null}
        {tab === "transfer" ? (
          <View style={{ flex: 1 }}>
            <View style={styles.subToggle}>
              <SegmentedControl
                fill
                items={[
                  { key: "export", label: t.dashboard.tabExport },
                  { key: "import", label: t.dashboard.tabImport },
                ]}
                value={transferMode}
                onChange={(k) => setTransferMode(k as "export" | "import")}
              />
            </View>
            <ImportExportPanel
              mode={transferMode}
              token={data.token}
              language={language}
              onAfterImport={data.onAfterImport}
            />
          </View>
        ) : null}
        {tab === "integrations" ? (
          <View style={{ flex: 1 }}>
            <View style={styles.subToggle}>
              <SegmentedControl
                fill
                items={[
                  { key: "integrations", label: t.dataTableSettings.tabs.integrations },
                  { key: "api", label: t.dataTableSettings.tabs.api },
                ]}
                value={integrationsSub}
                onChange={(k) => setIntegrationsSub(k as "integrations" | "api")}
              />
            </View>
            <SettingsPanels
              visible
              tab={integrationsSub as SettingsTab}
              onTabChange={() => {}}
              hideTabs
              presentation="drawer"
              language={language}
              token={data.token}
              {...settingsData}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Sin radio ni borde superior: el sheet ocupa el 100% del contenedor y queda a
  // ras de la barra de tabs (`DrawerTopBar`).
  root: { flex: 1, overflow: "hidden" },
  handleZone: { alignItems: "center", paddingTop: 10, paddingBottom: 10 },
  handle: { width: 44, height: 5, borderRadius: 3 },
  subToggle: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 2 },
  body: { flex: 1 },
});
