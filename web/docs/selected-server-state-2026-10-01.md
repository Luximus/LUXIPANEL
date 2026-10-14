<!-- documentation-status-20261013 -->
> **Documento histórico o de planificación.** Conserva propuestas, resultados y límites de su fecha; no acredita el estado ni la publicación actuales. Consultar la [referencia vigente](../README.md) y el código antes de ejecutar sus instrucciones. Clasificado el 13 de octubre de 2026.

# Estado por servidor seleccionado — 2026-10-01

## Alcance y resultado

Revisión de las secciones de LUXIPANEL solicitadas: notificaciones, configuración de módulos, proveedores IA CLI, estadísticas, configuración global, cachés y ejecuciones. La selección del lateral izquierdo determina el executor de las APIs autenticadas y de los comandos remotos.

Se corrigieron lecturas y escrituras ancladas al host del panel, conexiones sin la cabecera de la pestaña y registros de ejecuciones que compartían únicamente el ID de conversación. Los cambios se publicaron el **2026-10-01 a las 10:21 (America/Bogota)**, después de que el usuario solicitara el despliegue.

| Sección | Estado comprobado y cambios |
| --- | --- |
| Notificaciones | Historial, contador, lectura, borrado, preferencias de entrega y logs usan el executor del servidor. SSE filtra por servidor y destinatario. La campana envía la conexión de la pestaña tanto en HTTP como en el transporte SSE mediante `fetch`, limpia su estado al cambiar de servidor y descarta respuestas antiguas. |
| Configuración de módulos | Activación, orden, visibilidad y acceso HTTP/WS se consultan en el servidor seleccionado. Se retiraron los cambios de contexto al host del panel en las rutas de administración, `/api/me/modules`, módulos instalados, conectores, herramientas IA y configuración de caché. El catálogo estático continúa siendo código de la instalación. |
| Proveedores IA CLI | La configuración de proveedor está aislada por servidor y usuario; la comprobación del binario y los comandos CLI ya reciben el executor seleccionado. Se comprobó el aislamiento de configuración y uso con los repositorios reales. |
| Estadísticas | Uso de IA, cuota CLI y métricas de Monitor consultan el executor del servidor. El acceso WS de Monitor comprueba la activación del módulo en ese mismo destino. |
| Configuración global | Lectura, escritura y borrado pasan el executor explícito a `settingsRepository` y al archivo de configuración del servidor. Las imágenes nuevas de marca remota se guardan en `${LUXIPANEL_CONFIG_DIR}/branding`; sus previews autenticados incluyen la conexión y verifican el destino. |
| Cachés | Programación y métricas persistentes de cache-engine usan los archivos del servidor; su activación hereda la configuración de módulos de ese destino. Los contadores de notificaciones y las cachés efímeras de respuesta incluyen el servidor en la clave. |
| Ejecuciones | Los comandos CLI se ejecutan mediante SSH en el destino. El registro de turnos, suscripciones, parada, prompts de aprobación y trabajos CLI separa servidor e ID. Los feeds y eventos de progreso de tareas filtran el servidor. Recuperación MCP verifica destino y propietario; una conexión HTTP explícita vencida produce `BRIDGE_SESSION_REQUIRED`, sin consultar el servidor de la cookie. |

## Dónde sigue corriendo el panel

El proceso Node de LUXIPANEL coordina las APIs, SSE/WS y registros de ejecuciones. Las cachés breves de respuesta y esos registros viven en su memoria, separados por servidor. Los archivos persistentes de las secciones anteriores y los procesos CLI pertenecen al destino. La inferencia API se realiza en el proveedor IA elegido.

El vault de conexiones, las identidades del panel, los registros de dispositivos y VAPID siguen siendo infraestructura de la instalación del panel. El login utiliza su marca pública; el workspace autenticado utiliza los ajustes del servidor conectado.
