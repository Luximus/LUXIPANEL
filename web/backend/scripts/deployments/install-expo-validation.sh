#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || exit 1
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
service_user=${LUXISOFT_DEPLOY_SERVICE_USER:-}
if [[ -z "$service_user" && -r /etc/luxipanel-deployment-runtime.json ]]; then
  service_user=$(python3 -c 'import json; print(json.load(open("/etc/luxipanel-deployment-runtime.json"))["serviceUser"])')
fi
service_user=${service_user:-${SUDO_USER:?Set LUXISOFT_DEPLOY_SERVICE_USER}}
[[ "$service_user" != root && "$service_user" =~ ^[a-z_][a-z0-9_-]*$ ]] || exit 1
[[ "$service_user" =~ ^[a-z_][a-z0-9_-]*$ ]] || exit 1
[[ ! -L /usr/lib/luxipanel/expo-validation && ! -L /etc/sudoers.d/luxisoft-expo-validation ]] || exit 1
backup=$(mktemp -d /var/backups/luxipanel-expo-validation.XXXXXX)
chmod 0700 "$backup"
for target in /usr/lib/luxipanel/expo-validation /etc/sudoers.d/luxisoft-expo-validation; do
  if [[ -e "$target" ]]; then cp -a "$target" "$backup/$(basename "$target")"; fi
done
DEBIAN_FRONTEND=noninteractive apt-get install -y bubblewrap
install -m 0755 "$script_dir/expo-validation.py" /usr/lib/luxipanel/expo-validation
printf '%s ALL=(root) NOPASSWD: /usr/lib/luxipanel/expo-validation\n' "$service_user" > /etc/sudoers.d/luxisoft-expo-validation
chmod 0440 /etc/sudoers.d/luxisoft-expo-validation
visudo -cf /etc/sudoers.d/luxisoft-expo-validation
echo "Validación móvil instalada; respaldo: $backup"
