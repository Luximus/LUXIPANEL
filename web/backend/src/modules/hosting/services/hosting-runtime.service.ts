import { hostingPhpCommand, hostingPhpConfig, hostingPhpSocket } from "./hosting-php-policy.js";
import { HOSTING_CRON_HELPER, HOSTING_JOB_HELPER } from "./hosting-cron-helper.js";
import { cronParserService, buildManagedLine } from "../../cron/services/cron-parser.service.js";
import { HOSTING_CRON_WRAPPER_PATH } from "../../../shared/tenant/hosting-cron-control.js";
import { runWithExecutor } from "../../../shared/executor/context.js";
import type { Executor } from "../../../shared/executor/index.js";
import { quoteArg } from "../../../shared/executor/index.js";
import { panelConfigDir } from "../../../config/paths.js";
import { applyStepsOrThrow } from "../../../shared/remote-cache/apply-steps.js";
import type { MutationStep } from "../../../shared/remote-cache/submit-mutation.js";
import { ForbiddenError, ServiceUnavailableError } from "../../../shared/errors/index.js";
import { systemAccountsService } from "../../users/services/system-accounts.service.js";
import { roleRepository } from "../../users/repositories/role.repository.js";
import { buildEffectivePermissions, mergeRolePermissions } from "../../../shared/auth/role-permissions.js";
import type { HostingAccount } from "../models/hosting-account.model.js";
import { HOSTING_RUNTIME_HELPER, HOSTING_EXEC_HELPER } from "./hosting-runtime-helper.js";
import { PROJECT_QUOTA_SETUP } from "./hosting-project-quota.js";
import { assertHostingPolicyLease } from "./hosting-policy-lock.js";

