// Tipos redactados (espejo del `/api/ai/*` de LUXIPANEL) usados por el drawer de
// ajustes del asistente. Solo los campos que la app consume; las claves secretas
// nunca vuelven al cliente.

// Alineado con `ProviderIcon` de la app (proveedores conocidos). Un agente del
// servidor podría declarar otro id en runtime; se trata como string al pintar.
// Espeja `AssistantProviderId` de WEB/assistant-api.ts (incluye grok + minimax).
export type AssistantProviderId = "claude" | "codex" | "gemini" | "deepseek" | "minimax" | "grok";

export type ApprovalMode = "manual" | "auto" | "plan";
export type UiMode = "simple" | "advanced";

export type ProviderState = {
  mode: "api" | "cli";
  active?: boolean;
  api: { hasApiKey: boolean; apiKeyHint: string; model: string };
  cli: { installed: boolean; loggedIn: boolean; version?: string; model?: string };
};

/** Tab por defecto de la sección Agentes (líderes vs proyectos). */
export type AgentsTabPref = "leaders" | "projects";
/** Tab por defecto de la lista de conversaciones (agentes vs sueltos/proyectos). */
export type ConversationsTabPref = "agents" | "loose";

export type AssistantConfig = {
  enabled: boolean;
  activeProvider: string;
  providers: Record<string, ProviderState>;
  uiMode?: UiMode;
  autoRouting?: { enabled: boolean; maxTier: string };
  approval?: { mode: ApprovalMode; autoApproveTools: string[] };
  /** Tab de la sección AGENTES que arranca activa (por servidor). */
  defaultAgentsTab?: AgentsTabPref;
  /** Tab de la lista de CONVERSACIONES que arranca activa (por servidor). */
  defaultConversationsTab?: ConversationsTabPref;
  /** Proveedor por defecto de chats nuevos sueltos/proyecto (ausente = activo). */
  defaultChatProvider?: string;
  /** Modelo por defecto de chats nuevos ("auto"/ausente = router elige). */
  defaultChatModel?: string;
};

/**
 * Una entrada del registro de invocaciones (`/api/ai/audit`). Espeja `AuditEntry`
 * de WEB/assistant-api.ts: campos cross-server presentes solo para `servers.*`
 * que alcanzaron un servidor distinto al conectado (los secretos vienen del dato
 * LOCAL de LUXIPANEL, nunca del cliente).
 */
export type AuditEntry = {
  id?: string | number;
  ts: string;
  provider: string;
  tool: string;
  success: boolean;
  durationMs: number;
  userId?: string;
  username?: string;
  outputPreview?: string;
  kind?: "cross-server";
  targetServerId?: string;
  targetServerName?: string;
  targetHost?: string;
  linuxUser?: string;
  passphrase?: string;
  privateKey?: string;
  password?: string;
  command?: string;
};

/** Un servidor asociado a un proyecto/agente (id LP + display). Espeja
 *  `AssistantProjectServer` de WEB/assistant-api.ts. */
export type AssistantProjectServer = {
  id: string;
  name: string;
  host?: string;
};

/** Configuración de avatar Avataaars (DiceBear) — generado localmente, nunca por
 *  HTTP. Espeja `AvatarConfig` de WEB/assistant-api.ts. */
export type AvatarConfig = {
  seed?: string;
  top?: string;
  hairColor?: string;
  eyes?: string;
  eyebrows?: string;
  mouth?: string;
  skinColor?: string;
  clothing?: string;
  clothesColor?: string;
  accessories?: string;
  facialHair?: string;
  facialHairColor?: string;
};

/** Overrides de skills por-agente/por-proyecto: skillId → {enabled, options}. */
export type AssistantSkillsMap = Record<string, { enabled?: boolean; options?: Record<string, string> }>;

/**
 * Agente IA personalizado (espejo redactado de `AssistantAgent` de
 * WEB/assistant-api.ts). El `credential.secret` NUNCA viaja al cliente: la API
 * devuelve solo `hasSecret`.
 */
