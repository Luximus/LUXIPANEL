const assistantPart2 = {
  "officeConnectors": {
    "statusConnected": "Conectado",
    "statusError": "Error",
    "statusConfigured": "Configurado",
    "statusDisconnected": "Sin conectar",
    "connectFailed": "No se pudo conectar",
    "disconnectFailed": "No se pudo desconectar",
    "managerTitle": "Conectar herramientas de oficina",
    "close": "Cerrar",
    "managerHint": "Al conectar una herramienta aparece un botón en el chat (junto a adjuntar) para consultar y adjuntar sus archivos.",
    "howToConfigure": "Cómo configurar {name}",
    "reconfigure": "Reconfigurar",
    "disconnect": "Desconectar",
    "connect": "Conectar",
    "requiredMark": " *",
    "cancel": "Cancelar",
    "connecting": "Conectando…",
    "saveAndConnect": "Guardar y conectar",
    "loadFilesFailed": "No se pudieron cargar los archivos",
    "attachFailed": "No se pudo adjuntar el archivo",
    "searchPlaceholder": "Buscar en {name}…",
    "search": "Buscar",
    "loading": "Cargando…",
    "noResults": "Sin resultados.",
    "openFolder": "Abrir carpeta",
    "attachToChat": "Adjuntar al chat"
  },
  "cliUsageBars": {
    "sourceReal": "cuota disponible de la cuenta",
    "sourceEstimated": "tokens disponibles estimados",
    "sourceTokens": "tokens disponibles",
    "cliUsage": "Disponible CLI",
    "session5h": "Sesión (5h)",
    "week": "Semana",
    "sessionHours": "Sesión ({hours}h)",
    "resetSameDay": "reinicia {time}",
    "resetOtherDay": "reinicia {day}, {time}",
    "unavailable": "No se pudo obtener la cuota de {provider}",
    "retry": "Reintentar"
  },
  "agentsTab": {
    "teams": {
      "newTeamBtn": "Nuevo equipo",
      "newTeamTitle": "Crear equipo",
      "editTeamTitle": "Editar equipo",
      "nameLabel": "Nombre",
      "namePlaceholder": "Ej. Backend, Frontend, Diseño…",
      "descriptionLabel": "Descripción (opcional)",
      "colorLabel": "Color",
      "createBtn": "Crear equipo",
      "saveBtn": "Guardar",
      "cancelBtn": "Cancelar",
      "addAgentsBtn": "Añadir agentes",
      "addAgentsTitle": "Añadir agentes al equipo",
      "addAgentsEmpty": "No hay agentes disponibles para añadir.",
      "addAgentsConfirm": "Añadir",
      "alreadyInTeam": "en otro equipo",
      "removeFromTeamBtn": "Quitar del equipo",
      "removeFromTeamConfirm": "¿Quitar este agente del equipo? El agente no se elimina.",
      "deleteTeamBtn": "Eliminar equipo",
      "deleteTeamConfirm": "¿Eliminar este equipo?",
      "deleteTeamKeepsAgentsNote": "Los agentes NO se eliminan: solo se quitan del equipo.",
      "teamSelectorLabel": "Equipo",
      "groupRequired": "Selecciona o crea un grupo",
      "teamSelectorPlaceholder": "— Selecciona un grupo —",
      "noTeamOption": "Sin equipo",
      "emptyTeamHint": "Equipo vacío — añade agentes con el botón +.",
      "memberCount": "{count} miembro(s)"
    },
    "cancel": "Cancelar",
    "saving": "Guardando…",
    "saveChanges": "Guardar cambios",
    "noDescription": "Sin descripción",
    "allTools": "todas las tools",
    "toolsCount": "{count} herramientas",
    "noActiveModules": "No hay módulos activos con herramientas.",
    "removeAll": "Quitar todo",
    "selectAll": "Seleccionar todo",
    "sensitiveTool": "acción sensible",
    "confirmDeleteAgent": "¿Eliminar el agente \"{name}\"?",
    "confirmDeleteRole": "¿Eliminar el rol \"{name}\"? Se quitará de los agentes que lo usen.",
    "duplicateName": "{name} (copia)",
    "editBtn": "Editar",
    "deleteTitle": "Eliminar",
    "errorPrefix": "Error: {message}",
    "backToAgents": "Agentes",
    "createdBy": "Creado por {ownerName}",
    "diagram": {
      "empty": "Sin agentes — crea uno para verlo aquí",
      "connection": "conexión"
    },
    "archetypes": {
      "devops": "DevOps / SRE",
      "security": "Auditor de seguridad",
      "dba": "Administrador de BBDD",
      "support": "Soporte técnico",
      "nginx": "Administrador web / Nginx",
      "backups": "Especialista en backups",
      "logs": "Analista de logs",
      "automation": "Automatización / Cron"
    },
    "editor": {
      "titleNew": "Nuevo agente",
      "titleEdit": "Editar agente",
      "headerTitleNew": "Nuevo agente",
      "headerDescNew": "Configura un nuevo agente de IA",
      "headerTitleEdit": "Editando agente",
      "headerDescEdit": "Modifica la configuración del agente",
      "backToList": "Volver a agentes",
      "tabGeneral": "General",
      "tabModel": "Modelo",
      "tabHierarchy": "Jerarquía",
      "tabTools": "Herramientas",
      "tabResources": "Recursos",
      "tabAccess": "Accesos",
      "aiHelpTitle": "Ayuda de IA",
      "aiHelpDesc": "Elige un perfil y la IA redactará nombre, descripción, prompt y herramientas de forma profesional.",
      "aiHelpSelect": "Selecciona un perfil…",
      "aiHelpFromDesc": "Desde mi descripción",
      "aiHelpFromDescTitle": "Mejorar a partir de la descripción actual",
      "aiHelpGenerating": "Generando agente con IA…",
      "fieldName": "Nombre",
      "namePlaceholder": "Ej. Auditor de seguridad",
      "fieldDescription": "Descripción",
      "descPlaceholder": "Para qué sirve este agente",
      "fieldSystemPrompt": "Prompt de sistema",
      "systemPromptPlaceholder": "Instrucciones, personalidad y objetivos del agente…",
      "fieldAvatar": "Avatar",
      "avatarRandomize": "Aleatorio",
      "avatarAuto": "Auto",
      "avatarAttrs": {
        "top": "Pelo / gorro",
        "hairColor": "Color de pelo",
        "eyes": "Ojos",
        "eyebrows": "Cejas",
        "mouth": "Boca",
        "skinColor": "Color de piel",
        "clothing": "Ropa",
        "clothesColor": "Color de ropa",
        "accessories": "Accesorio",
        "facialHair": "Vello facial",
        "facialHairColor": "Color del vello"
      },
      "fieldProvider": "Proveedor",
      "fieldModel": "Modelo",
      "modelPlaceholder": "(por defecto del proveedor)",
      "realtimeLabel": "Comunicación en tiempo real (sesión de baja latencia)",
      "realtimeDesc": "Sesión bidireccional de audio/texto en streaming (según el proveedor: OpenAI Realtime o Gemini Live).",
      "realtimeUnavailable": "El proveedor \"{providerId}\" no ofrece sesión en tiempo real. Disponible solo con codex (OpenAI) o gemini.",
      "multiAgentLabel": "Modo multi-agente: replica este mismo agente varias veces en paralelo",
      "multiAgentDescPre": "El agente se ",
      "multiAgentDescBold": "multiplica por X",
      "multiAgentDescPost": ": la tarea se divide en X partes y cada copia (mismo prompt, herramientas y proveedor) resuelve una en paralelo; luego se sintetiza una sola respuesta.",
      "multiAgentCopies": "Número de copias (X)",
      "multiAgentCopiesHint": "copias del agente (2–8)",
      "multiAgentProvidersPre": "Opcional — repartir las copias entre varios proveedores (el principal ",
      "multiAgentProvidersPost": " siempre participa; marca otros para distribuirlas):",
      "multiAgentApiHint": "Solo se usan proveedores en modo API con clave API. El multi-agente requiere modo API.",
      "roleHeading": "Rol y jerarquía",
      "roleAssigned": "Rol asignado",
      "roleNone": "Sin rol",
      "roleHint": "El rol aporta un prompt base y herramientas por defecto; el agente lo refina. Gestiona roles desde la lista de agentes.",
      "parentAgent": "Agente superior (subordinación)",
      "parentNone": "Ninguno (nivel superior)",
      "parentHintPre": "Su superior podrá ",
      "parentHintBold": "delegarle",
      "parentHintPost": " tareas durante la ejecución y usar su respuesta.",
      "connectionsLabel": "Conexiones con otros agentes",
      "connectionsEmpty": "No hay otros agentes.",
      "connectionsHint": "Canal bidireccional: cualquiera de los dos puede pedir o entregar información al otro en ejecución (herramienta de delegación).",
      "supervisorLabel": "Supervisor: puede crear chats para sus subordinados",
      "supervisorDesc": "Abre chats reales en el tab Chat y pone a trabajar a sus subordinados (cada chat queda como bitácora de ese agente). También se concede vía el rol.",
      "allowAllTools": "Permitir todas las herramientas disponibles",
      "toolsDesc": "Selecciona el subconjunto de herramientas que este agente puede usar. La lista se intersecta con lo que cada módulo permite, así que nunca amplía permisos.",
      "associatedServers": "Servidores asociados",
      "serversEmpty": "No hay servidores registrados.",
      "attachedProjects": "Proyectos adjuntos",
      "attachedProjectsDesc": "Selecciona uno o varios proyectos del árbol. Marcar un proyecto padre selecciona todas sus carpetas anidadas; el agente usa las rutas de trabajo de los proyectos seleccionados.",
      "noParentProjects": "No hay proyectos.",
      "graphIndexesTitle": "Índices de grafo de código",
      "graphIndexesDesc": "El agente usará estos índices para explorar el código por el grafo (símbolos, llamadas y arquitectura) en lugar de leer archivos completos — reduce el consumo de tokens.",
      "graphIndexesEmpty": "No hay índices de grafo disponibles. Indexa un proyecto desde la pestaña Proyectos.",
      "credentialTitle": "Credenciales de acceso",
      "saveObsidian": "Guardar resúmenes en el vault Obsidian del proyecto adjunto",
      "agentSkills": "Skills del agente",
      "createAgent": "Crear agente",
      "snippetsSection": "Snippets de terminal",
      "snippetsCategoryLabel": "Categoría de snippets",
      "snippetsCategoryNone": "(ninguna)",
      "snippetsTagsLabel": "Tags de la categoría",
      "snippetsHelp": "Pre-filtra los snippets de terminal que este agente tendrá disponibles: elige una categoría y, opcionalmente, tags de esa categoría. Sin categoría = sin filtro.",
      "snippetsNoAccess": "No se pudieron cargar los snippets de terminal (requiere permiso de terminal).",
      "snippetsNoTags": "Esta categoría no tiene tags."
    },
    "roleEditor": {
      "titleNew": "Nuevo rol",
      "titleEdit": "Editar rol",
      "fieldName": "Nombre del rol",
      "namePlaceholder": "Ej. Coordinador, Auditor, Especialista BBDD",
      "fieldDesc": "Descripción",
      "descPlaceholder": "Qué representa este rol",
      "fieldBasePrompt": "Prompt base del rol",
      "basePromptPlaceholder": "Políticas, responsabilidades y tono comunes a todos los agentes con este rol…",
      "basePromptHint": "Se inyecta como base, antes del prompt propio del agente.",
      "noToolLimit": "Sin límite de herramientas desde el rol",
      "toolsDesc": "Las herramientas del rol acotan lo que sus agentes pueden tocar (se intersecta, nunca amplía).",
      "supervisorLabel": "Cargo supervisor: los agentes con este rol pueden crear chats para sus subordinados",
      "supervisorDesc": "Concede el permiso de actuar como supervisor (herramienta para abrir chats y asignar trabajo) a todo agente que tenga este rol.",
      "createRole": "Crear rol"
    },
    "treeView": {
      "title": "Jerarquía de agentes",
      "reloadTitle": "Recargar agentes y regenerar el árbol",
      "regenerating": "Regenerando…",
      "regenerate": "Regenerar",
      "description": "Diagrama del árbol de subordinación (línea sólida = superior → subordinado) y conexiones entre pares (línea punteada). Asigna el «Agente superior» en el editor de cada agente para construir el árbol."
    },
    "rolesList": {
      "newRole": "Nuevo rol",
      "description": "Roles reutilizables (perfil con prompt base y herramientas) que asignas a uno o varios agentes.",
      "emptyTitle": "Aún no hay roles",
      "emptyDesc": "Crea un rol para estandarizar el comportamiento de varios agentes.",
      "agentsCount": "{count} agente(s)"
    },
    "list": {
      "description": "Agentes IA personalizados: prompt propio, herramientas y proveedor/modelo. Úsalos en el chat o prográmalos en Cron.",
      "treeBtn": "Árbol",
      "treeBtnTitle": "Ver el árbol de jerarquía de agentes",
      "rolesBtn": "Roles",
      "rolesBtnTitle": "Crear y gestionar roles de agente",
      "newAgent": "Nuevo agente",
      "loading": "Cargando agentes…",
      "emptyTitle": "Aún no tienes agentes",
      "emptyDesc": "Crea uno para chatear con un prompt y un set de herramientas a medida.",
      "multiAgentTitle": "Multi-agente: {count} copias",
      "roleAssignedTitle": "Rol asignado",
      "subordinateTitle": "Subordinado de",
      "connectionsTitle": "Conexiones con otros agentes",
      "supervisorTitle": "Supervisor: puede crear chats para subordinados",
      "supervisorBadge": "supervisor",
      "realtimeTitle": "Comunicación en tiempo real",
      "realtimeBadge": "tiempo real",
      "startChat": "Iniciar chat",
      "duplicateTitle": "Duplicar",
      "noRoleGroupTitle": "Sin grupo de trabajo",
      "groupAria": "Grupo de trabajo: {name}",
      "groupCount": "{count} agentes",
      "noRoleGroupDesc": "Agentes sin un rol asignado. Asígnales uno desde su editor."
    },
    "resync": {
      "btn": "Sincronizar con plantilla",
      "btnTitle": "Comparar este equipo con su plantilla y crear los agentes que falten",
      "modalTitle": "Sincronizar «{name}» con su plantilla",
      "loading": "Comparando con la plantilla…",
      "markersMissing": "Este equipo perdió los marcadores de procedencia de la plantilla, así que no se puede comparar automáticamente. Puedes crear los agentes que falten a mano.",
      "missingHeading": "Faltan",
      "presentHeading": "Presentes",
      "extraHeading": "Añadidos a mano",
      "extraNote": "No se tocan.",
      "nothingMissing": "El equipo está completo: no falta ningún agente de la plantilla.",
      "confirm": "Crear seleccionados",
      "applying": "Creando…",
      "close": "Cerrar"
    }
  },
  "accessTab": {
    "all": "Todos",
    "permissionsTitle": "Accesos y permisos",
    "permissionsDescription": "Hoy la visibilidad del asistente se rige por el permiso del módulo assistant en tu perfil. El detalle por-rol (assistant.use / assistant.configure / assistant.module.<id>) esta previsto para la siguiente iteracion.",
    "recentInvocations": "Ultimas invocaciones de tools",
    "refreshAriaLabel": "Actualizar accesos",
    "loading": "Cargando...",
    "emptyRecent": "Sin actividad reciente.",
    "emptyProvider": "Sin actividad para este proveedor.",
    "byUser": "por",
    "crossServerTitle": "Acceso a servidor asociado",
    "autoApproveTitle": "Aprobación automática",
    "autoApproveDescription": "Herramientas que ya no piden confirmación (aprobadas con «Aprobar y no preguntar más»). Los cambios aplican a partir del próximo run.",
    "autoApproveEmpty": "No hay herramientas con aprobación automática. Esta lista se llena cuando eliges «Aprobar y no preguntar más» al aprobar una acción del agente.",
    "autoApproveRevoke": "Revocar",
    "autoApproveModeAuto": "modo auto: esta lista no aplica",
    "cmdPrefix": "$ ",
    "passwordLabel": "contraseña: ",
    "passphraseLabel": "frase de paso: ",
    "privateKeyLabel": "clave privada"
  },
  "directoryPicker": {
    "title": "Seleccionar carpeta",
    "goUp": "Subir",
    "loading": "Cargando…",
    "emptyDirs": "(sin subcarpetas)",
    "cancel": "Cancelar",
    "select": "Usar esta carpeta",
    "readError": "No se pudo leer el directorio"
  },
  "skillsPicker": {
    "searchPlaceholder": "Buscar skill…",
    "resetTitle": "Quitar personalización (usar skills globales)",
    "reset": "Restablecer ({count})",
    "loading": "Cargando skills…",
    "empty": "Sin skills.",
    "globalNote": "Se aplican SOLO en sus chats, encima de las skills globales del proveedor."
  },
  "skillCategories": {
    "methods": "Métodos del asistente",
    "code-quality": "Calidad de código",
    "web-quality": "Calidad web (Lighthouse / CWV)",
    "ui-ux": "UI / UX / diseño",
    "web-fullstack": "Desarrollo web / full-stack IA",
    "mobile": "Apps móviles",
    "code-agents": "Agentes de código",
    "reusable-skills": "Skills reutilizables para IA",
    "security": "Seguridad IA / web / apps",
    "token-savings": "Ahorro de tokens / costos IA",
    "ai-prod": "Agentes IA en producción",
    "devops": "DevOps / despliegue",
    "testing": "Testing / calidad de código",
    "data-rag": "Bases de datos / RAG / búsqueda",
    "automation": "Automatización / workflows",
    "other": "Otros"
  },
  "skillCatalog": {
    "ask-protocol": {
      "name": "Preguntar antes de decidir",
      "description": "Permite al asistente detenerse y preguntarte una decisión clave en vez de asumir (herramienta lxp_ask + protocolo de preguntas)."
    },
    "project-context-vault": {
      "name": "Contexto del proyecto (Obsidian)",
      "description": "Inyecta notas de contexto del proyecto (Contexto.md / Errores.md) y permite buscar más con obsidian.search_notes."
    },
    "ponytail": {
      "name": "Ponytail (código minimalista)",
      "description": "Modo de desarrollo minimalista: escribe el mínimo código necesario (escalera de decisión + guardrails)."
    },
    "ui-ux-pro-max": {
      "name": "UI/UX Pro Max (calidad de interfaz)",
      "description": "Estándares profesionales de UI/UX (accesibilidad, táctil, tipografía, estados) inyectados al prompt; nivel breve o completo."
    },
    "openai-agents-sdk": {
      "name": "OpenAI Agents SDK",
      "description": "Agentes OpenAI con tools, handoffs, guardrails, sessions y tracing."
    },
    "openai-agents-python": {
      "name": "OpenAI Agents Python SDK",
      "description": "SDK Python para agentes: Agent, Runner, @function_tool, handoffs y tracing."
    },
    "openai-agents-js": {
      "name": "OpenAI Agents JS SDK",
      "description": "SDK TypeScript/JS para agentes OpenAI: Agent, run, tools (Zod), handoffs."
    },
    "mcp-docs": {
      "name": "Model Context Protocol",
      "description": "Estándar abierto (el 'USB-C de la IA') para conectar LLMs a tools, resources y prompts."
    },
    "mcp-github": {
      "name": "MCP (GitHub)",
      "description": "Org GitHub de MCP: SDKs oficiales (10 lenguajes), servers de referencia e inspector."
    },
    "anthropic-mcp-intro": {
      "name": "Anthropic MCP Intro",
      "description": "Anuncio de Anthropic: MCP como estándar abierto que resuelve las integraciones N×M."
    },
    "n8n": {
      "name": "n8n",
      "description": "Automatización de flujos fair-code, self-hostable."
    },
    "make": {
      "name": "Make",
      "description": "Automatización visual no-code por escenarios (ex-Integromat)."
    },
    "zapier": {
      "name": "Zapier",
      "description": "Automatización SaaS por triggers y acciones (Zaps)."
    },
    "temporal": {
      "name": "Temporal",
      "description": "Orquestación de workflows duraderos y tolerantes a fallos."
    },
    "bullmq": {
      "name": "BullMQ",
      "description": "Colas de trabajos en Redis para Node.js."
    },
    "langgraph": {
      "name": "LangGraph",
      "description": "Orquestación de agentes LLM como grafos con estado."
    },
    "codex-cli": {
      "name": "OpenAI Codex CLI",
      "description": "Guía al agente a usar el Codex CLI de OpenAI (agente de código en terminal)."
    },
    "codex-cli-features": {
      "name": "Codex CLI Features",
      "description": "Detalla al agente las capacidades del Codex CLI (sandbox, aprobaciones, MCP, config)."
    },
    "codex-cloud": {
      "name": "Codex Cloud",
      "description": "Orienta al agente a delegar tareas a Codex Cloud (entornos remotos, ejecución en paralelo, PRs)."
    },
    "claude-code-skills": {
      "name": "Claude Code Skills",
      "description": "Guía al agente a crear y usar Skills de Claude Code (carpeta con SKILL.md, estándar Agent Skills)."
    },
    "copilot-cloud-agent": {
      "name": "GitHub Copilot Cloud Agent",
      "description": "Orienta al agente a delegar issues a GitHub Copilot coding agent, que trabaja en la nube y abre PRs."
    },
    "cursor": {
      "name": "Cursor",
      "description": "Guía al agente a trabajar en el editor Cursor (Agent, contexto del repo, reglas)."
    },
    "agents-md": {
      "name": "AGENTS.md",
      "description": "Orienta al agente a redactar y respetar AGENTS.md, el archivo de instrucciones estándar para agentes de código."
    },
    "open-design-contribute": {
      "name": "Open Design — contribuir (no-code)",
      "description": "Flujo guiado sin código para contribuir a Open Design (nexu-io): aporta un Skill o Design System, traduce docs, corrige textos o reporta un bug, y abre el PR/issue por ti."
    },
    "supabase": {
      "name": "Supabase",
      "description": "Backend Postgres gestionado con auth, storage y realtime."
    },
    "postgresql": {
      "name": "PostgreSQL",
      "description": "Base de datos relacional robusta con tipos ricos."
    },
    "pgvector": {
      "name": "pgvector",
      "description": "Búsqueda de similitud vectorial dentro de Postgres."
    },
    "pinecone": {
      "name": "Pinecone",
      "description": "Base de datos vectorial gestionada para RAG a escala."
    },
    "qdrant": {
      "name": "Qdrant",
      "description": "Motor vectorial open-source con filtrado por payload."
    },
    "weaviate": {
      "name": "Weaviate",
      "description": "Base de datos vectorial con esquema y módulos de vectorización."
    },
    "github-actions": {
      "name": "GitHub Actions",
      "description": "CI/CD en GitHub con workflows YAML (.github/workflows) disparados por eventos."
    },
    "vercel": {
      "name": "Vercel",
      "description": "Despliegue de frontends y funciones serverless con preview por commit/PR."
    },
    "docker": {
      "name": "Docker",
      "description": "Empaqueta apps en contenedores efímeros con imágenes ligeras y reproducibles."
    },
    "nginx": {
      "name": "Nginx",
      "description": "Servidor web y reverse proxy de alto rendimiento."
    },
    "pm2": {
      "name": "PM2",
      "description": "Gestor de procesos Node con cluster, reinicio y logs."
    },
    "redis": {
      "name": "Redis",
      "description": "Store en memoria para caché, colas y estructuras de datos."
    },
    "expo": {
      "name": "Expo",
      "description": "Guía al agente a desarrollar apps React Native con Expo (expo-router, módulos, config plugins)."
    },
    "eas-build": {
      "name": "EAS Build",
      "description": "Orienta al agente a compilar binarios iOS/Android en la nube con EAS Build y perfiles eas.json."
    },
    "eas-services": {
      "name": "EAS Services",
      "description": "Ayuda al agente a usar el ecosistema EAS (Submit, Update/OTA, Workflows) end-to-end."
    },
    "react-native": {
      "name": "React Native",
      "description": "Guía al agente a construir UIs nativas con React Native (componentes core, estilos, plataforma)."
    },
    "firebase-auth": {
      "name": "Firebase Auth",
      "description": "Orienta al agente a implementar autenticación con Firebase Auth (providers, tokens, sesión)."
    },
    "claude-agent-skills": {
      "name": "Claude Agent Skills",
      "description": "Empaqueta capacidades reutilizables como Agent Skills (SKILL.md) cargadas bajo demanda."
    },
    "claude-skills-github": {
      "name": "Claude Skills (GitHub)",
      "description": "Repositorio oficial anthropics/skills: ejemplos, spec y template como base y patrón."
    },
    "codex-agents-md-guide": {
      "name": "Codex AGENTS.md Guide",
      "description": "Convención AGENTS.md de Codex para dar instrucciones de proyecto a agentes de código."
    },
    "owasp-llm-top10": {
      "name": "OWASP Top 10 LLM",
      "description": "Top 10 riesgos en apps LLM: prompt injection, output inseguro, excessive agency."
    },
    "owasp-asvs": {
      "name": "OWASP ASVS",
      "description": "ASVS v5.0: estándar de requisitos verificables de seguridad por niveles."
    },
    "codeql": {
      "name": "CodeQL",
      "description": "CodeQL: consulta el código como datos (data-flow/taint) para hallar vulnerabilidades."
    },
    "semgrep": {
      "name": "Semgrep",
      "description": "Semgrep: SAST por reglas tipo-código + Supply Chain (SCA) y Secrets, alto signal."
    },
    "snyk": {
      "name": "Snyk",
      "description": "Snyk: SCA, Code (SAST), Container, IaC y API/Web (DAST) con remediación guiada."
    },
    "owasp-zap": {
      "name": "OWASP ZAP",
      "description": "OWASP ZAP: scanner web open source líder para DAST (passive/active scan)."
    },
    "skillspector": {
      "name": "SkillSpector (auditar Skills IA)",
      "description": "Audita Skills de agentes IA (SKILL.md + scripts) buscando vulnerabilidades e intención maliciosa antes de instalarlas (NVIDIA, Apache-2.0)."
    },
    "playwright": {
      "name": "Playwright",
      "description": "Pruebas E2E multi-navegador con auto-espera y trazas."
    },
    "cypress": {
      "name": "Cypress",
      "description": "Pruebas de componentes y E2E en navegador con reintentos."
    },
    "vitest": {
      "name": "Vitest",
      "description": "Runner de tests rápido nativo de Vite/ESM."
    },
    "jest": {
      "name": "Jest",
      "description": "Framework de pruebas con mocks integrados y snapshots."
    },
    "testing-library": {
      "name": "Testing Library",
      "description": "Consultas centradas en el usuario para probar UI accesible."
    },
    "storybook": {
      "name": "Storybook",
      "description": "Desarrollo y prueba aislada de componentes UI."
    },
    "openai-prompt-caching": {
      "name": "OpenAI Prompt Caching",
      "description": "Reduce costo automático reutilizando el prefijo cacheado de prompts en OpenAI."
    },
    "openai-prompt-engineering": {
      "name": "OpenAI Prompt Engineering",
      "description": "Escribe prompts precisos para menos iteraciones y menos tokens."
    },
    "gemini-context-caching": {
      "name": "Gemini Context Caching",
      "description": "Cachea contexto grande repetido en Gemini (explícito o implícito) para abaratar input."
    },
    "gemini-caching-api": {
      "name": "Gemini Caching API",
      "description": "API cachedContents de Gemini: crear, reusar, actualizar TTL y borrar cachés."
    },
    "litellm-cost-tracking": {
      "name": "LiteLLM Cost Tracking",
      "description": "Mide y atribuye costo por clave/usuario/equipo con el proxy LiteLLM."
    },
    "litellm": {
      "name": "LiteLLM",
      "description": "Gateway unificado a 100+ LLMs (formato OpenAI) con caché, fallbacks y routing."
    },
    "figma-ai": {
      "name": "Figma AI",
      "description": "IA de Figma: agente de canvas, generación de imágenes y design-to-code."
    },
    "figma-make": {
      "name": "Figma Make",
      "description": "Figma Make: de prompt o frame a prototipo/app funcional con código real."
    },
    "figma-ai-tools": {
      "name": "Figma AI Tools",
      "description": "Herramientas IA en Figma Design: First Draft, renombrar capas, imágenes, texto."
    },
    "framer": {
      "name": "Framer",
      "description": "Framer: sitios sin código con canvas visual, agentes IA, CMS y publicación."
    },
    "relume": {
      "name": "Relume",
      "description": "Relume: de brief a sitemap, wireframes y style guide con IA + librería."
    },
    "design-md-tokens": {
      "name": "DESIGN.md (sistema por tokens)",
      "description": "Genera UI fiel a una marca con un DESIGN.md estructurado: tokens de color/tipografía/espaciado, specs de componentes y reglas do/don't (voltagent, MIT)."
    },
    "nextjs-app-router": {
      "name": "Next.js App Router",
      "description": "Guía al agente a construir apps Next.js con el App Router (Server Components, route handlers, layouts)."
    },
    "vercel-ai-sdk": {
      "name": "Vercel AI SDK",
      "description": "Ayuda al agente a integrar LLMs con el AI SDK (generateText, streamText, tools, structured output)."
    },
    "vercel-ai-gateway": {
      "name": "Vercel AI Gateway",
      "description": "Orienta al agente a enrutar peticiones a múltiples modelos vía AI Gateway (un endpoint, fallback, observabilidad)."
    },
    "openai-sdk-cli": {
      "name": "OpenAI SDKs y CLI",
      "description": "Guía al agente a usar los SDKs oficiales de OpenAI (Python/Node) y la API de forma idiomática."
    },
    "v0-vercel": {
      "name": "v0 by Vercel",
      "description": "Ayuda al agente a generar y refinar UI React/Tailwind/shadcn con v0 a partir de prompts."
    },
    "web-quality-audit": {
      "name": "Auditoría de calidad web",
      "description": "Auditoría integral de calidad web (rendimiento, accesibilidad, SEO, seguridad) con clasificación por severidad."
    },
    "web-performance": {
      "name": "Rendimiento web",
      "description": "Optimiza velocidad de carga y eficiencia en runtime (presupuesto de recursos + Lighthouse)."
    },
    "core-web-vitals": {
      "name": "Core Web Vitals (LCP/INP/CLS)",
      "description": "Mejora LCP, INP y CLS (umbrales al percentil 75)."
    },
    "web-accessibility": {
      "name": "Accesibilidad web (WCAG 2.2)",
      "description": "Audita y mejora accesibilidad según WCAG 2.2 (objetivo AA)."
    },
    "web-seo": {
      "name": "SEO (técnico + on-page)",
      "description": "Optimiza visibilidad en buscadores: SEO técnico, on-page y datos estructurados."
    },
    "web-best-practices": {
      "name": "Buenas prácticas web (seguridad)",
      "description": "Patrones modernos de seguridad, compatibilidad y calidad de código."
    }
  }
} as const;

export default assistantPart2;
