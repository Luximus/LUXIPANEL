#!/usr/bin/env python3
"""Explicit checks for token-created internal PRs (push does not trigger CI)."""
import json
import os
import subprocess
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location("scope", Path(__file__).with_name("check-branch-scope.py"))
scope = module_from_spec(spec); spec.loader.exec_module(scope)
prepare = scope.prepare
head = os.environ["GITHUB_REF_NAME"]
if head != scope.policy.BASELINE: raise ValueError("Invalid baseline source")
for pull in prepare.api("/pulls?state=open&head=Luxisoft:" + head):
    if not any(label["name"] == "baseline" for label in pull.get("labels", [])): continue
    for sha in (pull["base"]["sha"], pull["head"]["sha"]):
        subprocess.run(["git", "fetch", "--no-tags", "origin", sha], check=True)
    state = "success"
    try: scope.validate(pull, ["internal-baseline"])
    except Exception:
        state = "failure"
        raise
    finally:
        prepare.api("/statuses/" + pull["head"]["sha"], "POST", {"context": "branch-scope", "state": state, "description": "Internal baseline preserves pending work"})
