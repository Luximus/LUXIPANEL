import type { AssistantStrings } from "./types";

// i18n mínima inline (es/en + fallback es) — el módulo completo se localizará en
// panelTable.ts cuando se estabilice la feature.
const STRINGS: Record<string, AssistantStrings> = {
  es: {
    title: "Asistente del servidor", placeholder: "Pregunta sobre este servidor…", send: "Enviar",
    stop: "Detener", thinking: "Pensando…",
    empty: "Pregúntame por CPU, servicios, logs… o pide ejecutar una acción.",
    examples: [
      "¿Cómo va la RAM ahora?",
      "Muéstrame la carga de CPU",
      "¿nginx responde bien?",
      "Reinicia el servicio backend",
      "¿Hay logins SSH fallidos?",
    ],
    unavailable: "Asistente no disponible para este servidor todavía.", error: "No se pudo conectar con el asistente.",
    attach: "Adjuntar archivo", collapse: "Colapsar", expand: "Expandir", provider: "Proveedor",
    providersView: "Proveedores", backToChat: "Volver al chat", you: "Tú",
    history: "Conversaciones", newChat: "Nueva conversación",
    searchConversations: "Buscar conversaciones…", deleteConversation: "Borrar conversación",
    allProjects: "Todos los proyectos", projectsTitle: "Proyectos", looseChats: "Chats sueltos", subProjects: "Subproyectos", noConversations: "Sin conversaciones",
    responding: "respondiendo…", jumpLatest: "Ir al final",
    copy: "Copiar", copied: "Copiado",
    durationTitle: "Tiempo en responder", tokensTitle: "Tokens de esta consulta",
    unavailCreds: "Conecta este servidor (configura su llave SSH) para usar el asistente.",
    unavailFingerprint: "Aprueba la huella SSH del servidor para habilitar el asistente.",
    unavailUnreachable: "No se pudo conectar por SSH con el servidor. Verifica que esté en línea.",
    unavailGeneric: "Asistente no disponible para este servidor todavía.",
    noData: "Sin datos disponibles. Recarga para usar el asistente del servidor.",
    approveFp: "Aprobar huella",
    approving: "Aprobando…",
    refresh: "Refrescar estado",
    refreshing: "Refrescando…",
    justNow: "ahora",
  },
  en: {
    title: "Server assistant", placeholder: "Ask about this server…", send: "Send",
    stop: "Stop", thinking: "Thinking…",
    empty: "Ask me about CPU, services, logs… or request an action.",
    examples: [
      "How's the RAM right now?",
      "Show me the CPU load",
      "Is nginx responding well?",
      "Restart the backend service",
      "Any failed SSH logins?",
    ],
    unavailable: "Assistant not available for this server yet.", error: "Couldn't reach the assistant.",
    attach: "Attach file", collapse: "Collapse", expand: "Expand", provider: "Provider",
    providersView: "Providers", backToChat: "Back to chat", you: "You",
    history: "Conversations", newChat: "New conversation",
    searchConversations: "Search conversations…", deleteConversation: "Delete conversation",
    allProjects: "All projects", projectsTitle: "Projects", looseChats: "Loose chats", subProjects: "Subprojects", noConversations: "No conversations",
    responding: "responding…", jumpLatest: "Jump to latest",
    copy: "Copy", copied: "Copied",
    durationTitle: "Time to respond", tokensTitle: "Tokens for this query",
    unavailCreds: "Connect this server (configure its SSH key) to use the assistant.",
    unavailFingerprint: "Approve the server's SSH fingerprint to enable the assistant.",
    unavailUnreachable: "Couldn't reach the server over SSH. Check it's online.",
    unavailGeneric: "Assistant not available for this server yet.",
    noData: "No data left. Recharge to use the server assistant.",
    approveFp: "Approve fingerprint",
    approving: "Approving…",
    refresh: "Refresh status",
    refreshing: "Refreshing…",
    justNow: "now",
  },
};

export function strings(language?: string): AssistantStrings {
  return STRINGS[(language ?? "es").slice(0, 2)] ?? STRINGS.es;
}
