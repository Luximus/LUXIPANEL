// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tipos de PRESENTACIÓN del asistente IA (fase A3 de la re-arquitectura).
 *
 * `AssistantStrings` es el diccionario i18n plano que consumen los componentes
 * presentacionales del chat/drawer (prop `t`). Es la unión de los message files
 * `assistantChat` + `assistantDrawer` (ver `strings()` en ServerAssistantPane,
 * adapter @deprecated que morirá con el pane en A5). Movido 1:1 desde
 * `components/ServerAssistantPane.tsx`; el pane lo re-exporta para
 * compatibilidad con los consumidores actuales.
 */

export type AssistantStrings = {
  title: string; responding: string; placeholder: string; empty: string;
  /** Frases de ejemplo que rotan con efecto typewriter en el estado vacío. */
  examples: string[];
  /** Chips de respuesta rápida (botones de inicio) del chat iniciado sin mensajes. */
  quickReplies: string[];
  /** Estado vacío estilo "puntos de partida" (paridad web ChatPane). */
  newConversationTitle?: string; startPointsDescription?: string;
  welcomeTitle?: string; newProjectConversationTitle?: string;
  chatWith?: string; typeMessageHint?: string;
  unavailable: string; error: string; you: string;
  /** Adjunto descartado al prepararlo (límites del gateway LP). */
  attachTooLarge: string; attachTooMany: string;
  newChat: string; history: string; providersBtn: string; collapse: string; expand: string;
  /** Copys del tab "Chat" del drawer izquierdo. */
  projectsChats: string;
  projectsSection: string; recentChats: string;
  /** Pantalla "Todos los proyectos". */
  allProjectsEntry: string; searchProjects: string; newProject: string; noProjects: string; projectName: string; deleteProject: string;
  createdByYou: string; sharedWithYou: string;
  search: string; allProjects: string; noConversations: string; deleteConv: string; live: string; justNow: string;
  thinking: string; stop: string; send: string; attach: string; copy: string; copied: string;
  noData: string; unavailCreds: string; unavailFingerprint: string; unavailUnreachable: string; unavailGeneric: string;
  approveFp: string; approving: string; refresh: string; refreshing: string;
  loadingConfig: string; configError: string; showInChat: string;
  modeApi: string; modeCli: string; model: string; otherModel: string; customModel: string;
  apiKey: string; keyPlaceholder: string; keyReplace: string;
  save: string; test: string; testing: string;
  cliInstalled: string; cliNotInstalled: string; cliSession: string; cliNoSession: string;
  providerDesc: Record<string, string>;
  /** Toggles de burbuja por proveedor (presentación en el chat). Opcionales con
   *  fallback inline; paridad con BubbleToggle del ProvidersTab web. */
  bubbleInput?: string; bubbleTerminal?: string; bubbleTerminalHint?: string; bubbleModifiedHint?: string;
  /** Panel CLI (estado gestionado + Subscription Key de MiniMax + nota MCP). */
  cliManaged?: string; subscriptionKey?: string; subscriptionKeyPlaceholder?: string;
  subscriptionKeyHint?: string; mcpNote?: string;
  /** Portada del pane (antes de iniciar el chat). Opcionales: si faltan, el
   *  componente cae a un texto por defecto. */
  enterPanel?: string; startConversation?: string;
  /** Botones extra de la portada. Opcionales: si faltan, caen a texto por defecto. */
  newServerConnection?: string; registerSshKey?: string; newTerminal?: string;
  /** Favorito + IP enmascarada (portada). */
  favoriteAdd?: string; favoriteRemove?: string; showIp?: string; hideIp?: string;
  /** Botón "usuarios conectados" junto a la IP (portada) + cabecera/vacío del tooltip. */
  connectedUsers?: string; connectedUsersTitle?: string; connectedUsersEmpty?: string;
  /** Nota pequeña que explica para qué sirve aprobar la huella SSH (portada). */
  fingerprintNote?: string;
  // ── Fase 1: bloques por turno (permiso / ask / archivos / estados / quick) ──
  // Todas OPCIONALES con fallback español inline; la Fase F7 las traduce y
  // propaga al resto de locales. Definidas en español en el objeto `es`.
  /** Gate de permisos. */
  permNeedsApproval?: string; permToolLabel?: string; permApprove?: string;
  permApproveAlways?: string; permDeny?: string; permRequestedPrefix?: string;
  /** Preguntas interactivas (ask). */
  askNeedsDecision?: string; askAnswerPlaceholder?: string; askOtherPlaceholder?: string;
  askRespond?: string; askSending?: string; askedQuestionOne?: string; askNone?: string;
  /** Archivos modificados. */
  modifiedFiles?: string; deletedLabel?: string;
  /** Inputs de herramienta. */
  toolParams?: string;
  /** Estados del turno. */
  workingBackground?: string; connectionInterrupted?: string; processStopped?: string;
  shownUntranslated?: string; statusWorking?: string; statusTranslating?: string;
  errorTitle?: string; retry?: string; startNewChat?: string;
  /** Editar/reenviar el último mensaje de usuario (acción de burbuja). */
  editResend?: string;
  /** Quick-replies por turno. */
  quickRewrite?: string; quickRewritePrompt?: string;
  quickSummarize?: string; quickSummarizePrompt?: string;
  quickContinue?: string; quickContinuePrompt?: string;
  quickRetry?: string; quickRetryPrompt?: string;
  /** Compactación. */
  conversationCompacted?: string;
  /** Banner de agente custom. */
  agentBadge?: string;
  // ── Tanda 3: cabecera de conversación + USO CLI + consola/historial ──
  // Todas OPCIONALES con fallback español inline. Paridad con el chat pane del
  // panel (AgentInfoChips / CliUsageBars / ToolDisclosure).
  /** Quick-reply "Revisar" (5º chip, paridad con el panel). */
  quickReview?: string; quickReviewPrompt?: string;
  /** Barra "USO CLI" (CliUsageBars): cabecera, filas y fuentes. Interpolan
   *  {provider} / {hours} / {time} / {day}. */
  cliUsage?: string; usageSession5h?: string; usageWeek?: string; usageSessionHours?: string;
  usageSourceReal?: string; usageSourceEstimated?: string; usageSourceTokens?: string;
  usageUnavailable?: string; usageRetry?: string; usageResetSameDay?: string; usageResetOtherDay?: string;
  /** Bloque consola CLI / enlace a historial (ToolDisclosure de la web). */
  serverConsole?: string; viewHistory?: string;
  /** Pill de scope de la conversación en la cabecera (chat fuera de proyecto). */
  chatLooseScope?: string;
  /** Pill "Volver al chat del líder" (chat activo = worker delegado). */
  backToLeader?: string;
  /** Botón "Compactar" del cluster derecho de la cabecera + estado en curso. */
  compact?: string; compacting?: string;
  // ── Fase 3: drawer izquierdo (proyectos / agentes / filas de conversación) ──
  // Todas OPCIONALES con fallback español inline; F7 las traduce al resto de
  // locales. Definidas en español en el objeto `es`.
  /** Sección Agentes del drawer. */
  agentsHeading?: string; agentsEmpty?: string;
  /** Sección "Sin revisar" (chats terminados sin abrir). */
  unreviewedHeading?: string;
  /** Paginador de proyectos / subproyectos. */
  pagerPrev?: string; pagerNext?: string;
  /** "Cargar más conversaciones". */
  loadMore?: string; loadingMore?: string;
  /** Acciones de la fila (hover/press). */
  renameAction?: string; deleteAction?: string; pinAction?: string; unpinAction?: string;
  /** Indicadores de la fila (accesibilidad/tooltip). */
  approvalPending?: string; newUnseenReply?: string;
  /** Chats fuera de cualquier proyecto. */
  looseChats?: string;
  /** Tabs de scope del drawer (Agentes IA / Sueltos·Proyectos) + estado vacío. */
  chatsWithAgents?: string; chatsLoose?: string; agentsConvEmpty?: string;
};
