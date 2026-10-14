# Arquitectura móvil LUXIPANEL

Revisión: 2026-10-13. React Native y Expo. Entrada activa: `App.tsx` → `src/screens/DirectPanelApp.tsx`. [Guía directa](DIRECT_LUXIPANEL.md), [infraestructura](../INFRA_LUXIPANEL.md).

## Conexión y sesión

El usuario configura nombre y URL de un panel instalado y entra con usuario Linux. No inicia esta aplicación pasando por el portal comercial ni por botones sociales de LP. `src/api/directAuth.ts` resuelve login, métodos, refresco y desafíos; `nativeBrowserAuth.ts` coordina el handoff PKCE. `src/storage/standaloneServers.ts` gestiona perfiles y sesiones. Recordarme conserva sesión en almacenamiento seguro, no la contraseña Linux.

`serverApi.ts` registra transportes directos y separa el destino seleccionado. Las sesiones SSH requieren las capacidades del panel; no fabricar soporte si la versión no lo anuncia. La renovación de autenticación no debe mezclar targets ni perder el contexto de una conexión. Recuperación 2FA mediante códigos es distinta de recuperación de contraseña Linux por email.

## Workspace y módulos

`NativePanelWorkspace` compone el workspace persistente y `NativeOverlayHost` aloja formularios/capas. `ServerCallHost` mantiene las llamadas. Los módulos usan pantallas React Native y APIs del panel, no una copia del inventario LP. `workspaceContext.ts` separa contexto y cachés por identidad, panel y destino. Los formularios deben conservar borrador y scroll cuando el diseño lo requiere, sin bloquear cierre en una petición remota.

Asistente, terminal, archivos, multimedia y otras áreas tienen transportes/estado propios; no desmontar una sesión en vivo solo por cambiar de vista. `src/api`, `features`, `lib`, `screens` y `components` separan transporte, lógica y presentación. La existencia de pantallas antiguas de portal, soporte o pagos no implica que estén montadas por `DirectPanelApp`.

## Seguridad y publicación

Validar destino antes de enviar credenciales; no guardar contraseñas en AsyncStorage ni registrar tokens. Probar expiración, cambio de perfil, 2FA, cancelación de navegador y capacidades SSH ausentes. Los endpoints protegidos siguen sujetos a roles y clave de cuenta cuando el servidor la exige.

TypeScript y pruebas se ejecutan mediante scripts del paquete. EAS, APK, submit y OTA son operaciones de publicación independientes; no ejecutarlas por cambios de documentación. El código y pruebas locales no certifican comportamiento de PAM, biometría o PTY en dispositivo físico. Versiones publicadas se verifican en sus manifiestos/tiendas, no por el nombre de un archivo antiguo.
