# Arquitectura LUXIPANEL Desktop

Revisión: 2026-10-13. Electron y shell React/Vite. Entrada activa: `electron/main.cjs`, `electron/panel-preload.cjs` y `src/App.tsx`. [Uso directo](DIRECT_LUXIPANEL.md).

## Responsabilidades

El proceso principal controla ventanas, perfiles, pestañas, navegación y almacenamiento Chromium. El renderer local usa `window.panelDesktop` para listar, probar, guardar y abrir perfiles. El contenido remoto es una `WebContentsView` sin Node ni preload privilegiado. El shell no debe exponer su puente IPC al contenido del servidor.

Desktop abre la interfaz web del LUXIPANEL seleccionado. El login, módulos, permisos y funcionamiento pertenecen a esa versión del servidor. No se monta el antiguo portal LP/Firebase ni una segunda implementación nativa de todos los módulos. Las pantallas antiguas conservadas en `src/screens` no definen el runtime.

## Perfiles y ciclo de vida

Cada perfil define nombre y URL. Las pestañas del mismo perfil comparten partición/sesión; perfiles diferentes se aíslan. Cambiar URL limpia el almacenamiento anterior. Probar una URL antes de abrir evita confundir un sitio ajeno con un panel. El shell ofrece configuración, recarga y controles de ventana. Cerrar conserva la bandeja; Salir termina la aplicación.

## Pruebas y releases

La política de URL y navegación se comprueba en `src/lib/panel-policy.test.ts`. Verificar aislamiento entre perfiles, cierre de pestaña, cambio de URL, enlaces externos y errores de conexión. Un render de fixture Linux no acredita instalación real en Windows o macOS.

Consultar package.json y electron-builder para empaquetado. No generar ni publicar EXE/DMG por cambios documentales. Mantener compatibilidad con la web del panel, sin asumir paridad interna de componentes con la app React Native.
