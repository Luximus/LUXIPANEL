<!-- documentation-status-20261013 -->
> **Documento histórico o de planificación.** Conserva propuestas, resultados y límites de su fecha; no acredita el estado ni la publicación actuales. Consultar la [referencia vigente](../README.md) y el código antes de ejecutar sus instrucciones. Clasificado el 13 de octubre de 2026.

# Contenedores circulares del logo

Petición: colocar el logo del menú lateral izquierdo expandido dentro de un contenedor completamente redondeado, como Chatbox, y aplicar el mismo criterio en las demás ubicaciones del logo de LUXIPANEL.

`frontend/src/styles/branding-logo.css`, importado desde `starwind.css`, estiliza el componente compartido `DbLogo` y la vista previa de branding en Configuración. La superficie usa `aspect-ratio: 1`, `border-radius: 9999px`, fondo del tema, sombra de Chatbox y recorte del contenedor. Conserva las alturas existentes y el ajuste `object-contain` para no deformar el logo. El login conserva su círculo blanco exterior y su padding; el componente interior es transparente para evitar dos fondos superpuestos. El logo existente de Chatbox ya tiene esta forma.

Alcance: menú lateral expandido de escritorio/móvil, login, recuperación de contraseña, páginas de error y vista previa de Configuración. No cambia la imagen seleccionada, favicon, branding del servidor ni callbacks de carga/actualización.

Publicación selectiva preparada en `.cache/branding-logo-rounded`: únicamente CSS global con URL nueva y referencia de la entrada SSR. Conserva los assets anteriores de Monitor, Correos, Expo y React Bits, sin build completo ni reinicio del backend.

QA: Chromium en 1440/390 px, claro/oscuro y cuatro páginas, midiendo dimensiones cuadradas, radio circular, recorte y ausencia de desbordamiento horizontal. La vista previa se abre con el callback original del botón mediante click programático; esta revisión no certifica el tamaño táctil del encabezado de branding existente en móvil. Mutaciones de API y WebSockets bloqueados; no se modifican preferencias, proyectos ni la sesión Expo.

Evidencia y rollback: `.cache/branding-logo-rounded/verification.json`; `node /var/www/LUXIPANEL/.cache/branding-logo-rounded/publish.mjs --rollback`. Retirar publicaciones posteriores antes de usar ese rollback. No repetir stage/publish tras su aplicación.

Validación final: publicado y verificado con 16 casos candidato y 16 públicos, sin errores de navegador ni mutaciones de configuración. Ambos archivos publicados coinciden con sus SHA revisados; backend conservado.
