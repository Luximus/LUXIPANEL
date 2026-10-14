# Despliegue de LUXIPANEL standalone multi-nodo (paso a paso)

Guía detallada para **clonar LUXIPANEL desde GitHub y desplegarlo en tu propio
servidor**. LUXIPANEL es **autohospedado**: autentica usuarios Linux y ejecuta operaciones locales/SSH. Los servicios de cuenta y funciones protegidas pueden necesitar una clave con nombre validada online por LP-LICENSE-SERVER; no hay un puente SSH central ni modo managed. Tiene un **único modo** =
**standalone multi-nodo SSH**: la caja administra **su propio servidor** y,
además, **cuantos servidores remotos registres** en el módulo Servidores (los
alcanza por **SSH directo** con credenciales cifradas guardadas **en la caja**).
Los usuarios entran con su **cuenta Linux real** (usuario + contraseña del
sistema, PAM).

> Ya **no** existen `OPERATION_MODE` ni `MANAGED_BY_LICENSE_SERVER` (se
> eliminaron), El flag `--standalone` se conserva como no-op obsoleto.
> No utilices `standalone-local` o `LICENSE_KEY` como activación. `LICENSE_SERVER_URL` y `LP_PANEL_CREDENTIAL` sí pueden configurar servicios de cuenta; contrasta siempre `backend/src/config/env.ts`.

Resumen en inglés: ver `SELF-HOSTING.md`. Aquí van los pasos con todos los comandos.

---

## 0. Modelo de funcionamiento (léelo antes)

- El panel gestiona **su propio servidor** y **cualquier servidor remoto** que
  registres en el selector de servidores (los alcanza por **SSH directo**).
- Al **añadir un servidor**, su host/puerto/usuario + credencial se guardan
  **cifrados** (AES-256-GCM) en un sidecar local
  `${LUXIPANEL_CONFIG_DIR}/servers/targets.json` (`0600`). Nada sale a un
  servicio externo. La clave maestra del cifrado es `CREDENTIAL_VAULT_KEY`.
- **Login = cuenta Linux real** de la caja (el mismo usuario/contraseña con que
  entrarías por SSH). La validación es por PAM (`su`), no hay base de datos de
  usuarios propia.
- El **primer** usuario que entre y pertenezca al grupo **`sudo`** (o `wheel`)
  se convierte en **admin del panel**. A los demás les das acceso desde
  **/panel/users** (gestionando sus grupos Linux).
- El proceso del panel debe correr como **root** (administra usuarios, servicios
  y archivos del sistema).

---

## 1. Prerrequisitos del servidor

- **Debian 12+ o Ubuntu 22.04+** (el instalador usa `apt-get`).
- **Node.js >=22.12.0** y **npm**.
- **pnpm** (gestor de paquetes del proyecto — hay `pnpm-lock.yaml`). Se instala
  con `corepack` (incluido en Node 22); ver paso 1.2.
- **Redis** escuchando en `127.0.0.1:6379` (el backend aborta el arranque si
  Redis no responde).
- **nginx** (reverse proxy + TLS).
- **Acceso root** (sudo).
- Al menos **2 GB de RAM libres para el build** del frontend (Astro). Si tienes
  menos, usa el truco de heap del paso 5.4.
- Una **cuenta Linux en el grupo `sudo`** con la que harás el primer login (paso 7).

### 1.1 Instalar dependencias base (si vas por la vía manual)

> Si vas a usar el **instalador automático** (paso 4), sáltate esto: el script
> instala todo. Esto es solo para la vía manual.

```bash
sudo apt-get update
sudo apt-get install -y curl ca-certificates gnupg build-essential git nginx redis-server openssl

# Node.js 22 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# pm2 (gestor de procesos)
sudo npm install -g pm2

# Arrancar/activar Redis
sudo systemctl enable --now redis-server
redis-cli ping   # debe responder: PONG
```

Verifica versiones:

```bash
node -v     # v22.x
npm -v
redis-cli ping
```

### 1.2 Instalar pnpm (gestor de paquetes del proyecto)

El proyecto usa **pnpm** (`pnpm-lock.yaml` / `pnpm-workspace.yaml`). La forma
recomendada es **corepack**, que viene con Node 22:

