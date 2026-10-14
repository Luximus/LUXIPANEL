<!-- documentation-status-20261013 -->
> **Documento histórico o de planificación.** Conserva propuestas, resultados y límites de su fecha; no acredita el estado ni la publicación actuales. Consultar la [referencia vigente](../README.md) y el código antes de ejecutar sus instrucciones. Clasificado el 13 de octubre de 2026.

# Clientes directos de LUXIPANEL — 4 de octubre de 2026

## Estado y alcance

Implementación de pruebas autorizada: fuentes aplicadas en `desktop` y `mobile`. La ruta solicitada `/var/www/app` no existe; se usó el proyecto móvil existente. No se publicó en tiendas, no se registró una versión de distribución en LP, no se hicieron commits/push ni se reiniciaron servicios LUXIPANEL.

Desktop 1.0.5 muestra el frontend realmente servido por el LUXIPANEL elegido, incluido `/login`, en vistas Electron independientes. Por eso sus menús, pantallas y cambios futuros son los de ese servidor. La aplicación local aporta pestañas y el drawer de conexiones. No inicia el portal LP ni sus proveedores sociales.

Móvil 1.0.10 conserva el workspace y los 27 módulos React Native existentes. Entrada directa con usuario del panel, contraseña, recuperación o 2FA; login y textos copiados de las 12 traducciones web. Se actualizaron topbar, menú inferior, avatar, historial y selectores del compositor según el frontend móvil publicado. Paleta/logo vienen de `/api/public/layout`. Configuración local por icono de engranaje, conexiones múltiples y última conexión recordada. No se montan módulos HTML ni WebView.

El acceso es a un LUXIPANEL ya instalado, con una URL accesible desde el dispositivo. El drawer admite dominio o IP/puerto y `http://` explícito cuando corresponde; comprueba `/api/auth/login-methods` antes de guardar. Este flujo no instala servidores ni pide credenciales del portal LP.

## Requisitos del servidor y compatibilidad

Desktop usa el login web actual y no necesita el complemento nuevo. El login móvil por contraseña y los módulos locales usan APIs actuales del panel. Dos funciones móviles necesitan publicar el complemento de esta sesión en el LUXIPANEL conectado:

1. Autenticación en navegador del sistema (passkeys o contraseña protegida por CAPTCHA).
2. Targets SSH independientes de la sesión local, sin invalidar el JWT/PTY de otros contextos.

El complemento está preparado en **fuentes**, sin compilación ni publicación en producción. La app comprueba capacidades antes de abrir un target SSH; si el servidor antiguo no las anuncia, informa de la actualización necesaria sin llamar al switch que revocaría la sesión actual. Passkeys/CAPTCHA muestran el aviso de actualización si el inicio nativo devuelve 404.

Archivos del complemento:

- `backend/src/modules/auth/controllers/native-auth.controller.ts`
- `backend/src/modules/auth/services/native-auth.service.ts`
- `backend/src/modules/auth/services/native-auth.service.test.ts`
- `backend/src/modules/auth/routes/auth.routes.ts` (cuatro rutas nuevas)
- `backend/src/modules/servers/controllers/target-switch.controller.ts` y su prueba (modo context)
- `frontend/src/pages/login.astro`
- `frontend/src/scripts/extracted/pages/login-define-vars-script1.ts`
- `frontend/src/scripts/extracted/pages/login.native.test.ts`

Se deben revisar e integrar esos cambios sobre la versión del servidor destino. Hay muchas diferencias previas en este checkout; no copiar toda la carpeta ni ejecutar un build/redeploy global de producción solo para instalar este complemento. Publicar backend y login web coordinadamente mediante el procedimiento normal del servidor, con respaldo de sus artefactos, y actualizar el import versionado del script de login. Esta sesión no autoriza esa publicación.

## Contrato nativo

| Operación | Contrato |
| --- | --- |
| `GET /api/auth/native/capabilities` | `{ok:true,data:{browserLogin:"pkce-s256-v1",workspaceContext:true}}`; sin caché. |
| `POST /api/auth/native/start` | `{state,codeChallenge,codeChallengeMethod:"S256",language}`. Responde `authorizationUrl` del mismo origen y expiración; TTL 300 s. |
| `POST /api/auth/native/authorize` | `{requestId}`, sesión completa y CSRF. El login web llama tras todos los factores o una sesión completa existente. Devuelve un callback fijo con código y state; código TTL 60 s. |
| `POST /api/auth/native/redeem` | `{code,state,codeVerifier}`. Origen y PKCE verificados. Uso único atómico, incluso ante prueba inválida. Devuelve JWT nuevo en POST y cookie CSRF. |
| `POST /api/servers/:id/switch` | `{sessionMode:"context"}` pasa las mismas validaciones de usuario/target/host/fingerprint y crea un bridge sin rotar la sesión base. El cliente envía `X-Bridge-Session-Id` explícito en cada contexto. |

