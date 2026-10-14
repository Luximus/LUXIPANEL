# Planes de hosting y permisos de grupos

Implementado y publicado el 30 de septiembre de 2026. El editor administrativo de Usuarios/Grupos incorpora planes reutilizables. Hosting permite vincular una cuenta a un plan; la configuración del proveedor permite seleccionar el plan predeterminado para cuentas nuevas.

## Política de permisos

El catálogo se deriva de los módulos registrados y utiliza acciones explícitas. Menú, vistas y operaciones se configuran por separado. Guardar un grupo valida acciones conocidas, rutas Unix absolutas, pertenencia de la ruta inicial al alcance permitido y política de comandos. Las concesiones de varios grupos conservan su asociación con acciones, rutas y comandos; no se combinan como listas independientes que permitan ampliar el alcance.

Los permisos antiguos basados en módulos o comodines se convierten a una fotografía finita de la versión actual del catálogo. Antes de migrar se guarda el grupo original en `users/permission-migration-original`, dentro del almacén protegido de configuración del servidor. Un módulo o una acción futura requiere una concesión nueva.

La administración de servicios, instalaciones, módulos, proveedores, planes y seguridad global sigue reservada al administrador. Monitor expone métricas y procesos globales únicamente al administrador. Un usuario sin cuenta de hosting tampoco puede delegar administración de usuarios/grupos mediante las herramientas del asistente.

## Cuentas vinculadas

Cada cuenta tiene un grupo principal dedicado y un límite definido por su plan. Los subusuarios pertenecen a la cuenta y pueden tener permisos más restrictivos. Las restricciones individuales se almacenan separadas de la proyección del plan: se conservan al actualizarlo, incluso si una acción desaparece y vuelve a incorporarse en otra revisión. Los límites individuales nunca superan el plan vigente.

El plan incluye disco, CPU, memoria, procesos, dominios, buzones, bases de datos y subusuarios. Su seguridad configura terminal deshabilitado o aislado, número de sesiones de terminal, duración de comandos y sesión, MFA y servidores alternativos de correo permitidos. El terminal está deshabilitado por defecto.

Las actualizaciones de planes comprueban `expectedRevision`; una edición obsoleta devuelve conflicto y el formulario conserva el borrador. La política del servidor se serializa mediante una concesión Redis renovable. Antes de cambiarla se cierran los accesos nativos de las cuentas afectadas; solo se habilitan otra vez tras confirmar su aplicación. Una aplicación incompleta deja la cuenta pendiente y permite reintentar desde Hosting. Un plan en uso por una cuenta o por un proveedor no se puede eliminar.

## Autorización durante la sesión

La autorización se reconstruye desde los grupos actuales y la cuenta activa, con una revisión por servidor. Los cambios invalidan el estado de autorización y los canales abiertos. HTTP, WebSocket, herramientas del asistente y pasos de mutaciones verifican permisos actuales; las conexiones también comprueban expiración y disponen de una comprobación periódica. La indisponibilidad del servicio de autorización deniega el acceso.

Las creaciones de recursos de una cuenta se serializan para impedir superar cupos con peticiones simultáneas. El acceso a preferencias y credenciales mantiene la identidad del usuario y el servidor firmado; un identificador enviado por el cliente no amplía el alcance.

## Requisitos del servidor

El aislamiento nativo requiere systemd/cgroups v2 con controladores CPU, memoria y procesos; Jailkit; Python/seccomp; y cuotas de proyecto activas en el sistema de archivos que contiene los directorios de las cuentas, con las herramientas correspondientes. CPU, memoria y procesos se limitan de forma agregada por cuenta; el disco usa cuotas de proyecto del kernel.

Los procesos del cliente se ejecutan con su UID dentro del aislamiento y de la unidad controlada. Las políticas y sus marcadores son propiedad de root. Se verifican identidad Linux, pertenencia al grupo, revisión, estado, expiración y límites antes de ejecutar. Las rutas se fijan sin seguir enlaces y la política conserva rutas de solo lectura y exclusiones. Cron utiliza un lanzador controlado. El terminal de una cuenta requiere política nativa confirmada y `shell=jailed`.

PHP requiere además PHP-FPM, ACL y un usuario de NGINX verificable. Sus sitios usan un servicio y socket propios de la cuenta. Los sitios PHP o crontabs antiguos requieren migración previa; no se admiten pools compartidos como ejecución aislada. Los sitios del cliente usan configuración guiada: la configuración NGINX arbitraria sigue siendo administrativa.

Los cupos de dominios, buzones, bases de datos y subusuarios se verifican en el panel. Los daemons compartidos de correo y bases de datos no se ejecutan dentro de la jaula de cada cliente. No se anuncia un límite nativo de ancho de banda.

En el servidor local comprobado, `/` usa ext4 sin cuotas de proyecto activas y falta PHP-FPM. Crear planes y editar permisos funciona; vincular o activar cuentas con aislamiento nativo queda bloqueado por la comprobación de capacidades. No se remonta el sistema de archivos raíz ni se modifican cuentas reales para realizar pruebas.

## API administrativa

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/roles/templates/capabilities` | Comprobar capacidades del servidor seleccionado |
| GET / POST | `/api/roles/templates` | Listar / crear planes |
| PUT | `/api/roles/templates/:id` | Actualizar con `expectedRevision` |
| DELETE | `/api/roles/templates/:id` | Eliminar un plan que no esté en uso |
| POST | `/api/hosting/accounts/:id/reconcile` | Reintentar una política pendiente |

Estas rutas exigen sesión administrativa; las escrituras también exigen CSRF. Las claves Bearer del proveedor se procesan en su API separada y no autorizan la administración genérica del panel.

## Verificación y publicación

- Suite backend: 306 archivos, 2616 pruebas aprobadas. TypeScript y compilación Astro aprobados.
- Auditoría de interfaz: 39 namespaces y 8249 entradas por idioma, sin entradas faltantes o adicionales, tipos incompatibles, placeholders diferentes ni valores vacíos, en los 12 idiomas.
- QA Chromium con SSR/bundles reales y API simulada: español, inglés, árabe y japonés; escritorio/móvil, claro/oscuro, matriz de permisos, conflictos de revisión, cambio de servidor, selección de plan del proveedor y reintento de políticas pendientes. No equivale a una prueba autenticada sobre cuentas reales de producción.
- Pruebas Linux reales en recursos temporales: cuotas de disco en ext4 de loop, UID/jaula, cgroups, límite de memoria, procesos, ruta de solo lectura y cierre de acceso nativo. Los recursos temporales se retiraron. PHP aislado no se probó en este host por falta de PHP-FPM.
- Mensajes de seguridad: 98 mensajes exactos verificados en 12 idiomas; siete pruebas de i18n repetidas y aprobadas tras el ajuste final.

La publicación inicial modificó 75 artefactos backend y conservó el frontend concurrente que ya incorporaba el editor. Se revisó una actualización concurrente posterior del backend y se publicó un ajuste dirigido de dos archivos de mensajes, preservando esa versión. Salud backend, login HTTPS, protección de API anónima y hashes públicos de los scripts de permisos se verificaron.

Evidencias y respaldos de esta sesión están en `.cache/group-plans/`: `publication.json`, `checks/`, `qa.json`, `qa-account-provider.json`, `runtime-backup/` e `i18n-cleanup/publication.json`. Los scripts de publicación comprueban hashes y restauran su respaldo si la publicación falla. Sus manifiestos corresponden a la versión anterior de cada publicación; no deben reutilizarse sobre una versión activa distinta sin preparar un respaldo y una comparación nuevos.
