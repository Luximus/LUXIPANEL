# ARCHITECTURE — LUXIPANEL / frontend

> Infra global y contratos: `/var/www/LP-LICENSE-SERVER/INFRA_LUXIPANEL.md`.
> Este doc cubre solo la **arquitectura modular** de este frontend.

## Rol

UI del panel. **Astro SSR** (`@astrojs/node` standalone) + React (islas) +
Tailwind v4. Proceso pm2 `luxipanel-frontend` en `:4321`. Proxea `/api/*` →
`BACKEND_URL` (`http://127.0.0.1:8080`).

## Estructura

```
src/
├── middleware.ts        # gate SSR de auth/setup
├── pages/
│   ├── api/[...path].ts  # proxy universal → BACKEND_URL
│   ├── panel/<feature>/  # una carpeta por módulo del panel
│   ├── sso/  entry/  error/  index.astro  login.astro
├── layouts/             # layouts SSR
├── components/          # ui/ · layout/ · auth/ · panel-files/ · floating-terminal/
├── lib/                 # api-client, auth, i18n, theme, branding
├── config/tables/       # config declarativa de tablas
├── scripts/extracted/   # JS extraído del SSR (bundeado en build)
└── styles/extracted/
```

## Piezas clave

- **`src/middleware.ts`** — gate SSR. `/api/*` y assets pasan. Resto:
  `needsSetup()` consulta `/api/setup/status` (timeout 2.5s). **Default seguro
  si el backend no responde: redirigir a `/setup`**. `/panel/*` requiere
  sesión (`getSession`) → si no, `/login`. Usuario en `context.locals.user`.
- **`src/pages/api/[...path].ts`** — proxy único a `BACKEND_URL` (leído en
  **runtime**, no `import.meta.env`). Quita headers hop-by-hop, body como
  `ArrayBuffer` (JSON/multipart/octet-stream), `503 Backend unavailable` si
  el upstream falla. **Los WS (terminal/monitor) NO pasan por aquí**: Nginx
  los lleva directo a `:8080`.
- **`pages/panel/index.astro`** — la página de INICIO (`/` público == `/panel`)
  ES el módulo **Agentes IA**: monta `AssistantView` (mismo `AssistantPanel`
  que el drawer flotante). El antiguo Tablero (KPIs/widgets/atajos,
  `dashboard-v2.js`, namespace i18n `dashboard`) se eliminó el 2026-08-25;
  `pages/panel/assistant/index.astro` redirige a `/`. `lib/panel-routes.ts`
  `pathIsAssistantView` incluye `/` para que los FABs se oculten en la home.
- **`pages/panel/<feature>/`** — una carpeta por módulo del backend:
  `files`, `terminal`, `dns`, `ssl`, `mail`, `firewall`, `backups`, `cron`,
  `monitor`, `clamav`, `hosting`, `webhooks`, `users`, `assistant`,
  `openclaw`, `modules`, `repository-store`, `preferences`, `settings`,
  `docs`. Espejo de los módulos de `LUXIPANEL/backend`.
- **`components/`** — `ui/` (design system), `layout/`, `auth/`,
  `panel-files/` (explorador, Monaco), `floating-terminal/` (terminal flotante).
- **`lib/`** — `api-client.ts`, `auth.ts`/`confirm.ts`, `i18n`+`locales.ts`,
  `theme.ts`, `layout-branding.ts`/`layout-context.ts`,
  `panel-files-monaco.ts`, `embedded-source.ts`.

## Modelo actual: panel autohospedado y cuenta separada

El frontend sirve el login y workspace del panel instalado. El backend autentica Linux y ejecuta operaciones locales o SSH directo. No configurar MANAGED_BY_LICENSE_SERVER ni un bridge central de LP. El control API KEY vincula servicios de cuenta mediante una clave con nombre; las funciones protegidas pueden exigir validación online. App móvil consume APIs directas; Desktop abre esta interfaz web en una vista aislada.

## Scripts extraídos por módulo (`scripts/extracted/pages/panel/<mod>/`)

Cada módulo del panel tiene un `index-script1.ts` que se importa desde su
`.astro` con `<script type="module">import ".../index-script1.js?v=…"`. El
`.ts` se compila a `.js` por `scripts/build-extracted.mjs` (esbuild) y se
sirve estático desde `public/scripts/extracted/`. Astro `build` lo copia a
`dist/client/` para SSR.

### Patrón obligatorio para módulos nuevos

Astro `ClientRouter` (View Transitions) **NO re-evalúa** los
`<script type="module">` en navegación SPA — el módulo queda cacheado y su
top-level no vuelve a correr. Hay además 3 disparos por entrada
(`module-eval + astro:after-swap + astro:page-load`) que sin throttle se
traducen en N× cada fetch. Y `<DataTable client:load>` hidrata en paralelo
al script vanilla → race que pierde el `lxp:data-table:ready` si vanilla
evalúa tarde y el DataTable queda con skeleton/"No hay datos" pese a la
response 200.

