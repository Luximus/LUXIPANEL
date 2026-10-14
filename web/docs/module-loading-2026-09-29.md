<!-- documentation-status-20261013 -->
> **Documento histórico o de planificación.** Conserva propuestas, resultados y límites de su fecha; no acredita el estado ni la publicación actuales. Consultar la [referencia vigente](../README.md) y el código antes de ejecutar sus instrucciones. Clasificado el 13 de octubre de 2026.

# Revisión de carga de módulos — 29 de septiembre de 2026

## Alcance y resultado

Se revisaron 209 archivos de scripts extraídos en 24 carpetas de módulos y sus dependencias de carga. También se inspeccionaron los flujos de Terminal, Monitor v2, OpenClaw, Notificaciones, Mensajería y Asistente. Las herramientas del grafo MCP no estaban disponibles en esta sesión; se usaron búsqueda local y un inventario de dependencias `await` con el AST de TypeScript.

Se publicaron mejoras en siete módulos: Copias, NGINX, Correo, Ajustes, Obsidian, Expo y Monitor. Usuarios ya tenía publicada la carga progresiva de la revisión anterior. Se actualizaron las versiones de importación de estos módulos y el mapa de precarga de archivos estáticos.

El patrón común encontrado era esperar una consulta secundaria antes de mostrar datos que ya estaban disponibles. La solución publica primero los datos principales y aplica después el enriquecimiento independiente, con controles de generación, servidor y elemento del drawer. Las consultas necesarias para permisos, selección o integridad se mantienen como dependencias.

## Revisión por módulo

| Módulo o flujo | Hallazgo y resultado |
| --- | --- |
| Copias | El historial, las programaciones y los almacenamientos esperaban la configuración. Ahora empiezan sin esa espera; el guardado sigue necesitando la configuración del servidor. |
| NGINX / DNS | Los sitios esperaban las renovaciones SSL. Ahora se muestran primero y después reciben su estado de renovación. Configurar/probar renovación permanece deshabilitado mientras el estado sea desconocido. |
| Correo | Las cuentas esperaban uso de buzones y disco. Ahora se publican por página con `includeUsage=false`, y las estadísticas se incorporan aparte. El inbox predeterminado ya no espera los dominios y ajustes de correo. La configuración de salida muestra sus campos antes del catálogo de buzones. |
| Ajustes | El formulario esperaba la zona horaria del sistema. Ahora aplica primero sus datos; la respuesta tardía modifica solo la zona horaria, conservando las ediciones del usuario. Passkeys, recuperación y TOTP se consultan en paralelo. |
| Obsidian | Preferencias y vaults estaban en serie. Ahora se solicitan juntos, pero se espera a conocer `lastVaultId` antes de elegir el vault; conserva la selección guardada. |
| Expo | Descubrir proyectos locales esperaba la configuración del token. Ahora ambos avanzan en paralelo; builds, variables y credenciales conservan el alcance del proyecto seleccionado. |
| Monitor | Los gráficos actuales esperaban el histórico y las reglas de alerta esperaban los eventos. Ahora ambos pares avanzan independientemente, con limpieza del ciclo de vida instalada de inmediato. |
| Usuarios | La mejora anterior ya muestra usuarios antes de las sesiones SSH y carga el catálogo de permisos cuando hace falta editar. Esta publicación actualiza su versión de importación. |
| Archivos | La revisión anterior ya difiere Monaco, agrupa lecturas repetidas e invalida por servidor y operación. No se añadió otra caché de datos. |
| Terminal | Editor diferido; política y sesión son requisitos reales antes de abrir el PTY. |
| Bases de datos | Motor, base seleccionada y metadatos de tablas son dependencias reales. El aviso de dependencias del sistema ya es independiente. |
| Cloudflare | Configuración y selección de zona deben mantener el contexto de credenciales. IP del servidor independiente y pestañas por demanda. |
| Cron | Jobs, agentes, presets y proyectos ya avanzan por separado según la vista. |
| Hosting | Cuentas, valores predeterminados y catálogo ya se consultan en paralelo. |
| Firewall | Estado, reglas, jails y auditoría se cargan según la vista, sin una espera global. |
| BitNinja | Una lectura principal de estado; no se encontró un enriquecimiento secundario que bloqueara una lista. |
| Mis módulos / module-dev | Los loaders publican sus resultados por separado antes de las operaciones que combinan datos. |
| Módulos / tienda | Carga propia de catálogo; las acciones conservan sus comprobaciones. |
| Repositorios | Git y configuración avanzan por separado; preferencias y migración de guardados preservan selección y orden. |
| Webhooks | Los loaders de cada vista son independientes. |
| Alertas del servidor | Consultas según la pestaña seleccionada. |
| Preferencias | Seguridad, passkeys, recuperación, TOTP y auditoría ya se solicitan por separado. |
| OpenClaw | Una configuración principal; la prueba de conexión se ejecuta por acción del usuario. |
| Grafo del código | No se encontró la misma espera secundaria en la entrada revisada. No se modificó la construcción del grafo. |
| Mapa del proyecto | No se encontró la misma espera secundaria en la entrada revisada. Se conserva la resolución del proyecto y sus archivos. |
| Documentación | No se encontró una cascada de datos de usuarios o SSH equivalente en su entrada. |
| Notificaciones | Lista al abrir, contador/SSE en segundo plano. |
| Monitor v2 | Snapshot, servicios, procesos y carpetas ya avanzan independientemente. |
| Mensajería | La conversación inicial utiliza el contexto del listado; se conserva esa dependencia. |
| Asistente | Configuración y uso independientes; editor diferido. |

