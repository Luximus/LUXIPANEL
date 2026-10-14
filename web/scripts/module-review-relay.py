#!/usr/bin/env python3
"""Privileged relay uses trusted analyzers, never a contributor's executable code."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import urllib.request
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location("prepare", Path(__file__).with_name("prepare-release.py"))
prepare = module_from_spec(spec); spec.loader.exec_module(prepare)
auth_spec = spec_from_file_location("review_auth", Path(__file__).with_name("review-auth.py"))
auth = module_from_spec(auth_spec); auth_spec.loader.exec_module(auth)


def lp(route, method="POST", data=None):
    base = (os.environ.get("LP_REVIEW_URL") or "https://api.luxisoft.com").rstrip("/")
    if not base.startswith("https://"):
        raise RuntimeError("LP_REVIEW_URL must use HTTPS")
    headers = {"Authorization": "Bearer " + auth.token(), "Content-Type": "application/json"}
    request = urllib.request.Request(base + "/api/internal/review" + route, method=method, headers=headers, data=json.dumps(data).encode() if data is not None else None)
    with urllib.request.urlopen(request, timeout=30) as response:
        body = json.load(response)
    if not body.get("ok"):
        raise RuntimeError("LP rejected the reviewed module event")
    return body.get("data")


if __name__ == "__main__":
    static = "--static" in sys.argv
    run_id = os.environ.get("REVIEW_RUN_ID")
    if run_id:
        if not run_id.isdigit():
            raise ValueError("Invalid workflow run")
        run = prepare.api("/actions/runs/" + run_id)
        if run["conclusion"] != "success" or run["path"] != ".github/workflows/module-review.yml":
            raise ValueError("Workflow run is not a successful canonical review")
        pulls = run.get("pull_requests", []) or prepare.api("/commits/" + run["head_sha"] + "/pulls")
    else:
        number = os.environ.get("MODULE_PR_NUMBER", "")
        if not number.isdigit():
            raise ValueError("Invalid pull request")
        pulls = [prepare.api("/pulls/" + number)]
    for short in pulls:
        pull = prepare.api("/pulls/" + str(short["number"]))
        if pull["base"]["repo"]["full_name"] != prepare.REPOSITORY or pull["base"]["ref"] != "modules":
            continue
        if run_id and pull["head"]["sha"] != run["head_sha"]:
            continue
        files = []
        for page in range(1, 31):
            batch = prepare.api("/pulls/" + str(pull["number"]) + "/files?per_page=100&page=" + str(page))
            files.extend(batch)
            if len(batch) < 100: break
        else: raise ValueError("Contribution exceeds review limits")
        ids = {entry["filename"].split("/")[2] for entry in files if re.fullmatch(r"web/modules/[a-z][a-z0-9-]{2,38}/.+", entry["filename"])}
        if len(ids) != 1 or any(not entry["filename"] .startswith("web/modules/" + next(iter(ids)) + "/") for entry in files):
            raise ValueError("Each contribution must change one module")
        slug = next(iter(ids)); version_id = None
        if not static:
            registration = lp("/contributions", data={"moduleId": slug, "prUrl": pull["html_url"]})
            version_id = registration["versionId"]
            if registration["reviewStatus"] in ("aprobado", "publico"): continue
        with tempfile.TemporaryDirectory(prefix="lxp-static-review-") as directory:
            root = Path(directory)
            prepare.extract_module(root, {"id": slug, "commit": pull["head"]["sha"]}, Path.cwd())
            command = ["node", "--import", str(Path("backend/node_modules/tsx/dist/loader.mjs").resolve()), "scripts/review-module.ts", str(root / "modules" / slug)]
            analyzer_env = {key: value for key, value in os.environ.items() if key not in {"GH_TOKEN", "GITHUB_TOKEN", "RUNNER_REVIEW_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_URL"}}
            result = subprocess.run(command, text=True, capture_output=True, timeout=240, env=analyzer_env)
            try: report = json.loads(result.stdout.strip().splitlines()[-1])
            except Exception: raise RuntimeError("Trusted static analysis did not produce a report")
            for event in report["events"]:
                if static: continue
                lp("/" + version_id + "/events", data={**event, "headSha": pull["head"]["sha"], "reviewer": "trusted-github-runner"})
            if result.returncode:
                raise RuntimeError("Static analysis failed")
            if not static and pull.get("merged"):
                lp("/" + version_id + "/approve-merged", data={})
