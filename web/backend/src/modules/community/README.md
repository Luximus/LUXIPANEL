<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<!-- Copyright (C) 2026 LUXISOFT -->

# Módulo `community` — runtime de módulos de terceros

Subsistema que carga y expone **módulos de comunidad / marketplace** (módulos
escritos con `@luxipanel/module-sdk`, no core) dentro de LUXIPANEL. No es un
módulo de "tab" normal: no tiene `models/repositories/services/controllers`, sino
un **loader** (estado de instancia) + una **ruta genérica de dispatch** de las
tools/paneles que esos módulos declaran.

## Piezas

| Archivo | Rol |
|---|---|
| `index.ts` | `registerCommunityModule(app)`: monta la ruta genérica de dispatch (`POST /api/community/:moduleId/tool/:name`, `GET /api/community/:moduleId/panel/:name`), inicializa `previewSandboxRuntime`, dispara `loadCommunityModules()` y suscribe los listeners de recarga en caliente (`COMMUNITY_RELOAD/UNLOAD`). |
| `community-loader.service.ts` | Descubre `installed/<id>/`, parsea `module.manifest.json` + `.preview.json`, clasifica (preview vs aprobado) **fail-closed**, importa el aprobado en proceso y registra el `AgentCapability` vía el SDK. Carga/descarga en caliente. |
| `installed/<id>/` | Módulos vendorizados (aprobados **y** previews). Cada uno: `module.manifest.json` + `entry.backend` (p.ej. `backend/index.js`) + opcional marker `.preview.json`. Hoy: `codebase-graph`. |
| `community.smoke.ts` | Smoke standalone (tsx) del SDK+loader+dispatch. **No** es un test de vitest (se corre a mano); la caracterización vive en `community-loader.service.test.ts`. |

Los tres **registros de instancia** (in-memory, `shared/`) que el loader escribe:
- `agentCapabilityRegistry` — tools/paneles invocables (asistente, MCP, dispatch HTTP).
- `communityCatalog` (`shared/community-catalog.ts`) — catálogo público (sidebar / `/panel/modules`). Lo **lee** `admin/module-registry.service` (`getCatalog = estático ⊕ comunidad`).
- `communityPreviewRegistry` (`shared/community-preview/`) — previews por-owner, **fuera** del catálogo público.

## Estado de wiring — ⚠️ ACTUALMENTE SIN CABLEAR (decisión de producto pendiente)

`registerCommunityModule` **NO** está en la lista de módulos de `server.ts`
(`createApp([...])`). Implicaciones **en runtime hoy**:

- Las rutas `/api/community/*` **no se montan** → dispatch HTTP de tools/paneles de módulos de comunidad no responde.
- `loadCommunityModules()` **no corre en boot** → `installed/codebase-graph/` no se carga; `communityCatalog` queda vacío (nada lo puebla), así que `admin/module-registry.getCatalog()` nunca muestra módulos de comunidad.
- Los listeners `COMMUNITY_RELOAD/UNLOAD` **no se suscriben**. `module-dev/preview.service.ts` **sí emite** esos eventos (`eventBus.emit(Events.COMMUNITY_RELOAD/UNLOAD)`) al publicar/suspender un preview → **caen en el vacío** (sin listener). El vendorizado a disco que hace `module-dev` persiste, pero la (re)carga en caliente no ocurre.
- `previewSandboxRuntime.init()` no se invoca por esta vía.

Nadie más importa `community-loader.service.ts` (verificado: 0 importadores fuera
del propio módulo + su smoke). Es decir, **el loader no tiene ninguna vía de
ejecución alternativa**: si `registerCommunityModule` no se llama, todo el
subsistema está inerte. `module-dev` interactúa con él **solo** por el event bus
(desacoplado) y por los helpers compartidos (`community-catalog`,
`community-preview/getCommunityInstalledDir`), nunca llamando al loader directo.

> **Decisión de producto (no la toma este refactor):** cablear
> `registerCommunityModule` en `server.ts` (activar el marketplace de terceros) o
> retirar el módulo. **No** se ha cableado ni borrado aquí a propósito. El código
> es correcto y está testeado; solo falta la decisión de exponerlo.

