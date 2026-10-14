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
