# Actualizaciones por GitHub Releases

Publica una Release estable con una etiqueta `vMAJOR.MINOR.PATCH` (o sin `v`) y
notas en el repositorio `Luxisoft/LUXIPANEL`. Los borradores y prerreleases no
aparecen en el panel. Si el repositorio sigue privado, configura
`LUXIPANEL_GITHUB_TOKEN` con permiso de lectura de Contents/Metadata en
`backend/.env` y reevalúa el ecosystem de PM2 al reiniciar el backend. El token
solo se usa para consultar la API de Releases; `git fetch` usa el `origin` de la
instalación.

`GET /api/ui/releases` informa la versión instalada desde
`.releases/state.json`. Una instalación anterior a este gestor figura como
«sin versión registrada»: el hash de Git en el checkout no representa
necesariamente los artefactos en ejecución. Tras la primera instalación
gestionada, el estado guarda etiqueta, commit y ruta del worktree activado.

`POST /api/admin/system/releases/install` exige administrador, CSRF, servidor
local conectado y una etiqueta que figure en las Releases publicadas. El
gestor descarga la etiqueta, crea `.releases/<commit>` sin alterar el checkout
existente, copia los `.env`, instala dependencias y compila backend y frontend
secuencialmente. Para Astro elimina `dist` antes de compilar y usa
`NODE_OPTIONS=--max-old-space-size=2560`. Requiere al menos 5 GiB libres.
Activa ambos procesos mediante su ecosystem reevaluado y solo registra éxito
cuando PM2 está `online` y la API y el login responden. Si la activación falla,
reactiva la ruta anterior. El resultado y la etapa se consultan en el mismo
endpoint. `manager.log` contiene el detalle y el gestor no imprime los `.env`.

El gestor usa un lock para impedir dos operaciones de Release simultáneas.
Conserva worktrees previos para poder escoger una versión anterior en Ajustes →
Sistema. La primera versión administrada no borra ni modifica el checkout
original y permite restaurarlo automáticamente si falla la activación.


## Comunidad, notas y traducción

El botón del encabezado muestra el icono de Git y la versión instalada (`vX.Y.Z`).
Una nueva Release estable activa el indicador hasta que se instale; abrir el
drawer no descarta ese aviso. El selector permite consultar las notas de cada
versión publicada y los comentarios recientes de su anuncio en GitHub (etiqueta
`release:vX.Y.Z`), con enlace a la conversación completa.

`GET /api/ui/releases/:tag/details` entrega contenido de esa Release conocida.
Al abrir el drawer, `POST /api/ui/releases/:tag/translate` traduce automáticamente
las notas y los comentarios al idioma del panel mediante el proveedor API de IA
configurado por el usuario en el servidor seleccionado. Exige autenticación y
CSRF; el cliente nunca envía texto arbitrario al traductor. La llamada no ejecuta
herramientas, conserva Markdown/código y registra el consumo real de tokens.
Las traducciones se guardan en caché por usuario, servidor, contenido e idioma;
los cambios en notas/comentarios invalidan la caché. Se puede alternar al original.
Sin proveedor o si falla la traducción, se muestra el original. El contenido de
GitHub se presenta como texto, sin ejecutar HTML.

El flujo de ramas, candidatas congeladas y hotfix se documenta en
[CONTRIBUTING.md](../CONTRIBUTING.md).
