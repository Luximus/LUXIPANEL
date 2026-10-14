> Revisión del modelo 2026-10-13: ejecución local/SSH del panel instalado y cuenta vinculada por clave con nombre. Las fechas y checkpoints de implementación de esta especificación son históricos, no evidencia de despliegue actual. Contrato vigente: [Marketplace API](../LP-LICENSE-SERVER/MARKETPLACE-API.md). No configurar un modo managed ni enviar `panelId` para crear la clave de cuenta.

# MODULE SDK & MANIFEST — Contrato para módulos de comunidad

> Estado: **PARCIALMENTE IMPLEMENTADO (actualizado 2026-06-09; diseño original
> 2026-05-29)**. Acompaña a
> `/var/www/LP-LICENSE-SERVER/ROADMAP-DEV-MARKETPLACE.md` (plan maestro del
> marketplace). Este documento define el `module.manifest.json` y el SDK
> `@luxipanel/module-sdk` — y desde 2026-06-09, **cómo se produce un módulo**:
> el dev ya NO escribe contra el SDK a mano, lo hace la IA del asistente (§0).
> Aterrizado sobre los tipos REALES del backend (no inventados):
> `shared/agent-capability/types.ts`, `shared/executor/types.ts`,
> `shared/kv-store/index.ts`, `modules/admin/.../module-registry.service.ts`.

### Estado por sección (2026-06-09)

| Sección | Estado | Dónde vive lo real |
|---|---|---|
| §0 Creación guiada por IA | 🟡 PARCIAL — piezas genéricas del asistente IMPLEMENTADAS; flujo marketplace-específico PENDIENTE | `backend/src/modules/ai-assistant/` (providers, project-structure, ask-protocol) |
| §1 Manifest | 🟡 PARCIAL — schema escrito (`module.manifest.schema.json`); el loader aún NO lo valida; `version/os_compat/arch` pasan a AUTO (schema pendiente de actualizar) | `/var/www/LUXIPANEL/module.manifest.schema.json` |
| §2 SDK backend | ✅ IMPLEMENTADO como librería **interna** (no paquete npm publicado), con divergencias anotadas | `backend/src/shared/module-sdk/index.ts` |
| §3 Capabilities | ✅ catálogo + wrapper runtime IMPLEMENTADOS; reglas semgrep + capability-diff escritas; cableado al pipeline de intake PENDIENTE | `shared/module-sdk/index.ts:16,98-130`; `security/module-semgrep.yml` + `security/capability-diff.mjs` |
| §4 Ciclo de vida | 🟡 PARCIAL — rutas dev/review en LP existen; job de integración (vendor+firma) PENDIENTE (Fase F) | LP `backend/src/modules/marketplace/marketplace.routes.ts` |
| §5 Loader + dispatch | ✅ IMPLEMENTADO (loader, catálogo comunidad, dispatch genérico, sync por poll, compat gating como función pura) — firma/schema/rango-sdk en el loader PENDIENTES | `backend/src/modules/community/` + `backend/src/shared/community-catalog.ts` |
| §6 Decisiones | 🟡 poll de sync IMPLEMENTADO (timer por env); cuotas/evicción/deps npm PENDIENTES | `modules/community/index.ts` (`COMMUNITY_SYNC_MINUTES`) |

Principios heredados de la arquitectura actual (CLAUDE.md de LUXIPANEL):

- **Selected-target execution**: no hay DB; toda persistencia per-server vive en sidecars
  bajo `LUXIPANEL_CONFIG_DIR` accedidos por el `Executor`. **Fail-closed**: sin
  executor de contexto se lanza error, nunca se cae a `localExecutor`.
- **Ningún módulo ejecuta en el host del panel**: toda mutación va al servidor
  cliente por `Executor` (SSH/SFTP); las lentas por la cola write-behind.
- **Tool names con prefijo `<moduleId>.`** (el registry crashea si no — para
  terceros el SDK lo **autogenera**, así el dev no puede romperlo).
- Frontend = scripts extraídos con el patrón canónico (astro:page-load +
  AbortController + handshake DataTable).

El SDK existe para que el dev NO toque ninguna de estas APIs crudas: se las da
envueltas, namespaced y con los guardrails de permisos.

---

## 0. Creación guiada por IA (OBLIGATORIA) — cómo se produce un módulo

> **Requisito de negocio (2026-06-09).** El dev **NO escribe el módulo a mano
> contra el SDK**: trabaja sí o sí con el **asistente IA de LUXIPANEL** (los
> providers CLI claude/codex/gemini ya integrados). La IA es quien maneja el
> **contexto de arquitectura predefinido** — este spec, el manifest (§1), el
> catálogo de capabilities (§3) y los patrones canónicos del panel (scripts
> extraídos, `Executor`, write-behind) — para que el módulo se acople bien al
> ecosistema. La arquitectura de un módulo está **predefinida** (plantilla /
> scaffold + archivos de contexto de provider tipo `CLAUDE.md`/`AGENTS.md`/
> `GEMINI.md`).
>
> **Rol del dev (acotado):** TESTEAR, CORREGIR, MEJORAR el módulo y **cambiar
> estados** (enviar a revisión, reenviar tras corrección, despublicar /
> reactivar). No diseña la arquitectura ni rellena manifiestos a mano — por
> eso `version`, `os_compat` y `arch` pasan a ser campos AUTO (§1.1).

Flujo detallado en **`MODULE-DEV-AI-FLOW.md`** (doc companion). Resumen de las
piezas REALES del asistente sobre las que se monta (todas en
`backend/src/modules/ai-assistant/`):

| Pieza del flujo | Estado | Implementación real |
|---|---|---|
| Motores IA provider-agnósticos (API y CLI claude/codex/gemini) | ✅ existe | `services/providers/provider-factory.ts` + `cli-bridge.provider.ts` (CLI corre en el **target** vía SSH, nohup+poll) |
| Scaffold de la estructura predefinida por proveedor (`CLAUDE.md`/`.claude`, `AGENTS.md`, `GEMINI.md`) | ✅ existe (plantillas genéricas) | `services/project-structure/structure-templates.ts` + `project-structure.service.ts` (`scaffold()` idempotente, never-overwrite); API `POST /api/ai/projects/:id/structure/scaffold` |
| Plantillas marketplace ("architecture pack": manifest §1, contrato SDK §2, capabilities §3, patrones frontend §5.7) | ⏳ PENDIENTE | nueva `ProviderStructure` sobre el mismo mecanismo declarativo |
| La IA pregunta decisiones al dev (nombre, capabilities, permisos, pricing) y se detiene | ✅ existe | `services/ask-protocol.ts` (bloque centinela → evento `ask` → la respuesta reanuda la sesión; hoy CLI-mode only) |
| Proyecto = directorio + instrucciones + provider, con herencia padre→hijo (proyecto "SDK marketplace" → subproyecto por módulo) | ✅ existe | `repositories/projects.repository.ts` (`parentId`); sesiones CLI persistentes en `repositories/cli-sessions.repository.ts` |
| Iteración larga test/corrige/mejora que sobrevive al cierre del cliente | ✅ existe | `services/agent-run-registry.ts` (re-attach) + `repositories/agent-queue.repository.ts` (follow-ups server-side) |
| Asociación proyecto-asistente ↔ módulo-marketplace + gate de obligatoriedad + target sandbox | ⏳ PENDIENTE | el código de terceros corre en **sandbox LUXIPANEL, nunca en el VPS del cliente**; falta definir qué executor es el sandbox |

