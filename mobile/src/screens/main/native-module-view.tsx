import { useLanguage } from "../../hooks/useLanguage";
import React, { useContext, useMemo } from "react";
import { NativeModuleContext } from "./native-module-visibility";
import { ModuleUiContext } from "../../components/ui/ModuleUi";
import {NativeMessagingScreen} from "../server/NativeMessagingScreen";
import {NativePreferencesScreen} from "../server/NativePreferencesScreen";
import { UsersScreen } from "../server/users/UsersScreen";
import { MonitorScreen } from "../server/monitor/MonitorScreen";
import { FilesScreen } from "../server/files/FilesScreen";
import { ServerAlertsScreen } from "../server/alerts/ServerAlertsScreen";
import { CronScreen } from "../server/cron/CronScreen";
import { ExpoScreen } from "../server/expo/ExpoScreen";
import { ObsidianScreen } from "../server/obsidian/ObsidianScreen";
import { MailScreen } from "../server/mail/MailScreen";
import { ModulesViewScreen } from "../server/modules/ModulesViewScreen";
import { SettingsViewScreen } from "../server/settings/SettingsViewScreen";
import { NativeAssistantWorkspace } from "../server/NativeAssistantWorkspace";
import { NativeTerminalScreen } from "../server/NativeTerminalScreen";
import { NativeProjectExplorerScreen } from "../server/NativeProjectExplorerScreen";
import { NativeFirewallScreen } from "../server/NativeFirewallScreen";
import { NativeBackupsScreen } from "../server/NativeBackupsScreen";
import { NativeDatabasesScreen } from "../server/NativeDatabasesScreen";
import { NativeCloudflareScreen } from "../server/NativeCloudflareScreen";
import { NativeWebhooksScreen } from "../server/NativeWebhooksScreen";
import { NativeNginxScreen } from "../server/NativeNginxScreen";
import { NativeBitNinjaScreen } from "../server/NativeBitNinjaScreen";
import { NativeOpenClawScreen } from "../server/NativeOpenClawScreen";
import { NativeCodebaseGraphScreen } from "../server/NativeCodebaseGraphScreen";
import { NativeRepositoryStoreScreen } from "../server/NativeRepositoryStoreScreen";
import { NativeHostingScreen } from "../server/NativeHostingScreen";
import { NativeModuleDevScreen } from "../server/NativeModuleDevScreen";

/**
 * Render-map del módulo NATIVO dentro de su drawer persistente lateral.
 * Extraído del `switch` inline de `MainScreen` (fase de refactor
 * >500 líneas): mapeo PURO `moduleId → pantalla`. No toca estado de sesión — solo
 * recibe los ids/callback y monta la screen correspondiente.
 */
function NativeModuleContent({
  moduleId,
  panelId,
  token,
  onBack,
}: {
  moduleId: string;
  panelId: string;
  token: string;
  onBack: () => void;
}) {
  const p = { panelId, token, onBack };
  switch (moduleId) {
    case "chat": return <NativeMessagingScreen {...p}/>;
    case "preferences": return <NativePreferencesScreen {...p}/>;
    case "assistant": return <NativeAssistantWorkspace {...p} />;
    case "terminal": return <NativeTerminalScreen {...p} />;
    case "users": return <UsersScreen {...p} />;
    case "monitor": return <MonitorScreen {...p} />;
    case "files": return <FilesScreen {...p} />;
    case "server-alerts": return <ServerAlertsScreen {...p} />;
    case "cron": return <CronScreen {...p} />;
    case "expo": return <ExpoScreen {...p} />;
    case "obsidian": return <ObsidianScreen {...p} />;
    case "mail": return <MailScreen {...p} />;
    case "modules": return <ModulesViewScreen {...p} />;
    case "settings": return <SettingsViewScreen {...p} />;
    case "project-map": return <NativeProjectExplorerScreen {...p} />;
    case "firewall": return <NativeFirewallScreen {...p} />;
    case "backups": return <NativeBackupsScreen {...p} />;
    case "databases": return <NativeDatabasesScreen {...p} />;
    case "cloudflare": return <NativeCloudflareScreen {...p} />;
    case "webhooks": return <NativeWebhooksScreen {...p} />;
    case "dns": return <NativeNginxScreen {...p} />;
    case "bitninja": return <NativeBitNinjaScreen {...p} />;
    case "openclaw": return <NativeOpenClawScreen {...p} />;
    case "codebase-graph": return <NativeCodebaseGraphScreen {...p} />;
    case "repository-store": return <NativeRepositoryStoreScreen {...p} />;
    case "hosting": return <NativeHostingScreen {...p} />;
    case "module-dev": return <NativeModuleDevScreen {...p} />;
    default: return null;
  }
}

export function NativeModuleView(props: { moduleId: string; panelId: string; token: string; onBack: () => void }) {
  const language = useLanguage();
  const parent = useContext(NativeModuleContext);
  const context = useMemo(() => ({ ...parent, key: parent?.key ?? `${props.panelId}:${props.moduleId}`, visible: parent?.visible ?? true, panelId: props.panelId, token: props.token, moduleId: props.moduleId }), [parent, props.panelId, props.token, props.moduleId, language]);
  return <ModuleUiContext.Provider value={true}><NativeModuleContext.Provider value={context}><NativeModuleContent {...props} /></NativeModuleContext.Provider></ModuleUiContext.Provider>;
}
