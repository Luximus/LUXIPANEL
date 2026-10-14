# Hosting — checklist de despliegue y smoke-test E2E

Rediseño hosting (Fases 1–6). LUXIPANEL ya está desplegado en esta máquina; este
checklist cubre lo que falta: **deploy remoto de LP-LS** + **verificación E2E**.

> Regla de builds: nunca dos builds a la vez (`pgrep -af "tsc|astro|esbuild"`).
> LP-LS se despliega en su host remoto, NO aquí. El frontend de LP-LS vive en
> `203.0.113.20` (no afectado por hosting — solo cambió el backend de LP).

## 0. Estado de partida (ya hecho)
- [x] LUXIPANEL backend desplegado (build + `pm2 restart luxipanel-backend`; 33 módulos, `:8080` 200).
- [x] LUXIPANEL frontend desplegado (build + `pm2 restart luxipanel-frontend`; `/login` 200).
- [x] `hosting` en `DEFAULT_ENABLED_MODULES` (LUXIPANEL) y en el seed de LP (`seeds/modules.ts`).
- [x] Ambos repos `tsc` 0 errores (salvo nada — preview-sandbox ya resuelto).

## 1. Deploy remoto de LP-LICENSE-SERVER (lo hace el usuario)
- [ ] Subir cambios (git) y conectarse al host de LP.
- [ ] `cd .../LP-LICENSE-SERVER/backend && npm run build` (en el host de LP).
- [ ] `pm2 restart license-backend` → en boot, `ensureColumns()` crea en `agent_servers`:
      `service_username, encrypted_service_private_key, encrypted_service_passphrase,
      service_key_fingerprint, service_key_provisioned_at, service_key_error`.
      Verificar log de arranque limpio (sin "Failed to start"); ver migrate.ts.
- [ ] `npm run seed:modules` (o el flujo de seed) → registra el módulo `hosting` en el catálogo de LP.
- [ ] Sanity: `POST /panel-api/service-key` existe (mismo auth que `/panel-api/login/ssh-key`).

## 2. Re-provisionar el/los VPS cliente
- [ ] Reconectar cada servidor desde el panel (dispara `cache-stack-provision`):
  - [ ] LP genera la clave de servicio ed25519 + crea el usuario Linux `luxipanel-service`
        (sudo NOPASSWD acotado en `/etc/sudoers.d/luxipanel-service`).
  - [ ] `setup-jails.sh` instala `jailkit` (si se usará jaula) — fail-soft si falla.
  - [ ] En el VPS: `getent passwd luxipanel-service` existe; `agent_servers.service_key_*` poblado
        (o se rellena lazy en el primer `/panel-api/service-key`).

## 3. Smoke-test E2E (admin / reseller)
- [ ] Login admin normal sigue funcionando (no-regresión del módulo users/roles).
- [ ] `/panel/hosting` visible y carga la tabla (modelo nuevo: usuario, plan, estado, módulos, cuotas).
- [ ] **Crear cuenta** hosting: usuario + password + `allowedModules` (multi-select) + `maxSubUsers` + cuotas
      (+ opcional "Aislar shell (chroot)").
  - [ ] En el VPS: existe el usuario Linux `<owner>`, el grupo `h-<owner>`, home `/home/<owner>` (chmod 750, owner:h-owner).
  - [ ] Existe el role record `h-<owner>` en `users/roles.json` (envelope clamp-eado a homeRoot + allowedModules).
- [ ] Editar cuenta (cambiar módulos/cuotas) y cambiar contraseña → OK.
- [ ] Suspender (usermod -L) / reactivar (usermod -U) → el login del tenant se bloquea/restaura.

## 4. Smoke-test E2E (cuenta hosting / tenant)
- [ ] **Login por `/login`** con usuario+password de la cuenta (NO SSH).
  - [ ] Si LP no provisionó la clave de servicio → error claro `HOSTING_NOT_PROVISIONED` (esperado hasta paso 2).
  - [ ] Con todo provisionado → sesión `kind:"hosting"` creada.
- [ ] **Visibilidad de módulos**: el sidebar/catálogo muestra SOLO `allowedModules` (no admin, no módulos fuera del envelope).
- [ ] **Files**: el tenant ve/edita solo bajo `homeRoot`; intentar salir (`/etc`, `/home/otro`) → denegado (path-scope) y a nivel OS (`sudo -u owner`).
- [ ] **Usuarios (tenant-scoped)**: el tenant ve/crea SOLO sus sub-usuarios (grupo `h-<owner>`, home bajo homeRoot);
      no puede crear en sudo/admin ni exceder `maxSubUsers`; no ve usuarios de otros tenants ni del sistema.
- [ ] **Cuotas** (gated por sesión hosting):
  - [ ] Crear dominios hasta `maxDomains` → el siguiente rechaza (`Cupo de dominios alcanzado`).
  - [ ] Crear correo en dominio del tenant hasta `maxEmailAccounts`; en dominio ajeno → `Forbidden`.
  - [ ] `CREATE DATABASE` debe empezar por `<owner>_`; hasta `maxDatabases` → rechaza.
  - [ ] `mode:"raw"` de nginx → rechazado para tenants.
- [ ] **Jail** (si `JAIL_SHELL_ENABLED=true` + `jailEnabled` en la cuenta):
  - [ ] Terminal del panel: `pwd` = `/`, `ls /` muestra solo el árbol del tenant.
  - [ ] SSH directo `ssh <owner>@server`: también enjaulado (login shell = jk_chrootsh).
  - [ ] Ops del panel (Files/Mail) siguen funcionando (Track 1 NO enjaulado).
  - [ ] Si el jail no existe → fail-soft: el terminal cae al shell normal (no rompe).
- [ ] **Auditoría**: creaciones de recurso del tenant aparecen en worklog (key = `<owner>`); lifecycle de cuenta en `hostingAuditRepository`.
- [ ] **Aislamiento del worker**: crear un archivo por la cola write-behind → visible en el shell del tenant y viceversa (homeRoot == raíz del jail).

## 5. Activar jaula (opcional, cuando se quiera)
- [ ] `JAIL_SHELL_ENABLED=true` en `backend/.env` de LUXIPANEL → re-evaluar ecosystem:
      `pm2 restart /var/www/LUXIPANEL/ecosystem.config.cjs --only luxipanel-backend --update-env`.
- [ ] Marcar `jailEnabled` por cuenta (UI) y re-provisionar esa cuenta.

## 6. Rollback rápido
- [ ] Desactivar el módulo en `/panel/modules` (oculta la UI; las cuentas Linux siguen).
- [ ] `JAIL_SHELL_ENABLED=false` revierte la jaula (login shell vuelve a normal al terminar/editar cuenta).
- [ ] Las columnas nuevas de LP son nullable y aditivas (no rompen filas existentes).

## Deudas conocidas (no bloquean)
- Bandwidth (`bandwidthQuotaMb`) NO se enforce aún (Fase 7: falta colector de tráfico por-tenant).
- Subdominio per-cuenta ("su propio VPS") no construido — login va por el `/login` del subdominio del panel.
- Alta por API-key sin sesión: necesita executor de target resuelto (camino sólido = sesión admin).
- Cuota de DB: intercept de `CREATE DATABASE` en consola SQL (parseo frágil) vs endpoint dedicado.
- `writeFile` del privilege-drop usa tmp `0644` efímero (endurecer a `0640 owner:grupo`).