```bash
sudo corepack enable
corepack prepare pnpm@11.5.0 --activate
pnpm -v        # debe imprimir una versión (p.ej. 9.x)
```

> Alternativa sin corepack: `sudo npm install -g pnpm`.
>
> El **instalador automático** (paso 4) ya deja pnpm listo; este paso es sobre
> todo para la **vía manual** (paso 5), donde instalarás las dependencias con
> `pnpm install`.

---

## 2. Clonar el repositorio

```bash
sudo mkdir -p /opt
cd /opt
sudo git clone <URL-DEL-REPO> luxipanel
cd /opt/luxipanel
```

> Puedes clonarlo en la ruta que quieras; en esta guía uso `/opt/luxipanel`.
> Los comandos `pm2` usan rutas relativas al repo, así que ejecútalos desde la
> raíz del proyecto.

---

## 3. Elige tu vía de instalación

- **Vía A — instalador automático** (paso 4): un comando hace todo (deps, nginx,
  pm2, `.env`, build, arranque). **Recomendada.**
- **Vía B — manual** (paso 5): control total, paso a paso. Úsala si ya tienes
  nginx/Redis a tu manera o quieres entender cada pieza.

---

## 4. Vía A — instalador automático (recomendada)

### 4.0 Atajos por escenario (lo más fácil)

Si no quieres pensar en flags, usa el script de tu situación
(`scripts/standalone/`, ver su `README.md`). Cada uno llama al `install.sh` con
los flags correctos y detecta puertos ocupados:

| Tu servidor | Script |
|---|---|
| Nuevo (nada instalado), **con Cloudflare** | `sudo bash scripts/standalone/install-standalone-new-cloudflare.sh --domain panel.tudominio.com` |
| Nuevo (nada instalado), **sin Cloudflare** (TLS directo) | `sudo bash scripts/standalone/install-standalone-new-direct.sh --domain panel.tudominio.com` |
| Librerías ya instaladas, **nginx SIN configurar** el dominio | `sudo bash scripts/standalone/install-standalone-existing-deps.sh --domain panel.tudominio.com` |
| Librerías ya instaladas y **nginx YA configurado** (vhost + TLS) | `sudo bash scripts/standalone/install-standalone-existing-nginx-ready.sh --domain panel.tudominio.com --backend-port 8080 --frontend-port 4321` |

> Para el caso "nginx ya configurado", pasa los **puertos** que tu vhost ya
> proxya (con `--strict-ports` el instalador NO los cambia). Si tu origen sirve
> http plano, añade `--http`. Detrás de Cloudflare en los casos 3/4, añade
> `--cloudflare`.

Si prefieres el control fino, sigue con el `install.sh` directo:

### 4.1 install.sh directo

Desde la raíz del repo, como root:

```bash
sudo bash install.sh --domain panel.tudominio.com
```

> El flag `--standalone` ya **no** es necesario (standalone es el único modo);
> se sigue aceptando como no-op para no romper scripts antiguos.

Qué hace el instalador:
- Genera `JWT_SECRET` **y** `CREDENTIAL_VAULT_KEY` automáticamente
  (`openssl rand -hex 32` cada uno) en `backend/.env`.
- Fuerza cookie host-only (`COOKIE_DOMAIN` vacío) y apaga el metering hacia LP,
  ya retirado (`SSH_USAGE_REPORT_ENABLED=false`, `WORKLOG_ENABLED=false`).
- Instala dependencias del sistema, configura **nginx**, hace **build** de
  backend+frontend y arranca los procesos con **pm2** (`pm2 save` + `pm2 startup`).

Al terminar imprime la URL de login. Salta al **paso 6** (TLS) y **paso 7** (primer login).

Opciones útiles:
```bash
sudo bash install.sh --domain panel.tudominio.com \
  --backend-port 8080 --frontend-port 4321
```

**Si vas a servir por HTTPS (recomendado) o detrás de Cloudflare**, añade el
flag correspondiente para que las cookies y los orígenes salgan en `https://`:

```bash
# TLS directo (nginx + certbot en este servidor):
sudo bash install.sh --domain panel.tudominio.com --https

# Detrás de Cloudflare (además imprime los recordatorios de DNS-only y Full strict):
sudo bash install.sh --domain panel.tudominio.com --cloudflare
```

