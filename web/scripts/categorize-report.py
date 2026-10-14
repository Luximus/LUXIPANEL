#!/usr/bin/env python3
import json, os, re, urllib.error
from importlib.util import spec_from_file_location, module_from_spec
from pathlib import Path
spec = spec_from_file_location("prepare", Path(__file__).with_name("prepare-release.py")); prepare = module_from_spec(spec); spec.loader.exec_module(prepare)
number = os.environ.get("ISSUE_NUMBER", "")
if not number.isdigit(): raise ValueError("Invalid issue")
issue = prepare.api("/issues/" + number)
match = re.search(r"<!-- luxipanel-report (\{[^\n]*\}) -->", issue.get("body") or "")
if not match: raise SystemExit(0)
try: metadata = json.loads(match[1])
except ValueError: raise SystemExit(0)
slug = metadata.get("moduleId", "")
if slug != "luxipanel" and not re.fullmatch(r"[a-z][a-z0-9-]{2,38}", slug): raise SystemExit(0)
labels = ["core-report"] if slug == "luxipanel" else ["module-report", "module:" + slug]
if metadata.get("severity") == "warn": labels.append("warning")
for label in labels:
    try: prepare.api("/labels", "POST", {"name": label, "color": "1565c0"})
    except urllib.error.HTTPError as error:
        if error.code != 422: raise
prepare.api("/issues/" + number + "/labels", "POST", {"labels": labels})
