import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { getServerAssistantProviders } from "../api/client";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { ConversationsDrawer } from "./assistant/drawer/ConversationsDrawer";
import { strings } from "./assistant/strings";
import { ProjectsModal } from "./account/ProjectsModal";
import { chatStore } from "../features/assistant/chat-store";
import { chatController } from "../features/assistant/chat-controller";
import { useAssistantSession } from "../features/assistant/hooks";

/**
 * Cuerpo del tab "Chat" del drawer izquierdo. Mando a distancia del asistente
 * del panel VISIBLE (su chat vive en el `chat-store` module-level y se pinta en
 * la pantalla `Chat`): navegador de proyectos + conversaciones (abrir/crear/
 * borrar operan sobre el `chat-controller`).
 *
 * Los ajustes COMPLETOS del asistente ya NO viven aquí (antes tras un engranaje):
 * son el tab hermano "Settings" del drawer (`AssistantSettingsTab`). La elección
 * de "quién atiende" (proveedor/agente) vive en Settings → Proveedores y en el
 * picker de agentes, así que este tab solo lista conversaciones.
 */
export default function ServerChatTab({ panelId, token, language, onAfterNew }: {
  panelId: string;
  token: string;
  language?: string;
  /** Tras crear una conversación nueva: cierra el drawer para ver el chat vacío. */
  onAfterNew?: () => void;
}) {
  const t = strings(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const { providers, conversationId } = useAssistantSession(panelId);
  // Proyecto activo (compartido entre el árbol y la pantalla "Todos los proyectos").
  const [projectId, setProjectId] = useState("");
  const [projectsOpen, setProjectsOpen] = useState(false);

  // Asegura el token del controller (las operaciones de abrir/crear hilo lo
  // requieren) y siembra los proveedores si aún no se cargaron (p. ej. el
  // drawer se abre antes de que el SSH conecte y la portada sondee). Deja el
  // proveedor activo listo para el composer aunque ya no haya selector aquí.
  useEffect(() => {
    if (token && panelId) chatController.configure(panelId, { token });
  }, [panelId, token]);
  useEffect(() => {
    if (!token || !panelId || providers.length > 0) return;
    let cancelled = false;
    void getServerAssistantProviders(panelId, token).then((r) => {
      if (cancelled || !r) return;
      chatStore.patchSession(panelId, { providers: r.providers });
      const cur = chatStore.getSession(panelId).provider;
      chatController.setProvider(panelId, cur || r.activeProvider || r.providers[0] || "");
    });
    return () => { cancelled = true; };
  }, [panelId, token, providers.length]);

  return (
    <View style={styles.root}>
      <View style={styles.browser}>
        <View style={styles.browserBody}>
          <ConversationsDrawer
            fill
            panelId={panelId}
            token={token}
            t={t}
            tokens={tokens}
            activeId={conversationId}
            projectId={projectId}
            onProjectChange={setProjectId}
            onOpenAllProjects={() => setProjectsOpen(true)}
            onOpen={(id) => { chatController.openConversation(panelId, id); onAfterNew?.(); }}
            onNew={() => {
              // Chat nuevo "limpio": desliga cualquier agente custom elegido.
              chatStore.patchSession(panelId, { agentId: null, agentName: null });
              chatController.newConversation(panelId);
              onAfterNew?.();
            }}
            onNewInProject={(pid) => {
              // "+" de una carpeta de proyecto: el chat nuevo nace LIGADO a ese
              // proyecto (se incluye al crear la conversación en el backend).
              chatStore.patchSession(panelId, { agentId: null, agentName: null });
              chatController.newConversation(panelId, { projectId: pid });
              onAfterNew?.();
            }}
            onDeleted={(id) => { if (id === conversationId) chatController.newConversation(panelId); }}
            onPickAgent={(agent) => {
              // Clic en un agente: cambia al proveedor del agente, lo liga al chat
              // nuevo (banner violeta) y arranca una conversación fresca.
              chatController.newConversation(panelId);
              if (agent.providerId) chatController.setProvider(panelId, agent.providerId);
              chatStore.patchSession(panelId, { agentId: agent.id, agentName: agent.name ?? null });
              onAfterNew?.();
            }}
          />
        </View>
      </View>

      <ProjectsModal
        visible={projectsOpen}
        onClose={() => setProjectsOpen(false)}
        panelId={panelId}
        token={token}
        language={language}
        activeProjectId={projectId}
        onPick={(id) => setProjectId(id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Sin padding inferior: la barra fija del drawer (scope + nueva conversación +
  // buscador) ya gestiona su propio safe-area (`paddingBottom: 8 + insets.bottom`),
  // así que el padding de abajo solo desperdiciaba espacio. El contenido baja hasta
  // el borde inferior y se aprovecha toda la altura.
  root: { flex: 1, paddingHorizontal: 12, paddingTop: 12, gap: 12 },
  browser: { flex: 1, gap: 6 },
  browserBody: { flex: 1 },
});
