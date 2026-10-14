# App móvil LUXIPANEL: pantallas nativas

**Directriz del propietario (2026-07-13):** las pantallas de la app móvil deben ser nativas; no se debe incrustar el panel web. Esta regla no cambia la implementación de `desktop/`.

## Estado del código (2026-10-03)

- Los 27 destinos oficiales anunciados por `NATIVE_MODULE_IDS` tienen una ruta explícita a un componente React Native en `src/screens/main/native-module-view.tsx`.
- El selector y los accesos directos abren esas vistas. Los módulos sin pantalla nativa no se anuncian ni abren una página web. La comunidad se oculta hasta que el panel publique una ruta/API operativa para módulos personalizados.
- `SshScreen`, `ModuleWebViewScreen`, sus estilos/scripts y el render de WebView del `SessionHost` fueron retirados. `react-native-webview` se eliminó del manifiesto, del lockfile como paquete instalado y del parche de pnpm. Las rutas de navegación heredadas `Ssh`/`ModuleWebView` vuelven al dashboard nativo si aparecen en estado antiguo; las sesiones WebView persistidas se descartan al restaurar.
- El panel se consume por API directa del servidor conectado, con JWT y reautenticación controlada. El gateway retirado `/portal/servers/:id/api` no es el transporte de los módulos.
- El terminal de servidor usa WebSocket y un emulador React Native; el agente usa SSE desde `/api/ai/agent`. Blog, árbol de agentes y archivos se renderizan con componentes nativos.

## Cobertura funcional actual

Los 27 destinos oficiales tienen pantalla React Native. Se reutiliza la sesión directa del box y el handoff con sus credenciales guardadas; no se abre un segundo formulario de login al entrar en un módulo. Las pantallas conservan sus formularios al cambiar de destino o renovar el JWT, y se descartan al cerrar sesión, cambiar de cuenta o cambiar de servidor.

| Destino | Funciones nativas |
|---|---|
| Chat | Mensajería, conversaciones, grupos, llamadas y preferencias |
| Preferencias | Perfil, tema, idioma, presencia, TOTP, passkeys mediante enrolamiento del sistema, recuperación y auditoría |
| Asistente | Chat completo SSE, herramientas, aprobaciones, historial, proyectos, agentes, equipos, roles, proveedores, skills, conectores y terminal |
| Terminal | PTY directo, tmux, reconexión con ID estable, teclado, snippets, pestañas y scrollback |
| Usuarios | Usuarios, roles, matriz de permisos, grupos y capacidades de planes |
| Monitor | Métricas, procesos y reglas de alertas |
| Archivos | Explorador/editor, subida/descarga, permisos, privacidad, enlaces compartidos, snapshots, escáneres, archivos comprimidos, búsquedas, comparación, metadatos, proyectos, Git y ayuda de IA con cambios reversibles en el borrador |
| Alertas del servidor | Reglas, historial y configuración de notificaciones |
| Cron | Servicio, tareas clásicas/IA, ejecución, logs, validación, presets y cambios en varias tareas |
| Expo | Configuración, proyectos, cuenta/cuota, dependencias, builds/logs, entregas, variables, credenciales, OTA, dispositivos y cliente de desarrollo |
| Obsidian | Vaults, notas, edición, búsqueda y preferencias del editor |
| Correo | Buzones, mensajes, composición, dominios, routing/reenvíos, filtros, spam, firmas, cifrado, seguimiento de entrega y SMTP saliente |
| Módulos | Catálogo, estado y administración del registro de módulos |
| Ajustes | Configuración, seguridad, credenciales, apariencia, sistema, zona horaria, caché, integraciones, Git/SSH y registro de servidores |
| Firewall | UFW, reglas, logging, rangos Cloudflare, jails/ban/unban y auditoría de seguridad |
| BitNinja | Estado, instalación, configuración y controles |
| Nginx/DNS | Sitios, formularios static/PHP/proxy, previews, balanceo, configuración, rendimiento, logs y certificados/renovación |
| Backups | Historial, creación, descarga, destinos/credenciales, fuentes/DB, horarios, retención y cambio de carpeta con preview |
| Bases de datos | Motores, bases/tablas/columnas/filas, SQL, inserción/edición/eliminación por clave primaria y exportación SQL |
| Cloudflare | Cuenta/zonas, DNS, caché/purga, IP access rules y seguridad/SSL |
| Repositorios | Catálogo, favoritos, clones/vinculación, actualizaciones, detalles/README, token y preferencias |
| Webhooks | Webhooks/entregas, descubrimiento, receptores y estructura de datos, claves de acceso y claves API |
| OpenClaw | Estado, configuración y herramientas de control disponibles en su API |
| Hosting | Cuentas, cuotas, auditoría, planes y matriz de permisos, aislamiento y proveedores |
| Mis módulos | Publicación/revisión, checks/tests, manifests, previews/tools, proyecto y diagnóstico/reparaciones/aprobaciones |
| Mapa de proyectos | Mapa guardado/generación, estado, pestañas y diagramas de flujo SVG nativos |
| Grafo de código | Proyectos, búsqueda, trazas, snippets, arquitectura, cambios e indexación |

