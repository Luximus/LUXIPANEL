<!-- documentation-status-20261013 -->
> **Documento histórico o de planificación.** Conserva propuestas, resultados y límites de su fecha; no acredita el estado ni la publicación actuales. Consultar la [referencia vigente](../README.md) y el código antes de ejecutar sus instrucciones. Clasificado el 13 de octubre de 2026.

# Datos de drawables: implementación del 3 de octubre de 2026

Implementado en las fuentes de LUXIPANEL y en `app/src` y `desktop/src` de LP-LICENSE-SERVER. Backend, web y escritorio compilados en carpetas de validación; bundles Android/iOS exportados localmente. No se reiniciaron servicios, no se activaron banderas en servidores reales y no se publicaron assets, APK/IPA ni instaladores.

## Comportamiento

Las listas conservan sus filas al reabrir y revalidan en segundo plano. Una notificación indica qué colección cambió; la lista vuelve a consultar la API autenticada. El servidor puede devolver únicamente metadatos si el resultado autorizado no cambió. Filtros, orden, página, selección por identificador, scroll y borradores se conservan; ocultar una vista pausa sus lecturas y suscripciones. Cambiar servidor o sesión descarta respuestas pendientes.

Colecciones integradas: usuarios del sistema, roles, sitios Nginx, cuentas de correo, reglas de firewall, tareas cron, programaciones de backup y webhooks. El monitor mantiene su canal y una cadencia de cinco segundos con deduplicación por servidor; no entra en la caché de listas. Los estados de actualización están disponibles en es/en/fr/de/it/pt/ru/bn/ja/ko/ar/hi.

## Motor y transporte

- `live_watch.py` observa archivos/directorios de configuración mediante inotify, incluidos renombres atómicos y sidecars. Agrupa cambios durante 250 ms, reconcilia al iniciar, al reactivar colecciones y ante overflow. Respeta colecciones deshabilitadas. Publica un heartbeat local de salud cada cinco segundos.
- `run_entry.py` comparte el bloqueo por colección y dos cupos globales entre observador, refresco explícito y recolector periódico. El presupuesto interno de 110 s permite informar un fallo antes del límite externo de 120 s. El timer periódico se conserva como recuperación.
- La vía rápida de correo omite `du`, `doveadm` y recorridos de cuotas en maildirs. Las mediciones pesadas permanecen en la recolección periódica. La web conserva el uso ya leído durante hasta 60 s en las actualizaciones de configuración, sin sustituir la nueva cuota configurada. Los clientes nativos conservan el contrato de lista anterior; una lectura fría sin snapshot puede usar el cargador antiguo.
- Se escriben las claves v1 existentes y las claves v2. La publicación v2 usa Lua para almacenar el contenido comprimido inmutable, cambiar el puntero y emitir el evento de forma atómica. El puntero guarda metadatos sin compresión; la comparación de versión y lectura ocurren en una operación Redis. Un fallo de recolección marca la vista como atrasada y conserva la última carga válida.
- Redis sigue en loopback. Los destinos SSH usan `direct-tcpip` sobre la sesión existente, sin abrir un puerto público. Hay como máximo una conexión de lectura y una de eventos por executor autenticado, incluso ante primeras lecturas simultáneas. Pools y cachés están limitados por tamaño, edad y cantidad; se liberan al disponer el executor. El acceso administrativo a Redis se rechaza en contexto hosting.
- Si no está disponible la vía nueva, se conservan `redis-cli`, caché v1 y carga en vivo. Los motores v2 se habilitan por servidor y están desactivados por defecto.

## Contratos

| Operación | Contrato |
|---|---|
| GET de una lista admitida | Añade `meta.freshness` con `version`, `state`, `collectedAt`, `checkedAt` y `source`. |
| GET con `knownVersion` | Si coincide, devuelve HTTP 200 y `meta.unchanged=true`, sin `data`; conserva la información de paginación. |
| GET `/api/ui/data/capabilities` | Devuelve protocolo, banderas y recursos habilitados que el usuario puede consultar. |
| POST `/api/ui/data/refresh` | Cuerpo estricto `{"resource":"users/system"}`. Requiere autenticación, permisos y CSRF. Devuelve 202 con `data.job.id`. |
| GET `/api/jobs/:id` | Trabajos de refresco ligados al usuario y servidor, con vencimiento y estados queued/processing/done/failed. |
| WS `/api/ui/events` | `data:subscribe` con hasta ocho recursos y cursor opcional. Emite `data:invalidate` o `data:resync`; nunca filas ni secretos. |
| PUT `/api/admin/cache-modules/live-data` | Solo administradores, con CSRF: `{"versionedReads":true,"events":true,"watcher":true}`. |
| GET `/api/admin/cache-modules/health` | Incluye banderas, heartbeat del observador, estadísticas de caché y circuit breaker. |

