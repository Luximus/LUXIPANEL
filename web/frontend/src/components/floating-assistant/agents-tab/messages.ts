// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** AgentsTab i18n message shapes + Spanish fallback — extracted verbatim from AgentsTab.tsx. */
import type { AvatarAttr } from "../agent-avataaars";

export type AgentsTabMessages = {
  cancel: string; saving: string; saveChanges: string; noDescription: string;
  allTools: string; toolsCount: string; noActiveModules: string;
  removeAll: string; selectAll: string; sensitiveTool: string;
  confirmDeleteAgent: string; confirmDeleteRole: string; duplicateName: string;
  editBtn: string; deleteTitle: string; errorPrefix: string;
  backToAgents: string; createdBy: string;
  diagram: { empty: string; connection: string };
  archetypes: { devops: string; security: string; dba: string; support: string; nginx: string; backups: string; logs: string; automation: string };
  editor: {
    titleNew: string; titleEdit: string;
    /** Settings-modal header title/description while the agent editor is open. */
    headerTitleNew: string; headerDescNew: string; headerTitleEdit: string; headerDescEdit: string;
    /** Header back-arrow label while the editor is open (cancels the form). */
    backToList: string;
    tabGeneral: string; tabModel: string; tabHierarchy: string; tabTools: string; tabResources: string; tabAccess: string;
    aiHelpTitle: string; aiHelpDesc: string; aiHelpSelect: string; aiHelpFromDesc: string; aiHelpFromDescTitle: string; aiHelpGenerating: string;
    fieldName: string; namePlaceholder: string; fieldDescription: string; descPlaceholder: string;
    fieldSystemPrompt: string; systemPromptPlaceholder: string; fieldAvatar: string;
    avatarRandomize: string; avatarAuto: string;
    avatarAttrs: Record<AvatarAttr, string>;
    fieldProvider: string; fieldModel: string; modelPlaceholder: string;
    realtimeLabel: string; realtimeDesc: string; realtimeUnavailable: string;
    multiAgentLabel: string; multiAgentDescPre: string; multiAgentDescBold: string; multiAgentDescPost: string;
    multiAgentCopies: string; multiAgentCopiesHint: string; multiAgentProvidersPre: string; multiAgentProvidersPost: string; multiAgentApiHint: string;
    roleHeading: string; roleAssigned: string; roleNone: string; roleHint: string;
    parentAgent: string; parentNone: string; parentHintPre: string; parentHintBold: string; parentHintPost: string;
    connectionsLabel: string; connectionsEmpty: string; connectionsHint: string;
    supervisorLabel: string; supervisorDesc: string;
    allowAllTools: string; toolsDesc: string;
    associatedServers: string; serversEmpty: string;
    attachedProjects: string; attachedProjectsDesc: string; noParentProjects: string;
    graphIndexesTitle: string; graphIndexesDesc: string; graphIndexesEmpty: string;
    snippetsSection: string; snippetsCategoryLabel: string; snippetsCategoryNone: string;
    snippetsTagsLabel: string; snippetsHelp: string; snippetsNoAccess: string; snippetsNoTags: string;
    saveObsidian: string; agentSkills: string; createAgent: string;
    credentialTitle: string; credentialHint: string; credentialWarn2fa: string; credentialSet: string;
    credentialUser: string; credentialPass: string; credentialLabel: string;
    credentialReplace: string; credentialRemove: string; credentialRemoved: string; credentialCancel: string;
  };
  roleEditor: {
    titleNew: string; titleEdit: string;
    fieldName: string; namePlaceholder: string; fieldDesc: string; descPlaceholder: string;
    fieldBasePrompt: string; basePromptPlaceholder: string; basePromptHint: string;
    noToolLimit: string; toolsDesc: string;
    supervisorLabel: string; supervisorDesc: string; createRole: string;
  };
  treeView: { title: string; reloadTitle: string; regenerating: string; regenerate: string; description: string };
  rolesList: { newRole: string; description: string; emptyTitle: string; emptyDesc: string; agentsCount: string };
  list: {
    description: string; treeBtn: string; treeBtnTitle: string; rolesBtn: string; rolesBtnTitle: string;
    newAgent: string; loading: string; emptyTitle: string; emptyDesc: string;
    multiAgentTitle: string; roleAssignedTitle: string; subordinateTitle: string; connectionsTitle: string;
    supervisorTitle: string; supervisorBadge: string; realtimeTitle: string; realtimeBadge: string;
    startChat: string; duplicateTitle: string;
    /** Group heading for agents without an assigned role. */
    noRoleGroupTitle: string;
    /** Aria-label for an agents-group container: "Grupo de trabajo: {name}". */
    groupAria: string;
    /** Pluralized agent count for a group: "{count} agentes". */
    groupCount: string;
    /** Generic description for the no-role bucket. */
    noRoleGroupDesc: string;
    /** Trash button label/tooltip on a group header. */
    deleteGroupTitle: string;
    /** Confirm modal title: "Eliminar grupo «{name}»". */
    deleteGroupModalTitle: string;
    /** Confirm modal body warning. */
    deleteGroupModalBody: string;
    /** Note when the group has shared agents that won't be deleted. */
    deleteGroupSharedNote: string;
    /** Confirm action button label. */
    deleteGroupConfirm: string;
    /** Error toast listing agents that couldn't be removed. */
    deleteGroupErrors: string;
  };
  /** First-class agent teams (create/rename/add members/delete/selector). */
  teams: {
    newTeamBtn: string;
    newTeamTitle: string;
    editTeamTitle: string;
    nameLabel: string;
    namePlaceholder: string;
    descriptionLabel: string;
    colorLabel: string;
    createBtn: string;
    saveBtn: string;
    cancelBtn: string;
    addAgentsBtn: string;
    addAgentsTitle: string;
    addAgentsEmpty: string;
    addAgentsConfirm: string;
    alreadyInTeam: string;
    removeFromTeamBtn: string;
    removeFromTeamConfirm: string;
    deleteTeamBtn: string;
    deleteTeamConfirm: string;
    deleteTeamKeepsAgentsNote: string;
    teamSelectorLabel: string;
    /** Validation error when saving an agent without a group. */
    groupRequired: string;
    /** Non-selectable placeholder for the (now required) group selector. */
    teamSelectorPlaceholder: string;
    noTeamOption: string;
    emptyTeamHint: string;
    memberCount: string;
  };
  /** "Sincronizar con plantilla" (template resync) per work group. */
  resync: {
    btn: string;
    btnTitle: string;
    /** Modal title: "Sincronizar «{name}» con su plantilla". */
    modalTitle: string;
    loading: string;
    markersMissing: string;
    missingHeading: string;
    presentHeading: string;
    extraHeading: string;
    extraNote: string;
    nothingMissing: string;
    confirm: string;
    applying: string;
    close: string;
  };
};

