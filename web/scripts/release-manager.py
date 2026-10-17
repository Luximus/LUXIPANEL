#!/usr/bin/env python3
"""Manually install an official tag or pinned branch revision; recover on health failure."""
import fcntl
import hashlib
import tempfile
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import urllib.request

TAG_RE = re.compile(r"v?[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?\Z")
UPSTREAM = "https://github.com/Luxisoft/LUXIPANEL.git"
BRANCHES = ("main", "developer", "web", "desktop", "mobile", "modules")
PM2 = shutil.which("pm2") or next((str(p) for p in (
    Path.home() / ".local/share/pnpm/bin/pm2", Path.home() / ".npm-global/bin/pm2"
) if p.is_file()), "pm2")


def run(args, cwd, timeout=900, env=None):
    subprocess.run(args, cwd=cwd, env=env, timeout=timeout, check=True)


def write_state(path, state):
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(state, indent=2) + "\n")
    temp.chmod(0o600)
    os.replace(temp, path)


def application(source):
    return source / "web" if (source / "web/backend").is_dir() else source


def ports(source):
    source = application(source)
    result = []
    for area, default in (("backend", 8080), ("frontend", 4321)):
        value = default
        env_path = source / area / ".env"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("PORT=") and line[5:].strip().isdigit():
                    value = int(line[5:].strip())
        result.append(value)
    return result


def healthy(source):
    backend_port, frontend_port = ports(source)
    try:
        output = subprocess.check_output([PM2, "jlist"], text=True, timeout=15)
        rows = json.loads(output)
    except (OSError, subprocess.SubprocessError, ValueError):
        return False
    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        return False
    for area, entry in (("backend", "dist/server.js"), ("frontend", "dist/server/entry.mjs")):
        apps = [row for row in rows if row.get("name") == "luxipanel-" + area]
        if len(apps) != 1:
            return False
        process = apps[0].get("pm2_env", {})
        expected = application(source) / area
        if not isinstance(process, dict) or process.get("status") != "online":
            return False
        # PM2 restart can keep the old script/cwd even when it reports online.
        # Only the requested artifact may be recorded as installed.
        if any(not isinstance(process.get(key), str) or not process[key] or Path(process[key]).resolve() != path.resolve()
               for key, path in (("pm_cwd", expected), ("pm_exec_path", expected / entry))):
            return False
    for url in (f"http://127.0.0.1:{backend_port}/api/health", f"http://127.0.0.1:{frontend_port}/login"):
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                if response.status != 200:
                    return False
        except Exception:
            return False
    return True


def activate(source):
    ecosystem = application(source) / "ecosystem.config.cjs"
    if not ecosystem.is_file():
        raise RuntimeError("Falta ecosystem.config.cjs en la versión preparada")
    for app in ("luxipanel-backend", "luxipanel-frontend"):
        subprocess.run([PM2, "delete", app], cwd=source, timeout=60, check=False)
        run([PM2, "start", str(ecosystem), "--only", app, "--update-env"], source, timeout=60)
        run([PM2, "restart", str(ecosystem), "--only", app, "--update-env"], source, timeout=60)
    for _ in range(18):
        if healthy(source):
            run([PM2, "save"], source, timeout=60)
            return
        time.sleep(5)
    raise RuntimeError("Los procesos no quedaron online o la API y el frontend no respondieron")


RUNTIME_PATHS = (".releases/", ".lxp/", "backend/dist/", "frontend/dist/", "web/backend/dist/", "web/frontend/dist/")


def local_changes(source):
    output = subprocess.check_output(["git", "status", "--porcelain=v1", "-z", "--untracked-files=all"], cwd=source)
    names = []
    entries = iter(output.decode().split("\0"))
    for entry in entries:
        if not entry:
            continue
        name = entry[3:]
        if entry[:2].strip() in ("R", "C", "RM"):
            next(entries, None)
        if not any(name == prefix.rstrip("/") or name.startswith(prefix) for prefix in RUNTIME_PATHS):
            names.append(name)
    return names


