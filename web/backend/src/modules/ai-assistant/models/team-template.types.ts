// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Team templates — "Grupos rápidos de agentes".
 *
 * A TeamTemplate is a READ-ONLY, versioned-with-the-code BLUEPRINT of a full
 * agent hierarchy (a CEO + N specialists) that the user can materialise into
 * REAL `AssistantAgent` records with one click. Templates themselves are
 * curated content (seed under `seed/team-templates.seed.ts`) — they never live
 * in a sidecar and are never mutated by users. The apply operation persists
 * the resulting agents under the per-server `assistant/agents.json` sidecar
 * (reusing the existing `AssistantAgent` shape — no new fields added).
 *
 * Why a separate shape: keeping the template tree as slot references
 * (`parentSlotId`) rather than concrete agent ids makes the blueprint
 * transferable across instances, languages and overrides — at apply time we
 * walk the slots in topological order, create each agent, and rewire the
 * parent/connection ids to the freshly-minted records.
 */
import type { AssistantProviderId } from "./assistant-config.types.js";
import type { AvatarConfig } from "./assistant-agent.types.js";

/**
 * Category id — corresponds to a top-level project family (Web, Apps móviles,
 * etc.). Hardcoded because the taxonomy is a product decision; adding a new
 * category means a deliberate code change. UI uses this to filter tags.
 */
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

export interface TeamTemplateTag {
  /** Stable id, namespaced by category: "web:landing", "app:native", … */
  id: string;
  /** Spanish label (i18n key basename; frontend may translate). */
  label: string;
  /** Optional shorter hint shown beneath the chip. */
  hint?: string;
}

export interface TeamTemplateCategoryDef {
  id: TeamTemplateCategory;
  /** Spanish label for the category tab. */
  label: string;
  /** Lucide icon name (kebab-case, e.g. "globe", "smartphone"). */
  icon: string;
  /** One of the COLOR_PRESETS used in the frontend. */
  color: string;
  tags: TeamTemplateTag[];
}

/**
 * One slot in the template. The `slotId` is stable per template (used by the
 * frontend reorder/preview) and is resolved to a REAL agent id at apply time.
 */
export interface TemplateAgentSlot {
  /** Stable id inside the template, e.g. "ceo", "frontend". */
  slotId: string;
  /** Display name (Spanish default; frontend may translate). */
  name: string;
  /** Short description (≤200 chars). */
  description: string;
  /** The system-prompt block of THIS slot (injected verbatim at apply time). */
  systemPrompt: string;
  /** Tools this slot may use. `null` = no narrowing (CEO defaults to null). */
  allowedTools: string[] | null;
  /** Lucide icon name. */
  icon: string;
  /** Color preset (matches `COLOR_PRESETS` in the frontend). */
  color: string;
  /** Optional Avataaars avatar config for this slot. Absent = the materialised
   *  agent gets a deterministic avatar seeded with its id. See {@link AvatarConfig}. */
  avatarConfig?: AvatarConfig;
  /**
   * Slot id of the superior slot inside THIS template (peer slot ids only —
   * they are validated against the template's `slots` array at apply time).
   * `null` = root (CEO / head of team). The template MUST have exactly one
   * root; the apply service enforces this.
   */
  parentSlotId: string | null;
  /** Peer slot ids this slot is bidirectionally connected to (≤8). */
  connectionSlotIds?: string[];
  /**
   * Hint only — the apply service forces `canSpawnChats: true` on the root
   * regardless of this flag (defence in depth: the tree only makes sense if
   * the head can spawn chats or delegate to its subordinates).
   */
  canSpawnChats?: boolean;
  /** Multi-agent mode toggle. Defaults to "single". */
  agentMode?: "single" | "multi";
  /** When `agentMode === "multi"`, how many copies (2–8). */
  multiAgentCount?: number;
}

/**
 * Locale id used for per-template translations. Mirrors the frontend
 * `LocaleCode` set in `i18n/config.ts` — keep both in sync. The seed is
 * authored in Spanish (`es`); the other locales are produced by the
 * background translator and stored under `translations`.
 */
export type TeamTemplateLocale =
  | "es"
  | "en"
  | "fr"
  | "de"
  | "it"
  | "pt"
  | "ar"
  | "bn"
  | "hi"
  | "ja"
  | "ko"
  | "ru";

/** Localised label set for a single template slot. */
export interface TemplateSlotTranslation {
  name: string;
  description: string;
  systemPrompt: string;
}

/** Localised label set for one whole template (all slots keyed by slotId). */
export interface TeamTemplateTranslation {
  name: string;
  description: string;
  /** Slot translations keyed by `slotId`. Missing slot ids fall back to Spanish. */
  slots: Record<string, TemplateSlotTranslation>;
}

