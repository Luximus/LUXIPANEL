# Módulo `dashboard`

Resumen del servidor en un único payload agregado (evita el fan-out de 4
llamadas). La antigua landing `/panel` (Tablero) que lo pintaba se eliminó
(2026-08-25): la página de inicio del panel es ahora el módulo **Agentes IA**.
El módulo se conserva porque alimenta la agent-capability `dashboard.overview`
del asistente IA y el endpoint de overview sigue siendo una API de lectura útil.

Ya NO es un módulo del catálogo (`module-registry`): no se activa/desactiva
desde `/panel/modules`. Los ids de permiso `dashboard` / `panel.dashboard`
siguen existiendo como los ids UNIVERSALES de "inicio" (van en el JWT y en los
grupos guardados; renombrarlos rompería sesiones).

## Endpoints (tras `requireAuth`, sin `requireModule` — disponible para
cualquier usuario autenticado)

| Método | Ruta | Qué hace |
|---|---|---|
| GET  | `/api/dashboard/overview` | stats + disco + servicios + top procesos, por-sección `{ ok, data?, error? }` |

## Servicios

- **`dashboard-overview.service`** — `collect(executor)` corre 4 colectores en
  `Promise.all`; cada uno se envuelve en `safeCollect` para aislar fallos
  (una sección caída nunca hunde el overview). `df` siempre en vivo; las
  top-folders (`du`, lento) usan cache por-scope con refresco en background
  (single-flight, el `.then` es el único escritor para no pisar datos frescos).
  Rutea stats a `systemStatsService.collect()` (target `local`) o
  `collectWithExecutor` (remoto). Errores redactados con `redactSudoSecrets`.

Eliminados con el Tablero: `dashboard-widgets.service` (tarjetas por módulo,
`GET /api/dashboard/widgets`) y `module-usage.service` (contador de visitas,
`POST /api/dashboard/module-usage` + `/order`).

## Agent-capability

`dashboard.overview` (tool read) + `dashboard.snapshot` (dataPanel, TTL 30s).

## Notas de anatomía

- **Sin `models/` ni `repositories/`**: no hay persistencia propia por
  `dataStore`. El overview se computa en vivo.
