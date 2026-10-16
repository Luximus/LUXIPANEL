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

La vinculación obligatoria con GitHub se limita a la identidad local de la instalación. Las identidades SSH directas pueden administrar sus servidores sin vincular GitHub; publicar cambios sigue requiriendo su propia credencial verificada. Los tokens con `githubIdentityDirect` conservan el origen firmado de la identidad al seleccionar otro target: cambiar el ejecutor no comparte credenciales ni elimina el requisito de una identidad local.

`shared/lp-api-key.ts` conserva la integración activa con LP: la clave nombrada se lee del archivo de instancia y, si no existe, de `LP_PANEL_CREDENTIAL`. La validación online contra `/panel-api/server-key` falla cerrada: clave ausente/inválida 403 y servicio no disponible 503. El endpoint de nombre histórico no registra servidores. `modules/license/panel-api.client.ts` tiene consumidores de catálogo y desarrollo; revisar llamadas antes de eliminarlo.

## Módulos y capas

Controllers → services → repositories → acceso al sistema/sidecars. Declarar y comprobar permisos; no inferir autorización de la visibilidad de un botón. Las operaciones de administración para asistentes se descubren por catálogo y revisión y reutilizan guards vigentes. `shared/module-operations/catalog.ts` y el registro de admin son las referencias de capacidades.

Las familias incluyen administración y usuarios, archivos, correo, bases de datos, nginx, firewall/auditoría/BitNinja, tareas y backups, terminal, monitor, hosting, asistente, Obsidian, repositorios, Expo, MCP, webhooks, notificaciones y módulos comunitarios. El índice de documentación por módulo acompaña esta guía; no fijar un número de módulos como contrato permanente.

## Cachés y datos en vivo

`shared/remote-cache`, `shared/data-store` y la política de colecciones determinan qué lectura puede usar caché. Los motores del target y su Redis dedicado son distintos del Redis del panel. Un fallo de caché no debe confundirse con pérdida de autorización ni habilitar un acceso que el usuario no posee. Operaciones volátiles y sesiones en vivo requieren sus propias rutas. Comprobar el ejecutor activo al leer o actualizar datos; no documentar el gateway LP eliminado como parte de ese recorrido.

## Verificación y despliegue

Pruebas junto a fuentes y suites de integración según package.json. Aislar shell, Redis y servicios externos en tests. Validar cambio de target, errores de permisos, clave inválida/no disponible, expiración y aislamiento de sesiones. Las pruebas unitarias no acreditan QA físico móvil ni disponibilidad de proveedores externos.

Un cambio solo Markdown no necesita build ni restart. Si cambia código, build serializado con límite de memoria y restart del proceso real, seguido de online y HTTP. Frontend Astro siempre con dist limpio y respaldo previo. Reevaluar ecosystem si cambia .env. [Instalación](../SELF-HOSTING.md), [contratos LP](../../LP-LICENSE-SERVER/INFRA_LUXIPANEL.md).


