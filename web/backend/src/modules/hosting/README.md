# Módulo `hosting` — tenants anidados (estilo cPanel/WHM) sobre un VPS

## API para gestores de hosting

El contrato versionado de proveedores está en [PROVIDER_API.md](./PROVIDER_API.md).
LUXIPANEL emite credenciales `lhp_…` desde la configuración de HOSTING y el
gestor externo llama directamente a `/api/hosting/v1`. Las claves genéricas
`lxp_…` de Webhooks ya no autorizan las rutas administrativas de HOSTING.
El proveedor se fija a un servidor; las llamadas M2M no dependen de una
sesión de navegador. Luxisoft es el primer consumidor, sin privilegios
especiales respecto a otros gestores.

Permite que el **admin de un VPS** (o un reseller) cree **cuentas hosting** para
usuarios. Cada cuenta vive en el **mismo VPS** que las demás, pero su entorno se
presenta como si fuera **su propio VPS**, limitado a los permisos del **grupo
Linux** que define el envelope de la cuenta. Cada cuenta tiene además su propio
conjunto **independiente** de usuarios/grupos (gestión tipo "Usuarios" propia).

> Jerarquía: **Admin VPS → cuentas hosting → sub-usuarios** (2 niveles).

## Principio de diseño (NO es un realm de auth paralelo)

La versión vieja tenía auth bcrypt propio + tabla Drizzle + `tenant_id` por FK,
todo desconectado del modelo real del panel (y el módulo **ni siquiera estaba
montado** en `server.ts`). Eso se descartó. Ahora una cuenta hosting es un
**envelope fino sobre la maquinaria Linux-usuario/grupo/permiso que ya existe**:

| Pieza del modelo | Qué es en el VPS |
|---|---|
| `username` | usuario Linux **primario** (dueño de la cuenta) |
| `tenantGroup` (`h-<username>`) | grupo Linux dedicado; **todos los sub-usuarios** del tenant pertenecen a él → heredan el envelope por el camino normal grupo → role-record → permisos |
| `homeRoot` (`/home/<username>`) | raíz del tenant ("su VPS"); el template de permisos limita el acceso a archivos a este subárbol |
| `allowedModules` + `permissionTemplate` | el **envelope máximo** (módulos visibles + permisos), espejado como el **role record `tenantGroup`** en `users/roles.json` |

- **Sin DB.** Persistencia = sidecar JSON por servidor vía `dataStore`
  (`${LUXIPANEL_CONFIG_DIR}/hosting/accounts.json`). No hay tabla ni migración SQL.
- **Aprovisionamiento real en el VPS** al crear una cuenta:
  1. `rolesService.create(tenantGroup, permissionTemplate)` → crea el grupo Linux
     + su role record (envelope).
  2. job write-behind → `useradd` del dueño, `gpasswd -a` al `tenantGroup`, y
     blindaje del home (`chown owner:tenantGroup`, `chmod 750`).
- **Aislamiento (decisión):** chroot/jailshell real (Fase 5). En la fundación el
  límite es por permisos + path-scope (`fileAccess.allowPaths = [homeRoot]`).

## Login (decisión)

Los usuarios hosting entran por **`/login` con contraseña, NO por SSH**. La
contraseña de `/login` se valida contra el hash bcrypt del sidecar del tenant
(`passwordHash`) — **no es una passphrase SSH**. Las operaciones de su sesión se
ejecutan en el VPS con una **conexión de servicio + `sudo -u <owner>`**
(privilege-drop), de modo que respetan los permisos del grupo a nivel OS. *(El
cableado de `/login` + el executor con drop de privilegios es Fase 2.)*

## Estado por fases

- **Fase 1 — HECHA (fundación):** módulo cableado en `server.ts`; Drizzle/SQL
  descartados; modelo con envelope en kv-store; aprovisionamiento de
  grupo+role+usuario Linux+home vía `rolesService`/`systemAccountsService` +
  cola write-behind; listado real (antes listaba vhosts de nginx); este README.
