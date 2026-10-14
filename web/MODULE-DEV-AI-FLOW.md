> Revisión del modelo 2026-10-13: ejecución local/SSH del panel instalado y cuenta vinculada por clave con nombre. Las fechas y checkpoints de implementación de esta especificación son históricos, no evidencia de despliegue actual. Contrato vigente: [Marketplace API](../LP-LICENSE-SERVER/MARKETPLACE-API.md). No configurar un modo managed ni enviar `panelId` para crear la clave de cuenta.

# MODULE DEV AI FLOW — Creación de módulos guiada por IA (obligatoria)

> Estado: **IMPLEMENTADO v1 (2026-06-11)** sobre las piezas del asistente que
> ya existían. Este documento define el flujo público/de usuario del
> marketplace de módulos: **cómo un developer crea, prueba y publica un módulo
> SIN escribirlo a mano**, siempre a través del asistente IA de LUXIPANEL.
>
> Lo entregado en v1 (todo con `file:line` reales abajo; compila + 53 tests
> vitest verde en LUXIPANEL y 33 tsx en LP-LS): el **módulo `module-dev`**
> (`backend/src/modules/module-dev/`, registrado en `server.ts:171`, catálogo
> `developer`/`free` en `module-registry.service.ts:388`), el **architecture
> pack** marketplace (plantillas de provider con manifest borrador + esqueleto
> `defineModule` + reglas), el **slash `/mod`** con subcomandos en español, el
> **system prompt + guion de asks** marketplace, la **asociación
> proyecto-asistente ↔ módulo** (sidecar `shared/marketplace-link/`), el
> **preview Modo B** (vendoriza a `community/installed/`, código INERTE hasta
> que el sandbox out-of-process esté listo — `MODULE_DEV_PREVIEW_ENABLED=false`
> por default), el **runner de tests** en el servidor del dev, las **tools de
> agente `module-dev.*`** (vía MCP loopback), los endpoints dev-side
> **despublicar/republicar** en LP-LS y la **UI `/panel/module-dev`**.
>
> **Construido tras el v1 inicial (Track 3, 2026-06-14)** y promovido a §5.1:
> ask protocol en modo API (tool `assistant.ask`), runner CI del pipeline LP
> (análisis estático + workflow GitHub Actions), CLI `lux` standalone
> (`@luxipanel/lux-cli`: login/validate/submit/status/test), KYC real (Stripe
> Identity con degradación a stub) y portal de dev en `license-frontend`
> (5 páginas Astro). Sigue **fuera del alcance** SOLO el setup EXTERNO genuino
> y los huecos no construidos (detalle en §5.2): alta del repo/secrets de
> GitHub CI, credenciales del proveedor KYC (Stripe Dashboard), deploy de
> `license-frontend` (en SU servidor), runtime endurecido out-of-process para
> EJECUTAR previews (`feat/preview-sandbox-f1`), Modo A (`lux dev` hot-reload),
> sandbox multi-tenant del dev y cambio de scope in-place.
>
> Documentos hermanos (no se duplican aquí, se enlazan):
> - **`MODULE-SDK-SPEC.md`** (este repo) — el contrato técnico que consume la
>   IA: manifest (§1), SDK `@luxipanel/module-sdk` (§2), capabilities (§3),
>   loader/dispatch (§5). Su §0 es el resumen ejecutivo de este flujo.
> - **`/var/www/LP-LICENSE-SERVER/ROADMAP-DEV-MARKETPLACE.md`** — plan maestro
>   (estados §3, pipeline §4, economía §5, fases §10). Su §8 ("Experiencia del
>   desarrollador — flujo IA-OBLIGATORIO") es el gemelo de este doc del lado
>   LP-LS; §8.1 define los modos de prueba (Modo A / Modo B).
> - **`/var/www/LP-LICENSE-SERVER/MARKETPLACE-API.md`** — contrato de los
>   endpoints `/v1/api/dev/*` que aparecen en §3.6.

---

## 1. Principio: el dev NUNCA escribe el módulo a mano

**Requisito de negocio (2026-06-09).** Todo módulo del marketplace se produce
**con el asistente IA de LUXIPANEL** (providers CLI claude/codex/gemini, ya
integrados en `backend/src/modules/ai-assistant/`). No existe el camino
"abro el editor y programo contra el SDK": la superficie de desarrollo es la
conversación con la IA.

¿Por qué obligatorio?

| Razón | Detalle |
|---|---|
| **Acople al ecosistema** | El panel tiene patrones canónicos no negociables (Executor fail-closed, write-behind, scripts extraídos con `astro:page-load` + `AbortController`, prefijo de tools `<moduleId>.` — ver `MODULE-SDK-SPEC.md` cabecera y memoria `luxipanel-agent-tool-name-prefix`). La IA carga ese contexto **siempre completo y siempre actualizado**; un dev externo lo violaría por desconocimiento. |
| **Calidad uniforme** | La arquitectura del módulo está **predefinida** (plantilla/scaffold §2): misma estructura de carpetas, mismo estilo de manifest, mismos guardrails. El pipeline de revisión (ROADMAP §4) recibe entradas homogéneas. |
| **Seguridad del pipeline** | Si la IA genera el código desde un contexto controlado, el análisis estático (semgrep + `capability-diff`, `security/module-semgrep.yml`) y el cálculo automático de `version`/`os_compat`/`arch` (§4) operan sobre código predecible. Menos superficie para esconder malware o capabilities no declaradas. |

**Rol del dev (acotado, por diseño):**

1. **Describir** la idea del módulo.
2. **Responder** las preguntas de la IA (ask protocol, §3.2).
3. **TESTEAR** el resultado (Modo A / Modo B — ROADMAP §8.1).
4. **CORREGIR / MEJORAR**: pedir cambios a la IA en lenguaje natural.
5. **CAMBIAR ESTADOS**: enviar a revisión, reenviar tras corrección,
   despublicar/reactivar (§3.6).

Lo que el dev **NO** hace: diseñar la arquitectura, escribir código contra el
SDK, rellenar el manifiesto a mano, elegir el semver, declarar compatibilidad
de SO (§4).

---

## 2. El contexto de arquitectura predefinido

### 2.1 Qué conocimiento se le inyecta a la IA

| Bloque de contexto | Fuente canónica | Vía de inyección |
|---|---|---|
| Contrato del manifest (`module.manifest.json`) | `MODULE-SDK-SPEC.md` §1 + `module.manifest.schema.json` | Archivos de provider en el scaffold (§2.2) — ✅ architecture pack en `structure-templates.ts` (`manifestDraft` 401) |
| Contrato del SDK (`defineModule`, `ctx`, lo que el SDK NO expone) | `MODULE-SDK-SPEC.md` §2 (real: `backend/src/shared/module-sdk/index.ts`) | Ídem |
| Catálogo de capabilities + mínimo privilegio | `MODULE-SDK-SPEC.md` §3 | Archivos de provider + en vivo por MCP (§2.3) |
| Patrones canónicos del frontend (scripts extraídos, handshake DataTable, cliente `lxp.module()`) | `MODULE-SDK-SPEC.md` §5.7 + `frontend/ARCHITECTURE.md` | Archivos de provider |
| Reglas del pipeline (qué se valida, qué fija la plataforma) | ROADMAP §4 + este doc §4 | Archivos de provider |
| Instrucciones del proyecto padre "Marketplace SDK" | `project.instructions` heredadas por `parentId` | System prompt (ya operativo) |

### 2.2 Cómo se materializa — piezas REALES del asistente

El mecanismo ya existe; lo que falta es el **contenido marketplace** ("architecture pack").

| Pieza | Estado | Implementación real (`backend/src/modules/ai-assistant/`) |
|---|---|---|
| Proyecto del asistente = directorio + instrucciones + provider + jerarquía | ✅ IMPLEMENTADO | `repositories/projects.repository.ts:27-47` (`AssistantProject {title, icon, path, instructions, provider, parentId}`); providers con estructura on-disk: solo claude/codex/gemini (`STRUCTURE_PROVIDER_IDS`, línea 20). Los hijos **heredan las instrucciones del padre** prepended al chat → modelo natural: proyecto padre "Marketplace SDK" → subproyecto por módulo. CRUD en `routes/ai.routes.ts:99-102`. |
| Plantillas de estructura por proveedor (`CLAUDE.md`/`.claude`, `AGENTS.md`/`.codex`, `GEMINI.md`/`.gemini`) | ✅ IMPLEMENTADO (genéricas) | `services/project-structure/structure-templates.ts` — `CLAUDE` (52-246), `CODEX` (249-302), `GEMINI` (305-358); modelo declarativo `StructureNode {rel, type, core, template(ctx)}` (17-30). |
| Scaffold idempotente y seguro sobre el target vía Executor | ✅ IMPLEMENTADO | `services/project-structure/project-structure.service.ts` — `scan()` (103-137, 1 round-trip SSH), `scaffold()` (143-181, **never-overwrite**, padres antes que hijos), `readFile`/`writeFile` (184-210, path-guard anti-traversal en `resolveRel` 61-68, fallback sudo staged 70-99). API: `GET/POST /api/ai/projects/:id/structure[/scaffold|/file|/improve]` (`routes/ai.routes.ts:106-110`). |
| "Architecture pack" marketplace (templates con manifest/SDK/capabilities/patrones, p.ej. como `.claude/rules/`) | ✅ IMPLEMENTADO 2026-06-11 | `services/project-structure/structure-templates.ts` sobre el mismo mecanismo declarativo: nodos `modules/<slug>/` con `manifestDraft` (401), `backendSkeleton` (`defineModule`, 421), `moduleReadme` (462) y reglas `marketplaceRules` (492, → `.claude/rules/marketplace.md` / `MARKETPLACE.md`). `TemplateContext` enriquecido con `moduleSlug`/`sdkVersion` (`36-51`); `sdkVersion` por default `SDK_VERSION` (`shared/module-sdk/index.ts:25` = `"1.0.0"`). |
| Motores IA provider-agnósticos | ✅ IMPLEMENTADO | Contrato único `AgentProvider.run()` → stream de eventos `text/tool_use/tool_result/usage/ask/status/done/error` (`services/providers/provider.types.ts:14-30,55-63`); factory per-target API-vs-CLI (`provider-factory.ts:32-100`). |
| Providers CLI en el servidor target (claude/codex/gemini/minimax) | ✅ IMPLEMENTADO | `services/providers/cli-bridge.provider.ts` — prompt por SFTP + `nohup … & disown` (101-119), specs por CLI en `CLI_SPECS` (229-304), resume con self-heal (652-662), one-shot bloqueante `runCliOnce` con `cwd` del proyecto (339-391). |
| Snapshot de contexto inyectado al system prompt | ✅ IMPLEMENTADO (servidor + marketplace) | `services/ai-context.service.ts:1-40` + `buildSystemPrompt` (`agent.service.ts:41-50`). El snapshot de arquitectura marketplace (reglas + guion de asks) lo aporta `services/marketplace-prompt.ts` (`buildMarketplacePromptBlock` 42), inyectado solo en proyectos vinculados a un módulo. |

### 2.3 Contexto en vivo: la IA consulta el panel real (MCP)

Además de los archivos on-disk, el agente puede interrogar el ecosistema en
caliente — útil para que el módulo generado respete el catálogo real:

| Pieza | Estado | Implementación |
|---|---|---|
| Catálogo de módulos/tools/dataPanels filtrado por permisos | ✅ IMPLEMENTADO | `services/assistant-modules.service.ts` — `describe()` (104-130), `allowedTools()` (149-167), `toolNeedsConfirm()` (181-190). |
| Servidor MCP loopback (los CLI del target invocan tools del panel) | ✅ IMPLEMENTADO | `services/mcp-server.service.ts` — JSON-RPC `initialize`/`tools/list`/`tools/call` (153-204, 75-145) vía `POST /api/ai/mcp` (`ai.routes.ts:39`). Sesión expirada → `MCP_SESSION_EXPIRED` (-32002), nunca fail-open al host del panel. |
| Auto-wiring del CLI del dev (entrada `luxipanel` en `~/.claude.json` / `~/.gemini/settings.json` / `~/.codex/config.toml`) | ✅ IMPLEMENTADO | `services/mcp-config-writer.service.ts:1-40` (merge no destructivo por SSH). |
| Tools MCP específicas del marketplace (validar manifest, correr el pipeline estático local) | ✅ IMPLEMENTADO 2026-06-11 | `modules/module-dev/agent-capability.ts` registra `module-dev.validate_manifest` (60), `module-dev.run_checks` (95), `module-dev.run_tests` (114) y el resto del ciclo (`list_modules`/`module_status`/`submit_module`/`resubmit_module`/`unpublish_module`/`republish_module`/`preview_install`/`preview_uninstall`/`link_project`, 143-332). Permission `module-dev.manage` (admin bypass) y expuestas vía el MCP loopback. |

---

## 3. Flujo del usuario, paso a paso

```
(1) describir idea ──► (2) la IA pregunta (ask) ──► (3) scaffold arquitectura
        ▲                                                      │
        │                                                      ▼
(5) testear/corregir/mejorar ◄──────────────── (4) la IA implementa el módulo
        │     (iteración: Modo A / Modo B + follow-ups al asistente)
        ▼
(6) cambiar estados: enviar a revisión → [pipeline LP §4] → publico
        └─ reenviar tras corrección · despublicar/reactivar
```

### 3.1 Describir la idea — ✅ soporte base IMPLEMENTADO

El dev crea un **proyecto del asistente** para su módulo (hijo del proyecto
"Marketplace SDK" que lleva las instrucciones de arquitectura por herencia
`parentId`) y escribe en el chat qué quiere construir. La sesión es
persistente: `repositories/cli-sessions.repository.ts:1-42` guarda el
session-id upstream per-conversación y **per-usuario** (claude
`--session-id/--resume`; codex `exec resume <session-id>`; gemini
transcript-in-prompt) → memoria multi-turno real durante todo el desarrollo.

✅ IMPLEMENTADO 2026-06-11: la asociación 1:1 proyecto-asistente ↔
módulo-del-marketplace (slug) vive en el sidecar per-target
`shared/marketplace-link/index.ts` (`marketplace-link/links.json` bajo
`LUXIPANEL_CONFIG_DIR`, DUEÑO de la relación). El único subcomando que la
escribe es `/mod vincular <slug>` (`slash-commands.service.ts:140`
`handleModVincular`). **Gate IA v1 (soft):** `submit`/`resubmit` exigen el link
(`module-dev/services/lp-proxy.service.ts`). ⏳ PENDIENTE: el gate de
provenance verificable real (= pipeline CI F3/F4, §5.2).

### 3.2 La IA pregunta, no adivina (ask protocol) — ✅ IMPLEMENTADO

Las decisiones que son del dev (nombre/slug, qué capabilities pedir, permisos
de la `surface`, precio en tokens) se resuelven por **preguntas explícitas**,
no por formularios ni por invención del modelo:

- Directiva + parser + strip en `services/ask-protocol.ts` (28-40, 48-87,
  90-93): el agente emite el bloque centinela
  `<<<LXP_ASK>>>{json}<<<LXP_ASK_END>>>` y **se detiene**; el backend lo
  convierte en evento `ask` y el chat pinta botones/checkboxes/input
  (`models/ask.types.ts:10-25` — `single|multi|text`, máx. 4 preguntas,
  12 opciones). La respuesta del dev **reanuda la sesión** del CLI.
- El ask pendiente se persiste y se re-renderiza al recargar
  (`agent-run-registry.ts:66,218`), con traducción incluida (245-276).
- ✅ IMPLEMENTADO 2026-06-14 (Track 3 A1): **ask también en modo API** vía una
  TOOL dedicada (Approach B), sin tocar el flujo CLI (centinela) ni la
  persistencia del evento `ask`. La tool canónica es `assistant.ask`
  (`ask-tool.ts:31`; el registry exige prefijo `<mod>.<suffix>`), con alias
  amigable `lxp_ask` (`ask-tool.ts:33`, reconocido por `isAskToolName` 43). El
  handler NO ejecuta nada en el servidor: valida con `normalizeAskRequest`
  (`ask-protocol.ts`, única fuente de verdad de las reglas — máx 4 preguntas /
  12 opciones, ids auto `q1..n`) y devuelve `ASK_TOOL_RESULT_MARKER`
  (`<<<ASK_EMITTED>>>`, `ask-tool.ts:40`) + JSON; entrada inválida → `{ok:false}`
  para que el modelo corrija. En `provider.mode==='api'`, `agent.service.ts`
  inyecta `askTool` DIRECTAMENTE en la lista `tools` (NO vía registry/
  allowedTools → disponible a cualquier rol, sin gating de sidebar) y añade
  `ASK_TOOL_PROMPT` al system prompt. Los providers claude-api/openai-api/
  gemini-api, tras ejecutar la tool con marcador, emiten el MISMO evento
  `{type:'ask',…}` + `{type:'done'}` que ya consumen agent-run-registry/
  frontend, y terminan el run. El ask en modo CLI (centinela
  `cli-bridge.provider.ts:687-699`) sigue intacto. 20 tests vitest verde
  (`ask-protocol.test.ts` + `ask-tool.test.ts`, incl. provider con fetch
  mockeado).
- ✅ IMPLEMENTADO 2026-06-11: el guion de QUÉ preguntar (system prompt
  marketplace + plantilla de asks del alta) en
  `services/marketplace-prompt.ts` — `buildMarketplacePromptBlock` (42), bloque
  "Guion del alta — pregunta, no adivinas" (83-88). Se inyecta solo en
  proyectos vinculados a un módulo del marketplace.

### 3.3 Scaffold del módulo — ✅ mecanismo + contenido IMPLEMENTADOS

Con las respuestas, la IA materializa la **plantilla de arquitectura
predefinida** en el path del proyecto: `modules/<id>/` con
`module.manifest.json` (borrador — los campos AUTO los fijará la plataforma,
§4), `backend/index.{js,ts}` con `defineModule()`, `frontend/`, y los archivos
de contexto del provider (`CLAUDE.md`/`.claude`, `AGENTS.md`, `GEMINI.md`) que
anclan a la IA a la arquitectura en todos los turnos siguientes.

Mecanismo real: `POST /api/ai/projects/:id/structure/scaffold`
(idempotente, never-overwrite — §2.2). Contenido marketplace ✅ IMPLEMENTADO
2026-06-11: nodos `modules/<slug>/` (manifest borrador, esqueleto `defineModule`,
README y reglas) en `structure-templates.ts` (§2.2).

### 3.4 La IA implementa — ✅ piezas IMPLEMENTADAS

La generación puede tardar minutos; el stack ya está pensado para eso:

| Necesidad | Pieza real |
|---|---|
| El run sigue aunque el dev cierre la pestaña/app; al volver re-adjunta sin perder eventos | `services/agent-run-registry.ts` — `start()` (181-343, persiste el turno en `onComplete` aunque no haya cliente), `attach()` (351-362, replay desde `fromSeq`), `activeRuns()` (168-174); rutas `GET /api/ai/agent/stream` + `/active` (`ai.routes.ts:55-56`). |
| Encadenar instrucciones y desconectarse ("ahora añade tests", "cambia el panel") | Cola de follow-ups server-side `repositories/agent-queue.repository.ts:1-17`, drenada en background desde `onComplete`; conserva el `SessionUser` (no escala privilegios). Rutas `ai.routes.ts:58-61`. |
| Output incremental en vivo + aviso al terminar | `services/cli-job-tracker.service.ts:1-50` (poll por byteOffset cada 3 s, push si nadie mira, kill por PID en stop). |
| Pasos puntuales síncronos (p.ej. regenerar un archivo) | `runCliOnce` (`cli-bridge.provider.ts:339-391`) con `cwd` del módulo; en API, `improveFile` (`project-structure.service.ts:220-324`) con timeout 45 s — patrón "la IA propone → el dev revisa → guardar explícito". |
| Pre-check "¿hay motor IA en el sandbox?" | `services/cli-installer.service.ts:1-30` (probe read-only installed/loggedIn/binPath). |

### 3.5 Testear, corregir, mejorar — la iteración del dev

**TESTEAR** — los dos modos (detalle y justificación en **ROADMAP §8.1** y
`MODULE-SDK-SPEC.md` §5.6, no se repite aquí):

- **Modo A — `lux dev`** — ⏳ PENDIENTE: instancia LUXIPANEL de desarrollo del
  propio dev, sideload con hot-reload contra su servidor de pruebas. Blast
  radius = solo su entorno.
- **Modo B — preview sandbox** — ✅ IMPLEMENTADO 2026-06-11 (con la
  EJECUCIÓN del código aún INERTE): `modules/module-dev/services/preview.service.ts`
  valida el manifest, fuerza `scope:"local"` (227) y vendoriza a
  `modules/community/installed/<id>/` (`getCommunityInstalledDir` 242) con
  marker `.preview.json` (owner/proyecto); hot-load por event bus
  (`COMMUNITY_RELOAD` 295 / `COMMUNITY_UNLOAD` 344). El loader registra las
  tools pero NO las publica en el `communityCatalog` → invisible salvo para el
  dueño (asistente/MCP filtran por owner en `tools/list` y `tools/call`).
  Arranca **DESHABILITADO** (`MODULE_DEV_PREVIEW_ENABLED=false`, fail-closed);
  el código del preview NUNCA se hace `import()` en proceso hasta que el
  sandbox out-of-process esté disponible (§5.2). Opt-in del operador.

**CORREGIR / MEJORAR** — ✅ piezas IMPLEMENTADAS: cada hallazgo del testeo
vuelve al chat como instrucción en lenguaje natural; quien **edita el código
es la IA** (misma sesión persistente §3.1, mismos runs desacoplados §3.4).
El dev nunca corrige a mano.

✅ IMPLEMENTADO 2026-06-11: el runner de tests
(`modules/module-dev/services/test-runner.service.ts`) corre la suite EN EL
SERVIDOR TARGET del dev (fail-closed, `requireTargetExecutor` 40 →
`getContextExecutor`), `CI=1`, `timeout(1)` de coreutils en el target y salida
capada (`MODULE_DEV_TEST_*`; cap duro `MAX_TEST_TIMEOUT_MS` 35); expuesto por
`POST /api/module-dev/tests/run` (`routes/module-dev.routes.ts:38`) y la tool
`module-dev.run_tests` (`agent-capability.ts:114`). Los "slash commands" del
ciclo se unifican en `/mod` (`slash-commands.service.ts:195` `handleMod`,
dispatch `case "mod"` 335): `vincular`/`estado`/`enviar`/`reenviar`/`probar`/
`preview`/`despublicar`/`republicar`/`ayuda` (105-112). Solo `/mod vincular`
ejecuta lógica local (escribe el sidecar); el resto de verbos devuelve un
rewrite que instruye al modelo a usar las tools `module-dev.*` (API y CLI vía
MCP loopback, sin cross-imports).

### 3.6 Cambiar estados — ✅ endpoints dev IMPLEMENTADOS en LP-LS

Lo único administrativo que hace el dev, contra LP-LS
(`/var/www/LP-LICENSE-SERVER/backend/src/modules/marketplace/marketplace.routes.ts:36-40`,
lógica en `marketplace.service.ts:140-260`; contrato en `MARKETPLACE-API.md`):

| Acción del dev | Endpoint | Estado | Nota |
|---|---|---|---|
| Enviar a revisión | `POST /v1/api/dev/modules` `{id, prUrl, scope?}` | ✅ IMPLEMENTADO | `submitModule` (`marketplace.service.ts:149-176`): valida enroll de developer, `id` `^[a-z][a-z0-9-]{2,38}$`, PR contra el repo canónico `Luxisoft/LUXIPANEL` (rama `modules`); crea/actualiza `premium_modules` + `module_versions` en `reviewStatus='enviado'`. La versión nace placeholder `0.0.0-pr.<ts>` — el semver real lo fija el pipeline (§4). |
| Reenviar tras corrección | `POST /v1/api/dev/modules/:id/resubmit` | ✅ IMPLEMENTADO | Mismo `submitModule` (upsert sobre el módulo existente del mismo dev). |
| Ver sus módulos | `GET /v1/api/dev/modules` | ✅ IMPLEMENTADO | `listDeveloperModules`. |
| Ver progreso/eventos de revisión | `GET /v1/api/dev/modules/:id/reviews` | ✅ IMPLEMENTADO | `getModuleReviews` (módulo + versiones + `module_review_events`). |
| Despublicar / reactivar | `POST /v1/api/dev/modules/:id/unpublish` · `…/republish` | ✅ IMPLEMENTADO 2026-06-11 | `marketplace.routes.ts:40-41`, lógica `unpublishModule` (`marketplace.service.ts:296`) / `republishModule` (319) con guard puro `assertDevTransition` (282): `publico→inactivo` (unpublish) y `inactivo→publico` solo si tuvo versión aprobada (republish). `suspendido` NUNCA sale por el dev (kill-switch admin prevalece en `getCommunityChanges`). El panel instalado los opera por las rutas de servicio `panel-api` (`/panel-api/service/dev/modules/unpublish|republish`, `panel-api.routes.ts:664,671`, auth por clave de cuenta con nombre, validada por `requireBoxAuth` y el gate de instalación). Sin migración (enum ya tenía `"inactivo"`). La suspensión por **admin** (`/api/admin/modules/:id/suspend` → `suspendido`) y la decisión humana siguen como antes. |

Transiciones automáticas del pipeline (`recordReviewEvent`,
`marketplace.service.ts:179-193`): cualquier evento `fail` → `correccion`
(vuelta al paso 3.5 → resubmit); `intake pass` → `revision`; aprobación humana
→ `publico` (+ firma `content_hash`/`artifact_sig`). El loader de LUXIPANEL se
entera por poll (`getCommunityChanges`, `marketplace.service.ts:233+` ↔
`community-sync.service.ts`). Máquina de estados completa: ROADMAP §3.

UI: la superficie del flujo en el panel ✅ IMPLEMENTADA 2026-06-11 en
`/panel/module-dev` ("Mis módulos": estado por módulo, timeline de eventos de
revisión, botones enviar/reenviar/despublicar/reactivar/preview/probar,
deep-link al chat del asistente vía `lxp:assistant:seed`). El **portal de dev
en `license-frontend`** ✅ IMPLEMENTADO 2026-06-14 (Track 3 A5): 5 páginas Astro
bajo `frontend/src/pages/portal/dev/` (`enroll.astro`, `profile.astro` con badge
KYC + botón `kyc/start`, `modules.astro` DataTable + submit/resubmit/unpublish/
republish, `modules/[id]/reviews.astro` timeline de eventos, `earnings.astro`
ganancias + retiros), lógica vanilla en `frontend/src/lib/portal-marketplace.ts`
(5 `init*` idempotentes, patrón de `portal-roles.ts`) + i18n `dev*` en
`src/i18n/`; consume los endpoints `/portal/dev/*` por sesión de portal
(`portalAsCustomerApi`). 7 tests vitest verde. Sin `astro check/build` aquí
(license-frontend se compila y despliega en SU servidor — §Deploy). ⏳ Solo
queda el **deploy** en el servidor frontend (203.0.113.20).

### 3.7 Dónde corre todo (aviso operativo)

- Providers **API** = backend del panel (HTTP saliente, `MAX_TURNS=15`).
  Providers **CLI** = **servidor target conectado vía SSH**
  (`requireExecutor()` en `cli-bridge.provider.ts:422,435`), patrón
  nohup+poll precisamente para esquivar el timeout de 30 s del proxy LP.
- Regla del marketplace: el código de terceros corre en **sandbox LUXIPANEL,
  NUNCA en el VPS de un cliente** (memoria `dev-module-marketplace-plan`).
  En v1 los tests (`test-runner.service.ts`) y el preview corren en el
  **servidor del PROPIO dev** (`getContextExecutor`, aislamiento per-server
  fail-closed de los permisos y la clave de cuenta) — y el preview además no EJECUTA código (es
  inerte hasta el runtime out-of-process, §5.2). ⏳ PENDIENTE un **sandbox
  multi-tenant dedicado** del dev.
- ⚠️ Revisión de seguridad pendiente para ese sandbox: los CLI se lanzan con
  flags permisivos (`--dangerously-skip-permissions` /
  `--dangerously-bypass-approvals-and-sandbox` / `--yolo`) y sudo askpass del
  operador (`cli-bridge.provider.ts:243,261,277` y 140-174) — aceptable en el
  servidor del propio usuario, punto de revisión en un sandbox multi-tenant.
- Providers con estructura on-disk gestionada: solo **claude/codex/gemini**
  (`projects.repository.ts:20`). `deepseek` es API-only
  (`provider-factory.ts:40-46`); `minimax` tiene CLI one-shot sin resume.

---

## 4. Qué fija la plataforma automáticamente (el dev no rellena manifiestos)

Cambio de negocio 2026-06-09 (detalle de campos en `MODULE-SDK-SPEC.md` §1.1;
decisiones ROADMAP §9.11-9.12). En el `module.manifest.json`, estos campos son
**AUTO**: un valor escrito por el dev (o por la IA en el borrador) se
ignora/sobreescribe.

| Campo | Quién lo fija | Cómo | Estado |
|---|---|---|---|
| `version` (semver) | Plataforma (pipeline) | Calculado del **diff del manifest** entre la última versión publicada y la entrante: capability/host nuevo o tool/surface eliminada → *major* (fuerza revisión humana); tool/surface/configField/dependencia nueva o pricing → *minor*; resto → *patch*; 1ª publicación → 1.0.0. La submission nace placeholder `0.0.0-pr.<ts>` (`marketplace.service.ts:170`) y el semver real se estampa al aprobar. | ✅ IMPLEMENTADO 2026-06-09: LP `marketplace/version-derive.ts` + `decideReview` (13 asserts puros + integración 16/16) |
| `os_compat` | Plataforma (pipeline) | Análisis estático de los comandos del módulo (`security/os-compat-derive.mjs`: apt/dnf/apk/pacman/zypper → familia de distro; sin señales → baseline ubuntu/debian); el runner lo publica como `detail.derived` del evento `intake` y LP lo persiste y estampa al aprobar. El **gating en runtime** contra facts del Monitor ya existe: `checkCompatibility()` pura en `backend/src/modules/community/compat.ts` (+ `compat.smoke.ts`); su cableado a instalar/UI, PENDIENTE. | ✅ derivación + persistencia 2026-06-09 / ✅ gating runtime / ⏳ cableado a instalar/UI |
| `arch` | Plataforma (pipeline) | Mismo analizador (tokens `x86_64|amd64` vs `arm64|aarch64`; acota solo con señal unilateral, si no ambas). | ✅ IMPLEMENTADO 2026-06-09 |
| `path` | Plataforma | `modules/<id>` en el repo canónico — ya lo fija `submitModule` (`modulePath`, `marketplace.service.ts:160,165`). | ✅ IMPLEMENTADO |
| `commit` | Plataforma | Merge commit en la rama `modules` al integrar el PR aprobado. | ⏳ PENDIENTE (job de integración, Fase F) |

El resto del manifiesto lo **genera la IA** en el scaffold (§3.3) y se
confirma con el dev por ask protocol (§3.2): `id`, `name`, `description`,
`capabilities` (mínimo privilegio), `surface`, `pricing`, etc. El dev nunca
abre el JSON. El runtime ya es tolerante a esto: el `ModuleManifest` que
consume el loader (`backend/src/shared/module-sdk/index.ts:19-26`) solo exige
`id/name/version/capabilities` tipados.

---

## 5. Qué existe hoy vs qué falta construir

Basado en el estado real del código a 2026-06-11 (informes de exploración de
`ai-assistant`, `community/`, `module-dev/`, marketplace LP-LS).

### 5.1 Implementado (v1, 2026-06-11)

**Base preexistente del asistente (reutilizada tal cual):**

| Pieza | Dónde |
|---|---|
| Proyectos del asistente con provider + path + herencia padre→hijo | `ai-assistant/repositories/projects.repository.ts` |
| Scaffold idempotente de estructura por proveedor + lectura/escritura/mejora de archivos con IA | `ai-assistant/services/project-structure/` + API `/api/ai/projects/:id/structure/*` (`ai.routes.ts:106-110`) |
| Providers CLI claude/codex/gemini en el target (nohup+poll, resume, self-heal) y API en el panel | `ai-assistant/services/providers/` |
| Ask protocol (la IA pregunta y se detiene; la respuesta reanuda) | `ai-assistant/services/ask-protocol.ts` |
| Runs desacoplados + cola de follow-ups server-side + tracker de jobs | `agent-run-registry.ts`, `agent-queue.repository.ts`, `cli-job-tracker.service.ts` |
| MCP loopback + auto-config del CLI del dev | `mcp-server.service.ts`, `mcp-config-writer.service.ts` |
| Runtime community: loader + catálogo dinámico + dispatch genérico + sync por poll + compat pura | `backend/src/modules/community/` (`MODULE-SDK-SPEC.md` §5) |
| Estados y endpoints dev en LP-LS (submit/resubmit/list/reviews; review events; decisión/suspensión admin) | LP `modules/marketplace/` (§3.6) |
| Economía completa de tokens (wallet, split 90/10, packs, cobro/renovación) | LP `modules/wallet/` + `module-subscription.service.ts` (ROADMAP §5) |

**Cableado marketplace entregado en v1 (53 tests vitest LUXIPANEL + 33 tsx LP-LS verde):**

| Pieza | Dónde vive |
|---|---|
| Módulo `module-dev` (registro + catálogo) | `backend/src/modules/module-dev/index.ts` (`registerModuleDevModule`, `server.ts:171`); catálogo `developer`/`free` (`module-registry.service.ts:388`) + `DEFAULT_ENABLED_MODULES` (línea 49); env `MODULE_DEV_TEST_*`/`MODULE_DEV_PREVIEW_*` (`config/env.ts:269-288`) |
| Architecture pack marketplace | `ai-assistant/services/project-structure/structure-templates.ts` (nodos `modules/<slug>/`: `manifestDraft` 401, `backendSkeleton` 421, `moduleReadme` 462, `marketplaceRules` 492 → `.claude/rules/marketplace.md` / `MARKETPLACE.md`); `TemplateContext.moduleSlug`/`sdkVersion` (36-51); `SDK_VERSION` = `"1.0.0"` (`shared/module-sdk/index.ts:25`) |
| Asociación proyecto↔módulo (DUEÑO) | sidecar per-target `shared/marketplace-link/index.ts` (`marketplace-link/links.json` bajo `LUXIPANEL_CONFIG_DIR`); registro de previews `shared/community-preview/index.ts` (`getCommunityInstalledDir` 48, marker `.preview.json` 38) |
| Slash `/mod` (subcomandos ES) + system prompt + guion de asks | `ai-assistant/services/slash-commands.service.ts` (`handleMod` 195, dispatch `case "mod"` 335; solo `/mod vincular` 140 escribe el sidecar); `ai-assistant/services/marketplace-prompt.ts` (`buildMarketplacePromptBlock` 42, guion del alta 83) |
| Preview Modo B (vendoriza, INERTE) | `modules/module-dev/services/preview.service.ts` (scope local 227, `getCommunityInstalledDir` 242, event bus `COMMUNITY_RELOAD` 295 / `COMMUNITY_UNLOAD` 344); loader registra tools sin publicar en el catálogo, owner-gated; `import()` fail-closed hasta `previewSandboxRuntime.isAvailable()` (`shared/preview-sandbox/runtime.ts:120`, hoy `false`) |
| Runner de tests | `modules/module-dev/services/test-runner.service.ts` (target del dev fail-closed `requireTargetExecutor` 40, `CI=1`, `timeout(1)`, salida capada `MODULE_DEV_TEST_*`); `POST /api/module-dev/tests/run` (`routes/module-dev.routes.ts:38`) + tool `module-dev.run_tests` |
| Tools de agente `module-dev.*` (MCP loopback) | `modules/module-dev/agent-capability.ts` (`validate_manifest` 60, `run_checks` 95, `run_tests` 114, list/status/submit/resubmit/unpublish/republish/preview_*/link_project 143-332); permission `module-dev.manage` |
| Rutas API admin-only del panel | `modules/module-dev/routes/module-dev.routes.ts` (`requireAuth`+`requireModule("module-dev")`+`requireAdmin` 25; manifest/validate, checks/run, tests/run, preview/*, modules/submit\|resubmit\|unpublish\|republish 30-49) |
| Despublicar/republicar dev-side (LP-LS) | LP `marketplace.routes.ts:40-41` (`unpublishModule` `marketplace.service.ts:296` / `republishModule` 319; guard `assertDevTransition` 282); rutas de servicio del panel `panel-api.routes.ts:664,671` (clave de cuenta con nombre; ver guard actual) |
| UI del flujo en el panel | `/panel/module-dev` (`frontend/src/pages/panel/module-dev/index.astro` + extracted `src/scripts/extracted/pages/panel/module-dev/index-script1.ts`, entrada `scripts/build-extracted.mjs:292`); `middleware.ts:44,240,271`; sidebar MODULE_META (`PanelLayout-define-vars-script1.ts:155`, icon `ti-packages`); i18n namespace `moduleDev` (12 idiomas) + `nav.moduleDev` |

**Construido tras el v1 inicial (Track 3, 2026-06-14) — código listo, build hecho donde aplica:**

| Pieza | Dónde vive |
|---|---|
| **Ask en modo API** (tool `assistant.ask`) | LUXIPANEL `ai-assistant/services/ask-tool.ts` (`askTool`, `ASK_TOOL_NAME` 31, alias `lxp_ask` 33, `ASK_TOOL_RESULT_MARKER` 40 `<<<ASK_EMITTED>>>`, `isAskToolName` 43, `parseAskToolResult` 51); `ask-protocol.ts` (`normalizeAskRequest` única fuente de reglas + `ASK_TOOL_PROMPT`); `agent.service.ts` inyecta `askTool` en `tools` solo en `mode==='api'`; providers `claude-api`/`openai-api`/`gemini-api` emiten evento `ask`+`done` al ver el marcador. 20 tests vitest. §3.2 |
| **Runner CI del pipeline LP (análisis estático)** | LP-LS `modules/marketplace/runner/`: `runner.ts` (orquesta intake/sast/deps/secrets/decision; spawn `shell:false`, NUNCA ejecuta el módulo), `review-client.ts` (POST `/api/internal/review/:versionId/events` Bearer, reintenta 5xx no 4xx, sin filtrar token — `review-client.ts:34,45`), `cli.ts` (`--module-dir/--version-id/--lp-url/--token/--dry-run`), `runner.types.ts`, `runner.test.ts` (10 PASS); workflow `.github/workflows/module-review.yml`; env `RUNNER_REVIEW_TOKEN` (`env.ts:605`) + `SECURITY_ANALYZERS_DIR` (611, default `/var/www/LUXIPANEL/security`); README en `runner/README.md` |
| **CLI `lux` standalone** (`@luxipanel/lux-cli`) | Paquete nuevo (build + 29 tests verde). Ubicación canónica **`/var/www/lux-cli`** (PENDIENTE de mover por setup externo — `/var/www` es root); entregado y probado en `/home/panel/lux-cli` (relocatable). Comandos: `login`/`logout`/`whoami`/`validate`/`submit`/`status`/`test` funcionales; `dev` (Modo A) = scaffold documentado. Validador `src/lib/manifest-validator.ts` = copia portada de LUXIPANEL `module-dev/services/manifest-validator.service.ts` (re-sync manual). Credenciales `~/.config/lux/credentials.json` (0600). README + PLACEMENT.md |
| **KYC real** (Stripe Identity, degradación a stub) | LP-LS `modules/marketplace/kyc/`: `kyc-provider.types.ts` (interface `KycProvider`), `stripe-identity.provider.ts` (createSession REST + `verifySignature` HMAC-SHA256 manual con anti-replay y rechazo si `webhookSecret.length===0` — :108,149), `stub.provider.ts`, `kyc.service.ts` (`getKycProvider` memoizado exige hasKey&&hasWebhookSecret o degrada a stub :42-60; `createKycSession` con `.returning()` lanza si 0 filas :84-110; `handleKycWebhook` :131); controller `devStartKyc` (exige enroll antes de crear sesión Stripe — `marketplace.controller.ts:62`) + `kycWebhook` (91); ruta `POST /api/marketplace/kyc/webhook` sin auth de customer (`marketplace.routes.ts:38`); env `STRIPE_IDENTITY_SECRET_KEY`/`_WEBHOOK_SECRET`/`KYC_PROVIDER` (`env.ts:583-592`); migración `0081_developer_kyc_session.sql` (ADD COLUMN IF NOT EXISTS, aplicada por `ensureColumns` en boot); README en `kyc/` |
| **Portal de dev en `license-frontend`** | LP-LS `frontend/src/pages/portal/dev/` (`enroll.astro`, `profile.astro`, `modules.astro`, `modules/[id]/reviews.astro`, `earnings.astro`) + `frontend/src/lib/portal-marketplace.ts` (5 `init*`) + i18n `dev*` en `src/i18n/`; rutas backend `portal.routes.ts:302-314` (incl. fix de integración: unpublish/republish `:311-312`). 7 tests vitest. **Deploy en SU servidor** (203.0.113.20), no aquí |

### 5.2 Fuera del alcance (pendiente / setup externo genuino)

| Hueco | Qué es | Referencia |
|---|---|---|
| **Setup externo del runner CI (GitHub Actions)** | El código del runner y el workflow YA existen; falta el setup de infra: (1) habilitar Actions en `Luxisoft/LUXIPANEL`; (2) crear secret `RUNNER_REVIEW_TOKEN` (alias de `ADMIN_SECRET`) + var `LP_REVIEW_URL`; (3) disponibilizar `LUXIPANEL/security` en el CI (checkout/sparse o submodule → `SECURITY_DIR`); (4) cablear el bot de submit para pasar el `versionId` (env `MODULE_VERSION_ID`). Todo COMENTADO como SETUP EXTERNO en el YAML, no fingido como hecho. | `module-review.yml` cabecera + líneas 4-16, 82-97; ROADMAP §4, Fase F |
| **Credenciales del proveedor KYC (Stripe)** | El proveedor real está implementado pero arranca en stub hasta que un operador configure en Stripe Dashboard: activar Identity, crear el webhook endpoint (`POST /api/marketplace/kyc/webhook`), copiar `STRIPE_IDENTITY_SECRET_KEY` + `STRIPE_IDENTITY_WEBHOOK_SECRET` al `.env` de LP y reiniciar el backend. Sin AMBOS secretos → degradación segura a stub (no acepta webhooks no verificables). | §3.6; `kyc/README.md`; ROADMAP §2/§6 (KYC) |
| **Deploy de `license-frontend`** | Las 5 páginas del portal y su lib YA compilan (tsc limpio); falta `git push` + build + `pm2 reload` en el servidor frontend `operator@203.0.113.20` (no corre aquí — `LP-LICENSE-SERVER/CLAUDE.md` §Despliegue del frontend). | §3.6 |
| **Ubicación final del CLI `lux`** | Mover `~/lux-cli` → `/var/www/lux-cli` (op de infra, requiere sudo/root, no disponible en sandbox). El código es relocatable. | `lux-cli/PLACEMENT.md` |
| **Runtime endurecido out-of-process para EJECUTAR previews** | El código del preview es INERTE: nunca se hace `import()` en el proceso del panel y `dispatchPreviewTool` falla cerrado hasta que `previewSandboxRuntime.isAvailable()` (`shared/preview-sandbox/runtime.ts:120`, hoy `false`) sea `true`. Modo B arranca **DESHABILITADO** (`MODULE_DEV_PREVIEW_ENABLED=false`). Runtime aislado real depende de la rama **`feat/preview-sandbox-f1`** (fases F2-F5; hoy F1 = inerte). | §3.5; `shared/preview-sandbox/RUNTIME-DESIGN.md`; SDK-SPEC §5.6 |
| **Modo A (`lux dev` hot-reload)** | El CLI `lux` existe; `lux dev` es scaffold documentado. Falta el hot-reload por sideload contra una instancia/target de pruebas del dev (RPC al `community-loader`, gating de capabilities por definir). | ROADMAP §8.1; `lux-cli/README.md` |
| **Sandbox multi-tenant del dev** | v1 corre tests/preview en el servidor del PROPIO dev (aislamiento por destino del panel instalado); un sandbox dedicado + revisión de flags permisivos de los CLI sigue pendiente | §3.7 |
| **Gate de provenance verificable** | El gate IA v1 es soft (marketplace-link obligatorio para submit/resubmit + UI sin alta manual); provenance real = pipeline CI cableado de punta a punta | §3.1 |
| **Cambio de scope in-place** | No soportado: requiere re-submission | MARKETPLACE-API.md |

---

> Mantenimiento: este doc describe el FLUJO; los contratos viven en
> `MODULE-SDK-SPEC.md` y el plan/estados/economía en
> `ROADMAP-DEV-MARKETPLACE.md`. Si una ruta o un `file:line` de aquí deja de
> coincidir con el código, gana el código y se corrige este doc.