### Voz en tiempo real del asistente (2026-10-15)
El transporte móvil reutiliza el motor PCM del cliente existente: `/api/assistant/ws/realtime-audio` valida autenticación vigente, módulo, usuario y target, y solo acepta muestras de audio, silencio y ajuste del audio reproducido. Nunca reenvía instrucciones, herramientas ni aprobaciones del cliente. El servidor conecta con OpenAI por WebSocket; la API key permanece en el backend. Las colas y el tamaño de audio están limitados y un canal roto libera la sesión de voz sin cancelar trabajos.
La preferencia opt-in `voice.realtimeEnabled` cambia el comportamiento del botón de audio. `realtime.controller/service` negocia WebRTC con OpenAI y mantiene un canal lateral autenticado en el backend; la clave API nunca se entrega al cliente. Las rutas /api/ai/realtime están excluidas del catálogo de herramientas IA. Se validan usuario, target y el contexto persistido de la conversación (proyecto o chat general). Las peticiones no aceptan selección de proyectos/equipos: en un proyecto, los agentes disponibles se resuelven por su asociación al proyecto o a uno de sus padres. Un chat general conserva su agente si tiene uno; en caso contrario delega al asistente predeterminado usando el proveedor de ese chat, sin crear agentes ni proyectos. Las tareas mantienen projectId=null y admiten las mismas aprobaciones por botones. Cada asignación vuelve a verificar el acceso; si cambia el proyecto del chat, la sesión de voz termina.
El coordinador solo asigna, consulta y cancela tareas del motor de equipos. Las aprobaciones usan los botones HTTP/CSRF existentes; las aprobaciones de plan comprueban la pregunta y su timestamp antes de encolar al trabajador con su contexto original. Las preguntas de varios campos se responden en el chat del trabajador. Un cierre de voz no cancela trabajos. El evento de transcripción se publica después de guardar el mensaje, para que la actualización del historial no se adelante a su persistencia. Las transcripciones y tareas se guardan; se retiró la selección independiente voiceScope; el audio no se archiva. El consumo se registra por respuesta/modelo; el ledger no separa aún el precio de audio del texto.
El estado de conexión y la deduplicación de call_id son por proceso. Tras reinicio se crea una nueva conexión sobre la conversación persistida, sin repetir llamadas automáticamente. El cliente consulta la sesión anterior antes de reintentar un inicio de resultado incierto. Web/Electron renuevan a los 58 minutos; móvil PCM a los 14 minutos, antes de caducar la credencial WebSocket; dos sesiones por usuario como máximo. Los límites del motor de trabajadores siguen vigentes (4 por defecto). Las tareas declaradas needsBuild comparten un lease por target; esto no sustituye la regla de serializar compilaciones manuales o realizadas fuera del coordinador.
Los leases incluyen target y ruta. Los workers en espera de una pregunta conservan su aislamiento. El backend rechaza entradas textuales a la conversación de voz y pausa su cola de texto. Las pruebas unitarias usan un proveedor simulado. El 2026-10-15 se verificó además WebRTC y canal lateral reales con la clave contextual del usuario: transcripción de entrada, respuesta de audio y cierre remoto confirmado con gpt-realtime-2.1, sin ejecutar herramientas de administración.

### Aportes del propietario y tareas simultáneas (2026-10-15)
Los nuevos turnos trabajan en el directorio original del proyecto, con el checkout principal de LUXIPANEL en `developer`. El dispatcher no crea `owner-workspaces`, no descarga una copia para cada chat y no sustituye su directorio por una carpeta temporal. La publicación automática utiliza objetos Git e índices privados en el outbox para aplicar únicamente el delta del turno sobre `developer`, sin otra copia de fuentes ni alterar los archivos, el índice o HEAD del operador. Conserva la identidad GitHub verificada, los reintentos y la confirmación remota del commit.
Los worktrees ya existentes se conservan: el seguimiento de un trabajador que recibe uno explícitamente usa ese mismo directorio, y las entregas antiguas mantienen compatibilidad. No se eliminan carpetas de tareas activas, interrumpidas o con cambios pendientes durante esta transición.
El seguimiento en `shared/github/owner-contributions.ts` no reserva el repositorio durante toda la conversación: cada turno tiene su registro y el backend serializa únicamente las capturas y actualizaciones de estado. Se retiró el bloqueo global `active.json`; al arrancar se recuperan todos los CLI cuya identidad firmada se verifica, y los registros no recuperables quedan interrumpidos. Los permisos para editar el núcleo siguen vigentes.
Cuando dos turnos usan el mismo checkout, ambos quedan marcados persistentemente como solapados y pueden continuar. Sus archivos permanecen en disco, pero no se genera ni publica un parche combinado: el aporte requiere revisión manual. Terminar uno no borra el seguimiento de los demás; una tarea posterior sin solapamiento vuelve a capturar solo su delta. Esto no sustituye el aislamiento de trabajadores ni permite compilaciones simultáneas.


### Equipo y contexto de proyectos (2026-10-15)
`projectWorkspaceService.create` crea equipo y líder para cada proyecto raíz, con serialización e idempotencia por target, usuario y clave de creación; revierte los registros nuevos si falla el vínculo. Los subproyectos heredan el equipo sin crear agentes adicionales. El líder se vincula al proyecto y su perfil dirige la consulta del contexto vigente (instrucciones, servidores, habilidades, vault, grafo y subproyectos), resuelto por el constructor de contexto en cada turno; no congela copias de esas configuraciones. No se reescriben agentes existentes.
La consulta de conversaciones acepta `summaryScope=filtered` para contar después de aplicar proyecto, agente y búsqueda, antes de paginar. El valor omitido conserva los contadores globales anteriores. La reconciliación de sesiones huérfanas se limita a consultas sin filtros; los desplegables del equipo no disparan ese trabajo repetidamente.
