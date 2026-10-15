#!/usr/bin/env python3
"""Validate a frozen, tested candidate; developer may continue independently."""
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location("prepare", Path(__file__).with_name("prepare-release.py"))
prepare = module_from_spec(spec); spec.loader.exec_module(prepare)


def module_digest(modules):
    return hashlib.sha256(json.dumps(modules, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def validate_provenance(provenance, run, branch, version):
    sha = provenance.get("sourceSha", "")
    if provenance.get("format") != 1 or not re.fullmatch(r"[a-f0-9]{40}", sha):
        raise ValueError("Invalid frozen source provenance")
    kind = provenance.get("kind")
    if kind not in ("release", "hotfix") or branch != kind + "/" + version:
        raise ValueError("Candidate branch and version do not match")
    if (run.get("conclusion") != "success" or run.get("head_repository", {}).get("full_name") != prepare.REPOSITORY
            or run.get("run_attempt", 1) != provenance.get("sourceAttempt", 1)):
        raise ValueError("Frozen source checks have not passed")
    if kind == "release":
        valid = (run.get("path") == ".github/workflows/developer-checks.yml" and run.get("head_branch") == "developer"
                 and run.get("head_sha") == sha and run.get("event") in ("push", "workflow_dispatch"))
    else:
        valid = (run.get("path") == ".github/workflows/hotfix-checks.yml" and run.get("head_branch") == "main"
                 and run.get("event") == "workflow_dispatch" and run.get("display_title") == f"Hotfix checks {branch} @ {sha}")
    if not valid: raise ValueError("Checks do not belong to the frozen source")


def metadata_only(source, head, version, git):
    if git("rev-parse", head + "^1") != source:
        raise ValueError("Candidate changed after its source snapshot was tested")
    packages = {name + "/package.json" for name in ("web/backend", "web/frontend", "desktop", "mobile")}
    allowed = packages | {"mobile/app.json", "release.manifest.json", "modules.lock.json", "release.provenance.json"}
    files = git("diff", "--name-only", source, head).splitlines()
    if not files or set(files) - allowed: raise ValueError("Untested code was added to the frozen candidate")
    for filename in set(files) & (packages | {"mobile/app.json", "modules.lock.json"}):
        before = json.loads(git("show", source + ":" + filename)); after = json.loads(git("show", head + ":" + filename))
        if filename in packages:
            before.pop("version", None)
            if after.pop("version", None) != version: raise ValueError("Client version mismatch")
        elif filename == "mobile/app.json":
            before["expo"].pop("version", None)
            if after["expo"].pop("version", None) != version: raise ValueError("Mobile version mismatch")
        if before != after: raise ValueError("Version stamping changed untested dependencies or module selection")


def check(pull, cwd=None):
    if pull["base"]["ref"] != "main" or pull["head"]["repo"]["full_name"] != prepare.REPOSITORY or pull["user"]["login"] != "github-actions[bot]":
        raise ValueError("Main accepts reviewed pipeline candidates only")
    labels = {row["name"] for row in pull.get("labels", [])}
    if "bootstrap" in labels and pull["head"]["ref"] == "lxp/release-next": return
    if "release" not in labels: raise ValueError("Main requires a release candidate")
    repository = prepare.metadata_root(Path(cwd or Path.cwd()))
    def git(*args): return subprocess.check_output(["git", *args], cwd=repository, text=True).strip()
    head = pull["head"]["sha"]
    if not re.fullmatch(r"[a-f0-9]{40}", head): raise ValueError("Invalid candidate SHA")
    subprocess.run(["git", "fetch", "--no-tags", "--depth=2", "origin", head], cwd=repository, check=True)
    provenance = json.loads(git("show", head + ":release.provenance.json"))
    manifest = json.loads(git("show", head + ":release.manifest.json"))
    if not re.fullmatch(r"\d+\.\d+\.\d+", manifest["version"]) or manifest.get("format") != 1: raise ValueError("Invalid release manifest")
    run = prepare.api("/actions/runs/" + str(int(provenance["sourceRun"])))
    validate_provenance(provenance, run, pull["head"]["ref"], manifest["version"])
    source = provenance["sourceSha"]
    subprocess.run(["git", "fetch", "--no-tags", "origin", source], cwd=repository, check=True)
    metadata_only(source, head, manifest["version"], git)
    if module_digest(manifest["modules"]) != provenance.get("testedModulesSha256"):
        raise ValueError("Module artifacts changed after source checks")
    latest = prepare.api("/releases/latest")["tag_name"]
    if latest not in (provenance["stableTag"], "v" + manifest["version"]):
        raise ValueError("Stable version changed; rebuild this candidate against the new stable release")
    return provenance


if __name__ == "__main__":
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
    if "pull_request" in event:
        pull = prepare.api("/pulls/" + str(event["pull_request"]["number"]))
        if pull["head"]["sha"] != event["pull_request"]["head"]["sha"]: raise ValueError("PR changed during checks")
        check(pull)
    else:
        branch = os.environ["GITHUB_REF_NAME"]
        prs = prepare.api("/pulls?state=open&base=main&head=Luxisoft:" + branch)
        if len(prs) != 1: raise ValueError("No unique candidate PR for this ref")
        check(prs[0])