- **Fase 2 — PENDIENTE:** `/login` por contraseña + Executor de servicio con
  `sudo -u <owner>`; derivación de módulos/permisos desde el envelope en el token.
- **Fase 3 — PENDIENTE:** módulo Usuarios **tenant-scoped** (cada cuenta gestiona
  SUS usuarios/grupos, clamp-eados al envelope).
- **Fase 4 — frontend HECHO ✅ (A4); backend RETIRADO (dead code, YAGNI):** la
  visibilidad del sidebar ya la clampa el frontend por `user.modules`
  (= `allowedModules`, metido en el JWT por `auth.service.loginHosting`) + gating
  de widgets del dashboard. Se había entregado un guard server-side
  `requireModuleForSession(moduleId)` "listo para montar" pero **ningún router
  llegó a montarlo** (0 usos en rutas; solo un re-export en `index.ts` y su
  test). Al ser código muerto sin adoptante se **eliminó** el middleware
  (`middlewares/require-module-session.middleware.ts`) y su re-export/test. Si en
  el futuro se necesita el enforcement de módulos por-sesión en el backend, se
  reintroduce el guard en el punto donde de verdad se monte.
  - **Frontend (A4):** selector `allowedModules` del modal se puebla desde
    `GET /api/modules/installed` (`index-script1.ts#loadModuleCatalog`,
    respetando `HOSTING_MODULE_DENYLIST`); 9 claves i18n de modal faltantes
    añadidas a los 12 locales; bloque `#f-envelope-readonly` (tenantGroup +
    homeRoot, solo lectura) cableado en `openEdit`; **gating de widgets del
    dashboard** para `kind:"hosting"` en `pages/panel/index.astro` (script
    inline + `MutationObserver` que poda `<a.dash-widget[data-module]>` ausentes
    de `user.modules`; admin/user intactos) — defensa en profundidad sobre el
    gate server-side de `/api/dashboard/widgets`.
  - **⏳ PENDIENTE documentado:** Identidad "su propio VPS": el
    subdominio→VPS ya existe (`extractSubdomainFromHost` en `loginHosting`); la
    sesión aterriza en `/panel/dashboard` con el sidebar clampado. **⏳
    PENDIENTE:** branding por-tenant (hoy el branding es por-instalación/host
    del panel; sin método on-box por-tenant aún).
- **Fase 5 — HECHA ✅ (A2):** chroot/jailshell real (jailkit) para
  shells/terminal. `services/jail.service.ts:82` (`hostingJailService`:
  `isJailkitAvailable:88`, `provisionJail:116`, `teardownJail:156`,
  `jailStatus:170`) con degradación accionable fail-soft; endpoints de
  provisión/desmonte/estado (`routes/jail.routes.ts:25-27`,
  `controllers/jail.controller.ts`); el Terminal del panel respeta la jaula
  fail-closed para sesiones `kind:"hosting"` (`terminal.controller.ts:214`). Ver
  §Fase 5 abajo.
