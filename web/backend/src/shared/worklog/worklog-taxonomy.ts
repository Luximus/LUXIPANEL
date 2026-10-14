// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Worklog taxonomy — maps panel module ids and event-bus events to the
 * category/stacks/action vocabulary of LP's worklog contract
 * (`POST /panel-api/service/worklog/events`).
 *
 * Pure data + lookups: no I/O, no side effects. The recorder normalizes any
 * category outside `WORKLOG_CATEGORIES` to "other", so additions here are
 * always forward-safe.
 */

export const WORKLOG_CATEGORIES = [
  "deploy",
  "maintenance",
  "configuration",
  "security",
  "files",
  "database",
  "mail",
  "web",
  "dns",
  "backup",
  "monitoring",
  "automation",
  "ai_assisted",
  "access",
  "other",
] as const;

export type WorklogCategory = (typeof WORKLOG_CATEGORIES)[number];

export interface ModuleTaxonomy {
  category: WorklogCategory;
  stacks: string[];
}

/** moduleId → { category, stacks } for every module shipped in src/modules. */
const MODULE_TAXONOMY: Record<string, ModuleTaxonomy> = {
  // Web / hosting
  nginx: { category: "web", stacks: ["nginx"] },
  hosting: { category: "web", stacks: ["nginx"] },
  // DNS (legacy slug — the NGINX manager keeps "dns" as permission slug)
  dns: { category: "dns", stacks: ["dns"] },
  // Cloudflare (zones/DNS/cache/access rules via the CF v4 API)
  cloudflare: { category: "dns", stacks: ["cloudflare"] },
  // Mail
  mail: { category: "mail", stacks: ["postfix", "dovecot"] },
  // Databases
  databases: { category: "database", stacks: ["mysql", "postgresql"] },
  // Security
  firewall: { category: "security", stacks: ["ufw"] },
  ssl: { category: "security", stacks: ["certbot"] },
  certbot: { category: "security", stacks: ["certbot"] },
  bitninja: { category: "security", stacks: [] },
  "security-audit": { category: "security", stacks: [] },
  "secret-rotation": { category: "security", stacks: [] },
  sudo: { category: "security", stacks: [] },
  // Files / git
  files: { category: "files", stacks: ["git"] },
  github: { category: "files", stacks: ["git"] },
  "repository-store": { category: "files", stacks: ["git"] },
  // Automation
  cron: { category: "automation", stacks: ["cron"] },
  webhooks: { category: "automation", stacks: [] },
  // Backup / monitoring
  backup: { category: "backup", stacks: [] },
  backups: { category: "backup", stacks: [] },
  monitor: { category: "monitoring", stacks: [] },
  // Configuration
  users: { category: "configuration", stacks: [] },
  roles: { category: "configuration", stacks: [] },
  admin: { category: "configuration", stacks: [] },
  settings: { category: "configuration", stacks: [] },
  notifications: { category: "configuration", stacks: [] },
  mcp: { category: "configuration", stacks: [] },
  community: { category: "configuration", stacks: [] },
  // Maintenance
  terminal: { category: "maintenance", stacks: [] },
  "terminal-cli": { category: "maintenance", stacks: [] },
  "system-deps": { category: "maintenance", stacks: [] },
  // AI
  "ai-assistant": { category: "ai_assisted", stacks: [] },
  openclaw: { category: "ai_assisted", stacks: [] },
  // Access
  ssh: { category: "access", stacks: [] },
  auth: { category: "access", stacks: [] },
};

const DEFAULT_TAXONOMY: ModuleTaxonomy = { category: "other", stacks: [] };

/** Category + stacks for a panel module id ("other" when unknown). */
export function taxonomyFor(moduleId: string): ModuleTaxonomy {
  return MODULE_TAXONOMY[moduleId] ?? DEFAULT_TAXONOMY;
}

export interface EventTaxonomy extends ModuleTaxonomy {
  module: string;
  action: string;
}

/**
 * Classify an interactive-shell command line as "notable" (worth a worklog
 * entry) or not. Deploy-shaped commands (git/docker/pm2) → "deploy"; the rest
 * of the notable set → "maintenance". Returns null for ordinary commands
 * (ls, cd, cat, …) which must NEVER be logged.
 */
export function classifyNotableCommand(command: string): { category: WorklogCategory } | null {
  const deployPatterns = [
    /^\s*(sudo\s+)?docker(\s+compose)?\s+(up|build|pull|restart|run)\b/,
    /^\s*(sudo\s+)?git\s+(pull|clone|checkout|merge)\b/,
    /^\s*(sudo\s+)?pm2\s+(restart|reload|start|stop|deploy)\b/,
  ];
  const maintenancePatterns = [
    /^\s*(sudo\s+)?(apt(-get)?|yum|dnf)\s+(install|upgrade|update|remove)\b/,
    /^\s*(sudo\s+)?systemctl\s+(restart|stop|start|enable|disable|reload)\b/,
    /^\s*(sudo\s+)?nginx\s+-(s|t)\b/,
    /^\s*(sudo\s+)?certbot\b/,
    /^\s*(sudo\s+)?(mysqldump|pg_dump)\b/,
    /^\s*(sudo\s+)?mysql\s+</,
    /^\s*(sudo\s+)?psql\s+</,
    /^\s*(sudo\s+)?(reboot|shutdown)\b/,
  ];
  if (deployPatterns.some((re) => re.test(command))) return { category: "deploy" };
  if (maintenancePatterns.some((re) => re.test(command))) return { category: "maintenance" };
  return null;
}
