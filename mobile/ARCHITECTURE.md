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


### Voz del coordinador IA (2026-10-15)
El botón de audio de ChatComposer cambia con `voice.realtimeEnabled`; no se añade un botón paralelo ni selector de proyectos/equipos. Se inicia con la conversación del proyecto actual y los agentes ya asociados; la preparación también bloquea el envío de texto. `features/assistant/realtime-voice` mantiene una sesión global fuera del ciclo de vida de la pantalla, audio PCM por WebSocket autenticado y un bloqueo del envío textual por panel. Las notas de voz conservan el borrador y sus adjuntos; silenciar el audio no permite enviar texto. La cola ya aceptada se pausa sin extraer mensajes mientras cualquier canal de voz está activo y se reanuda al liberarse el último bloqueo, incluso sin la pantalla montada.
Se inicia con la app en primer plano y permiso de micrófono. Android utiliza el servicio de micrófono y su notificación persistente de react-native-audio-api; iOS usa playAndRecord/voiceChat y background audio. La renovación cada 14 minutos conserva el capturador nativo y obtiene una credencial WebSocket vigente. Las interrupciones del sistema silencian la entrada; la reactivación es explícita. Las llamadas del servidor y la voz del asistente no pueden tomar simultáneamente el micrófono.
Reutiliza react-native-audio-api y los permisos de audio que ya estaban configurados en el cliente de desarrollo; no añade módulos nativos ni requiere generar APK para entregar este cambio por QR. El transporte PCM de 24 kHz envía audio al backend, que controla OpenAI y las herramientas. Las pruebas comprueban aislamiento, silencio, reconexión y bloqueo de texto; se verificó audio sintético con OpenAI real. Audio del teléfono, Bluetooth, pantalla bloqueada y restricciones de batería siguen requiriendo comprobación física. Detener la voz cierra el micrófono y el canal, sin cancelar tareas aceptadas. No publicar APK, EAS u OTA para esta tarea.

La voz también está disponible en chats generales sin proyecto: el backend mantiene projectId=null, el agente del chat o su asistente predeterminado, y las mismas aprobaciones por botones. Este ajuste de alcance no requiere otra build nativa ni cambios en el QR existente.

### Historial y controles de voz (2026-10-15)
ChatComposer ya no monta un panel independiente de voz. El botón original y su placeholder reflejan el estado; silenciar está en el menú de audio. RealtimeActivity muestra únicamente trabajo real y solicitudes de aprobación dentro del historial, recupera las tareas persistidas y actualiza los mensajes al recibir transcripciones guardadas. Al cerrar el micrófono quedan accesibles tareas y botones del trabajador. La sesión visual exige panelId y conversationId, y las respuestas de preparación tardías no pueden abrir otro chat. Navegar explícitamente cierra la captura; pasar a segundo plano o bloquear la pantalla conserva el audio nativo. Se usa el dev-client y QR existente, sin generar APK.

### Resúmenes del asistente (2026-10-17)

El historial y el reductor SSE conservan displaySummary como dato opcional, separado del contenido completo. CompactAnswer presenta un Text de dos líneas y un control accesible para desplegar el detalle; la misma proyección portable de la web admite mensajes anteriores y el resumen raíz de TOON. Las preguntas y aprobaciones siguen usando sus componentes habituales. Este cambio de código requiere una futura entrega del cliente nativo para llegar a instalaciones móviles existentes.