Plantilla canónica (ver `users/`, `nginx/`, `mail/`, `backups/` como
referencia):

```ts
// Cooldown: dedupe module-eval + after-swap + page-load.
let initLastAt = 0;
const INIT_COOLDOWN_MS = 4000;

// Si el módulo usa DataTable:
const TABLE_IDS = ["mi-tabla-principal", "mi-tabla-secundaria"];

function init() {
  if (!document.getElementById("<id-único-de-la-página>")) return;  // page guard
  if (Date.now() - initLastAt < INIT_COOLDOWN_MS) return;            // throttle
  initLastAt = Date.now();

  // Handshake DataTable: si React hidrató antes de que este script
  // registrara su listener `lxp:data-table:ready`, ese evento se perdió;
  // el ping fuerza a DataTable a re-emitir `ready`.
  for (const tableId of TABLE_IDS) {
    window.dispatchEvent(new CustomEvent("lxp:data-table:request-ready", { detail: { tableId } }));
  }

  // ... wiring (idempotente; usar AbortController si re-atás listeners
  // sobre el mismo DOM en cada init) + fetches iniciales.
}

document.addEventListener("astro:page-load", () => init());
document.addEventListener("astro:after-swap", () => init());
init();
```

Reglas adicionales:

- **Refs a `<dialog>` / wrappers** capturadas a module-eval quedan huérfanas
  tras el primer swap SPA. Declarar `let`, reasignar en init() con
  `document.getElementById(...)`.
- **Listeners en `document.getElementById(...).addEventListener`** mueren con
  el DOM viejo en el swap; si re-atás en init(), usá `{ signal }` de un
  `AbortController` que abortás al principio de cada init() para no doblar.
- **Listeners en `window.addEventListener`** persisten cross-nav; registrar
  a module-eval y guardarse con un flag (`*EventsBound`) para no doblar.
- **Imports pesados (Monaco, etc.)** → `await import(...)` dentro de la
  función que los usa, NUNCA a module-top. Top-level lento retrasa el
  registro del listener `ready` y abre la race de F5.
- **Loaders idempotentes**: fetches GET pueden duplicarse sin daño, pero
  evitarlo igual con el cooldown.
- **Toda entrada nueva debe agregarse a `scripts/build-extracted.mjs`**.
  Si NO se agrega, el `.ts` no se compila y se sirve un `.js` viejo
  committed → confusión total al debuggear. Validar con
  `grep -c "INIT_COOLDOWN_MS" public/scripts/extracted/pages/panel/<mod>/index-script1.js`.
- **Scripts pre-built sin `.ts` (clamav, openclaw)**: el `.js` está
  committed en `public/scripts/extracted/pages/panel/<mod>/`. Editar el
  `.js` directamente y copiar a `dist/client/`. NO agregar a
  `build-extracted.mjs` mientras no haya `.ts` fuente — esbuild fallaría.
- **Sub-scripts perezosos** (tabs internos cuyo fetch se difiere hasta el
  primer click, p.ej. `settings/modules-cache.ts` para Ajustes→Módulos):
  - NO usar flags `let loaded = false; if (loaded) return;` — el flag
    persiste cross-nav SPA y deja el tab vacío en visitas posteriores.
  - Usar `cooldown + emptiness check` del contenedor (`tbody.children.length === 0`).
  - El padre debe disparar `window.dispatchEvent(new CustomEvent("lxp:<mod>-tab:activated", { detail: { tabId } }))`
    al activar un tab (incluye restauración desde sessionStorage). El
    sub-script escucha y carga si su tab quedó visible.
  - Registrar `astro:page-load + after-swap` también, por si el tab era el
    activo por defecto y nadie disparó click.
- **Loaders concurrentes con endpoint compartido**: si dos `load*()` en
  `Promise.allSettled([...])` del init() golpean el mismo endpoint (caso
  real: `loadRolesIntoSelect` + `loadRoles` ambos hitting `/api/roles`),
  **fusionar** en un solo fetch + función de aplicación que procese el
  resultado en N destinos. Audit rápido: extraer todos los `api.get(...)`
  por loader y verificar que no haya overlap.
- **Refs DOM a module-top**: NUNCA `const grid = document.getElementById("...")`
  en column 0. Tras swap SPA esa ref apunta a un nodo huérfano y cualquier
  `.innerHTML = ...` se pierde → la página queda en skeleton. Declarar
  `let` y reasignar en init() vía `acquireDomRefs()`. Combinar con
  emptiness-check sobre el contenedor para forzar refetch si el DOM
  llegó vacío (skeleton) aunque el cooldown bloquearía.
- **Listeners DOM atados a module-top con `addEventListener`**: NUNCA
  `document.getElementById("btn").addEventListener(...)` en column 0 — esos
  handlers se atan al DOM del PRIMER load y mueren con el swap SPA, dejando
  botones sin respuesta en la segunda visita. Mover todos los binds a una
  función llamada desde init() bajo el patrón fresh-DOM (siguiente bullet).
