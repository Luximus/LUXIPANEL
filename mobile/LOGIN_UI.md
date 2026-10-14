<!-- documentation-status-20261013 -->
> **Documento histórico o de planificación.** Conserva propuestas, resultados y límites de su fecha; no acredita el estado ni la publicación actuales. Consultar la [referencia vigente](../INFRA_LUXIPANEL.md) y el código antes de ejecutar sus instrucciones. Clasificado el 13 de octubre de 2026.

# Login móvil y transición global de tema — 2026-10-04

Fuentes: `mobile`. Versión 1.0.11, Expo SDK 54 / React Native 0.81.5. Distribución interna de prueba; no publicación en tiendas ni modificación del frontend/backend/desktop de producción.

## Comportamiento

- Login nativo renovado con Inter, logo del servidor o logo incluido, paleta por servidor, controles superiores de conexión/idioma/tema y tarjeta adaptable. Campos de 50 px, acciones de 54 px y controles táctiles de al menos 44 px.
- Contraseña, passkey/navegador, recuperación y 2FA conservan las APIs y la protección por generación del cliente directo. Autofill, siguiente campo, envío desde teclado, filtrado de seis dígitos, check de Recordarme, carga dentro del botón y avisos diferenciados de éxito/error. Copys reutilizados de los doce idiomas existentes.
- Conexiones en drawer: selección visible, perfiles, edición/borrado, prueba y guardado del LUXIPANEL desplegado. Sin servidor predeterminado añadido ni credenciales guardadas en la configuración.
- Fondo Pixel Snow adaptado a SkSL desde el shader web. Conserva cámara, perspectiva, formas y controles; usa hash flotante portable, opacidad y contraste ajustados al móvil. Respeta `layout_login_background_enabled` y los parámetros `layout_login_pixel_snow_*`. Otros efectos del catálogo usan Pixel Snow; no se portó todo el catálogo React Bits.
- Fondo hasta 30 actualizaciones por segundo, sin rerenders de React por frame; se detiene al salir del login, en segundo plano o con movimiento reducido.
- Transición global: snapshot temporal de Skia en memoria, una sola instancia de la pantalla, máscara circular invertida y revelado de 380 ms desde el centro del control. Captura y geometría usan la vista real; se conserva foco, estado y borradores. Las preferencias se persisten al aplicar el tema. Movimiento reducido/captura fallida aplican el tema inmediatamente; cambios de contexto, tamaño o AppState descartan capturas tardías.

## Dependencias e integración

`@shopify/react-native-skia` 2.2.12, `react-native-reanimated` 4.1.7 (rango SDK ~4.1.1) y `react-native-worklets` 0.5.1, instalados con Expo. Nueva arquitectura ya habilitada. Babel usa la configuración automática de `babel-preset-expo`. Esta actualización requiere un APK recompilado.

El provider se monta en App; `useTheme` acepta coordenadas opcionales sin romper llamadas sin argumento. Los controles del login y del drawer de módulos, más el ThemeToggle compartido, entregan el centro medido. Se elimina la persistencia adelantada duplicada del controlador legado. No se duplica el árbol de formularios para animarlo ni se escribe la imagen capturada a disco.

## Verificación

- TypeScript móvil: correcto.
- Suite completa final: 672 pruebas / 82 archivos, cero fallos.
- Pruebas del provider real con adaptadores nativos simulados: conserva el formulario y su instancia; geometría de la superficie/origen; cancela capturas tardías; falla de captura no impide cambiar el tema.
- Compilación de Pixel Snow en CanvasKit/SkSL: correcta, quince uniforms. Metro/Hermes Android verificado con las librerías nativas.
- Revisión visual: 9 escenarios, cero errores de consola y sin desbordamiento horizontal. 320×640, 390×844, 844×390 y 768×1024; ambos temas, árabe/RTL, 2FA, recuperación y conexiones. Se comprobó conservar campos al cambiar tema, mostrar contraseña, check de Recordarme y pantalla de 2FA.
- Las capturas son del formulario RN compartido renderizado con React Native Web y un adaptador CanvasKit del shader; no son capturas Android. No se dispone de dispositivo/emulador Android para certificar renderizado nativo, teclado real, biometría, rendimiento de GPU o la transición en hardware.

Evidencia: `.cache/mobile-login-20261004/`, con baseline, hashes de fuentes, reports Vitest, visual-qa.json, capturas, export Android y estado EAS. Los builds intermedios v28/v29 se cancelaron para incluir los ajustes de revisión. Build final v30: `a3373728-39b0-4d6e-8dc9-9707de5e7183`. APK final terminado y verificado: `/var/www/LUXIPANEL/.cache/mobile-login-20261004/artifacts/LUXIPANEL-1.0.11-v30.apk`. Paquete `com.luxisoft.lxpanel`, versión 1.0.11, versionCode 30. Firma válida y certificado coincidente con v27. SHA-256: `66bc806e08c3dd50427631b33721cd2982c3b42fda2cd7c3d8a365b1c7b11170`. No se publicó en tiendas ni se distribuyó desde producción.
