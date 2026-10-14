<!-- documentation-status-20261013 -->
> **Documento histórico o de planificación.** Conserva propuestas, resultados y límites de su fecha; no acredita el estado ni la publicación actuales. Consultar la [referencia vigente](../README.md) y el código antes de ejecutar sus instrucciones. Clasificado el 13 de octubre de 2026.

# Monitor: estado en la cabecera del drawer

Publicado monitor-topbar-20261004-1. Se retiraron del cuerpo del módulo el h1 “Monitor del sistema” y el subtítulo. El badge existente “Servidor saludable” ahora usa ModuleHeaderStatus y se renderiza por portal en un slot anterior al botón Configuración del topbar. El texto del topbar conserva el nombre del módulo. No se cambió la semántica del estado saludable ni se movió el estado WS de la tarjeta Recursos.

El portal busca el slot solo en el drawer propietario de scope.root, usa los contextos existentes y se retira inmediatamente cuando la vista cacheada pierde visibilidad. Al desmontar React limpia el nodo. En contenedores <=480px se compacta el badge a su punto de estado, conservando aria-label y title completos, para que Configuración y Cerrar permanezcan dentro del viewport.

La QA de gráficos encontró que Chart.js observaba el document de su controlador aislado. Esa facade no es un Node nativo y provocaba TypeError al crear gráficos. El adaptador observed de controller-scope ahora traduce únicamente su propia facade al root real del módulo antes de llamar al observe nativo; otros nodos se conservan. La prueba verifica exclusión de otro módulo y desconexión al dispose. No extiende la observación al documento global.

Validación:9 pruebas de propiedad/visibilidad del portal, aislamiento del controller y limpieza de observadores; tipos dirigidos de las dos funciones modificadas sin errores. QA candidato/público6 escenarios1440/390/320px, ambos temas: encabezados retirados, badge único en topbar a la izquierda de Configuración, Cerrar dentro del viewport, configuración abre/cambia pestañas, badge desaparece al pasar a Correos y vuelve una vez al Monitor. GET de métricas/WS/history usan fixtures y el mismo buildHistoryChart del backend, sin escribir preferencias ni cuentas reales. Cero pageerrors en la QA final.

Publicación selectiva: nuevo portalJS, nueva vistaMonitor, nuevo host, CSS versionado y entrySSR (5 archivos). El host conserva todas las implementaciones anteriores y usa nombre corto para respetar el límite de255 bytes por filename. Solo se reinició frontend. Se conservan bandeja completa y configuración del topbar de Correos, ExpoQR y DocumentHead.reactbits-controls-20261004-3.css. Evidencia .cache/monitor-topbar/verification.json, manifiesto/hashes, capturas live-*.png.

Rollback de producción: node .cache/monitor-topbar/publish.mjs --rollback; restaurar únicamente tras retirar publicaciones posteriores. Los backups de fuentes antes del cambio están en .cache/monitor-topbar, excepto los archivos nuevos. No repetir stage/publish ya aplicados.
