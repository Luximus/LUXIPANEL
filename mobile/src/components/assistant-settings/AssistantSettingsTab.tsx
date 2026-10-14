import React, { useState } from "react";
import { Text, View } from "react-native";
import { Bot, SlidersHorizontal, Plug, Boxes, ChartNoAxesCombined, Server, ShieldCheck } from "lucide-react-native";
import { getMessages } from "../../i18n";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { SettingsColumns, SettingsSectionBody } from "../ui/ModuleSettingsDrawer";
import { ServerAssistantProviders } from "../ServerAssistantProviders";
import { strings as assistantStrings } from "../assistant/strings";
import { chatStore } from "../../features/assistant/chat-store";
import { chatController } from "../../features/assistant/chat-controller";
import { s } from "./styles";
import { AgentsModule } from "./agents/AgentsModule";
import { DashboardSubTab } from "./DashboardSubTab";
import { AccessSubTab } from "./AccessSubTab";
import { GeneralSubTab } from "./GeneralSubTab";
import { ModulesSubTab } from "./ModulesSubTab";
import { ServersSubTab } from "./ServersSubTab";
import { AutoRoutingSettings } from "./AutoRoutingSettings";
import { TranslationSettings } from "./TranslationSettings";
import { VoiceSettings } from "./VoiceSettings";
import { NotifySettings } from "./NotifySettings";
import { SkillsSettings } from "./SkillsSettings";

// Navigation follows the current AssistantSettingsModal SECTION_ORDER.
type SettingsSubTab = "general" | "agents" | "providers" | "modules" | "stats" | "servers" | "access";

/**
 * Tab "Ajustes del asistente". Réplica nativa del AssistantSettingsModal de
 * LUXIPANEL: 6 secciones (General · Agentes · Proveedores · Módulos ·
 * Estadísticas · Accesos), todas contra `/api/ai/*` por el túnel
 * SSO del panel activo (`panelId`). Sin un panel activo, muestra un placeholder.
 */
export function AssistantSettingsTab({
  panelId,
  token,
  language,
  onCloseDrawer,
  onOpenChat,
}: {
  panelId: string | null | undefined;
  token: string;
  language: string;
  /** Cierra el drawer tras "Iniciar chat" con un agente — mismo mecanismo que
   *  `onPickAgent` del drawer izquierdo (`ServerChatTab` → `onAfterNew`). */
  onCloseDrawer?: () => void;
  /** Abre la pantalla `Chat` del panel (fase A5: el chat ya no vive en el
   *  carousel; sin navegar, el agente lanzado quedaría fuera de la vista). */
  onOpenChat?: (panelId: string) => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const t = getMessages(language).assistantSettings;
  const [sub, setSub] = useState<SettingsSubTab>("general");
  // Same vertical navigation/content split as the web settings drawer.
  const sections: { value: SettingsSubTab; label: string }[] = [
    { value: "general", label: t.tabGeneral },
    { value: "agents", label: t.tabAgents },
    { value: "providers", label: t.tabProviders },
    { value: "modules", label: t.tabModules },
    { value: "stats", label: t.tabStats },
    { value: "access", label: t.tabAccess },
  ];

  if (!panelId || !token) {
    return (
      <View style={[s.root, { padding: 14 }]}>
        <View style={s.center}>
          <View style={[s.iconBox, { backgroundColor: tokens.brandDim, width: 44, height: 44 }]}>
            <Bot size={22} color={tokens.brand} />
          </View>
          <Text style={[s.centerText, { color: tokens.textMuted }]}>{t.noServer}</Text>
        </View>
      </View>
    );
  }

  const icons = [SlidersHorizontal, Bot, Plug, Boxes, ChartNoAxesCombined, ShieldCheck];
  return (
    <SettingsColumns language={language} value={sub} onChange={key => setSub(key as SettingsSubTab)} sections={sections.map((section, index) => {
      const Icon = icons[index];
      return { key: section.value, label: section.label, icon: <Icon size={20} color={tokens.textMuted} /> };
    })}>
        <SettingsSectionBody active={sub === "general"}>
          <GeneralSubTab panelId={panelId} token={token} t={t} tokens={tokens} />
        </SettingsSectionBody>
        <SettingsSectionBody active={sub === "agents"}>
          <AgentsModule
            panelId={panelId}
            token={token}
            language={language}
            t={t}
            tokens={tokens}
            onLaunchAgent={(agent) => {
              // Ligar el agente al chat NUEVO y arrancarlo, luego cerrar el
              // drawer y navegar a la pantalla del chat (fase A5).
              chatController.newConversation(panelId);
              if (agent.providerId) chatController.setProvider(panelId, agent.providerId);
              chatStore.patchSession(panelId, { agentId: agent.id, agentName: agent.name ?? null });
              onCloseDrawer?.();
              onOpenChat?.(panelId);
            }}
          />
        </SettingsSectionBody>
        <SettingsSectionBody active={sub === "providers"}>
          <ServerAssistantProviders
            panelId={panelId}
            token={token}
            t={assistantStrings(language)}
            tokens={tokens}
            onProvidersChanged={() => {}}
            // Vista "Todos" (paridad ProvidersTab.tsx:205-215): bloques globales
            // ARRIBA de las tarjetas de proveedor, en el mismo orden que la web.
            topSections={
              <>
                <AutoRoutingSettings panelId={panelId} token={token} t={t} tokens={tokens} />
                <TranslationSettings panelId={panelId} token={token} t={t} tokens={tokens} />
                <VoiceSettings panelId={panelId} token={token} t={t} tokens={tokens} />
                <NotifySettings panelId={panelId} token={token} t={t} tokens={tokens} />
                <SkillsSettings panelId={panelId} token={token} t={t} tokens={tokens} />
              </>
            }
          />
        </SettingsSectionBody>
        <SettingsSectionBody active={sub === "modules"}>
          <ModulesSubTab panelId={panelId} token={token} t={t} tokens={tokens} />
        </SettingsSectionBody>
        <SettingsSectionBody active={sub === "stats"}>
          <DashboardSubTab panelId={panelId} token={token} t={t} tokens={tokens} />
        </SettingsSectionBody>
        <SettingsSectionBody active={sub === "servers"}>
          <ServersSubTab panelId={panelId} token={token} t={t} tokens={tokens} />
        </SettingsSectionBody>
        <SettingsSectionBody active={sub === "access"}>
          <AccessSubTab panelId={panelId} token={token} t={t} tokens={tokens} />
        </SettingsSectionBody>
    </SettingsColumns>
  );
}

export default AssistantSettingsTab;