- **Fase 6 — cuotas + auditoría HECHA ✅ (A1 auditoría + A3 cuotas):**
  - **Auditoría HECHA ✅ (A1):** sidecar per-server `hosting/audit-log.json`
    (`repositories/audit.repository.ts` → `hostingAuditRepository`,
    `idStrategy:"uuid"`; modelo en `models/audit.model.ts`). Eventos del ciclo
    de vida emitidos desde `hosting.service` vía el helper interno `audit()`
    (`services/hosting.service.ts:144`, best-effort try/catch que nunca rompe la
    operación): `ACCOUNT_CREATED`(info, `:247`), `ACCOUNT_UPDATED`(info+changed,
    `:457`), `PASSWORD_CHANGED`(warning, `:477`), `ACCOUNT_SUSPENDED`(warning,
    `:490`), `ACCOUNT_UNSUSPENDED`(info, `:504`), `ACCOUNT_TERMINATED`(critical,
    `:540`, emitido ANTES del delete del registro porque el audit-log es
    colección aparte y sobrevive) + `QUOTA_EXCEEDED` (emitido por el checker de
    A3). `HOSTING_LOGIN` lo registra `auth.service` (no se duplica). El reseller
    lee la auditoría de SUS cuentas vía `GET /api/hosting/accounts/:id/audit`
    (`hosting.controller.ts:241`; admin ve cualquiera, sesión hosting solo su
    propio `account.id`) — `hostingService.getAudit` (`hosting.service.ts:571`)
    NO exige que la cuenta exista, así el historial de terminadas sigue visible
    — y el asistente vía la tool `hosting.list_audit`
    (`agent-capability.ts:63`).
  - **Cuotas HECHA ✅ (A3):** enforcement preventivo de
    dominios/mail/db/sub-usuarios + disco best-effort (`du`/quota-tools)
    reflejado en `/stats`. Helper compartido
    `shared/quota/quota-checker.ts`: `readTenantUsage:236` (alimenta `/stats`,
    fail-OPEN en medición → 0 + warning ≥85% near-cap), `checkDiskUsageMb:86`
    (`repquota` → `du` fallback, `quotaMethod`), `countTenant*` (Domains/Emails/
    Databases/SubUsers), `assertResourceQuota:310` (única vía que LANZA: HTTP
    402 `QuotaExceededError` — `shared/errors/errors.ts:88` — + emite
    `QUOTA_EXCEEDED` a la auditoría; caps `Infinity` nunca lanzan). El enforcement
    en los *create* de las **sesiones hosting** (nginx/mail/databases) lo hace la
    familia basada en el envelope/JWT
    `assertWithinDomainQuota`/`assertWithinEmailQuota`/`assertWithinDatabaseQuota`
    (`services/tenant-scope.ts`), ya cableada en esos controladores (WIP paralela
    respetada, no reescrita). `assertResourceQuota` es la superficie
    **admin/agente** equivalente sobre una `HostingAccount` real. `/stats`
    (`hosting.controller.ts:187`, scope-check propio) y la tool
    `hosting.account_stats` (`agent-capability.ts:94`) usan `readTenantUsage`.
    **⏳ PENDIENTE:** banda fiable (`bandwidthUsedMb:0` fijo — no hay método
    on-box sin `tc`/iptables accounting).

## API administrativa anterior (solo sesión admin)

```
POST   /api/hosting/accounts                      crear cuenta (+ aprovisiona VPS)
GET    /api/hosting/accounts                       listar (paginado, búsqueda, estado)
GET    /api/hosting/accounts/:id                   detalle
PUT    /api/hosting/accounts/:id                   actualizar envelope/cuotas
DELETE /api/hosting/accounts/:id                   terminar (userdel -rf + groupdel + role)
POST   /api/hosting/accounts/:id/suspend           usermod -L + status
POST   /api/hosting/accounts/:id/unsuspend         usermod -U + status
POST   /api/hosting/accounts/:id/change-password   chpasswd + hash de panel
GET    /api/hosting/accounts/:id/stats             cuotas + uso de disco (du)
GET    /api/hosting/accounts/:id/audit             auditoría del ciclo del tenant
POST   /api/hosting/accounts/:id/jail              provisiona/reaprovisiona el chroot (Fase 5)
DELETE /api/hosting/accounts/:id/jail              desmonta el chroot (Fase 5)
GET    /api/hosting/accounts/:id/jail              estado del chroot (Fase 5)
```

