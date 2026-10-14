#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Ejecuta el instalador como administrador.' >&2; exit 1; }
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
service_user=${LUXISOFT_DEPLOY_SERVICE_USER:-}
if [[ -z "$service_user" && -r /etc/luxipanel-deployment-runtime.json ]]; then
  service_user=$(python3 -c 'import json; print(json.load(open("/etc/luxipanel-deployment-runtime.json"))["serviceUser"])')
fi
service_user=${service_user:-${SUDO_USER:?Set LUXISOFT_DEPLOY_SERVICE_USER}}
[[ "$service_user" != root && "$service_user" =~ ^[a-z_][a-z0-9_-]*$ ]] || exit 1
config_root=${LUXIPANEL_CONFIG_DIR:-/etc/luxipanel}
getent passwd "$service_user" >/dev/null
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y podman uidmap passt slirp4netns fuse-overlayfs
install -d -m 0755 /usr/lib/luxipanel
install -m 0755 "$script_dir/deployment-helper.py" /usr/lib/luxipanel/deployment-helper
install -m 0755 "$script_dir/deployment-tenant.mjs" /usr/lib/luxipanel/deployment-tenant.mjs
install -d -m 0755 /etc/luxipanel
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
podman --version
echo 'Runtime de despliegues instalado. Activa deployments.read/write/build/publish en el proveedor de Luxisoft.'
