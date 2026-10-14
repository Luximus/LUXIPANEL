<!-- documentation-status-20261013 -->
> **Documento histórico o de planificación.** Conserva propuestas, resultados y límites de su fecha; no acredita el estado ni la publicación actuales. Consultar la [referencia vigente](../README.md) y el código antes de ejecutar sus instrucciones. Clasificado el 13 de octubre de 2026.

# Buscador alineado con Chatbox

Petición: centrar el campo del buscador del topbar respecto al Chatbox. Se alinea el centro del campo con el centro del lienzo y del compositor del chat; el texto conserva su alineación actual.

Regla desktop en `frontend/src/styles/panel-workspace.css`: posición absoluta, `left: 50%`, `translateX(-50%)`, ancho máximo780px y reserva simétrica32rem para evitar solapamientos con Notificaciones/Mensajes. Solo desde1025px; en móvil se conserva el buscador como icono y la distribución existente. La regla se sitúa después del override `chat-navbar-v2` que anteriormente restauraba la posición estática y desplazaba el buscador por el ancho de los botones.

Publicación selectiva CSS+entradaSSR, sin build global del checkout ni reinicio backend. Mantiene logos circulares, Monitor, Correos, Expo, Terminal y controles React Bits.

QA candidata y pública a1920/1440/1280/1025/1024/390px, claro/oscuro: diferencia de centros<=1px contra compositor/lienzo, separación de botones, sin overflow y apertura/escritura/cierre del drawer de búsqueda. APIs de escritura y WebSockets bloqueados. No se modifica el comportamiento de Escape del input search.

Evidencia `.cache/topbar-search-center/verification.json`; rollback `node /var/www/LUXIPANEL/.cache/topbar-search-center/publish.mjs --rollback`, tras retirar publicaciones posteriores. No repetir stage/publish una vez aplicado.

Validación final: publicado y verificado con 12 casos candidato y 12 públicos, sin errores de navegador ni mutaciones de configuración. Ambos archivos publicados coinciden con sus SHA revisados; backend conservado.
