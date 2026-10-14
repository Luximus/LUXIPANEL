<!-- documentation-status-20261013 -->
> **Documento histórico o de planificación.** Conserva propuestas, resultados y límites de su fecha; no acredita el estado ni la publicación actuales. Consultar la [referencia vigente](../README.md) y el código antes de ejecutar sus instrucciones. Clasificado el 13 de octubre de 2026.

# Cierre de cajones de módulos

## Causa y corrección

Mensajería se abría desde `#messenger-link` mediante navegación de página, fuera del handler de apertura local. La X de un módulo abierto por URL directa navegaba a `/panel` y mantenía el cajón visible hasta terminar SSR y el intercambio de Astro. Los cajones compartidos tenían una salida de 200 ms. Configuración esperaba además el evento `close` del diálogo interno antes de iniciar la salida de la capa exterior, sumando ambas animaciones.

- Mensajería entra por el mismo handler del cajón compartido. Conserva la interfaz completa y los enlaces con modificadores/nueva pestaña; cerrar desde el workspace no vuelve a solicitar su página.
- En URL directa, X, clic exterior disponible y Escape ocultan el módulo antes de que Astro termine de volver al workspace. Se conserva la navegación real para renovar cabecera, historial y limpiar la página anterior.
- La salida compartida de módulos, Configuración y diálogos nativos dura 100 ms. Movimiento reducido elimina la espera visual del cajón.
- Configuración observa el inicio de cierre del diálogo incrustado y anima ambas capas en paralelo. Reabrir cancela el cierre pendiente; el listener antiguo de `animationend` se retira. Configuración descarta eventos de cierre de una apertura anterior y conserva abierta la nueva vista. Se conservan `returnValue`, el veto de `cancel` y el cierre de seguridad a 160 ms si no hay animación.
- Escape respeta diálogos internos antes de cerrar el módulo. Con Configuración abierta, Escape desde el iframe también cierra primero Configuración. El listener del iframe captura su documento al cargar: la referencia diferida a event.target del evento load llegaba a ser null y rompía el atajo con foco interno.

Fuentes: `frontend/src/layouts/PanelLayout.astro`, `frontend/src/styles/panel-workspace.css`, `frontend/src/styles/modal-drawer.css`, `frontend/src/scripts/extracted/layouts/dialog-motion.ts` y su JS extraído. La importación del JS usa `?v=20260930-fast-close`.

## Verificación

Chromium con SSR/bundles reales y APIs simuladas. La prueba del cierre compartido usa documentos ligeros de módulo y enlaces de prueba, por lo que verifica la infraestructura común y no las operaciones de cada módulo. Las pantallas reales de Mensajería y Configuración de Hosting/Cron sí se montan mediante SSR.

| Escenario | Evidencia |
| --- | --- |
| 26 módulos × escritorio/móvil × movimiento normal/reducido | 104 cierres: X, Escape y clic exterior en escritorio; reapertura durante salida |
| Mensajería real dentro del iframe | 2 tamaños; isla React hidratada; cerrar sin nueva navegación del workspace |
| Entrada directa a Mensajería | 10 casos, temas claro/oscuro, 1440/390 px; X/Escape y clic exterior en escritorio |
| Configuración Hosting/Cron | 8 casos: 2 módulos × 2 temas × 2 tamaños; X, reapertura y Escape |
| Diálogo nativo | cierre con resultado, reapertura, animación desactivada, veto de Escape y movimiento reducido |
| Menú real de Archivos | 2 tamaños; submenú, Escape en diálogo interno y luego Escape desde el iframe |
| Comprobación técnica | TypeScript acotado a `dialog-motion.ts`; sintaxis del JS y chunks SSR modificados; auditoría i18n estructural de 12 idiomas (8218 claves) |

En la simulación se añaden **1200 ms por petición de retorno**: `/panel` y su redirección canónica `/`. La versión anterior mantiene visible Mensajería aproximadamente 2,49–2,60 s; el candidato la oculta antes del retorno, en 25–93 ms desde la interacción observada. No son tiempos de producción.

En los 52 cierres compartidos con movimiento normal, la mediana observada fue 134,8 ms (105,2–293,6 ms). Con movimiento reducido, 52 muestras: mediana 4,9 ms (2,5–18,1 ms). Estas medidas incluyen el entorno local y la instrumentación de navegador. La animación CSS configurada es 100 ms.

Evidencias reproducibles: `.cache/drawer-close/{build,qa,publish}.mjs`, `before-qa.json`, `after-shared-qa.json`, `after-native-qa.json`, `release.json` y, tras publicación, `publication.json`.

## Publicación acotada

Publicado el 2026-09-30T04:12:21.009Z (29 de septiembre, hora de Bogotá). Salud frontend/backend, login público y hashes HTTPS de CSS/JS verificados.

El candidato deriva de una copia del frontend activo, con comparación del bridge publicado contra la fuente previa y guardas SHA-256 de fuentes/artefactos. Cambia únicamente el chunk SSR de PanelLayout, el JS de cierre, un CSS nuevo con hash y las referencias CSS del manifest. Conserva los assets previos; no compila ni publica el resto del checkout. El proceso frontend se detiene durante el reemplazo y se reinicia inmediatamente. El publicador comprueba salud frontend/backend, login público y hashes HTTPS, y revierte si falla.

Respaldo: `.cache/drawer-close/baseline/frontend/dist`. Estado y fecha efectivos: `.cache/drawer-close/publication.json`.