`--https`/`--cloudflare` ponen `COOKIE_SECURE=true`, `COOKIE_DOMAIN` vacío
(host-only) y los orígenes `https://panel.tudominio.com` en
`CORS_ORIGIN`/`WEBAUTHN_ORIGIN`/`SITE_URL`/`LUXIPANEL_URL`. **Esto es lo que
evita el `CSRF token mismatch` al hacer login detrás de un proxy TLS / Cloudflare**
(ver paso 10). Sin el flag, el instalador asume `http://` y `COOKIE_SECURE=false`.

**Flags para adaptarse a tu arquitectura** (`install.sh --help` los lista todos):

| Flag | Para qué |
|---|---|
| `--skip-system-deps` | El servidor ya tiene redis/postgresql/nginx/build-tools: salta `apt` y el enable de servicios (Node/pnpm/pm2 sí se aseguran). |
| `--skip-nginx` | No escribir el vhost: tu nginx ya sirve el dominio. Úsalo con `--strict-ports`. |
| `--run-certbot` | Emitir el certificado TLS con `certbot --nginx` al final (mejor-esfuerzo; con `--cloudflare` hace la pausa de "DNS only"). |
| `--strict-ports` | Si un puerto está ocupado, falla en vez de elegir otro (para que coincida con tu nginx). |
| `--email <addr>` | Email de registro para certbot. |
| `--http` | Forzar origen `http://` (override de un escenario que asume https). |
| `--allow-password` | Mantener `PasswordAuthentication yes` en SSH. Por defecto el instalador **endurece SSH a solo-clave** (ver abajo). |

> El instalador **detecta puertos ocupados** y elige el siguiente libre (p.ej.
> si `8080`/`4321` ya están en uso), salvo con `--strict-ports`.

### 4.2 Endurecimiento de SSH (automático)

`install.sh` ejecuta `setup_ssh_hardening` antes de configurar pm2. Es
**idempotente** y **reversible**, y hace dos cosas:

1. **fail2ban** — instala fail2ban (si hay `apt`) y escribe el jail
   `/etc/fail2ban/jail.d/luxipanel.conf` (`[sshd] maxretry=3 findtime=600
   bantime=86400`): 3 intentos fallidos → IP baneada 24 h.
2. **Drop-in de sshd** — `/etc/ssh/sshd_config.d/luxipanel.conf` con
   `MaxAuthTries 3`, `ClientAliveInterval 300`, `ClientAliveCountMax 2` y
   `PasswordAuthentication no`. Se valida con `sshd -t` y, si no parsea, se
   **elimina** (nunca deja sshd roto). Requiere que tu `sshd_config` tenga el
   `Include .../sshd_config.d/*.conf` (Debian/Ubuntu lo traen por defecto; si no,
   el instalador te avisa para que lo apliques a mano).

> ⚠️ **Solo-clave por defecto.** Con `PasswordAuthentication no`, asegúrate de
> tener tu **clave SSH funcionando ANTES** de cerrar la sesión. Si dependes de
> contraseñas SSH, instala con `--allow-password` (mantiene
> `PasswordAuthentication yes`). Para revertir después: borra
> `/etc/ssh/sshd_config.d/luxipanel.conf` y recarga sshd
> (`sudo systemctl reload sshd`).

> Si el build del frontend falla por memoria, mira el paso 5.4 (heap) y vuelve a
> ejecutar el build manualmente; luego `pm2 restart`.

---

## 5. Vía B — instalación manual

### 5.1 Crear los archivos `.env`

```bash
cd /opt/luxipanel
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env
```

### 5.2 Configurar `backend/.env`

Edita `backend/.env` y deja **como mínimo** estos valores:

```ini
JWT_SECRET=PEGA_AQUI_32+_CHARS          # genera con: openssl rand -hex 32
CREDENTIAL_VAULT_KEY=PEGA_AQUI_64_HEX   # OBLIGATORIA EN PROD; openssl rand -hex 32
SERVERS_ALLOW_PRIVATE=false             # true SOLO si administras servidores de tu LAN
REDIS_URL=redis://127.0.0.1:6379/0
NODE_ENV=production
HOST=127.0.0.1
PORT=8080
CORS_ORIGIN=https://panel.tudominio.com
WEBAUTHN_ORIGIN=https://panel.tudominio.com
COOKIE_DOMAIN=                          # VACÍO = cookie host-only (no .luxipanel.com)
COOKIE_SECURE=true                      # false SOLO si pruebas en http://localhost
COOKIE_SAMESITE=lax
LUXIPANEL_CONFIG_DIR=/etc/luxipanel
DEFAULT_LOCALE=es
SUPPORTED_LOCALES=es,en
TERMINAL_ENABLED=true
TERMINAL_SHELL=/bin/bash

# Metering hacia LP (retirado): déjalo apagado
SSH_USAGE_REPORT_ENABLED=false
```