- **Cooldown no debe bloquear bindings**: el cooldown de `init()` debe
  aplicarse SOLO a los fetches. Las bindings/UI tienen que correr siempre
  que el DOM sea nuevo (post-swap), si no en re-entradas rápidas (<4s) los
  tabs/botones quedan muertos. Patrón:
  ```ts
  let lastBoundRoot: Element | null = null;
  function init() {
    const root = document.getElementById("panel-X");
    if (!root) return;
    if (root !== lastBoundRoot) {           // fresh DOM
      lastBoundRoot = root;
      bindEvents();                          // siempre re-corre
      activateTabUI(savedTab);               // UI restore
    }
    if (Date.now() - initLastAt < COOLDOWN) return;  // solo fetches
    initLastAt = Date.now();
    void loadX();
  }
  ```
  La equivalencia `root !== lastBoundRoot` detecta DOM nuevo sin doblar
  bindings en fires `page-load + after-swap` de la misma entrada (mismo
  root → skip). Ver `users`, `webhooks`, `backups`, `ssl`, `hosting`,
  `nginx` (split activateTab → activateTabUI + loadTabData) como
  referencia. `settings` usa un monkey-patch alternativo de
  addEventListener para evitar reescribir 26 bindings.
- **Flags `*Loaded`/`*Bound` persistentes**: distinguir SIEMPRE qué tipo de
  listener guardan:
  - Si guardan `window.addEventListener(...)`: SÍ persistir (window vive
    entre navs). Ej: `mailTableEventsBound`, `hostingEventsBound`.
  - Si guardan `document.getElementById(...).addEventListener(...)`: NO
    persistir — el DOM se reemplaza en cada swap. Quitar el guard (el
    cooldown del init dedupea) o resetear el flag al inicio de init().
  - Si guardan **dato cargado** en un tab (`*Loaded`): resetear en init
    para forzar re-fetch en re-entrada al módulo (alternativa: emptiness
    check del contenedor).
- Tras editar `.ts`: `node scripts/build-extracted.mjs` (rápido) y, si el
  módulo cambió contratos con el DataTable, `pnpm run build && pm2 restart
  luxipanel-frontend --update-env` (lento, recompila islas React).

## i18n — namespaces por módulo + caché en 3 capas

Las traducciones viven en `src/i18n/locales/<lang>.ts` (fuente única). El script
`scripts/i18n-split-namespaces.mjs` (hook `i18n:split`, corre en `prebuild`) las
parte **por namespace** (= un módulo: `mail`, `users`, …) y emite dos salidas:
- `src/i18n/namespaces/<lang>/<ns>.ts` — chunks que el SSR carga con
  `import.meta.glob` (code-splitting): cada página pide **solo sus namespaces**
  (`getMessages(locale, ['users'])`), nunca los 29 de golpe.
- `public/i18n/<hash>/<lang>/<ns>.json` + `manifest.json` — assets que el
  cliente (`src/i18n/client.ts`) hace `fetch` por namespace. `<hash>` es un
  **content-hash** (sha256 de los locales) → los namespaces son **inmutables**;
  solo `manifest.json` rota por deploy y apunta al hash vigente.

**Tres capas de caché complementarias (no las rompas al tocar i18n):**
1. **Nginx** (`install.sh`/`update.sh`, bloque `location /i18n/`) — sirve los
   JSON **directo desde `dist/client/i18n/`**, sin tocar el proceso Node, con
   `Cache-Control: immutable` (1 año) para los hasheados y TTL corto para el
   `manifest.json`. `try_files … @node_frontend` como fallback si el archivo no
   está en disco (i18n nunca rompe). `refresh_nginx_upstreams` **inyecta** este
   bloque en configs preexistentes de forma idempotente → basta `update.sh`.
2. **Service Worker** (`public/sw.js`) — `cache-first` para
   `/i18n/<hash>/**.json` (inmutables): tras la 1ª carga **0 red**, persiste
   entre sesiones y offline. `manifest.json` excluido (es el puntero mutable).
   Subir `SW_VERSION` al cambiar la estrategia.
3. **Middleware** (`src/middleware.ts`, `applyStaticCacheHeaders`) — mismos
   headers para el caso en que la petición SÍ llega a Node (fallback Nginx o
   dev sin Nginx). `/i18n/*` se intercepta **antes** del early-return genérico
   de assets, si no el header `immutable` no se aplicaría.

Invariante: un namespace nuevo entra cambiando solo `locales/<lang>.ts`; el
rebuild regenera chunks + JSON + hash. No edites a mano `namespaces/` ni
`public/i18n/` (son generados).

## Asistente IA — contrato de comunicación

El Asistente IA del panel se integra con el resto de módulos vía un **bus
único versionado** sobre `window`: `lxp:assistant:request` (v1). Detalles
completos en `frontend/src/components/floating-assistant/README.md` y
`frontend/src/lib/assistant-request.ts`.

### Pieza central