def verify_bundle(source, tag):
    file = source / "release.manifest.json"
    if not file.is_file():
        raise RuntimeError("La Release no incluye un manifiesto de entrega conjunta")
    manifest = json.loads(file.read_text())
    if not isinstance(manifest.get("modules"), list):
        raise RuntimeError("Falta el conjunto aprobado de módulos")
    if manifest.get("format") != 1 or manifest.get("version") != tag.removeprefix("v"):
        raise RuntimeError("El manifiesto no corresponde a la versión solicitada")
    for module in manifest.get("modules", []):
        if not re.fullmatch(r"[a-z][a-z0-9-]{2,38}", module.get("id", "")):
            raise RuntimeError("Identificador de módulo inválido")
        if not re.fullmatch(r"[a-f0-9]{40}", module.get("commit", "")) or not re.fullmatch(r"\d+\.\d+\.\d+", module.get("version", "")) or not re.fullmatch(r"[a-f0-9-]{36}", module.get("versionId", "")):
            raise RuntimeError("Provenance de módulo no verificable")
        directory = application(source) / "backend/dist/modules/community/installed" / module["id"]
        for name, digest in module.get("files", {}).items():
            if not re.fullmatch(r"[a-f0-9]{64}", digest):
                raise RuntimeError("Hash de entrega inválido")
            path = directory / name
            if path.is_symlink() or not path.resolve().is_relative_to(directory.resolve()) or not path.is_file():
                raise RuntimeError("Archivo de módulo fuera del bundle aprobado")
            if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                raise RuntimeError("El hash del módulo no corresponde a la Release")
        if not module.get("files"):
            raise RuntimeError("Módulo sin hashes de entrega")
    return manifest


def preserve_previews(previous, release):
    previous = application(previous); release = application(release)
    installed = Path("backend/dist/modules/community/installed")
    if not (previous / installed).is_dir():
        return
    for source in (previous / installed).iterdir():
        if source.is_symlink() or not source.is_dir() or not (source / ".preview.json").is_file():
            continue
        destination = release / installed / source.name
        if destination.exists() and (destination / ".preview.json").is_file():
            continue
        if destination.exists():
            raise RuntimeError("Preview privada en conflicto con módulo oficial: " + source.name)
        shutil.copytree(source, destination, symlinks=True)


def switch_static(root, release, manager):
    previous = []
    try:
        for area, name in (("backend", "dist"), ("frontend", "dist"), ("backend", ".env"), ("frontend", ".env")):
            if name == ".env" and not (application(release) / area / name).is_file(): continue
            path = application(root) / area / name
            old = {"path": str(path), "link": os.readlink(path) if path.is_symlink() else None, "backup": None}
            if path.exists() and not path.is_symlink():
                backup = manager / ("legacy-" + area + "-" + name + "-" + str(time.time_ns()))
                path.rename(backup)
                old["backup"] = str(backup)
            previous.append(old)
            temp = path.with_name(name + ".next")
            if temp.exists() or temp.is_symlink():
                raise RuntimeError("Existe un cambio de directorio estático pendiente")
            temp.symlink_to(application(release) / area / name, target_is_directory=name == "dist")
            os.replace(temp, path)
        return previous
    except Exception:
        restore_static(previous)
        raise


def restore_static(previous):
    for entry in reversed(previous):
        path = Path(entry["path"])
        if path.is_symlink():
            path.unlink()
        if entry["link"]:
            path.symlink_to(entry["link"], target_is_directory=True)
        elif entry["backup"]:
            Path(entry["backup"]).rename(path)


def validate_selection(tag, branch=None, expected_commit=None):
    if branch is not None:
        if branch not in BRANCHES or not re.fullmatch(r"[a-f0-9]{40}", expected_commit or ""):
            raise ValueError("Rama o revisión inválida")
    elif not TAG_RE.fullmatch(tag):
        raise ValueError("Etiqueta inválida")


def fetch_revision(root, tag, branch=None, expected_commit=None):
    validate_selection(tag, branch, expected_commit)
    ref = f"refs/heads/{branch}" if branch else f"refs/tags/{tag}"
    run(["git", "fetch", "--no-tags", UPSTREAM, f"+{ref}:refs/luxipanel/install-candidate"], root, timeout=180)
    commit = subprocess.check_output(["git", "rev-parse", "refs/luxipanel/install-candidate^{commit}"], cwd=root, text=True).strip()
    if branch and commit != expected_commit:
        raise RuntimeError("La rama cambió desde la selección. Revisa la nueva revisión antes de instalar")
    return commit


def preserve_installed_modules(previous, release):
    # A branch is not a reviewed release bundle: keep the installation's current
    # approved modules and private previews instead of activating branch copies.
    if previous.resolve() == release.resolve():
        return
    destination = application(release) / "backend/dist/modules/community/installed"
    if destination.exists():
        shutil.rmtree(destination)
    source = application(previous) / "backend/dist/modules/community/installed"
    if source.is_dir():
        shutil.copytree(source, destination, symlinks=True)


