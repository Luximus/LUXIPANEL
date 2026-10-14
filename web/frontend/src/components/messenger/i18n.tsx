// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Messenger i18n — the `chat` namespace is passed from the Astro page (SSR
 * already deep-filled missing keys from the Spanish default). We keep a full
 * Spanish fallback here so the island still renders if a key is ever absent,
 * and expose a typed `useChatI18n()` hook.
 */
import { createContext, useContext, type ReactNode } from "react";
import { formatMessage } from "@/i18n/client";

export interface ChatMessages {
  pageTitle: string;
  newConversation: string;
  searchPlaceholder: string;
  emptyConversations: string;
  selectConversation: string;
  emptyThread: string;
  composerPlaceholder: string;
  send: string;
  attach: string;
  online: string;
  offline: string;
  you: string;
  loading: string;
  errorLoad: string;
  edited: string;
  deletedMessage: string;
  edit: string;
  delete: string;
  save: string;
  cancel: string;
  membersCount: string;
  sending: string;
  close: string;
  newChat: {
    title: string;
    tabDirect: string;
    tabGroup: string;
    tabCustom: string;
    directHint: string;
    groupHint: string;
    customName: string;
    customNamePlaceholder: string;
    customMembers: string;
    create: string;
    noUsers: string;
    noGroups: string;
    open: string;
    membersLabel: string;
  };
  badgeGroup: string;
  badgeLinuxGroup: string;
  /** Bloque B — never print a Linux username; this is the UI fallback. */
  unknownUser: string;
  sections: { latest: string; groups: string };
  pager: { prev: string; next: string };
  groups: { openChat: string; onlineCount: string; noMembers: string };
  header: { media: string; settings: string };
  /** Bloque F — audiollamadas (Tolqia). */
  call: {
    /** Header button, no call running. */
    action: string;
    /** Header button while a call is running — `{count}` participants. */
    inProgress: string;
    /** Sidebar row badge. */
    rowActive: string;
    /** Tooltip when the browser cannot take calls at all. */
    unsupported: string;
    starting: string;
    startError: string;
    incoming: string;
    incomingHint: string;
    accept: string;
    reject: string;
    connecting: string;
    ringing: string;
    ended: string;
    error: string;
    mute: string;
    unmute: string;
    hangUp: string;
    minimize: string;
    expand: string;
    captions: string;
    you: string;
    muted: string;
    speaking: string;
    /**
     * El plan de tolqia.com del servidor: badge en Ajustes › Llamadas y avisos
     * cuando Tolqia rechaza la traducción o el inicio de la llamada.
     */
    plan: {
      badge: string;
      linked: string;
      unknown: string;
      notConfigured: string;
      configure: string;
      limitTranslation: string;
      inactive: string;
      required: string;
      tokenInvalid: string;
      pricing: string;
      translationLimit: string;
      translationUnlimited: string;
    };
    /** The chip a finished call leaves in the thread. */
    system: { voice: string; missed: string; rejected: string; participants: string };
    /** The per-speaker history a finished call leaves behind. */
    transcript: {
      open: string;
      close: string;
      title: string;
      loading: string;
      empty: string;
      error: string;
      truncated: string;
      segments: string;
      original: string;
      translation: string;
      otherTranslations: string;
      allSpeakers: string;
      filterLabel: string;
      copy: string;
      copied: string;
    };
  };
  media: {
    title: string;
    viewerHint: string;
    selectFirst: string;
    empty: string;
    emptyTab: string;
    download: string;
    previous: string;
    next: string;
    close: string;
    sentBy: string;
    tabs: {
      images: string;
      videos: string;
      pdf: string;
      audio: string;
      documents: string;
      others: string;
    };
  };
  settings: {
    title: string;
    description: string;
    saved: string;
    saveError: string;
    tabs: { general: string; presence: string; calls: string; appearance: string; groups: string };
    general: {
      title: string;
      soundOnNewMessage: string;
      soundOnNewMessageHint: string;
      desktopNotifications: string;
      desktopNotificationsHint: string;
      desktopBlocked: string;
      previewInBell: string;
      previewInBellHint: string;
      enterSends: string;
      enterSendsHint: string;
    };
    presence: {
      title: string;
      showOnline: string;
      showOnlineHint: string;
      statusMessage: string;
      statusPlaceholder: string;
      statusHint: string;
    };
    calls: {
      title: string;
      hint: string;
      language: string;
      languageHint: string;
      translate: string;
      translateHint: string;
      provider: string;
      providerHint: string;
      providerAuto: string;
      providerElevenlabs: string;
      providerOpenai: string;
      micDefault: string;
      micOn: string;
      micMuted: string;
      ringtone: string;
      ringtoneDefault: string;
      ringtoneOff: string;
      dnd: string;
      dndHint: string;
    };
    appearance: {
      title: string;
      density: string;
      densityComfortable: string;
      densityCompact: string;
      fontSize: string;
      fontSm: string;
      fontMd: string;
      fontLg: string;
    };
    groups: {
      title: string;
      collapsedByDefault: string;
      collapsedByDefaultHint: string;
      latestPageSize: string;
      latestPageSizeHint: string;
    };
  };
}