- `requestAssistant(input)` desde `frontend/src/lib/assistant-request.ts`.
- `AssistantRequest` es una **discriminated union** con dos `kind`:
  - `"prompt"` — entrega un prompt contextual al chat. Fija
    `target.agentId = null` y `projectId = null` (conversación **NORMAL**,
    no ligada a un agente personalizado). Campos: `prompt`, `submit`
    (`"auto"` envía, `"prefill"` deja el texto cargado sin enviar),
    `providerId?`, `origin`, `conversation:"new"`.
  - `"navigate"` — salta a una pestaña del Asistente (`tab` ∈
    `chat | market | agentes | providers | modules | stats | servers | access`).
  - **Agentes IA → Market** presenta los perfiles reutilizables y sus asignaciones
    al proyecto seleccionado. `ProjectModal` monta el mismo catálogo con su proyecto
    o subproyecto fijado. El alias `agentes` abre Market; un enlace con `agentId`
    abre exclusivamente el perfil global mediante `AgentProfileDialog`.
    Incorporar/configurar/retirar usa los endpoints de asignaciones y nunca mueve
    `teamId` global ni escribe `projectIds` desde el editor del perfil.
- FIFO cap 20 con dedupe por `requestId`. Versión del contrato: 1
  (`REQUEST_VERSION`). Reset del bus en `luxipanel:target-changed` para no
  arrastrar prompts entre servidores conectados.

### Callers ya migrados al bus v1

- **Files** — `scripts/extracted/pages/panel/files/index-script1.ts` (6
  acciones: `quickAsk`, `cleanup`, `validateFix`, `malwareAnalyze`,
  `createPlan`, `openWithAssistant`).
- **Mail** — `scripts/extracted/pages/panel/mail/index-script1.ts`
  (`depurarCuentaConIa`).
- **Obsidian** — `scripts/extracted/pages/panel/obsidian/index-script1.ts`
  (`analyzeWithAi`, `prepareAssistantContext`).
- **Module Dev** — `scripts/extracted/pages/panel/module-dev/index-script1.ts`
  (`createWithAssistant`, `openChatForModule`).
- **Expo** — `scripts/extracted/pages/panel/expo/index-script1.ts`
  (`startCreate`).
- **Cron** — `scripts/extracted/pages/panel/cron/index-script1.ts`
  (quickAsk desde el formulario AI).
- **Firewall** — pendiente de migración (los prompts siguen
  hardcodeados en TS y disparan `lxp:assistant:seed`).
- **Users** — pendiente de migración (`reviewUserActivity` en
  `users/index-script1.ts`).
- **Monitor** — pendiente de consolidación: el botón "Optimizar disco con IA"
  debería pasar al helper `requestAssistant({kind:"prompt", submit:"auto",
  conversation:"new", origin:{module:"monitor", action:"optimizeDisk"}})`.
- **Settings/Credentials** — usa `lxp:assistant:open` (legacy); migrar a
  `kind:"navigate"` cuando se toque.

### Política `submit` / `conversation`

- `submit: "auto"` → enviar inmediatamente (cron quickAsk, firewall AI,
  users activity, expo logs, monitor optimizeDisk).
- `submit: "prefill"` → dejar el prompt en el composer sin enviar (files,
  mail debug, obsidian analyze, module-dev createWithAssistant).
- `conversation` siempre es `"new"` para `kind:"prompt"` (fijo en el
  normalizador). Evita reusar un chat previo ligado a un agente.

### Cómo añadir un caller nuevo

1. Importar el helper:
   `import { requestAssistant } from "/scripts/extracted/lib/assistant-request.js?v=1"`
   (scripts extraídos) o
   `import { requestAssistant } from "@/lib/assistant-request"` (React/Astro).
2. Llamar con el `kind` adecuado (`"prompt"` o `"navigate"`).
3. **No tocar `scripts/build-extracted.mjs`** — el entry ya está registrado.
4. Localizar cualquier string visible en los 12 locales
   (`src/i18n/{ar,bn,de,en,es,fr,hi,it,ja,ko,pt,ru}/<ns>.ts`).
5. Para detalles completos (fail-closed del módulo ai-assistant, tests,
   extensión del contrato) ver
   `frontend/src/components/floating-assistant/README.md`.

## Super buscador (navbar) — catálogo SSOT + ranking local + fallback IA

El campo de búsqueda del topbar (`#cmd-trigger`, ancho completo, ⌘K/Ctrl+K)
abre el drawer derecho `#super-search` (un `<dialog>` más: `modal-drawer.css`
lo ancla a la derecha y `dialog-motion.ts` anima el cierre). Piezas:

- **`src/lib/search-catalog.ts`** — catálogo ÚNICO de destinos: vistas
  (`kind:"view"`), subpáginas, tabs de una vista, secciones de drawers y
  acciones. Cada entrada: `id` estable, `module` (ítem de sidebar que gobierna
  el permiso; `permission:"*"` = siempre), `label {en,es,…}` (+`navKey` para
  usar `panelLayout.nav.*` traducido), `parent` (ruta visual "Módulo › Tab"),
  `keywords` (sinónimos ES/EN sin acentos, con verbos típicos), `intents`
  (create/edit/configure/view/delete) y `target`. Se compila STANDALONE a
  `/scripts/extracted/lib/search-catalog.js`.
