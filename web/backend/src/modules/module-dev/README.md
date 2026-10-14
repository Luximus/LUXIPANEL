# module-dev — "Mis módulos" (ciclo de vida del marketplace)

Módulo del panel para el flujo **creación de módulos del marketplace guiada
por IA** (`/var/www/LUXIPANEL/MODULE-DEV-AI-FLOW.md`). El alta nace en el
asistente (`/mod vincular` crea el vínculo proyecto↔módulo); este módulo opera
el ciclo administrativo contra LP-LS y las pruebas locales del dev.

## Activación (LEER)

`module-dev` está en `DEFAULT_ENABLED_MODULES` (tag `free`), así que en
instalaciones **nuevas** nace habilitado. **En instalaciones existentes con
filas explícitas de módulos en settings, `module-dev` nace deshabilitado: el
admin debe activarlo en `/panel/modules`** (la primera fila explícita hace que
los defaults dejen de aplicar — trampa conocida del registry). **No escribir
filas en settings a mano.**

Acceso v1: **admin-only** (`user.kind === "admin"`). La identidad de developer
ante LP es el customer dueño del panel; abrir el ciclo a usuarios no-admin
requiere el modelo identidad-por-linux-user (pendiente, memoria
`luxipanel-sso-identity-linux-user`).

## API (`/api/module-dev/*`, siempre `{ ok, data? , error? }`)

| Ruta | Qué hace |
|---|---|
| `GET  /modules` | Módulos del dev con estado (`{ modules, stale, fetchedAt }`) |
| `GET  /modules/:code/reviews` | Timeline de revisión (passthrough LP + `stale/fetchedAt`) |
| `POST /modules/submit` `{moduleId, prUrl, scope?}` | Enviar a revisión (**gate IA**: exige marketplace-link) |
| `POST /modules/:code/resubmit` `{prUrl}` | Reenviar tras corrección (mismo gate) |
| `POST /modules/:code/unpublish` | publico → inactivo (dev-side) |
| `POST /modules/:code/republish` | inactivo → publico (solo si fue aprobado antes) |
| `POST /manifest/validate` `{manifest}` | Validador puro del manifest (errores + warnings) |
| `POST /checks/run` `{projectId}` | Checks estáticos: manifest + entry + notas (no ejecuta nada) |
| `POST /tests/run` `{projectId, timeoutMs?}` | Suite del módulo **en el target** (CI=1, timeout, salida capada) |
| `GET  /links` | Vínculos proyecto↔módulo del target actual |
| `GET  /preview` | Previews instalados (Modo B) |
| `POST /preview/install` `{projectId}` | Vendoriza el módulo como preview privado + hot-load |
| `POST /preview/uninstall` `{moduleId}` | Elimina el preview (solo owner; jamás módulos aprobados) |
| `POST /preview/:moduleId/tool/:name` `{input?}` | Dispatch de prueba de una tool del preview (owner-gated) |
| `GET /project/tree?path=` | Lista una carpeta del checkout local del panel |
| `GET /project/search?q=` | Busca archivos y carpetas por nombre o ruta |
| `GET /project/file?path=` | Vista previa de texto del archivo seleccionado |
| `POST /project/refresh` | Invalida el índice de búsqueda (admin + CSRF) |

## Mapa proyecto

**Mapa proyecto** en `/panel/project-map` navega el código real de este panel
con árbol de carpetas, búsqueda y lectura de archivos. **Mis módulos** en
`/panel/module-dev` conserva publicación, pruebas y previews. Ambas vistas
comparten el permiso administrativo de `module-dev`. El explorador es de solo
lectura, no sigue enlaces simbólicos y excluye dependencias, builds, dotfiles
privados y claves. La vista previa de texto se limita a 200 KB; la búsqueda
recorre nombres y rutas, con índice temporal de 20 segundos. No depende del
target seleccionado en el panel.

Política LP caído: **lecturas fail-open** con caché de instancia
(`stale:true`; sin caché → 502 `MODULE_DEV_UPSTREAM_ERROR`); **mutaciones
fail-closed** (502 con el mensaje de LP, nunca éxito ficticio). Sin
write-behind/jobs en v1.

**Identidad del developer ante LP = host de la SESIÓN, nunca un header.**
LP resuelve host→panel→customer, así que el host es autorización: se toma de
`user.targetHost` (claim `thost` del SSO de LP o, en sesiones direct-SSH, el
host de la request validado contra el subdominio del login en
`shared/utils/session-host.ts`). `x-forwarded-host` llega tal cual del cliente
(nginx tenants no lo fija; el proxy Astro solo quita `host`) — usarlo
permitiría operar los módulos del customer de OTRO panel (BOLA). Sin host de
sesión → 409 `MODULE_DEV_NO_HOST` (fail-closed; re-login). Las claves de la
caché de lecturas van con scope por host (`modules:<host>`).

## Agent tools (prefijo OBLIGATORIO `module-dev.`)