Callback único: `luxipanel://auth/callback?code=…&state=…`. No acepta callback arbitrario ni lleva JWT, contraseña o verificador en la URL. Los valores state/verifier son 32 bytes aleatorios y el challenge es SHA-256. La autorización exige sesión completa; MFA pendiente, sesiones MCP y invitados externos se rechazan. Redis conserva la sesión origen cifrada con AES-GCM hasta el canje. El canje genera JTI y bridge independientes, conserva permisos y vencimiento del origen y comprueba revocación.

## Ciclo de vida de clientes

Desktop: perfil = partición Chromium persistente propia; dos perfiles del mismo origen siguen aislados. Abrir ajustes o cambiar de pestaña conserva la vista remota. Cambiar origen del perfil genera otra partición y borra almacenamiento del anterior. Las páginas remotas tienen sandbox/context isolation, sin Node ni preload privilegiado. IPC solo disponible a las vistas locales y su frame principal. Navegaciones externas HTTP(S) van al navegador del sistema. Selector de archivos y descargas usan Electron; micrófono/notificaciones piden permiso. No se guarda JWT/contraseña en el archivo local de perfiles.

Móvil: JWT/CSRF en memoria; sesión persistida en SecureStore solo con Recordarme. La nueva entrada no guarda contraseñas y elimina las antiguas al limpiar la sesión. No usa el cookie jar global para JSON, SSE, subida o binarios: autenticación y bridge se envían explícitamente. Cada workspace se acota por perfil, identidad y target. Renovar el JWT propaga credenciales sin reiniciar formularios; cerrar sesión o cambiar de perfil limpia stores, streams y contextos y descarta respuestas tardías. Una sesión expirada muestra reingreso sin borrar el borrador hasta que se solicita.

Multimedia reconoce referencias persistidas `{id,name,mimeType}`, construye `/api/ai/attachments/:id`, rechaza URLs de otro origen y deduplica archivos. Lista páginas de 100 mensajes; el usuario solicita las anteriores. Filtros Todo/Imágenes/Documentos, vista previa con anterior/siguiente, descarga/compartir y reutilización en chat usan el contexto autenticado. Las copias temporales compartidas se eliminan después. Reutilizar un adjunto respeta los límites existentes del compositor.

## Verificación y límites

- Móvil: 654 pruebas en 79 archivos y TypeScript sin errores. Cuatro pruebas de la entrada real cubren MFA, login tardío, token renovado y logout tardío. Recuento final en `validation.json` de la entrega.
- Desktop: build TypeScript/Vite, diez pruebas de políticas y diez comprobaciones CDP del ejecutable empaquetado en Linux/Xvfb. Verificado arranque, probe, página remota, ausencia de privilegios, UA de navegador, clicks del drawer, conservación de inputs, almacenamiento aislado y disposición de pestañas. Usó un servidor fixture local sin credenciales reales.
- Complemento: typecheck backend, diez pruebas del servicio nativo, doce del switch y siete del login web.
- Las compilaciones Android son EAS `preview`, distribución interna APK, con el keystore existente. EXE generado con electron-builder para Windows x64. No se enviaron a tiendas ni al portal.
- No hubo prueba física Windows/Android, login PAM real, passkey/biometría física ni PTY SSH real con estas nuevas entradas. La app móvil adapta la interfaz a controles nativos; no es un espejo pixel a pixel del HTML. El backend/login de producción sigue sin el complemento hasta una publicación posterior autorizada.

La evidencia local, manifiesto de fuentes, resultados y checksums están en `/var/www/LUXIPANEL/.cache/direct-clients-20261004/`. Los respaldos `baseline/` son históricos parciales: algunos archivos nuevos o revisados se respaldaron en iteraciones posteriores; no usarlos como rollback completo del repositorio.

## Artefactos de prueba finales

- Windows: `/var/www/LUXIPANEL/.cache/direct-clients-20261004/artifacts/LUXIPANEL-Desktop-1.0.5.exe` (app x64; instalador NSIS).
- Android: `/var/www/LUXIPANEL/.cache/direct-clients-20261004/artifacts/LUXIPANEL-1.0.10-v27.apk` (paquete `com.luxisoft.lxpanel`, versionCode 27, firma APK v2 verificada).
- APK final EAS interno: `cb44d1bc-333f-4c22-9d8a-5c06e8c5c684`; build anterior 25 superado, 26 cancelado. Solo el 27 se entrega.
- Checksums: `artifacts/SHA256SUMS`; resultados: `validation.json`.
