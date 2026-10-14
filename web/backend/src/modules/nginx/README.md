# NGINX module

Gestión de NGINX sobre el servidor conectado (local / SSH directo) a
través del `Executor`. Reemplaza al antiguo módulo `dns`.

> **Slug interno:** el identificador de módulo para permisos/licencia sigue
> siendo `dns` (gating de sidebar, `module.dns.enabled`, dependencias de
> `mail`/`ssl`, lista de módulos de LP). Solo cambian rutas, UI y nombre
> visible. No renombrar el slug sin migrar permisos y coordinar con
> LP-LICENSE-SERVER.

## Anatomía del módulo (sin `repositories/`)

`models/` → `services/` → `controllers/` → `routes/` → `index.ts`. **No hay
`repositories/` a propósito**: el módulo NO persiste estado propio en sidecars
`kv-store`/`data-store`. La **fuente de verdad es el sistema de ficheros del
servidor conectado** (`/etc/nginx/{nginx.conf,sites-available,sites-enabled,
conf.d,snippets}`, `/var/log/nginx`, `/etc/letsencrypt`), leído/escrito siempre
vía el `Executor` (SSH/SFTP + `sudo`). Igual que `firewall`, es un módulo
*per-server síncrono* sin colección propia. Toda ruta de `/etc/nginx` está
centralizada en **`nginx-constants.ts` (SSOT)** — no hardcodear literales de
rutas en los services.

`nginx/sites` **no** usa la cola write-behind (`lpwq:*`): su contrato
`nginx -t` + restore-on-fail no encaja en el modelo lineal de steps. Es
síncrono y refresca el DataTable con `await refreshSync(executor, "nginx",
"sites")` tras cada mutación (sites / proxy / ssl-bridge). El SSL (Certbot,
`certbot.service.ts`) también es síncrono + `refreshSync`.

## Contrato de seguridad de escritura

Toda escritura de configuración sigue: backup `*.lxp.bak` → escribir →
`nginx -t` → si falla restaurar el backup y **no** recargar → si pasa
`systemctl reload nginx`. El resultado del reload se comprueba y se muestra
un error explícito si el archivo quedó guardado pero no se activó. Cambiar
el estado o borrar un sitio también valida y restaura archivo/enlace si
falla la prueba o la recarga. `restart`/`reload` validan antes con `nginx -t`.

El editor guiado solo puede reabrir configuraciones que vuelven a generar el
mismo contenido byte por byte. Los sitios con TLS, autenticación o directivas
personalizadas requieren el editor avanzado de un administrador. La edición
acepta `expectedRevision` (SHA-256 del contenido leído) para detectar cambios
ajenos antes de guardar.

Las cuentas de hosting ven y operan solo sitios cuya raíz está bajo su home;
crean y editan sitios estáticos/PHP desde el formulario guiado. Las acciones
globales (servicio, `nginx.conf`, rendimiento, upstreams y reverse proxy)
requieren administrador. Los logs globales también son exclusivos de admin;
la ausencia de un log de sitio devuelve error y nunca cae al log global.

## Endpoints (`/api/nginx/*`, requieren autenticación)

| Método | Ruta | Acción |
|---|---|---|
| GET | `/status` | versión, activo, nº sitios, último `nginx -t` |
| POST | `/service` | `{action: start\|stop\|restart\|reload\|test}` |
| GET/PUT | `/config` | leer/guardar `nginx.conf` global (gate `nginx -t`) |
| GET | `/logs?site=&type=access\|error&lines=` | tail de logs |
| GET/PUT | `/performance` | leer/aplicar tuning (gzip, sendfile, keepalive, open_file_cache, proxy_cache, worker_processes/connections) vía snippet `conf.d/lxp-performance.conf` + patch de `nginx.conf` |
| GET | `/domains`, `/domains/discovered` | dominios detectados (compat SSL/Mail) |
| GET | `/upstreams` | pools `upstream {}` declarados |
| POST | `/proxy/preview`, `/proxy` | generar/desplegar reverse-proxy |
| GET | `/sites` | listar server blocks |
| POST | `/sites` | crear (`mode: form\|raw`) |
| POST | `/sites/preview` | previsualizar config generada |
| GET | `/sites/:name/raw` | contenido crudo (modo avanzado) |
| PUT | `/sites/:name` | editar (`mode: form\|raw`) |
| POST | `/sites/:name/enable` · `/disable` | symlink on/off |
| POST | `/sites/:name/ssl` | emitir cert (módulo SSL) + inyectar TLS |
| DELETE | `/sites/:name` | eliminar conf + symlink |
| GET | `/ssl/renewal` | estado real de Certbot, programador y recarga de NGINX |
| GET | `/ssl/renewal/sites` | estado por sitio visible: certificado Certbot, archivo de renovación y programador |
| POST | `/ssl/renewal` | activar programador y hook de recarga (admin) |
| POST | `/ssl/renewal/dry-run` | probar renovación contra staging (admin) |

