# Declaraciones de rutas por módulo

Referencia estática generada el 2026-10-13. Cada enlace lleva al archivo fuente; la columna de ruta conserva expresiones y prefijos tal como se declaran. Para obtener una URL pública, revisar el montaje en index/server/app, middleware y permisos. No es un listado de rutas probadas ni una autorización para invocarlas.

## admin

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api` | [index.ts:19](../backend/src/modules/admin/index.ts) |
| GET | `/ui/switch-server-behavior` | [admin.routes.ts:40](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/ui/bootstrap` | [admin.routes.ts:41](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/ui/status` | [admin.routes.ts:50](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/ui/data/capabilities` | [admin.routes.ts:54](../backend/src/modules/admin/routes/admin.routes.ts) |
| POST | `/ui/data/refresh` | [admin.routes.ts:55](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/ui/layout` | [admin.routes.ts:56](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/ui/layout/asset` | [admin.routes.ts:57](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/ui/releases` | [admin.routes.ts:58](../backend/src/modules/admin/routes/admin.routes.ts) |
| USE | `/repository-store` | [admin.routes.ts:62](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/repository-store/state` | [admin.routes.ts:63](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/repository-store/config` | [admin.routes.ts:64](../backend/src/modules/admin/routes/admin.routes.ts) |
| PATCH | `/repository-store/preferences` | [admin.routes.ts:65](../backend/src/modules/admin/routes/admin.routes.ts) |
| POST | `/repository-store/saved` | [admin.routes.ts:66](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/repository-store/search` | [admin.routes.ts:67](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/repository-store/readme` | [admin.routes.ts:68](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/repository-store/repos/:owner/:name` | [admin.routes.ts:69](../backend/src/modules/admin/routes/admin.routes.ts) |
| POST | `/repository-store/clones` | [admin.routes.ts:71](../backend/src/modules/admin/routes/admin.routes.ts) |
| POST | `/repository-store/clones/link` | [admin.routes.ts:72](../backend/src/modules/admin/routes/admin.routes.ts) |
| DELETE | `/repository-store/clones/:id` | [admin.routes.ts:73](../backend/src/modules/admin/routes/admin.routes.ts) |
| POST | `/repository-store/clones/:id/check` | [admin.routes.ts:74](../backend/src/modules/admin/routes/admin.routes.ts) |
| POST | `/repository-store/clones/:id/update` | [admin.routes.ts:75](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/admin/installation-api-key` | [admin.routes.ts:79](../backend/src/modules/admin/routes/admin.routes.ts) |
| PUT | `/admin/installation-api-key` | [admin.routes.ts:80](../backend/src/modules/admin/routes/admin.routes.ts) |
| PUT | `/admin/cache-modules/live-data` | [admin.routes.ts:82](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/settings` | [admin.routes.ts:85](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/settings/connector-status` | [admin.routes.ts:86](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/settings/:category` | [admin.routes.ts:87](../backend/src/modules/admin/routes/admin.routes.ts) |
| PUT | `/settings` | [admin.routes.ts:88](../backend/src/modules/admin/routes/admin.routes.ts) |
| PUT | `/settings/bulk` | [admin.routes.ts:89](../backend/src/modules/admin/routes/admin.routes.ts) |
| POST | `/settings/reset` | [admin.routes.ts:90](../backend/src/modules/admin/routes/admin.routes.ts) |
| DELETE | `/settings/:key` | [admin.routes.ts:91](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/admin/cache-modules` | [admin.routes.ts:94](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/admin/cache-modules/health` | [admin.routes.ts:95](../backend/src/modules/admin/routes/admin.routes.ts) |
| PUT | `/admin/cache-modules/:module/:collection` | [admin.routes.ts:96](../backend/src/modules/admin/routes/admin.routes.ts) |
| POST | `/admin/tools/rebuild-maps` | [admin.routes.ts:103](../backend/src/modules/admin/routes/admin.routes.ts) |
| POST | `/admin/tools/restart-service` | [admin.routes.ts:104](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/admin/tools/audit-log` | [admin.routes.ts:105](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/admin/tools/dns-check/:domain` | [admin.routes.ts:106](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/admin/logs` | [admin.routes.ts:109](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/admin/logs/kernel` | [admin.routes.ts:110](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/admin/logs/:service` | [admin.routes.ts:111](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/admin/system/info` | [admin.routes.ts:114](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/admin/system/health` | [admin.routes.ts:115](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/admin/system/env` | [admin.routes.ts:116](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/admin/system/timezone` | [admin.routes.ts:117](../backend/src/modules/admin/routes/admin.routes.ts) |
| PUT | `/admin/system/timezone` | [admin.routes.ts:118](../backend/src/modules/admin/routes/admin.routes.ts) |
| POST | `/admin/system/releases/install` | [admin.routes.ts:119](../backend/src/modules/admin/routes/admin.routes.ts) |
| POST | `/admin/sync/dovecot` | [admin.routes.ts:122](../backend/src/modules/admin/routes/admin.routes.ts) |
| POST | `/admin/sync/postfix` | [admin.routes.ts:123](../backend/src/modules/admin/routes/admin.routes.ts) |
| POST | `/admin/sync/sieve` | [admin.routes.ts:124](../backend/src/modules/admin/routes/admin.routes.ts) |
| POST | `/admin/sync/all` | [admin.routes.ts:125](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/admin/branding/images` | [admin.routes.ts:129](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/admin/branding/asset` | [admin.routes.ts:130](../backend/src/modules/admin/routes/admin.routes.ts) |
| POST | `/admin/branding/upload` | [admin.routes.ts:131](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/admin/modules` | [admin.routes.ts:140](../backend/src/modules/admin/routes/admin.routes.ts) |
| PUT | `/admin/modules/order` | [admin.routes.ts:141](../backend/src/modules/admin/routes/admin.routes.ts) |
| PATCH | `/admin/modules/:id` | [admin.routes.ts:142](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/admin/repository-store/config` | [admin.routes.ts:145](../backend/src/modules/admin/routes/admin.routes.ts) |
| PUT | `/admin/repository-store/config` | [admin.routes.ts:146](../backend/src/modules/admin/routes/admin.routes.ts) |
| DELETE | `/admin/repository-store/config` | [admin.routes.ts:147](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/admin/repository-store/search` | [admin.routes.ts:148](../backend/src/modules/admin/routes/admin.routes.ts) |
| GET | `/admin/repository-store/readme` | [admin.routes.ts:149](../backend/src/modules/admin/routes/admin.routes.ts) |

## ai-assistant

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| POST | `/api/ai/mcp/modules` | [ai.routes.ts:59](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/api/ai/mcp` | [ai.routes.ts:60](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/api/ai/mcp/cross` | [ai.routes.ts:63](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/api/ai/mcp/graph` | [ai.routes.ts:66](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/api/ai/mcp/peer` | [ai.routes.ts:70](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/mcp/tokens` | [ai.routes.ts:85](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/mcp/repair` | [ai.routes.ts:90](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/servers/:id/pair` | [ai.routes.ts:94](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/status` | [ai.routes.ts:96](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/chat` | [ai.routes.ts:97](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/agent` | [ai.routes.ts:98](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/agent/stream` | [ai.routes.ts:99](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/agent/active` | [ai.routes.ts:100](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/agent/stop` | [ai.routes.ts:101](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/agent/input` | [ai.routes.ts:102](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/agent/permission` | [ai.routes.ts:103](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/agent/resume` | [ai.routes.ts:104](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/agent/enqueue` | [ai.routes.ts:105](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/agent/queue` | [ai.routes.ts:106](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/agent/queue/:id` | [ai.routes.ts:107](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| DELETE | `/agent/queue/:id` | [ai.routes.ts:108](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/bootstrap` | [ai.routes.ts:111](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/config` | [ai.routes.ts:112](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| PUT | `/config` | [ai.routes.ts:113](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| PUT | `/config/auto-routing` | [ai.routes.ts:114](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| PUT | `/config/providers/:id` | [ai.routes.ts:115](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/config/providers/:id/test` | [ai.routes.ts:116](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/integrations/elevenlabs` | [ai.routes.ts:120](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| PUT | `/integrations/elevenlabs` | [ai.routes.ts:121](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| DELETE | `/integrations/elevenlabs` | [ai.routes.ts:122](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/integrations/elevenlabs/test` | [ai.routes.ts:123](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/modules` | [ai.routes.ts:126](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| PUT | `/modules/:id` | [ai.routes.ts:127](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| PUT | `/modules/:id/tools/:tool` | [ai.routes.ts:128](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/skills` | [ai.routes.ts:131](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| PUT | `/skills/:id` | [ai.routes.ts:132](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/notify-prefs` | [ai.routes.ts:135](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| PUT | `/notify-prefs` | [ai.routes.ts:136](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/cli/specs` | [ai.routes.ts:139](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/cli/:provider/status` | [ai.routes.ts:140](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/voice/capabilities` | [ai.routes.ts:143](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/voice/transcribe` | [ai.routes.ts:144](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/voice/speak` | [ai.routes.ts:145](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/translation/config` | [ai.routes.ts:148](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| PUT | `/translation/config` | [ai.routes.ts:149](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/translation/test` | [ai.routes.ts:150](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/translation/detect` | [ai.routes.ts:151](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/conversations` | [ai.routes.ts:154](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/conversations` | [ai.routes.ts:155](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/conversations/:id/messages` | [ai.routes.ts:156](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/conversations/:id/team-tasks` | [ai.routes.ts:159](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/conversations/:id` | [ai.routes.ts:160](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/conversations/:id/session` | [ai.routes.ts:161](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/conversations/:id/context` | [ai.routes.ts:162](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/conversations/:id/compact` | [ai.routes.ts:163](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/conversations/:id/reviewed` | [ai.routes.ts:164](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| PATCH | `/conversations/:id/translate` | [ai.routes.ts:165](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| PATCH | `/conversations/:id` | [ai.routes.ts:166](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| DELETE | `/conversations/:id` | [ai.routes.ts:167](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/projects` | [ai.routes.ts:174](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/projects` | [ai.routes.ts:175](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/projects/repair-workspace` | [ai.routes.ts:176](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| PATCH | `/projects/:id` | [ai.routes.ts:177](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| DELETE | `/projects/:id` | [ai.routes.ts:178](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/graph/status` | [ai.routes.ts:182](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/projects/:id/graph-index` | [ai.routes.ts:183](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/projects/:id/graph-index` | [ai.routes.ts:184](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| DELETE | `/projects/:id/graph-index` | [ai.routes.ts:185](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/agents` | [ai.routes.ts:188](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/agents/suggest` | [ai.routes.ts:189](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/agents/propose-from-folder` | [ai.routes.ts:190](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/agents/:id` | [ai.routes.ts:191](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/agents` | [ai.routes.ts:192](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| PUT | `/agents/:id` | [ai.routes.ts:193](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| DELETE | `/agents/:id` | [ai.routes.ts:194](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/agent-roles` | [ai.routes.ts:197](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/agent-roles/:id` | [ai.routes.ts:198](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/agent-roles` | [ai.routes.ts:199](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| PUT | `/agent-roles/:id` | [ai.routes.ts:200](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| DELETE | `/agent-roles/:id` | [ai.routes.ts:201](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/agent-teams` | [ai.routes.ts:206](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/agent-teams/:id` | [ai.routes.ts:207](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/agent-teams` | [ai.routes.ts:208](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| PUT | `/agent-teams/:id` | [ai.routes.ts:209](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| DELETE | `/agent-teams/:id` | [ai.routes.ts:210](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/team-templates` | [ai.routes.ts:216](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/team-templates/:id` | [ai.routes.ts:217](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/team-templates/:id/apply` | [ai.routes.ts:218](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/team-templates/:id/resync` | [ai.routes.ts:219](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/team-templates/:id/apply-missing` | [ai.routes.ts:220](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/team-templates/:id/feedback-stats` | [ai.routes.ts:221](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/team/tasks/active` | [ai.routes.ts:225](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/team/tasks/by-worker` | [ai.routes.ts:226](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/team/tasks` | [ai.routes.ts:227](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/team/plan` | [ai.routes.ts:228](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/team/summary` | [ai.routes.ts:229](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/team/tasks/:id/diff` | [ai.routes.ts:230](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/team/tasks` | [ai.routes.ts:231](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/team/tasks/cancel-all` | [ai.routes.ts:232](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/team/tasks/:id/cancel` | [ai.routes.ts:233](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/team/tasks/:id/feedback` | [ai.routes.ts:234](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/team/feedback` | [ai.routes.ts:235](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/agent-messages` | [ai.routes.ts:240](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/projects/:id/structure` | [ai.routes.ts:244](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/projects/:id/structure/scaffold` | [ai.routes.ts:245](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/projects/:id/structure/file` | [ai.routes.ts:246](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| PUT | `/projects/:id/structure/file` | [ai.routes.ts:247](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/projects/:id/structure/improve` | [ai.routes.ts:248](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/connectors` | [ai.routes.ts:252](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/connectors/:id/connect` | [ai.routes.ts:253](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/connectors/:id/disconnect` | [ai.routes.ts:254](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| PUT | `/connectors/:id/active` | [ai.routes.ts:255](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/connectors/:id/files` | [ai.routes.ts:256](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/connectors/:id/files/fetch` | [ai.routes.ts:257](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/attachments/:id` | [ai.routes.ts:260](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/audio/:id` | [ai.routes.ts:261](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/storage` | [ai.routes.ts:262](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| DELETE | `/storage/images` | [ai.routes.ts:263](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| DELETE | `/storage/chats` | [ai.routes.ts:264](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/stats/usage` | [ai.routes.ts:267](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/stats/daily` | [ai.routes.ts:268](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/stats/models` | [ai.routes.ts:269](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/stats/users` | [ai.routes.ts:270](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/stats/savings` | [ai.routes.ts:271](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/stats/cost` | [ai.routes.ts:272](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/stats/usage-summary` | [ai.routes.ts:273](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/stats/cli-quota` | [ai.routes.ts:274](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/audit` | [ai.routes.ts:277](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/health` | [ai.routes.ts:278](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/diagnostics/:domain` | [ai.routes.ts:280](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/diagnostics/:domain/analyze` | [ai.routes.ts:281](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/project-map` | [ai.routes.ts:286](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/project-map/generate` | [ai.routes.ts:287](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| GET | `/project-map/status` | [ai.routes.ts:288](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| POST | `/files/editor-chat` | [ai.routes.ts:293](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |
| USE | `/api/ai` | [ai.routes.ts:295](../backend/src/modules/ai-assistant/routes/ai.routes.ts) |

## auth

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| POST | `/api/login` | [auth.routes.ts:29](../backend/src/modules/auth/routes/auth.routes.ts) |
| GET | `/api/session` | [auth.routes.ts:30](../backend/src/modules/auth/routes/auth.routes.ts) |
| GET | `/api/auth/ws-token` | [auth.routes.ts:31](../backend/src/modules/auth/routes/auth.routes.ts) |
| POST | `/api/auth/refresh` | [auth.routes.ts:32](../backend/src/modules/auth/routes/auth.routes.ts) |
| GET | `/api/auth/bootstrap-status` | [auth.routes.ts:33](../backend/src/modules/auth/routes/auth.routes.ts) |
| POST | `/api/logout` | [auth.routes.ts:36](../backend/src/modules/auth/routes/auth.routes.ts) |
| GET | `/api/auth/login-methods` | [auth.routes.ts:37](../backend/src/modules/auth/routes/auth.routes.ts) |
| GET | `/api/auth/native/capabilities` | [auth.routes.ts:40](../backend/src/modules/auth/routes/auth.routes.ts) |
| POST | `/api/auth/native/start` | [auth.routes.ts:41](../backend/src/modules/auth/routes/auth.routes.ts) |
| POST | `/api/auth/native/authorize` | [auth.routes.ts:42](../backend/src/modules/auth/routes/auth.routes.ts) |
| POST | `/api/auth/native/redeem` | [auth.routes.ts:43](../backend/src/modules/auth/routes/auth.routes.ts) |
| POST | `/api/auth/sso/exchange` | [auth.routes.ts:54](../backend/src/modules/auth/routes/auth.routes.ts) |
| GET | `/api/auth/sso/handoff` | [auth.routes.ts:55](../backend/src/modules/auth/routes/auth.routes.ts) |
| POST | `/api/auth/sso/handoff` | [auth.routes.ts:56](../backend/src/modules/auth/routes/auth.routes.ts) |
| GET | `/api/me/modules` | [auth.routes.ts:61](../backend/src/modules/auth/routes/auth.routes.ts) |
| GET | `/api/auth/passkeys` | [auth.routes.ts:65](../backend/src/modules/auth/routes/auth.routes.ts) |
| POST | `/api/auth/passkeys/register-options` | [auth.routes.ts:66](../backend/src/modules/auth/routes/auth.routes.ts) |
| POST | `/api/auth/passkeys/register-verify` | [auth.routes.ts:67](../backend/src/modules/auth/routes/auth.routes.ts) |
| DELETE | `/api/auth/passkeys/:id` | [auth.routes.ts:68](../backend/src/modules/auth/routes/auth.routes.ts) |
| POST | `/api/auth/passkeys/enrollment` | [auth.routes.ts:70](../backend/src/modules/auth/routes/auth.routes.ts) |
| GET | `/api/auth/passkeys/enrollment/:id` | [auth.routes.ts:71](../backend/src/modules/auth/routes/auth.routes.ts) |
| POST | `/api/auth/passkeys/enrollment-options` | [auth.routes.ts:72](../backend/src/modules/auth/routes/auth.routes.ts) |
| POST | `/api/auth/passkeys/enrollment-verify` | [auth.routes.ts:73](../backend/src/modules/auth/routes/auth.routes.ts) |
| POST | `/api/auth/passkeys/auth-options` | [auth.routes.ts:75](../backend/src/modules/auth/routes/auth.routes.ts) |
| POST | `/api/auth/passkeys/auth-verify` | [auth.routes.ts:76](../backend/src/modules/auth/routes/auth.routes.ts) |
| POST | `/api/auth/otp/request` | [auth.routes.ts:79](../backend/src/modules/auth/routes/auth.routes.ts) |
| POST | `/api/auth/otp/verify` | [auth.routes.ts:80](../backend/src/modules/auth/routes/auth.routes.ts) |
| GET | `/api/auth/recovery/status` | [auth.routes.ts:83](../backend/src/modules/auth/routes/auth.routes.ts) |
| POST | `/api/auth/recovery/generate` | [auth.routes.ts:84](../backend/src/modules/auth/routes/auth.routes.ts) |
| POST | `/api/auth/recovery/verify` | [auth.routes.ts:85](../backend/src/modules/auth/routes/auth.routes.ts) |
| POST | `/api/auth/qr/request` | [auth.routes.ts:89](../backend/src/modules/auth/routes/auth.routes.ts) |
| POST | `/api/auth/qr/approve` | [auth.routes.ts:90](../backend/src/modules/auth/routes/auth.routes.ts) |
| GET | `/api/auth/qr/poll/:requestId` | [auth.routes.ts:91](../backend/src/modules/auth/routes/auth.routes.ts) |
| GET | `/api/auth/totp/status` | [auth.routes.ts:94](../backend/src/modules/auth/routes/auth.routes.ts) |
| GET | `/api/auth/totp/setup` | [auth.routes.ts:95](../backend/src/modules/auth/routes/auth.routes.ts) |
| POST | `/api/auth/totp/enable` | [auth.routes.ts:96](../backend/src/modules/auth/routes/auth.routes.ts) |
| PATCH | `/api/auth/totp/disable` | [auth.routes.ts:97](../backend/src/modules/auth/routes/auth.routes.ts) |
| PATCH | `/api/auth/totp/activate` | [auth.routes.ts:98](../backend/src/modules/auth/routes/auth.routes.ts) |
| DELETE | `/api/auth/totp/delete` | [auth.routes.ts:99](../backend/src/modules/auth/routes/auth.routes.ts) |
| POST | `/api/auth/2fa/verify` | [auth.routes.ts:103](../backend/src/modules/auth/routes/auth.routes.ts) |

## backup

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/backups` | [backup.routes.ts:16](../backend/src/modules/backup/routes/backup.routes.ts) |
| GET | `/api/backups/config` | [backup.routes.ts:18](../backend/src/modules/backup/routes/backup.routes.ts) |
| PUT | `/api/backups/config` | [backup.routes.ts:19](../backend/src/modules/backup/routes/backup.routes.ts) |
| POST | `/api/backups/config/directory/preview` | [backup.routes.ts:20](../backend/src/modules/backup/routes/backup.routes.ts) |
| POST | `/api/backups/config/directory` | [backup.routes.ts:21](../backend/src/modules/backup/routes/backup.routes.ts) |
| GET | `/api/backups/databases` | [backup.routes.ts:24](../backend/src/modules/backup/routes/backup.routes.ts) |
| GET | `/api/backups/schedules` | [backup.routes.ts:27](../backend/src/modules/backup/routes/backup.routes.ts) |
| POST | `/api/backups/schedules` | [backup.routes.ts:28](../backend/src/modules/backup/routes/backup.routes.ts) |
| PUT | `/api/backups/schedules/:id` | [backup.routes.ts:29](../backend/src/modules/backup/routes/backup.routes.ts) |
| DELETE | `/api/backups/schedules/:id` | [backup.routes.ts:30](../backend/src/modules/backup/routes/backup.routes.ts) |
| GET | `/api/backups/provider-creds` | [backup.routes.ts:34](../backend/src/modules/backup/routes/backup.routes.ts) |
| PUT | `/api/backups/provider-creds/:provider` | [backup.routes.ts:35](../backend/src/modules/backup/routes/backup.routes.ts) |
| DELETE | `/api/backups/provider-creds/:provider` | [backup.routes.ts:36](../backend/src/modules/backup/routes/backup.routes.ts) |
| GET | `/api/backups/storages` | [backup.routes.ts:39](../backend/src/modules/backup/routes/backup.routes.ts) |
| POST | `/api/backups/storages` | [backup.routes.ts:40](../backend/src/modules/backup/routes/backup.routes.ts) |
| PUT | `/api/backups/storages/:id` | [backup.routes.ts:41](../backend/src/modules/backup/routes/backup.routes.ts) |
| DELETE | `/api/backups/storages/:id` | [backup.routes.ts:42](../backend/src/modules/backup/routes/backup.routes.ts) |
| GET | `/api/backups` | [backup.routes.ts:45](../backend/src/modules/backup/routes/backup.routes.ts) |
| POST | `/api/backups` | [backup.routes.ts:46](../backend/src/modules/backup/routes/backup.routes.ts) |
| GET | `/api/backups/:id/download` | [backup.routes.ts:47](../backend/src/modules/backup/routes/backup.routes.ts) |
| GET | `/api/backups/:id` | [backup.routes.ts:48](../backend/src/modules/backup/routes/backup.routes.ts) |
| DELETE | `/api/backups/:id` | [backup.routes.ts:49](../backend/src/modules/backup/routes/backup.routes.ts) |

## bitninja

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/bitninja` | [bitninja.routes.ts:13](../backend/src/modules/bitninja/routes/bitninja.routes.ts) |
| GET | `/api/bitninja/status` | [bitninja.routes.ts:15](../backend/src/modules/bitninja/routes/bitninja.routes.ts) |
| GET | `/api/bitninja/logs` | [bitninja.routes.ts:16](../backend/src/modules/bitninja/routes/bitninja.routes.ts) |
| GET | `/api/bitninja/config` | [bitninja.routes.ts:18](../backend/src/modules/bitninja/routes/bitninja.routes.ts) |
| PUT | `/api/bitninja/config` | [bitninja.routes.ts:19](../backend/src/modules/bitninja/routes/bitninja.routes.ts) |
| DELETE | `/api/bitninja/config` | [bitninja.routes.ts:20](../backend/src/modules/bitninja/routes/bitninja.routes.ts) |
| POST | `/api/bitninja/packages` | [bitninja.routes.ts:23](../backend/src/modules/bitninja/routes/bitninja.routes.ts) |
| POST | `/api/bitninja/license` | [bitninja.routes.ts:24](../backend/src/modules/bitninja/routes/bitninja.routes.ts) |
| POST | `/api/bitninja/service` | [bitninja.routes.ts:25](../backend/src/modules/bitninja/routes/bitninja.routes.ts) |
| POST | `/api/bitninja/components` | [bitninja.routes.ts:26](../backend/src/modules/bitninja/routes/bitninja.routes.ts) |

## chat

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| POST | `/api/chat/calls/webhook` | [call-webhook.routes.ts:27](../backend/src/modules/chat/routes/call-webhook.routes.ts) |
| USE | `/api/chat` | [chat.routes.ts:22](../backend/src/modules/chat/routes/chat.routes.ts) |
| GET | `/api/chat/stream` | [chat.routes.ts:43](../backend/src/modules/chat/routes/chat.routes.ts) |
| GET | `/api/chat/conversations` | [chat.routes.ts:44](../backend/src/modules/chat/routes/chat.routes.ts) |
| GET | `/api/chat/conversations/:id/messages` | [chat.routes.ts:45](../backend/src/modules/chat/routes/chat.routes.ts) |
| GET | `/api/chat/unread-count` | [chat.routes.ts:46](../backend/src/modules/chat/routes/chat.routes.ts) |
| GET | `/api/chat/directory` | [chat.routes.ts:47](../backend/src/modules/chat/routes/chat.routes.ts) |
| GET | `/api/chat/conversations/:id/messages/:messageId/transcript` | [chat.routes.ts:48](../backend/src/modules/chat/routes/chat.routes.ts) |
| GET | `/api/chat/conversations/:id/attachments` | [chat.routes.ts:52](../backend/src/modules/chat/routes/chat.routes.ts) |
| GET | `/api/chat/me/profile` | [chat.routes.ts:53](../backend/src/modules/chat/routes/chat.routes.ts) |
| GET | `/api/chat/attachments/:id` | [chat.routes.ts:54](../backend/src/modules/chat/routes/chat.routes.ts) |
| PUT | `/api/chat/me/profile` | [chat.routes.ts:57](../backend/src/modules/chat/routes/chat.routes.ts) |
| POST | `/api/chat/conversations` | [chat.routes.ts:58](../backend/src/modules/chat/routes/chat.routes.ts) |
| POST | `/api/chat/conversations/:id/messages` | [chat.routes.ts:59](../backend/src/modules/chat/routes/chat.routes.ts) |
| POST | `/api/chat/conversations/:id/read` | [chat.routes.ts:60](../backend/src/modules/chat/routes/chat.routes.ts) |
| PATCH | `/api/chat/conversations/:id/messages/:messageId` | [chat.routes.ts:61](../backend/src/modules/chat/routes/chat.routes.ts) |
| DELETE | `/api/chat/conversations/:id/messages/:messageId` | [chat.routes.ts:62](../backend/src/modules/chat/routes/chat.routes.ts) |
| GET | `/api/chat/conversations/:id/call` | [chat.routes.ts:66](../backend/src/modules/chat/routes/chat.routes.ts) |
| GET | `/api/chat/calls/:callId` | [chat.routes.ts:67](../backend/src/modules/chat/routes/chat.routes.ts) |
| POST | `/api/chat/conversations/:id/call` | [chat.routes.ts:68](../backend/src/modules/chat/routes/chat.routes.ts) |
| POST | `/api/chat/calls/:callId/accept` | [chat.routes.ts:74](../backend/src/modules/chat/routes/chat.routes.ts) |
| POST | `/api/chat/calls/:callId/reject` | [chat.routes.ts:75](../backend/src/modules/chat/routes/chat.routes.ts) |
| POST | `/api/chat/calls/:callId/end` | [chat.routes.ts:76](../backend/src/modules/chat/routes/chat.routes.ts) |
| GET | `/api/chat/tolqia/plan` | [chat.routes.ts:94](../backend/src/modules/chat/routes/chat.routes.ts) |
| GET | `/api/chat/tolqia/config` | [chat.routes.ts:95](../backend/src/modules/chat/routes/chat.routes.ts) |
| PUT | `/api/chat/tolqia/config` | [chat.routes.ts:96](../backend/src/modules/chat/routes/chat.routes.ts) |
| DELETE | `/api/chat/tolqia/config` | [chat.routes.ts:97](../backend/src/modules/chat/routes/chat.routes.ts) |
| POST | `/api/chat/tolqia/test` | [chat.routes.ts:98](../backend/src/modules/chat/routes/chat.routes.ts) |

## cloudflare

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/cloudflare` | [cloudflare.routes.ts:12](../backend/src/modules/cloudflare/routes/cloudflare.routes.ts) |
| GET | `/api/cloudflare/config` | [cloudflare.routes.ts:15](../backend/src/modules/cloudflare/routes/cloudflare.routes.ts) |
| PUT | `/api/cloudflare/config` | [cloudflare.routes.ts:16](../backend/src/modules/cloudflare/routes/cloudflare.routes.ts) |
| DELETE | `/api/cloudflare/config` | [cloudflare.routes.ts:17](../backend/src/modules/cloudflare/routes/cloudflare.routes.ts) |
| POST | `/api/cloudflare/test` | [cloudflare.routes.ts:18](../backend/src/modules/cloudflare/routes/cloudflare.routes.ts) |
| GET | `/api/cloudflare/server-ip` | [cloudflare.routes.ts:21](../backend/src/modules/cloudflare/routes/cloudflare.routes.ts) |
| GET | `/api/cloudflare/zones` | [cloudflare.routes.ts:24](../backend/src/modules/cloudflare/routes/cloudflare.routes.ts) |
| GET | `/api/cloudflare/zones/:zoneId/settings` | [cloudflare.routes.ts:25](../backend/src/modules/cloudflare/routes/cloudflare.routes.ts) |
| PATCH | `/api/cloudflare/zones/:zoneId/settings` | [cloudflare.routes.ts:26](../backend/src/modules/cloudflare/routes/cloudflare.routes.ts) |
| GET | `/api/cloudflare/zones/:zoneId/dns` | [cloudflare.routes.ts:33](../backend/src/modules/cloudflare/routes/cloudflare.routes.ts) |
| POST | `/api/cloudflare/zones/:zoneId/dns` | [cloudflare.routes.ts:34](../backend/src/modules/cloudflare/routes/cloudflare.routes.ts) |
| PATCH | `/api/cloudflare/zones/:zoneId/dns/:recordId` | [cloudflare.routes.ts:35](../backend/src/modules/cloudflare/routes/cloudflare.routes.ts) |
| DELETE | `/api/cloudflare/zones/:zoneId/dns/:recordId` | [cloudflare.routes.ts:40](../backend/src/modules/cloudflare/routes/cloudflare.routes.ts) |
| POST | `/api/cloudflare/zones/:zoneId/purge` | [cloudflare.routes.ts:47](../backend/src/modules/cloudflare/routes/cloudflare.routes.ts) |
| GET | `/api/cloudflare/zones/:zoneId/access-rules` | [cloudflare.routes.ts:50](../backend/src/modules/cloudflare/routes/cloudflare.routes.ts) |
| POST | `/api/cloudflare/zones/:zoneId/access-rules` | [cloudflare.routes.ts:51](../backend/src/modules/cloudflare/routes/cloudflare.routes.ts) |
| DELETE | `/api/cloudflare/zones/:zoneId/access-rules/:ruleId` | [cloudflare.routes.ts:56](../backend/src/modules/cloudflare/routes/cloudflare.routes.ts) |

## codebase-graph

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/codebase-graph` | [index.ts:16](../backend/src/modules/codebase-graph/index.ts) |
| GET | `/api/codebase-graph/original-authorize` | [index.ts:18](../backend/src/modules/codebase-graph/index.ts) |
| GET | `/api/codebase-graph/projects` | [index.ts:30](../backend/src/modules/codebase-graph/index.ts) |
| POST | `/api/codebase-graph/projects/:id/query` | [index.ts:48](../backend/src/modules/codebase-graph/index.ts) |

## community

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| POST | `/api/community/:moduleId/tool/:name` | [index.ts:85](../backend/src/modules/community/index.ts) |
| GET | `/api/community/:moduleId/panel/:name` | [index.ts:86](../backend/src/modules/community/index.ts) |

## cron

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| GET | `/api/cron-approvals/:token` | [cron-approvals-public.routes.ts:13](../backend/src/modules/cron/routes/cron-approvals-public.routes.ts) |
| POST | `/api/cron-approvals/:token` | [cron-approvals-public.routes.ts:14](../backend/src/modules/cron/routes/cron-approvals-public.routes.ts) |
| USE | `/api/cron` | [cron.routes.ts:18](../backend/src/modules/cron/routes/cron.routes.ts) |
| GET | `/api/cron/status` | [cron.routes.ts:26](../backend/src/modules/cron/routes/cron.routes.ts) |
| POST | `/api/cron/install` | [cron.routes.ts:27](../backend/src/modules/cron/routes/cron.routes.ts) |
| POST | `/api/cron/service/enable` | [cron.routes.ts:28](../backend/src/modules/cron/routes/cron.routes.ts) |
| POST | `/api/cron/service/disable` | [cron.routes.ts:29](../backend/src/modules/cron/routes/cron.routes.ts) |
| GET | `/api/cron/users` | [cron.routes.ts:32](../backend/src/modules/cron/routes/cron.routes.ts) |
| GET | `/api/cron/jobs` | [cron.routes.ts:33](../backend/src/modules/cron/routes/cron.routes.ts) |
| POST | `/api/cron/jobs` | [cron.routes.ts:34](../backend/src/modules/cron/routes/cron.routes.ts) |
| PUT | `/api/cron/jobs/:id` | [cron.routes.ts:35](../backend/src/modules/cron/routes/cron.routes.ts) |
| POST | `/api/cron/jobs/:id/toggle` | [cron.routes.ts:36](../backend/src/modules/cron/routes/cron.routes.ts) |
| DELETE | `/api/cron/jobs/:id` | [cron.routes.ts:37](../backend/src/modules/cron/routes/cron.routes.ts) |
| GET | `/api/cron/jobs/:id/logs` | [cron.routes.ts:38](../backend/src/modules/cron/routes/cron.routes.ts) |
| GET | `/api/cron/jobs/:id/logs/:file` | [cron.routes.ts:39](../backend/src/modules/cron/routes/cron.routes.ts) |
| POST | `/api/cron/validate` | [cron.routes.ts:40](../backend/src/modules/cron/routes/cron.routes.ts) |
| GET | `/api/cron/agent-presets` | [cron.routes.ts:43](../backend/src/modules/cron/routes/cron.routes.ts) |
| PUT | `/api/cron/agent-presets` | [cron.routes.ts:44](../backend/src/modules/cron/routes/cron.routes.ts) |
| GET | `/api/cron/ai-jobs` | [cron.routes.ts:45](../backend/src/modules/cron/routes/cron.routes.ts) |
| POST | `/api/cron/ai-jobs` | [cron.routes.ts:46](../backend/src/modules/cron/routes/cron.routes.ts) |
| POST | `/api/cron/ai-jobs/bulk` | [cron.routes.ts:47](../backend/src/modules/cron/routes/cron.routes.ts) |
| PUT | `/api/cron/ai-jobs/:id` | [cron.routes.ts:48](../backend/src/modules/cron/routes/cron.routes.ts) |
| POST | `/api/cron/ai-jobs/:id/toggle` | [cron.routes.ts:49](../backend/src/modules/cron/routes/cron.routes.ts) |
| POST | `/api/cron/ai-jobs/:id/run` | [cron.routes.ts:50](../backend/src/modules/cron/routes/cron.routes.ts) |
| DELETE | `/api/cron/ai-jobs/:id` | [cron.routes.ts:51](../backend/src/modules/cron/routes/cron.routes.ts) |
| GET | `/api/cron/ai-jobs/:id/logs` | [cron.routes.ts:52](../backend/src/modules/cron/routes/cron.routes.ts) |
| GET | `/api/cron/ai-jobs/:id/logs/:file` | [cron.routes.ts:53](../backend/src/modules/cron/routes/cron.routes.ts) |

## dashboard

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/dashboard` | [dashboard.routes.ts:15](../backend/src/modules/dashboard/routes/dashboard.routes.ts) |
| GET | `/api/dashboard/overview` | [dashboard.routes.ts:17](../backend/src/modules/dashboard/routes/dashboard.routes.ts) |

## databases

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/databases` | [databases.routes.ts:11](../backend/src/modules/databases/routes/databases.routes.ts) |
| GET | `/api/databases/engines` | [databases.routes.ts:14](../backend/src/modules/databases/routes/databases.routes.ts) |
| GET | `/api/databases/list` | [databases.routes.ts:15](../backend/src/modules/databases/routes/databases.routes.ts) |
| POST | `/api/databases/databases` | [databases.routes.ts:16](../backend/src/modules/databases/routes/databases.routes.ts) |
| GET | `/api/databases/tables` | [databases.routes.ts:17](../backend/src/modules/databases/routes/databases.routes.ts) |
| GET | `/api/databases/columns` | [databases.routes.ts:18](../backend/src/modules/databases/routes/databases.routes.ts) |
| GET | `/api/databases/rows` | [databases.routes.ts:19](../backend/src/modules/databases/routes/databases.routes.ts) |
| POST | `/api/databases/query` | [databases.routes.ts:22](../backend/src/modules/databases/routes/databases.routes.ts) |
| POST | `/api/databases/records` | [databases.routes.ts:25](../backend/src/modules/databases/routes/databases.routes.ts) |
| PATCH | `/api/databases/records` | [databases.routes.ts:26](../backend/src/modules/databases/routes/databases.routes.ts) |
| DELETE | `/api/databases/records` | [databases.routes.ts:27](../backend/src/modules/databases/routes/databases.routes.ts) |
| POST | `/api/databases/export` | [databases.routes.ts:30](../backend/src/modules/databases/routes/databases.routes.ts) |
| POST | `/api/databases/install` | [databases.routes.ts:33](../backend/src/modules/databases/routes/databases.routes.ts) |

## expo

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/expo` | [expo.routes.ts:26](../backend/src/modules/expo/routes/expo.routes.ts) |
| GET | `/api/expo/config` | [expo.routes.ts:29](../backend/src/modules/expo/routes/expo.routes.ts) |
| PUT | `/api/expo/config` | [expo.routes.ts:30](../backend/src/modules/expo/routes/expo.routes.ts) |
| DELETE | `/api/expo/config` | [expo.routes.ts:31](../backend/src/modules/expo/routes/expo.routes.ts) |
| GET | `/api/expo/whoami` | [expo.routes.ts:34](../backend/src/modules/expo/routes/expo.routes.ts) |
| GET | `/api/expo/account` | [expo.routes.ts:35](../backend/src/modules/expo/routes/expo.routes.ts) |
| GET | `/api/expo/projects` | [expo.routes.ts:38](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/project-info` | [expo.routes.ts:39](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/init` | [expo.routes.ts:40](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/link` | [expo.routes.ts:41](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/create-app` | [expo.routes.ts:44](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/create-status` | [expo.routes.ts:45](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/build` | [expo.routes.ts:48](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/build-list` | [expo.routes.ts:49](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/build-view` | [expo.routes.ts:50](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/build-logs` | [expo.routes.ts:51](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/build-cancel` | [expo.routes.ts:52](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/submit` | [expo.routes.ts:55](../backend/src/modules/expo/routes/expo.routes.ts) |
| GET | `/api/expo/dev-client/status` | [expo.routes.ts:58](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/dependencies/install` | [expo.routes.ts:59](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/dependencies/status` | [expo.routes.ts:60](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/dev-client` | [expo.routes.ts:61](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/dev-client/stop` | [expo.routes.ts:62](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/quota` | [expo.routes.ts:65](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/update` | [expo.routes.ts:68](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/env-list` | [expo.routes.ts:71](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/env-set` | [expo.routes.ts:72](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/env-update` | [expo.routes.ts:73](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/env-delete` | [expo.routes.ts:74](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/store-credentials` | [expo.routes.ts:77](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/credentials/google` | [expo.routes.ts:78](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/credentials/apple` | [expo.routes.ts:79](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/webhook` | [expo.routes.ts:82](../backend/src/modules/expo/routes/expo.routes.ts) |
| POST | `/api/expo/device` | [expo.routes.ts:83](../backend/src/modules/expo/routes/expo.routes.ts) |

## files

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/files` | [files.routes.ts:65](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/list` | [files.routes.ts:68](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/tree` | [files.routes.ts:71](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/stat` | [files.routes.ts:72](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/search` | [files.routes.ts:76](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/grep` | [files.routes.ts:77](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/compare` | [files.routes.ts:78](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/history` | [files.routes.ts:79](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/history/git-show` | [files.routes.ts:80](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/dir-size` | [files.routes.ts:81](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/dir-sizes` | [files.routes.ts:85](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/path-suggest` | [files.routes.ts:86](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/visit` | [files.routes.ts:87](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/allowed-bases` | [files.routes.ts:88](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/meta` | [files.routes.ts:91](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/meta/all` | [files.routes.ts:92](../backend/src/modules/files/routes/files.routes.ts) |
| PUT | `/api/files/meta` | [files.routes.ts:93](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/mode` | [files.routes.ts:96](../backend/src/modules/files/routes/files.routes.ts) |
| PUT | `/api/files/mode` | [files.routes.ts:97](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/preferences` | [files.routes.ts:98](../backend/src/modules/files/routes/files.routes.ts) |
| PATCH | `/api/files/preferences` | [files.routes.ts:99](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/config/effective` | [files.routes.ts:100](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/config` | [files.routes.ts:101](../backend/src/modules/files/routes/files.routes.ts) |
| PATCH | `/api/files/config` | [files.routes.ts:102](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/config/prune-preview` | [files.routes.ts:103](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/config/prune` | [files.routes.ts:104](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/share/roots` | [files.routes.ts:107](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/share` | [files.routes.ts:108](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/share` | [files.routes.ts:109](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/share/:token/revoke` | [files.routes.ts:110](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/scan-projects` | [files.routes.ts:113](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/projects` | [files.routes.ts:114](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/snippets/suggest` | [files.routes.ts:117](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/git/status` | [files.routes.ts:120](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/git/in-repo` | [files.routes.ts:121](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/git/commit` | [files.routes.ts:122](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/git/discard` | [files.routes.ts:123](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/git/checkout` | [files.routes.ts:124](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/git/branch` | [files.routes.ts:125](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/git/pull` | [files.routes.ts:127](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/git/push` | [files.routes.ts:128](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/git/credentials` | [files.routes.ts:129](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/git/credentials` | [files.routes.ts:130](../backend/src/modules/files/routes/files.routes.ts) |
| PUT | `/api/files/git/credentials/:id` | [files.routes.ts:131](../backend/src/modules/files/routes/files.routes.ts) |
| DELETE | `/api/files/git/credentials/:id` | [files.routes.ts:132](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/git/detect` | [files.routes.ts:133](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/git/server/https` | [files.routes.ts:135](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/git/server/https/delete` | [files.routes.ts:136](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/git/server/ssh/delete` | [files.routes.ts:137](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/git/server/gh/logout` | [files.routes.ts:138](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/git/server/config` | [files.routes.ts:139](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/git/ssh/env` | [files.routes.ts:141](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/git/ssh/users` | [files.routes.ts:142](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/git/ssh/test` | [files.routes.ts:143](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/git/ssh/config` | [files.routes.ts:144](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/git/ssh/config` | [files.routes.ts:145](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/git/ssh/fix-permissions` | [files.routes.ts:146](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/git/ssh/repo-key` | [files.routes.ts:147](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/git/ssh/repo-key` | [files.routes.ts:148](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/git/clone` | [files.routes.ts:150](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/git/deploy` | [files.routes.ts:151](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/project-info` | [files.routes.ts:152](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/exposure/scan` | [files.routes.ts:155](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/exposure/probe` | [files.routes.ts:156](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/exposure/block` | [files.routes.ts:157](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/privacy` | [files.routes.ts:160](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/privacy/protect` | [files.routes.ts:161](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/privacy/user/remove` | [files.routes.ts:162](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/privacy/unprotect` | [files.routes.ts:163](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/privacy/sites` | [files.routes.ts:164](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/privacy/publish` | [files.routes.ts:165](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/privacy/unpublish` | [files.routes.ts:166](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/snapshots` | [files.routes.ts:172](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/snapshots/:id/diff` | [files.routes.ts:173](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/snapshots/:id/download` | [files.routes.ts:174](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/snapshots/:id/restore` | [files.routes.ts:175](../backend/src/modules/files/routes/files.routes.ts) |
| DELETE | `/api/files/snapshots/:id` | [files.routes.ts:176](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/replace/preview` | [files.routes.ts:179](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/replace/apply` | [files.routes.ts:180](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/malware/scan` | [files.routes.ts:183](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/cleanup/scan` | [files.routes.ts:184](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/images/capabilities` | [files.routes.ts:187](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/images/scan` | [files.routes.ts:188](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/images/process` | [files.routes.ts:189](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/malware/quarantine` | [files.routes.ts:190](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/malware/quarantine` | [files.routes.ts:191](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/malware/quarantine/:id/restore` | [files.routes.ts:192](../backend/src/modules/files/routes/files.routes.ts) |
| DELETE | `/api/files/malware/quarantine/:id` | [files.routes.ts:193](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/read` | [files.routes.ts:196](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/validate` | [files.routes.ts:197](../backend/src/modules/files/routes/files.routes.ts) |
| PUT | `/api/files/write` | [files.routes.ts:198](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/download` | [files.routes.ts:201](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/raw` | [files.routes.ts:204](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/upload` | [files.routes.ts:210](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/mkdir` | [files.routes.ts:225](../backend/src/modules/files/routes/files.routes.ts) |
| DELETE | `/api/files` | [files.routes.ts:226](../backend/src/modules/files/routes/files.routes.ts) |
| PUT | `/api/files/rename` | [files.routes.ts:227](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/copy` | [files.routes.ts:228](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/permissions/recommend` | [files.routes.ts:229](../backend/src/modules/files/routes/files.routes.ts) |
| PUT | `/api/files/chmod` | [files.routes.ts:230](../backend/src/modules/files/routes/files.routes.ts) |
| PUT | `/api/files/chmod-recursive` | [files.routes.ts:231](../backend/src/modules/files/routes/files.routes.ts) |
| PUT | `/api/files/chown` | [files.routes.ts:232](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/compress` | [files.routes.ts:238](../backend/src/modules/files/routes/files.routes.ts) |
| POST | `/api/files/extract` | [files.routes.ts:239](../backend/src/modules/files/routes/files.routes.ts) |
| GET | `/api/files/archive-contents` | [files.routes.ts:240](../backend/src/modules/files/routes/files.routes.ts) |

## firewall

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/firewall` | [firewall.routes.ts:13](../backend/src/modules/firewall/routes/firewall.routes.ts) |
| GET | `/api/firewall/status` | [firewall.routes.ts:21](../backend/src/modules/firewall/routes/firewall.routes.ts) |
| POST | `/api/firewall/install` | [firewall.routes.ts:22](../backend/src/modules/firewall/routes/firewall.routes.ts) |
| POST | `/api/firewall/enable` | [firewall.routes.ts:23](../backend/src/modules/firewall/routes/firewall.routes.ts) |
| POST | `/api/firewall/disable` | [firewall.routes.ts:24](../backend/src/modules/firewall/routes/firewall.routes.ts) |
| PUT | `/api/firewall/logging` | [firewall.routes.ts:25](../backend/src/modules/firewall/routes/firewall.routes.ts) |
| GET | `/api/firewall/rules` | [firewall.routes.ts:28](../backend/src/modules/firewall/routes/firewall.routes.ts) |
| POST | `/api/firewall/rules` | [firewall.routes.ts:29](../backend/src/modules/firewall/routes/firewall.routes.ts) |
| DELETE | `/api/firewall/rules/:number` | [firewall.routes.ts:30](../backend/src/modules/firewall/routes/firewall.routes.ts) |
| POST | `/api/firewall/cloudflare-allow` | [firewall.routes.ts:32](../backend/src/modules/firewall/routes/firewall.routes.ts) |
| GET | `/api/firewall/fail2ban/jails` | [firewall.routes.ts:35](../backend/src/modules/firewall/routes/firewall.routes.ts) |
| POST | `/api/firewall/fail2ban/unban` | [firewall.routes.ts:36](../backend/src/modules/firewall/routes/firewall.routes.ts) |
| POST | `/api/firewall/fail2ban/ban` | [firewall.routes.ts:37](../backend/src/modules/firewall/routes/firewall.routes.ts) |

## hosting

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/hosting/v1/accounts/:account/deployments` | [deployment-provider.routes.ts:19](../backend/src/modules/hosting/routes/deployment-provider.routes.ts) |
| POST | `/api/hosting/auth/login` | [hosting.routes.ts:50](../backend/src/modules/hosting/routes/hosting.routes.ts) |
| POST | `/api/hosting/auth/logout` | [hosting.routes.ts:51](../backend/src/modules/hosting/routes/hosting.routes.ts) |
| GET | `/api/hosting/accounts/:id/audit` | [hosting.routes.ts:58](../backend/src/modules/hosting/routes/hosting.routes.ts) |
| GET | `/api/hosting/accounts/:id/stats` | [hosting.routes.ts:59](../backend/src/modules/hosting/routes/hosting.routes.ts) |
| USE | `/api/hosting/defaults` | [hosting.routes.ts:62](../backend/src/modules/hosting/routes/hosting.routes.ts) |
| GET | `/api/hosting/defaults` | [hosting.routes.ts:63](../backend/src/modules/hosting/routes/hosting.routes.ts) |
| PUT | `/api/hosting/defaults` | [hosting.routes.ts:64](../backend/src/modules/hosting/routes/hosting.routes.ts) |
| USE | `/api/hosting/accounts` | [hosting.routes.ts:66](../backend/src/modules/hosting/routes/hosting.routes.ts) |
| GET | `/api/hosting/accounts` | [hosting.routes.ts:68](../backend/src/modules/hosting/routes/hosting.routes.ts) |
| POST | `/api/hosting/accounts` | [hosting.routes.ts:69](../backend/src/modules/hosting/routes/hosting.routes.ts) |
| GET | `/api/hosting/accounts/:id` | [hosting.routes.ts:70](../backend/src/modules/hosting/routes/hosting.routes.ts) |
| PUT | `/api/hosting/accounts/:id` | [hosting.routes.ts:71](../backend/src/modules/hosting/routes/hosting.routes.ts) |
| DELETE | `/api/hosting/accounts/:id` | [hosting.routes.ts:72](../backend/src/modules/hosting/routes/hosting.routes.ts) |
| POST | `/api/hosting/accounts/:id/suspend` | [hosting.routes.ts:73](../backend/src/modules/hosting/routes/hosting.routes.ts) |
| POST | `/api/hosting/accounts/:id/unsuspend` | [hosting.routes.ts:74](../backend/src/modules/hosting/routes/hosting.routes.ts) |
| POST | `/api/hosting/accounts/:id/change-password` | [hosting.routes.ts:75](../backend/src/modules/hosting/routes/hosting.routes.ts) |
| POST | `/api/hosting/accounts/:id/reconcile` | [hosting.routes.ts:77](../backend/src/modules/hosting/routes/hosting.routes.ts) |
| USE | `/api/hosting/accounts/:id/jail` | [jail.routes.ts:23](../backend/src/modules/hosting/routes/jail.routes.ts) |
| POST | `/api/hosting/accounts/:id/jail` | [jail.routes.ts:25](../backend/src/modules/hosting/routes/jail.routes.ts) |
| DELETE | `/api/hosting/accounts/:id/jail` | [jail.routes.ts:26](../backend/src/modules/hosting/routes/jail.routes.ts) |
| GET | `/api/hosting/accounts/:id/jail` | [jail.routes.ts:27](../backend/src/modules/hosting/routes/jail.routes.ts) |
| USE | `/api/hosting/providers` | [provider.routes.ts:59](../backend/src/modules/hosting/routes/provider.routes.ts) |
| GET | `/api/hosting/providers/permission-catalog` | [provider.routes.ts:60](../backend/src/modules/hosting/routes/provider.routes.ts) |
| GET | `/api/hosting/providers/templates` | [provider.routes.ts:63](../backend/src/modules/hosting/routes/provider.routes.ts) |
| GET | `/api/hosting/providers` | [provider.routes.ts:66](../backend/src/modules/hosting/routes/provider.routes.ts) |
| POST | `/api/hosting/providers` | [provider.routes.ts:69](../backend/src/modules/hosting/routes/provider.routes.ts) |
| PATCH | `/api/hosting/providers/:id` | [provider.routes.ts:76](../backend/src/modules/hosting/routes/provider.routes.ts) |
| POST | `/api/hosting/providers/:id/rotate` | [provider.routes.ts:82](../backend/src/modules/hosting/routes/provider.routes.ts) |
| USE | `/api/hosting/v1` | [provider.routes.ts:95](../backend/src/modules/hosting/routes/provider.routes.ts) |
| GET | `/api/hosting/v1/capabilities` | [provider.routes.ts:98](../backend/src/modules/hosting/routes/provider.routes.ts) |
| PUT | `/api/hosting/v1/accounts/:externalId` | [provider.routes.ts:102](../backend/src/modules/hosting/routes/provider.routes.ts) |
| GET | `/api/hosting/v1/accounts/:externalId` | [provider.routes.ts:109](../backend/src/modules/hosting/routes/provider.routes.ts) |
| PATCH | `/api/hosting/v1/accounts/:externalId` | [provider.routes.ts:113](../backend/src/modules/hosting/routes/provider.routes.ts) |
| DELETE | `/api/hosting/v1/accounts/:externalId` | [provider.routes.ts:117](../backend/src/modules/hosting/routes/provider.routes.ts) |
| GET | `/api/hosting/v1/accounts/:externalId/usage` | [provider.routes.ts:122](../backend/src/modules/hosting/routes/provider.routes.ts) |
| PUT | `/api/hosting/v1/accounts/:externalId/sites/:siteId` | [provider.routes.ts:126](../backend/src/modules/hosting/routes/provider.routes.ts) |
| DELETE | `/api/hosting/v1/accounts/:externalId/sites/:siteId` | [provider.routes.ts:131](../backend/src/modules/hosting/routes/provider.routes.ts) |
| POST | `/api/hosting/v1/accounts/:externalId/access-ticket` | [provider.routes.ts:136](../backend/src/modules/hosting/routes/provider.routes.ts) |
| USE | `/api/roles/templates` | [template.routes.ts:12](../backend/src/modules/hosting/routes/template.routes.ts) |
| GET | `/api/roles/templates/capabilities` | [template.routes.ts:13](../backend/src/modules/hosting/routes/template.routes.ts) |
| GET | `/api/roles/templates` | [template.routes.ts:16](../backend/src/modules/hosting/routes/template.routes.ts) |
| POST | `/api/roles/templates` | [template.routes.ts:19](../backend/src/modules/hosting/routes/template.routes.ts) |
| PUT | `/api/roles/templates/:id` | [template.routes.ts:22](../backend/src/modules/hosting/routes/template.routes.ts) |
| DELETE | `/api/roles/templates/:id` | [template.routes.ts:26](../backend/src/modules/hosting/routes/template.routes.ts) |

## jobs

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/jobs` | [jobs.routes.ts:9](../backend/src/modules/jobs/routes/jobs.routes.ts) |
| GET | `/api/jobs/:id` | [jobs.routes.ts:14](../backend/src/modules/jobs/routes/jobs.routes.ts) |

## mail

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| GET | `/api/mail/outbound` | [mail.routes.ts:44](../backend/src/modules/mail/routes/mail.routes.ts) |
| PUT | `/api/mail/outbound` | [mail.routes.ts:45](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/mail/outbound/test` | [mail.routes.ts:46](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/mail/server-settings` | [mail.routes.ts:50](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/mail/server-settings/validate` | [mail.routes.ts:51](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/mail/jobs/:id` | [mail.routes.ts:53](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/mail/sudo/credential` | [mail.routes.ts:54](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/accounts` | [mail.routes.ts:57](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/accounts/domains` | [mail.routes.ts:58](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/accounts/autoresponder/charsets` | [mail.routes.ts:59](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/accounts` | [mail.routes.ts:60](../backend/src/modules/mail/routes/mail.routes.ts) |
| PUT | `/api/accounts/:id` | [mail.routes.ts:61](../backend/src/modules/mail/routes/mail.routes.ts) |
| DELETE | `/api/accounts/:id` | [mail.routes.ts:62](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/accounts/:accountId/forwards` | [mail.routes.ts:65](../backend/src/modules/mail/routes/mail.routes.ts) |
| PUT | `/api/accounts/:accountId/forwards` | [mail.routes.ts:66](../backend/src/modules/mail/routes/mail.routes.ts) |
| DELETE | `/api/accounts/:accountId/forwards/:forwardId` | [mail.routes.ts:67](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/accounts/:accountId/contacts` | [mail.routes.ts:70](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/accounts/:accountId/contacts` | [mail.routes.ts:71](../backend/src/modules/mail/routes/mail.routes.ts) |
| PUT | `/api/accounts/:accountId/contacts/:contactId` | [mail.routes.ts:72](../backend/src/modules/mail/routes/mail.routes.ts) |
| DELETE | `/api/accounts/:accountId/contacts/:contactId` | [mail.routes.ts:73](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/accounts/:accountId/filters` | [mail.routes.ts:76](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/accounts/:accountId/filters` | [mail.routes.ts:77](../backend/src/modules/mail/routes/mail.routes.ts) |
| PUT | `/api/accounts/:accountId/filters/:filterId` | [mail.routes.ts:78](../backend/src/modules/mail/routes/mail.routes.ts) |
| DELETE | `/api/accounts/:accountId/filters/:filterId` | [mail.routes.ts:79](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/accounts/:accountId/signatures` | [mail.routes.ts:82](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/accounts/:accountId/signatures` | [mail.routes.ts:83](../backend/src/modules/mail/routes/mail.routes.ts) |
| PUT | `/api/accounts/:accountId/signatures/:signatureId` | [mail.routes.ts:84](../backend/src/modules/mail/routes/mail.routes.ts) |
| DELETE | `/api/accounts/:accountId/signatures/:signatureId` | [mail.routes.ts:85](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/accounts/:accountId/autoresponder` | [mail.routes.ts:88](../backend/src/modules/mail/routes/mail.routes.ts) |
| PUT | `/api/accounts/:accountId/autoresponder` | [mail.routes.ts:89](../backend/src/modules/mail/routes/mail.routes.ts) |
| DELETE | `/api/accounts/:accountId/autoresponder` | [mail.routes.ts:90](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/accounts/:accountId/calendars` | [mail.routes.ts:93](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/accounts/:accountId/calendars` | [mail.routes.ts:94](../backend/src/modules/mail/routes/mail.routes.ts) |
| PUT | `/api/accounts/:accountId/calendars/:calendarId` | [mail.routes.ts:95](../backend/src/modules/mail/routes/mail.routes.ts) |
| DELETE | `/api/accounts/:accountId/calendars/:calendarId` | [mail.routes.ts:96](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/mail/master-access` | [mail.routes.ts:99](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/mail/master-access` | [mail.routes.ts:100](../backend/src/modules/mail/routes/mail.routes.ts) |
| DELETE | `/api/mail/master-access` | [mail.routes.ts:101](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/mail/:accountId/credential` | [mail.routes.ts:104](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/mail/:accountId/folders` | [mail.routes.ts:105](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/mail/:accountId/folders` | [mail.routes.ts:106](../backend/src/modules/mail/routes/mail.routes.ts) |
| PUT | `/api/mail/:accountId/folders` | [mail.routes.ts:107](../backend/src/modules/mail/routes/mail.routes.ts) |
| DELETE | `/api/mail/:accountId/folders` | [mail.routes.ts:108](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/mail/:accountId/messages` | [mail.routes.ts:109](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/mail/:accountId/messages/:uid` | [mail.routes.ts:110](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/mail/:accountId/disk-usage` | [mail.routes.ts:111](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/mail/:accountId/disk-usage/delete-by-date` | [mail.routes.ts:112](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/mail/:accountId/disk-usage/copy-by-date` | [mail.routes.ts:113](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/mail/:accountId/clone` | [mail.routes.ts:114](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/mail/domain-forwards` | [mail.routes.ts:115](../backend/src/modules/mail/routes/mail.routes.ts) |
| PUT | `/api/mail/domain-forwards` | [mail.routes.ts:116](../backend/src/modules/mail/routes/mail.routes.ts) |
| PUT | `/api/mail/domain-forwards/:domain` | [mail.routes.ts:117](../backend/src/modules/mail/routes/mail.routes.ts) |
| DELETE | `/api/mail/domain-forwards/:domain` | [mail.routes.ts:118](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/mail/domain-routing` | [mail.routes.ts:119](../backend/src/modules/mail/routes/mail.routes.ts) |
| PUT | `/api/mail/domain-routing` | [mail.routes.ts:120](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/mail/default-address` | [mail.routes.ts:121](../backend/src/modules/mail/routes/mail.routes.ts) |
| PUT | `/api/mail/default-address` | [mail.routes.ts:122](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/mail/track-delivery` | [mail.routes.ts:123](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/mail/global-filters` | [mail.routes.ts:127](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/mail/spam-filters` | [mail.routes.ts:128](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/mail/spam-filters/score-types` | [mail.routes.ts:129](../backend/src/modules/mail/routes/mail.routes.ts) |
| PUT | `/api/mail/spam-filters` | [mail.routes.ts:130](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/mail/archive` | [mail.routes.ts:131](../backend/src/modules/mail/routes/mail.routes.ts) |
| PUT | `/api/mail/archive/defaults` | [mail.routes.ts:132](../backend/src/modules/mail/routes/mail.routes.ts) |
| PUT | `/api/mail/archive/domain` | [mail.routes.ts:133](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/mail/archive/:domain/messages` | [mail.routes.ts:134](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/mail/archive/:domain/messages/:direction/:folder/:name/raw` | [mail.routes.ts:135](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/mail/archive/:domain/messages/:direction/:folder/:name/restore` | [mail.routes.ts:136](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/mail/encryption` | [mail.routes.ts:137](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/mail/encryption/keys` | [mail.routes.ts:138](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/mail/encryption/import` | [mail.routes.ts:139](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/mail/encryption/import-private` | [mail.routes.ts:140](../backend/src/modules/mail/routes/mail.routes.ts) |
| DELETE | `/api/mail/encryption/keys/:keyId` | [mail.routes.ts:141](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/mail/global-filters` | [mail.routes.ts:142](../backend/src/modules/mail/routes/mail.routes.ts) |
| PUT | `/api/mail/global-filters/:filterId` | [mail.routes.ts:143](../backend/src/modules/mail/routes/mail.routes.ts) |
| DELETE | `/api/mail/global-filters/:filterId` | [mail.routes.ts:144](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/mail/global-filters/test` | [mail.routes.ts:145](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/mail/:accountId/messages/:uid/raw` | [mail.routes.ts:148](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/mail/:accountId/messages/:uid/attachments/:index` | [mail.routes.ts:149](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/mail/:accountId/messages/:uid/move` | [mail.routes.ts:150](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/mail/:accountId/messages/:uid/flag` | [mail.routes.ts:151](../backend/src/modules/mail/routes/mail.routes.ts) |
| DELETE | `/api/mail/:accountId/messages/:uid` | [mail.routes.ts:152](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/mail/:accountId/send` | [mail.routes.ts:155](../backend/src/modules/mail/routes/mail.routes.ts) |
| PUT | `/api/mail/:accountId/drafts/:uid` | [mail.routes.ts:156](../backend/src/modules/mail/routes/mail.routes.ts) |
| POST | `/api/mail/:accountId/messages/:uid/decrypt` | [mail.routes.ts:157](../backend/src/modules/mail/routes/mail.routes.ts) |
| GET | `/api/mail/:accountId/contacts` | [mail.routes.ts:160](../backend/src/modules/mail/routes/mail.routes.ts) |

## mcp

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/mcp` | [index.ts:24](../backend/src/modules/mcp/index.ts) |
| POST | `/:id/install` | [mcp.routes.ts:26](../backend/src/modules/mcp/routes/mcp.routes.ts) |
| POST | `/:id/test-connection` | [mcp.routes.ts:32](../backend/src/modules/mcp/routes/mcp.routes.ts) |
| POST | `/:id/uninstall` | [mcp.routes.ts:41](../backend/src/modules/mcp/routes/mcp.routes.ts) |
| POST | `/:id/tools` | [mcp.routes.ts:47](../backend/src/modules/mcp/routes/mcp.routes.ts) |
| POST | `/:id/call-tool/:toolName` | [mcp.routes.ts:54](../backend/src/modules/mcp/routes/mcp.routes.ts) |

## module-dev

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/module-dev` | [module-dev.routes.ts:28](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| USE | `/api/module-dev/logs` | [module-dev.routes.ts:29](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| GET | `/api/module-dev/logs` | [module-dev.routes.ts:31](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| GET | `/api/module-dev/logs/status` | [module-dev.routes.ts:32](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| GET | `/api/module-dev/logs/config` | [module-dev.routes.ts:33](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| PUT | `/api/module-dev/logs/config` | [module-dev.routes.ts:34](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| GET | `/api/module-dev/logs/incidents/:id` | [module-dev.routes.ts:35](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| GET | `/api/module-dev/logs/repairs` | [module-dev.routes.ts:36](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| POST | `/api/module-dev/logs/repairs` | [module-dev.routes.ts:37](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| GET | `/api/module-dev/logs/repairs/:id` | [module-dev.routes.ts:38](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| POST | `/api/module-dev/logs/repairs/:id/cancel` | [module-dev.routes.ts:39](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| POST | `/api/module-dev/logs/repairs/:id/retry` | [module-dev.routes.ts:40](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| POST | `/api/module-dev/logs/repairs/:id/approval` | [module-dev.routes.ts:41](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| GET | `/api/module-dev/project/tree` | [module-dev.routes.ts:44](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| GET | `/api/module-dev/project/search` | [module-dev.routes.ts:45](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| GET | `/api/module-dev/project/file` | [module-dev.routes.ts:46](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| POST | `/api/module-dev/project/refresh` | [module-dev.routes.ts:47](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| GET | `/api/module-dev/modules` | [module-dev.routes.ts:50](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| GET | `/api/module-dev/modules/:code/reviews` | [module-dev.routes.ts:51](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| POST | `/api/module-dev/modules/submit` | [module-dev.routes.ts:52](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| POST | `/api/module-dev/modules/:code/resubmit` | [module-dev.routes.ts:53](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| POST | `/api/module-dev/modules/:code/unpublish` | [module-dev.routes.ts:54](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| POST | `/api/module-dev/modules/:code/republish` | [module-dev.routes.ts:55](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| POST | `/api/module-dev/manifest/validate` | [module-dev.routes.ts:58](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| POST | `/api/module-dev/checks/run` | [module-dev.routes.ts:59](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| POST | `/api/module-dev/tests/run` | [module-dev.routes.ts:60](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| GET | `/api/module-dev/links` | [module-dev.routes.ts:63](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| GET | `/api/module-dev/preview` | [module-dev.routes.ts:66](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| POST | `/api/module-dev/preview/install` | [module-dev.routes.ts:67](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| POST | `/api/module-dev/preview/uninstall` | [module-dev.routes.ts:68](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |
| POST | `/api/module-dev/preview/:moduleId/tool/:name` | [module-dev.routes.ts:69](../backend/src/modules/module-dev/routes/module-dev.routes.ts) |

## monitor

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/monitor` | [monitor.routes.ts:14](../backend/src/modules/monitor/routes/monitor.routes.ts) |
| GET | `/api/monitor/system` | [monitor.routes.ts:28](../backend/src/modules/monitor/routes/monitor.routes.ts) |
| GET | `/api/monitor/time` | [monitor.routes.ts:29](../backend/src/modules/monitor/routes/monitor.routes.ts) |
| GET | `/api/monitor/stats` | [monitor.routes.ts:30](../backend/src/modules/monitor/routes/monitor.routes.ts) |
| GET | `/api/monitor/snapshot` | [monitor.routes.ts:31](../backend/src/modules/monitor/routes/monitor.routes.ts) |
| GET | `/api/monitor/history` | [monitor.routes.ts:32](../backend/src/modules/monitor/routes/monitor.routes.ts) |
| GET | `/api/monitor/services` | [monitor.routes.ts:33](../backend/src/modules/monitor/routes/monitor.routes.ts) |
| POST | `/api/monitor/services/:name/start` | [monitor.routes.ts:34](../backend/src/modules/monitor/routes/monitor.routes.ts) |
| POST | `/api/monitor/services/:name/install` | [monitor.routes.ts:35](../backend/src/modules/monitor/routes/monitor.routes.ts) |
| GET | `/api/monitor/processes` | [monitor.routes.ts:36](../backend/src/modules/monitor/routes/monitor.routes.ts) |
| POST | `/api/monitor/processes/:pid/kill` | [monitor.routes.ts:37](../backend/src/modules/monitor/routes/monitor.routes.ts) |
| GET | `/api/monitor/watchdog` | [monitor.routes.ts:40](../backend/src/modules/monitor/routes/monitor.routes.ts) |
| PUT | `/api/monitor/watchdog` | [monitor.routes.ts:41](../backend/src/modules/monitor/routes/monitor.routes.ts) |
| GET | `/api/monitor/ws/clients` | [monitor.routes.ts:44](../backend/src/modules/monitor/routes/monitor.routes.ts) |
| GET | `/api/monitor/alerts/rules` | [monitor.routes.ts:47](../backend/src/modules/monitor/routes/monitor.routes.ts) |
| POST | `/api/monitor/alerts/rules` | [monitor.routes.ts:48](../backend/src/modules/monitor/routes/monitor.routes.ts) |
| PUT | `/api/monitor/alerts/rules/:id` | [monitor.routes.ts:49](../backend/src/modules/monitor/routes/monitor.routes.ts) |
| DELETE | `/api/monitor/alerts/rules/:id` | [monitor.routes.ts:50](../backend/src/modules/monitor/routes/monitor.routes.ts) |
| GET | `/api/monitor/alerts/events` | [monitor.routes.ts:53](../backend/src/modules/monitor/routes/monitor.routes.ts) |
| GET | `/api/monitor/alerts/firing` | [monitor.routes.ts:54](../backend/src/modules/monitor/routes/monitor.routes.ts) |

## nginx

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/nginx` | [nginx.routes.ts:16](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| GET | `/api/nginx/status` | [nginx.routes.ts:19](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| POST | `/api/nginx/service` | [nginx.routes.ts:20](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| GET | `/api/nginx/config` | [nginx.routes.ts:21](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| PUT | `/api/nginx/config` | [nginx.routes.ts:22](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| GET | `/api/nginx/logs` | [nginx.routes.ts:23](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| GET | `/api/nginx/performance` | [nginx.routes.ts:24](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| PUT | `/api/nginx/performance` | [nginx.routes.ts:25](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| GET | `/api/nginx/domains` | [nginx.routes.ts:28](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| GET | `/api/nginx/domains/discovered` | [nginx.routes.ts:29](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| GET | `/api/nginx/upstreams` | [nginx.routes.ts:30](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| POST | `/api/nginx/proxy/preview` | [nginx.routes.ts:33](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| POST | `/api/nginx/proxy` | [nginx.routes.ts:34](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| GET | `/api/nginx/ssl/renewal` | [nginx.routes.ts:37](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| GET | `/api/nginx/ssl/renewal/sites` | [nginx.routes.ts:38](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| POST | `/api/nginx/ssl/renewal` | [nginx.routes.ts:39](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| POST | `/api/nginx/ssl/renewal/dry-run` | [nginx.routes.ts:40](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| GET | `/api/nginx/sites` | [nginx.routes.ts:43](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| POST | `/api/nginx/sites` | [nginx.routes.ts:44](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| POST | `/api/nginx/sites/preview` | [nginx.routes.ts:45](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| GET | `/api/nginx/sites/:name/raw` | [nginx.routes.ts:46](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| PUT | `/api/nginx/sites/:name` | [nginx.routes.ts:47](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| POST | `/api/nginx/sites/:name/enable` | [nginx.routes.ts:48](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| POST | `/api/nginx/sites/:name/disable` | [nginx.routes.ts:49](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| POST | `/api/nginx/sites/:name/ssl` | [nginx.routes.ts:50](../backend/src/modules/nginx/routes/nginx.routes.ts) |
| DELETE | `/api/nginx/sites/:name` | [nginx.routes.ts:51](../backend/src/modules/nginx/routes/nginx.routes.ts) |

## notifications

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/notifications` | [notifications.routes.ts:12](../backend/src/modules/notifications/routes/notifications.routes.ts) |
| USE | `/api/notifications` | [notifications.routes.ts:13](../backend/src/modules/notifications/routes/notifications.routes.ts) |
| GET | `/api/notifications` | [notifications.routes.ts:16](../backend/src/modules/notifications/routes/notifications.routes.ts) |
| GET | `/api/notifications/unread-count` | [notifications.routes.ts:17](../backend/src/modules/notifications/routes/notifications.routes.ts) |
| GET | `/api/notifications/stream` | [notifications.routes.ts:18](../backend/src/modules/notifications/routes/notifications.routes.ts) |
| POST | `/api/notifications` | [notifications.routes.ts:22](../backend/src/modules/notifications/routes/notifications.routes.ts) |
| POST | `/api/notifications/read-all` | [notifications.routes.ts:23](../backend/src/modules/notifications/routes/notifications.routes.ts) |
| PATCH | `/api/notifications/:id/read` | [notifications.routes.ts:24](../backend/src/modules/notifications/routes/notifications.routes.ts) |
| DELETE | `/api/notifications/:id` | [notifications.routes.ts:25](../backend/src/modules/notifications/routes/notifications.routes.ts) |
| DELETE | `/api/notifications` | [notifications.routes.ts:26](../backend/src/modules/notifications/routes/notifications.routes.ts) |

## obsidian

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/obsidian` | [obsidian.routes.ts:11](../backend/src/modules/obsidian/routes/obsidian.routes.ts) |
| GET | `/api/obsidian/preferences` | [obsidian.routes.ts:13](../backend/src/modules/obsidian/routes/obsidian.routes.ts) |
| PATCH | `/api/obsidian/preferences` | [obsidian.routes.ts:14](../backend/src/modules/obsidian/routes/obsidian.routes.ts) |
| GET | `/api/obsidian/vaults` | [obsidian.routes.ts:17](../backend/src/modules/obsidian/routes/obsidian.routes.ts) |
| POST | `/api/obsidian/vaults` | [obsidian.routes.ts:18](../backend/src/modules/obsidian/routes/obsidian.routes.ts) |
| DELETE | `/api/obsidian/vaults/:id` | [obsidian.routes.ts:19](../backend/src/modules/obsidian/routes/obsidian.routes.ts) |
| GET | `/api/obsidian/containers` | [obsidian.routes.ts:22](../backend/src/modules/obsidian/routes/obsidian.routes.ts) |
| POST | `/api/obsidian/containers/sync` | [obsidian.routes.ts:23](../backend/src/modules/obsidian/routes/obsidian.routes.ts) |
| GET | `/api/obsidian/vaults/:id/tree` | [obsidian.routes.ts:26](../backend/src/modules/obsidian/routes/obsidian.routes.ts) |
| GET | `/api/obsidian/vaults/:id/note` | [obsidian.routes.ts:27](../backend/src/modules/obsidian/routes/obsidian.routes.ts) |
| PUT | `/api/obsidian/vaults/:id/note` | [obsidian.routes.ts:28](../backend/src/modules/obsidian/routes/obsidian.routes.ts) |
| POST | `/api/obsidian/vaults/:id/note/append` | [obsidian.routes.ts:29](../backend/src/modules/obsidian/routes/obsidian.routes.ts) |
| POST | `/api/obsidian/vaults/:id/daily` | [obsidian.routes.ts:30](../backend/src/modules/obsidian/routes/obsidian.routes.ts) |
| GET | `/api/obsidian/vaults/:id/daily/today` | [obsidian.routes.ts:31](../backend/src/modules/obsidian/routes/obsidian.routes.ts) |
| POST | `/api/obsidian/vaults/:id/note/rename` | [obsidian.routes.ts:32](../backend/src/modules/obsidian/routes/obsidian.routes.ts) |
| DELETE | `/api/obsidian/vaults/:id/note` | [obsidian.routes.ts:33](../backend/src/modules/obsidian/routes/obsidian.routes.ts) |
| POST | `/api/obsidian/vaults/:id/folders` | [obsidian.routes.ts:34](../backend/src/modules/obsidian/routes/obsidian.routes.ts) |
| GET | `/api/obsidian/vaults/:id/search` | [obsidian.routes.ts:37](../backend/src/modules/obsidian/routes/obsidian.routes.ts) |
| GET | `/api/obsidian/vaults/:id/links` | [obsidian.routes.ts:38](../backend/src/modules/obsidian/routes/obsidian.routes.ts) |
| POST | `/api/obsidian/vaults/:id/assistant-context` | [obsidian.routes.ts:41](../backend/src/modules/obsidian/routes/obsidian.routes.ts) |

## openclaw

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/openclaw` | [openclaw.routes.ts:16](../backend/src/modules/openclaw/routes/openclaw.routes.ts) |
| GET | `/api/openclaw/config` | [openclaw.routes.ts:18](../backend/src/modules/openclaw/routes/openclaw.routes.ts) |
| PUT | `/api/openclaw/config` | [openclaw.routes.ts:19](../backend/src/modules/openclaw/routes/openclaw.routes.ts) |
| DELETE | `/api/openclaw/api-key` | [openclaw.routes.ts:20](../backend/src/modules/openclaw/routes/openclaw.routes.ts) |
| POST | `/api/openclaw/test` | [openclaw.routes.ts:21](../backend/src/modules/openclaw/routes/openclaw.routes.ts) |

## search

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/search` | [search.routes.ts:23](../backend/src/modules/search/routes/search.routes.ts) |
| POST | `/api/search/intent` | [search.routes.ts:24](../backend/src/modules/search/routes/search.routes.ts) |

## security-audit

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/security-audit` | [middleware.ts:12](../backend/src/modules/security-audit/middleware.ts) |
| POST | `/start` | [index.ts:17](../backend/src/modules/security-audit/routes/index.ts) |
| GET | `/scanners` | [index.ts:18](../backend/src/modules/security-audit/routes/index.ts) |
| POST | `/scanners/:name/install` | [index.ts:22](../backend/src/modules/security-audit/routes/index.ts) |
| GET | `/reports` | [index.ts:23](../backend/src/modules/security-audit/routes/index.ts) |
| GET | `/report/:id` | [index.ts:24](../backend/src/modules/security-audit/routes/index.ts) |

## server-alerts

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/server-alerts` | [server-alerts.routes.ts:13](../backend/src/modules/server-alerts/routes/server-alerts.routes.ts) |
| GET | `/api/server-alerts/prefs` | [server-alerts.routes.ts:16](../backend/src/modules/server-alerts/routes/server-alerts.routes.ts) |
| PUT | `/api/server-alerts/prefs` | [server-alerts.routes.ts:17](../backend/src/modules/server-alerts/routes/server-alerts.routes.ts) |
| GET | `/api/server-alerts/me/preferences` | [server-alerts.routes.ts:18](../backend/src/modules/server-alerts/routes/server-alerts.routes.ts) |
| PUT | `/api/server-alerts/me/preferences` | [server-alerts.routes.ts:19](../backend/src/modules/server-alerts/routes/server-alerts.routes.ts) |
| GET | `/api/server-alerts/channels` | [server-alerts.routes.ts:20](../backend/src/modules/server-alerts/routes/server-alerts.routes.ts) |
| POST | `/api/server-alerts/devices/web` | [server-alerts.routes.ts:21](../backend/src/modules/server-alerts/routes/server-alerts.routes.ts) |
| POST | `/api/server-alerts/devices/mobile` | [server-alerts.routes.ts:22](../backend/src/modules/server-alerts/routes/server-alerts.routes.ts) |
| DELETE | `/api/server-alerts/devices/:channel` | [server-alerts.routes.ts:23](../backend/src/modules/server-alerts/routes/server-alerts.routes.ts) |
| GET | `/api/server-alerts/history` | [server-alerts.routes.ts:24](../backend/src/modules/server-alerts/routes/server-alerts.routes.ts) |
| POST | `/api/server-alerts/test` | [server-alerts.routes.ts:25](../backend/src/modules/server-alerts/routes/server-alerts.routes.ts) |
| POST | `/api/server-alerts/send` | [server-alerts.routes.ts:28](../backend/src/modules/server-alerts/routes/server-alerts.routes.ts) |
| GET | `/api/server-alerts/scheduled` | [server-alerts.routes.ts:31](../backend/src/modules/server-alerts/routes/server-alerts.routes.ts) |
| POST | `/api/server-alerts/scheduled` | [server-alerts.routes.ts:32](../backend/src/modules/server-alerts/routes/server-alerts.routes.ts) |
| PUT | `/api/server-alerts/scheduled/:id` | [server-alerts.routes.ts:33](../backend/src/modules/server-alerts/routes/server-alerts.routes.ts) |
| DELETE | `/api/server-alerts/scheduled/:id` | [server-alerts.routes.ts:34](../backend/src/modules/server-alerts/routes/server-alerts.routes.ts) |
| GET | `/api/server-alerts/rules` | [server-alerts.routes.ts:37](../backend/src/modules/server-alerts/routes/server-alerts.routes.ts) |
| POST | `/api/server-alerts/rules` | [server-alerts.routes.ts:38](../backend/src/modules/server-alerts/routes/server-alerts.routes.ts) |
| PUT | `/api/server-alerts/rules/:id` | [server-alerts.routes.ts:39](../backend/src/modules/server-alerts/routes/server-alerts.routes.ts) |
| DELETE | `/api/server-alerts/rules/:id` | [server-alerts.routes.ts:40](../backend/src/modules/server-alerts/routes/server-alerts.routes.ts) |

## servers

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| POST | `/api/servers/local/switch` | [servers.routes.ts:19](../backend/src/modules/servers/routes/servers.routes.ts) |
| USE | `/api/servers` | [servers.routes.ts:30](../backend/src/modules/servers/routes/servers.routes.ts) |
| GET | `/api/servers` | [servers.routes.ts:32](../backend/src/modules/servers/routes/servers.routes.ts) |
| POST | `/api/servers` | [servers.routes.ts:33](../backend/src/modules/servers/routes/servers.routes.ts) |
| PUT | `/api/servers/:id` | [servers.routes.ts:34](../backend/src/modules/servers/routes/servers.routes.ts) |
| DELETE | `/api/servers/:id` | [servers.routes.ts:35](../backend/src/modules/servers/routes/servers.routes.ts) |
| POST | `/api/servers/:id/test` | [servers.routes.ts:38](../backend/src/modules/servers/routes/servers.routes.ts) |
| POST | `/api/servers/:id/fingerprint/approve` | [servers.routes.ts:39](../backend/src/modules/servers/routes/servers.routes.ts) |
| POST | `/api/servers/:id/switch` | [servers.routes.ts:42](../backend/src/modules/servers/routes/servers.routes.ts) |

## sudo

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/sudo` | [sudo.routes.ts:12](../backend/src/modules/sudo/routes/sudo.routes.ts) |
| GET | `/api/sudo/status` | [sudo.routes.ts:14](../backend/src/modules/sudo/routes/sudo.routes.ts) |
| POST | `/api/sudo/credential` | [sudo.routes.ts:18](../backend/src/modules/sudo/routes/sudo.routes.ts) |
| DELETE | `/api/sudo/credential` | [sudo.routes.ts:19](../backend/src/modules/sudo/routes/sudo.routes.ts) |

## system-deps

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| GET | `/api/system-deps/:module` | [system-deps.routes.ts:40](../backend/src/modules/system-deps/routes/system-deps.routes.ts) |
| POST | `/api/system-deps/:module/install` | [system-deps.routes.ts:46](../backend/src/modules/system-deps/routes/system-deps.routes.ts) |

## terminal

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/terminal` | [terminal.routes.ts:29](../backend/src/modules/terminal/routes/terminal.routes.ts) |
| GET | `/api/terminal/preferences` | [terminal.routes.ts:30](../backend/src/modules/terminal/routes/terminal.routes.ts) |
| PATCH | `/api/terminal/preferences` | [terminal.routes.ts:31](../backend/src/modules/terminal/routes/terminal.routes.ts) |
| GET | `/api/terminal/sessions` | [terminal.routes.ts:34](../backend/src/modules/terminal/routes/terminal.routes.ts) |
| DELETE | `/api/terminal/sessions/:sessionId` | [terminal.routes.ts:37](../backend/src/modules/terminal/routes/terminal.routes.ts) |
| GET | `/api/terminal/conversations` | [terminal.routes.ts:40](../backend/src/modules/terminal/routes/terminal.routes.ts) |
| DELETE | `/api/terminal/conversations` | [terminal.routes.ts:41](../backend/src/modules/terminal/routes/terminal.routes.ts) |
| GET | `/api/terminal/tmux-status` | [terminal.routes.ts:45](../backend/src/modules/terminal/routes/terminal.routes.ts) |
| POST | `/api/terminal/tmux-install` | [terminal.routes.ts:46](../backend/src/modules/terminal/routes/terminal.routes.ts) |
| GET | `/api/terminal/snippets` | [terminal.routes.ts:49](../backend/src/modules/terminal/routes/terminal.routes.ts) |
| POST | `/api/terminal/snippets/categories` | [terminal.routes.ts:52](../backend/src/modules/terminal/routes/terminal.routes.ts) |
| PATCH | `/api/terminal/snippets/categories/:id` | [terminal.routes.ts:53](../backend/src/modules/terminal/routes/terminal.routes.ts) |
| DELETE | `/api/terminal/snippets/categories/:id` | [terminal.routes.ts:54](../backend/src/modules/terminal/routes/terminal.routes.ts) |
| POST | `/api/terminal/snippets/tags` | [terminal.routes.ts:57](../backend/src/modules/terminal/routes/terminal.routes.ts) |
| PATCH | `/api/terminal/snippets/tags/:id` | [terminal.routes.ts:58](../backend/src/modules/terminal/routes/terminal.routes.ts) |
| DELETE | `/api/terminal/snippets/tags/:id` | [terminal.routes.ts:59](../backend/src/modules/terminal/routes/terminal.routes.ts) |
| POST | `/api/terminal/snippets/import` | [terminal.routes.ts:64](../backend/src/modules/terminal/routes/terminal.routes.ts) |
| POST | `/api/terminal/snippets` | [terminal.routes.ts:65](../backend/src/modules/terminal/routes/terminal.routes.ts) |
| PATCH | `/api/terminal/snippets/:id` | [terminal.routes.ts:66](../backend/src/modules/terminal/routes/terminal.routes.ts) |
| DELETE | `/api/terminal/snippets/:id` | [terminal.routes.ts:67](../backend/src/modules/terminal/routes/terminal.routes.ts) |

## terminal-cli

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| USE | `/api/terminal-cli` | [terminal-cli.routes.ts:18](../backend/src/modules/terminal-cli/routes/terminal-cli.routes.ts) |
| GET | `/api/terminal-cli/state` | [terminal-cli.routes.ts:28](../backend/src/modules/terminal-cli/routes/terminal-cli.routes.ts) |
| GET | `/api/terminal-cli/probe` | [terminal-cli.routes.ts:34](../backend/src/modules/terminal-cli/routes/terminal-cli.routes.ts) |
| POST | `/api/terminal-cli/installed` | [terminal-cli.routes.ts:40](../backend/src/modules/terminal-cli/routes/terminal-cli.routes.ts) |
| POST | `/api/terminal-cli/active` | [terminal-cli.routes.ts:46](../backend/src/modules/terminal-cli/routes/terminal-cli.routes.ts) |
| POST | `/api/terminal-cli/onboarding/complete` | [terminal-cli.routes.ts:52](../backend/src/modules/terminal-cli/routes/terminal-cli.routes.ts) |
| POST | `/api/terminal-cli/onboarding/skip` | [terminal-cli.routes.ts:58](../backend/src/modules/terminal-cli/routes/terminal-cli.routes.ts) |

## users

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| GET | `/api/preferences` | [users.routes.ts:49](../backend/src/modules/users/routes/users.routes.ts) |
| GET | `/api/preferences/ui` | [users.routes.ts:50](../backend/src/modules/users/routes/users.routes.ts) |
| GET | `/api/preferences/chat` | [users.routes.ts:51](../backend/src/modules/users/routes/users.routes.ts) |
| GET | `/api/preferences/audit-log` | [users.routes.ts:52](../backend/src/modules/users/routes/users.routes.ts) |
| PUT | `/api/preferences` | [users.routes.ts:53](../backend/src/modules/users/routes/users.routes.ts) |
| PUT | `/api/preferences/password` | [users.routes.ts:54](../backend/src/modules/users/routes/users.routes.ts) |
| PUT | `/api/preferences/ui` | [users.routes.ts:55](../backend/src/modules/users/routes/users.routes.ts) |
| PUT | `/api/preferences/chat` | [users.routes.ts:56](../backend/src/modules/users/routes/users.routes.ts) |
| GET | `/api/users` | [users.routes.ts:62](../backend/src/modules/users/routes/users.routes.ts) |
| GET | `/api/users/sessions` | [users.routes.ts:63](../backend/src/modules/users/routes/users.routes.ts) |
| POST | `/api/users` | [users.routes.ts:64](../backend/src/modules/users/routes/users.routes.ts) |
| PUT | `/api/users/:id` | [users.routes.ts:65](../backend/src/modules/users/routes/users.routes.ts) |
| DELETE | `/api/users/:id` | [users.routes.ts:66](../backend/src/modules/users/routes/users.routes.ts) |
| PUT | `/api/users/:id/password` | [users.routes.ts:67](../backend/src/modules/users/routes/users.routes.ts) |
| POST | `/api/users/:id/login-key` | [users.routes.ts:70](../backend/src/modules/users/routes/users.routes.ts) |
| GET | `/api/users/:id/ssh-keys` | [users.routes.ts:71](../backend/src/modules/users/routes/users.routes.ts) |
| POST | `/api/users/:id/ssh-keys` | [users.routes.ts:72](../backend/src/modules/users/routes/users.routes.ts) |
| DELETE | `/api/users/:id/ssh-keys` | [users.routes.ts:73](../backend/src/modules/users/routes/users.routes.ts) |
| GET | `/api/roles` | [users.routes.ts:76](../backend/src/modules/users/routes/users.routes.ts) |
| GET | `/api/roles/permission-catalog` | [users.routes.ts:77](../backend/src/modules/users/routes/users.routes.ts) |
| POST | `/api/roles` | [users.routes.ts:78](../backend/src/modules/users/routes/users.routes.ts) |
| PUT | `/api/roles/:name` | [users.routes.ts:79](../backend/src/modules/users/routes/users.routes.ts) |
| DELETE | `/api/roles/:name` | [users.routes.ts:80](../backend/src/modules/users/routes/users.routes.ts) |

## webhooks

| Declaración | Ruta / expresión | Fuente |
|---|---|---|
| GET | `/api/webhooks/events` | [webhooks.routes.ts:22](../backend/src/modules/webhooks/routes/webhooks.routes.ts) |
| GET | `/api/webhooks/categories` | [webhooks.routes.ts:24](../backend/src/modules/webhooks/routes/webhooks.routes.ts) |
| GET | `/api/webhooks/gateways` | [webhooks.routes.ts:25](../backend/src/modules/webhooks/routes/webhooks.routes.ts) |
| GET | `/api/webhooks/gateways/:id` | [webhooks.routes.ts:26](../backend/src/modules/webhooks/routes/webhooks.routes.ts) |
| POST | `/api/webhooks/gateways` | [webhooks.routes.ts:27](../backend/src/modules/webhooks/routes/webhooks.routes.ts) |
| PUT | `/api/webhooks/gateways/:id` | [webhooks.routes.ts:28](../backend/src/modules/webhooks/routes/webhooks.routes.ts) |
| DELETE | `/api/webhooks/gateways/:id` | [webhooks.routes.ts:29](../backend/src/modules/webhooks/routes/webhooks.routes.ts) |
| GET | `/api/webhooks/discovered` | [webhooks.routes.ts:31](../backend/src/modules/webhooks/routes/webhooks.routes.ts) |
| POST | `/api/webhooks/discovered/scan` | [webhooks.routes.ts:32](../backend/src/modules/webhooks/routes/webhooks.routes.ts) |
| POST | `/api/webhooks/discovered/action` | [webhooks.routes.ts:33](../backend/src/modules/webhooks/routes/webhooks.routes.ts) |
| GET | `/api/webhooks` | [webhooks.routes.ts:34](../backend/src/modules/webhooks/routes/webhooks.routes.ts) |
| GET | `/api/webhooks/:id/deliveries` | [webhooks.routes.ts:35](../backend/src/modules/webhooks/routes/webhooks.routes.ts) |
| POST | `/api/webhooks/:id/test` | [webhooks.routes.ts:36](../backend/src/modules/webhooks/routes/webhooks.routes.ts) |
| POST | `/api/webhooks` | [webhooks.routes.ts:37](../backend/src/modules/webhooks/routes/webhooks.routes.ts) |
| PUT | `/api/webhooks/:id` | [webhooks.routes.ts:38](../backend/src/modules/webhooks/routes/webhooks.routes.ts) |
| POST | `/api/webhooks/:id/regenerate-secret` | [webhooks.routes.ts:39](../backend/src/modules/webhooks/routes/webhooks.routes.ts) |
| DELETE | `/api/webhooks/:id` | [webhooks.routes.ts:40](../backend/src/modules/webhooks/routes/webhooks.routes.ts) |
| GET | `/api/api-keys` | [webhooks.routes.ts:43](../backend/src/modules/webhooks/routes/webhooks.routes.ts) |
| POST | `/api/api-keys` | [webhooks.routes.ts:44](../backend/src/modules/webhooks/routes/webhooks.routes.ts) |
| DELETE | `/api/api-keys/:id` | [webhooks.routes.ts:45](../backend/src/modules/webhooks/routes/webhooks.routes.ts) |
| POST | `/api/payments/wompi/webhook` | [projects.detector.ts:149](../backend/src/modules/webhooks/services/discovery/projects.detector.ts) |