export type AssistantAgent = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  providerId: AssistantProviderId;
  /** Proveedores extra para fan-out multi-agente. */
  providerIds?: AssistantProviderId[];
  /** "multi" replica este mismo agente N veces en paralelo; "single" = uno. */
  agentMode?: "single" | "multi";
  /** Modo multi: número de copias en paralelo (2–8). */
  multiAgentCount?: number;
  model: string;
  /** Tool names permitidos; null = sin restricción (toda tool permitida). */
  allowedTools: string[] | null;
  icon?: string;
  color?: string;
  /** Configuración Avataaars (generada localmente); ausente = derivada del id. */
  avatarConfig?: AvatarConfig;
  /** Directorios de trabajo (rutas absolutas) anunciados al agente. */
  projectPaths?: string[];
  /** Servidores remotos sobre los que puede actuar (servers.* tools). */
  servers?: AssistantProjectServer[];
  /** Proyectos adjuntos — cualquier nodo del árbol; un padre implica su subárbol. */
  projectIds?: string[];
  /** Proyectos cuyo índice de grafo de código usa este agente (solo "ready"). */
  graphProjectIds?: string[];
  /** Guardar resúmenes de ejecución en el vault Obsidian del proyecto adjunto. */
  autoCapture?: boolean;
  /** Override de skills por-agente (solo en sus chats), sobre el global. */
  skills?: AssistantSkillsMap;
  /** Rol asignado (perfil reutilizable). null = ninguno. */
  roleId?: string | null;
  /** Equipo de primera clase asignado. undefined = nunca asignado; null =
   *  quitado explícitamente; string = miembro de ese equipo. */
  teamId?: string | null;
  /** Agente superior ("padre") — este agente le está subordinado. null = tope. */
  parentAgentId?: string | null;
  /** True si tiene ≥1 subordinado directo (derivado del servidor). */
  isTeamLeader?: boolean;
  /** Ids de los subordinados DIRECTOS (derivado del servidor). */
  subordinateIds?: string[];
  /** Proyecto propietario (id + nombre), poblado por el servidor SOLO para un
   *  líder de proyecto/equipo. undefined/null para subordinados y sueltos. */
  project?: { id: string; name: string } | null;
  /** Ids de agentes pares conectados (canal bidireccional). */
  connections?: string[];
  /** Permiso de supervisor: puede abrir chats reales para sus subordinados. */
  canSpawnChats?: boolean;
  /** Sesión en tiempo real de baja latencia (solo proveedores realtime-capaces). */
  realtime?: boolean;
  /** Procedencia: plantilla de equipo de la que se materializó (si aplica). */
  templateId?: string;
  /** Procedencia: el slot/nodo de la plantilla que cubre. */
  templateNodeKey?: string;
  /** Credencial de pruebas ÚNICA (login QA) — SIEMPRE redactada por la API. */
  credential?: { label?: string; username: string; hasSecret: true } | null;
  /** Pre-filtro de snippets de terminal: NOMBRE de categoría ("" = sin filtro). */
  snippetCategory?: string;
  /** Pre-filtro de snippets de terminal: NOMBRES de tags de esa categoría. */
  snippetTags?: string[];
  createdAt?: string;
  updatedAt?: string;
  ownerId?: number | null;
  relation?: "owner" | "shared";
  ownerName?: string | null;
};

/** Rol reutilizable asignable a agentes (espeja `AssistantAgentRole` del web). */
export type AgentRole = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  allowedTools: string[] | null;
  icon?: string;
  color?: string;
  /** Cargo: los agentes con este rol pueden abrir chats para subordinados. */
  canSpawnChats?: boolean;
  createdAt?: string;
  updatedAt?: string;
  ownerId?: number | null;
  relation?: "owner" | "shared";
  ownerName?: string | null;
};

/** Borrador IA de un agente a partir de un brief corto (`/agents/suggest`). */
export type AgentSuggestion = {
  name: string;
  description: string;
  systemPrompt: string;
  allowedTools: string[] | null;
  providerId?: AssistantProviderId;
};

/** Equipo de primera clase (agrupación persistida de agentes). Espeja `AgentTeam`. */
export type AgentTeam = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  ownerId?: number | null;
  relation?: "owner" | "shared";
  ownerName?: string | null;
  /** Nº de agentes asignados a este equipo (derivado del servidor). */
  memberCount?: number;
};

// ── Payloads (calcan el schema del backend web) ──────────────────────────────