def main(root, tag, branch=None, expected_commit=None):
    validate_selection(tag, branch, expected_commit)
    if branch is None and not TAG_RE.fullmatch(tag):
        raise ValueError("Etiqueta inválida")
    if not Path(PM2).is_file():
        raise RuntimeError("PM2 no está disponible para el usuario de LUXIPANEL")
    manager = root / ".releases"
    manager.mkdir(mode=0o700, exist_ok=True)
    manager.chmod(0o700)
    lock = manager / "manager.lock"
    build_dir = root / ".lxp"
    build_dir.mkdir(mode=0o700, exist_ok=True)
    with lock.open("w") as locked, (build_dir / "build.lock").open("a") as build_lock:
        fcntl.flock(locked, fcntl.LOCK_EX | fcntl.LOCK_NB)
        fcntl.flock(build_lock, fcntl.LOCK_EX)
        state_path = manager / "state.json"
        state = json.loads(state_path.read_text()) if state_path.exists() else {}
        prior = state.get("installed")
        previous_path = Path(prior["path"]) if isinstance(prior, dict) and prior.get("path") else root
        selection = {"branch": branch, "commit": expected_commit} if branch else {"tag": tag}
        state["operation"] = {"status": "running", **selection, "stage": "preflight", "startedAt": int(time.time() * 1000)}
        write_state(state_path, state)
        switched = False
        static_previous = []
        old_head = None
        old_branch = None
        commit = None
        checkout_changed = False
        try:
            changed = local_changes(root)
            if changed:
                raise RuntimeError("Cambios locales preservados; resuélvelos antes de actualizar: " + ", ".join(changed[:20]))
            old_head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
            if shutil.disk_usage(root).free < 5 * 1024 ** 3:
                raise RuntimeError("Espacio insuficiente: se requieren al menos 5 GiB libres")
            old_branch = subprocess.check_output(["git", "branch", "--show-current"], cwd=root, text=True).strip()
            commit = fetch_revision(root, tag, branch, expected_commit)
            if branch:
                installed_commit = prior.get("commit") if isinstance(prior, dict) else old_head
                if not isinstance(installed_commit, str) or not re.fullmatch(r"[a-f0-9]{40}", installed_commit):
                    raise RuntimeError("No se pudo verificar la revisión instalada; se conserva la instalación")
                if installed_commit == commit:
                    raise RuntimeError("Esta revisión ya está instalada; no hay cambios pendientes")
                if subprocess.run(["git", "merge-base", "--is-ancestor", installed_commit, commit], cwd=root, check=False).returncode != 0:
                    raise RuntimeError("La rama no conserva todas las mejoras instaladas; se mantiene la instalación actual")
            # Never drop local-only history. A recorded installed revision, or a
            # commit contained in its official upstream branch, is recoverable.
            if not isinstance(prior, dict) or prior.get("commit") != old_head:
                history_branch = old_branch if old_branch in BRANCHES else "main"
                run(["git", "fetch", "--no-tags", UPSTREAM, f"refs/heads/{history_branch}:refs/luxipanel/install-history"], root, timeout=180)
                if subprocess.run(["git", "merge-base", "--is-ancestor", old_head, "refs/luxipanel/install-history"], cwd=root, check=False).returncode != 0:
                    raise RuntimeError("Commits personalizados preservados; intégralos antes de actualizar")
            if not branch:
                run(["git", "fetch", "--no-tags", UPSTREAM, "refs/heads/main:refs/luxipanel/upstream-main"], root, timeout=180)
                if subprocess.run(["git", "merge-base", "--is-ancestor", commit, "refs/luxipanel/upstream-main"], cwd=root, check=False).returncode != 0:
                    raise RuntimeError("La Release no pertenece al historial oficial de main")
            if branch:
                local_ref = subprocess.run(["git", "rev-parse", "--verify", f"refs/heads/{branch}"], cwd=root, text=True, capture_output=True)
                if local_ref.returncode == 0 and subprocess.run(["git", "merge-base", "--is-ancestor", local_ref.stdout.strip(), commit], cwd=root, check=False).returncode != 0:
                    raise RuntimeError("La rama local contiene cambios propios; se han conservado")
            release = manager / (("branch-" if branch else "") + commit)
            if not (release / ".build-complete").is_file():
                if release.exists():
                    try:
                        run(["git", "worktree", "remove", "--force", str(release)], root, timeout=60)
                    except subprocess.CalledProcessError:
                        shutil.rmtree(release)
                        run(["git", "worktree", "prune"], root, timeout=60)
                run(["git", "worktree", "add", "--detach", str(release), commit], root, timeout=180)
                if branch and not all((application(release) / name).exists() for name in ("backend/package.json", "frontend/package.json", "ecosystem.config.cjs")):
                    raise RuntimeError("Esta rama no contiene una instalación completa del panel")
                for area in ("backend", "frontend"):
                    origin_env = application(previous_path) / area / ".env"
                    if origin_env.is_file():
                        destination = application(release) / area / ".env"
                        shutil.copy2(origin_env, destination)
                        destination.chmod(0o600)
                env = dict(os.environ, NODE_OPTIONS="--max-old-space-size=2560")
                state["operation"]["stage"] = "building-backend"
                write_state(state_path, state)
                run(["pnpm", "install", "--frozen-lockfile"], application(release) / "backend", env=env)
                run(["pnpm", "run", "build"], application(release) / "backend", env=env)
                state["operation"]["stage"] = "building-frontend"
                write_state(state_path, state)
                run(["pnpm", "install", "--frozen-lockfile"], application(release) / "frontend", env=env)
                shutil.rmtree(application(release) / "frontend" / "dist", ignore_errors=True)
                for command in (["pnpm", "run", "i18n:audit"], ["pnpm", "run", "i18n:split"],
                                ["node", "scripts/build-extracted.mjs"], ["pnpm", "exec", "astro", "build"],
                                ["node", "scripts/copy-dist-metadata.mjs"]):
                    run(command, application(release) / "frontend", env=env)
                if not branch:
                    run(["node", "scripts/build-release-bundle.mjs", "--verify"], application(release), env=env)
                    verify_bundle(release, tag)
                (release / ".build-complete").write_text(commit + "\n")
            if branch:
                preserve_installed_modules(previous_path, release)
                manifest = {"modules": prior.get("modules", []) if isinstance(prior, dict) else []}
            else:
                preserve_previews(previous_path, release)
                manifest = verify_bundle(release, tag)
            for area in ("backend", "frontend"):
                origin_env = application(previous_path) / area / ".env"
                if origin_env.is_file():
                    destination = application(release) / area / ".env"
                    if origin_env.resolve() != destination.resolve():
                        shutil.copy2(origin_env, destination)
                    destination.chmod(0o600)
            if local_changes(root) or subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip() != old_head:
                raise RuntimeError("El código local cambió durante la preparación; se ha conservado sin activar la actualización")
            state["operation"]["stage"] = "activating"
            write_state(state_path, state)
            static_previous = switch_static(root, release, manager)
            switched = True
            activate(release)
            # Make the clone match the selected revision only after healthy activation.
            checkout_changed = True
            if branch:
                exists = subprocess.run(["git", "show-ref", "--verify", "--quiet", f"refs/heads/{branch}"], cwd=root, check=False).returncode == 0
                run(["git", "-c", "core.hooksPath=/dev/null", "switch", branch] if exists else ["git", "-c", "core.hooksPath=/dev/null", "switch", "-c", branch, commit], root, timeout=60)
                run(["git", "-c", "core.hooksPath=/dev/null", "merge", "--ff-only", commit], root, timeout=60)
            else:
                run(["git", "-c", "core.hooksPath=/dev/null", "switch", "--detach", commit], root, timeout=60)
            state["previous"] = prior
            state["installed"] = {**selection, "commit": commit, "path": str(release), "modules": [{"id": row["id"], "version": row["version"]} for row in manifest.get("modules", [])]}
            state["operation"] = {"status": "complete", **selection}
        except Exception as error:
            if switched:
                try:
                    restore_static(static_previous)
                    if checkout_changed and old_head:
                        run(["git", "-c", "core.hooksPath=/dev/null", "switch", "--detach", old_head], root, timeout=60)
                        if old_branch:
                            tip = subprocess.check_output(["git", "rev-parse", f"refs/heads/{old_branch}"], cwd=root, text=True).strip()
                            if old_branch == branch and tip == commit:
                                run(["git", "update-ref", f"refs/heads/{old_branch}", old_head, commit], root, timeout=60)
                                tip = old_head
                            if tip == old_head:
                                run(["git", "-c", "core.hooksPath=/dev/null", "switch", old_branch], root, timeout=60)
                    activate(previous_path)
                    state["operation"] = {"status": "rolled_back", **selection, "error": str(error)}
                except Exception as rollback_error:
                    state["operation"] = {"status": "failed", **selection, "error": str(error), "rollbackError": str(rollback_error)}
            else:
                state["operation"] = {"status": "failed", **selection, "error": str(error)}
            raise
        finally:
            write_state(state_path, state)


if __name__ == "__main__":
    if len(sys.argv) == 5 and sys.argv[2] == "--branch":
        main(Path(sys.argv[1]).resolve(), "", sys.argv[3], sys.argv[4])
    elif len(sys.argv) == 3:
        main(Path(sys.argv[1]).resolve(), sys.argv[2])
    else:
        raise SystemExit("usage: release-manager.py ROOT TAG | ROOT --branch NAME SHA")
