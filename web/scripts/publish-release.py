#!/usr/bin/env python3
"""Publish exactly the reviewed combined release commit; retrying is idempotent."""
import json, os, re, urllib.error
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location("relay", Path(__file__).with_name("module-review-relay.py")); relay = module_from_spec(spec); spec.loader.exec_module(relay)
number = os.environ.get("RELEASE_PR_NUMBER", ""); commit = os.environ.get("RELEASE_COMMIT", "")
if not number.isdigit() or not re.fullmatch(r"[a-f0-9]{40}", commit): raise ValueError("Invalid release identity")
pull = relay.prepare.api("/pulls/" + number)
if not pull.get("merged") or pull["merge_commit_sha"] != commit or pull["base"]["ref"] != "main" or pull["head"]["ref"] != "lxp/release-next" or pull["head"]["repo"]["full_name"] != relay.prepare.REPOSITORY or not any(label["name"] == "release" for label in pull["labels"]): raise ValueError("Not a reviewed combined release PR")
guard_spec = spec_from_file_location("guard", Path(__file__).with_name("release-snapshot-guard.py")); guard = module_from_spec(guard_spec); guard_spec.loader.exec_module(guard)
guard.check(pull)
manifest = json.loads(relay.prepare.metadata_root(Path.cwd()).joinpath("release.manifest.json").read_text()); tag = "v" + manifest["version"]
if not re.fullmatch(r"v\d+\.\d+\.\d+", tag) or manifest["format"] != 1: raise ValueError("Invalid combined release")
try:
    existing = relay.prepare.api("/git/ref/tags/" + tag)
    if existing["object"]["sha"] != commit: raise ValueError("Release tag already points to a different commit")
except urllib.error.HTTPError as error:
    if error.code != 404: raise
    relay.prepare.api("/git/refs", "POST", {"ref": "refs/tags/" + tag, "sha": commit})
try: release = relay.prepare.api("/releases/tags/" + tag)
except urllib.error.HTTPError as error:
    if error.code != 404: raise
    release = relay.prepare.api("/releases", "POST", {"tag_name": tag, "target_commitish": commit, "name": "LUXIPANEL " + tag, "generate_release_notes": True, "draft": False, "prerelease": False})
if release["draft"] or release["prerelease"]: raise ValueError("An unpublished release with this tag already exists")
relay.lp("/panel-release", data={"tag": tag})
label = "release:" + tag
try: relay.prepare.api("/labels", "POST", {"name": label, "color": "1565c0"})
except urllib.error.HTTPError as error:
    if error.code != 422: raise
announcements = relay.prepare.api("/issues?state=all&labels=" + label)
if not announcements:
    relay.prepare.api("/issues", "POST", {"title": "LUXIPANEL " + tag + " disponible", "body": "Nueva entrega conjunta del panel y sus módulos aprobados. Consulta las novedades y comenta aquí: " + release["html_url"], "labels": ["announcement", label]})
print(release["html_url"])
