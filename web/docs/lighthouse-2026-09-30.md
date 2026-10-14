<!-- documentation-status-20261013 -->
> **Documento histórico o de planificación.** Conserva propuestas, resultados y límites de su fecha; no acredita el estado ni la publicación actuales. Consultar la [referencia vigente](../README.md) y el código antes de ejecutar sus instrucciones. Clasificado el 13 de octubre de 2026.

# LUXIPANEL: correcciones de Lighthouse, 2026-09-30

## Resultado publicado

Revisado el informe `lighthouse/panel.example.org_2026-09-30_20-27-02.json`. Publicación selectiva del frontend: 36 archivos, conservando las pantallas y cambios de arquitectura pendientes. Sin commits/push ni nuevas versiones nativas.

Comparación propia sobre **la misma URL pública HTTPS**, Lighthouse 13.4.1, Chromium Linux, escritorio, RTT simulado 40 ms, 10.240 Kbps, CPU ×1 y sesión autenticada. No equivale al navegador/equipo del informe original (82 de rendimiento y advertencia de timeout de 45 s).

| Medida | Antes | Después |
|---|---:|---:|
| Rendimiento | 95 | 97 |
| Accesibilidad | 91 | 100 |
| Buenas prácticas | 96 | 96 |
| SEO | 69 | 69 |
| FCP simulado | 605 ms | 529 ms |
| LCP simulado | 1.305 ms | 1.157 ms |
| Speed Index simulado | 1.364 ms | 985 ms |
| Descarga total de la auditoría | 961.775 B | 765.109 B |
| Trabajo del hilo principal | 1.686 ms | 1.189 ms |
| Evaluación/arranque JS | 383 ms | 297 ms |
| Bloqueo total | 0 ms | 0 ms |

Descarga: **20,4 % menos**; trabajo principal: **29,5 % menos**. Se conserva también `lighthouse-after.json`: primera medición posterior con rendimiento 91 y TTFB 3.155 ms; se repitió por esa variación, sin cambios de código, y obtuvo 97 con TTFB 172 ms. Baseline TTFB 185 ms. No se descartó la medición lenta. Consultas directas posteriores: SSR local 12–23 ms, HTTPS público 24–76 ms. La variación de recepción del HTML sigue siendo una limitación; no se afirma que los 16,7 s del usuario estén reproducidos/resueltos en todo entorno.

## Cambios

- Configuración del asistente y cada pestaña se cargan al abrirse; conserva estado después de primera visita del modal.
- Render de turnos/compaction bajo demanda, sin importar todo MessageContent en la entrada principal.
- Terminal flotante difiere su panel/tablas hasta abrir; comportamiento de sesiones y de cierre existente conservado.
- Animación del chat usa IntersectionObserver y CSS, sin GSAP/ScrollTrigger, ni lecturas de layout por cuadro. Respuestas largas animan bloques, evitando miles de spans por palabra; respeta movimiento reducido.
- Iconos SVG: lista crítica generada y observador limitado a iconos; evita getComputedStyle por cada icono/mutación.
- Monaco conserva los CSS de sus imports dinámicos y deja de precargarse mediante el manifiesto SSR de todas las rutas.
- Fuentes existentes con hash de contenido bajo /_luxi/fonts para usar la política immutable de assets. Generación integrada en build-extracted.
- Etiquetas accesibles coherentes con texto visible, indicadores con rol válido, landmark main del chat y contraste legible del contador de notificaciones.
- llms.txt describe el panel privado; robots/noindex y autorización conservados.

## Verificación

Build Astro aislado satisfactorio. 6 archivos de pruebas, 16 pruebas pasan (controles, markdown y reveal/cleanup). Las pruebas de integración existentes emiten ECONNREFUSED del endpoint ficticio localhost:3000; assertions pasan. QA con sesión autorizada temporal y bloqueo de mutaciones, revocada al terminar: historial inicial una petición de 15 resultados, cursor al hacer scroll, una petición de mensajes/meta/contexto/sesiones al abrir; configuración/agentes y terminal abren sin errores JS. La carga inicial no descarga AssistantSettingsModal, AgentsTab, DataTable, Monaco CSS ni GSAP/ScrollTrigger. Correo, Hosting y Settings comprobados; tablas paginadas y conectores agrupados siguen funcionando. Auditoría pública posterior: accesibilidad 100, sin advertencias de timeout.

SEO bajo por ser panel autenticado y no indexable, deliberadamente. BFcache/WebSocket/no-store se conservan por privacidad y conexiones activas. El ERR_BLOCKED_BY_CLIENT de Cloudflare en el informe aportado depende del bloqueo del navegador; no se modifica la app por ese mensaje. No se publican sourcemaps con el código privado solo para elevar puntuación.

## Evidencia y recuperación

- `.cache/lighthouse-fixes/lighthouse-before-final.json`
- `.cache/lighthouse-fixes/lighthouse-after.json` y `lighthouse-after-repeat.json`
- `.cache/lighthouse-fixes/lighthouse-candidate-final.json` (HTTP sin compresión; usar solo validación funcional/accesibilidad, no comparar rendimiento con HTTPS)
- `.cache/lighthouse-fixes/qa-lazy.json`, `qa-public.json`, `lh-qa-modules.json`, `unit-final.log`, `origin-after.json`
- `.cache/lighthouse-fixes/web-publication.json` registra hashes y archivos. Backup: `/var/www/LUXIPANEL/.cache/lighthouse-fixes/web-backup-1790819715701`.

Para revertir, restaurar exclusivamente los archivos con before no nulo desde ese backup a sus rutas originales y reiniciar `luxipanel-frontend`; los assets nuevos pueden permanecer sin referencias. No reemplazar todo dist ni publicar el build completo aislado: incorpora cambios ajenos pendientes.


## Verificación de NO_FCP comunicada por el usuario

Nueva ejecución sobre HTTPS publicado: rendimiento97/accesibilidad100/buenas prácticas96/SEO69, FCP observado572 ms, sin advertencias NO_FCP. Prueba separada de escritorio, móvil, login sin sesión y SSR sin JavaScript: todas registran first-contentful-paint y no presentan errores JS. No se reproduce pantalla en blanco. El nuevo informe del usuario no está aún disponible en lighthouse; se solicitó su ruta y mecanismo (DevTools/extensión). No se atribuye la causa a segundo plano como certeza ni se modifica la app sin evidencia. Evidencia: lighthouse/panel.example.org_NO_FCP-verificacion.json y .cache/lighthouse-fixes/no-fcp-browser.json.