## Modelo de sandbox / seguridad

Cargar un dir con `await import()` ejecuta su código **dentro del proceso del
panel**. La política es **fail-closed** (ver cabecera §SEGURIDAD de
`community-loader.service.ts`):

1. **Manifest / marker JSON ilegible → se SALTA el módulo** (nunca lanza; el
   escaneo continúa con los demás). Esto evita que un `installed/<id>/` corrupto
   tumbe el boot. Cubierto por caracterización.
2. **Marker `.preview.json` presente** (preview Modo B) → **NUNCA** se importa en
   proceso. El único runtime aceptable para código de un dev no revisado es
   out-of-process (`previewSandboxRuntime`), que **todavía no existe** →
   los previews quedan inertes (fail-closed), aun con `MODULE_DEV_PREVIEW_ENABLED=true`.
3. **Aprobado = señal POSITIVA** (`isApprovedForInProcessImport`): sin marker, y
   `entry.backend` debe resolver **dentro** de `installed/<id>/` (path-guard
   anti-traversal) bajo el `INSTALLED_DIR` canónico. La ausencia de marker **no**
   basta. La verificación criptográfica real (firma + `content_hash` del bundle
   aprobado por LP) es la **Fase F** y reemplazará ese cuerpo antes de tratar el
   `import()` como seguro frente a un bundle manipulado en disco.
4. **Aislamiento de fallos:** un módulo de comunidad que lance en su `import()`
   se registra como error y se salta — **jamás** tumba el proceso (a diferencia
   de un módulo core).

La **superficie de API** que un módulo de terceros puede tocar está acotada por
`@luxipanel/module-sdk` (solo `ctx.server.*` / `ctx.http` / `ctx.storage`, con
gate de capabilities declaradas en el manifest) y por la política estática
`security/module-semgrep.yml` (FORBID de builtins de Node, imports internos
`@shared/@modules/@config`, `process.env`, executor/kv/dataStore crudos). El
loader no amplía esa superficie.

## Cómo lo consume `module-dev`

`module-dev` es el IDE/flow de creación de módulos. Su relación con `community`
es **totalmente desacoplada** (regla del repo: los módulos no se importan entre
sí):

- **Vendorizado:** `module-dev/preview.service.ts` escribe el preview a
  `installed/<id>/` + `.preview.json` usando `getCommunityInstalledDir()` y
  `PREVIEW_MARKER_FILE` de `shared/community-preview` (SSOT del path).
- **Recarga/descarga:** emite `Events.COMMUNITY_RELOAD` / `COMMUNITY_UNLOAD` por
  el event bus; el listener de `community/index.ts` llama `reloadModule` /
  `unloadModule`. **(Requiere que `registerCommunityModule` esté cableado; hoy no
  lo está — ver arriba.)**
- **Lectura:** el filtro por-owner del asistente y `module-dev` consultan
  `communityPreviewRegistry` / `communityCatalog` directamente.

## agent-capability (`agent-capability.ts`)

**No aplica** para este módulo. Los `agent-capability.ts` exponen las tools de un
módulo *core* al asistente. Aquí es al revés: `community` **es** la maquinaria
que registra las capabilities de **otros** módulos (los de terceros construyen su
`AgentCapability` vía el SDK y el loader las mete en `agentCapabilityRegistry`).
El propio `community` no ofrece tools de asistente — solo dispatch HTTP genérico
y un loader de estado de instancia. Añadir un `agent-capability.ts` sería
recursivo y sin sentido.

## Tests

- `community-loader.service.test.ts` (vitest) — caracterización del loader:
  registro/desregistro en los tres registros, parseo tolerante a fallos
  (manifest/marker corrupto → skip, no lanza), clasificación fail-closed
  (preview nunca in-process, path-traversal rechazado, aprobado válido importa).
- `community.smoke.ts` (tsx, manual) — SDK + gate de capabilities + fail-closed
  sin executor de contexto.

Correr: `npx vitest run src/modules/community` · `npx tsx src/modules/community/community.smoke.ts`.