export type AgentPayload = {
  name: string;
  description: string;
  systemPrompt: string;
  providerId: AssistantProviderId;
  providerIds?: AssistantProviderId[];
  agentMode?: "single" | "multi";
  multiAgentCount?: number;
  model: string;
  allowedTools: string[] | null;
  icon?: string;
  color?: string;
  avatarConfig?: AvatarConfig;
  projectPaths?: string[];
  servers?: AssistantProjectServer[];
  projectIds?: string[];
  graphProjectIds?: string[];
  autoCapture?: boolean;
  skills?: AssistantSkillsMap;
  roleId?: string | null;
  teamId?: string | null;
  parentAgentId?: string | null;
  connections?: string[];
  canSpawnChats?: boolean;
  realtime?: boolean;
  /** Credencial de pruebas: objeto = reemplazar, null = quitar, ausente = conservar. */
  credential?: { label?: string; username: string; secret: string } | null;
  snippetCategory?: string;
  snippetTags?: string[];
};

export type AgentRolePayload = {
  name: string;
  description: string;
  systemPrompt: string;
  allowedTools: string[] | null;
  icon?: string;
  color?: string;
  canSpawnChats?: boolean;
};

export type AgentTeamPayload = {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
};

// ── Proyectos + módulos (subconjunto que el editor de agentes consume) ───────

export type StructureProviderId = "claude" | "codex" | "gemini";

export type AssistantProjectGraphIndex = {
  enabled: boolean;
  project?: string;
  status?: "idle" | "indexing" | "ready" | "error";
  lastIndexedAt?: string;
  nodes?: number;
  edges?: number;
  error?: string;
  indexedPath?: string;
};

export type AssistantProject = {
  id: string;
  title: string;
  icon: string;
  path: string;
  instructions: string;
  provider: StructureProviderId;
  parentId?: string | null;
  servers?: AssistantProjectServer[];
  autoCapture?: boolean;
  skills?: AssistantSkillsMap;
  suggestions?: string[];
  createdAt?: string;
  updatedAt?: string;
  ownerId?: number | null;
  relation?: "owner" | "shared";
  ownerName?: string | null;
  graphIndex?: AssistantProjectGraphIndex;
  snippetCategory?: string;
  snippetTags?: string[];
};

/** Descriptor de una tool de un módulo (para el selector de herramientas). */
export type AgentModuleToolDescriptor = {
  name: string;
  title: string;
  description: string;
  kind: "read" | "action";
  dangerous: boolean;
  permission?: string;
  enabled: boolean;
  requireConfirm: boolean;
};

/** Descriptor de un panel de datos de un módulo (paridad con la web). */
export type AgentModuleDataPanelDescriptor = {
  name: string;
  title: string;
  description: string;
};

/** Módulo resuelto con sus tools (respuesta de `/api/ai/modules`). Distinto del
 *  `ResolvedModule` simple usado por otros sub-tabs. */
export type AgentResolvedModule = {
  moduleId: string;
  enabled: boolean;
  tools: AgentModuleToolDescriptor[];
  /** Paneles de datos que expone el módulo (opcional; la web los lista). */
  dataPanels?: AgentModuleDataPanelDescriptor[];
};

/** Modo de autenticación de un servidor registrado. */
export type RegisteredAuthType = "key" | "password";

/** Servidor registrado en la pestaña "Servidores" del asistente. */
export type RegisteredServerView = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: RegisteredAuthType;
  hasPassphrase: boolean;
  createdAt?: string;
  updatedAt?: string;
};

/** Payload de alta/edición de un servidor registrado. El secreto es write-only
 *  (nunca vuelve en el `View`); omitirlo en edición conserva el almacenado. */
export type RegisteredServerPayload = {
  name: string;
  host: string;
  port: number;
  username: string;
  authType: RegisteredAuthType;
  /** Clave privada PEM o contraseña en claro. Omitir en edición = conservar. */
  secret?: string;
  /** Passphrase en claro (auth por clave). */
  passphrase?: string | null;
};

// ── Plantillas de equipo ("Grupos rápidos de agentes") ───────────────────────

