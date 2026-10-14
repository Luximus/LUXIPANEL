#!/usr/bin/env python3
"""Compose reviewed module versions into one reviewable panel release PR."""
import argparse
import io
import json
import os
from pathlib import Path
import re
import subprocess
import shutil
import tarfile
import urllib.request

REPOSITORY = "Luxisoft/LUXIPANEL"
UPSTREAM = "https://github.com/" + REPOSITORY + ".git"


def api(route, method="GET", data=None):
    token = os.environ.get("GH_TOKEN", "")
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "LUXIPANEL-release-pipeline"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request("https://api.github.com/repos/" + REPOSITORY + route, headers=headers, method=method, data=json.dumps(data).encode() if data is not None else None)
    with urllib.request.urlopen(request, timeout=30) as response:
        if response.status == 204:
            return None
        return json.load(response)


def next_version(version, bump):
    if not re.fullmatch(r"v?\d+\.\d+\.\d+", version):
        raise ValueError("Invalid base version")
    major, minor, patch = map(int, version.removeprefix("v").split("."))
    return f"{major + 1}.0.0" if bump == "major" else f"{major}.{minor + 1}.0" if bump == "minor" else f"{major}.{minor}.{patch + 1}"


def metadata_root(root):
    return root.parent if root.name == "web" and (root.parent / "release.manifest.json").is_file() else root


def extract_module(root, module, repository=None):
    slug = module["id"]
    if not re.fullmatch(r"[a-z][a-z0-9-]{2,38}", slug) or not re.fullmatch(r"[a-f0-9]{40}", module["commit"]):
        raise ValueError("Invalid approved module")
    subprocess.run(["git", "fetch", "--no-tags", UPSTREAM, module["commit"]], cwd=repository or root, check=True, timeout=180)
    archive = subprocess.check_output(["git", "archive", module["commit"], "web/modules/" + slug], cwd=repository or root)
    destination = root / "modules" / slug
    if destination.is_symlink():
        raise ValueError("Module destination is a link")
    shutil.rmtree(destination, ignore_errors=True)
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        for member in tar.getmembers():
            if member.name in ("web", "web/modules", "web/modules/" + slug) and member.isdir():
                continue
            if not member.name.startswith("web/modules/" + slug + "/") or member.issym() or member.islnk() or not (member.isdir() or member.isfile()):
                raise ValueError("Module archive is not confined to approved source")
            target = root / member.name.removeprefix("web/")
            if not target.resolve().is_relative_to((root / "modules" / slug).resolve()):
                raise ValueError("Module archive escaped its source directory")
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                if member.size > 2 * 1024 * 1024 or re.search(r"(?:^|/)(?:\.env(?:\.|$)|\.git|node_modules|dist)|\.(?:pem|key|ndjson|log)$", member.name):
                    raise ValueError("Private or generated file in module archive")
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(tar.extractfile(member).read())
                target.chmod(member.mode & 0o755)


def prepare(root, candidates, bump="auto", offline=False, extract=True):
    metadata = metadata_root(root)
    previous = json.loads((metadata / "release.manifest.json").read_text())
    tags = subprocess.check_output(["git", "tag", "--list", "v*"], cwd=root, text=True).splitlines()
    versions = [previous["version"]] + [tag[1:] for tag in tags if re.fullmatch(r"v\d+\.\d+\.\d+", tag)]
    base = max(versions, key=lambda value: tuple(map(int, value.split("."))))
    latest_tag = "v" + base
    subjects = subprocess.check_output(["git", "log", "--format=%s", latest_tag + "..HEAD"] if latest_tag in tags else ["git", "log", "-1", "--format=%s"], cwd=root, text=True)
    previous_versions = {row["id"]: row["version"] for row in previous.get("modules", [])}
    if bump == "auto":
        bump = "major" if "BREAKING CHANGE" in subjects or re.search(r"^\w+(?:\([^)]*\))?!:", subjects, re.M) else "minor" if re.search(r"^feat(?:\([^)]*\))?:", subjects, re.M) else "patch"
        for row in candidates["modules"]:
            old = previous_versions.get(row["id"])
            if not old and bump == "patch":
                bump = "minor"
            elif old and old.split(".")[0] != row["version"].split(".")[0]:
                bump = "major"
            elif old and old.split(".")[1] != row["version"].split(".")[1] and bump == "patch":
                bump = "minor"
    version = next_version(base, bump)
    contributions = set(previous.get("contributions", []))
    for module in candidates["modules"]:
        if not offline and extract:
            extract_module(root, module)
        source = root / "modules" / module["id"] / "module.manifest.json"
        raw = json.loads(source.read_text())
        stamped = {**raw, **module.get("manifest", {}), "id": module["id"], "version": module["version"], "commit": module["commit"], "path": "web/modules/" + module["id"]}
        source.write_text(json.dumps(stamped, indent=2, ensure_ascii=False) + "\n")
        if module.get("prNumber"):
            contributions.add(module["prNumber"])
    if not offline:
        latest_tag = "v" + base
        commits = subprocess.check_output(["git", "log", "--format=%H", latest_tag + "..HEAD"], cwd=root, text=True).splitlines() if latest_tag in tags else [subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()]
        for commit in commits:
            for pull in api("/commits/" + commit + "/pulls"):
                if pull.get("merged_at") and pull["base"]["repo"]["full_name"] == REPOSITORY and not any(label["name"] in ("baseline", "release", "bootstrap") for label in pull.get("labels", [])):
                    contributions.add(pull["number"])
    for area in ("backend", "frontend"):
        file = root / area / "package.json"
        package = json.loads(file.read_text()); package["version"] = version
        file.write_text(json.dumps(package, indent=2, ensure_ascii=False) + "\n")
    if metadata != root:
        for client in ("desktop", "mobile"):
            file = metadata / client / "package.json"
            package = json.loads(file.read_text()); package["version"] = version
            file.write_text(json.dumps(package, indent=2, ensure_ascii=False) + "\n")
        appfile = metadata / "mobile/app.json"
        app = json.loads(appfile.read_text()); app["expo"]["version"] = version
        appfile.write_text(json.dumps(app, indent=2, ensure_ascii=False) + "\n")
    (metadata / "modules.lock.json").write_text(json.dumps(candidates, indent=2, ensure_ascii=False) + "\n")
    (metadata / "release.manifest.json").write_text(json.dumps({"format": 1, "version": version, "clients": {name: version for name in ("web", "desktop", "mobile")}, "contributions": sorted(contributions), "modules": []}, indent=2) + "\n")
    return version


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--candidates", type=Path, required=True)
    parser.add_argument("--bump", choices=("auto", "patch", "minor", "major"), default="auto")
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()
    candidates = json.loads(args.candidates.read_text())
    if not isinstance(candidates.get("modules"), list):
        raise ValueError("Missing authoritative module candidates")
    candidates["format"] = 1
    print(prepare(args.root.resolve(), candidates, args.bump, args.offline))
