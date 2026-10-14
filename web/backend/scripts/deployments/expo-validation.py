#!/usr/bin/python3
"""Run approved mobile validation in a disposable namespace and bounded cgroup.

The broker installs approved packages without hooks. Customer source may only
see that job's workspace and system libraries, with no network or host config.
"""
import contextlib, json, os, pathlib, pwd, re, subprocess, sys

def command(workspace, mode, username):
    if mode not in ('typecheck', 'export'):
        raise ValueError('invalid_validation_mode')
    argv = ['/usr/bin/systemd-run', '--quiet', '--pipe', '--wait', '--collect',
            '--unit=luxi-expo-' + workspace.name.removeprefix('lxp-mobile-') + '-' + mode,
            '--property=User=' + username, '--property=Group=' + str(pwd.getpwnam(username).pw_gid),
            '--property=MemoryMax=768M', '--property=MemorySwapMax=0',
            '--property=CPUQuota=100%', '--property=TasksMax=128',
            '--property=RuntimeMaxSec=600', '--property=NoNewPrivileges=yes',
            '--property=KillMode=control-group', '--property=LimitFSIZE=67108864',
            '/usr/bin/bwrap', '--unshare-all', '--die-with-parent', '--new-session',
            '--cap-drop', 'ALL', '--clearenv', '--ro-bind', '/usr', '/usr',
            '--symlink', 'usr/bin', '/bin', '--symlink', 'usr/sbin', '/sbin',
            '--symlink', 'usr/lib', '/lib', '--symlink', 'usr/lib64', '/lib64',
            '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp',
            '--bind', str(workspace), '/work', '--chdir', '/work',
            '--setenv', 'PATH', '/usr/bin:/bin', '--setenv', 'HOME', '/work/.home',
            '--setenv', 'LANG', 'C.UTF-8', '--setenv', 'CI', '1',
            '--setenv', 'EXPO_OFFLINE', '1', '--setenv', 'NODE_OPTIONS', '--max-old-space-size=512',
            '/usr/bin/node']
    return argv + (['node_modules/typescript/bin/tsc', '--noEmit'] if mode == 'typecheck' else
                   ['node_modules/expo/bin/cli', 'export', '--platform', 'web', '--output-dir', 'dist'])

def main():
    if os.geteuid() != 0 or len(sys.argv) != 3:
        raise ValueError('validation_requires_supervisor')
    workspace = pathlib.Path(sys.argv[1])
    if not re.fullmatch(r'/tmp/lxp-mobile-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', str(workspace)):
        raise ValueError('invalid_validation_workspace')
    service = pwd.getpwnam(json.loads(pathlib.Path('/etc/luxipanel-deployment-runtime.json').read_text())['serviceUser'])
    # Root never follows a customer-controlled child symlink or writes a file
    # inside the workspace. Pin its parent inode as broker-owned before mounting;
    # /tmp's sticky bit then prevents a tenant swapping it for a host symlink.
    with contextlib.ExitStack() as lease:
        descriptor = os.open(workspace, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        lease.callback(os.close, descriptor)
        item = os.fstat(descriptor)
        candidates = [user for user in pwd.getpwall() if
                      re.fullmatch(r'hp[a-f0-9]{20}', user.pw_name) and
                      (item.st_uid == user.pw_uid or item.st_uid in (0, service.pw_uid) and user.pw_gid == item.st_gid)]
        if len(candidates) != 1 or candidates[0].pw_dir != '/home/' + candidates[0].pw_name:
            raise ValueError('invalid_validation_owner')
        user = candidates[0]
        os.fchown(descriptor, service.pw_uid, user.pw_gid)
        os.fchmod(descriptor, 0o770)
        linked = workspace.lstat()
        if (linked.st_dev, linked.st_ino) != (item.st_dev, item.st_ino) or workspace.resolve() != workspace:
            raise ValueError('unsafe_validation_workspace')
    result = subprocess.run(command(workspace, sys.argv[2], user.pw_name),
                            env={'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8'}, timeout=630)
    sys.exit(result.returncode)

if __name__ == '__main__':
    main()