Las herramientas adicionales usan formularios nativos en `screens/server/native-extras`, integrados en el scaffold común. Las consultas paginan el dibujo de resultados grandes y los formularios leen antes de guardar configuración. Los módulos habilitados y las herramientas permitidas se consultan en `/api/me/modules`; el catálogo retirado de LP no se usa. Comunidad/custom queda fuera de esta entrega.

Diferencias de plataforma/contrato: passkeys usan el enrolamiento seguro en el navegador del sistema, sin incrustar una pantalla web; las contraseñas Linux siguen gestionadas externamente (el backend rechaza `/api/preferences/password`); el registro propio de servidores del asistente y `/api/settings/test-smtp` están retirados y se usan `/api/servers` y `/api/mail/outbound/test`. Los diagramas soportan el flowchart generado por el panel y permiten consultar su código. Las rutas y operaciones siguen los permisos, dependencias y módulos activados de cada box.

## Verificación (2026-10-03)

- TypeScript y 608 pruebas en 69 archivos pasan, incluyendo teclado/protocolo VT, autorización/reintentos, preservación de borradores, renovación/logout de JWT, exportación SQL y formularios de herramientas.
- No hay importación `react-native-webview` ni componente `<WebView` en `src` o dependencias de la app.
- Auditoría de lectura por HTTPS contra BACKEND de las APIs de módulos y herramientas. Los tokens QA se revocaron y no se modificó la configuración del servidor. La exploración de webhooks excedió el límite de 20 segundos de esa auditoría; la app permite reintentar y limita los tiempos de espera de las peticiones.
- Codex CLI real se abrió en un PTY temporal a través del WebSocket público y su salida se procesó con el motor usado por la app: Unicode, queries de terminal, pantalla alternativa y resize. Se cerró el PTY y se revocaron los tickets QA.
- Metro sirve el bundle Android actualizado en `metro.example.org`.
- No se hizo QA visual/táctil en un teléfono físico ni se publicó un APK/IPA. La validación en dispositivo Android/iOS sigue siendo necesaria; no se presenta la prueba de PTY como prueba visual del teléfono.

## Terminal directo — 2026-10-03

“New Terminal” conservaba el transporte retirado `/portal/ssh/terminal` y descartaba
la salida JSON del box. Ahora autentica con `/api/auth/ws-token` y conecta directo
a `/api/terminal/ws`, preservando el ID de consola al reconectar. New Terminal
abre directamente la consola: `ensureTerminalSession` autentica dentro de su
preflight usando sesión nativa o handoff LP con las credenciales ya guardadas
en la bóveda, y captura JWT/CSRF mediante XHR. No abre DirectPanelConnectScreen
ni un selector antes de la terminal. Varias consolas del mismo servidor comparten
el handoff en curso; cierre/logout/cambio de sesión descartan respuestas tardías.
El ticket viaja por POST al endpoint del mismo box; no se
descargan contraseñas ni llaves. En terminal, un fallo muestra reintento de la
credencial guardada, sin formulario de usuario/contraseña. La petición de conexión
renueva el token de cuenta ante HTTP401. Cerrar sesión de la cuenta
descarta los targets y las conexiones. Estado/instalación de tmux y cierre del PTY
usan las rutas `/api/terminal/*` del box. Cerrar el PTY no elimina una sesión tmux
detached: el endpoint actual del box solo cierra la sesión activa.

Validación de la conexión: 41 pruebas enfocadas, TypeScript y bundle Android servido por el Expo
activo; dos conexiones HTTPS/WebSocket públicas con salida real del shell en
`panel.example.org`, con tokens temporales revocados. El enlace
`metro.example.org` apunta a `mobile`,
tras reiniciar Metro con un caché nuevo propiedad de operator (el caché compartido
de `/tmp` contiene directorios sin permiso de borrado). Reemplaza el enlace
`ssbh25w-luxisoft-8081.exp.direct`.
Estos cambios son JavaScript y requieren recarga del cliente de desarrollo.

