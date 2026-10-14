<!-- documentation-status-20261013 -->
> **Documento histórico o de planificación.** Conserva propuestas, resultados y límites de su fecha; no acredita el estado ni la publicación actuales. Consultar la [referencia vigente](../README.md) y el código antes de ejecutar sus instrucciones. Clasificado el 13 de octubre de 2026.

# Carga del backend: autenticación por módulo

Se acotaron los middleware de sesión de siete routers montados en la raíz:
Correo, Usuarios/Grupos/Preferencias, Dashboard, Sudo, Notificaciones,
Mensajería y Jobs. Antes ejecutaban `requireAuth` incluso cuando la petición
pertenecía a otro módulo. Cada pasada verificaba JWT/Redis, resolvía bridge y
executor y comprobaba la autorización actual.

Según el orden de registro de `server.ts`, una petición de Mensajería atravesaba
seis puertas de sesión; ahora llega únicamente a la de Mensajería. Jobs pasaba
por siete. Se mantiene la validación actual de permisos en la puerta del módulo
que atiende la petición, además de los controles de acción, tenant y CSRF.
MCP ya está montado en `/api/mcp` y no necesitaba este cambio.
