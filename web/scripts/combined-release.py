#!/usr/bin/env python3
"""Idempotently maintain one reviewed release PR, without publishing a version."""
import json, os, subprocess, tempfile
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location("relay", Path(__file__).with_name("module-review-relay.py")); relay = module_from_spec(spec); spec.loader.exec_module(relay)
root = Path.cwd(); repository = relay.prepare.metadata_root(root); branch = "lxp/release-next"
subject = subprocess.check_output(["git", "log", "-1", "--format=%s"], text=True)
if subject.startswith("chore(release):"):
    raise SystemExit(0)
candidates = relay.lp("/release-candidates", "GET")
version = relay.prepare.prepare(root, candidates)
subprocess.run(["node", "scripts/build-release-bundle.mjs"], check=True)
paths = ["web/backend/package.json", "web/frontend/package.json", "modules.lock.json", "release.manifest.json", "desktop/package.json", "mobile/package.json", "mobile/app.json"]
if (root / "modules").is_dir(): paths.append("web/modules")
subprocess.run(["git", "checkout", "-B", branch], check=True)
subprocess.run(["git", "add", "--"] + paths, cwd=repository, check=True)
subprocess.run(["git", "-c", "core.hooksPath=/dev/null", "-c", "user.name=LUXIPANEL release pipeline", "-c", "user.email=release@users.noreply.github.com", "commit", "-m", "chore(release): LUXIPANEL v" + version], check=True)
# Force is confined to the pipeline branch and protects against concurrent writers.
subprocess.run(["git", "fetch", "origin", "refs/heads/" + branch + ":refs/remotes/origin/" + branch], check=False)
subprocess.run(["git", "push", "--force-with-lease", "origin", "HEAD:refs/heads/" + branch], check=True)
prs = relay.prepare.api("/pulls?state=open&base=main&head=Luxisoft:" + branch)
body = "Entrega conjunta del núcleo y módulos aprobados. Revisa el manifiesto, los hashes y las comprobaciones antes de integrar. La integración publicará una única Release oficial."
data = {"title": "chore(release): LUXIPANEL v" + version, "body": body}
pull = relay.prepare.api("/pulls/" + str(prs[0]["number"]), "PATCH", data) if prs else relay.prepare.api("/pulls", "POST", {**data, "base": "main", "head": branch})
relay.prepare.api("/issues/" + str(pull["number"]) + "/labels", "POST", {"labels": ["release"]})
print(pull["html_url"])
