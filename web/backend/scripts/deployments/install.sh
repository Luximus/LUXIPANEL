#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Ejecuta el instalador como administrador.' >&2; exit 1; }
if [[ -e /etc/luxisoft-development-runtime/policy.json ]]; then
  echo 'La barrera de red está activa. Usa una actualización coordinada que conserve el wrapper; no se cambió el runtime.' >&2
  exit 1
fi
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
service_user=${LUXISOFT_DEPLOY_SERVICE_USER:-jmarin}
config_root=${LUXIPANEL_CONFIG_DIR:-/etc/luxipanel}
gateway_port=${LUXISOFT_PROJECT_GATEWAY_PORT:-3460}
gateway_trusted_ips=${LUXISOFT_PROJECT_GATEWAY_TRUSTED_IPS:-198.252.105.131,127.0.0.1,::1}
getent passwd "$service_user" >/dev/null
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y podman uidmap passt slirp4netns fuse-overlayfs
install -d -m 0755 /usr/lib/luxipanel
install -m 0755 "$script_dir/deployment-helper.py" /usr/lib/luxipanel/deployment-helper
install -m 0755 "$script_dir/deployment-tenant.mjs" /usr/lib/luxipanel/deployment-tenant.mjs
install -m 0755 "$script_dir/deployment-gateway.mjs" /usr/lib/luxipanel/deployment-gateway.mjs
install -d -m 0755 /etc/luxipanel
install -d -o "$service_user" -g "$service_user" -m 0700 /var/lib/luxipanel/project-gateway
DEPLOY_SERVICE_USER="$service_user" DEPLOY_CONFIG_ROOT="$config_root" python3 - <<'PY'
import json,os
file='/etc/luxipanel-deployment-runtime.json'
with open(file,'w') as f: json.dump({'serviceUser':os.environ['DEPLOY_SERVICE_USER'],'configRoot':os.environ['DEPLOY_CONFIG_ROOT']},f)
os.chmod(file,0o644)
PY
printf '%s ALL=(root) NOPASSWD: /usr/lib/luxipanel/deployment-helper\n' "$service_user" > /etc/sudoers.d/luxisoft-deployments
chmod 0440 /etc/sudoers.d/luxisoft-deployments
visudo -cf /etc/sudoers.d/luxisoft-deployments
printf 'f /run/lock/luxisoft-heavy-build.lock 0644 root root -\n' > /etc/tmpfiles.d/luxisoft-builds.conf
systemd-tmpfiles --create /etc/tmpfiles.d/luxisoft-builds.conf
touch /run/lock/luxisoft-heavy-build.lock
chmod 0644 /run/lock/luxisoft-heavy-build.lock
cat > /etc/luxipanel-project-gateway.env <<EOF
PROJECT_GATEWAY_PORT=$gateway_port
PROJECT_GATEWAY_HOST=0.0.0.0
PROJECT_GATEWAY_TRUSTED_IPS=$gateway_trusted_ips
PROJECT_GATEWAY_CACHE_ROOT=/var/lib/luxipanel/project-gateway
LUXIPANEL_DEPLOYMENT_RUNTIME_CONFIG=/etc/luxipanel-deployment-runtime.json
EOF
chmod 0644 /etc/luxipanel-project-gateway.env
cat > /etc/systemd/system/luxisoft-project-gateway.service <<EOF
[Unit]
Description=Luxisoft published project data-plane gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$service_user
Group=$service_user
EnvironmentFile=/etc/luxipanel-project-gateway.env
ExecStart=/usr/bin/node /usr/lib/luxipanel/deployment-gateway.mjs
Restart=always
RestartSec=2
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=read-only
ProtectSystem=strict
ReadWritePaths=/var/lib/luxipanel/project-gateway
ReadOnlyPaths=$config_root /etc/luxipanel-deployment-runtime.json

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now luxisoft-project-gateway.service
podman --version
echo 'Runtime y gateway de proyectos instalados. Activa deployments.read/write/build/publish en el proveedor de Luxisoft.'
