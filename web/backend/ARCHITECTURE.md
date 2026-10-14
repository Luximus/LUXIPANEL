# Arquitectura del backend LUXIPANEL

Revisión: 2026-10-13. Panel autohospedado Linux con ejecución local y multinodo SSH. Express/TypeScript y Redis; la persistencia de módulos usa estado del sistema y sidecars según su dominio. No es el backend PostgreSQL comercial de LP-LICENSE-SERVER.

## Arranque y registro

`src/server.ts` prepara servicios y módulos; `src/app.ts` aplica middleware y llama a los registradores. Las rutas registradas, no los nombres históricos de carpetas, definen la superficie HTTP. No se requiere activar una licencia ni iniciar heartbeat del antiguo modo managed. El módulo `license` conserva servicios y clientes de cuenta: no asumir que todos sus imports están muertos.

Los WebSockets se centralizan en el router de upgrades correspondiente. Respetar el shutdown ordenado y no añadir listeners competidores. La configuración se valida en `src/config/env.ts`; los comentarios y `.env.example` no sustituyen al schema activo.

## Ejecución y aislamiento

`shared/executor` selecciona ejecución local o SSH directo de la sesión. Controllers pasan el contexto/ejecutor a services y repositories. El estado que pertenece al target debe usar su ejecutor; el vault de targets pertenece al host del panel. No usar un antiguo proxy de LP ni `/api/agents/exec` como transporte de estos módulos.

`modules/servers` mantiene `${LUXIPANEL_CONFIG_DIR}/servers/targets.json`, cifrado con la clave del vault. La autorización por registro, los destinos privados/globales y la verificación de host se aplican tanto al selector como a las herramientas del asistente. `X-Bridge-Session-Id` identifica el contexto SSH; no es una credencial de cuenta LP.

## Autenticación y servicios de cuenta

El login verifica usuarios Linux y aplica roles/permisos del panel. La primera elevación administrativa y las políticas de acceso están en `modules/auth`. No mezclar recuperación 2FA con recuperación de contraseña del sistema por email.

`shared/lp-api-key.ts` conserva la integración activa con LP: la clave nombrada se lee del archivo de instancia y, si no existe, de `LP_PANEL_CREDENTIAL`. La validación online contra `/panel-api/server-key` falla cerrada: clave ausente/inválida 403 y servicio no disponible 503. El endpoint de nombre histórico no registra servidores. `modules/license/panel-api.client.ts` tiene consumidores de catálogo y desarrollo; revisar llamadas antes de eliminarlo.

## Módulos y capas

Controllers → services → repositories → acceso al sistema/sidecars. Declarar y comprobar permisos; no inferir autorización de la visibilidad de un botón. Las operaciones de administración para asistentes se descubren por catálogo y revisión y reutilizan guards vigentes. `shared/module-operations/catalog.ts` y el registro de admin son las referencias de capacidades.

Las familias incluyen administración y usuarios, archivos, correo, bases de datos, nginx, firewall/auditoría/BitNinja, tareas y backups, terminal, monitor, hosting, asistente, Obsidian, repositorios, Expo, MCP, webhooks, notificaciones y módulos comunitarios. El índice de documentación por módulo acompaña esta guía; no fijar un número de módulos como contrato permanente.

## Cachés y datos en vivo

`shared/remote-cache`, `shared/data-store` y la política de colecciones determinan qué lectura puede usar caché. Los motores del target y su Redis dedicado son distintos del Redis del panel. Un fallo de caché no debe confundirse con pérdida de autorización ni habilitar un acceso que el usuario no posee. Operaciones volátiles y sesiones en vivo requieren sus propias rutas. Comprobar el ejecutor activo al leer o actualizar datos; no documentar el gateway LP eliminado como parte de ese recorrido.

## Verificación y despliegue

Pruebas junto a fuentes y suites de integración según package.json. Aislar shell, Redis y servicios externos en tests. Validar cambio de target, errores de permisos, clave inválida/no disponible, expiración y aislamiento de sesiones. Las pruebas unitarias no acreditan QA físico móvil ni disponibilidad de proveedores externos.

Un cambio solo Markdown no necesita build ni restart. Si cambia código, build serializado con límite de memoria y restart del proceso real, seguido de online y HTTP. Frontend Astro siempre con dist limpio y respaldo previo. Reevaluar ecosystem si cambia .env. [Instalación](../SELF-HOSTING.md), [contratos LP](../../LP-LICENSE-SERVER/INFRA_LUXIPANEL.md).
