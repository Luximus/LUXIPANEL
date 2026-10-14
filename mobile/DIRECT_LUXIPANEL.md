# LUXIPANEL móvil 1.0.11

Entrada activa: `App.tsx` → `src/screens/DirectPanelApp.tsx`. Conecta directamente a un LUXIPANEL ya desplegado por URL, con usuario del panel/Linux, sin portal LP ni botones de login Google/Apple. Los 27 módulos del workspace siguen siendo React Native. El engranaje alterna entre el login y el formulario de conexiones en la misma tarjeta, con transición nativa; si no hay conexiones guardadas, el formulario aparece directamente. El selector de servidor queda integrado en el login. Solo hace falta escribir el dominio (HTTPS automático). El logo se obtiene del servidor seleccionado y usa el logo incluido si no hay configuración o la imagen falla; Recordarme persiste JWT/CSRF en SecureStore, no contraseña.

Contraseña y 2FA usan las APIs del panel. La recuperación mediante códigos 2FA no es un restablecimiento de contraseña Linux por email. Passkeys/CAPTCHA abren el login real en navegador del sistema y regresan por PKCE a `luxipanel://auth/callback`. Este camino y las sesiones SSH nativas independientes necesitan el complemento descrito en `/var/www/LUXIPANEL/docs/clients-direct-2026-10-04.md`; la disponibilidad se comprueba por capacidades del servidor conectado; el informe fechado no acredita el estado de despliegue actual. Se comprueban capacidades antes del switch SSH para proteger la sesión en servidores antiguos.

```sh
NODE_OPTIONS=--max-old-space-size=2560 pnpm exec tsc --noEmit
pnpm test
bash scripts/eas.sh build --profile preview --platform android --non-interactive --no-wait
```

Preview genera un APK de distribución interna con el keystore existente, sin submit ni publicación en LP. `build:preview` no sincroniza variables sociales. Firebase app se conserva para la infraestructura nativa existente de notificaciones; los plugins/botones de Google y Apple ya no forman parte de esta entrada. Los paquetes y pantallas antiguas no montadas se conservan para evitar tocar trabajo ajeno.

La referencia de layout móvil es el frontend publicado el 4 de octubre (mobile-refine): topbar Notificaciones/Servidor/Mensajes/Buscar; barra inferior Historial/Proyecto/Terminal/Multimedia/Módulos; selectores Aprobación/Proveedor/Modelo/Razonamiento; avatar en menú derecho y ajustes/logout junto a fecha en historial. Multimedia maneja IDs de adjuntos reales, filtros, preview, descarga y reutilización en chat, con páginas explícitas.

Pruebas y compilación no sustituyen QA físico de Android, biometría real, PAM ni PTY SSH. APK, manifiesto y checksums finales: `/var/www/LUXIPANEL/.cache/direct-clients-20261004/artifacts/`.

El fondo conserva el estilo Pixel Snow mediante tres capas nativas ligeras, sin ray marching, y avanza en cada fotograma de la UI. La transición claro/oscuro mantiene el reveal circular y responde con una curva de salida más inmediata. Movimiento reducido y segundo plano detienen las animaciones ambientales. La fluidez física se confirma en el dispositivo; las pruebas y renders Skia locales no miden FPS Android.