Genera los secretos:
```bash
openssl rand -hex 32   # → JWT_SECRET
openssl rand -hex 32   # → CREDENTIAL_VAULT_KEY (bóveda de servidores remotos)
```

> **`CREDENTIAL_VAULT_KEY`** cifra la bóveda local de credenciales de servidores
> remotos (`${LUXIPANEL_CONFIG_DIR}/servers/targets.json`, 0600, AES-256-GCM).
> **Obligatoria en producción** (64 hex). Si la cambias, la bóveda existente deja
> de descifrar: guárdala como secreto raíz. `SERVERS_ALLOW_PRIVATE=true` relaja la
> política SSRF para alcanzar servidores de tu **propia LAN** (RFC1918/loopback).
>
> Ya **no** hay variables de modo managed: `OPERATION_MODE`,
> `MANAGED_BY_LICENSE_SERVER`, `LICENSE_KEY`, `LUXIPANEL_KEY`,
> `SECRET_ROTATION_HMAC` y `LICENSE_SERVER_*` fueron **eliminadas** con el puente
> managed; no las añadas.

> Opcional: `LOCAL_AUTH_DROP_USER` (def. `nobody`) es la cuenta sin privilegios a
> la que se baja `su` para validar la contraseña. Solo cámbiala si `nobody` no
> existe en tu sistema.

> ⚠️ **`COOKIE_DOMAIN` DEBE quedar vacío.** El `backend/.env.example` trae
> `COOKIE_DOMAIN=.luxipanel.com` (artefacto del modo managed multi-tenant). En
> autohospedaje, ese dominio nunca coincide con el tuyo → el navegador
> **descarta** la cookie CSRF/sesión → login falla con `CSRF token mismatch`.
> Déjalo **sin valor** (host-only). Lo mismo en `frontend/.env`. Si sirves por
> HTTPS / detrás de Cloudflare, además `COOKIE_SECURE=true` y los orígenes en
> `https://` (ya reflejado arriba). Ver paso 10.

### 5.3 Configurar `frontend/.env`

```ini
BACKEND_URL=http://127.0.0.1:8080
SITE_URL=https://panel.tudominio.com
LUXIPANEL_URL=https://panel.tudominio.com
ALLOWED_HOSTS=panel.tudominio.com,localhost,127.0.0.1
COOKIE_DOMAIN=
```

### 5.4 Instalar las librerías y compilar (con pnpm)

> Asegúrate de tener **pnpm** instalado (paso 1.2): `pnpm -v`. El proyecto trae
> `pnpm-lock.yaml`, así que las dependencias se instalan con `pnpm install`
> (instalar con `npm` puede no respetar el lockfile/workspace).

```bash
cd /opt/luxipanel/backend
pnpm install
pnpm run build

cd /opt/luxipanel/frontend
pnpm install
pnpm run build
```

> **Si el build del frontend muere por memoria** (`JavaScript heap out of
> memory`), amplía el heap de Node:
> ```bash
> cd /opt/luxipanel/frontend
> NODE_OPTIONS="--max-old-space-size=4096" pnpm run build
> ```
> (sube a 6144/8192 si hace falta; o añade swap temporal).

### 5.5 Arrancar con pm2

```bash
cd /opt/luxipanel
pm2 start ecosystem.config.cjs
pm2 save
sudo pm2 startup    # ejecuta el comando que imprime, para arranque en boot
```

> ⚠️ **Regla del ecosystem:** `ecosystem.config.cjs` lee los `.env` SOLO al
> evaluarse. Si cambias un `.env`, **no** uses `pm2 restart <app>` a secas —
> re-evalúa el archivo:
> ```bash
> pm2 restart /opt/luxipanel/ecosystem.config.cjs --update-env
> ```

---

## 6. nginx + TLS