La versión HTTP representa la respuesta **después** de aplicar autorización, joins, filtros y paginación. Incluye la identidad y el destino efectivo; una versión del snapshot Linux nunca evita ejecutar los controles del endpoint. Usuarios y roles siguen siendo administrativos. Hosting conserva sus lectores con ámbito propio y queda fuera del stream administrativo.

El stream Redis se limita aproximadamente a 10.000 entradas. Reproduce hasta 100 eventos por suscripción; un cursor inválido, antiguo, una pérdida de historial o una recreación del stream producen reconciliación. Web comparte el canal UI existente. App/escritorio comparten un canal de datos por servidor activo, autenticado mediante un ticket WS de corta duración; el JWT de sesión no se coloca en la URL. Hay reconciliación HTTP cada 30 s para vistas visibles y al reanudarlas.

Los trabajos de escritura distinguen `applied=true` y `viewReady`. Si la escritura terminó pero falló el refresco, no se vuelve a ejecutar la mutación. La interfaz conserva la lista y la marca pendiente/atrasada. El refresco manual solo declara la vista lista tras comprobar un snapshot recolectado después del inicio del trabajo.

## Revisión posterior

La segunda revisión añadió **22 pruebas de regresión**, para un total de **152 pruebas focalizadas correctas**. Se corrigieron estos casos:

- Avisos simultáneos de reapertura web y eventos generaban cuatro recargas; ahora comparten un temporizador y producen una.
- El reintento nativo podía coincidir con la reconciliación y abrir otra conexión. Ahora comparten un intento; re-registrar las mismas credenciales no descarta su conexión pendiente. Una sesión revocada espera credenciales nuevas.
- El refresco manual nativo captura vista/sesión antes de consultar capacidades y las comprueba después de cada respuesta. Cerrar, reabrir o cambiar sesión cancela la operación antigua; sus errores no se muestran en la nueva sesión. El cierre de suscriptores es idempotente.
- Una respuesta Redis antigua podía repoblar la caché invalidada. Ahora se descarta; el refresco invalida únicamente su colección antes de comprobarla y rechaza snapshots marcados `stale`. Disponer el executor o cambiar banderas también descarta sus snapshots pendientes.
- Reabrir durante el cierre del lector Redis reutiliza su `XREAD` en curso. Las suscripciones activas se recuperan al reactivar eventos.
- Recuperarse de un fallo del recolector emite un evento aunque el contenido conserve la misma versión; la prueba con Redis/SSH verifica esa recuperación sin forzar el evento.

Se repitieron pruebas focalizadas, tipos, builds aislados y Chromium. En aquella ronda no se repitió la suite completa del worker; la revisión ampliada siguiente la ejecutó y corrigió sus cuatro pruebas desactualizadas. Evidencia específica, copias previas y diff de esta revisión en [`.cache/drawables-v2/review`](../.cache/drawables-v2/review/). No se desplegó ni se activó la mejora en producción.

## Revisión ampliada

Se repitieron las revisiones con varios servidores, vistas concurrentes, escrituras y respuestas lentas. La cobertura ahora comprende **256 pruebas correctas**, incluidas **29 nuevas en esta ronda**, pruebas existentes de los cargadores de Usuarios/Correo, las APIs nativas y la suite Python completa.

- Conectar, renovar o escribir en B conserva las consultas, versiones y estados de A. Escritorio usa generaciones por servidor y re-registrar las mismas credenciales no invalida lecturas.
- Las consultas pendientes conservan su seguimiento hasta terminar; el límite de caché elimina resultados terminados. En el caso de carga de 300 lecturas, se evitan las 300 repeticiones adicionales que provocaba la expulsión de sus marcadores.
- La app invalida también al terminar una escritura: una lista leída mientras se aplicaba no queda retenida como resultado actual. Escritorio revalida una lectura invalidada por escritura sin anunciar pérdida de credenciales.
- El refresco recibido desde el canal cancela el temporizador inicial de los hooks nativos; cambios posteriores durante una carga se agrupan y las vistas ocultas detienen callbacks.
- El estado web se calcula por colección y conserva el error de Usuarios aunque Roles responda correctamente. Los avisos distinguen servidor y destino independiente de correo. Una respuesta de caché también actualiza el indicador al reabrir, sin otra petición.
- El observador incluye movimientos fuera de las carpetas vigiladas, además de entradas, modificaciones y borrados.
- Se corrigieron cuatro pruebas desactualizadas del worker: ahora verifican la ejecución inicial, que una recuperación no repita pasos y que el bucle registre/retire un trabajo fallido y continúe. Se proporciona una clave HMAC de fixture al arranque; no se cambió la política de un intento ni la validación de producción. La suite Python completa pasa sus 42 pruebas.

