// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
//
// Textos del chat del asistente IA (burbujas, composer/portada, permisos,
// herramientas, cabecera y barra USO CLI), extraídos del antiguo objeto STR
// de ServerAssistantPane.tsx. Las claves del drawer viven en otro archivo.
import type { Widen } from "../../_shared";

export const es = {
  // ── Cabecera / estado general ──
  title: "Asistente del servidor",
  responding: "respondiendo…",
  placeholder: "Pregunta sobre este servidor…",
  empty: "Pregúntame por CPU, servicios, logs… o pide ejecutar una acción.",
  // Frases de ejemplo que rotan con efecto typewriter en el estado vacío.
  examples: [
    "¿Cuántos proyectos de GitHub hay en el servidor?",
    "¿Qué puertos están en uso ahora mismo?",
    "¿Qué nivel de seguridad tiene mi servidor?",
    "¿Qué procesos está ejecutando el servidor?",
    "Dame un resumen de quién ha accedido al servidor",
    "Resúmeme el uso del servidor: CPU, RAM y disco",
  ],
  // Chips de respuesta rápida (botones de inicio) del chat sin mensajes.
  quickReplies: ["Empezar sitio web, base de datos para videojuego", "Empezar APP tipo Uber"],
  // Estado vacío estilo "puntos de partida" (paridad web ChatPane).
  newConversationTitle: "Nueva conversación · {provider}",
  startPointsDescription: "Elige un punto de partida o escribe tu propia pregunta abajo.",
  welcomeTitle: "Hola, soy tu asistente de servidor.",
  newProjectConversationTitle: "Nueva conversación en {project}",
  chatWith: "Chat con {name}",
  typeMessageHint: "Escribe tu mensaje abajo.",
  unavailable: "Asistente no disponible para este servidor todavía.",
  error: "No se pudo conectar con el asistente.",
  attachTooLarge: "Archivo demasiado grande: el límite es 6 MB por adjunto.",
  attachTooMany: "Máximo 4 archivos adjuntos por mensaje.",
  you: "Tú",
  providersBtn: "Proveedores",
  collapse: "Colapsar",
  expand: "Expandir",

  // ── Composer / acciones básicas ──
  thinking: "Pensando…",
  stop: "Detener",
  send: "Enviar",
  attach: "Adjuntar archivo",
  copy: "Copiar",
  copied: "Copiado",

  // ── Disponibilidad del asistente ──
  noData: "Sin datos disponibles. Recarga para usar el asistente del servidor.",
  unavailCreds: "Conecta este servidor (configura su llave SSH) para usar el asistente.",
  unavailFingerprint: "Aprueba la huella SSH del servidor para habilitar el asistente.",
  unavailUnreachable: "No se pudo conectar por SSH con el servidor. Verifica que esté en línea.",
  unavailGeneric: "Asistente no disponible para este servidor todavía.",
  approveFp: "Aprobar huella",
  approving: "Aprobando…",
  refresh: "Refrescar estado",
  refreshing: "Refrescando…",

  // ── Configuración de proveedores ──
  loadingConfig: "Cargando configuración…",
  configError: "No se pudo cargar la configuración del asistente.",
  showInChat: "Mostrar en chat",
  modeApi: "API",
  modeCli: "CLI",
  model: "Modelo",
  otherModel: "Otro modelo…",
  customModel: "nombre-del-modelo",
  apiKey: "API key",
  keyPlaceholder: "Pega tu API key",
  keyReplace: "Reemplazar la key guardada",
  save: "Guardar",
  test: "Probar",
  testing: "Probando…",
  cliInstalled: "CLI instalado",
  cliNotInstalled: "CLI no instalado",
  cliSession: "Sesión iniciada",
  cliNoSession: "Sin sesión",
  // Descripción corta de cada proveedor (tarjeta del selector).
  providerDesc: {
    claude: "Modo agente nativo con tool_use.",
    codex: "Function calling vía OpenAI o CLI @openai/codex.",
    gemini: "Function declarations vía Generative Language API.",
    deepseek: "OpenAI-compatible. Modo CLI próximamente.",
    minimax: "Anthropic-compatible por API · CLI mmx.",
  },
  // Toggles de burbuja por proveedor (presentación en el chat).
  bubbleInput: "Ver entrada",
  bubbleTerminal: "Terminal en vivo",
  bubbleTerminalHint: "Muestra la consola del CLI en vivo; si está apagado, el turno corre en segundo plano y solo se ve el resultado final.",
  bubbleModifiedHint: "Muestra la lista de archivos creados/editados/eliminados bajo cada respuesta.",
  // Panel CLI (estado gestionado + Subscription Key de MiniMax + nota MCP).
  cliManaged: "Estado gestionado por el panel.",
  subscriptionKey: "Subscription Key (sk-cp)",
  subscriptionKeyPlaceholder: "Pega tu Subscription Key (sk-cp-…)",
  subscriptionKeyHint: "Se escribe en el servidor al ejecutar el siguiente turno del CLI.",
  mcpNote: "Servidores MCP: gestiónalos desde el panel web.",

  // ── Portada del pane (antes de iniciar el chat) ──
  enterPanel: "Utilizar más herramientas",
  startConversation: "Empezar conversación",
  newServerConnection: "Registrar nuevo servidor",
  registerSshKey: "Registrar llave SSH",
  newTerminal: "Nueva terminal",
  favoriteAdd: "Marcar favorito",
  favoriteRemove: "Quitar favorito",
  showIp: "Mostrar IP",
  hideIp: "Ocultar IP",
  connectedUsers: "Usuarios conectados",
  connectedUsersTitle: "Usuarios conectados",
  connectedUsersEmpty: "Nadie conectado ahora mismo",
  fingerprintNote: "Primera conexión con este servidor: aprueba su huella SSH para verificar su identidad antes de habilitar el asistente y las herramientas.",

  // ── Gate de permisos ──
  permNeedsApproval: "El asistente necesita tu permiso para continuar",
  permToolLabel: "Herramienta:",
  permApprove: "Aprobar",
  permApproveAlways: "Aprobar y no preguntar más",
  permDeny: "Rechazar",
  permRequestedPrefix: "El asistente pidió permiso para:",

  // ── Preguntas interactivas (ask) ──
  askNeedsDecision: "El asistente necesita tu decisión para continuar",
  askAnswerPlaceholder: "Escribe tu respuesta…",
  askOtherPlaceholder: "Otra respuesta…",
  askRespond: "Responder",
  askSending: "Enviando…",
  askedQuestionOne: "El asistente hizo una pregunta",
  askNone: "(ninguno)",

  // ── Archivos modificados / inputs de herramienta ──
  modifiedFiles: "Archivos modificados",
  deletedLabel: "eliminado",
  toolParams: "Parámetros",

  // ── Estados del turno ──
  workingBackground: "Trabajando en segundo plano…",
  connectionInterrupted: "Conexión interrumpida — la tarea sigue en el servidor; reanudando al volver…",
  processStopped: "Proceso parado.",
  shownUntranslated: "Mostrado sin traducir — la traducción no se pudo realizar",
  statusWorking: "Trabajando…",
  statusTranslating: "Traduciendo…",
  errorTitle: "No se pudo completar la respuesta",
  retry: "Reintentar",
  startNewChat: "Empezar nuevo chat",
  // Editar/reenviar el último mensaje de usuario (acción de burbuja).
  editResend: "Editar",

  // ── Quick-replies por turno ──
  quickRewrite: "Reescribe",
  quickRewritePrompt: "Reescribe tu respuesta anterior de otra forma, más clara y mejor estructurada.",
  quickSummarize: "Resúmelo",
  quickSummarizePrompt: "Resume tu respuesta anterior en 3 puntos clave.",
  quickContinue: "Continúa",
  quickContinuePrompt: "Continúa donde lo dejaste.",
  quickRetry: "Reintentar",
  quickRetryPrompt: "Reintenta: vuelve a responder a mi última petición desde cero.",

  // ── Compactación + banner de agente ──
  conversationCompacted: "Conversación compactada",
  agentBadge: "Agente",
  quickReview: "Revisar",
  quickReviewPrompt: "Revisa los últimos cambios que hiciste.",

  // ── Barra "USO CLI" (interpola {provider} / {hours} / {time} / {day}) ──
  cliUsage: "Uso CLI",
  usageSession5h: "Sesión 5h",
  usageWeek: "Semana",
  usageSessionHours: "Sesión {hours}h",
  usageSourceReal: "cuenta",
  usageSourceEstimated: "estimado",
  usageSourceTokens: "tokens",
  usageUnavailable: "Sin datos de uso de {provider}",
  usageRetry: "Reintentar",
  usageResetSameDay: "reinicia {time}",
  usageResetOtherDay: "reinicia {day}, {time}",

  // ── Consola / historial / scope de la cabecera ──
  serverConsole: "Consola del servidor",
  viewHistory: "Ver historial",
  chatLooseScope: "Chat suelto",
  backToLeader: "Volver al chat del líder",
  compact: "Compactar",
  compacting: "Compactando…",

  // ── Formato relativo del drawer (unidades cortas) ──
  unitMinutesShort: "min",
  unitHoursShort: "h",
  unitDaysShort: "d",

  // ── Divisor de compactación (interpola {n}) ──
  compactedSummary: "{n} mensajes anteriores resumidos",

  // ── Bloque de preguntas (ask): prefijo de la respuesta compuesta que se
  //    ENVÍA al agente y se pinta en la burbuja del usuario. ──
  askAnswersPrefix: "Respuestas:",

  // ── Markdown: bloque mermaid (se pinta como código etiquetado, sin render) ──
  mermaidDiagram: "mermaid · diagrama",

  // ── Tarjetas de acción del asistente (AssistantActionCard: SSH, 2FA, passkeys) ──
  actionCard: {
    notice: "Tus datos sensibles se envían directo y cifrados al servidor; no pasan por el asistente.",
    linuxUser: "Usuario Linux",
    privateKey: "Llave privada (PEM)",
    keyPlaceholder: "-----BEGIN OPENSSH PRIVATE KEY-----",
    passphrase: "Passphrase",
    registerKey: "Registrar llave SSH",
    serverIp: "IP del servidor",
    port: "Puerto",
    sshUser: "Usuario SSH",
    keyToUse: "Llave a usar",
    configureSsh: "Configurar conexión SSH",
    save: "Guardar",
    saving: "Guardando…",
    fillFields: "Completa los campos requeridos.",
    keyOk: "Llave SSH registrada.",
    sshOk: "Conexión SSH configurada.",
    totpTitle: "Activar 2FA",
    totpScan: "Escanea el QR con tu app de autenticación (Google Authenticator, Authy…) o usa la clave manual.",
    totpSecret: "Clave manual",
    totpCode: "Código de 6 dígitos",
    totpEnable: "Activar 2FA",
    totpOk: "Autenticación en dos pasos activada.",
    totpLoading: "Generando QR…",
    recoveryTitle: "Códigos de recuperación",
    recoveryIntro: "Genera códigos de un solo uso para entrar si pierdes tu autenticador.",
    recoveryGenerate: "Generar códigos",
    recoveryWarn: "Guárdalos en un lugar seguro. No se mostrarán de nuevo.",
    recoveryOk: "Códigos de recuperación generados.",
    copy: "Copiar",
    copied: "Copiado",
    passkeyTitle: "Registrar una passkey",
    passkeyName: "Nombre de la passkey",
    passkeyRegister: "Registrar passkey",
    passkeyOk: "Passkey registrada.",
    passkeyUnavailable: "Las passkeys requieren una build nativa de la app (no funcionan en Expo Go).",
    passkeyDefault: "Mi passkey",
  },
} as const;

export type AssistantChatMessages = Widen<typeof es>;
