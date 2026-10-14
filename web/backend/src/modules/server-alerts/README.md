# Notificaciones del servidor

El módulo entrega avisos en la campana del panel y, si el usuario lo habilita, por Web Push y por la app móvil (Expo Push). La entrega y las preferencias residen en LUXIPANEL.

## Experiencia

- El topbar muestra **Notificaciones** junto a **Configuración**.
- El drawer **Configuración de notificaciones** reúne preferencias personales, canales y ajustes de tablas.
- Cada usuario elige las categorías que recibe por servidor (`manual`, `scheduled`, `rules`) y sus canales (`web`, `mobile`). El interruptor general pausa los avisos de ese servidor.
- Los administradores envían avisos y gestionan programaciones y reglas. Los demás usuarios consultan su historial y ajustan sus preferencias.
- **Enviar prueba** dirige un aviso solo al usuario actual. El **Historial** distingue almacenamiento en el panel, aceptación por proveedor y fallos. `accepted` significa que el proveedor recibió el envío; no confirma que el dispositivo lo haya mostrado.
- La campana guarda lectura y ocultación de avisos globales por usuario.

## Persistencia y trabajador

`scheduled.json` y `rules.json` se guardan mediante el ejecutor del servidor seleccionado. En el host del panel se guardan `user-preferences.json`, `devices.json`, `vapid.json` y `delivery-log.json`. Los tokens y las suscripciones se cifran mediante el vault de servidores.

El trabajador evalúa el host local y los servidores remotos registrados con conexión de vault. Los avisos puntuales usan `scheduleAt` ISO. Los cron nuevos guardan una zona horaria IANA del usuario; los cron antiguos sin `timeZone` siguen en UTC. Una regla o programación solo marca su ejecución si al menos un aviso se guardó en la campana. Las reglas métricas reutilizan la recolección de monitor y aplican su cooldown.

## API

Todas las rutas requieren autenticación y acceso al módulo. Las mutaciones usan CSRF. El servidor seleccionado se obtiene del ejecutor de la sesión.

| Método | Ruta | Uso |
|---|---|---|
| GET, PUT | `/api/server-alerts/me/preferences` | Preferencias propias del servidor seleccionado |
| GET | `/api/server-alerts/channels` | Clave pública VAPID y cantidades de dispositivos |
| POST | `/api/server-alerts/devices/web` | Registrar suscripción Web Push |
| POST | `/api/server-alerts/devices/mobile` | Registrar token Expo Push |
| DELETE | `/api/server-alerts/devices/:channel` | Quitar un dispositivo propio |
| GET | `/api/server-alerts/history` | Historial paginado; `scope=all` para administradores |
| POST | `/api/server-alerts/test` | Aviso de prueba para la cuenta actual |
| POST | `/api/server-alerts/send` | Enviar aviso manual (administrador) |
| GET, POST | `/api/server-alerts/scheduled` | Listar y crear programaciones; crear requiere administrador |
| PUT, DELETE | `/api/server-alerts/scheduled/:id` | Editar y eliminar programación (administrador) |
| GET, POST | `/api/server-alerts/rules` | Listar y crear reglas; crear requiere administrador |
| PUT, DELETE | `/api/server-alerts/rules/:id` | Editar y eliminar regla (administrador) |

`/api/server-alerts/prefs` conserva compatibilidad para clientes antiguos. Los antiguos umbrales CPU/RAM/disco se rechazan explícitamente porque ahora se configuran mediante reglas.

## Límites operativos

Web Push admite endpoints públicos HTTPS de Mozilla, Google, Apple y Microsoft. El navegador necesita permiso del usuario y un Service Worker activo. Los tokens de la app se registran al conectar un panel directamente. La entrega Expo registra la aceptación del ticket; el acuse final del dispositivo no forma parte del historial.
