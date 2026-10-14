import { ValidationError } from "../../../shared/errors/index.js";
import type { HostingAccount } from "../models/hosting-account.model.js";
export function hostingPhpCommand(_account: HostingAccount, binary: string): string {
  if (!/^\/usr\/sbin\/php-fpm(?:\d+\.\d+)?$/.test(binary)) throw new ValidationError("Unsupported hosting PHP runtime");
  return `${binary} --nodaemonize --fpm-config /etc/luxipanel-hosting-php.conf --php-ini /etc/luxipanel-hosting-php.ini`;
}
export function hostingPhpSocket(account: Pick<HostingAccount, "username" | "homeRoot">): string {
  if (account.homeRoot !== `/home/${account.username}` || !/^[a-z][a-z0-9_-]{2,31}$/.test(account.username)) throw new ValidationError("Invalid hosting PHP identity");
  return `${account.homeRoot}/.luxipanel/run/php.sock`;
}
export function hostingPhpConfig(account: HostingAccount, worker = "www-data"): string {
  if (!/^[a-z_][a-z0-9_-]*$/.test(worker)) throw new ValidationError("Invalid PHP socket worker");
  const children = Math.max(1, Math.min(32, account.resourceLimits!.maxProcesses - 8));
  return `[global]\ndaemonize = no\nerror_log = /proc/self/fd/2\n[account]\nlisten = ${hostingPhpSocket(account)}\nlisten.mode = 0600\nlisten.acl_users = ${worker}\npm = ondemand\npm.max_children = ${children}\npm.process_idle_timeout = 10s\ncatch_workers_output = yes\nclear_env = yes\nsecurity.limit_extensions = .php\nphp_admin_value[memory_limit] = ${Math.max(16, Math.floor(account.resourceLimits!.memoryMb / children))}M\n`;
}
