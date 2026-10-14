# Módulo `secret-rotation` (residual: solo secret-store)

El receptor de rotación push/pull contra LP-LICENSE-SERVER se eliminó con el
pivot standalone (el módulo dejó de registrarse en `server.ts`; la rotación
vigente es `scripts/rotate-secrets.sh` + `shared-secrets.json`). De aquel
módulo solo sobrevive el store, que otros módulos siguen usando.

## Piezas

- **`services/secret-store`** — cache in-memory + persistencia JSON 0600 con
  cascada de paths writable (`SECRET_ROTATION_FILE` → `CONFIG_DIR` → `$HOME` →
  `cwd/data`); modo solo-memoria si ninguno escribe. `getDebugSummary` nunca
  expone plaintexts.

## Consumidores

`auth/lp-ssh-key`, `license/panel-api.client`, `license/panel-branding.client`,
`external-panels.service`, `shared/executor/ssh-proxy-client`.

## Anatomía

- **Sin `index.ts`/rutas/controladores**: no monta endpoints; es una librería
  interna. Si en el futuro se quiere reubicar en `shared/`, es un refactor
  aparte (actualizar los 5 importadores).