El instalador (Vía A) ya deja un vhost nginx. En la **Vía B** lo configuras tú.
Vhost mínimo (reverse proxy al frontend `:4321` y API al backend `:8080`, con
WebSocket para terminal/monitor):

```nginx
server {
    listen 80;
    server_name panel.tudominio.com;

    # Frontend (Astro SSR)
    location / {
        proxy_pass http://127.0.0.1:4321;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSockets (terminal/monitor) van DIRECTO al backend
    location /api/terminal     { proxy_pass http://127.0.0.1:8080; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; }
    location /api/preferences/ws { proxy_pass http://127.0.0.1:8080; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; }
}
```

Activa el sitio y emite TLS con Let's Encrypt:

```bash
sudo ln -s /etc/nginx/sites-available/panel.tudominio.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# TLS (certbot configura el 443 automáticamente)
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d panel.tudominio.com
```

> Con TLS activo, mantén `COOKIE_SECURE=true` en `backend/.env`. Si pruebas sin
> dominio/HTTPS (solo `http://IP` o `localhost`), pon `COOKIE_SECURE=false` o el
> navegador descartará la cookie de sesión.

### 6.1 Si usas Cloudflare delante del servidor

1. **Antes de emitir el certificado con certbot, pon el registro DNS en
   "DNS only"** (nube **gris**) en el panel de Cloudflare. Con el proxy activo
   (nube naranja), el reto HTTP-01 de Let's Encrypt no llega al origen y
   `certbot` falla. Tras emitir el certificado, vuelve a activar el proxy
   (nube naranja).

   ```bash
   # con el registro en "DNS only":
   sudo certbot --nginx -d panel.tudominio.com
   # luego reactiva el proxy (nube naranja) en Cloudflare
   ```

2. **Modo SSL/TLS de Cloudflare → "Full (strict)"** (Overview → SSL/TLS).
   Requiere que el origen tenga un certificado válido (el de certbot del paso
   anterior). Evita "Flexible" (rompe redirecciones/cookies con bucles http↔https).

3. **Variables de entorno** (las deja así el instalador con `--cloudflare`, o
   ponlas a mano). Con este dominio de ejemplo `panel.tudominio.com`:

   ```ini
   # backend/.env
   CORS_ORIGIN=https://panel.tudominio.com
   COOKIE_DOMAIN=                       # VACÍO (host-only)
   COOKIE_SECURE=true
   WEBAUTHN_ORIGIN=https://panel.tudominio.com

   # frontend/.env
   SITE_URL=https://panel.tudominio.com
   LUXIPANEL_URL=https://panel.tudominio.com
   ```

   Tras editar `.env`, re-evalúa el ecosystem:
   `pm2 restart /opt/luxipanel/ecosystem.config.cjs --update-env`.

> Sin estos valores, el login detrás de Cloudflare devuelve **`CSRF token
> mismatch`** (la cookie se descarta por dominio/scheme). Ver paso 10.

---

## 7. Primer login (crear el admin)

El primer usuario **del grupo sudo** que entre será el admin del panel. Asegúrate
de tener uno (o créalo):

```bash
# ¿Tu usuario ya está en sudo?
id tu_usuario | grep -q sudo && echo "ya es sudo" || sudo usermod -aG sudo tu_usuario

# (Opcional) crear uno nuevo de administración:
sudo adduser adminpanel
sudo usermod -aG sudo adminpanel
```

Abre **`https://panel.tudominio.com/login`** e inicia sesión con ese usuario y su
**contraseña del sistema**. Quedará como admin. Desde **/panel/users** das acceso
a otros usuarios (gestionando sus grupos Linux).

---

## 8. Verificación post-despliegue

```bash
# Procesos arriba
pm2 status                       # luxipanel-backend y luxipanel-frontend = online

# Puertos escuchando
ss -ltnp | grep -E ':(8080|4321|80|443)'

# Logs (sin "Failed to start"). No debe intentar activar licencia contra LP.
pm2 logs luxipanel-backend --lines 50

# El backend responde y reporta modo local
curl -s http://127.0.0.1:8080/api/public/layout | head -c 200
# → {"ok":true,"matched":true,"configured":true,"source":"local",...}

# La página de login carga
curl -skI https://panel.tudominio.com/login | head -1   # HTTP/.. 200
```

