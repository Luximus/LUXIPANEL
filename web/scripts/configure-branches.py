#!/usr/bin/env python3
"""Explicit maintainer setup; default is a read-only preview."""
import argparse
import json
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec

def load(name, filename):
    spec = spec_from_file_location(name, Path(__file__).with_name(filename))
    module = module_from_spec(spec); spec.loader.exec_module(module); return module

policy = load("policy", "branch-policy.py")
prepare = load("prepare", "prepare-release.py")


def configure(apply=False):
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
    return changes


if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("--apply", action="store_true")
    print(json.dumps(configure(parser.parse_args().apply), indent=2))
