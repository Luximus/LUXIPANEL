#!/usr/bin/env python3
"""Read PR metadata with trusted default-branch code; never execute its head."""
import json
import os
import subprocess
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec

def load(name, filename):
    spec = spec_from_file_location(name, Path(__file__).with_name(filename))
    module = module_from_spec(spec); spec.loader.exec_module(module); return module

policy = load("policy", "branch-policy.py")
prepare = load("prepare", "prepare-release.py")


def validate(pull, files):
    base = pull["base"]["ref"]
    if pull["head"]["repo"]["full_name"] == prepare.REPOSITORY:
        # Only the pipeline may open canonical internal baseline/release PRs.
        if pull["head"]["ref"] not in (*policy.CLIENTS, "developer", "main", policy.TEMPORARY):
            raise ValueError("Create contribution branches in your personal fork")
        if pull["user"]["login"] != "github-actions[bot]":
            raise ValueError("Canonical source branches are reserved for the pipeline")
        if base in policy.CLIENTS:
            if pull["head"]["ref"] != "developer":
                raise ValueError("Client baseline must come from tested developer")
            subprocess.run(["git", "merge-base", "--is-ancestor", pull["base"]["sha"], pull["head"]["sha"]], check=True)
            return
        if base == "modules" and pull["head"]["ref"] == policy.TEMPORARY:
            # Main baseline updates must preserve the module source tree exactly.
            before = subprocess.check_output(["git", "ls-tree", pull["base"]["sha"], "web/modules"], text=True).strip()
            after = subprocess.check_output(["git", "ls-tree", pull["head"]["sha"], "web/modules"], text=True).strip()
            if before != after: raise ValueError("Baseline changed module sources")
            return
        raise ValueError("Unsupported internal baseline")
    policy.assert_scope(base, files)


if __name__ == "__main__":
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
    number = str(event["pull_request"]["number"])
    pull = prepare.api("/pulls/" + number)
    if pull["head"]["sha"] != event["pull_request"]["head"]["sha"]:
        raise ValueError("PR changed during scope review; use the latest check")
    files = []
    for page in range(1, 31):
        batch = prepare.api(f"/pulls/{number}/files?per_page=100&page={page}")
        for entry in batch:
            files.append(entry["filename"])
            if entry.get("previous_filename"): files.append(entry["previous_filename"])
        if len(batch) < 100: break
    else: raise ValueError("Contribution exceeds review limits")
    # Fetch immutable objects only, no checkout, filters, hooks or candidate scripts.
    for sha in (pull["head"]["sha"], pull["base"]["sha"]):
        subprocess.run(["git", "fetch", "--no-tags", "origin", sha], check=True)
    validate(pull, files)