export interface TeamTemplate {
  /** Stable id, e.g. "web-generic", "app-mobile", "devops-nginx". */
  id: string;
  category: TeamTemplateCategory;
  /** Tag ids this template applies to. Empty array = matches all tags in the category. */
  tags: string[];
  name: string;
  description: string;
  icon: string;
  color: string;
  slots: TemplateAgentSlot[];
  /** Default provider if the user doesn't pick one. Defaults to "claude". */
  defaultProvider?: AssistantProviderId;
  /** Default model id; empty string = provider default. */
  defaultModel?: string;
  /** Working paths pre-filled into every slot (user can edit per slot). */
  defaultProjectPaths?: string[];
  /** Hint chip: this template BENEFITS from multi-agent orchestration. */
  recommendMultiAgent?: boolean;
  /**
   * Optional per-locale translations of `name`, `description` and every slot's
   * `name`/`description`/`systemPrompt`. The list/get endpoints always echo
   * this back to the frontend so the wizard can render in the user's active
   * platform locale (otherwise everything stays Spanish). Generated offline by
   * the seed-translation pipeline; stored verbatim — never re-translated at
   * runtime (the backend seed is the source of truth; the runtime translator
   * is for chat replies, not config strings).
   *
   * The Spanish entry MAY be omitted — the seed values themselves are the
   * Spanish source of truth. The frontend falls back to the seed strings when
   * a locale or slot is missing.
   */
  translations?: Partial<Record<TeamTemplateLocale, TeamTemplateTranslation>>;
}

/**
 * Full catalogue of categories + tags, used by the wizard for the category
 * picker (step 1) and tag filter (step 2). The labels are Spanish defaults;
 * the frontend provides translations for all 6 supported locales.
 */