El bridge SSL usa `certbotService` (en `nginx/services/certbot.service.ts`);
SSL es parte de NGINX (el módulo `ssl` standalone se eliminó).

Tras emitir HTTPS, el bridge instala un hook de despliegue que valida y recarga
NGINX solo después de renovar un certificado. Activa el timer nativo de Certbot
si existe; si falta, crea un timer systemd propio o un cron en sistemas sin
systemd. El estado se comprueba en el servidor conectado. Si el certificado
se emitió pero la programación falló, la respuesta conserva el éxito de HTTPS
y devuelve una advertencia específica; nunca afirma renovación automática.

## Diagnóstico con Agentes IA

La capacidad `nginx` expone solo herramientas de lectura: estado, sitios
accesibles, prueba de configuración (admin), resumen de un sitio y extractos
acotados de access/error log. Los extractos destinados al asistente ocultan
cabeceras sensibles, parámetros de URL e IP, y el resumen de configuración
usa una lista de directivas permitidas. La UI abre el chat contextual desde
Resumen, Sitios y Logs; el usuario puede elegir envío inmediato o borrador
en el drawer Configuración de NGINX. El asistente propone pasos y no ejecuta
cambios sobre NGINX desde estas herramientas.

## Basic auth por directorio (`nginx-basic-auth.service.ts`)

`nginxBasicAuthService` aplica protección por contraseña (HTTP Basic) a una
**carpeta**, para la feature *Directory Privacy* del módulo `files` (nginx ignora
`.htaccess`, así que la única forma de aplicarla es en la config del sitio). No
expone rutas `/api/nginx/*` propias; lo consume `files/directory-privacy.service.ts`.

- `enableForDir(executor, dir, realm, htpasswd)` — busca el sitio **habilitado**
  cuyo `root` es ancestro de `dir` (match más largo, ignora reverse-proxies),
  calcula la URL relativa, e inyecta un bloque marcado
  `# >>> LUXIPANEL dir-privacy <url>` … `location ^~ <url>/ { auth_basic …; auth_basic_user_file <htpasswd>; }`
  en **cada `server { }` que lleva ese `root`** (los bloques que sirven archivos;
  el redirect http→https no se toca). En sitios PHP **anida el `location ~ \.php$`**
  propio del sitio dentro del bloque protegido para que PHP siga ejecutándose y no
  se sirva el código como texto.
- `disableForDir(executor, dir)` — elimina el bloque marcado.
- `statusForDir(executor, dir)` — indica si el bloque está presente (`enforced`),
  el sitio y la URL; detecta tanto el modo `docroot` como el modo `publish`;
  `reason: "no-site"` si la carpeta no está bajo ningún sitio **ni** publicada.

### Publicación bajo un sitio (`publishDir` / `unpublishDir` / `listPublishCandidates`)

Para carpetas que **no** cuelgan del `root` de ningún sitio (p. ej. la carpeta de
una app servida por reverse-proxy), `publishDir(executor, {dir, siteName, urlPath,
realm, htpasswd})` las expone **bajo un sitio elegido por el usuario** inyectando un
bloque marcado `# >>> LUXIPANEL dir-publish <dir>` … `location ^~ <urlPath> { alias
<dir>/; auth_basic …; autoindex on; location ~ /\.ht { deny all; } }` en los
`server { }` que sirven contenido (prefiere los de TLS/443). `listPublishCandidates`
devuelve los sitios **habilitados con dominio público utilizable** (FQDN concreto, no
`_`/IP/wildcard) para poblar el selector del modal. `unpublishDir` localiza y elimina
el bloque en cualquier sitio. La capa `files` orquesta TLS best-effort (Certbot +
`applySslToSite`) cuando el sitio elegido aún no tiene HTTPS.

Persiste vía `nginxSitesService.writeSite` → **respeta el contrato de escritura**
(backup → `nginx -t` → rollback si falla → reload), por lo que una inyección
inválida nunca rompe el sitio. La búsqueda de `server { }` y `location` usa
emparejado de llaves (no regex ingenua) para soportar bloques anidados.
