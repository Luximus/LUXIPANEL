# LUXIPANEL Desktop 1.0.5

El runtime activo es `electron/main.cjs` + `panel-preload.cjs` y `src/App.tsx`. El frontend del LUXIPANEL conectado se abre en WebContentsView sin Node/preload, dentro de una partición Chromium por perfil. Los módulos y login son los que sirve ese servidor; las antiguas pantallas LP/Firebase permanecen en fuente pero no se montan.

Usar el engranaje para guardar nombre y URL de un LUXIPANEL desplegado, probar conexión y abrir una pestaña. Varias pestañas de un perfil comparten su sesión, como en un navegador. Perfiles distintos quedan aislados. Cambiar la URL del perfil elimina su almacenamiento anterior. Ctrl+, abre configuración y Ctrl+R recarga. Al cerrar la ventana se conserva la bandeja; Salir termina la app.

```sh
pnpm run build
pnpm exec vitest run src/lib/panel-policy.test.ts
pnpm exec electron-builder --win --x64 --linux dir
```

No hacen falta variables de login social para este build. El EXE de prueba está en `release/LUXIPANEL Desktop Setup 1.0.5.exe`. No se publicó una actualización automática ni se ejecutó el EXE en Windows físico. La comprobación empaquetada se hizo en Linux/Xvfb con un fixture local.

Complemento de servidor, contratos y límites: `/var/www/LUXIPANEL/docs/clients-direct-2026-10-04.md`. El desktop usa el login web vigente sin requerir el complemento de autenticación móvil.