export const TEAM_TEMPLATE_CATEGORIES: TeamTemplateCategoryDef[] = [
  {
    id: "web",
    label: "Web",
    icon: "globe",
    color: "blue",
    tags: [
      { id: "web:landing", label: "Landing page" },
      { id: "web:corporativo", label: "Corporativo" },
      { id: "web:ecommerce", label: "E-commerce" },
      { id: "web:marketplace", label: "Marketplace" },
      { id: "web:blog", label: "Blog" },
      { id: "web:portal", label: "Portal" },
      { id: "web:saas", label: "SaaS" },
      { id: "web:dashboard", label: "Dashboard" },
      { id: "web:webapp", label: "Web app" },
      { id: "web:portfolio", label: "Portfolio" },
      { id: "web:institucional", label: "Institucional" },
      { id: "web:reservas", label: "Reservas" },
      { id: "web:lms", label: "LMS" },
      { id: "web:foro", label: "Foro" },
      { id: "web:comunidad", label: "Comunidad" },
      { id: "web:membresia", label: "Membresía" },
      { id: "web:noticias", label: "Noticias" },
      { id: "web:wiki", label: "Wiki" },
      { id: "web:helpcenter", label: "Help center" },
      { id: "web:microsite", label: "Microsite" },
      { id: "web:onepage", label: "One page" },
      { id: "web:pwa", label: "PWA" },
      { id: "web:multilang", label: "Multilenguaje" },
      { id: "web:seo", label: "SEO programática" },
    ],
  },
  {
    id: "app",
    label: "Apps móviles",
    icon: "smartphone",
    color: "violet",
    tags: [
      { id: "app:nativa", label: "Nativa" },
      { id: "app:hibrida", label: "Híbrida" },
      { id: "app:pwa", label: "PWA" },
      { id: "app:saas", label: "SaaS app" },
      { id: "app:marketplace", label: "Marketplace" },
      { id: "app:ecommerce", label: "E-commerce app" },
      { id: "app:delivery", label: "Delivery" },
      { id: "app:reservas", label: "Reservas" },
      { id: "app:fintech", label: "Fintech" },
      { id: "app:educativa", label: "Educativa" },
      { id: "app:salud", label: "Salud" },
      { id: "app:fitness", label: "Fitness" },
      { id: "app:transporte", label: "Transporte" },
      { id: "app:logistica", label: "Logística" },
      { id: "app:productividad", label: "Productividad" },
      { id: "app:crm", label: "CRM" },
      { id: "app:erp", label: "ERP" },
      { id: "app:mensajeria", label: "Mensajería" },
      { id: "app:redsocial", label: "Red social" },
      { id: "app:streaming", label: "Streaming" },
      { id: "app:noticias", label: "Noticias" },
      { id: "app:eventos", label: "Eventos" },
      { id: "app:juegos", label: "Juegos" },
      { id: "app:iot", label: "IoT" },
      { id: "app:ia", label: "IA" },
    ],
  },
  {
    id: "desktop",
    label: "Desktop",
    icon: "monitor",
    color: "slate",
    tags: [
      { id: "desktop:nativa", label: "Nativa" },
      { id: "desktop:multiplataforma", label: "Multiplataforma" },
      { id: "desktop:empresarial", label: "Empresarial" },
      { id: "desktop:administrativa", label: "Administrativa" },
      { id: "desktop:crm", label: "CRM" },
      { id: "desktop:erp", label: "ERP" },
      { id: "desktop:pos", label: "POS" },
      { id: "desktop:contable", label: "Contable" },
      { id: "desktop:inventario", label: "Inventario" },
      { id: "desktop:facturacion", label: "Facturación" },
      { id: "desktop:dashboard", label: "Dashboard" },
      { id: "desktop:productividad", label: "Productividad" },
      { id: "desktop:automatizacion", label: "Automatización" },
      { id: "desktop:monitoreo", label: "Monitoreo" },
      { id: "desktop:seguridad", label: "Seguridad" },
      { id: "desktop:backup", label: "Backup" },
      { id: "desktop:edicion", label: "Edición" },
      { id: "desktop:diseno", label: "Diseño" },
      { id: "desktop:cad", label: "CAD" },
      { id: "desktop:ide", label: "IDE" },
      { id: "desktop:terminal", label: "Terminal" },
      { id: "desktop:offline", label: "Offline" },
      { id: "desktop:clienteservidor", label: "Cliente-servidor" },
      { id: "desktop:ia", label: "IA" },
    ],
  },
  {
    id: "backend",
    label: "Backend/APIs",
    icon: "server",
    color: "emerald",
    tags: [
      { id: "backend:rest", label: "REST API" },
      { id: "backend:graphql", label: "GraphQL API" },
      { id: "backend:microservicios", label: "Microservicios" },
      { id: "backend:webhooks", label: "Webhooks" },
      { id: "backend:autenticacion", label: "Autenticación" },
      { id: "backend:pagos", label: "Pagos" },
      { id: "backend:notificaciones", label: "Notificaciones" },
      { id: "backend:saas", label: "SaaS backend" },
      { id: "backend:middleware", label: "Middleware" },
      { id: "backend:integracion", label: "Integración con terceros" },
    ],
  },
  {
    id: "automatizaciones",
    label: "Automatizaciones",
    icon: "cog",
    color: "amber",
    tags: [
      { id: "auto:scripts", label: "Scripts" },
      { id: "auto:cronjobs", label: "Cronjobs" },
      { id: "auto:workers", label: "Workers" },
      { id: "auto:colas", label: "Colas de tareas" },
      { id: "auto:etl", label: "ETL" },
      { id: "auto:scraping", label: "Scraping" },
      { id: "auto:crawlers", label: "Crawlers" },
      { id: "auto:bots", label: "Bots operativos" },
      { id: "auto:pipelines", label: "Pipelines de datos" },
    ],
  },
  {
    id: "bots-ia",
    label: "Bots/IA",
    icon: "bot",
    color: "pink",
    tags: [
      { id: "bots:chatbots", label: "Chatbots" },
      { id: "bots:agentes", label: "Agentes IA" },
      { id: "bots:asistentes", label: "Asistentes virtuales" },
      { id: "bots:whatsapp", label: "Bots de WhatsApp" },
      { id: "bots:telegram", label: "Bots de Telegram" },
      { id: "bots:discord", label: "Bots de Discord" },
      { id: "bots:voz", label: "Asistentes de voz" },
      { id: "bots:generacion", label: "Generación de contenido" },
    ],
  },
  {
    id: "devops",
    label: "DevOps/Servidor",
    icon: "wrench",
    color: "cyan",
    tags: [
      { id: "devops:nginx", label: "Nginx" },
      { id: "devops:docker", label: "Docker" },
      { id: "devops:cicd", label: "CI/CD" },
      { id: "devops:monitoreo", label: "Monitoreo" },
      { id: "devops:backups", label: "Backups" },
      { id: "devops:iac", label: "Infraestructura como código" },
      { id: "devops:despliegues", label: "Despliegues" },
      { id: "devops:archivos", label: "Servidores de archivos" },
      { id: "devops:seguridad", label: "Seguridad" },
    ],
  },
  {
    id: "librerias",
    label: "Librerías/SDKs",
    icon: "package",
    color: "amber",
    tags: [
      { id: "lib:npm", label: "Paquetes NPM" },
      { id: "lib:python", label: "Paquetes Python" },
      { id: "lib:sdk", label: "SDKs" },
      { id: "lib:plugins", label: "Plugins" },
      { id: "lib:extensiones", label: "Extensiones" },
      { id: "lib:componentes", label: "Componentes reutilizables" },
    ],
  },
  {
    id: "iot",
    label: "IoT/Embebidos",
    icon: "cpu",
    color: "teal",
    tags: [
      { id: "iot:firmware", label: "Firmware" },
      { id: "iot:sensores", label: "Sensores" },
      { id: "iot:gateways", label: "Gateways" },
      { id: "iot:paneles", label: "Paneles IoT" },
      { id: "iot:mqtt", label: "Comunicación MQTT" },
      { id: "iot:industrial", label: "Automatización industrial" },
    ],
  },
  {
    id: "videojuegos",
    label: "Videojuegos",
    icon: "gamepad-2",
    color: "red",
    tags: [
      { id: "games:2d", label: "2D" },
      { id: "games:3d", label: "3D" },
      { id: "games:multiplayer", label: "Multiplayer" },
      { id: "games:servidor", label: "Servidor de juego" },
      { id: "games:leaderboard", label: "Leaderboard" },
      { id: "games:matchmaking", label: "Matchmaking" },
    ],
  },
];