### Corrección de tamaño y teclado frente al navegador

La confirmación posterior del usuario mostró que Codex y la barra auxiliar
seguían mal. Se reprodujo el problema contra el PTY público: el `resize` enviado
en `WebSocket.onopen` llegaba durante el preflight del backend, antes de instalar
su listener, y se perdía. El backend no consume `cols`/`rows` del query. `stty size`
seguía devolviendo `24 80` mientras el emulador móvil tenía 48 columnas; Codex
mezclaba líneas. La app ahora vuelve a enviar el tamaño vigente al recibir
`connected`, también al re-adjuntar tmux, como hace el navegador. La misma prueba
devuelve `22 48` y conserva el dibujo después de reducir a `12 38`.

La barra auxiliar vuelve a aparecer solo con el teclado abierto. Se mide la
superficie real y se reserva únicamente la parte cubierta por el teclado,
conversión de coordenadas Android/inset superior incluida; una ventana ya
reducida no resta otra vez su altura. Las tres filas quedan sobre el teclado;
se retiró el pie permanente añadido anteriormente. El input oculto queda dentro
de la superficie, y la medición de fuente usa un ancho que evita wraps.

`NativeTerminalView` dibuja texto SVG nativo con posiciones explícitas por
columna; no usa párrafos RN con `numberOfLines` que recorten/elidan líneas.
La reproducción de la misma salida real de Codex en xterm del navegador y en el
motor de la app coincide en todas las filas y en el cursor en ambos tamaños.
También se revisó el componente SVG en Chromium con adaptadores de RN/SVG; esa
comparación visual no constituye QA en Android/iOS físico. TypeScript y 615
pruebas en 71 archivos pasan. El bundle del túnel vigente contiene estos cambios;
no se cambió el binario instalado ni se requiere WebView.
El canje nativo se probó también contra el endpoint público usando un ticket QA
temporal, con captura de CSRF, rechazo de replay y salida del shell; los tokens
se revocaron. Esa prueba no ejerció PAM ni la contraseña real del usuario.
Una prueba posterior del controlador desplegado `connectPanel`, con la credencial
ya cifrada del panel BACKEND y sin descargarla, devolvió HTTP200,
`authenticated:true` y handoff tras PAM correcto; se revocó su sesión QA.
No se creó un APK ni se hizo QA en teléfono físico.

## Regla de implementación

Las funciones nuevas del servidor se presentan con componentes React Native y APIs JSON/WebSocket/SSE. Para contenido rico se usan `MarkdownView`/`HtmlView`; para diagramas, `react-native-svg`. No se reintroduce una pantalla WebView como fallback.

## Motor VT — 2026-10-03

El parser parcial se sustituyó por `@xterm/headless@6.0.0` con `@xterm/addon-unicode-graphemes@0.4.0`, renderizando exclusivamente sus buffers con React Native. El parche de pnpm adapta las referencias de navegador de headless a `globalThis` y evita depender de `navigator.userAgent/platform` en React Native; no añade un DOM.

Se atienden DSR/DA, pantalla alternativa, scrollback con reflow, salida sincronizada, cursor, truecolor/ANSI y caracteres de varias columnas. Los spans se colocan por columnas para evitar desplazamientos por emojis o fallback de fuente. La fuente se mide, el grid se redimensiona con el área disponible, la barra de teclas ocupa su espacio y el PTY recibe resize. Enter se envía una vez como CR, las flechas respetan el modo de cursor y el pegado respeta bracketed paste. La conexión usa un plazo de handshake y reconexiones limitadas.

La sesión y el canje de credenciales son compartidos por los destinos nativos mediante `ensureDirectPanelSession`. La terminal hace su preflight en su propia consola desde el primer frame. Las demás pantallas muestran la conexión dentro del destino seleccionado; una renovación transitoria conserva los borradores.

## Workspace nativo alineado con el frontend móvil — 2026-10-04

La referencia es la publicación `sidebar-20261004-1` de LUXIPANEL, verificada
en `.cache/chat-sidebar-actions/public-qa.json` el 2026-10-04 a las 04:40 UTC.
El login autenticado abre `NativePanelWorkspace`: Chatbox persistente, último
panel/destino por cuenta, selección automática para un único panel y prioridad
para enlaces explícitos. El selector inicial aparece cuando falta elegir un
panel. La navegación se compone de historial izquierdo, menú derecho con
subvistas y barra inferior; los módulos se superponen sin desmontar el chat.