## Correo: mejora también en el backend

`GET /api/accounts` sigue usando la caché canónica y aplica el filtro del cliente de Hosting antes de calcular totales y paginar. Si se solicita `includeUsage=false`, no ejecuta la consulta de disco ni la lectura de uso de buzones. En un fallo de caché, forwards y cuotas se solicitan en paralelo y el uso desconocido se devuelve como `null`.

La lectura completa mantiene el comportamiento anterior para los demás consumidores y reutiliza el resultado de uso obtenido por el constructor, evitando repetir la misma consulta SSH. Se conserva la indicación de contraseña sudo requerida. La lista rápida no escribe estadísticas desconocidas en la caché canónica.

## Verificación y mediciones

- 21 pruebas frontend: carga progresiva/paginación/fallo de estadísticas de correo, respuestas tardías al cambiar servidor o drawer, alertas de Monitor y regresión de Usuarios.
- 6 pruebas backend: omitir uso en lista rápida, iniciar lecturas independientes en paralelo, caso vacío, caché sin SSH secundario, filtro Hosting antes de paginar y reutilización del probe/sudo.
- TypeScript frontend y backend con configuración acotada a los módulos modificados y sus dependencias: sin errores.
- Chromium sobre SSR aislado de la release: comparación de la versión anterior y la candidata para siete módulos, más reglas de Monitor antes del historial de eventos. Sin excepciones de página con las respuestas simuladas válidas.
- Ajustes conservó una edición hecha antes de la respuesta de zona horaria; Obsidian eligió el vault guardado; Correo publicó el uso después de la lista.

Se inyectaron 900 ms en consultas secundarias, 50 ms en las principales y 250 ms en el catálogo de vaults. La tabla mide desde el inicio de la primera consulta de datos del módulo hasta el primer resultado principal observado, excluyendo la espera inicial de SSR y descarga de scripts. Una muestra por variante; **son mediciones simuladas, no tiempos garantizados de producción**. En Obsidian sigue siendo necesario esperar la selección guardada; en Monitor se mide el gráfico de memoria.

| Módulo | Versión anterior | Optimizada |
| --- | ---: | ---: |
| Copias | 968 ms | 69 ms |
| NGINX | 909 ms | 69 ms |
| Correo | 916 ms | 59 ms |
| Ajustes | 979 ms | 78 ms |
| Expo | 966 ms | 71 ms |
| Obsidian | 1.225 ms | 969 ms |
| Monitor | 1.185 ms | 286 ms |

No se midió una sesión autenticada real contra todos los servidores remotos. La latencia restante dependerá de la consulta principal, SSH, estado de la caché y red. La revisión de los otros módulos fue inspección de sus flujos, no una prueba funcional completa de todas sus operaciones.

## Publicación

Publicado el **2026-09-29 a las 22:45:37 UTC**. Release preparada a partir del frontend activo, conservando Astro 7.2.8 y los cambios de seguridad publicados. Se sustituyeron solo nueve archivos extraídos, ocho wrappers de importación con nombre nuevo, las referencias SSR correspondientes y dos archivos JavaScript de correo con sus mapas de fuente. Se conservaron los assets anteriores. El bundle NGINX también conserva los ajustes de mensajes de acciones que se editaron simultáneamente; no se publicó toda la revisión de traducciones.

El frontend se activó con cambio de directorio y respaldo, y ambos procesos PM2 se reiniciaron con su entorno vigente. Verificados después: salud API y login 200, nueve hashes de scripts a través del frontend y NGINX, ocho wrappers nuevos 200, ocho módulos anónimos redirigidos 302, configuración NGINX válida y controles de imágenes intactos (frontend 403 para origen no autorizado, NGINX 404).

- Respaldo frontend: `frontend/dist-before-progressive-load-2026-09-29T22-45-32-710Z`.
- Respaldo backend: `.cache/module-load-speed/backend-before-2026-09-29T22-45-32-710Z`.
- Inventario: `.cache/module-load-speed/await-inventory.json`.
- Pruebas y trazas: `.cache/module-load-speed/report.json`, `unit-frontend.log`, `unit-backend.log`, `typecheck-frontend.log`, `typecheck-backend.log`.
- Release y publicación: `.cache/module-load-speed/release.json`, `publication.json`, `publication.log`.

La precarga continúa limitada a scripts y estilos públicos por intención de navegación. No se precargan APIs autenticadas ni drawers ocultos.
