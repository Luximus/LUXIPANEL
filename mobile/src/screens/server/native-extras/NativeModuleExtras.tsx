import { nativeText } from "../../../i18n/native-text";
import { NativeHostingProviders } from "../NativeHostingProviders";
import { useRegisterModuleSettingsPage } from "../../../components/server/module-settings-pages";
import React, { useState, useContext } from "react";
import { NativeModuleContext } from "../../main/native-module-visibility";
import { ScrollView, View } from "react-native";
import { ModuleSettingsDrawer, SettingsColumns, SettingsSectionBody } from "../../../components/ui/ModuleSettingsDrawer";
import { loadSessionState } from "../../../lib/session-state";
import { Button } from "../../../components/ui/Button";
import { NativeOperationCard } from "../NativeOperationCard";
import { NativeAccountSecurity } from "../settings/NativeAccountSecurity";
import { NativeFolderSnippets } from "../files/NativeFolderSnippets";
import { filesExtras } from "./files";
import { serviceExtras } from "./services";
import { administrationExtras } from "./administration";
import type { Group } from "./operations";
administrationExtras.settings.push(...filesExtras.filter(group => group.title === "Credenciales Git" || group.title === "Claves SSH para Git"));
export const nativeExtras: Record<string, Group[]> = { files: filesExtras, ...serviceExtras, ...administrationExtras };
function OperationGroup({ group, panelId, token, onSaved }: { group: Group; panelId: string; token: string; onSaved?:()=>void }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState(group.operations[0]?.title ?? "");
  const selected = group.operations.some(operation => operation.title === section) ? section : group.operations[0]?.title ?? "";
  const language = loadSessionState().language;
  return <View style={{ gap: 10 }}>
    <Button variant="secondary" label={nativeText(group.title)} onPress={() => setOpen(true)} />
    <ModuleSettingsDrawer visible={open} onClose={() => setOpen(false)} title={nativeText(group.title)} language={language}>
      <SettingsColumns language={language} value={selected} onChange={setSection} sections={group.operations.map(operation => ({ key: operation.title, label: nativeText(operation.title) }))}>
        {group.operations.map(operation => <SettingsSectionBody key={operation.title} active={selected === operation.title}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 14 }}>
            <NativeOperationCard embedded {...operation} panelId={panelId} token={token} onSaved={onSaved} />
          </ScrollView>
        </SettingsSectionBody>)}
      </SettingsColumns>
    </ModuleSettingsDrawer>
  </View>;
}
function RegisteredSettingsGroup({group,panelId,token,onSaved}:{group:Group;panelId:string;token:string;onSaved?:()=>void}) {
  useRegisterModuleSettingsPage({key:group.title,label:nativeText(group.title),content:group.title === "Proveedores de hosting" ? <NativeHostingProviders panelId={panelId} token={token} onSaved={onSaved}/> : <View style={{gap:18}}>{group.operations.map(operation=><View key={operation.title} style={{gap:8}}><NativeOperationCard embedded {...operation} panelId={panelId} token={token} onSaved={onSaved}/></View>)}</View>});
  return null;
}
export function NativeModuleExtras({ panelId, token, moduleId, onSaved }: { panelId: string; token: string; moduleId: string; onSaved?:()=>void }) {
  const context = useContext(NativeModuleContext);
  const view = context?.selectedView;
  const settingsGroups = (nativeExtras[moduleId] ?? []).filter(group => moduleId === "hosting" && group.title === "Proveedores de hosting");
  const groups = (moduleId === "webhooks" || moduleId === "obsidian" ? [] : nativeExtras[moduleId] ?? []).filter(group=>!settingsGroups.includes(group) && !(moduleId === "mail" && group.title === "Correo saliente del panel")).map(group => {
    if(moduleId === "repository-store") return {...group,operations:group.operations.filter(op=>["README de repositorio","Detalles de repositorio"].includes(op.title))};
    if(moduleId === "files" && group.title === "Preferencias y límites de archivos") return {...group,operations:group.operations.filter(op=>op.title !== "Preferencias del explorador" && op.title !== "Límites y respaldos de archivos")};
    if(moduleId === "firewall") group={...group,operations:group.operations.filter(op=>op.title !== "Nivel de registro del firewall")};
    if ((!context?.insideWorkspace && !context?.insideModuleDrawer) || !view) return group;
    if (moduleId === "webhooks") {
      const titles: Record<string,string> = {receive:"Recepción de datos",keys:"Claves API",discovered:"Webhooks detectados"};
      return group.title === titles[view] ? group : {...group,operations:[]};
    }
    if (moduleId === "firewall") return {...group,operations:group.operations.filter(op => {
      const path = typeof op.path === "string" ? op.path : "";
      return view === "audit" ? path.startsWith("/api/security-audit") || op.title.includes("informe de seguridad") : view === "fail2ban" ? path.includes("fail2ban") : !path.startsWith("/api/security-audit") && !path.includes("fail2ban") && !op.title.includes("informe de seguridad");
    })};
    if (moduleId === "mail") return {...group,operations:group.operations.filter(op => {
      const path = typeof op.path === "string" ? op.path : "";
      return view === "track-delivery" ? path.includes("track-delivery") : view === "spam-filters" ? path.includes("spam-filters") : view === "global-filters" ? path.includes("global-filters") : !path.includes("track-delivery") && !path.includes("spam-filters") && !path.includes("global-filters");
    })};
    return group;
  }).filter(group => group.operations.length);
  return <>{settingsGroups.map(group=><RegisteredSettingsGroup key={group.title} group={group} panelId={panelId} token={token} onSaved={onSaved}/>)}{moduleId === "settings" && <NativeAccountSecurity panelId={panelId} />}{moduleId === "files" && <NativeFolderSnippets panelId={panelId} token={token} />}{groups.map(group => <OperationGroup key={group.title} group={group} panelId={panelId} token={token} onSaved={onSaved} />)}</>;
}
