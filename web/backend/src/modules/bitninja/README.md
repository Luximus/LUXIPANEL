# Módulo `bitninja`

Gestiona el agente comercial de protección **BitNinja** (WAF, anti-DoS,
malware, reputación IP) en el servidor conectado: instalación con la clave de
licencia del cliente, estado runtime, control del servicio y toggles de
componentes. Todo corre por el `Executor` (nunca el host del panel).

## Endpoints (todos tras `requireAuth` + `requireModule("bitninja")`; mutaciones con CSRF)

| Método | Ruta | Qué hace |
|---|---|---|
| GET    | `/api/bitninja/status` | instalado / running / licencia / versión / componentes |
| GET    | `/api/bitninja/config` | clave de licencia enmascarada (Credenciales) |
| PUT    | `/api/bitninja/config` | guardar la clave de licencia |
| DELETE | `/api/bitninja/config` | borrar la clave |
| POST   | `/api/bitninja/packages` | instalar (nombre `packages` evita falsos positivos del WAF de Cloudflare con "install") |
| POST   | `/api/bitninja/license` | (re)activar licencia en un agente instalado |
| POST   | `/api/bitninja/service` | start / stop / restart |
| POST   | `/api/bitninja/components` | habilitar/deshabilitar un componente |

## Capas

- **`models/bitninja.model`** — `BitNinjaStatus`, `BitNinjaComponent`,
  `BitNinjaActionResult`, `ServiceAction`.
- **`services/bitninja.service`** — envuelve `bitninjacli` + la unidad systemd.
  `parseModules` defensivo (JSON array u objeto, con fallback a parser de texto
  que exige separador `:`/tab). Acciones privilegiadas por `sudoShell`. **Gate
  de seguridad:** `isSafeToken` rechaza claves/componentes con metacaracteres de
  shell ANTES de ejecutar sudo (se interpolan en un argumento single-quoted).
  El instalador se descarga a un temp y se corre con sudo (evita la trampa
  `curl | sudo bash` colisionando en stdin con `sudo -S`).
- **`services/bitninja-config.service`** — clave de licencia en `panel_settings`
  (categoría `bitninja`) vía el `settingsRepository` compartido; solo se
  devuelve enmascarada, el raw se consume server-side y nunca viaja al browser.
- **`controllers`** — Zod + `ValidationError` tipado; `getExecutor(req)`.

## Agent-capability

`bitninja.*` registrada (ver `agent-capability.ts`).

## Anatomía

- **Sin `repositories/` propio**: la única persistencia es la clave de licencia,
  que reusa el `settingsRepository` de `admin/` (patrón compartido con
  Cloudflare/OpenClaw). Un repo propio duplicaría sin aportar.
- **Deuda pendiente (Wave E, FRONTEND):** XSS en la vista `/panel/bitninja`
  (render del output crudo del agente, aprox. L109-110 del script del módulo).
  Fuera de alcance de este refactor de backend; anotado aquí para no perderlo.
