#!/usr/bin/python3
"""Install the metered supervisor behind the existing network guard wrapper.

Run only after the source release is committed and validated. This installer
never replaces /usr/lib/luxipanel/deployment-helper.
"""
import hashlib
import json
import os
import pathlib
import shutil
import stat
import tempfile

SOURCE = pathlib.Path(__file__).with_name('deployment-helper.py')
POLICY = pathlib.Path('/etc/luxisoft-development-runtime/policy.json')
WRAPPER = pathlib.Path('/usr/lib/luxipanel/deployment-helper')
RUNTIME = pathlib.Path('/usr/lib/luxisoft-development-runtime')
WRAPPER_SHA256 = 'a73e001c6cd05cd0ae0be1c4d981310f2f069f69472a86eb5d23e95721bff0bf'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def safe_root_file(path):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
        raise RuntimeError('unsafe_runtime_file')
    return path.read_bytes()

def atomic_write(path, data, mode):
    descriptor, temporary = tempfile.mkstemp(prefix='.metering-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'wb') as stream:
            os.fchmod(stream.fileno(), mode)
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)

def main():
    if os.geteuid() != 0: raise RuntimeError('root_required')
    if digest(safe_root_file(WRAPPER)) != WRAPPER_SHA256:
        raise RuntimeError('network_guard_changed')
    previous = safe_root_file(POLICY)
    policy = json.loads(previous)
    old = pathlib.Path(policy['originalHelper'])
    if old.parent != RUNTIME or digest(safe_root_file(old)) != policy['originalHash']:
        raise RuntimeError('supervisor_policy_mismatch')
    source = SOURCE.read_bytes()
    if b"'executionSeconds'" not in source or b"'maxExecutionSeconds'" not in source:
        raise RuntimeError('metering_source_missing')
    sha = digest(source)
    installed = RUNTIME / ('provider-helper-' + sha[:12])
    if installed.exists():
        if digest(safe_root_file(installed)) != sha: raise RuntimeError('supervisor_hash_collision')
    else:
        atomic_write(installed, source, 0o755)
    backup = pathlib.Path(tempfile.mkdtemp(prefix='luxipanel-metering-', dir='/var/backups'))
    os.chmod(backup, 0o700)
    shutil.copy2(POLICY, backup / 'policy.json')
    policy.update(originalHelper=str(installed), originalHash=sha)
    try:
        atomic_write(POLICY, json.dumps(policy).encode(), 0o600)
        if digest(safe_root_file(installed)) != sha or json.loads(safe_root_file(POLICY))['originalHash'] != sha:
            raise RuntimeError('supervisor_install_unverified')
    except Exception:
        atomic_write(POLICY, previous, 0o600)
        raise
    print(json.dumps({'helper': str(installed), 'sha256': sha, 'policyBackup': str(backup / 'policy.json')}))

if __name__ == '__main__': main()