El historial conserva las acciones de nueva conversación/proyecto sobre el
selector de servidor y cierre de sesión. Usa logo e Inter locales, tarjetas con
un menú de opciones, navy en claro y mezcla de background/card en oscuro como
el CSS del frontend. El menú incluye sus 12 idiomas y respeta RTL; los textos
propios anteriores de módulos sin traducción alemana/bengalí usan inglés.

`WorkspaceServers` distingue paneles LP (crear/editar/eliminar con sus flujos
existentes) y destinos SSH de `/api/servers` (crear/editar/eliminar/probar,
aprobación explícita de huella y retorno a local). Abrir un módulo reutiliza
las credenciales existentes; editar un destino no devuelve ni rellena secretos.

Los transportes HTTP, archivos, SSE y WebSocket se separan por cuenta, panel y
destino mediante un ID opaco y bridge explícito. La renovación de JWT propaga
la sesión a los contextos hijos conservando sus bridges. Volver a seleccionar
un remoto renueva su bridge; la expiración no cambia automáticamente a local.
Los propietarios evitan destruir una conexión compartida al cerrar otra pestaña.
Se descartan conexiones canceladas y contextos cuyos paneles pierden acceso.

`NativeOverlayHost` eleva formularios anidados a la raíz de pantalla para evitar
que queden dentro de una fila; mantiene borradores y visibilidad del propietario.
Las respuestas de operaciones se presentan como tablas paginadas/campos
estructurados. El grafo nativo ofrece símbolos, código, arquitectura y diagramas
de relaciones obtenidos por trazas; no incrusta la interfaz web del grafo.

El terminal conserva los fixes de PTY listo/resize, motor xterm y texto SVG por
columna. Mantiene consolas independientes: Nueva terminal crea una nueva,
volver al chat las conserva y cerrar una consola elimina solo su PTY. La barra
auxiliar sigue usando el solapamiento real del teclado.

### Matriz de módulos

| ID del catálogo | Pantalla React Native |
|---|---|
| `chat` | `NativeMessagingScreen` |
| `preferences` | `NativePreferencesScreen` |
| `assistant` | `NativeAssistantWorkspace` |
| `terminal` | `NativeTerminalScreen` |
| `users` | `UsersScreen` |
| `monitor` | `MonitorScreen` |
| `files` | `FilesScreen` |
| `server-alerts` | `ServerAlertsScreen` |
| `cron` | `CronScreen` |
| `expo` | `ExpoScreen` |
| `obsidian` | `ObsidianScreen` |
| `mail` | `MailScreen` |
| `modules` | `ModulesViewScreen` |
| `settings` | `SettingsViewScreen` |
| `project-map` | `NativeProjectMapScreen` |
| `firewall` | `NativeFirewallScreen` |
| `backups` | `NativeBackupsScreen` |
| `databases` | `NativeDatabasesScreen` |
| `cloudflare` | `NativeCloudflareScreen` |
| `webhooks` | `NativeWebhooksScreen` |
| `dns` | `NativeNginxScreen` |
| `bitninja` | `NativeBitNinjaScreen` |
| `openclaw` | `NativeOpenClawScreen` |
| `codebase-graph` | `NativeCodebaseGraphScreen` |
| `repository-store` | `NativeRepositoryStoreScreen` |
| `hosting` | `NativeHostingScreen` |
| `module-dev` | `NativeModuleDevScreen` |

### Verificación

- TypeScript sin errores; 627 pruebas en 75 archivos.
- WorkspaceSurface/ConvoRow reales con adaptador RN/DOM y datos de prueba:
  320/390 px, temas claro/oscuro, historial, menús y subvistas; botones fijos
  visibles, sin desbordamiento horizontal ni errores de ejecución.
- Reproducción de salida real de Codex: grid y cursor idénticos a xterm de
  navegador en 48×22 y 38×12.
- Evidencia en `/home/panel/luxipanel-native-workspace-parity-20261004/`.
- No constituye prueba táctil ni de teclado en teléfono físico. Los bundles
  Metro Android/iOS se comprueban aparte; no se generó/publicó un APK/IPA ni
  se desplegó un backend/frontend por esta implementación.

Bundles completos Metro (`lazy=false`) Android e iOS comprobados después de
los cambios, con marcadores del workspace, overlays, bridges y fuente Inter.
El manifiesto público responde en `https://metro.example.org`,
SDK 54, cliente nativo 1.0.9. Hashes y tamaños en `validation.json` de la
carpeta de evidencia. El enlace anterior `ssbh25w` no identifica este túnel.