La última ronda focalizada pasó sin fallos. Tipos de app/escritorio, builds y navegador se verificaron sobre las fuentes finales; el backend TypeScript conserva el build anterior porque no cambió en esta ronda. La web conserva los mismos 58 diagnósticos globales previos, sin nuevos. Evidencia y diff en [`.cache/drawables-v2/review-2`](../.cache/drawables-v2/review-2/). Continúan pendientes publicación, piloto remoto y QA en dispositivos físicos.

## Validación

Evidencia reproducible en [`.cache/drawables-v2`](../.cache/drawables-v2/):

| Comprobación | Resultado |
|---|---|
| Backend focalizado, transporte y revocación WS | 74 pruebas, 16 archivos, correctas. |
| Motores y worker, suite completa | 42 pruebas correctas, incluidas 9 del flujo nuevo y movimiento fuera de carpetas vigiladas. |
| Web y cargadores Usuarios/Correo | 69 pruebas, 9 archivos, correctas. |
| App y API | 45 pruebas, 7 archivos, correctas; TypeScript correcto. |
| Escritorio y API | 26 pruebas, 6 archivos, correctas; TypeScript del proyecto `tsconfig.app.json` correcto. |
| Compilación | Backend TypeScript + aliases, web completa con auditoría i18n y Astro, escritorio Vite, bundles Expo Android/iOS correctos. |
| Sintaxis | Bash y módulos Python modificados correctos. |
| Chromium | Conservación de estado, suspensión, ráfagas de eventos, desconexión y descarte de respuestas de otro servidor y nombres repetidos sin identificador. |

La integración usa **Redis real desechable en socket Unix y un servidor SSH local real**, credenciales exclusivas de prueba y retraso de respuesta de 100 ms. El acceso SSH de Redis es real; la lectura de archivos de configuración del executor se sustituye en el fixture. Para 1.000 filas y 30 consultas sin cambios: respuesta completa de **10302 bytes**, respuesta condicional de **274 bytes**, latencia p95 **107.3 ms** y **dos canales SSH** en total. Los bytes cuentan el tráfico de respuesta del protocolo Redis, no una captura WAN completa.

La prueba Chromium usa DataTable, el ámbito del drawable y los helpers de API reales, con HTTP y notificaciones simulados. En 30 repeticiones con 1.000 filas: p95 de actualización visible **802.9 ms** y de reapertura **18.9 ms**. Cumple los objetivos de 5 s y 150 ms **dentro de ese fixture**. No sustituye la medida de extremo a extremo sobre servidores remotos, disco real, proxies públicos o equipos físicos.

El TypeScript global web conserva **58 diagnósticos previos**, sin diagnósticos nuevos; comparación en `frontend-type-comparison.json`. Los cuatro fallos previos de pruebas del worker se resolvieron en la revisión ampliada, sustituyendo expectativas desactualizadas por pruebas de comportamiento y preparando correctamente el arranque del fixture; la política de reintentos de producción se conserva. Los builds web/escritorio mantienen advertencias de tamaño de chunks.

## Activación y recuperación