- **`src/scripts/extracted/layouts/super-search.ts`** — UI del drawer, ranking
  (normaliza sin acentos, tokeniza, detecta verbo de intención, puntúa exacta/
  prefijo/subcadena/fuzzy sobre label+keywords+ruta, agrupa por módulo),
  "recientes" (`localStorage lxp:super-search:recent`), fallback IA y ejecución
  del destino. Los módulos de comunidad instalados sin entrada llegan por
  `window.__lxp_cmd_items` (lo rellena `PanelLayout-define-vars-script1.ts`).
- **Ejecución del destino**: `target.href` (+`query`/`hash`) navega; si además
  hay `click`/`clickSeq` (selectores a clicar: tab, botón "nuevo", abrir modal
  → vista) o `event` (CustomEvent global, p.ej.
  `luxipanel:assistant-settings-open {section}`), la intención se guarda en
  `sessionStorage["lxp:search-intent"]` y este mismo script la consume en
  `astro:page-load` cuando el DOM objetivo existe (MutationObserver, 5 s).
  `target.action` ejecuta acciones del layout (tema, idioma, logout, selector
  de servidor, colapsar menú) sin navegar.
- **Fallback IA** (`POST /api/search/intent`, módulo backend `search`): solo
  cuando el ranking local es débil o ambiguo (debounce 350 ms, AbortController);
  el resultado se antepone marcado "Sugerido por IA". 503 (sin proveedor API) →
  el cliente deja de preguntar en la sesión. Gate: permiso `search`.
- **Config**: `PanelLayout.astro` emite `<script type="application/json"
  id="super-search-config">` con `locale`, `sidebarPermissions`, `isAdminUser`,
  `canAccessSettings`, `canAccessUsers` (mismo gating que el sidebar).
- **i18n**: textos en `panelLayout.superSearch.*` (12 locales).

### Cómo añadir una vista / tab / acción nueva al buscador

1. Añade la entrada en `search-catalog.ts` (en `VIEWS`, `TABS`,
   `ASSISTANT_SECTIONS` o `ACTIONS`). Para un tab usa `target: { href,
   click: '<selector del botón del tab>' }` (p.ej. `.tab-btn[data-tab="x"]`,
   `#tab-roles`, `[data-mail-main-tab="emails"]`); para un botón "nuevo"
   `clickSeq: ['<tab>', '#btn-new-x']`; para una sección de drawer React,
   `event` con el `CustomEvent` que ya la abre. Si la página soporta
   deep-link `?tab=` añade también `query`.
2. Pon `keywords` con sinónimos ES/EN **sin acentos** y los verbos que usaría
   el usuario; `intents` según lo que es.
3. `node scripts/build-extracted.mjs` (o `pnpm run build`) — el catálogo es un
   lib runtime; no hace falta tocar `super-search.ts`.
