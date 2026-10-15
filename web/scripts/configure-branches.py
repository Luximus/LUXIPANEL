#!/usr/bin/env python3
"""Explicit maintainer setup; default is a read-only preview."""
import argparse
import json
import ast
import subprocess
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec

def load(name, filename):
    spec = spec_from_file_location(name, Path(__file__).with_name(filename))
    module = module_from_spec(spec); spec.loader.exec_module(module); return module

policy = load("policy", "branch-policy.py")
prepare = load("prepare", "prepare-release.py")


def retire_legacy():
    subprocess.run(["git", "fetch", "origin", "main", "developer"], check=True)
    source = subprocess.check_output(["git", "show", "origin/main:web/scripts/branch-policy.py"], text=True)
    values = [ast.literal_eval(node.value) for node in ast.parse(source).body if isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id == "PERMANENT" for target in node.targets)]
    if values != [policy.PERMANENT]: raise ValueError("Merge and validate the three-branch pipeline on main before retiring legacy branches")
    branches = {row["name"]: row["commit"]["sha"] for row in prepare.api("/branches?per_page=100")}
    import urllib.error
    for name in (*policy.CLIENTS, policy.BOOTSTRAP):
        if name not in branches: continue
        sha = branches[name]
        if not any(subprocess.run(["git", "merge-base", "--is-ancestor", sha, target]).returncode == 0 for target in ("origin/main", "origin/developer")):
            raise ValueError("Preserve exclusive work before retiring " + name)
        if prepare.api("/pulls?state=open&head=Luxisoft:" + name): raise ValueError("Open PR still uses " + name)
        try: prepare.api("/branches/" + name + "/protection", "DELETE")
        except urllib.error.HTTPError as error:
            if error.code != 404: raise
        subprocess.run(["git", "push", "--force-with-lease=refs/heads/" + name + ":" + sha, "origin", ":refs/heads/" + name], check=True)


def configure(apply=False, retire=False):
    stable = prepare.api("/git/ref/heads/main")["object"]["sha"]
    branches = {entry["name"] for entry in prepare.api("/branches?per_page=100")}
    changes = {"create": [name for name in policy.PERMANENT if name not in branches],
               "protections": {name: policy.protection(name) for name in policy.PERMANENT},
               "ruleset": policy.creation_ruleset()}
    if not apply: return changes
    for name in changes["create"]:
        prepare.api("/git/refs", "POST", {"ref": "refs/heads/" + name, "sha": stable})
    for name, data in changes["protections"].items():
        prepare.api("/branches/" + name + "/protection", "PUT", data)
    existing = [row for row in prepare.api("/rulesets") if row["name"] == changes["ruleset"]["name"]]
    prepare.api("/rulesets" + ("/" + str(existing[0]["id"]) if existing else ""), "PUT" if existing else "POST", changes["ruleset"])
    prepare.api("", "PATCH", {"allow_auto_merge": True})
    import urllib.error
    for name in ["area:web", "area:desktop", "area:mobile", "area:shared", "area:modules", "type:fix", "type:feat", "type:docs", "type:test", "type:refactor", "type:chore", "type:perf", "type:ci", "type:build", "release", "hotfix", "baseline", "bootstrap"]:
        try: prepare.api("/labels/" + name)
        except urllib.error.HTTPError as error:
            if error.code != 404: raise
            prepare.api("/labels", "POST", {"name": name, "color": "1565c0"})
    if retire: retire_legacy()
    return changes


if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("--apply", action="store_true"); parser.add_argument("--retire-legacy", action="store_true")
    args = parser.parse_args()
    if args.retire_legacy and not args.apply: parser.error("--retire-legacy requires --apply")
    print(json.dumps(configure(args.apply, args.retire_legacy), indent=2))
