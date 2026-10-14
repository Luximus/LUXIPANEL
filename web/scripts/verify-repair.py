#!/usr/bin/env python3
"""Run repair checks in disposable namespaces, without host secrets or services."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import shutil
import subprocess

RECIPES = {
    "backend-types": ["pnpm", "--dir", "backend", "run", "typecheck"],
    "backend-tests": ["pnpm", "--dir", "backend", "test"],
    "frontend-tests": ["pnpm", "--dir", "frontend", "run", "test:unit"],
    "frontend-build": ["pnpm", "--dir", "frontend", "build"],
}


def sandbox(cwd, argv, network=False):
    bwrap = shutil.which("bwrap")
    pnpm = shutil.which("pnpm")
    if not bwrap or not pnpm:
        raise RuntimeError("Install bubblewrap and pnpm to verify repairs safely")
    args = [bwrap, "--unshare-all", "--die-with-parent", "--new-session", "--clearenv"]
    if network:
        args += ["--share-net"]
    for location in ("/usr", "/bin", "/lib", "/lib64"):
        if Path(location).exists():
            args += ["--ro-bind", location, location]
    cache_home = Path(os.environ.get("COREPACK_HOME", str(Path.home() / ".cache/node/corepack")))
    locations = [cache_home / "v1/pnpm/11.5.0", cache_home / "pnpm/11.5.0"]
    executable = Path(pnpm).resolve()
    if executable.name == "pnpm.cjs": locations.insert(0, executable.parent.parent)
    cache = next((place for place in locations if (place / "bin/pnpm.cjs").is_file()), None)
    if not cache:
        raise RuntimeError("Provision pnpm 11.5.0 with corepack prepare pnpm@11.5.0 --activate")
    args += ["--ro-bind", str(cache), "/opt/pnpm", "--ro-bind", "/etc/ssl/certs", "/etc/ssl/certs"]
    if network:
        for location in ("/etc/resolv.conf", "/etc/hosts"):
            args += ["--ro-bind", location, location]
    args += ["--dev", "/dev", "--proc", "/proc", "--tmpfs", "/tmp", "--tmpfs", "/home",
             "--dir", "/home/sandbox", "--bind", str(cwd), "/work", "--chdir", "/work",
             "--setenv", "HOME", "/home/sandbox", "--setenv", "PATH", "/usr/local/bin:/usr/bin:/bin",
             "--setenv", "CI", "1", "--setenv", "NODE_OPTIONS", "--max-old-space-size=2560"]
    if argv[0] == "pnpm":
        argv = ["node", "/opt/pnpm/bin/pnpm.cjs"] + argv[1:]
    return subprocess.run(args + ["--"] + argv, text=True, capture_output=True, timeout=600)


def verify(cwd, check, module=None):
    if check not in RECIPES:
        raise ValueError("Unknown check")
    areas = [Path("backend"), Path("frontend")]
    if module:
        if not __import__("re").fullmatch(r"[a-z][a-z0-9-]{2,38}", module):
            raise ValueError("Invalid module")
        areas = [Path("modules") / module]
    for area in areas:
        directory = cwd / area
        if (directory / "package.json").exists() and not (directory / "node_modules").exists():
            # Dependency hooks cannot execute during the network-enabled stage.
            result = sandbox(cwd, ["pnpm", "--dir", str(area), "install", "--frozen-lockfile",
                                    "--ignore-scripts", "--ignore-pnpmfile", "--registry", "https://registry.npmjs.org"], True)
            if result.returncode:
                return result
    argv = RECIPES[check]
    if module:
        directory = Path("modules") / module
        package = json.loads((cwd / directory / "package.json").read_text()) if (cwd / directory / "package.json").exists() else {}
        script = "typecheck" if check == "backend-types" else "test"
        argv = ["pnpm", "--dir", str(directory), "run", script] if script in package.get("scripts", {}) else None
        if argv is None:
            return subprocess.CompletedProcess([], 1, "", "El módulo debe definir typecheck y test en package.json antes de publicar un arreglo verificado")
    return sandbox(cwd, argv)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--cwd", type=Path, required=True)
    parser.add_argument("--check", choices=RECIPES, required=True)
    parser.add_argument("--lock", type=Path, required=True)
    parser.add_argument("--module")
    args = parser.parse_args()
    args.lock.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    with args.lock.open("a") as locked:
        fcntl.flock(locked, fcntl.LOCK_EX)
        result = verify(args.cwd.resolve(), args.check, args.module)
        print(json.dumps({"passed": result.returncode == 0, "output": (result.stdout + "\n" + result.stderr)[-16000:]}))