4. Si el elemento a clicar no tiene selector estable, dale un
   `data-search-target="…"` (así se hizo con "Nueva conversación" y "Nuevo
   proyecto" en `ChatSidebar.tsx`).

## Llamadas (Tolqia) — `components/messenger/call/**`

Audiollamadas con traducción en tiempo real dentro de `/panel/chat`. El motor es
**Tolqia** (producto independiente, `/var/www/tolqia`); el frontend solo consume
su SDK. **El navegador habla WebSocket DIRECTO con Tolqia**: el audio no pasa
por el proxy de Astro ni por el backend del panel.

```
/panel/chat (isla React)
  ├─ REST  /api/chat/... ──▶ backend ──S2S──▶ Tolqia   (crear sala, token, colgar)
  ├─ SSE   /api/chat/stream ◀── backend ◀─webhook─ Tolqia  (chat:call:ring|state|end)
  └─ WS    wsUrl (tal cual) ──────────────────────▶ Tolqia  (audio + subtítulos)
```

### Piezas

| Fichero | Papel |
|---|---|
| `lib/chat-call.ts` | Gemelo de `backend/src/shared/chat-call-types.ts`: `ChatCallView`, eventos SSE, `system.kind==="call"` + helpers puros (`parseChatCallEvent`, `asCallSystem`, `formatCallDuration`). |
| `messenger/call/call-api.ts` | Cliente REST sobre el `api` canónico. Nunca lanza: degrada a `null`. |
| `messenger/call/call-prefs.ts` | Proyección de `chat-prefs.calls` → opciones del SDK, política de tono/DND, badge de idioma. |
| `messenger/call/ChatCallHost.tsx` | **El ÚNICO sitio que importa `@tolqia/react`.** `CallProvider` + `CallOverlay`/`CallPill` + `IncomingCallBanner`, con los tokens de diseño del panel y el namespace `chat.call.*`. |
| `scripts/extracted/layouts/chat.ts` | Banner GLOBAL de llamada entrante (fuera de `/panel/chat`) + tono `OscillatorNode`. |

### Reglas

- **El SDK no trae CSS ni i18n**: cada componente recibe `className` por slot y
  un objeto `labels`. Toda esa traducción vive en `ChatCallHost.tsx`; añadir un
  botón de llamada en otro sitio significa pasarlo desde ahí, nunca volver a
  importar `@tolqia/react`.
- **`wsUrl` se abre TAL CUAL.** Viene de `POST /v1/calls/tokens` con el token y
  el prefijo público ya incrustados (`/tolqia`, o `/__luxipanel/tolqia` en el
  montaje LP). Componerlo a mano rompe cualquier montaje que no sea el default.
- **`CallProvider options` va memoizado por `wsUrl`.** Un cambio de identidad
  del objeto destruye el cliente — y con él el micrófono.
- **Un solo banner.** La isla marca `documentElement.dataset.lxpCallUi="react"`
  al montar; `chat.ts` no pinta el suyo mientras ese flag esté puesto. Dos
  banners serían la única forma de que Aceptar y Rechazar se contradigan.
- **`Permissions-Policy: microphone=(self)`** en `middleware.ts` — sin eso
  `getUserMedia` falla en silencio. Nginx debe mandar la misma cabecera.
- **Guard de soporte**: `callsSupported()` (`isSupported()` del SDK, cacheado)
  deja el botón "Llamar" deshabilitado con un tooltip que explica por qué, en
  vez de dejarlo clicable y que no pase nada (WebViews sin `AudioWorklet`).
- **Nunca un login en pantalla**: los avatares y los nombres salen de
  `displayNames` (el mapa compartido del messenger) o del `displayName` que trae
  el `ChatCallView`; el `participantId` solo sirve para identificar "yo".
- **Deps del SDK**: tarballs `file:` en `package.json` (no `link:`/`workspace:`,
  que meterían symlinks fuera del root en Vite). Sus `workspace:*` internos se
  redirigen con `overrides` en `pnpm-workspace.yaml`. Al subir de versión hay
  que tocar los dos sitios y reinstalar.

## Reglas

- Astro `output: server`; React solo en islas interactivas.

- Toda red al backend pasa por el proxy `pages/api/[...path].ts` (salvo WS).
- Nueva feature de panel → carpeta en `pages/panel/<feature>/` alineada con
  el módulo backend homónimo + script extraído con el patrón canónico de
  arriba.
- Cambios de autenticación, sesión SSH o clave de cuenta → revisar backend y los contratos vigentes de LP-LICENSE-SERVER/INFRA_LUXIPANEL.md.
- E2E Playwright (`e2e/`). i18n en `lib/i18n` + `lib/locales.ts`.
- El hook `predev` es PowerShell (inocuo en Linux). pnpm v11:
  `pnpm-workspace.yaml`.


### Voz en tiempo real en el chat (2026-10-15)
`VoiceSettings` activa el modo en el botón de audio existente de `PromptBar`. `useRealtimeVoice` inicia directamente con el micrófono del chat, sin selector adicional de proyectos/equipos ni confirmación intermedia. El backend obtiene el proyecto de la conversación; transcripción y tareas siguen dentro del chat. Web y escritorio Electron comparten esta implementación WebRTC. Los permisos del micrófono se solicitan al iniciar explícitamente.
Una nota en grabación/transcripción/envío y una sesión en conexión/activa/silenciada bloquean Enter, envío y cola textual. El bloqueo también se comprueba en las acciones y el motor; borrador y adjuntos preparados se conservan separados del audio. Terminar la voz libera la entrada; no cancela tareas. Las aprobaciones permanecen como botones con el detalle de la solicitud. Una sesión anterior se consulta antes de crear otra; su cierre debe confirmarse.

### Voz general y limpieza del clic (2026-10-15)
El micrófono de tiempo real funciona también en chats sin proyecto; el contexto y los permisos se resuelven en el backend, sin selectores adicionales. La marca decorativa de clic vive en `lib/click-sparks.ts`: su borrado tiene un plazo independiente de requestAnimationFrame, se limpia al perder foco/ocultar la pestaña o navegar, y la instalación evita listeners duplicados. El script extraído de PanelLayout cambia de versión de caché. Verificación: voz general WebRTC/PCM, delegación y botones con proveedor simulado; prueba en Chromium de píxeles del clic tras detener frames y del bloqueo de envío de texto.

### Voz integrada en el historial (2026-10-15)
Se retiró el panel independiente de voz de todos los chats. El botón existente del compositor indica conexión/voz/cierre; su menú de audio permite silenciar y los errores aparecen como avisos breves. Las transcripciones se refrescan en el historial normal después de persistirse, sin llamar a openConversation ni cambiar de hilo. Las tareas usan TeamTaskBoard; las solicitudes del trabajador se muestran en el historial con botones y conservan su destino aun después de cerrar el micrófono.
La sesión se vincula al target y al chat de origen. Navegar también hacia un chat nuevo cancela la captura y descarta respuestas tardías. La creación inicial adopta su identificador sin cancelar la sesión; una respuesta de creación que llega después de navegar no puede abrir el chat anterior. La limpieza local nunca envía el id de una sesión a otro target.

### Limpieza del efecto de clic con zoom reducido (2026-10-15)
La limpieza anterior usaba las dimensiones físicas del canvas mientras seguía activo el transform de devicePixelRatio. Con DPR inferior a 1 no borraba la franja inferior/derecha: los píxeles reaparecían al siguiente clic. click-sparks.ts borra ahora con transform identidad y restaura la escala de dibujo tanto en cada frame como al vencer el plazo. La regla [hidden] fuerza ocultar la capa y PanelLayout carga reactbits-kit con una nueva versión de caché. La regresión cubre DPR 0.5, 0.75, 1, 1.25 y 2, además de navegación, pérdida de foco y frames detenidos.


### Selector de agente e historial por proyecto (2026-10-16)
La barra de mensajes (`ChatMain` / `PromptBar`) ofrece los miembros efectivos ejecutables del proyecto seleccionado con el formato `[Puesto] Nombre`, usando cargo/rol contextual cuando existe. Seleccionar un miembro inicia un chat nuevo con su proveedor/configuración, conserva el proyecto o subproyecto y el borrador sin enviar (incluidos adjuntos en memoria), y filtra el historial por ese agente. La opción «Todos los agentes» conserva su etiqueta, inicia un chat sin agente y muestra únicamente conversaciones sin agente asignado. Abrir una conversación existente conserva su agente y contexto; los botones de nuevo chat del lateral verifican la pertenencia y capacidad en el proyecto de destino antes de conservar el miembro seleccionado.
`ChatSidebar` conserva `SelectedProjectConvos`: carpetas de subproyectos y conversaciones anidadas, sin desplegables por agente. `project-history` aplica proyecto, agente y búsqueda a todos los cursores y contadores, en todos los proveedores; sin miembro seleccionado envía `withAgent=false`, también dentro de proyectos. Con un filtro, solo aparecen ramas con coincidencias (también las pendientes de paginar); sin filtro se conserva el árbol completo. Los buzones antiguos sin proyecto solo se muestran para el agente seleccionado bajo la única raíz propietaria del equipo, sin modificar los datos guardados. Un cambio de servidor, sesión, equipo o filtro invalida resultados y respuestas pendientes; tampoco se reinsertan metadatos de un chat abierto fuera del ámbito.
`TurnView` conserva las tareas, identidad y aprobaciones del chat. Las herramientas API comparten una única consola plegada, con el mismo bloque compacto de progreso que las ejecuciones CLI. Mientras trabaja, los mensajes públicos de avance se muestran en `ThoughtLine`; al terminar se conserva la respuesta completa. Los detalles de herramientas y avisos automáticos se pueden desplegar, y los errores y permisos siguen accesibles. La etiqueta API/CLI refleja el modo real de ejecución. Las herramientas anidadas de una consola CLI no se duplican. La misma vista se utiliza en el chat principal y en el asistente flotante.

`PromptBar` prioriza Parar mientras una respuesta está en curso, aunque la voz en tiempo real esté habilitada e inactiva y el borrador esté vacío. `ChatMain` incluye las ejecuciones que siguen en el servidor en el estado ocupado del compositor. Una sesión de voz activa conserva su control de cierre.

### Selector de ramas en Versiones (2026-10-16)
`CommunityActivity` conserva el drawer de versiones e incorpora un selector de rama. `BranchChanges` muestra la revisión seleccionada, la instalada y el historial; cambiar de rama solo consulta. El botón de actualización manual envía el SHA visible mediante `ReleaseBanner`, que descarta respuestas de targets anteriores y bloquea envíos repetidos. Las ramas que solo contienen un componente no ofrecen instalación del panel.
Cada intento consulta el preflight sin caché. `ReleaseBanner` diferencia tareas activas, aportes pendientes de envío, cambios que necesitan revisión y sincronización del checkout, con mensajes en los doce idiomas; conserva la posibilidad de reintentar y descarta respuestas de un target anterior.
Abrir el drawer y actualizar una rama renueva el catálogo sin caché de navegador ni de cabeceras de GitHub. Si cambió el SHA, se muestran las nuevas notas y el siguiente clic utiliza esa revisión; nunca se instala automáticamente una revisión que no se mostró. Un conflicto `RELEASE_BRANCH_CHANGED` entre la comprobación y el envío también renueva las notas. Las lecturas periódicas no reemplazan una consulta explícita pendiente y sus respuestas tardías se descartan.
El badge verde indica una versión publicada; amarillo identifica cambios de `developer`; las demás ramas tienen colores propios y una leyenda accesible desde el icono de ayuda del header. Los avisos enlazan a `/panel?updates=<rama>` y al evento permitido `luxipanel:releases-open`, con confirmación de recepción para abrir directamente el drawer en la página actual; abrirlos selecciona la rama sin instalarla. Los textos se mantienen en los doce locales. Las verificaciones visuales usan el componente real con API simulada, sin publicar ni activar una versión en producción.

### Paridad del chat con agente (2026-10-16)
`ChatMain` comparte la bienvenida y las sugerencias del chat general con los chats de agente. El agente sustituye la marca central por su avatar; se elimina la franja redundante superior y se conservan el selector, el chip del compositor y el tablero incrustado en `TurnView`.

### Accesos a agentes del proyecto (2026-10-17)
La bienvenida de proyecto sin agente ni conversación abierta sustituye las sugerencias por `ProjectAgentShortcuts` y comparte su acción con el selector de `PromptBar`: conserva borrador, adjuntos y subproyecto, también al cambiar de proveedor. Al elegir un agente, la cuadrícula se oculta y vuelve la bienvenida habitual con avatar y sugerencias; al abrir un chat se muestra su historial. Volver a «Todos los agentes» recupera los accesos. La cuadrícula muestra todos los miembros del equipo en móvil.
`useAgentShortcutActivity` consulta una proyección compacta del historial de todos los agentes del proyecto raíz y sus hijos, independiente de la paginación y del agente seleccionado. Incluye buzones antiguos solo cuando el equipo pertenece a una única raíz, igual que el historial. Renueva cada diez segundos mientras las tarjetas están visibles, al recuperar foco y al marcar conversaciones leídas; descarta respuestas de proyectos, usuarios y targets anteriores. Si falla la consulta muestra estado no disponible, sin afirmar que los agentes están libres. `unreadCount` cuenta respuestas persistidas, excluye resúmenes de mantenimiento y se limpia en `markReviewed`; el indicador anterior se interpreta como una respuesta conocida pendiente en historiales sin contador. Marcar como leído emite `lxp:assistant:conversation-reviewed`, que actualiza los contadores sin invalidar la lectura del historial que se está abriendo. Los estados activos usan el registro del target y el motor local. Verificación visual reproducible: `scripts/qa-agent-shortcuts.mjs`, con la vista real y datos simulados; `?history=1` incluye la lista de chats y retrasa sus mensajes para reproducir la carrera con el aviso de lectura.

### Market contextual de agentes (2026-10-17)
`AgentMarket` consume el contrato v1 de `../backend/src/modules/ai-assistant/docs/agent-market-contract.md`: `GET /api/ai/agents?contextProjectId=P` devuelve el catálogo completo con pertenencia y capacidades para P; `?projectId=P` devuelve solo miembros efectivos. La búsqueda local incluye nombre, descripción, especialidad y tecnologías; los filtros combinan proveedor, rol efectivo y pertenencia. Las acciones se habilitan por `capabilities`, sin deducir permisos por `relation`, `teamId` o el primer elemento de `projectIds`.
`AgentAssignmentEditor` envía únicamente campos modificados a `PUT /agents/:id/assignments/:projectId`, con null para heredar y listas vacías para ninguna concesión. El perfil global tiene un editor separado. PUT/DELETE son síncronos (200, sin jobs): se espera su confirmación, se emite `lxp:assistant:agents-updated` y se recarga el catálogo. La retirada requiere confirmación y conserva perfil e historial. Una respuesta de resultado desconocido bloquea repetir la acción hasta revisar el catálogo; target, sesión y permisos invalidan formularios y respuestas pendientes.
El selector distingue agentes disponibles de históricos y deja estos últimos en lectura. Mientras no se confirma el catálogo se bloquean nuevos envíos del agente, con error/reintento si falla la lectura. Un chat persistido conserva su proyecto, incluido null; ninguna elección visual lo reasigna. La compatibilidad de historial legado por equipo se limita a presentación: la actividad consulta sus agentes propietarios por separado y deduplica conversaciones, evitando sumar buzones libres de perfiles compartidos con otras raíces.

### Razonamiento Max en Codex (2026-10-16)
Los ajustes generales y el compositor de Codex admiten `max` como nivel independiente de `xhigh` (Extra). La normalización, los metadatos del chat y los envíos inmediatos o en cola conservan el valor exacto. No se modifica la elección guardada en conversaciones anteriores.

### Scroll continuo de Files

La tabla y cuadrícula de `FilesWorkspace` cargan bloques de 50 entradas mediante
`/api/files/list` al acercarse al final de su contenedor. `file-pages.ts` conserva
las filas cargadas al añadir otro bloque o reintentar un fallo y descarta respuestas
de otra carpeta, target, pestaña, orden o filtro. `listing.ts` añade nodos sin
reemplazar los anteriores, conserva la selección y llena automáticamente vistas
altas; elimina listeners al cerrar el módulo. La tabla declara `data-infinite-files`
para excluirse del paginador de tablas heredadas. Orden y ocultos se aplican en el
servidor antes de dividir el directorio; los resultados de búsqueda ya recibidos
se incorporan por bloques al mismo scroll.
