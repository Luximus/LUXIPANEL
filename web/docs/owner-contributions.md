# GitHub personal y aportes del propietario

El proyecto LUXIPANEL existente y sus subproyectos conservan sus identificadores, rutas y propietario. No se crean proyectos por usuario. Los flujos Dev/LOG, módulos, forks y PR permanecen disponibles con sus permisos actuales.

## Identidad y acceso

Cada usuario vincula GitHub desde /connect-github antes de usar el panel. Sesión, conexión, cierre de sesión y recuperación siguen disponibles. Web y escritorio comparten pantalla; móvil incorpora una pantalla nativa. Las aplicaciones móviles anteriores pueden vincular la misma cuenta del panel desde el navegador hasta instalar su siguiente versión.

Las credenciales se cifran individualmente en LUXIPANEL_CONFIG_DIR/github-users, con archivos 0600 y directorios 0700. Se vinculan al usuario y servidor de autenticación, independientemente del servidor seleccionado. La identidad se revalida antes de publicar y periódicamente al usar el panel. No se usa como alternativa la credencial global de otro usuario.

La edición directa del checkout desde el asistente requiere que owner.json vincule el principal local con el identificador verificado de Luximus (80057597). No basta con cambiar un nombre visible. Esta política no se provisiona automáticamente en clones. Los permisos administrativos del sistema operativo permanecen bajo control de quien administra cada servidor.

La conexión por token personal funciona sin configurar OAuth. El flujo por dispositivo requiere LUXIPANEL_GITHUB_CLIENT_ID y Device Flow habilitado en GitHub. En esta instalación se usa token; la aplicación OAuth existente de licencias tiene Device Flow deshabilitado y no se copiaron sus secretos.

## Envío automático

Una tarea del propietario captura un índice Git privado antes de comenzar en el proyecto original. Las tareas simultáneas de la misma identidad se agrupan y generan un único aporte cuando todas terminan sin error, cancelación ni pregunta pendiente. Se conservan las instantáneas, notas, parche, hash y estado. Un participante fallido o de otra identidad detiene el grupo para revisión. No se cambia la rama del servidor.

Excluye credenciales, .env, carpetas privadas, artefactos y otros proyectos. Comprueba integridad, tamaño, posibles secretos, formato del parche y JSON antes de aplicar mediante un índice privado sobre developer, sin copiar las fuentes. Estas comprobaciones no sustituyen las pruebas funcionales o CI.

El commit usa la identidad GitHub verificada. El envío se confirma consultando el historial remoto; un resultado incierto se contrasta antes de repetirlo. Los fallos de conexión se reintentan con espera. Conflictos y permisos insuficientes quedan pendientes y visibles en la conexión GitHub del propietario. No hay force-push.

La base capturada puede contener cambios locales anteriores que aún no existen en developer. En ese caso los parches incrementales pueden depender de archivos ausentes o de código distinto: el estado distingue esta base pendiente de los conflictos de aplicación. Antes de habilitar envíos efectivos hay que reconciliar la base publicada con el código del que parten las tareas; reintentar el mismo parche no lo resuelve. El validador detecta cabeceras binarias reales, no menciones de esas cabeceras dentro del código fuente.

Los módulos independientes de web/modules conservan su flujo de PR a modules desde Dev. Un parche que incluya esos módulos queda pendiente para separar entregas. Los módulos integrados bajo web/backend/src/modules forman parte del núcleo y van a developer.

Los cambios anteriores al comienzo del seguimiento no se publican retrospectivamente. Los bloqueos antiguos por concurrencia sí pueden recuperarse si todos los participantes tienen un resultado correcto confirmado y existen instantáneas que delimitan el grupo antes del turno siguiente; no se toma el contenido actual para reconstruirlos. Si el backend reinicia, una tarea CLI conserva su reserva únicamente cuando coincide con el descriptor firmado del proceso original y sus archivos de recuperación. Se recupera automáticamente y solo prepara el aporte después de confirmar que terminó correctamente. Las tareas fallidas, canceladas, con preguntas pendientes o sin recuperación verificable quedan sin publicar. Evitar ediciones manuales simultáneas del mismo checkout: Git no permite atribuir su autor con una comparación de archivos.

## Versiones

Un envío no publica una Release ni instala una actualización. El mantenedor decide la integración y publicación; siguen vigentes las revisiones CODEOWNERS y la autorización manual de instalación. main y las Releases no se modifican por este mecanismo.

## Verificación

Pruebas de separación de cuentas, cifrado, revocación, desconexión concurrente, autorización de dispositivo, aislamiento de índices, cambios previos, exclusión de rutas, permisos, recuperación tras reinicio y push a un remoto Git temporal con repetición sin duplicados. Verificación adicional de sesiones, tokens MCP, redirección web y tipos del cliente móvil.


## Publicación y recuperación (2026-10-16)

El dispatcher común del agente captura también trabajadores y turnos drenados. Los turnos ordinarios trabajan en el proyecto original, sin crear copias temporales. Los trabajadores que ya tienen un checkout aislado explícito conservan su compatibilidad. Las consultas sin cambios no crean commits y el modo plan no abre seguimiento. Los índices privados y las referencias de snapshots/tareas conservan la base y el commit local sin tocar el índice del checkout desplegado.

La cola persistida usa un bloqueo flock entre procesos. El publicador aplica el parche con un índice privado y confirma ascendencia remota antes de repetir un envío; conserva los parches si hay conflicto. La entrega con cherry-pick se limita a los trabajadores aislados existentes. Los commits locales y los publicados son campos distintos. El publicador solicita el workflow existente Release checks después de confirmar el push a developer, sin modificar su definición; la consulta de Actions utiliza exactamente el SHA enviado y expone pendiente, correcto, fallido o sin ejecución. Un push confirmado no significa Release aprobada ni despliegue completado.

Después de publicar, la cola puede alinear HEAD y el índice de developer con el contenido confirmado, únicamente si no hay tareas activas, el operador no tiene cambios preparados, el contenido local coincide exactamente y no hay instalación ni compilación en curso. Esta operación no escribe archivos fuente.

Los registros antiguos sin base publicada deben conciliarse contra la recuperación inicial. No se deben borrar los parches ni marcar un aporte como publicado sin comprobar su contenido. Las copias de tareas del núcleo no se eliminan automáticamente al cancelar ni mediante el barrido de huérfanos. Solo Luximus verificado puede publicar directamente; siguen separados los módulos externos y el repositorio privado de licencias.

La credencial actual permite publicar código y ejecutar Actions, pero carece del scope workflow para modificar archivos .github/workflows. La propuesta de triggers queda respaldada localmente; el dispatcher existente cubre la ejecución automática de comprobaciones. Un fallo de Actions no convierte el push confirmado en fallo de publicación.