1. Revisar los manifiestos [fuentes LUXIPANEL](../.cache/drawables-v2/source-manifest.json) y [fuentes nativas](../.cache/drawables-v2/native-manifest.json), con hashes antes/después. `before: null` identifica un archivo nuevo; los borradores intermedios que puedan existir en los directorios de respaldo no son una versión anterior de esas rutas. Las copias originales están en `baseline/` y `native-baseline/`; `source.patch` muestra únicamente esta intervención contra esas copias. El árbol contiene muchos cambios previos: los builds candidatos completos no son una selección lista para reemplazar producción.
2. Preparar una publicación selectiva del backend y scripts de motores, conservando sus originales desplegados. Instalar el bundle de motores con `install-engines.sh` mediante el procedimiento existente del destino; el nuevo servicio `luxipanel-cache-watch.service` se instala con systemd, permanece sin recolectar mientras la bandera esté apagada y conserva las banderas al actualizar. Si solo hay cron, continúa la recuperación periódica.
3. Publicar assets web compatibles y sus dependencias antes del SSR que los referencia. Mantener las rutas absolutas apuntando al `frontend/dist` activo, no al directorio candidato. Preparar por separado instaladores/binarios nativos y probarlos en dispositivos antes de distribuirlos. No cambiar ni eliminar la optimización de arranque ya publicada.
4. Comenzar con un servidor piloto y verificar primero Usuarios/Nginx. Habilitar las tres banderas con el endpoint administrativo anterior, usando la sesión/bridge/CSRF de ese servidor. Revisar capabilities, heartbeat, jobs y reconexión. La configuración reside en `<config>/cache-engine/live-data.json`; el caché de capacidades/banderas converge en hasta 30 s.
5. Medir 30 cambios externos y reaperturas por módulo en el piloto, errores, CPU/IO, número de recolectores y sesiones SSH. Verificar el handshake público de `/api/ui/events` detrás del proxy y cambios de permisos/servidor. Extender después al resto de módulos y destinos. Las banderas actuales se aplican al servidor completo; la primera verificación funcional se concentra en Usuarios/Nginx.
6. Para desactivar, guardar las tres banderas en `false` mediante el mismo endpoint, comprobar capabilities y volver a las lecturas de compatibilidad. Si el backend no responde, restaurar el archivo de banderas por el canal administrativo del servidor. El modo doble conserva las claves v1; no requiere borrar datos ni repetir escrituras.
7. Si hace falta retirar binarios/assets, restaurar exclusivamente los archivos desplegados incluidos en el manifiesto de esa futura publicación y reiniciar los procesos correspondientes. Los respaldos de **fuente** de esta sesión no sustituyen el respaldo de producción previo al despliegue.

## Límites explícitos

- Correo con destino secundario independiente (`X-Mail-Target-Id`) conserva el lector HTTP ya existente y la reconciliación; la UI no solicita al stream o recolector del servidor principal actualizar ese correo. El push del destino secundario requiere una suscripción autenticada adicional futura.
- El observador sigue archivos/configuración. Los cambios de reglas nftables hechos solo en memoria y los cambios que no generan eventos fiables convergen mediante el recolector periódico; no hay un observador del kernel añadido.
- No se instalaron motores ni se publicaron cambios en producción, no se construyeron APK/IPA/instaladores firmados y no hubo QA físico de Android/iOS/Windows. La prueba de actualización completa archivo → motor → Redis → SSH → API → interfaz sobre un destino remoto sigue siendo la validación del piloto.
- Las herramientas MCP del grafo no estaban disponibles en esta sesión; se usó inspección de fuentes como alternativa.

## Comandos de comprobación

Ejecutar desde la carpeta indicada; los fixtures necesitan Python, `redis-server`, `redis-cli`, Chromium de Playwright y permiso para sockets locales. Serializar compilaciones y comprobaciones TypeScript.

```bash
# web/backend
pnpm exec vitest run src/shared/remote-cache src/modules/admin/services/ui-events.service.test.ts src/shared/websocket/ws-router.test.ts
pnpm exec tsc --noEmit

# /var/www/LUXIPANEL
python3 -m unittest discover -s backend/scripts/remote/engines/tests

# web/frontend
node scripts/qa-live-data.mjs
pnpm exec vitest run src/lib/api-client.loading.test.ts src/lib/live-data.test.ts src/lib/versioned-data.test.ts src/lib/read-cache.test.ts src/lib/ui-events.test.ts src/components/workspace/controller-scope.test.ts src/scripts/extracted/lib/mail-api-client.test.ts src/scripts/extracted/pages/panel/users/loading.test.ts src/scripts/extracted/pages/panel/mail/accounts.loading.test.ts

# mobile
pnpm exec tsc --noEmit
pnpm exec vitest run src/lib/native-live-read.test.ts src/lib/server-data-events.test.ts src/hooks/useServerApi.visibility.test.tsx src/lib/use-live-module-data.test.tsx src/api/serverApi.live-data.test.ts src/api/serverApi.test.ts src/lib/request-cache.test.ts

# desktop
pnpm exec tsc -p tsconfig.app.json --noEmit --incremental --tsBuildInfoFile /var/www/LUXIPANEL/.cache/drawables-v2/desktop-app.tsbuildinfo
pnpm exec vitest run src/lib/native-live-read.test.ts src/lib/server-data-events.test.ts src/lib/use-live-module-data.test.tsx src/lib/list-read-cache.test.ts src/api/serverApi.live-data.test.ts src/api/serverApi.binary.test.ts
```