Comprobar que la validación PAM funciona (node-pty + `su`):
```bash
node -e "require('node-pty'); console.log('node-pty OK')"   # desde backend/
getent passwd nobody >/dev/null && echo "nobody OK"
```

---

## 9. Actualizar a una versión nueva

```bash
cd /opt/luxipanel
git pull
cd backend  && pnpm install && pnpm run build && cd ..
cd frontend && pnpm install && pnpm run build && cd ..
pm2 restart /opt/luxipanel/ecosystem.config.cjs --update-env
```

(Existe también `update.sh` en el repo; revisa que respete tu modo standalone.)

---

## 10. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| Backend no arranca, log menciona Redis | Redis caído/inaccesible | `sudo systemctl status redis-server`; `redis-cli ping`; revisar `REDIS_URL`. |
| `Environment Validation Error: JWT_SECRET` | Falta o <32 chars | `openssl rand -hex 32` → `backend/.env`; re-evaluar ecosystem. |
| Login dice "Contraseña incorrecta" con la clave correcta | El panel NO corre como root y `su` no valida; o falta `nobody` | Corre el proceso como root; confirma `getent passwd nobody`. |
| `node-pty` no carga / "validación no disponible" | Build tools faltantes al instalar | `sudo apt-get install -y build-essential` y `pnpm install` de nuevo en `backend/`. |
| Entras y vuelve a /login (no guarda sesión) | Cookie descartada | Con HTTPS: `COOKIE_SECURE=true`. Sin HTTPS: `COOKIE_SECURE=false`. `COOKIE_DOMAIN` vacío. Re-evaluar ecosystem. |
| Login devuelve **`CSRF token mismatch`** (típico detrás de **Cloudflare** / proxy TLS) | La cookie `luxipanel_csrf` se descarta: `COOKIE_DOMAIN` apunta a otro dominio (el `.luxipanel.com` del `.env.example`) o el scheme público no coincide | En **backend Y frontend** `.env`: `COOKIE_DOMAIN=` **vacío** (host-only) + `COOKIE_SECURE=true` + orígenes `https://tudominio` en `CORS_ORIGIN`/`WEBAUTHN_ORIGIN` (backend) y `SITE_URL`/`LUXIPANEL_URL` (frontend). En Cloudflare, SSL/TLS en **Full (strict)**. Re-evaluar ecosystem (`pm2 restart … --update-env`). El instalador con **`--cloudflare`**/`--https` ya los deja así. |
| 502 en el navegador | Frontend/backend caídos o puertos mal | `pm2 status`; `ss -ltnp`; revisar `proxy_pass` del vhost. |
| Build del frontend muere (`heap out of memory`) | Poca RAM | `NODE_OPTIONS="--max-old-space-size=4096" pnpm run build` (o añade swap). |
| Cambié `.env` y no aplica | `pm2 restart <app>` usa config cacheada | `pm2 restart /opt/luxipanel/ecosystem.config.cjs --update-env`. |

---

## 11. Notas y límites de esta versión

- El método de login local es **contraseña** (cuenta Linux + PAM).
- Es **multi-nodo**: administra su propio servidor **y** los servidores remotos
  que registres en el módulo Servidores (SSH directo, credenciales cifradas en la
  bóveda local con `CREDENTIAL_VAULT_KEY`).

## Licencia

LUXIPANEL se distribuye bajo **AGPL-3.0** (ver `LICENSE`). Si corres una versión
modificada como servicio de red, la AGPL-3.0 te obliga a ofrecer el código
correspondiente a tus usuarios.

## Comprobación actual y clave de cuenta (2026-10-13)

La clave se crea con nombre en Seguridad → API KEY de luxipanel.com y se introduce en el panel instalado. No registra servidores. La clave configurada por UI prevalece sobre LP_PANEL_CREDENTIAL; validación ausente/inválida produce 403 y servicio no disponible, 503 en las rutas protegidas.

En actualizaciones Astro, respalda dist y limpia únicamente el dist del frontend correcto; usa NODE_OPTIONS=--max-old-space-size=2560 y una compilación por máquina. Después de cada build reinicia su proceso y verifica online y HTTP. Si cambia .env, reevalúa el ecosystem con --only <app> --update-env. No iniciar procesos duplicados ni confundir arranque inicial con actualización.