Los cambios de estado del módulo los hace el dev contra LP (rutas reales,
`LP-LICENSE-SERVER/backend/src/modules/marketplace/marketplace.routes.ts`):
`POST /v1/api/dev/modules` (enviar a revisión), `POST /v1/api/dev/modules/:id/resubmit`,
`GET /v1/api/dev/modules` + `/:id/reviews`; decisión/suspensión por admin
(`/api/admin/modules/:id/review/decision|suspend`).

---

## 1. `module.manifest.json` — contrato completo

Un archivo en la raíz de `modules/<id>/`. Es la fuente de verdad de la identidad,
compatibilidad, permisos, precio y puntos de entrada del módulo. El pipeline de
revisión (ROADMAP §4) lo valida contra un JSON Schema; el loader lo convierte en
un `ModuleDefinition` del catálogo.

### 1.1 Campos

| Campo | Tipo | Req | Regla / nota |
|---|---|---|---|
| `id` | string | ✅ | `^[a-z][a-z0-9-]{2,38}$`. Único, **== prefijo de tools**, **== nombre de carpeta** `modules/<id>/`. No puede colisionar con un módulo core. |
| `name` | string | ✅ | Nombre legible (≤ 48 chars). |
| `description` | string | ✅ | 1 frase (≤ 160 chars). |
| `version` | semver | **auto** | `MAJOR.MINOR.PATCH`. **Lo calcula la PLATAFORMA** (cambio 2026-06-09): el semver de cada versión se deriva del diff/los cambios y de los resultados del pipeline — el dev NO lo declara. *Major* sigue forzando revisión humana. |
| `sdk` | semver range | ✅ | Rango compatible del `@luxipanel/module-sdk` (ej. `^1.2`). El loader rechaza si no encaja. |
| `category` | enum | ✅ | `communication \| infrastructure \| security \| developer` (== `ModuleDefinition.category`). |
| `icon` | string | ✅ | `tabler:<name>` o `vscode-icons:<name>` (offline, ver `build-file-icons.mjs`). Sin CDN. |
| `color` | string | ✅ | Token Tailwind (ej. `orange`, `sky`). |
| `scope` | enum | ✅ | `local \| global`. `local` = preview privada; `global` = marketplace. |
| `path` | string | auto | `modules/<id>` (ruta en el repo canónico). Lo fija la plataforma. |
| `commit` | string | auto | Merge commit en rama `modules`. Lo fija la plataforma al mergear el PR. |
| `os_compat` | string[] | **auto** | Ej. `["ubuntu>=22.04","debian>=12"]`. **Lo determina la PLATAFORMA** (cambio 2026-06-09): análisis estático de los comandos/deps que usa el módulo + validación en el pipeline — el dev NO lo declara. Gating en runtime contra facts del Monitor ya implementado: `checkCompatibility()` en `backend/src/modules/community/compat.ts` (función pura, smoke en `compat.smoke.ts`; cableado al flujo de habilitar/instalar PENDIENTE). |
| `arch` | string[] | **auto** | `["x86_64","arm64"]`. **Lo determina la PLATAFORMA** igual que `os_compat` (mismo análisis del pipeline). |
| `min_specs` | object | ✅ | `{ cpu:int(cores), ramMb:int, diskMb:int }`. |
| `runtime_deps` | string[] | — | Ej. `["nginx>=1.24"]`. Revalidable en runtime. |
| `capabilities` | string[] | ✅ | **Lo que el módulo puede HACER vía el SDK** (ver §3.1). El análisis estático verifica que el código no use nada fuera de esta lista. Mínimo privilegio. |
| `http_allowlist` | string[] | — | Hosts a los que `ctx.http` puede salir. Vacío = sin red externa. |
| `surface` | object | — | Permisos asignables en el diálogo de roles (== `ModuleDefinition.permissions`): `{ sidebar?:string[], views?:string[], actions?:string[] }`. Si se omite, se deriva `sidebar=[id]`, `views=[panel.<id>]`. |
| `tool_permissions` | object | — | Mapa `{"<tool>":"<permission-slug>"}`: qué permiso de usuario exige cada tool (cae en `AgentTool.permission`). |
| `configFields` | ConfigField[] | — | Reusa el tipo actual: `{key,label,type:text\|email\|password\|select,placeholder?,required,hint?,options?}`. |
| `dependencies` | string[] | — | Módulos **core** que deben estar activos (ej. `["files"]`). |
| `pricing` | object | ✅ | `{ model:"free"\|"subscription", tokensPerMonth:int(≥0), trialDays?:int }`. `free` ⇒ `tokensPerMonth=0`. |
| `entry` | object | ✅ | `{ backend:"backend/index.js", frontend?:"frontend/" }`. Puntos de entrada relativos a `modules/<id>/`. |

> **Autoría NO va en el manifiesto.** El creador se resuelve del autor del PR /
> `developer_profiles` (ROADMAP §2.1), no de un campo que cualquiera podría
> falsificar. El `revenue_split_bps` y el `creatorCustomerId` los fija LP.

> **Campos fijados por la plataforma (2026-06-09).** `version`, `os_compat` y
> `arch` se unen a `path`/`commit` como campos que el dev **no escribe**: un
> valor del dev se ignora/sobreescribe. Encaja con §0 (el dev no rellena
> manifiestos a mano: la IA genera el borrador y el pipeline fija los AUTO).
> El runtime ya trata el manifest así: el `ModuleManifest` que consume el
> loader (`shared/module-sdk/index.ts:19-26`) solo exige
> `id/name/version/capabilities` tipados y acepta el resto como opaco.

### 1.2 Ejemplo

