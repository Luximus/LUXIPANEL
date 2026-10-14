<!-- documentation-status-20261013 -->
> **Documento histórico o de planificación.** Conserva propuestas, resultados y límites de su fecha; no acredita el estado ni la publicación actuales. Consultar la [referencia vigente](../README.md) y el código antes de ejecutar sus instrucciones. Clasificado el 13 de octubre de 2026.

# Mejoras de módulos — 2026-09-28

Los nueve módulos usan el drawer de configuración del topbar. Las preferencias
de tabla y selección se separan por usuario y servidor; las reglas operativas
viven en el servidor activo y requieren sus permisos de administración.

| Módulo | Flujo añadido | Conexión con otros módulos |
| --- | --- | --- |
| Expo | Proyecto seleccionado persistente y estado de preparación de credenciales | Archivos, Asistente, GitHub |
| Desarrollo de módulos | Pasos de publicación y bloqueo de acciones con catálogo obsoleto | Asistente, Grafo, Archivos |
| Grafo del código | Consultas de lectura por proyecto del Asistente; visor original local para admin | Asistente, Archivos |
| Firewall | Filtro de reglas, borrado verificado por contenido y nivel de registro UFW | BitNinja, Cloudflare |
| BitNinja | Estado recuperable, logs recientes, instalación con licencia guardada | Firewall, Ajustes |
| Bases de datos | Alta guiada, alcance y cupo de hosting, sin SQL libre para tenants | Hosting, Backups, Archivos |
| Cloudflare | Zona persistente y diagnóstico de activación/nameservers | Firewall, Webhooks, Ajustes |
| Webhooks | Historial de entregas, prueba por destino, eventos reales de correo/HTTPS | Correo, NGINX, Cloudflare |
| Hosting | Error de carga y reintento, valores predeterminados por servidor | Bases de datos, NGINX, Correo |

## Correcciones tras la revisión en producción

- Grafo: el visor visual vuelve a ser la vista principal para administradores del servidor local. El proxy `/cgraph/` conserva la autorización de administrador y permite sus acciones de indexación y disposición, que quedaron bloqueadas al restringir todos los métodos a GET.
- Dev de módulos: un panel local sin identidad de LP muestra sus vínculos, validación, tests y previews sin devolver `MODULE_DEV_NO_HOST`. El API indica `marketplaceAvailable: false` y rechaza las acciones de publicación con un error explícito. Las sesiones remotas sin host confiable continúan cerradas.
- Todos los drawers de configuración del topbar muestran el texto «Configuración» en su botón, también en pantallas estrechas. El título interno del drawer sigue indicando el módulo.
- El manejador central mantiene oculto el mensaje de errores inesperados cuando `NODE_ENV` pasa a producción después de cargar la configuración.

## Siguientes mejoras útiles

1. Credenciales de aplicación para cada base de datos de hosting: crear un
   usuario SQL con privilegios limitados y mostrarlo una sola vez. El alta
   actual crea el esquema; el acceso de la aplicación se configura aparte.
2. Métricas y reintento selectivo de entregas fallidas de Webhooks con límites
   de frecuencia y auditoría del operador.
3. Alertas de expiración y deriva de DNS vinculadas a Cloudflare, NGINX y
   Notificaciones, basadas en lecturas de los tres módulos.
4. Panel de salud de Expo por proyecto con validación de credenciales y
   vínculos directos a compilaciones, secretos y publicación.