export const CHAT_FALLBACK: ChatMessages = {
  pageTitle: "Mensajes",
  newConversation: "Nueva conversación",
  searchPlaceholder: "Buscar…",
  emptyConversations: "No tienes conversaciones todavía.",
  selectConversation: "Elige una conversación o empieza una nueva.",
  emptyThread: "Envía el primer mensaje.",
  composerPlaceholder: "Escribe un mensaje…",
  send: "Enviar",
  attach: "Adjuntar",
  online: "En línea",
  offline: "Desconectado",
  you: "Tú",
  loading: "Cargando…",
  errorLoad: "No se pudieron cargar los mensajes.",
  edited: "(editado)",
  deletedMessage: "Mensaje eliminado",
  edit: "Editar",
  delete: "Eliminar",
  save: "Guardar",
  cancel: "Cancelar",
  membersCount: "{count} miembros",
  sending: "Enviando…",
  close: "Cerrar",
  newChat: {
    title: "Nueva conversación",
    tabDirect: "Personas",
    tabGroup: "Grupos Linux",
    tabCustom: "Crear grupo",
    directHint: "Inicia un chat directo con un usuario del servidor.",
    groupHint: "Chats de los grupos de Linux a los que perteneces.",
    customName: "Nombre del grupo",
    customNamePlaceholder: "p. ej. Equipo de soporte",
    customMembers: "Miembros",
    create: "Crear",
    noUsers: "No hay otros usuarios en este servidor.",
    noGroups: "No perteneces a grupos con otros miembros.",
    open: "Abrir",
    membersLabel: "miembros",
  },
  badgeGroup: "Grupo",
  badgeLinuxGroup: "Grupo Linux",
  unknownUser: "Usuario",
  sections: { latest: "Últimas conversaciones", groups: "Grupos" },
  pager: { prev: "Página anterior", next: "Página siguiente" },
  groups: { openChat: "Abrir chat del grupo", onlineCount: "{online} en línea / {total}", noMembers: "Sin miembros" },
  header: { media: "Multimedia", settings: "Ajustes" },
  call: {
    action: "Llamar",
    inProgress: "Llamada en curso · {count} · Unirse",
    rowActive: "Llamada en curso",
    unsupported: "Este navegador no admite llamadas de audio.",
    starting: "Iniciando llamada…",
    startError: "No se pudo iniciar la llamada.",
    incoming: "Llamada entrante",
    incomingHint: "Audio con traducción en tiempo real",
    accept: "Aceptar",
    reject: "Rechazar",
    connecting: "Conectando…",
    ringing: "Llamando…",
    ended: "Llamada finalizada",
    error: "Error en la llamada",
    mute: "Silenciar micrófono",
    unmute: "Activar micrófono",
    hangUp: "Colgar",
    minimize: "Minimizar",
    expand: "Volver a la llamada",
    captions: "Subtítulos",
    you: "Tú",
    muted: "Silenciado",
    speaking: "Hablando",
    plan: {
      badge: "Plan {plan}",
      linked: "Conectado a Tolqia",
      unknown: "No se pudo consultar el plan de Tolqia",
      notConfigured:
        "Las llamadas con traducción requieren un token de Tolqia (Ajustes → Credenciales)",
      configure: "Ajustes → Credenciales",
      limitTranslation: "Tu plan Tolqia no permite traducción con {count} participantes",
      inactive: "Plan Tolqia inactivo",
      required: "Esta función requiere un plan Plus o Premium de Tolqia",
      tokenInvalid: "El token de Tolqia ya no es válido. Pide a un administrador que lo renueve.",
      pricing: "Ver planes",
      translationLimit: "Traducción hasta {count} participantes",
      translationUnlimited: "Traducción sin límite de participantes",
    },
    system: {
      voice: "Llamada de voz · {duration} · {count} participantes",
      missed: "Llamada perdida",
      rejected: "Llamada rechazada",
      participants: "{names}",
    },
    transcript: {
      open: "Ver transcripción",
      close: "Ocultar transcripción",
      title: "Transcripción de la llamada",
      loading: "Cargando transcripción...",
      empty: "Esta llamada no dejó transcripción.",
      error: "No se pudo cargar la transcripción.",
      truncated: "Transcripción recortada: solo se muestra el principio de la llamada.",
      segments: "{count} intervenciones",
      original: "Original",
      translation: "Traducción",
      otherTranslations: "Otras traducciones",
      allSpeakers: "Todos",
      filterLabel: "Filtrar por participante",
      copy: "Copiar",
      copied: "Copiado",
    },
  },
  media: {
    title: "Multimedia de la conversación",
    viewerHint: "Elige un archivo de la lista para verlo aquí.",
    selectFirst: "Abre una conversación para ver su multimedia.",
    empty: "Esta conversación no tiene archivos.",
    emptyTab: "No hay archivos de este tipo.",
    download: "Descargar",
    previous: "Anterior",
    next: "Siguiente",
    close: "Cerrar",
    sentBy: "Enviado por {name}",
    tabs: {
      images: "Imágenes",
      videos: "Vídeos",
      pdf: "PDF",
      audio: "Audio",
      documents: "Documentos",
      others: "Otros",
    },
  },
  settings: {
    title: "Ajustes de mensajería",
    description: "Sonidos, presencia, llamadas y apariencia del chat.",
    saved: "Ajustes guardados",
    saveError: "No se pudieron guardar los ajustes.",
    tabs: { general: "General", presence: "Presencia", calls: "Llamadas", appearance: "Apariencia", groups: "Grupos" },
    general: {
      title: "General",
      soundOnNewMessage: "Sonido al recibir un mensaje",
      soundOnNewMessageHint: "Un tono corto cuando llega un mensaje en otra conversación.",
      desktopNotifications: "Notificaciones de escritorio",
      desktopNotificationsHint: "Avisos del navegador cuando el panel no está visible.",
      desktopBlocked: "El navegador ha bloqueado las notificaciones para este sitio.",
      previewInBell: "Mostrar vista previa del mensaje",
      previewInBellHint: "Incluye el texto del mensaje en la campana y en el aviso.",
      enterSends: "Enter envía el mensaje",
      enterSendsHint: "Si se desactiva, envía con Ctrl/⌘ + Enter y Enter salta de línea.",
    },
    presence: {
      title: "Presencia",
      showOnline: "Mostrar cuándo estoy en línea",
      showOnlineHint: "Si se desactiva, los demás te verán siempre como desconectado.",
      statusMessage: "Mensaje de estado",
      statusPlaceholder: "p. ej. En una reunión",
      statusHint: "Máximo 80 caracteres. Se muestra junto a tu nombre.",
    },
    calls: {
      title: "Llamadas",
      hint: "Preferencias de las audiollamadas con traducción en tiempo real.",
      language: "Mi idioma",
      languageHint: "Oirás a los demás traducidos a este idioma.",
      translate: "Traducir en tiempo real",
      translateHint: "Traduce la voz de los demás mientras hablan.",
      provider: "Proveedor de traducción",
      providerHint: "Automático elige el mejor disponible en el servidor.",
      providerAuto: "Automático",
      providerElevenlabs: "ElevenLabs",
      providerOpenai: "OpenAI Realtime",
      micDefault: "Micrófono al entrar",
      micOn: "Activado",
      micMuted: "Silenciado",
      ringtone: "Tono de llamada",
      ringtoneDefault: "Predeterminado",
      ringtoneOff: "Sin tono",
      dnd: "No molestar",
      dndHint: "Rechaza las llamadas entrantes sin sonar.",
    },
    appearance: {
      title: "Apariencia",
      density: "Densidad",
      densityComfortable: "Cómoda",
      densityCompact: "Compacta",
      fontSize: "Tamaño del texto",
      fontSm: "Pequeño",
      fontMd: "Normal",
      fontLg: "Grande",
    },
    groups: {
      title: "Grupos",
      collapsedByDefault: "Grupos plegados al abrir",
      collapsedByDefaultHint: "La sección Grupos empieza cerrada.",
      latestPageSize: "Conversaciones por página",
      latestPageSizeHint: "Cuántas caben en «Últimas conversaciones» antes de paginar.",
    },
  },
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** Shallow+nested merge of a (possibly partial) namespace over the fallback. */
export function mergeChatMessages(input: unknown): ChatMessages {
  const src = (input ?? {}) as DeepPartial<ChatMessages>;
  const f = CHAT_FALLBACK;
  const settings = (src.settings ?? {}) as DeepPartial<ChatMessages["settings"]>;
  const media = (src.media ?? {}) as DeepPartial<ChatMessages["media"]>;
  const call = (src.call ?? {}) as DeepPartial<ChatMessages["call"]>;
  return {
    ...f,
    ...(src as Partial<ChatMessages>),
    newChat: { ...f.newChat, ...(src.newChat ?? {}) },
    sections: { ...f.sections, ...(src.sections ?? {}) },
    pager: { ...f.pager, ...(src.pager ?? {}) },
    groups: { ...f.groups, ...(src.groups ?? {}) },
    header: { ...f.header, ...(src.header ?? {}) },
    call: {
      ...f.call,
      ...call,
      plan: { ...f.call.plan, ...(call.plan ?? {}) },
      system: { ...f.call.system, ...(call.system ?? {}) },
      transcript: { ...f.call.transcript, ...(call.transcript ?? {}) },
    },
    media: {
      ...f.media,
      ...media,
      tabs: { ...f.media.tabs, ...(media.tabs ?? {}) },
    },
    settings: {
      ...f.settings,
      ...settings,
      tabs: { ...f.settings.tabs, ...(settings.tabs ?? {}) },
      general: { ...f.settings.general, ...(settings.general ?? {}) },
      presence: { ...f.settings.presence, ...(settings.presence ?? {}) },
      calls: { ...f.settings.calls, ...(settings.calls ?? {}) },
      appearance: { ...f.settings.appearance, ...(settings.appearance ?? {}) },
      groups: { ...f.settings.groups, ...(settings.groups ?? {}) },
    },
  } as ChatMessages;
}

/** `{key}` interpolation — alias of the canonical `formatMessage` (T-08). */
export const formatChatMessage = formatMessage;

const ChatI18nContext = createContext<ChatMessages>(CHAT_FALLBACK);

export function ChatI18nProvider({ value, children }: { value: ChatMessages; children: ReactNode }) {
  return <ChatI18nContext.Provider value={value}>{children}</ChatI18nContext.Provider>;
}

export function useChatI18n(): ChatMessages {
  return useContext(ChatI18nContext);
}