`GET …/:id/audit` **y** `GET …/:id/stats` (Fase 6) son **self-service**:
admin/API-key ve cualquiera; una sesión `kind:"hosting"` ve SOLO su propio
`account.id`. Ambas se registran con `optionalAuth` **ANTES** del
`requireAdminOrApiKey` general (que rechazaría una sesión hosting con 401) y
hacen su propio scope-check (`assertCanReadAccount`) —
`routes/hosting.routes.ts:38-44`. Query `?limit` (1–100, default 50); respuesta
audit `{ ok, data: AuditEntry[], total }`. Los endpoints `/jail` (Fase 5) van en
su **router propio** (`routes/jail.routes.ts`, montado en `index.ts:24`) tras
`requireAdminOrApiKey` (admin/API-key only).

**Tools del asistente** (`agent-capability.ts`): `hosting.list_accounts`,
`hosting.list_audit` (`:63`), `hosting.account_stats` (`:94`) — las 3 con prefijo
`hosting.` obligatorio (sin él, `register()` lanza → crash-loop).

Auth de cuenta (público): `POST /api/hosting/auth/{login,logout}` (Fase 2 lo
integra en `/login`).

## Notas / deudas

- El alta vía **API-key sin sesión** necesita un executor de target resuelto
  (hoy el camino sólido es **sesión admin**, que ya fija el executor por-request).
  Resolver en Fase 2 junto al executor de servicio.
- `tenantGroup` usa el prefijo `h-`; el módulo Usuarios tenant-scoped (Fase 3)
  filtra miembros del tenant por este grupo.
- Cambios de auth/permisos/grupos → revisar contrato con el módulo `users`
  (`systemAccountsService`, `rolesService`) y `auth` (`role-permissions`).

## Fase 3 — `services/tenant-scope.ts` (acotar el módulo Usuarios al tenant)

Helper central y ÚNICO punto que conoce el envelope del tenant y todas las
reglas de clamp. Lo consumen `users.service`, `users.controller`,
`roles.service` y `roles.controller`, SIEMPRE gateado por `isHostingSession()`
(para `kind:"admin"|"user"` el camino legacy corre intacto).

- **Envelope desde el JWT, no del sidecar.** El owner *privilege-dropped* no
  puede leer `/etc/luxipanel` (0600 root), así que `loginHosting`
  (`auth.service`) ahora mete `owner / tenantGroup / homeRoot / maxSubUsers` en
  el token (`TokenPayload` + `SessionUser`). `getTenantEnvelope(session)` los
  lee y **falla cerrado** (`ForbiddenError`) si el token es pre-Fase 3.
- **La seguridad es 100% server-side ANTES de construir los steps.** Las
  mutaciones se aplican por el worker on-box con SU sudo (no re-valida); por eso
  groups/home/módulos/permisos se *clampan* aquí antes de `submitMutation`.
- Reglas: `list` filtra a miembros del tenant (grupo `h-<owner>` o home bajo
  `homeRoot`); `create` fuerza home `homeRoot/<sub>` + grupo primario =
  `tenantGroup`, clampa grupos a `{tenantGroup, h-<owner>-*}` y módulos a
  `allowedModules`, y respeta `maxSubUsers`; `update`/`delete` exigen miembro del
  tenant y nunca el owner ni nombres de sistema; los grupos tenant-local
  (`h-<owner>-*`) llevan permisos *clampados* (`⊆ template`, `fileAccess ⊆
  homeRoot`, sin `allowAll`), nunca el grupo `admin` ni el `tenantGroup` raíz.
- **Gate de ruta:** `users.routes` usaba `requireModule("admin")` (que exige
  `kind:"admin"`); ahora un `requireUsersAccess` aditivo deja pasar también una
  sesión hosting con `"users"` en `allowedModules` (los `requireView/Action`
  por-ruta siguen aplicando los permisos granulares del token).

## Fase 5 — chroot/jailshell real (jailkit) para shells/terminal