export type TeamTemplateCategory =
  | "web"
  | "app"
  | "desktop"
  | "backend"
  | "automatizaciones"
  | "bots-ia"
  | "devops"
  | "librerias"
  | "iot"
  | "videojuegos";

export type TeamTemplateLocale =
  | "es" | "en" | "fr" | "de" | "it" | "pt" | "ar" | "bn" | "hi" | "ja" | "ko" | "ru";

export type TeamTemplateTag = {
  id: string;
  label: string;
  hint?: string;
};

export type TeamTemplateCategoryDef = {
  id: TeamTemplateCategory;
  label: string;
  icon: string;
  color: string;
  tags: TeamTemplateTag[];
};

export type TeamTemplateSlotSummary = {
  slotId: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  avatarConfig?: AvatarConfig;
  parentSlotId: string | null;
  connectionSlotIds?: string[];
  agentMode?: "single" | "multi";
  multiAgentCount?: number;
};

export type TeamTemplateSlotTranslation = {
  name: string;
  description: string;
  systemPrompt: string;
};

export type TeamTemplateTranslation = {
  name: string;
  description: string;
  /** Traducciones de slots por `slotId`. Ids ausentes caen al español. */
  slots: Record<string, TeamTemplateSlotTranslation>;
};

export type TeamTemplateSummary = {
  id: string;
  category: TeamTemplateCategory;
  tags: string[];
  name: string;
  description: string;
  icon: string;
  color: string;
  defaultProvider?: AssistantProviderId;
  defaultModel?: string;
  recommendMultiAgent?: boolean;
  slotCount: number;
  slots: TeamTemplateSlotSummary[];
  translations?: Partial<Record<TeamTemplateLocale, TeamTemplateTranslation>>;
};

export type TeamTemplateSlot = TeamTemplateSlotSummary & {
  systemPrompt: string;
  allowedTools: string[] | null;
  canSpawnChats?: boolean;
};

export type TeamTemplate = Omit<TeamTemplateSummary, "slots"> & {
  slots: TeamTemplateSlot[];
  defaultProjectPaths?: string[];
};

export type ApplySlotOverrides = {
  name?: string;
  description?: string;
  systemPrompt?: string;
  providerId?: AssistantProviderId;
  model?: string;
  allowedTools?: string[] | null;
  icon?: string;
  color?: string;
  avatarConfig?: AvatarConfig;
  projectPaths?: string[];
  agentMode?: "single" | "multi";
  multiAgentCount?: number;
  realtime?: boolean;
};

export type ApplyDefaults = {
  providerId?: AssistantProviderId;
  model?: string;
  projectPaths?: string[];
};

export type ApplyRequest = {
  slotOverrides?: Record<string, ApplySlotOverrides>;
  defaults?: ApplyDefaults;
  rootCanSpawnChats?: boolean;
  namePrefix?: string;
};

export type ApplyResult = {
  agents: AssistantAgent[];
  createdIds: string[];
};

export type TeamTemplateResyncResult = {
  markersMissing: boolean;
  missing: Array<{ slotId: string; name: string; description: string }>;
  present: Array<{ slotId: string; agentId: string; name: string }>;
  extra: Array<{ agentId: string; name: string }>;
};

export type TeamTemplateFeedbackStats = {
  total: number;
  up: number;
  /** 0..1 proporción de valoraciones positivas. */
  ratio: number;
  byNode?: Record<string, { total: number; up: number }>;
};

/** Proveedores con sesión realtime (espeja REALTIME_PROVIDERS del web). */
export const REALTIME_PROVIDERS: readonly AssistantProviderId[] = ["codex", "gemini"];

export type SkillOption = {
  key: string;
  label: string;
  choices: { value: string; label: string }[];
  value: string;
};

export type AssistantSkill = {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryLabel: string;
  kind: "prompt-block" | "behavior";
  enabled: boolean;
  options: SkillOption[];
};

export type ResolvedModule = {
  id: string;
  name: string;
  enabled: boolean;
  active?: boolean;
};

export type UsageCostModel = {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  total: number;
  count: number;
  usd: number;
  known: boolean;
};

export type UsageCost = {
  totalUsd: number;
  models: UsageCostModel[];
  byProvider: Array<{ provider: string; usd: number; inputTokens: number; outputTokens: number }>;
};
