import React, { useContext, useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ width: 390, dismiss: vi.fn(), mounts: vi.fn() }));
vi.mock("react-native-gesture-handler", () => ({ GestureHandlerRootView: "GestureRoot", ScrollView: "ScrollView" }));
vi.mock("react-native", () => ({ Easing: { in: (fn: unknown) => fn, out: (fn: unknown) => fn, cubic: "cubic", quad: "quad" }, AccessibilityInfo: { isReduceMotionEnabled: async () => false, addEventListener: () => ({ remove() {} }) }, Animated:{View:"AnimatedView",Value:class{interpolate(v:unknown){return v;}},timing:()=>({start:(cb:any)=>cb?.({finished:true}),stop(){}})},Platform:{OS:"android"},KeyboardAvoidingView:"KAV", View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView", RefreshControl: "RefreshControl", ActivityIndicator: "Spinner", Modal: "Modal", Keyboard: { dismiss: mocks.dismiss }, StyleSheet: { create: (s: unknown) => s }, useWindowDimensions: () => ({ width: mocks.width }) }));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 20 }) }));
vi.mock("lucide-react-native", () => ({ ChevronLeft: "Icon", RefreshCw: "Icon", Settings2: "Icon", Settings: "Icon", X: "Icon" }));
vi.mock("../../hooks/useTheme", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("../../theme/colors", () => ({ getThemeTokens: () => ({ brand: "#1f8b67", border: "#333" }), withAlpha: (color: string) => color }));
vi.mock("../../lib/session-state", () => ({ loadSessionState: () => ({ language: "es" }) }));
vi.mock("../../i18n", () => ({ getMessages: () => ({ common: { close: "Cerrar" }, serverTable: { retry: "Reintentar" } }) }));
vi.mock("../ui/Button", () => ({ Button: "Button" }));
vi.mock("./LiveDataStatus", () => ({ LiveDataStatus: "LiveDataStatus" }));
vi.mock("../../screens/server/native-extras/NativeModuleExtras", () => ({ NativeModuleExtras: () => null }));
import { ServerModuleScreen } from "./ServerModuleScreen";
import { UsersModuleHeader } from "../../screens/server/users/UsersModuleHeader";
import { NativeModuleContext, ScopedNativeModal, dismissNativeModuleDialog } from "../../screens/main/native-module-context";
import { WorkspaceModuleSection } from "../../screens/main/WorkspaceModuleSection";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); vi.clearAllMocks(); });
const press = async (label: string) => act(async () => tree.root.findAllByType("Pressable" as any).find(node => node.props.accessibilityLabel === label)!.props.onPress());

it.each(["users", "files", "cron", "mail", "monitor", "hosting", "backups", "databases", "firewall", "cloudflare", "dns", "webhooks", "expo", "obsidian", "settings", "modules", "preferences", "codebase-graph", "repository-store", "module-dev", "project-map", "bitninja", "openclaw", "server-alerts"])("omits the update strip in %s while keeping manual refresh", async (moduleId) => {
  const refresh = vi.fn();
  await act(async () => { tree = create(<NativeModuleContext.Provider value={{ key: `box:${moduleId}`, panelId: "box", moduleId, visible: true }}>
    <ServerModuleScreen title={moduleId} onBack={() => {}} onRefresh={refresh}><React.Fragment /></ServerModuleScreen>
  </NativeModuleContext.Provider>); });
  expect(tree.root.findAllByType("LiveDataStatus" as any)).toHaveLength(0);
  await press("Actualizar");
  expect(refresh).toHaveBeenCalledOnce();
});

it("keeps tabs and primary actions outside the scrolling body, with settings and close accessible", async () => {
  const close = vi.fn(), settings = vi.fn(), createItem = vi.fn(), refresh = vi.fn();
  function Screen() {
    const [tab, setTab] = useState("users");
    return <ServerModuleScreen title="Usuarios" onBack={close} tabs={[{ key: "users", label: "Usuarios" }, { key: "groups", label: "Grupos" }]} activeTab={tab} onTabChange={setTab} onSettings={settings} onRefresh={refresh} action={{ label: "Crear", onPress: createItem }}><React.Fragment /></ServerModuleScreen>;
  }
  await act(async () => { tree = create(<Screen />); });
  const body = tree.root.findByProps({ testID: "native-module-content" });
  expect(body.findAllByProps({ accessibilityRole: "tab" })).toHaveLength(0);
  expect(body.findAllByType("Button" as any)).toHaveLength(0);
  const header = tree.root.findByProps({ testID: "native-module-header" });
  expect(header.findAllByProps({ accessibilityRole: "tab" })).toHaveLength(2);
  await act(async () => header.findByType("Button" as any).props.onPress());
  expect(createItem).toHaveBeenCalledOnce();
  await press("Grupos");
  expect(tree.root.findByProps({ accessibilityLabel: "Grupos", accessibilityRole: "tab" }).props.accessibilityState.selected).toBe(true);
  await press("Configuración"); await press("Actualizar"); await press("Cerrar");
  expect(settings).toHaveBeenCalledOnce();expect(refresh).toHaveBeenCalledOnce();expect(close).toHaveBeenCalledOnce();
  expect(mocks.dismiss).toHaveBeenCalled();
});

it("switches workspace sections from the header, keeps drafts, and disables dialogs in the hidden section", async () => {
  const closeDialog = vi.fn();
  function Draft() {
    const [value, setValue] = useState("");
    const context = useContext(NativeModuleContext);
    React.useEffect(() => { mocks.mounts(); }, []);
    return React.createElement("Draft", { value, setValue, visible: context?.visible });
  }
  function Screen() {
    const [selectedView, selectView] = useState("rules");
    return <NativeModuleContext.Provider value={{ key: "box:firewall", moduleId: "firewall", visible: true, insideModuleDrawer: true, selectedView, selectView }}>
      <ServerModuleScreen title="Firewall" onBack={() => {}}>
        <WorkspaceModuleSection views={["rules"]}><Draft /><ScopedNativeModal visible onRequestClose={closeDialog}><React.Fragment /></ScopedNativeModal></WorkspaceModuleSection>
        <WorkspaceModuleSection views={["fail2ban"]}><React.Fragment /></WorkspaceModuleSection>
      </ServerModuleScreen>
    </NativeModuleContext.Provider>;
  }
  await act(async () => { tree = create(<Screen />); });
  await act(async () => tree.root.findByType("Draft" as any).props.setValue("443"));
  expect(dismissNativeModuleDialog("box:firewall")).toBe(true);
  await press("Fail2ban");
  expect(tree.root.findByType("Draft" as any).props.visible).toBe(false);
  expect(dismissNativeModuleDialog("box:firewall")).toBe(false);
  await press("Reglas UFW");
  expect(tree.root.findByType("Draft" as any).props.value).toBe("443");
  expect(mocks.mounts).toHaveBeenCalledOnce();
});

it("opens module settings from the header and keeps their navigation separate from the body",async()=>{
 const close=vi.fn();
 await act(async()=>{tree=create(<NativeModuleContext.Provider value={{key:"box:backups",visible:true,insideWorkspace:true}}><ServerModuleScreen title="Copias" onBack={close} settingsPages={[{key:"local",label:"Local",content:React.createElement("LocalSettings")},{key:"cloud",label:"Nube",content:React.createElement("CloudSettings")}]}><React.Fragment/></ServerModuleScreen></NativeModuleContext.Provider>);});
 expect(tree.root.findAllByProps({testID:"module-settings-drawer"})).toHaveLength(0);
 await press("Configuración");
 expect(tree.root.findByProps({testID:"module-settings-columns"}).props.style.flexDirection).toBe("row");
 expect(tree.root.findAllByType("LocalSettings" as any)).toHaveLength(1);
 expect(tree.root.findAllByType("CloudSettings" as any)).toHaveLength(0);
 await press("Nube");
 expect(tree.root.findAllByType("CloudSettings" as any)).toHaveLength(1);
 await act(async()=>{expect(dismissNativeModuleDialog("box:backups")).toBe(true);});
 expect(close).not.toHaveBeenCalled();
 expect(dismissNativeModuleDialog("box:backups")).toBe(false);
});

it("keeps the users drawer mounted while its compact header switches tabs and opens settings", async () => {
  const close = vi.fn(), createItem = vi.fn(), plans = vi.fn();
  function Screen() {
    const [tab, setTab] = useState("users");
    return <NativeModuleContext.Provider value={{key:"box:users",panelId:"box",moduleId:"users",visible:true,insideModuleDrawer:true}}>
      <ServerModuleScreen title="Usuarios" onBack={close} showExtras={false} settingsPages={[{key:"table:users",label:"Usuarios",content:<React.Fragment/>}]}
        renderHeader={({onSettings,onClose,guarded})=><UsersModuleHeader tabs={[{key:"users",label:"Usuarios",count:10},{key:"groups",label:"Grupos",count:79}]} activeTab={tab} onTabChange={setTab} action={{label:tab==="users"?"Nuevo usuario":"Nuevo grupo",icon:React.createElement("Icon"),onPress:createItem}} onPlans={plans} onSettings={onSettings} onClose={onClose} guarded={guarded}/>}
      ><React.Fragment/></ServerModuleScreen>
    </NativeModuleContext.Provider>;
  }
  await act(async () => { tree = create(<Screen/>); });
  const buttons = () => tree.root.findByProps({testID:"users-module-header"}).findAllByType("Pressable" as any).filter(node=>node.props.accessibilityRole==="button").map(node=>node.props.accessibilityLabel);
  expect(tree.root.findAllByType("LiveDataStatus" as any)).toHaveLength(0);
  expect(buttons()).toEqual(["Cerrar","Nuevo usuario","Planes de hosting","Configuración"]);
  await press("Grupos");
  expect(buttons()).toEqual(["Cerrar","Planes de hosting","Nuevo grupo","Configuración"]);
  expect(tree.root.findAllByType("LiveDataStatus" as any)).toHaveLength(0);
  await press("Planes de hosting"); await press("Nuevo grupo");
  expect(plans).toHaveBeenCalledOnce(); expect(createItem).toHaveBeenCalledOnce();
  await press("Configuración");
  expect(tree.root.findAllByProps({testID:"users-module-header"})).toHaveLength(1);
  await act(async()=>{expect(dismissNativeModuleDialog("box:users")).toBe(true);});
  expect(close).not.toHaveBeenCalled();
  expect(tree.root.findByProps({accessibilityRole:"tab",accessibilityLabel:"Grupos"}).props.accessibilityState.selected).toBe(true);
});