`validate_manifest`, `run_checks` (read) · `run_tests`, `resubmit_module`,
`preview_uninstall`, `link_project` (action) · `submit_module`,
`unpublish_module`, `republish_module`, `preview_install` (action+dangerous).
`list_modules`, `module_status` (read). Actions con permission
`module-dev.manage` (admin bypass). Expuestas también por el MCP loopback vía
`allowedTools` del asistente.

## Persistencia

- **Estado de instancia (panel host, `localExecutor` explícito):**
  `${LUXIPANEL_CONFIG_DIR}/module-dev/lp-cache.json` — última copia buena de
  las lecturas LP, con clave SIEMPRE scoped por host (`modules:<host>`,
  `reviews:<host>:<code>`): la instancia es multi-tenant y una caché sin
  scope filtraría módulos entre developers. El host NO se memoiza (las agent
  tools lo resuelven del SessionUser pineado en el ALS).
- **Per-target (executor del request):** `marketplace-link/links.json`
  (dueño: `shared/marketplace-link`) — module-dev solo lo lee/upserta.
- **Preview Modo B (panel host):** `modules/community/installed/<id>/` +
  marker `.preview.json` (`{preview, ownerUserId, projectId, …}`). El loader
  community registra sus tools pero NO lo publica en el catálogo.

## Env (`config/env.ts`)

| Var | Default | Qué limita |
|---|---|---|
| `MODULE_DEV_TEST_TIMEOUT_MS` | `180000` | Timeout del runner (cap duro 600s) |
| `MODULE_DEV_TEST_MAX_OUTPUT_KB` | `256` | stdout/stderr capturados |
| `MODULE_DEV_PREVIEW_ENABLED` | `false` | **Kill-switch del preview Modo B** (instalar + cargar; ver Seguridad) |
| `MODULE_DEV_PREVIEW_MAX_FILES` | `200` | Archivos vendorizados por preview |
| `MODULE_DEV_PREVIEW_MAX_TOTAL_MB` | `10` | Peso total del preview (2MB/archivo fijo) |

## Seguridad / pendientes documentados

> **Actualización 2026-06-14:** el runtime de preview out-of-process (PIPS) **ya
> está implementado pero INERTE** — fases F2–F4 completas en
> `shared/preview-sandbox/` (ver `RUNTIME-DESIGN.md` §10), `PREVIEW_SANDBOX_ENABLED`
> y `MODULE_DEV_PREVIEW_ENABLED` siguen en `false` por defecto, `isAvailable()`
> permanece `false` y `dispatchPreviewTool` sigue fallando cerrado. Falta F5
> (sign-off de seguridad + gate CI). Nada de lo de abajo cambia hasta encenderlo.

- **El runtime que EJECUTA el código del preview es OUT-OF-PROCESS y NO existe
  todavía** (`shared/preview-sandbox/runtime.ts`, `isAvailable()===false`). Un
  isolated-vm **en proceso NO es una frontera** frente a un dev adversario: un
  0-day de V8/sandbox sería RCE a nivel de proceso = robo de secretos
  CROSS-TENANT (mTLS key, `LUXIPANEL_KEY`, executores SSH de otros tenants en el
  mismo heap). La única frontera aceptable es un proceso/contenedor separado,
  non-root, seccomp/landlock, sin red y **sin secretos heredados**. Mientras no
  esté integrado:
  - El loader community **NUNCA hace `import()` en proceso de un preview**
    (marker `.preview.json` presente) — y un marker corrupto/ausente **falla
    cerrado** (se salta), nunca degrada a "aprobado → import()". El `import()`
    en proceso es EXCLUSIVO de módulos con señal POSITIVA de aprobado
    (`isApprovedForInProcessImport`; Fase F lo endurecerá a firma+content_hash).
  - `dispatchPreviewTool` **falla cerrado** (`ForbiddenError`) mientras
    `previewSandboxRuntime.isAvailable()` sea `false`: el código del preview NO
    corre en el proceso del panel por ningún camino (ni registry in-process).
  - `MODULE_DEV_PREVIEW_ENABLED=false` por defecto y **debe seguir así**.
    Encenderlo solo habilita el VENDORIZADO en disco (archivos inertes); no
    autoriza ejecución. Tres revisiones hostiles independientes:
    **"safe-but-keep-disabled"**. No poner default `true` ni reintroducir un
    sandbox in-process.
  Gate compensatorio (defensa-en-profundidad, NO la frontera): validación
  estricta del manifest + caps de tamaño + solo el propio dev instala/invoca su
  preview + rutas admin-only.
- El runner de tests corre en el **servidor del propio dev** (target del
  request, fail-closed); sandbox multi-tenant dedicado: pendiente
  (MODULE-DEV-AI-FLOW.md §3.7).
- Provenance verificable real (pipeline CI de LP, F3/F4): pendiente — el gate
  IA v1 es soft (marketplace-link obligatorio para submit/resubmit).