export const HOSTING_LOGIN_SHELL = "/usr/lib/luxipanel/hosting-login";
export const hostingRuntimeService = {
  async invalidate(executor: Executor, account: HostingAccount) {
    if (!account.templateId || !Number.isSafeInteger(account.id)) return;
    await applyStepsOrThrow(executor, { module: "hosting", collection: "accounts", op: "update", steps: [
      { type: "sh", argv: ["install", "-d", "-m", "0755", `${panelConfigDir()}/hosting/runtime`], sudo: true },
      { type: "writeFile", path: `${panelConfigDir()}/hosting/runtime/account-${account.id}.json`, content: JSON.stringify({ state: "pending" }), root: true, mode: "0600" },
      { type: "sh", argv: ["sh", "-c", `if systemctl is-active --quiet luxipanelhosting${account.id}.slice; then systemctl stop luxipanelhosting${account.id}.slice; fi`], sudo: true },
    ], refresh: [], notConfirmedMessage: "Hosting runtime revocation not confirmed", notConfirmedCode: "HOSTING_JAIL_NOT_CONFIRMED" });
  },
  async capabilities(executor: Executor) {
    const probe = await executor.exec("test -d /run/systemd/system && cat /sys/fs/cgroup/cgroup.controllers", { timeoutMs: 5000 });
    const controllers = probe.exitCode === 0 ? probe.stdout.trim().split(/\s+/) : [];
    const jail = await executor.exec(`test -x /usr/sbin/jk_init && test -x /usr/sbin/jk_cp && /usr/bin/python3 -I -c 'import ctypes,sysconfig; ctypes.CDLL("libseccomp.so.2"); print(sysconfig.get_path("stdlib"))'`, { timeoutMs: 5000 });
    const mount = await executor.exec("findmnt -J -T /home -o FSTYPE,TARGET,OPTIONS", { timeoutMs: 5000 });
    let filesystem: { fstype?: string; target?: string; options?: string } = {};
    try { filesystem = JSON.parse(mount.stdout).filesystems[0] ?? {}; } catch { /* unsupported */ }
    const library = await executor.exec("/sbin/ldconfig -p | awk '/libseccomp.so.2/ {print $NF; exit}'", { timeoutMs: 5000 });
    const tools = await executor.exec("command -v xfs_quota; command -v setquota", { timeoutMs: 5000 });
    const active = /(^|,)(prjquota|pquota)(,|$)/.test(filesystem.options ?? "");
    const quota = { mount: filesystem.target ?? "/", xfsQuota: active && filesystem.fstype === "xfs" && tools.stdout.includes("xfs_quota"),
      extProjectQuota: active && filesystem.fstype === "ext4" && tools.stdout.includes("setquota") };
    const phpProbe = await executor.exec(`for candidate in /usr/sbin/php-fpm /usr/sbin/php-fpm[0-9]*; do if test -x "$candidate"; then printf '%s' "$candidate"; break; fi; done`, { timeoutMs: 5000 });
    const phpBinary = /^\/usr\/sbin\/php-fpm(?:\d+\.\d+)?$/.test(phpProbe.stdout.trim()) ? phpProbe.stdout.trim() : null;
    const workerProbe = await executor.exec("command -v setfacl >/dev/null && awk '/^[[:space:]]*user[[:space:]]/ {gsub(/;/,\"\",$2); print $2; exit}' /etc/nginx/nginx.conf", { timeoutMs: 5000 });
    const phpWorker = workerProbe.exitCode === 0 && /^[a-z_][a-z0-9_-]*$/.test(workerProbe.stdout.trim()) ? workerProbe.stdout.trim() : null;
    return { php: !!phpBinary && !!phpWorker, phpBinary, phpWorker, cpu: controllers.includes("cpu"), memory: controllers.includes("memory"), processes: controllers.includes("pids"),
      jail: jail.exitCode === 0 && /^\/(usr\/)?lib\//.test(library.stdout.trim()), pythonLibrary: jail.stdout.trim(), seccompLibrary: library.stdout.trim(), disk: quota.xfsQuota || quota.extProjectQuota, quota, bandwidth: false };
  },
  async apply(executor: Executor, account: HostingAccount, revision: number) {
    if (!account.resourceLimits || !account.security) throw new ForbiddenError("Missing hosting runtime limits");
    if (!/^[a-z][a-z0-9_-]{2,31}$/.test(account.username) || account.homeRoot !== `/home/${account.username}` || !Number.isSafeInteger(account.id)) throw new ForbiddenError("Invalid hosting runtime identity");
    const caps = await this.capabilities(executor);
    if (!caps.cpu || !caps.memory || !caps.processes || !caps.jail || !caps.disk) throw new ServiceUnavailableError("Hosting runtime requires cgroups v2, Jailkit and active filesystem quotas");
    const users = (await systemAccountsService.listUsersWithTenantGroup(account.tenantGroup)).filter(user => user.username === account.username || user.homeDir.startsWith(account.homeRoot + "/"));
    for (const user of users) {
      user.groups = await systemAccountsService.userGroups(user.username);
      if (!user.groups.includes(account.tenantGroup)) throw new ForbiddenError("Hosting user missing its dedicated group");
    }
    const roles = await roleRepository.findAll(executor);
    const root = `/var/lib/luxipanel/jails/${account.id}`, slice = `luxipanelhosting${account.id}.slice`;
    const limits = account.resourceLimits;
    const steps: MutationStep[] = [
      { type: "sh", argv: ["install", "-d", "-m", "0755", root, "/usr/lib/luxipanel", `${panelConfigDir()}/hosting/runtime`], sudo: true },
      { type: "sh", argv: ["/usr/sbin/jk_init", "-j", root, "basicshell", "extendedshell", "netutils"], sudo: true },
      { type: "writeFile", path: "/usr/lib/luxipanel/hosting-shell", content: HOSTING_RUNTIME_HELPER.replace("__CONFIG__", panelConfigDir()), mode: "0755", root: true, owner: "root:root" },
      { type: "writeFile", path: "/usr/lib/luxipanel/hosting-exec", content: HOSTING_EXEC_HELPER, mode: "0755", root: true, owner: "root:root" },
      { type: "sh", argv: ["/usr/sbin/jk_cp", "-j", root, "/usr/bin/python3", caps.pythonLibrary, caps.seccompLibrary, "/usr/lib/luxipanel/hosting-exec"], sudo: true },
      { type: "writeFile", path: "/usr/lib/luxipanel/hosting-job", content: HOSTING_JOB_HELPER, mode: "0755", root: true, owner: "root:root" },
      { type: "writeFile", path: HOSTING_CRON_WRAPPER_PATH, content: HOSTING_CRON_HELPER, mode: "0755", root: true, owner: "root:root" },
      { type: "writeFile", path: HOSTING_LOGIN_SHELL, content: "#!/bin/sh\nexec /usr/bin/sudo -n -- /usr/lib/luxipanel/hosting-shell\n", mode: "0755", root: true, owner: "root:root" },
      { type: "writeFile", path: `/etc/systemd/system/${slice}`, content: `[Unit]\nDescription=LUXIPANEL hosting account ${account.id}\n[Slice]\nCPUAccounting=yes\nMemoryAccounting=yes\nTasksAccounting=yes\nCPUQuota=${limits.cpuPercent}%\nMemoryMax=${limits.memoryMb}M\nMemorySwapMax=0\nTasksMax=${limits.maxProcesses}\n`, root: true, mode: "0644" },
    ];
    let phpCommand: string | null = null;
    // A legacy shared FPM pool would execute customer PHP outside this slice.
    // Require an explicit migration before activating such an existing site.
    const { nginxSitesService } = await import("../../nginx/services/nginx-sites.service.js");
    for (const site of await nginxSitesService.listSitesWithContent(executor)) {
      if (site.root && (site.root === account.homeRoot || site.root.startsWith(account.homeRoot + "/"))) {
        const raw = await nginxSitesService.readRaw(executor, site.name);
        if (/fastcgi_pass\s/.test(raw) && !raw.includes("fastcgi_pass unix:" + hostingPhpSocket(account) + ";")) throw new ServiceUnavailableError("Existing PHP sites require migration to the account runtime");
      }
    }
    if (caps.php && caps.phpBinary && caps.phpWorker && account.allowedModules.includes("dns")) {
      phpCommand = hostingPhpCommand(account, caps.phpBinary);
      const socket = hostingPhpSocket(account), runDir = socket.slice(0, socket.lastIndexOf("/"));
      steps.push({ type: "sh", argv: ["/usr/sbin/jk_cp", "-j", root, caps.phpBinary, "/usr/lib/php"], sudo: true },
        { type: "writeFile", path: `${root}/etc/luxipanel-hosting-php.conf`, content: hostingPhpConfig(account, caps.phpWorker), root: true, mode: "0644" },
        { type: "writeFile", path: `${root}/etc/luxipanel-hosting-php.ini`, content: "expose_php=Off\ncgi.fix_pathinfo=0\nlog_errors=On\nerror_log=/proc/self/fd/2\n", root: true, mode: "0644" },
        { type: "sh", argv: ["sudo", "-u", account.username, "-H", "mkdir", "-p", "--", runDir], sudo: true },
        { type: "sh", argv: ["sudo", "-u", account.username, "-H", "setfacl", "-m", `u:${caps.phpWorker}:--x`, account.homeRoot, `${account.homeRoot}/.luxipanel`, runDir], sudo: true });
    }
    const passwd = ["root:x:0:0:root:/root:/usr/sbin/nologin"], groups: string[] = [];
    const groupIdentity = await executor.exec("getent group " + quoteArg(account.tenantGroup), { timeoutMs: 5000 });
    const groupLine = groupIdentity.stdout.trim().split("\n").find(line => line.startsWith(account.tenantGroup + ":"));
    if (groupIdentity.exitCode !== 0 || !groupLine) throw new ForbiddenError("Hosting group unavailable");
    groups.push(groupLine);
    if (phpCommand && caps.phpWorker) {
      const workerIdentity = await executor.exec("getent passwd " + quoteArg(caps.phpWorker), { timeoutMs: 5000 });
      if (workerIdentity.exitCode !== 0) throw new ServiceUnavailableError("PHP socket worker unavailable");
      passwd.push(workerIdentity.stdout.trim());
    }
    const cronAvailable = (await executor.exec("command -v crontab", { timeoutMs: 5000 })).exitCode === 0;
    for (const user of users) {
      if (user.username !== account.username && !user.homeDir.startsWith(account.homeRoot + "/")) throw new ForbiddenError("Hosting sub-user outside account home");
      if (user.groups.some(g => ["sudo", "wheel", "admin"].includes(g))) throw new ForbiddenError("Privileged identity cannot enter a hosting plan");
      const identity = await systemAccountsService.getSystemUser(user.username);
      if (!identity || identity.uid < 1000) throw new ForbiddenError("Invalid hosting Linux user");
      if (executor.sshUsername === user.username) throw new ForbiddenError("Hosting runtime requires a separate service identity");
      steps.push({ type: "sh", argv: ["sh", "-c", `pkill -KILL -u ${identity.uid}; code=$?; test "$code" -le 1`], sudo: true });
      const oldCron = cronAvailable ? await executor.exec("sudo -n crontab -u " + quoteArg(user.username) + " -l", { timeoutMs: 8000 }) : null;
      if (oldCron && oldCron.exitCode !== 0 && !/no crontab for/i.test(oldCron.stderr)) throw new ServiceUnavailableError("Hosting crontab inspection failed");
      if (oldCron?.exitCode === 0) {
        const jobs = cronParserService._parse(oldCron.stdout, user.username);
        const physical = oldCron.stdout.split("\n").map(line => line.trim()).filter(line => line && (!line.startsWith("#") || line.startsWith("#LXP-OFF ")) && !/^(SHELL|PATH)=/.test(line));
        if (physical.length !== jobs.length || jobs.some(job => !cronParserService.validate(job.schedule).valid || (!job.managed && job.command.includes("%")))) throw new ServiceUnavailableError("Existing crontab requires migration before hosting activation");
        const body = "SHELL=/bin/sh\nPATH=/usr/bin:/bin\n" + jobs.map(job => buildManagedLine(job.schedule, job.command, job.comment, job.id, job.enabled, HOSTING_CRON_WRAPPER_PATH)).join("\n") + "\n";
        steps.push({ type: "writeFile", path: `${panelConfigDir()}/hosting/runtime/cron-original-${account.id}-${identity.uid}-${revision}-${Date.now()}.json`, content: JSON.stringify({ savedAt: new Date().toISOString(), raw: oldCron.stdout }), root: true, mode: "0600" });
        steps.push({ type: "sh", argv: ["sh", "-c", "printf '%s' " + quoteArg(body) + " | crontab -u " + quoteArg(user.username) + " -"], sudo: true });
      }
      passwd.push(`${user.username}:x:${identity.uid}:${identity.gid}::${identity.homeDir}:/bin/bash`);
      if (identity.gid !== Number(groupLine.split(":")[2])) groups.push(`${user.username}:x:${identity.gid}:`);
      const perms = user.username === account.username ? account.permissionTemplate : mergeRolePermissions(roles
        .filter(r => r.name !== account.tenantGroup && user.groups.includes(r.name))
        .map(r => buildEffectivePermissions({ rolePermissions: r.permissions, modules: r.modules as string[], isAdminKind: false })));
      const allowed = perms.fileAccess.allowPaths.filter(p => account.permissionTemplate.fileAccess.allowPaths.some(base => p === base || p.startsWith(base + "/")));
      const policy = { state: "ready", uid: identity.uid, accountId: account.id, revision, homeRoot: account.homeRoot, jailRoot: root, slice,
        group: account.tenantGroup, security: account.security, serviceCommands: user.username === account.username && phpCommand ? [phpCommand] : [], workingDirectory: allowed[0] ?? "/",
        paths: { allowPaths: allowed, readOnlyPaths: [...new Set([...perms.fileAccess.readOnlyPaths, ...account.permissionTemplate.fileAccess.readOnlyPaths])],
          denyPaths: [...new Set([...perms.fileAccess.denyPaths, ...account.permissionTemplate.fileAccess.denyPaths])] } };
      steps.push({ type: "writeFile", path: `${panelConfigDir()}/hosting/runtime/${user.username}.json`, content: JSON.stringify(policy), root: true, mode: "0600" },
        { type: "writeFile", path: `/etc/sudoers.d/lxp-hosting-${identity.uid}`, content: `${user.username} ALL=(root) NOPASSWD: /usr/lib/luxipanel/hosting-shell "", /usr/lib/luxipanel/hosting-job ""\n`, root: true, mode: "0440" },
        { type: "sh", argv: ["visudo", "-cf", `/etc/sudoers.d/lxp-hosting-${identity.uid}`], sudo: true },
        { type: "sh", argv: ["usermod", "-s", HOSTING_LOGIN_SHELL, user.username], sudo: true });
    }
    if (!users.some(u => u.username === account.username)) throw new ForbiddenError("Hosting owner missing from dedicated group");
    steps.push({ type: "writeFile", path: `${root}/etc/passwd`, content: passwd.join("\n") + "\n", root: true, mode: "0644" },
      { type: "writeFile", path: `${root}/etc/group`, content: groups.join("\n") + "\n", root: true, mode: "0644" },
      { type: "sh", argv: ["systemctl", "daemon-reload"], sudo: true },
      { type: "sh", argv: ["systemctl", "start", slice], sudo: true },
      { type: "sh", argv: ["systemctl", "set-property", slice, `CPUQuota=${limits.cpuPercent}%`, `MemoryMax=${limits.memoryMb}M`, `MemorySwapMax=0`, `TasksMax=${limits.maxProcesses}`], sudo: true });
    const project = 1500000000 + account.id;
    if (project > 2147483647) throw new ForbiddenError("Hosting project ID exceeds reserved range");
    steps.push({ type: "sh", argv: ["python3", "-c", PROJECT_QUOTA_SETUP, account.homeRoot, String(project)], sudo: true });
    if (caps.quota.xfsQuota) steps.push({ type: "sh", argv: ["xfs_quota", "-x", "-c", `limit -p bhard=${limits.diskQuotaMb}m ${project}`, caps.quota.mount], sudo: true });
    else steps.push({ type: "sh", argv: ["setquota", "-P", String(project), "0", String(limits.diskQuotaMb * 1024), "0", "0", caps.quota.mount], sudo: true });
    await applyStepsOrThrow(executor, { module: "hosting", collection: "accounts", op: "update", steps, refresh: [["users", "system"]], notConfirmedMessage: "Hosting runtime not confirmed", notConfirmedCode: "HOSTING_JAIL_NOT_CONFIRMED" });
    const confirm = await executor.exec(`systemctl is-active ${quoteArg(slice)} && sudo -n visudo -c`, { timeoutMs: 10000 });
    if (confirm.exitCode !== 0) throw new ServiceUnavailableError("Hosting runtime verification failed");
    await assertHostingPolicyLease();
    await applyStepsOrThrow(executor, { module: "hosting", collection: "accounts", op: "update", steps: [{ type: "writeFile", path: `${panelConfigDir()}/hosting/runtime/account-${account.id}.json`, content: JSON.stringify({ state: account.status === "active" ? "ready" : "pending", revision, status: account.status, expiresAt: account.expiresAt, users: users.map(u => u.username) }), root: true, mode: "0600" }], refresh: [], notConfirmedMessage: "Hosting runtime activation not confirmed", notConfirmedCode: "HOSTING_JAIL_NOT_CONFIRMED" });
    if (phpCommand && account.status === "active") {
      const launch = await executor.exec("sudo -n /usr/lib/luxipanel/hosting-shell --service " + quoteArg(account.username) + " " + quoteArg(Buffer.from(phpCommand).toString("base64")), { timeoutMs: 10000 });
      if (launch.exitCode !== 0) throw new ServiceUnavailableError("Hosting PHP startup failed");
      const confirmPhp = await executor.exec(`for attempt in 1 2 3 4 5; do if systemctl is-active --quiet lxp-hosting-${account.id}-php.service && test -S ${quoteArg(hostingPhpSocket(account))}; then exit 0; fi; sleep 1; done; exit 1`, { timeoutMs: 8000 });
      if (confirmPhp.exitCode !== 0) throw new ServiceUnavailableError("Hosting PHP socket verification failed");
    }
    account.runtimeCapabilities = { php: !!phpCommand };
  },
};

// Native maintenance consists exclusively of validated server-owned recipes.
// Keep its explicit target without inheriting the caller's authorization epoch.
for (const method of ["invalidate", "apply"] as const) {
  const handler = hostingRuntimeService[method] as (executor: Executor, ...args: any[]) => Promise<void>;
  (hostingRuntimeService as unknown as Record<string, (...args: any[]) => Promise<void>>)[method] = (executor: Executor, ...args: any[]) => runWithExecutor(executor, () => handler.call(hostingRuntimeService, executor, ...args));
}
