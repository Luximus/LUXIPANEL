// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Sets canónicos de herramientas por arquetipo de slot, compartidos por todos
 * los team-templates. TODOS los nombres deben existir en el registro de
 * capacidades (guardia: seed/team-templates.seed.test.ts). Usa spread
 * (`[...TOOLS_X]`) en cada slot para no compartir referencias mutables.
 */

/** Lector/analista (UX/UI, docs, game design, análisis): solo lectura de archivos. */
export const TOOLS_READER = ["files.read", "files.list_dir", "files.grep"];

/** Implementador (frontend/backend/mobile/desktop/firmware): edita Y ejecuta build/test. */
export const TOOLS_IMPLEMENTER = [
  "files.read", "files.write", "files.list_dir", "files.grep", "files.mkdir",
  "admin.bash",
];

/** QA/tester: lee el código, ejecuta suites por shell, observa carga y puede
 *  verificar VISUALMENTE trabajo web (Chromium headless en el target).
 *  (monitor.snapshot/admin.health son DataPanels, NO tools — no van aquí.) */
export const TOOLS_QA = [
  "files.read", "files.list_dir", "files.grep", "admin.bash", "monitor.cpu_top",
  "browser.discover_urls", "browser.check", "browser.screenshot",
];

/** Operador DevOps/SRE ejecutor. */
export const TOOLS_DEVOPS = [
  "files.read", "files.write", "files.list_dir", "files.grep",
  "admin.bash", "admin.restart_service",
  "nginx.list_sites", "nginx.tail_access_log",
  "hosting.list_accounts", "hosting.account_stats",
  "monitor.cpu_top", "monitor.watchdog_status",
];

/** Administrador Nginx (vhosts/TLS; nginx -t y reload van por admin.bash). */
export const TOOLS_NGINX_ADMIN = [
  "files.read", "files.write", "files.list_dir", "files.grep",
  "admin.bash", "nginx.list_sites", "nginx.tail_access_log",
];

/** DBA: consultas + dumps/restores por shell. */
export const TOOLS_DBA = [
  "databases.list_databases", "databases.list_tables", "databases.run_query",
  "files.read", "files.list_dir", "files.grep", "admin.bash",
];

/** Monitorización y backups. */
export const TOOLS_MONITOR_BACKUP = [
  "monitor.cpu_top", "monitor.watchdog_status", "monitor.watchdog_configure",
  "cron.list", "files.read", "files.list_dir", "admin.bash",
];

/** Automatización/cron/workers. */
export const TOOLS_AUTOMATION = [
  "cron.list", "cron.add", "cron.update", "cron.toggle", "cron.remove",
  "files.read", "files.write", "files.list_dir", "files.grep", "admin.bash",
];