La receta de aprovisionamiento del jail **ya existe** y **no se duplica**:
`systemAccountsService.buildJailSetupSteps` (`jk_init` perfiles
`basicshell/netutils/extendedshell` + `jk_cp` de un perfil mínimo
`JAIL_BASE_BINARIES` + extras por módulo `JAIL_MODULE_BINARIES` + `mount proc`
hidepid=2 con `gid=<tenantGroup>` + `jk_jailuser -m`). `hosting.service` ya la
invoca en create/update/terminate. La Fase 5 añade:

- **`services/jail.service.ts` (`hostingJailService`):**
  - `isJailkitAvailable(executor)` — `command -v jk_init` (respaldo: binario
    ejecutable junto a `JAIL_TOOL_PATH`).
  - `provisionJail(account, executor)` — idempotente, por la cola write-behind
    (helper local `applyTenantSteps`, copiado de `hosting.service` para evitar el
    ciclo de imports). **Degradación accionable (fail-soft, NO lanza):**
    `JAIL_SHELL_ENABLED=false` o jailkit ausente → `{jailed:false, degraded:true,
    reason}` + notificación al admin (`notifications`), sin romper nada.
  - `teardownJail(account, executor)` — revierte el login shell a `/bin/bash` +
    `umount` del `/proc` del jail (idempotente).
  - `jailStatus(account, executor)` — `{jailEnabled, jailedAt, jailkitAvailable}`.
- **Endpoints** (`controllers/jail.controller.ts` + `routes/jail.routes.ts`,
  router propio montado en `index.ts` — separado del controller/routes
  principales para no colisionar con ediciones paralelas): `POST` (provisiona +
  persiste `jailedAt`), `DELETE` (desmonta + limpia `jailEnabled/jailedAt`),
  `GET` (estado). `POST` degradado responde **200** `{jailed:false,
  degraded:true, reason}` (no error).
- **Terminal fail-closed** (`modules/terminal/controllers/terminal.controller.ts:214`):
  para `kind:"hosting"`, ANTES de abrir la PTY:
  1. el executor DEBE ser `PrivilegeDropExecutor` (privilege-drop del owner); si
     cayó a `localExecutor` (host del panel) o a un `DirectSsh` crudo (usuario de
     servicio) → `ws.close(1008)` (jamás una shell sin drop);
  2. si la jaula está **prevista** se verifica que el login shell del owner sea
     `JAIL_TOOL_PATH` (jk_chrootsh, default `/usr/sbin/jk_chrootsh`) vía
     `getent passwd "$(id -un)"`; si no coincide (jaula no aprovisionada) →
     `ws.close(1008)` con mensaje accionable. **`jailExpected` lo decide
     `HOSTING_TERMINAL_REQUIRE_JAIL`** (env, `config/env.ts:181`, **default
     `true`** = frontera de aislamiento del producto): por defecto EXIGE jaula a
     toda sesión hosting con independencia del opt-in por cuenta
     (`token.jailEnabled`) o de `JAIL_SHELL_ENABLED`. Solo si se pone en `false`
     cae al opt-in heredado (`token.jailEnabled ?? JAIL_SHELL_ENABLED`) y, si
     concede una shell hosting SIN jaula, lo **audita** (WARN accionable).
  El spawn enjaulado en sí lo hace `PrivilegeDropExecutor.spawn` (`sudo -u owner
  -i` → la login shell jk_chrootsh hace `chroot(homeRoot)`); el Terminal no lo
  duplica, solo hace cumplir los invariantes verificables.
- **Token:** `loginHosting` propaga `jailEnabled` al JWT (`TokenPayload` +
  `SessionUser`), aditivo y opcional (tokens viejos → el Terminal cae a
  `JAIL_SHELL_ENABLED`, fail-closed por defecto).

**PENDIENTE documentado (Fase 5):**
- **Sub-usuarios NO enjaulados** (solo el owner en el MVP; `jk_jailuser` solo
  mueve al owner). Deuda Fase 8.
- **Persistencia de `/proc` del jail en `fstab`** (sobrevivir reinicios del VPS):
  fuera de scope del módulo; corresponde al `install.sh` del servidor.
