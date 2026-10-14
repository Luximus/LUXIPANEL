# Standalone installers by scenario

Thin wrappers over the root [`install.sh`](../../install.sh) that pick the right
flags for common server situations, so you can self-host LUXIPANEL
(the single self-hosted local/SSH mode) without memorising flags. Full guide:
[`DESPLIEGUE-STANDALONE.md`](../../DESPLIEGUE-STANDALONE.md) /
[`SELF-HOSTING.md`](../../SELF-HOSTING.md).

Run any of them as **root**, from the repo root, passing your domain (or let it
prompt). Extra flags are forwarded to `install.sh` (`bash install.sh --help`).

| Script | When to use |
|---|---|
| `install-standalone-new-cloudflare.sh` | **Fresh server, behind Cloudflare.** Installs everything (apt → pm2) and issues TLS via certbot with the Cloudflare "DNS only" guidance. |
| `install-standalone-new-direct.sh` | **Fresh server, no Cloudflare.** Installs everything and issues a direct Let's Encrypt cert (`certbot --nginx`). |
| `install-standalone-existing-deps.sh` | **Deps already installed (redis/postgresql/certbot/nginx), but nginx is NOT configured for your domain.** Skips apt, writes the nginx vhost, issues TLS. |
| `install-standalone-existing-nginx-ready.sh` | **Deps installed AND nginx already configured (vhost + TLS).** App-only deploy: skips apt + nginx, binds the exact ports your vhost expects (`--strict-ports`). |

## Examples

```bash
# Fresh + Cloudflare
sudo bash scripts/standalone/install-standalone-new-cloudflare.sh --domain panel.tudominio.com

# Fresh + direct TLS (no Cloudflare)
sudo bash scripts/standalone/install-standalone-new-direct.sh --domain panel.tudominio.com --email tu@correo

# Existing deps, configure nginx now
sudo bash scripts/standalone/install-standalone-existing-deps.sh --domain panel.tudominio.com
#   behind Cloudflare instead of direct TLS:  ... --cloudflare

# Existing deps + nginx already configured (point the app at your vhost's ports)
sudo bash scripts/standalone/install-standalone-existing-nginx-ready.sh \
  --domain panel.tudominio.com --backend-port 8080 --frontend-port 4321
```

## Notes

- **Ports:** the installer auto-detects busy ports and picks the next free one,
  EXCEPT under `--strict-ports` (scenario 4), where a busy port is fatal so it
  stays aligned with your existing nginx vhost.
- **Cookies / CSRF:** standalone always uses a **host-only** cookie
  (`COOKIE_DOMAIN=` empty); the `--https`/`--cloudflare` flags also set
  `COOKIE_SECURE=true` and the `https://` origins. This is what prevents the
  `CSRF token mismatch` at login behind a TLS proxy / Cloudflare.
- **TLS override:** add `--http` to any scenario whose origin really serves plain
  http (rare — only if you terminate TLS elsewhere as http to this box).
- These wrappers don't add logic of their own — everything lives in the root
  `install.sh` (single source of truth). Read it to see exactly what runs.
