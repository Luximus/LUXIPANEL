# Módulo `users` — usuarios y grupos del SERVIDOR CLIENTE

Gestiona usuarios y grupos **Linux del servidor cliente conectado** (NO cuentas
de LP ni del host del panel). Todo el CRUD corre por el `Executor` por-servidor;
las mutaciones lentas (useradd/usermod/userdel/groupadd/gpasswd) van por la
**cola write-behind** (`submitMutation` → worker on-box con su sudo). Lecturas
cache-first desde `lprc:v1:users:*`.

Estructura: `models/` → `repositories/` → `services/` (`users.service`,
`roles.service`, `system-accounts.service`) → `controllers/` → `routes/`.
La permisología efectiva es la **UNIÓN** de los registros de permiso de cada
grupo Linux al que pertenece el usuario (ver `auth/role-permissions.service`).

### Módulos del grupo `admin` (SSOT del catálogo)

El grupo `admin` recibe **todos** los módulos asignables. Ese conjunto **NO** es
un literal en `roles.service` (antes lo era y quedó desfasado, omitiendo
obsidian/databases/cloudflare/expo/hosting/terminal…): `validModuleSlugs()`
delega en `assignableModuleSlugs()` de `auth/role-permissions.service`, la misma
fuente dinámica (registro de módulos ⊕ shell features) que
`deriveModulesFromPermissions` recorre para los grupos normales. Así el grupo
`admin` no puede volver a divergir del catálogo, y `hosting` valida sus
`allowedModules` contra ese mismo conjunto. Un módulo nuevo con superficie de
permiso se entitla solo.

### Id numérico de grupo (`role.repository.nextId`)

`roles.id` es un FK numérico (se une como `byId.get(u.roleId)`), así que el id
debe seguir siendo entero — no UUID. `nextId` genera un id ordenado por tiempo
(`Date.now()*1000 + randomInt(1000)`) y salta cualquier id ya presente en el
snapshot; sustituye al viejo `max+1`, que bajo concurrencia daba el mismo id a
dos creates simultáneos (el segundo `set()` pisaba al primero = grupo perdido).

## Preferencias de UI (`/api/preferences/ui`) — por-usuario + por-servidor

Persisten tema e idioma del panel para que el usuario no los pierda al saltar de
subdominio. Sidecar `users/preferences.json` (doc por `userId`) vía `dataStore`
con el `Executor` de contexto (**fail-closed**: sin executor lanza, nunca
`localExecutor`); 1 SFTP, sin cola write-behind. Mismo sidecar que usa el WS
`ui-sync` y el perfil (`GET /api/preferences`), fuente única.

- `GET /api/preferences/ui` → `{ "theme": "light"|"dark"|"system", "language": <código i18n>|null }`.
  Defaults sin sidecar: `theme "system"`, `language null`.
- `PUT /api/preferences/ui` body parcial `{ theme?, language? }` (Zod: theme enum;
  language `/^[a-z]{2}(-[A-Z]{2})?$/`), merge y responde el objeto completo
  resultante (misma forma bare). `requireAuth` + CSRF.

## Fase 3 — acotado al tenant en sesiones `kind:"hosting"`

Cuando la sesión es de **hosting** (un tenant anidado del módulo `hosting`), el
módulo gestiona SOLO los usuarios/grupos del tenant, dentro de su *envelope*.
Todo es **aditivo y gateado** por `isHostingSession()`; admin/usuario normal
queda intacto. La lógica vive en `shared/tenant/tenant-scope.ts` (helper
central de clamp); este módulo solo la invoca.

- **Envelope desde el token** (`owner`, `tenantGroup`, `homeRoot`,
  `maxSubUsers`, `modules`=allowedModules, `permissions`=techo): el owner
  *privilege-dropped* no puede leer el sidecar root, así que llega por el JWT
  firmado (`auth.loginHosting`). `getTenantEnvelope` falla cerrado si el token es
  pre-Fase 3.
- **`list`** (controller): filtra la respuesta a miembros del tenant
  (`filterTenantUsers`) usando `groups` + `homeDir` ya presentes en cada row.
  La cache `lprc:*` es de TODO el VPS; el recorte vive en el controlador (mismo
  patrón que `shouldHideSystemAccount`), nunca en el colector.
- **`sessions`**: `who` y journald leen actividad de todo el VPS, pero la
  respuesta se recorta en el backend a cuentas del envelope con la misma lista
  Linux/cache y metadatos de grupos. Un fallo al obtener la lista falla cerrado;
  el navegador no actúa como límite de seguridad.
- **`create`**: `assertTenantUsernameSafe` + `assertWithinSubUserQuota`
  (`countTenantSubUsers` vía getent sin sudo); fuerza home `homeRoot/<sub>` y
  grupo primario `tenantGroup` (`buildCreateSteps` gana `-d`/`-g` opcionales);
  grupos suplementarios ⊆ `{tenantGroup, h-<owner>-*}`; módulos ⊆
  `allowedModules`.
- **`update` / `delete`**: el objetivo DEBE ser miembro del tenant
  (`assertResolvedTargetInTenant`) y nunca el owner (`assertNotOwner`); rename no
  puede colisionar con nombres de sistema; grupos/módulos re-clampados.
- **Grupos (`roles.service` / `roles.controller`)**: el tenant solo ve/crea/edita
  grupos `h-<owner>-*` (nunca `admin` ni el `tenantGroup` raíz, que es la
  plantilla del proveedor); sus permisos se *clampan* a `clampPermissionsToEnvelope`
  (`⊆ template`, `fileAccess ⊆ homeRoot`, sin `allowAll`).
- **Gate de ruta**: `users.routes` usa `requireUsersAccess` (aditivo): admin como
  antes, o sesión hosting con `"users"` en `allowedModules`; los
  `requireView/ActionPermission` por-ruta siguen aplicando el granular del token.

> **Invariante de seguridad:** el worker on-box aplica los steps con sudo y NO
> re-valida. Toda la seguridad del tenant está en el clamp server-side ANTES de
> `submitMutation`. Nunca confiar en groups/home/módulos/permisos del cliente
> para una sesión hosting.

Tests del clamp: `shared/tenant/tenant-scope.test.ts`.

## Drawer «Configuración de Usuarios»

La pestaña **Usuarios** y **Roles** conserva preferencias locales de paginación
y acciones visibles. **Resumen** consume las listas autorizadas de
`GET /api/users` y `GET /api/roles`; **Accesos** cruza esa lista de usuarios con
`GET /api/users/sessions` para mostrar solo sesiones de cuentas visibles para la
sesión actual. El CSV exporta esos mismos datos autorizados y neutraliza texto
que una hoja de cálculo interpretaría como fórmula. La presencia depende de
`who` (sesiones interactivas) y el último acceso SSH depende de journald o sus
fuentes de respaldo; ninguno equivale a un historial de auditoría completo.
