/**
 * i18n compacto (es/en) de la Bitácora / Hoja de vida del portal (desktop).
 * Espejo del `portal-worklog.ts` de web y del helper del app. Otros idiomas caen
 * a inglés; la paridad completa se hace en la fase de pulido.
 */
export type WorklogStrings = {
  title: string;
  statTotalActions: string; statTotalActionsMeta: string;
  statActiveSince: string; statActiveSinceMeta: string;
  statStacks: string; statStacksMeta: string;
  statServers: string; statServersMeta: string;
  techProfile: string; workAreas: string; stacksTech: string;
  allServers: string;
  levelAll: string; levelDay: string; levelWeek: string; levelMonth: string;
  levelYear: string; levelLustrum: string; levelDecade: string;
  loading: string; loadError: string; forbidden: string; empty: string;
  aiSummary: string; week: string;
  unitAction: string; unitActions: string; unitSession: string; unitSessions: string;
  unitMin: string; unitAiRun: string; unitAiRuns: string;
};

const STR: Record<string, WorklogStrings> = {
  es: {
    title: "Bitácora",
    statTotalActions: "Acciones totales", statTotalActionsMeta: "Registradas en tu bitácora",
    statActiveSince: "Activo desde", statActiveSinceMeta: "Primera actividad",
    statStacks: "Stacks", statStacksMeta: "Tecnologías usadas",
    statServers: "Servidores", statServersMeta: "Con actividad",
    techProfile: "Perfil técnico", workAreas: "Áreas de trabajo", stacksTech: "Stacks y tecnologías",
    allServers: "Todos los servidores",
    levelAll: "Todo", levelDay: "Días", levelWeek: "Semanas", levelMonth: "Meses",
    levelYear: "Años", levelLustrum: "Quinquenios", levelDecade: "Décadas",
    loading: "Cargando…", loadError: "No se pudo cargar la bitácora. Inténtalo de nuevo.",
    forbidden: "No tienes permiso para ver la bitácora.",
    empty: "Aún no hay actividad registrada. La bitácora se construye automáticamente con tu trabajo real en los paneles.",
    aiSummary: "IA ✦", week: "Semana",
    unitAction: "acción", unitActions: "acciones", unitSession: "sesión", unitSessions: "sesiones",
    unitMin: "min", unitAiRun: "ejecución IA", unitAiRuns: "ejecuciones IA",
  },
  en: {
    title: "Worklog",
    statTotalActions: "Total actions", statTotalActionsMeta: "Recorded in your worklog",
    statActiveSince: "Active since", statActiveSinceMeta: "First activity",
    statStacks: "Stacks", statStacksMeta: "Technologies used",
    statServers: "Servers", statServersMeta: "With activity",
    techProfile: "Technical profile", workAreas: "Work areas", stacksTech: "Stacks & technologies",
    allServers: "All servers",
    levelAll: "All", levelDay: "Days", levelWeek: "Weeks", levelMonth: "Months",
    levelYear: "Years", levelLustrum: "Lustrums", levelDecade: "Decades",
    loading: "Loading…", loadError: "Couldn't load the worklog. Please try again.",
    forbidden: "You don't have permission to view the worklog.",
    empty: "No activity recorded yet. The worklog is built automatically from your real work on the panels.",
    aiSummary: "AI ✦", week: "Week",
    unitAction: "action", unitActions: "actions", unitSession: "session", unitSessions: "sessions",
    unitMin: "min", unitAiRun: "AI run", unitAiRuns: "AI runs",
  },
};

export function worklogStrings(locale?: string): WorklogStrings {
  return STR[(locale ?? "es").slice(0, 2)] ?? STR.es;
}

/** Etiqueta + color de cada categoría de trabajo (espejo de web). */
export const WORKLOG_CATEGORY_META: Record<string, { es: string; en: string; color: string }> = {
  deploy: { es: "Despliegues", en: "Deployments", color: "#059669" },
  maintenance: { es: "Mantenimiento", en: "Maintenance", color: "#0ea5e9" },
  configuration: { es: "Configuración", en: "Configuration", color: "#8b5cf6" },
  security: { es: "Seguridad", en: "Security", color: "#ef4444" },
  files: { es: "Archivos", en: "Files", color: "#f59e0b" },
  database: { es: "Bases de datos", en: "Databases", color: "#6366f1" },
  mail: { es: "Correo", en: "Mail", color: "#14b8a6" },
  web: { es: "Web", en: "Web", color: "#3b82f6" },
  dns: { es: "DNS", en: "DNS", color: "#a855f7" },
  backup: { es: "Backups", en: "Backups", color: "#10b981" },
  monitoring: { es: "Monitoreo", en: "Monitoring", color: "#06b6d4" },
  automation: { es: "Automatización", en: "Automation", color: "#f97316" },
  ai_assisted: { es: "Asistido por IA", en: "AI-assisted", color: "#ec4899" },
  access: { es: "Accesos", en: "Access", color: "#64748b" },
  other: { es: "Otros", en: "Other", color: "#9ca3af" },
};

export function worklogCategoryLabel(category: string, locale?: string): { label: string; color: string } {
  const meta = WORKLOG_CATEGORY_META[category];
  if (!meta) return { label: category, color: "#9ca3af" };
  return { label: (locale ?? "es").slice(0, 2) === "en" ? meta.en : meta.es, color: meta.color };
}

export const WORKLOG_LEVEL_COLOR: Record<string, string> = {
  day: "#059669", week: "#0ea5e9", month: "#8b5cf6",
  year: "#f59e0b", lustrum: "#ec4899", decade: "#ef4444",
};

export function worklogLevelLabel(t: WorklogStrings, level: string): string {
  switch (level) {
    case "day": return t.levelDay;
    case "week": return t.levelWeek;
    case "month": return t.levelMonth;
    case "year": return t.levelYear;
    case "lustrum": return t.levelLustrum;
    case "decade": return t.levelDecade;
    default: return level;
  }
}