```jsonc
{
  "id": "acme-cache-warmer",
  "name": "Cache Warmer",
  "description": "Pre-calienta la caché de Nginx tras cada deploy.",
  "version": "1.2.0",                      // AUTO — lo calcula la plataforma
  "sdk": "^1.0",
  "category": "infrastructure",
  "icon": "tabler:flame",
  "color": "orange",
  "scope": "global",
  "os_compat": ["ubuntu>=22.04", "debian>=12"],  // AUTO — análisis del pipeline
  "arch": ["x86_64", "arm64"],                   // AUTO — análisis del pipeline
  "min_specs": { "cpu": 1, "ramMb": 512, "diskMb": 200 },
  "runtime_deps": ["nginx>=1.24"],
  "capabilities": ["server.exec", "server.fs.read", "storage", "http"],
  "http_allowlist": ["api.acme.com"],
  "surface": {
    "sidebar": ["acme-cache-warmer"],
    "views": ["panel.acme-cache-warmer"],
    "actions": ["acme-cache-warmer:warm"]
  },
  "tool_permissions": { "warm": "acme-cache-warmer:warm" },
  "dependencies": [],
  "pricing": { "model": "subscription", "tokensPerMonth": 120, "trialDays": 7 },
  "entry": { "backend": "backend/index.js", "frontend": "frontend/" }
}
```

### 1.3 De manifiesto a catálogo

✅ **IMPLEMENTADO** — `manifestToDefinition()` en
`backend/src/modules/community/community-loader.service.ts` convierte el
manifiesto en un `ModuleDefinition`:
`id/name/description/category/icon/color/dependencies` mapean directo (con
defaults: icon `tabler:package`, color `slate`, category `developer`);
`surface` → `permissions`. **Divergencia vs el diseño:** `tag` se fija a
`premium` si `priceTokens`/`price_tokens` **> 0** (alineado con
`premium_modules.price_tokens` de LP), no leyendo `pricing.model`; y
`configFields` aún no se mapea. Los campos nuevos
(`os_compat/arch/min_specs/runtime_deps/capabilities/scope/pricing`) viven junto
al catálogo y en `premium_modules` (LP) para gating y cobro.

### 1.4 JSON Schema de validación

El schema real (Draft 2020-12) está en **`/var/www/LUXIPANEL/module.manifest.schema.json`**.
Los devs lo referencian con `"$schema": "https://luxipanel.com/schemas/module.manifest.schema.json"`
para autocompletado en el editor. La validación corre como primer paso del
intake (ROADMAP §4.1) con `Ajv2020`. Hace cumplir, entre otras:
`additionalProperties:false` (cero campos extra), regex de `id`/`version`/`icon`,
enums de `category`/`arch`/`color`/`capabilities`, y 4 reglas condicionales:

- `http` en `capabilities` ⇒ `http_allowlist` no vacío.
- `server.sudo` ⇒ también `server.exec` o `server.fs.write`.
- `pricing.model="free"` ⇒ `tokensPerMonth = 0`.
- `surface.sidebar|views` ⇒ `entry.frontend` presente.

> Verificado con `Ajv2020` (2026-05-29): el ejemplo §1.2 valida; se rechazan id
> con mayúsculas, http sin allowlist, sudo solo, free con precio, surface sin
> frontend, icon por CDN, capability inventada y campos extra.

> **✅ Schema actualizado (2026-06-09):** `module.manifest.schema.json` ya NO
> exige `version`, `os_compat` ni `arch` (salieron de `required`; sus
> descripciones los marcan *set by the platform*, igual que `path`/`commit`).
> Un borrador de la IA sin esos campos valida; el manifest final con los
> valores fijados por la plataforma también; los inválidos se siguen
> rechazando (verificado con Ajv2020, 2026-06-09).
>
> **Cableado implementado (2026-06-09):** el cálculo automático ya existe —
> semver en `LP-LS/backend/src/modules/marketplace/version-derive.ts`
> (estampado en `decideReview(approve)`; 13 asserts puros + integración 16/16)
> y derivación de SO/arch en **`security/os-compat-derive.mjs`** (gemelo de
> `capability-diff.mjs`; 6 smokes). El runner publica el verdict como
> `detail.derived` del evento `intake` y LP lo persiste en el manifest de la
> versión (`recordReviewEvent`). PENDIENTE: validación Ajv en el intake del
> pipeline y en el loader runtime (§5.2), que hoy lee el manifest tal cual
> (`community-loader.service.ts`).

**Reglas que el JSON Schema NO puede expresar** (las verifica el pipeline,
ROADMAP §4, no el schema):

- `id` == nombre de carpeta `modules/<id>/` y **no colisiona** con un módulo core
  ni con otro publicado.
- El código solo usa capabilities declaradas (diff estático semgrep).
- Los nombres de tools registrados en el código casan con el `id` (el SDK los
  autoprefija, pero el linter lo confirma).
- `dependencies` referencian módulos core existentes.
- `commit`/`path` los fija la plataforma (un valor del dev se ignora/sobreescribe).
- Rango `sdk` realmente satisfecho por la versión instalada (lo decide el loader).

---

## 2. `@luxipanel/module-sdk` — el contrato del backend

> **IMPLEMENTADO (2026-06-09)** como librería **interna** en
> `backend/src/shared/module-sdk/index.ts` (todavía NO publicada como paquete
> npm — el `import "@luxipanel/module-sdk"` del ejemplo es la forma futura;
> hoy el loader importa de `shared/module-sdk`). Con §0, además, el dev no la
> consume a mano: la usa la IA del asistente al generar el módulo.

Paquete TS que el dev importa. Es una **librería/contrato** (no un jailer
permanente): define la forma del módulo, autogenera prefijos, envuelve el
`Executor`, el KV y la red con los guardrails de `capabilities`, y resuelve el
executor per-request por debajo (`getContextExecutor()`, fail-closed).

Real: `defineModule(setup)` → `ModuleFactory {__luxModule, setup}`
(`index.ts:79-81`); el loader llama `buildCapability(manifest, factory)`
(`index.ts:133-158`) que ejecuta el setup sobre un `ModuleBuilder`
(`m.tool` / `m.dataPanel` / `m.suggest`) y autoprefija `<id>.` a cada nombre.

### 2.1 Punto de entrada del módulo

`backend/index.ts` exporta **por defecto** un módulo definido con `defineModule`:

```ts
import { defineModule } from "@luxipanel/module-sdk";

export default defineModule((m) => {
  // m.id === "acme-cache-warmer" (inyectado del manifiesto; el dev no lo repite)

  m.tool("warm", {                          // → registra "acme-cache-warmer.warm"
    title: "Calentar caché de Nginx",
    description: "Warm the Nginx cache by requesting the sitemap URLs.",
    kind: "action",                         // "read" | "action"
    input: {                                // JSON Schema (type:"object")
      type: "object",
      properties: { sitemap: { type: "string" } },
      required: ["sitemap"],
    },
    async handler({ sitemap }, ctx) {
      const urls = await ctx.http.fetch(sitemap).then((r) => r.text());
      const r = await ctx.server.exec(
        `for u in ${urls}; do curl -s -o /dev/null "$u"; done`,
      );
      await ctx.storage.collection("runs").set(ctx.runId, { at: ctx.now, ok: r.exitCode === 0 });
      return { ok: r.exitCode === 0, output: { warmed: urls.length } };
    },
  });

  m.dataPanel("status", {                   // → "acme-cache-warmer.status"
    title: "Estado del warmer",
    description: "Last warm run summary.",
    ttlSeconds: 30,
    async collect(ctx) {
      const last = await ctx.storage.collection("runs").list();
      return { lastRun: last.at(-1) ?? null };
    },
  });
});
```

Real (matiz): `defineModule` devuelve un `ModuleFactory` marcado
(`__luxModule`); es el **loader** quien llama `buildCapability(manifest,
factory)` y obtiene el `AgentCapability` (`version: 1`, `moduleId`, `tools`,
`dataPanels`, `suggestedPrompts` — `m.suggest()` también existe) que pasa a
`agentCapabilityRegistry.register(...)`. **El SDK antepone `m.id` a cada
nombre** (`index.ts:140`), así que el dev (o la IA, §0) escribe `"warm"` y
nunca puede disparar el crash de prefijo inválido.

### 2.2 `ctx` — el único puente con efectos

Cada `handler`/`collect` recibe `(input, ctx)`. `ctx` corre dentro del scope ALS
del request (executor del servidor conectado resuelto solo). Superficie:

| `ctx.*` | Qué da | Gate por capability |
|---|---|---|
| `ctx.server.exec(cmd, {sudo?,timeoutMs?,cwd?})` | Ejecuta en el servidor cliente (envuelve `Executor.exec`). `sudo:true` inyecta el passphrase por el modelo existente (askpass/stdin) — **el dev nunca ve el secreto**. | `server.exec` (+ `server.sudo` si `sudo:true`) |
| `ctx.server.readFile / readdir / stat` | Lectura SFTP. | `server.fs.read` |
| `ctx.server.writeFile / mkdir / rename / unlink` | Escritura SFTP rápida (1 round-trip, 0600 en sidecars). | `server.fs.write` |
| `ctx.server.submitMutation(steps)` | **⏳ PENDIENTE** (no está en el SDK real todavía). Encolará una receta multi-paso en la **cola write-behind** (`lpwq:*`) y esperará `applied`. Para CRUD lentos sin pagar latencia SSH por paso. | `server.fs.write` (+ `server.sudo` si algún step usa sudo) |
| `ctx.storage.collection(name)` | KV namespaced en `kv(executor).module("community:<id>")` → sidecar per-server (`index.ts:124`). Mismo API que `CollectionStore` (`get/list/query/set/update/delete/count/find/transaction`). **Aislado por módulo**: no puede leer datos de otro. | `storage` |
| `ctx.http.fetch(url, init?)` | `fetch` restringido al `http_allowlist` (match exacto de hostname o wildcard `*.dominio`, `assertAllowlisted` en `index.ts:87-96`). **Divergencia/PENDIENTE:** la política anti-SSRF de `host-policy.service.ts` (bloqueo loopback/RFC1918/metadata) aún NO está cableada — hoy solo gobierna la allowlist. | `http` |
| `ctx.events.emit(event, payload)` | **Divergencia:** hoy solo loguea (`index.ts:128`); la publicación real en el event bus (`shared/events`) bajo `community:<id>:*` queda PENDIENTE. | — |
| `ctx.log` | Logger namespaced. | — |
| `ctx.runId`, `ctx.now`, `ctx.user`, `ctx.target` | Metadatos del request: id de invocación, timestamp, usuario Linux (de `Executor.sshUsername`), `{id,name}` del servidor. | — |

> **Capabilities = mínimo privilegio + defensa en profundidad.** El SDK verifica
> en runtime que cada `ctx.*` esté declarado en `manifest.capabilities`; el
> análisis estático (semgrep) verifica lo mismo en el código ANTES de aprobar
> (diff de permisos, ROADMAP §4.2). Lo que no esté declarado, no compila la
> revisión y no corre.

### 2.3 Lo que el SDK **NO** expone (a propósito)

- **Sin Express crudo.** Un módulo de comunidad **no monta routers** propios. El
  frontend llama a un endpoint genérico de dispatch
  `POST /api/community/:moduleId/tool/:name` (auth + permiso + gating estándar),
  que ejecuta el tool registrado. Esto mantiene una sola superficie auditable.
- **Sin `child_process`/`fs`/`net`/`process.env`/`require` dinámico.** Esas
  rutas las prohíbe el análisis estático; el único acceso con efectos es `ctx`.
- **Sin transporte SSH propio ni acceso al passphrase.** `sudo` se resuelve por
  el modelo existente (la receta inyecta el secreto fuera de argv).

### 2.4 Frontend del módulo

`frontend/` contiene páginas Astro + scripts. Al integrarse se sirven bajo
`/panel/community/<id>/` y se construyen siguiendo el **patrón canónico de
scripts extraídos** (init en `astro:page-load` + `astro:after-swap` +
`AbortController`; handshake `lxp:data-table:request-ready` si usan DataTable —
ver `frontend/ARCHITECTURE.md`). Se les inyecta un cliente:

```ts
import { lxp } from "@luxipanel/module-sdk/client";
// Llama un tool del propio módulo vía el dispatch genérico:
const res = await lxp.module.call("warm", { sitemap: "https://site/sitemap.xml" });
// Sembrar el asistente IA (reusa el bus existente lxp:assistant:seed):
lxp.assistant.seed("Depura por qué el warm falló");
```

El cliente solo puede invocar tools del **propio** módulo y usar el bus de
eventos namespaced; no accede a fetch arbitrario (CSP estricta en esas páginas).

> **Estado real (2026-06-09):** el cliente browser está IMPLEMENTADO en
> `frontend/src/lib/module-sdk-client.ts`. **Divergencia de API:** se obtiene
> con factory — `lxp.module(moduleId).call(name, input)` /
> `lxp.module(moduleId).panel(name)` — el `<id>` lo fija el bundle del módulo,
> no la página. `lxp.assistant.seed()` ya existe (bus `lxp:assistant:seed`).
> El **servido de páginas** bajo `/panel/community/<id>/` y la CSP estricta
> siguen PENDIENTES.

### 2.5 Versionado del SDK

