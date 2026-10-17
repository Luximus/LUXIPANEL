# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 LUXISOFT
"""Contain assistant workloads on the executing target, without changing UID.

This is a resource boundary for accidental overload, not a security sandbox.
Never retry an executed command, and never fall back to an unbounded launch.
"""
import fcntl
import json
import os
from pathlib import Path
import signal
import stat
import subprocess
import sys
import time
import uuid

MIB = 1024 * 1024
SLICE = "luxipanel-assistant.slice"


def memory_info():
    return {line.split(":")[0]: int(line.split()[1]) * 1024
            for line in Path("/proc/meminfo").read_text().splitlines()
            if line.startswith(("MemTotal:", "MemAvailable:"))}


def limits(total, cpus, kind, cap_mib=None):
    cap = (768 if kind == "browser" else 3584) * MIB
    if cap_mib is not None:
        cap = min(cap, int(cap_mib) * MIB)
    maximum = min(cap, total * 45 // 100) // 4096 * 4096
    return {
        "groupMax": total // 2 // 4096 * 4096,
        "groupHigh": total * 35 // 100 // 4096 * 4096,
        "max": maximum, "high": maximum * 80 // 100 // 4096 * 4096,
        "swap": min(512 * MIB, total // 16),
        "jobSwap": min(512 * MIB, total // 16, maximum // 4),
        "cpu": max(50, min(200, cpus * 50)),
        "reserve": max(512 * MIB, total // 5),
    }


def fail(code, message, status=78):
    print(json.dumps({"type": "error", "code": code, "message": message}, ensure_ascii=False), flush=True)
    return status


def control(*args):
    result = subprocess.run(["systemctl", "--user", *args], capture_output=True, text=True, timeout=10)
    if result.returncode:
        raise RuntimeError("resource manager unavailable")
    return result.stdout.strip()


def private_directory(runtime):
    directory = runtime / "luxipanel-resources"
    directory.mkdir(mode=0o700, exist_ok=True)
    info = directory.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise RuntimeError("unsafe resource directory")
    return directory


def lock_file(directory, name):
    return os.open(directory / name, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600)


def admitted(mem, policy, used):
    # memory.high already throttles/reclaims every task in the shared slice.
    # Waiting until memory.max admits new chats into an already stalled group.
    return mem["MemAvailable"] >= policy["reserve"] and used + 256 * MIB <= min(policy["groupHigh"], policy["groupMax"])


# Executed INSIDE the scope before the command. Verify kernel enforcement, not
# just successful systemd configuration. The command keeps the caller's UID/env.
VERIFY = r'''
import json, os, pathlib, sys
p=json.loads(sys.argv[1]); name=sys.argv[2]
try:
    cg=next(line[3:] for line in pathlib.Path('/proc/self/cgroup').read_text().splitlines() if line.startswith('0::'))
    assert cg.endswith('/'+name) and '/luxipanel-assistant.slice/' in cg
    base=pathlib.Path('/sys/fs/cgroup'+cg)
    for key,limit in [('memory.max',p['max']),('memory.high',p['high']),('memory.swap.max',p['jobSwap']),('pids.max',512)]:
        assert int((base/key).read_text()) <= limit
    for key,limit in [('memory.max',p['groupMax']),('memory.high',p['groupHigh']),('memory.swap.max',p['swap']),('pids.max',1024)]:
        assert int((base.parent/key).read_text()) <= limit
    for group in [base,base.parent]:
        quota,period=(group/'cpu.max').read_text().split()
        assert quota != 'max' and int(quota)*100 <= p['cpu']*int(period)
except Exception:
    print(json.dumps({'type':'error','code':'RESOURCE_GUARD_UNAVAILABLE','message':'No se pudo verificar la protección de recursos; la tarea no se inició.'}),flush=True)
    sys.exit(78)
os.execvp(sys.argv[3],sys.argv[3:])
'''


def main(options, command):
    started_at = time.monotonic()
    if options.get("kind") not in ("cli", "browser") or not command:
        return fail("RESOURCE_GUARD_UNAVAILABLE", "La protección de recursos no recibió una tarea válida.")
    unit = "luxipanel-task-" + uuid.uuid4().hex + ".scope"
    locks = []
    child = None
    launched = False
    try:
        if not Path("/sys/fs/cgroup/cgroup.controllers").exists():
            raise RuntimeError("cgroup v2 required")
        runtime = Path("/run/user") / str(os.getuid())
        if not (runtime / "bus").exists():
            raise RuntimeError("user manager required")
        os.environ["XDG_RUNTIME_DIR"] = str(runtime)
        os.environ["DBUS_SESSION_BUS_ADDRESS"] = "unix:path=" + str(runtime / "bus")
        directory = private_directory(runtime)
        policy = limits(memory_info()["MemTotal"], os.cpu_count() or 1, options["kind"], options.get("memoryMaxMiB"))
        config_lock = lock_file(directory, "configure.lock")
        locks.append(config_lock)
        config_deadline = time.monotonic() + 10
        while True:
            try:
                fcntl.flock(config_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= config_deadline:
                    raise RuntimeError("resource manager busy")
                time.sleep(0.1)
        control("set-property", "--runtime", SLICE,
                f'MemoryHigh={policy["groupHigh"]}', f'MemoryMax={policy["groupMax"]}',
                f'MemorySwapMax={policy["swap"]}', f'CPUQuota={policy["cpu"]}%', "TasksMax=1024")
        control("start", SLICE)
        group_path = control("show", SLICE, "-p", "ControlGroup", "--value")
        if not group_path.startswith("/") or not group_path.endswith("/" + SLICE):
            raise RuntimeError("invalid resource group")
        group = Path("/sys/fs/cgroup" + group_path)
        fcntl.flock(config_lock, fcntl.LOCK_UN)
        browser_lock = None
        if options["kind"] == "browser":
            browser_lock = lock_file(directory, "browser.lock")
            locks.append(browser_lock)
        deadline = time.monotonic() + options.get("queueSeconds", 300)
        announced = False
        while True:
            available = admitted(memory_info(), policy, int((group / "memory.current").read_text()))
            if available and browser_lock is not None:
                try:
                    fcntl.flock(browser_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                except BlockingIOError:
                    available = False
            if available:
                break
            if time.monotonic() >= deadline:
                return fail("RESOURCE_GUARD_BUSY", "El servidor no tiene recursos libres suficientes o el navegador está ocupado. La tarea no llegó a iniciarse; inténtalo cuando termine el trabajo activo.", 75)
            if not announced:
                print("[LUXIPANEL] Esperando recursos disponibles para iniciar la tarea.", file=sys.stderr, flush=True)
                announced = True
            time.sleep(1)
        # Keep failed units until their Result is inspected; --collect would
        # erase the evidence needed to distinguish OOM from other signals.
        args = ["systemd-run", "--user", "--scope", "--quiet", "--description=LUXIPANEL " + options["kind"], "--unit=" + unit, "--slice=" + SLICE,
                "-p", f'MemoryHigh={policy["high"]}', "-p", f'MemoryMax={policy["max"]}',
                "-p", f'MemorySwapMax={policy["jobSwap"]}', "-p", f'CPUQuota={policy["cpu"]}%',
                "-p", "TasksMax=512", "-p", "OOMPolicy=kill", "-p", "TimeoutStopSec=5s"]
        if options.get("runtimeSeconds"):
            remaining = options["runtimeSeconds"] - (time.monotonic() - started_at)
            if remaining <= 0:
                return fail("RESOURCE_GUARD_BUSY", "No hubo recursos disponibles dentro del tiempo de espera. La tarea no llegó a iniciarse.", 75)
            args += ["-p", "RuntimeMaxSec=" + str(remaining)]
        args += ["--", "python3", "-c", VERIFY, json.dumps(policy), unit, *command]
        child = subprocess.Popen(args)
        launched = True

        def terminate(_signal, _frame):
            try:
                control("stop", unit)
            finally:
                if child.poll() is None:
                    child.terminate()

        signal.signal(signal.SIGTERM, terminate)
        signal.signal(signal.SIGINT, terminate)
        result = child.wait()
        if result:
            # Read systemd's observed outcome, never infer OOM from exit 137.
            try:
                outcome = control("show", unit, "-p", "Result", "--value")
                if outcome == "oom-kill":
                    return fail("RESOURCE_GUARD_MEMORY", "El sistema detuvo la tarea por falta de memoria. El trabajo puede estar incompleto; revisa los cambios antes de continuar.", 137)
                if outcome == "timeout":
                    return fail("RESOURCE_GUARD_INTERRUPTED", "La tarea superó su tiempo límite y se detuvo. No se pudo confirmar el resultado; revisa los cambios antes de continuar.", 124)
            except (OSError, RuntimeError, subprocess.SubprocessError):
                pass
        return 128 - result if result < 0 else result
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError):
        if launched:
            return fail("RESOURCE_GUARD_INTERRUPTED", "La tarea se interrumpió y no se pudo confirmar el resultado. Revisa los cambios antes de continuar.", 1)
        return fail("RESOURCE_GUARD_UNAVAILABLE", "No se pudo activar la protección de recursos. La tarea no se inició; revisa systemd, cgroups v2 y el servicio de usuario del servidor.")
    finally:
        if launched:
            try:
                control("stop", unit)
            except (OSError, RuntimeError, subprocess.SubprocessError):
                pass
            try:
                control("reset-failed", unit)
            except (OSError, RuntimeError, subprocess.SubprocessError):
                pass
        for descriptor in locks:
            os.close(descriptor)


if __name__ == "__main__":
    sys.exit(main(json.loads(sys.argv[1]), sys.argv[2:]))
