<!-- documentation-status-20261013 -->
> **Documento histórico o de planificación.** Conserva propuestas, resultados y límites de su fecha; no acredita el estado ni la publicación actuales. Consultar la [referencia vigente](../README.md) y el código antes de ejecutar sus instrucciones. Clasificado el 13 de octubre de 2026.

# Revisión de solicitudes y carga de LUXIPANEL

Implementación publicada entre el 30 de septiembre y el 1 de octubre de 2026 UTC. Hora local: 30 de septiembre, Bogotá. APIs antes que los clientes. Sin commits ni push. Se conservaron los cambios ajenos y la arquitectura web activa mediante publicaciones selectivas; no se sustituyó producción por todo el árbol de trabajo.

## Comportamiento implementado

| Área | Resultado |
| --- | --- |
| Principal y asistente | Solo el proveedor visible inicia lecturas. Agentes, roles, proyectos, configuración y conectores usan `/api/ai/bootstrap`; compatibilidad con servidores anteriores. |
| Historial | Una petición inicial, 15 conversaciones; cursor estable por identidad, servidor y filtros. Otra página únicamente por desplazamiento real o acción explícita. Sin recorrer automáticamente todo el historial. |
| Grupos | Proyectos/agentes consultan su página al abrir el grupo. Los totales se calculan sobre metadatos autorizados, sin leer los mensajes de cada chat. |
| Apertura | `/messages?include=meta,session,context` reúne mensajes, metadatos, contexto y sesiones. Las tareas de equipo siguen siendo una lectura independiente del chat seleccionado. |
| Búsqueda | Índice persistente incremental de mensajes, reconstrucción en segundo plano, indicador de indexado incompleto en 12 idiomas y reintento explícito. No sondeos automáticos del índice. |
| Caché | Deducción de GET pendientes y caché de 20 s solo para rutas autorizadas explícitamente; claves incluyen sesión, servidor y cabeceras. Mutaciones, logout y cambios de ámbito invalidan; respuestas anteriores se descartan. Datos vivos comparten solo solicitudes pendientes (TTL 0). |
| Recarga web | Bootstrap saneado conserva su expiración original durante 20 s en sessionStorage de la misma pestaña. Cambio de identidad o servidor impide reutilización. No se persisten historiales ni transcripciones. |
| Hosting | Una página inicial de 10 filas, filtro y orden en servidor, resumen y totales completos. Eliminado el bucle de hasta 100 páginas de 100 cuentas. |
| Correo | Página inicial de 10 filas sin uso pesado; uso diferido de la misma página. Filtros/orden/totales autorizados en servidor. Selectores solicitan bajo demanda un catálogo mínimo completo para no limitar sus opciones a la página visible. |
| DataTable | Paginación/filtro/orden externos opcionales; preferencias 10/20/50/100, selección por ID, reinicio al cambiar datos, sin sumas parciales presentadas como totales. |
| Ajustes/conectores | Estado agregado y saneado, sin secretos ni pruebas remotas de cada proveedor; detalles de edición conservan sus endpoints. |
| Iconos/JS | Sustituida la fuente Tabler completa por SVG críticos (~21 KB gzip); iconos raros bajo demanda. Monaco no se precarga en la primera vista; sus assets y Mermaid conservan carga diferida. |
| Android | Historial y grupos por páginas de 15; consultas agrupadas, invalidación y pausa de lecturas en módulos ocultos. Sesiones directas conservan transporte directo. Usuarios y Copias respetan visibilidad. |
| Windows | Asistente directo y administrado con páginas de 15, grupos bajo demanda, bootstrap, apertura agrupada y pausa de lecturas ocultas. Mantiene streams y sesiones. |
| Proxy administrado | Admite rutas completas o relativas y conserva query/cursor después de validar la ruta; mantiene propiedad del servidor. Rechaza escapes de namespace. |

## Revisión del resto de módulos

La revisión extendió la coordinación de lecturas a consumidores de catálogos y tablas mediante el cliente común. Se conservaron los contratos propios de cada módulo:

- Mensajería interna: una lista HTTP, con tres lecturas independientes de repositorio/directorio en paralelo; no una petición por conversación. Mensajes consultados al abrir. Presencia, unread y streams permanecen vivos.
- Usuarios/roles, Copias, Cron, Webhooks, NGINX, Bases de datos, Firewall y Obsidian: lecturas equivalentes autorizadas comparten caché breve; no se precargan APIs de módulos ocultos. Catálogos de recursos del sistema conservan su respuesta completa cuando las acciones y selectores la necesitan.
- Archivos/SQL: apertura y consultas explícitas; no se almacenan lecturas arbitrarias de archivos ni resultados SQL en la nueva caché.
- Monitor: lecturas vivas no se convierten en snapshots de 20 s; la pausa por visibilidad conserva alertas y recursos activos.
- Ajustes, Expo, NGINX, Copias y Obsidian conservan la carga progresiva ya publicada y documentada en `module-loading-2026-09-29.md`.

La paginación en servidor se añadió a las colecciones crecientes identificadas (historial, Correo y Hosting). No se convirtió todo catálogo finito de sistema en una tabla paginada. Esta revisión no representa QA funcional de todas las operaciones de todos los módulos.