`manifest.sdk` declara el rango compatible. El loader compara contra la versión
instalada y **rechaza la carga** (no crash) si no encaja, registrando el motivo.
Breaking changes del SDK ⇒ bump *major* + guía de migración; los módulos siguen
anclados a su rango hasta que la plataforma publique una versión nueva (el
semver del módulo es AUTO, §1.1).

> **PENDIENTE (2026-06-09):** el loader real aún NO verifica `manifest.sdk`
> (el SDK interno no está versionado como paquete). El "rechazo aislado sin
> crash" sí está implementado para errores de carga en general
> (`community-loader.service.ts`, catch de `loadFromDisk`).

---

## 3. Capabilities — catálogo y enforcement

### 3.1 Catálogo de capabilities (v1)

| Capability | Permite |
|---|---|
| `server.exec` | `ctx.server.exec` sin sudo |
| `server.sudo` | `exec`/steps con `sudo:true` (requiere también `server.exec` o `server.fs.write`) |
| `server.fs.read` | `readFile/readdir/stat` |
| `server.fs.write` | `writeFile/mkdir/rename/unlink/submitMutation` |
| `storage` | `ctx.storage` (KV per-server namespaced) |
| `http` | `ctx.http.fetch` al `http_allowlist` |

Conjunto **cerrado** en v1 (se amplía con versiones del SDK). Cada capability se
muestra al cliente al instalar ("este módulo podrá: ejecutar comandos, leer
archivos, salir a api.acme.com") → consentimiento informado + transparencia.

> **IMPLEMENTADO:** el catálogo v1 es exactamente el union type `Capability` de
> `shared/module-sdk/index.ts:16`. Con §0, las capabilities las propone la IA
> al generar el módulo (mínimo privilegio por diseño) y el pipeline las
> verifica; el dev las consiente/ajusta vía el ask-protocol, no las inventa.

### 3.2 Doble verificación

1. **Estática (revisión, bloqueante)** — `security/module-semgrep.yml` +
   `security/capability-diff.mjs`:
   - **7 reglas FORBID** (`severity: ERROR`) bloquean todo lo que esté fuera del
     SDK: builtins de Node (`child_process`, `fs`, `net`, `dns`, `tls`,
     `http(s)`, `vm`, `worker_threads`, …), imports internos
     (`@shared/@modules/@config`, `kv-store`, `executor`, `agent-capability`),
     uso crudo de `getContextExecutor/kv/dataStore/submitMutation`,
     `process.env`, `eval`/`new Function`, `require/import` dinámico no-literal,
     y `fetch`/`XMLHttpRequest` globales (solo vale `ctx.http`).
   - **6 reglas CAPABILITY** (`severity: INFO`, `metadata.capability: <cap>`)
     **etiquetan** cada efecto del SDK con su capability — no fallan solas.
   - Semgrep no puede leer el manifiesto, así que el **diff lo hace
     `capability-diff.mjs`** sobre `semgrep --json`:
     - cualquier finding FORBIDDEN → **fail**;
     - capability **usada** y **no declarada** en `manifest.capabilities` →
       **fail** (con `file:line` del primer uso; el usuario no consintió eso);
     - capability **declarada** y **no usada** → **warn** (nudge de mínimo
       privilegio, no bloquea).
   - Verdict JSON (`{status, forbidden, undeclaredCapabilities, …}`) → persiste
     en `module_review_events`. Verificado 2026-05-29: el ejemplo da `pass`;
     fs.write no declarado + un import prohibido dan `fail`; `http` declarado y
     sin usar da `warn`.

   > **Limitación honesta (aliasing)**: las reglas casan `$C.server.exec(...)`,
   > etc. Un `const s = ctx.server; s.exec()` puede escapar al patrón. Por eso
   > el chequeo estático es el **gate pre-merge**, no la garantía final: la
   > autoridad es el **wrapper runtime** (punto 2), que intercepta el efecto sin
   > importar cómo se haya aliaseado la referencia. (Endurecible luego con
   > semgrep taint-mode desde el import del SDK.)
2. **Runtime (defensa en profundidad, autoritativo)**: el wrapper del SDK chequea
   la capability declarada antes de **cada** efecto (sin importar aliasing) y,
   opcionalmente, el permiso del usuario Linux (`tool_permissions` →
   `AgentTool.permission`) + audit log.

> **Estado (2026-06-09):** el wrapper runtime (punto 2) está IMPLEMENTADO —
> `buildCtx` con `gate(cap)` por efecto en `shared/module-sdk/index.ts:98-130`;
> el chequeo de permiso de usuario lo hace el dispatch (§5.3). Las reglas
> estáticas (punto 1) están escritas en `security/module-semgrep.yml` +
> `security/capability-diff.mjs` (verificadas 2026-05-29), pero su cableado
> como gate del intake/CI sigue PENDIENTE (Fase F); en LP ya existe el sink de
> verdicts (`POST /api/internal/review/:versionId/events`,
> `marketplace.routes.ts:44`).

> **Nota MB vs tokens (NO confundir ejes)**: el módulo se cobra en **tokens**
> (tarifa plana mensual; el creador gana el 90 %). El tráfico SSH que generen sus
> tool-calls cuenta en el **eje MB de infraestructura del cliente** (la conexión
> LUXIPANEL→servidor), igual que cualquier acción del panel — **independiente**
> del precio del módulo y de las ganancias del creador. El SDK no liga uno con
> otro. Ver ROADMAP §5.

---

## 4. Ciclo de vida (resumen)

```
la IA del asistente GENERA modules/<id>/{manifest,backend,frontend} (§0 — obligatorio;
el dev testea/corrige/mejora y cambia estados; no escribe contra el SDK a mano)
   │  Modo A: `lux dev` carga por sideload (hot-reload) contra su server de pruebas   [PENDIENTE]
   │  Modo B: preview privada en panel instalado (runtime aislado) tras escaneo        [PENDIENTE]
   ▼
dev envía a revisión (POST /v1/api/dev/modules · resubmit)                            [IMPLEMENTADO en LP]
   →  pipeline (semgrep/diff de capabilities/IA/humano; fija version/os_compat/arch)  [reglas escritas; cableado PENDIENTE]
   ▼ (aprobación + firma)
job de integración vendoriza a backend/src/modules/community/installed/<id>/          [PENDIENTE — Fase F]
   ▼
loader: defineModule() → buildCapability() → registry.register()                      [IMPLEMENTADO]
dispatch POST /api/community/:id/tool/:name · GET …/panel/:name                       [IMPLEMENTADO]
UI en /panel/community/<id>/                                                          [PENDIENTE]
```

> Nota de ruta REAL: los módulos aprobados se vendorizan en
> `backend/src/modules/community/installed/<id>/` (subcarpeta `installed/`,
> separada de la infra del loader), no directamente en `community/<id>/` como
> decía el diseño original.

---

## 5. Loader dinámico + dispatch endpoint (runtime)

> **IMPLEMENTADO (2026-06-09)** en `backend/src/modules/community/`:
> `community-loader.service.ts` (loader/installed/hot load-unload),
> `community-sync.service.ts` (poll de cambios a LP), `compat.ts` (gating
> SO/arch/specs, función pura), `index.ts` (dispatch genérico +
> `registerCommunityModule`), más `backend/src/shared/community-catalog.ts`
> (capa mutable del catálogo). Smokes: `community.smoke.ts` y
> `compat.smoke.ts`. Pendientes dentro de esta sección: validación de
> schema/firma/rango-sdk en el loader (Fase F), Modo A/B (§5.6) y el servido
> del frontend (§5.7).

Cómo un módulo de comunidad pasa de carpeta vendored a tools invocables, y cómo
el frontend los llama. Aterrizado sobre lo real: Express 5, `server.ts` que
registra módulos en `runOnPanelHost`, `agentCapabilityRegistry` con
`register/unregister` idempotentes, executor per-request por ALS
(`getContextExecutor`, fail-closed), catálogo = **estado de instancia** en el
panel host (no per-server).

### 5.1 La idea que lo simplifica: ruta genérica, no hot-mount de Express

No se monta un router por módulo. Hay **una sola ruta genérica** que resuelve la
tool en el registry en memoria. Así, montar/desmontar un módulo = un
`register()`/`unregister()` en el registry; **la superficie HTTP nunca cambia**
y no hay que tocar el árbol de middleware de Express en caliente (que sería
frágil). Esto es lo que hace viable la carga/descarga dinámica.

### 5.2 Dónde vive y cuándo carga

El código vendored en **`backend/src/modules/community/installed/<id>/`**
(divergencia vs el diseño: subcarpeta `installed/`, para separar los módulos de
la infra del loader) es **estado de instancia** (vive en el panel host, igual
que el catálogo y el registro MCP, ver CLAUDE.md §"Estado de instancia"). Se
registra como un módulo más de `createApp` (`server.ts:153`), dentro de
`runOnPanelHost`, **antes** de `app.listen()`:

```ts
// real: modules/community/index.ts → registerCommunityModule(app)
app.use(router);                       // monta UNA vez las rutas genéricas
void loadCommunityModules();           // escanea installed/<id>/, carga (async, no bloquea boot)
// + setInterval(syncCommunityModules) si COMMUNITY_SYNC_MINUTES > 0 (§5.5)
```

`loadCommunityModules()` (real: `loadFromDisk` por cada carpeta de
`installed/`):
1. Lee `module.manifest.json`. **PENDIENTE:** validarlo con el JSON Schema
   (§1.4) — hoy se consume tal cual (tipado mínimo `ModuleManifest`).
2. **PENDIENTE (Fase F):** verificar firma + `content_hash` contra el catálogo
   de LP (defensa contra manipulación post-aprobación). El loader lo asume ya
   verificado por el job de integración (nota explícita en el header de
   `community-loader.service.ts`).
3. **PENDIENTE:** comprobar que la versión instalada del SDK satisface
   `manifest.sdk` (§2.5).
4. ✅ `import()` del `entry.backend` (default `backend/index.js`; default
   export = factory de `defineModule`), con cache-bust
   `?v=<repo_commit|version>` para recarga en caliente.
5. ✅ `buildCapability(manifest, factory)` → `AgentCapability` (el SDK, §2).
6. ✅ `agentCapabilityRegistry.register(capability)` (idempotente) +
   `communityCatalog.set(manifestToDefinition(manifest))` — la capa mutable
   que `getCatalog()` fusiona con el estático
   (`module-registry.service.ts:464`). Si algo falla → **se omite ese módulo y
   se loguea** (`log.error`, catch en `loadFromDisk`), nunca se cae el proceso
   (a diferencia de los core, cuyo error de prefijo sí crashea — para
   comunidad es rechazo aislado). ✅ implementado.

### 5.3 El dispatch endpoint

> **IMPLEMENTADO** en `modules/community/index.ts`:
> `POST /api/community/:moduleId/tool/:name` y
> `GET /api/community/:moduleId/panel/:name`, con `requireAuth` +
> `requireModule(moduleId)` dinámico. Divergencias vs el pseudocódigo de
> diseño de abajo:
> - El permiso de usuario se chequea con `res.locals.user` (admin lo salta;
>   si no, debe estar en `user.permissions.actions`) — y la `permission` sale
>   de `ToolDef.permission` declarada en el código del módulo, **no** del mapa
>   `tool_permissions` del manifiesto (ese mapeo manifest→tool queda
>   PENDIENTE de cablear).
> - El `ctx` NO se construye en el dispatch: lo cierra el SDK dentro del
>   handler (`buildCapability` → `buildCtx`, §5.4). El dispatch solo llama
>   `found.tool.handler(req.body?.input)`.
> - Errores → `res.status(404|403|400).json({ok:false,error})` directamente
>   (no errores tipados de `shared/errors` — deuda menor de estilo del repo).

Dos rutas genéricas (tools y dataPanels), montadas una sola vez (pseudocódigo
del diseño original, conservado como referencia):

```ts
// POST /api/community/:moduleId/tool/:name   → ejecuta una AgentTool
// GET  /api/community/:moduleId/panel/:name  → recoge un AgentDataPanel
router.post(
  "/api/community/:moduleId/tool/:name",
  requireAuth,                                  // fija el executor del server en ALS
  requireModule((req) => req.params.moduleId),  // catálogo+entitlement+settings+user.modules
  asyncHandler(async (req, res) => {
    const { moduleId, name } = req.params;
    const fqname = `${moduleId}.${name}`;        // el registry indexa por nombre completo
    const found = agentCapabilityRegistry.findTool(fqname);
    if (!found || found.moduleId !== moduleId) throw new NotFoundError("tool");

    // permiso de usuario declarado en tool_permissions → AgentTool.permission
    if (found.tool.permission) requirePermission(req, found.tool.permission);

    const ctx = await buildModuleCtx(req, moduleId, found.tool);  // §5.4
    const out = await runWithModuleCtx(ctx, () => found.tool.handler(req.body?.input));
    res.json({ ok: out.ok, data: out.output });
  }),
);
```

Claves de seguridad de la ruta:
- `requireAuth` ya corre el request dentro de `runWithExecutor(targetExecutor)`
  → el handler actúa sobre el **servidor conectado** del usuario, fail-closed.
- `requireModule` reusa la cadena existente: módulo en catálogo + **entitlement
  LP** (suscripción activa / `statusPanel`) + `panel_settings` enabled +
  `user.modules`. Un módulo suspendido o sin suscripción → 403 aquí, gratis.
- Se verifica que la tool **pertenece** al `moduleId` de la URL (no se puede
  invocar `mail.delete_account` desde `/community/acme-cache-warmer/...`).

### 5.4 Construcción del `ctx` per-request

> **IMPLEMENTADO**, pero NO como `buildModuleCtx` en el dispatch: vive en el
> SDK (`shared/module-sdk/index.ts:98-130`, `buildCtx(manifest, declared)`)
> y se construye al invocar cada handler. El executor se resuelve lazy con
> `getContextExecutor()` (fail-closed: sin executor → error). Diferencias vs
> el diseño de abajo: sin `submitMutation` (PENDIENTE), `http` = solo
> allowlist (anti-SSRF PENDIENTE), `events.emit` = solo log (bus PENDIENTE),
> `runId` = `cm_<ts>_<n>`.

`buildModuleCtx` arma el `ctx` de §2.2 ligado a este request/módulo
(pseudocódigo del diseño original):

```ts
function buildModuleCtx(req, moduleId, tool) {
  const declared = new Set(getCommunityManifest(moduleId).capabilities);
  const gate = (cap) => { if (!declared.has(cap)) throw new ForbiddenCapabilityError(moduleId, cap); };
  return {
    runId: newId(), now: Date.now(),                 // (now: usar reloj real del request)
    user: { linux: getExecutor(req).sshUsername },
    target: getExecutor(req).target,
    log: createModuleLogger(`community:${moduleId}`),
    server: {
      exec: (cmd, o) => { gate("server.exec"); if (o?.sudo) gate("server.sudo");
                          return getContextExecutor().exec(injectSudoIfNeeded(cmd, o), o); },
      readFile: (...a) => { gate("server.fs.read"); return getContextExecutor().readFile(...a); },
      writeFile:(...a) => { gate("server.fs.write"); return getContextExecutor().writeFile(...a); },
      submitMutation: (steps) => { gate("server.fs.write"); if (hasSudo(steps)) gate("server.sudo");
                                   return submitMutation(getContextExecutor(), scope(moduleId, steps)); },
      // …readdir/stat/mkdir/rename/unlink análogos
    },
    storage: kv(getContextExecutor()).module(`community:${moduleId}`),  // sidecar per-server, namespaced
    http: { fetch: (url, init) => { gate("http"); assertAllowlisted(moduleId, url); return safeFetch(url, init); } },
    events: { emit: (e, p) => bus.emit(`community:${moduleId}:${e}`, p) },
  };
}
```

- El **wrapper runtime es la autoridad** del enforcement de capabilities (§3.2):
  `gate()` corre pase lo que pase, sin importar aliasing.
- `storage` queda namespaced en `kv(executor).module("community:<id>")` →
  sidecar per-server, **aislado** de otros módulos.
- `injectSudoIfNeeded`/`submitMutation`/`assertAllowlisted` reusan el modelo
  existente (askpass + cola write-behind + host-policy anti-SSRF). El dev nunca
  toca el passphrase ni hace red sin allowlist.
- **No hay medición de MB aquí**: el cobro del módulo es por **tokens** (plano
  mensual, ROADMAP §5). El tráfico SSH del Executor lo contabiliza el eje de
  infraestructura del cliente por su cuenta, igual que para los módulos core —
  el SDK no lo mezcla con la economía del módulo.

### 5.5 Carga y descarga en caliente (publicar / suspender)

Como todo pasa por el registry + catálogo en memoria, los eventos del
marketplace se aplican sin reiniciar:

| Evento (desde LP) | Acción del loader |
|---|---|
| `publico` (módulo aprobado/integrado) | `load(<id>)`: pasos §5.2.3-6 → `register` |
| nueva versión `publico` | `unregister(<id>)` → `import()` con cache-bust → `register` |
| `suspendido` / `inactivo` | `unregister(<id>)` + quitar del catálogo de comunidad |

- `register` es **idempotente** (re-registrar reemplaza), así que la recarga de
  versión es segura.
- **Límite honesto (eviction de ESM)**: Node no descarga el código ya importado;
  `unregister` lo hace **inalcanzable** (sin ruta, sin tool en el registry) pero
  el módulo sigue residente hasta el próximo restart. Aceptable: un módulo
  suspendido no puede invocarse. Para evicción dura real → restart del proceso
  o (futuro) un worker por módulo. La recarga de versión usa
  `import(url + "?v=" + contentHash)` para traer el nuevo código.
- El disparo viene por el contrato `panel-api` (un push/poll de LP de cambios de
  `review_status`), igual que el entitlement de módulos hoy.

> **Estado real del sync (IMPLEMENTADO con matices)** —
> `community-sync.service.ts`:
> - `syncCommunityModules()` llama `panelApiClient.getCommunityChanges(since)`
>   → `GET /panel-api/community/changes?since=…` en LP
>   (`modules/license/panel-api.client.ts:216`; la ruta existe en
>   `LP-LICENSE-SERVER/.../panel-api.routes.ts`) y aplica cada cambio con
>   `applyChange({moduleId, action: "load"|"unload"})` del loader.
> - **Divergencia vs §6.5:** no va en el heartbeat — es un `setInterval`
>   propio activado por env `COMMUNITY_SYNC_MINUTES` (**default 0 = APAGADO**;
>   se lee de `process.env` en `modules/community/index.ts`, no está en
>   `config/env.ts`). Hay que habilitarlo explícitamente en prod.
> - Cursor `since` en memoria (proceso de larga vida); **fail-open**: un fallo
>   del poll se loguea y no afecta al panel.
> - `load` solo surte efecto si el módulo ya está vendored en
>   `installed/<id>/` (eso lo produce el job de integración, Fase F —
>   PENDIENTE); `unload` siempre aplica (desregistra del registry y del
>   catálogo).
> - El gating de compatibilidad pre-habilitación (`checkCompatibility` en
>   `compat.ts`, contra facts del Monitor) está implementado como función
>   pura + smoke, pero su cableado al flujo de habilitar/instalar queda
>   PENDIENTE.

### 5.6 Modo A (dev hot-reload) y Modo B (preview aislada) — ⏳ PENDIENTE

> Ninguno de los dos modos está implementado (2026-06-09). Con §0, además, el
> ciclo de iteración del dev pasa por el asistente IA (runs en background +
> follow-ups encolados), y el código de terceros debe correr en el **sandbox
> LUXIPANEL, nunca en el VPS del cliente** — el target/executor del sandbox
> está por definir (ver MODULE-DEV-AI-FLOW.md).

- **Modo A**: `lux dev` observa la carpeta local y, en cada cambio, hace
  `unregister`+`import(?v=mtime)`+`register`. Mismo loader, target = el server de
  pruebas del dev. Sin firma ni catálogo LP (es su instancia).
- **Modo B**: la **preview privada** NO usa este loader nativo. Carga el módulo
  en el **runtime aislado** (`isolated-vm`, §6 del ROADMAP) y el dispatch resuelve
  la tool contra ese isolate, no contra el registry nativo. Mismo endpoint, flag
  `preview=true` + scope al `userId` del dev. Es el único caso en que código no
  firmado corre en el panel host, y por eso va encajonado y tras escaneo.

### 5.7 Frontend: servido + cliente de invocación

- Las páginas de `frontend/` se sirven bajo `/panel/community/<id>/` y se
  construyen con el patrón canónico de scripts extraídos (entrada en
  `build-extracted.mjs`, init en `astro:page-load`/`after-swap` +
  `AbortController`, handshake DataTable si aplica — `frontend/ARCHITECTURE.md`).
- El sidebar/permiso sale de `surface` → `ModuleDefinition.permissions` →
  derivación de roles existente; el item aparece si el módulo está habilitado y
  el usuario tiene el permiso.
- Cliente inyectado (`@luxipanel/module-sdk/client`):

```ts
// REAL (frontend/src/lib/module-sdk-client.ts) — el bundle fija el <id>:
const mod = lxp.module("acme-cache-warmer");
await mod.call("warm", { sitemap });                // POST /api/community/<id>/tool/warm
await mod.panel("status");                          // GET  /api/community/<id>/panel/status
lxp.assistant.seed("Depura por qué el warm falló"); // reusa el bus lxp:assistant:seed
```

El cliente solo invoca tools del **propio** módulo (el `<id>` lo fija el bundle,
no el código de página) y no tiene `fetch` libre (CSP estricta en esas páginas).

> **Estado:** cliente IMPLEMENTADO (`module-sdk-client.ts`); servido de las
> páginas `/panel/community/<id>/`, entrada en `build-extracted.mjs` y CSP
> estricta: PENDIENTES.

### 5.8 Integración con catálogo / entitlement / permisos (sin reinventar)

```
getCatalog()  = CATALOG_estático  ⊕  catálogoComunidad (lo llena el loader)
visibilidad   = catálogo → entitlement LP (suscripción/statusPanel) →
                panel_settings(module.<id>.enabled) → user.modules
ejecución     = requireModule + requirePermission + ctx (capabilities) + audit + MB
```

Es exactamente la cadena de hoy; el módulo de comunidad solo **se añade** a la
fuente del catálogo y trae su `surface`/`capabilities`/`pricing`.

---

## 6. Decisiones del SDK / runtime (resueltas con default — 2026-05-29; estado 2026-06-09)

1. **Dependencias npm de terceros** → decidido: **permitidas con guardas**: audit
   de deps en el pipeline (`osv-scanner`/`npm audit`), `minimumReleaseAge: 1440` +
   allowlist de builds (política ya vigente del monorepo, ver memorias pnpm v11),
   **sin scripts post-install**. Las deps se vendorizan con el módulo.
   *Estado: ⏳ PENDIENTE (va con el pipeline, Fase F).*
2. **`submitMutation` para terceros** → decidido: **expuesto en v1**, pero todo
   módulo que use `server.fs.write`+`server.sudo` requiere **revisión humana
   siempre** (no auto-aprobación de patches) por el blast radius.
   *Estado: ⏳ PENDIENTE — el SDK real aún no lo expone (§2.2).*
3. **Cuotas (defaults)** → decidido: `storage` ≤ **50 MB** por (módulo, servidor);
   **60 tool-calls/min** por usuario; **timeout 30 s** por handler;
   `http` ≤ **20 req/min** por invocación. Configurables en `config/env.ts`.
   *Estado: ⏳ PENDIENTE — ninguna cuota implementada en el runtime.*
4. **Evicción dura** → decidido: v1 = `unregister` + **restart programado**
   (ventana de mantenimiento); worker por módulo **diferido** (solo si el volumen
   lo exige). *Estado: ✅ `unregister` + cache-bust de re-import implementados
   (loader); el restart programado es operativo, no de código.*
5. **Disparo de carga/descarga** → **✅ IMPLEMENTADO con matiz**: poll a
   `GET /panel-api/community/changes?since=…` (ver `MARKETPLACE-API.md` §5),
   pero NO en el heartbeat — `setInterval` propio gobernado por
   `COMMUNITY_SYNC_MINUTES` (default **0 = apagado**; leído de `process.env`,
   aún no declarado en `config/env.ts`). Push de LP opcional más adelante.
6. **(Nuevo 2026-06-09) Versionado y compatibilidad AUTO** → `version`,
   `os_compat` y `arch` los fija la **plataforma** (§1.1): semver derivado del
   diff + pipeline; SO/arch por análisis estático de comandos/deps + validación.
   *Estado: ⏳ PENDIENTE (cálculo en el pipeline); el gating runtime que los
   consume (`compat.ts`) ya existe.*
7. **(Nuevo 2026-06-09) Desarrollo asistido por IA OBLIGATORIO** → ver §0 y
   `MODULE-DEV-AI-FLOW.md`. *Estado: piezas del asistente ✅; flujo
   marketplace-específico ⏳.*

---

_Companion de `LP-LICENSE-SERVER/ROADMAP-DEV-MARKETPLACE.md` y de
`MODULE-DEV-AI-FLOW.md` (flujo de creación guiada por IA, §0). El SDK vive en
este repo como librería interna (`backend/src/shared/module-sdk/`); su
publicación como paquete `@luxipanel/module-sdk` queda pendiente._

## Chat tools admission contract

Every new installation or update must declare `chat.version: 1` and a nonempty
`chat.operations` array. Each entry declares a unique operation `id`, its tool
suffix `tool`, `kind` (`read` or `action`) and explicit `<moduleId>.<action>`
`permission`. Every `surface.actions` permission must have a corresponding
operation. Runtime tool names, kinds and permissions must agree with this
catalog; every runtime tool must appear in it. Validation happens before
replacing the active capability. A rejected update leaves the old generation
registered. Preview bundles retain the existing isolated-runtime requirement.

```json
"chat": {
  "version": 1,
  "operations": [
    { "id": "status", "tool": "status", "kind": "read", "permission": "my-module.read" },
    { "id": "save", "tool": "save", "kind": "action", "permission": "my-module.edit" }
  ]
}
```