/** i18n subtree for the agent-teams UI, shared with the team modal components. */
export type TeamsMessages = AgentsTabMessages["teams"];

export const agentsTabFallback: AgentsTabMessages = {
  cancel: "Cancelar", saving: "Guardando…", saveChanges: "Guardar cambios",
  noDescription: "Sin descripción", allTools: "todas las tools", toolsCount: "{count} tools",
  noActiveModules: "No hay módulos activos con herramientas.", removeAll: "Quitar todo",
  selectAll: "Seleccionar todo", sensitiveTool: "acción sensible",
  confirmDeleteAgent: "¿Eliminar el agente \"{name}\"?",
  confirmDeleteRole: "¿Eliminar el rol \"{name}\"? Se quitará de los agentes que lo usen.",
  duplicateName: "{name} (copia)", editBtn: "Editar", deleteTitle: "Eliminar",
  errorPrefix: "Error: {message}", backToAgents: "Agentes", createdBy: "Creado por {ownerName}",
  diagram: {
    empty: "Sin agentes — crea uno para verlo aquí",
    connection: "conexión",
  },
  archetypes: {
    devops: "DevOps / SRE", security: "Auditor de seguridad", dba: "Administrador de BBDD",
    support: "Soporte técnico", nginx: "Administrador web / Nginx", backups: "Especialista en backups",
    logs: "Analista de logs", automation: "Automatización / Cron",
  },
  editor: {
    titleNew: "Nuevo agente", titleEdit: "Editar agente",
    headerTitleNew: "Nuevo agente", headerDescNew: "Configura un nuevo agente de IA",
    headerTitleEdit: "Editando agente", headerDescEdit: "Modifica la configuración del agente",
    backToList: "Volver a agentes",
    tabGeneral: "General", tabModel: "Modelo", tabHierarchy: "Jerarquía",
    tabTools: "Herramientas", tabResources: "Recursos", tabAccess: "Accesos",
    aiHelpTitle: "Ayuda de IA",
    aiHelpDesc: "Elige un perfil y la IA redactará nombre, descripción, prompt y herramientas de forma profesional.",
    aiHelpSelect: "Selecciona un perfil…", aiHelpFromDesc: "Desde mi descripción",
    aiHelpFromDescTitle: "Mejorar a partir de la descripción actual",
    aiHelpGenerating: "Generando agente con IA…",
    fieldName: "Nombre", namePlaceholder: "Ej. Auditor de seguridad",
    fieldDescription: "Descripción", descPlaceholder: "Para qué sirve este agente",
    fieldSystemPrompt: "Prompt de sistema",
    systemPromptPlaceholder: "Instrucciones, personalidad y objetivos del agente…",
    fieldAvatar: "Avatar",
    avatarRandomize: "Aleatorio", avatarAuto: "Auto",
    avatarAttrs: {
      top: "Pelo / gorro", hairColor: "Color de pelo", eyes: "Ojos", eyebrows: "Cejas",
      mouth: "Boca", skinColor: "Color de piel", clothing: "Ropa", clothesColor: "Color de ropa",
      accessories: "Accesorio", facialHair: "Vello facial", facialHairColor: "Color del vello",
    },
    fieldProvider: "Proveedor", fieldModel: "Modelo",
    modelPlaceholder: "(por defecto del proveedor)",
    realtimeLabel: "Comunicación en tiempo real (sesión de baja latencia)",
    realtimeDesc: "Sesión bidireccional de audio/texto en streaming (según el proveedor: OpenAI Realtime o Gemini Live).",
    realtimeUnavailable: "El proveedor \"{providerId}\" no ofrece sesión en tiempo real. Disponible solo con codex (OpenAI) o gemini.",
    multiAgentLabel: "Modo multi-agente: replica este mismo agente varias veces en paralelo",
    multiAgentDescPre: "El agente se ", multiAgentDescBold: "multiplica por X",
    multiAgentDescPost: ": la tarea se divide en X partes y cada copia (mismo prompt, herramientas y proveedor) resuelve una en paralelo; luego se sintetiza una sola respuesta.",
    multiAgentCopies: "Número de copias (X)", multiAgentCopiesHint: "copias del agente (2–8)",
    multiAgentProvidersPre: "Opcional — repartir las copias entre varios proveedores (el principal ",
    multiAgentProvidersPost: " siempre participa; marca otros para distribuirlas):",
    multiAgentApiHint: "Solo se usan proveedores en modo API con API key. El multi-agente requiere modo API.",
    roleHeading: "Rol y jerarquía", roleAssigned: "Rol asignado", roleNone: "Sin rol",
    roleHint: "El rol aporta un prompt base y herramientas por defecto; el agente lo refina. Gestiona roles desde la lista de agentes.",
    parentAgent: "Agente superior (subordinación)", parentNone: "Ninguno (nivel superior)",
    parentHintPre: "Su superior podrá ", parentHintBold: "delegarle",
    parentHintPost: " tareas durante la ejecución y usar su respuesta.",
    connectionsLabel: "Conexiones con otros agentes", connectionsEmpty: "No hay otros agentes.",
    connectionsHint: "Canal bidireccional: cualquiera de los dos puede pedir o entregar información al otro en ejecución (herramienta de delegación).",
    supervisorLabel: "Supervisor: puede crear chats para sus subordinados",
    supervisorDesc: "Abre chats reales en el tab Chat y pone a trabajar a sus subordinados (cada chat queda como bitácora de ese agente). También se concede vía el rol.",
    allowAllTools: "Permitir todas las herramientas disponibles",
    toolsDesc: "Selecciona el subconjunto de herramientas que este agente puede usar. La lista se intersecta con lo que cada módulo permite, así que nunca amplía permisos.",
    associatedServers: "Servidores asociados",
    serversEmpty: "No hay servidores registrados.", attachedProjects: "Proyectos adjuntos",
    attachedProjectsDesc: "Selecciona uno o varios proyectos del árbol. Marcar un proyecto padre selecciona todas sus carpetas anidadas; el agente usa las rutas de trabajo de los proyectos seleccionados.",
    noParentProjects: "No hay proyectos.",
    graphIndexesTitle: "Índices de grafo de código",
    graphIndexesDesc: "El agente usará estos índices para explorar el código por el grafo (búsquedas de símbolos, llamadas y arquitectura) en lugar de leer archivos completos — reduce el consumo de tokens.",
    graphIndexesEmpty: "No hay índices de grafo disponibles. Indexa un proyecto desde la pestaña Proyectos.",
    snippetsSection: "Snippets de terminal",
    snippetsCategoryLabel: "Categoría de snippets",
    snippetsCategoryNone: "(ninguna)",
    snippetsTagsLabel: "Tags de la categoría",
    snippetsHelp: "Pre-filtra los snippets de terminal que este agente tendrá disponibles: elige una categoría y, opcionalmente, tags de esa categoría. Sin categoría = sin filtro.",
    snippetsNoAccess: "No se pudieron cargar los snippets de terminal (requiere permiso de terminal).",
    snippetsNoTags: "Esta categoría no tiene tags.",
    saveObsidian: "Guardar resúmenes en el vault Obsidian del proyecto adjunto",
    agentSkills: "Skills del agente", createAgent: "Crear agente",
    credentialTitle: "Credenciales de acceso",
    credentialHint:
      "Usuario y clave que el agente usará cuando una prueba (QA) requiera iniciar sesión en la aplicación bajo prueba. " +
      "Usa una cuenta DE PRUEBAS — la clave no se vuelve a mostrar y nunca sale del servidor.",
    credentialWarn2fa:
      "⚠️ La cuenta NO debe tener doble factor activo (2FA / TOTP / código por SMS o email): el agente solo " +
      "conoce usuario y clave, así que un segundo factor bloquearía el login. Usa una cuenta de pruebas sin 2FA.",
    credentialSet: "Configurada — usuario {user}",
    credentialUser: "Usuario", credentialPass: "Clave", credentialLabel: "Etiqueta (opcional, p. ej. staging)",
    credentialReplace: "Reemplazar", credentialRemove: "Quitar",
    credentialRemoved: "Se quitará al guardar.", credentialCancel: "Cancelar",
  },
  roleEditor: {
    titleNew: "Nuevo rol", titleEdit: "Editar rol",
    fieldName: "Nombre del rol", namePlaceholder: "Ej. Coordinador, Auditor, Especialista BBDD",
    fieldDesc: "Descripción", descPlaceholder: "Qué representa este rol",
    fieldBasePrompt: "Prompt base del rol",
    basePromptPlaceholder: "Políticas, responsabilidades y tono comunes a todos los agentes con este rol…",
    basePromptHint: "Se inyecta como base, antes del prompt propio del agente.",
    noToolLimit: "Sin límite de herramientas desde el rol",
    toolsDesc: "Las herramientas del rol acotan lo que sus agentes pueden tocar (se intersecta, nunca amplía).",
    supervisorLabel: "Cargo supervisor: los agentes con este rol pueden crear chats para sus subordinados",
    supervisorDesc: "Concede el permiso de actuar como supervisor (herramienta para abrir chats y asignar trabajo) a todo agente que tenga este rol.",
    createRole: "Crear rol",
  },
  treeView: {
    title: "Jerarquía de agentes",
    reloadTitle: "Recargar agentes y regenerar el árbol",
    regenerating: "Regenerando…", regenerate: "Regenerar",
    description: "Diagrama del árbol de subordinación (línea sólida = superior → subordinado) y conexiones entre pares (línea punteada). Asigna el «Agente superior» en el editor de cada agente para construir el árbol.",
  },
  rolesList: {
    newRole: "Nuevo rol",
    description: "Roles reutilizables (perfil con prompt base y herramientas) que asignas a uno o varios agentes.",
    emptyTitle: "Aún no hay roles",
    emptyDesc: "Crea un rol para estandarizar el comportamiento de varios agentes.",
    agentsCount: "{count} agente(s)",
  },
  list: {
    description: "Agentes IA personalizados: prompt propio, herramientas y proveedor/modelo. Úsalos en el chat o prográmalos en Cron.",
    treeBtn: "Árbol", treeBtnTitle: "Ver el árbol de jerarquía de agentes",
    rolesBtn: "Roles", rolesBtnTitle: "Crear y gestionar roles de agente",
    newAgent: "Nuevo agente", loading: "Cargando agentes…",
    emptyTitle: "Aún no tienes agentes",
    emptyDesc: "Crea uno para chatear con un prompt y un set de herramientas a medida.",
    multiAgentTitle: "Multi-agente: {count} copias",
    roleAssignedTitle: "Rol asignado", subordinateTitle: "Subordinado de",
    connectionsTitle: "Conexiones con otros agentes",
    supervisorTitle: "Supervisor: puede crear chats para subordinados",
    supervisorBadge: "supervisor", realtimeTitle: "Comunicación en tiempo real",
    realtimeBadge: "tiempo real", startChat: "Iniciar chat", duplicateTitle: "Duplicar",
    noRoleGroupTitle: "Sin grupo de trabajo",
    groupAria: "Grupo de trabajo: {name}",
    groupCount: "{count} agentes",
    noRoleGroupDesc: "Agentes sin un rol asignado. Asígnales uno desde su editor.",
    deleteGroupTitle: "Eliminar todo el grupo",
    deleteGroupModalTitle: "Eliminar grupo «{name}»",
    deleteGroupModalBody: "Se eliminarán {count} agentes de este grupo. Esta acción no se puede deshacer.",
    deleteGroupSharedNote: "{count} agentes compartidos de otros usuarios no se eliminarán.",
    deleteGroupConfirm: "Eliminar grupo",
    deleteGroupErrors: "No se pudieron eliminar: {names}",
  },
  teams: {
    newTeamBtn: "Nuevo equipo",
    newTeamTitle: "Crear equipo",
    editTeamTitle: "Editar equipo",
    nameLabel: "Nombre",
    namePlaceholder: "Ej. Backend, Frontend, Diseño…",
    descriptionLabel: "Descripción (opcional)",
    colorLabel: "Color",
    createBtn: "Crear equipo",
    saveBtn: "Guardar",
    cancelBtn: "Cancelar",
    addAgentsBtn: "Añadir agentes",
    addAgentsTitle: "Añadir agentes al equipo",
    addAgentsEmpty: "No hay agentes disponibles para añadir.",
    addAgentsConfirm: "Añadir",
    alreadyInTeam: "en otro equipo",
    removeFromTeamBtn: "Quitar del equipo",
    removeFromTeamConfirm: "¿Quitar este agente del equipo? El agente no se elimina.",
    deleteTeamBtn: "Eliminar equipo",
    deleteTeamConfirm: "¿Eliminar este equipo?",
    deleteTeamKeepsAgentsNote: "Los agentes NO se eliminan: solo se quitan del equipo.",
    teamSelectorLabel: "Equipo",
    groupRequired: "Selecciona o crea un grupo",
    teamSelectorPlaceholder: "— Selecciona un grupo —",
    noTeamOption: "Sin equipo",
    emptyTeamHint: "Equipo vacío — añade agentes con el botón +.",
    memberCount: "{count} miembro(s)",
  },
  resync: {
    btn: "Sincronizar con plantilla",
    btnTitle: "Comparar este equipo con su plantilla y crear los agentes que falten",
    modalTitle: "Sincronizar «{name}» con su plantilla",
    loading: "Comparando con la plantilla…",
    markersMissing: "Este equipo perdió los marcadores de procedencia de la plantilla, así que no se puede comparar automáticamente. Puedes crear los agentes que falten a mano.",
    missingHeading: "Faltan",
    presentHeading: "Presentes",
    extraHeading: "Añadidos a mano",
    extraNote: "No se tocan.",
    nothingMissing: "El equipo está completo: no falta ningún agente de la plantilla.",
    confirm: "Crear seleccionados",
    applying: "Creando…",
    close: "Cerrar",
  },
};
