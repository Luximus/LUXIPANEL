#!/usr/bin/env python3
"""Reject stale or untested developer snapshots before review and publication."""
import os
import re
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location("prepare", Path(__file__).with_name("prepare-release.py"))
prepare = module_from_spec(spec); spec.loader.exec_module(prepare)


def check(pull):
    if not any(row["name"] == "release" for row in pull.get("labels", [])): return
    match = re.search(r"Developer tested: `([a-f0-9]{40})`", pull.get("body") or "")
    if not match: raise ValueError("Release lacks tested developer provenance")
    sha = match[1]
    if prepare.api("/git/ref/heads/developer")["object"]["sha"] != sha:
        raise ValueError("Developer changed after these release checks; prepare a new snapshot")
    runs = prepare.api("/actions/workflows/developer-checks.yml/runs?head_sha=" + sha + "&per_page=100")["workflow_runs"]
    runs = [row for row in runs if row["head_branch"] == "developer" and row["event"] in ("push", "workflow_dispatch") and row["head_repository"]["full_name"] == prepare.REPOSITORY]
    if not runs or max(runs, key=lambda row: row["id"])["conclusion"] != "success":
        raise ValueError("Current developer snapshot has not passed integration CI")


if __name__ == "__main__":
    for pull in prepare.api("/pulls?state=open&base=main&head=Luxisoft:lxp/release-next"):
        check(pull)
