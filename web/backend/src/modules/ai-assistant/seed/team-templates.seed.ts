// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Seed catalogue of team templates — curated blueprints of agent hierarchies
 * the user can materialise with one click. READ-ONLY: loaded in memory at
 * boot, never persisted. To add/remove a template, edit this file and rebuild.
 *
 * Naming convention for slot ids: short, semantic, kebab-case
 * (ceo / director / frontend / backend / ux-ui / qa / mobile / backend-api /
 * mobile-design / mobile-qa / sre / nginx / devops / monitor / desktop / desktop-api /
 * desktop-qa / backend-api-only / db / docs / desktop-installer / api-auth-pagos /
 * notifications / orchestrator / bot-orchestrator / whatsapp-bot / telegram-bot /
 * discord-bot / voice-bot / media-bot / pipelines / firmware / mqtt / game-net /
 * game-design). Roots are always "ceo".
 *
 * The catalogue is split by category under `./templates/` (curated DATA,
 * verbatim). This file is the index: it re-assembles TEAM_TEMPLATES in the
 * ORIGINAL element order (ids/seeds may depend on it) — do not reorder.
 */
import type { TeamTemplate } from "../models/team-template.types.js";
import { WEB_GENERIC_TEMPLATES, WEB_VERTICAL_TEMPLATES } from "./templates/web.js";
import { APP_TEMPLATES } from "./templates/app.js";
import { DESKTOP_TEMPLATES } from "./templates/desktop.js";
import { BACKEND_TEMPLATES } from "./templates/backend.js";
import { AUTOMATIZACIONES_TEMPLATES } from "./templates/automatizaciones.js";
import { BOTS_IA_TEMPLATES } from "./templates/bots-ia.js";
import { DEVOPS_NGINX_TEMPLATES, DEVOPS_PLATFORM_TEMPLATES } from "./templates/devops.js";
import { LIBRERIAS_TEMPLATES } from "./templates/librerias.js";
import { IOT_TEMPLATES } from "./templates/iot.js";
import { VIDEOJUEGOS_TEMPLATES } from "./templates/videojuegos.js";

export const TEAM_TEMPLATES: TeamTemplate[] = [
  ...WEB_GENERIC_TEMPLATES, //      1) WEB — genérico
  ...APP_TEMPLATES, //              2) APPS MÓVILES
  ...DESKTOP_TEMPLATES, //          3) DESKTOP
  ...BACKEND_TEMPLATES, //          4) BACKEND/APIs
  ...AUTOMATIZACIONES_TEMPLATES, // 5) AUTOMATIZACIONES
  ...BOTS_IA_TEMPLATES, //          6) BOTS / IA
  ...DEVOPS_NGINX_TEMPLATES, //     7) DEVOPS — Nginx + operaciones
  ...LIBRERIAS_TEMPLATES, //        8) LIBRERÍAS / SDKs
  ...IOT_TEMPLATES, //              9) IoT / EMBEBIDOS
  ...VIDEOJUEGOS_TEMPLATES, //     10) VIDEOJUEGOS
  ...WEB_VERTICAL_TEMPLATES, //    11–17) WEB — verticales
  ...DEVOPS_PLATFORM_TEMPLATES, // 18) DEVOPS — Docker / CI-CD / IaC / Archivos
];
